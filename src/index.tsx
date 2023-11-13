import { For, JSX, createComputed, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import { customElement } from 'solid-element';
import style from './styles/index.css?raw';
import { calculateRelayLatest, updateProfiles, totalChildren, sortByDate, parseUrlPrefixes, parseContent } from "./util/ui";
import { nest } from "./util/nest";
import { store, pool, isDisableType, Anchor, signersStore } from "./util/stores";
import { Thread, ellipsisSvg } from "./thread";
import { RootComment } from "./reply";
import { Sub } from "./nostr-tools/relay";
import { decode as bolt11Decode } from "light-bolt11-decoder";
import { clear as clearCache, find, findAll, save, watchAll } from "./util/db";
import { decode } from "./nostr-tools/nip19";
import { getPublicKey } from "./nostr-tools/keys";
import { getSignature } from "./nostr-tools/event";
import { Filter } from "./nostr-tools/filter";
import { AggregateEvent, NoteEvent, eventToNoteEvent } from "./util/models";

const ZapThreads = (props: { [key: string]: string; }) => {
  if (!['http', 'naddr', 'note', 'nevent'].some(e => props.anchor.startsWith(e))) {
    throw "Only NIP-19 naddr, note and nevent encoded entities and URLs are supported";
  }

  createComputed(() => {
    store.anchor = (() => {
      if (props.anchor.startsWith('http')) {
        return { type: 'http', value: props.anchor };
      }
      const decoded = decode(props.anchor);
      switch (decoded.type) {
        case 'nevent': return { type: 'note', value: decoded.data.id };
        case 'note': return { type: 'note', value: decoded.data };
        case 'naddr':
          const d = decoded.data;
          return { type: 'naddr', value: `${d.kind}:${d.pubkey}:${d.identifier}` };
        default: throw 'Malformed anchor';
      }
    })();
  });
  const anchor = () => store.anchor!;

  createComputed(() => {
    const defaultRelays = "wss://relay.damus.io,wss://nos.lol";
    store.relays = (props.relays || defaultRelays).split(",").map(r => new URL(r).toString());
  });
  const relays = () => store.relays!;

  createComputed(() => {
    store.disable = props.disable.split(',').map(e => e.trim()).filter(isDisableType);
  });
  const disable = () => store.disable!;

  createComputed(() => {
    store.urlPrefixes = parseUrlPrefixes(props.urlPrefixes);
  });

  const requestedVersion = () => props.version;
  const closeOnEose = () => disable().includes('watch');

  store.profiles = watchAll(() => ['profiles']);

  let sub: Sub | null;

  // Anchors -> root events -> events

  // clear version on anchor change
  createEffect(on([anchor], () => {
    store.version = requestedVersion();
  }));

  // Anchors -> root events
  createEffect(on([anchor, relays], async () => {
    let filterForRemoteRootEvents: Filter;
    let localRootEvents: NoteEvent[];

    // Find root events from anchor
    // We sort by date so that the IDs are kept in order before discarding the timestamp
    switch (anchor().type) {
      case 'http':
        localRootEvents = await findAll('events', 'r', [anchor().value]);
        store.rootEventIds = sortByDate(localRootEvents).map(e => e.id);
        filterForRemoteRootEvents = { '#r': [anchor().value], kinds: [1] };
        break;
      case 'note':
        // In the case of note we only have one possible anchor, so return if found
        const e = await find('events', anchor().value);
        if (e) {
          store.rootEventIds = [e.id];
          store.anchorAuthor = e.pk;
          return;
        } else {
          // queue to fetch from remote
          filterForRemoteRootEvents = { ids: [anchor().value] };
          break;
        }
      case 'naddr':
        const [kind, pubkey, identifier] = anchor().value.split(':');
        localRootEvents = (await findAll('events', 'd', [identifier])).filter(e => e.pk === pubkey);
        if (localRootEvents.length > 0) {
          store.rootEventIds = sortByDate(localRootEvents).map(e => e.id);
          store.anchorAuthor = localRootEvents[0].pk;
        }
        filterForRemoteRootEvents = { authors: [pubkey], kinds: [parseInt(kind)], '#d': [identifier] };
        break;
    }

    pool.list(relays(), [{ ...filterForRemoteRootEvents, since: await since() }]).then(remoteRootEvents => {
      const remoteRootNoteEvents = remoteRootEvents.map(eventToNoteEvent);
      for (const e of remoteRootNoteEvents) {
        save('events', e);
      }

      switch (anchor().type) {
        case 'http':
        case 'naddr':
          const events = [...localRootEvents, ...remoteRootNoteEvents];
          const sortedEventIds = sortByDate([...events]).map(e => e.id);
          // only set root event ids if we have a newer event from remote
          if ((sortedEventIds.length > 0 && sortedEventIds[0]) !== store.rootEventIds[0]) {
            store.rootEventIds = sortedEventIds;
          }
          break;
        case 'note':
          store.rootEventIds = remoteRootNoteEvents.map(e => e.id);
          break;
      }

      if (remoteRootNoteEvents.length > 0) {
        store.anchorAuthor = remoteRootNoteEvents[0].pk;
      }
    });
  }));

  // Root events -> filter
  createEffect(on([() => store.rootEventIds, requestedVersion], () => {
    // set the filter for finding actual comments
    switch (anchor().type) {
      case 'http':
      case 'note':
        if ((store.filter['#e'] ?? []).toString() !== store.rootEventIds.toString()) {
          store.filter = { "#e": store.rootEventIds };
        }
        return;
      case 'naddr':
        const existingAnchor = store.filter['#a'] && store.filter['#a'][0];
        if (anchor().value !== existingAnchor) {
          store.filter = { "#a": [anchor().value] };
        }

        // Version only applicable to naddr - get provided version or default to most recent root event ID
        store.version = requestedVersion() || store.rootEventIds[0];
        return;
    }
  }, { defer: true }));

  const since = async () => {
    const relaysForAnchor = await findAll('relays', 'a', [anchor().value]);
    const relaysLatest = relaysForAnchor.filter(r => relays().includes(r.n)).map(t => t.l);

    // TODO Do not use the common minimum, pass each relay's latest as its since
    // (but we need to stop using this pool)
    return relaysLatest.length > 0 ? Math.min(...relaysLatest) + 1 : 0;
  };

  const filter = () => store.filter;

  // Filter -> remote events, content
  createEffect(on([filter, relays], async () => {
    // Ensure clean subs
    sub?.unsub();
    sub = null;

    onCleanup(() => {
      console.log('[zapthreads] unsubscribing and cleaning up');
      sub?.unsub();
      sub = null;
    });

    const kinds = [1, 9802, 7, 9735];
    // TODO restore (with a specific `since` for aggregates)
    // if (!store.disable().includes('likes')) {
    //   kinds.push(7);
    // }
    // if (!store.disable().includes('zaps')) {
    //   kinds.push(9735);
    // }

    try {
      console.log('[zapthreads] subscribing to', anchor().value);

      sub = pool.sub(relays(), [{ ...filter(), kinds, since: await since() }]);

      const newLikeIds = new Set<string>();
      const newZaps: { [id: string]: number; } = {};

      sub.on('event', async (e) => {
        if (e.kind === 1 || e.kind === 9802) {
          if (e.content.trim()) {
            save('events', eventToNoteEvent(e));
          }
        } else if (e.kind === 7) {
          newLikeIds.add(e.id);
        } else if (e.kind === 9735) {
          const invoiceTag = e.tags.find(t => t[0] === "bolt11");
          if (invoiceTag) {
            const decoded = bolt11Decode(invoiceTag[1]);
            const amount = decoded.sections.find((e: { name: string; }) => e.name === 'amount');
            const sats = Number(amount.value) / 1000;
            newZaps[e.id] = sats;
          }
        }
      });

      sub.on('eose', async () => {
        const _anchor = anchor();

        (async () => {
          const likesAggregate: AggregateEvent = await find('aggregates', IDBKeyRange.only([anchor().value, 7]))
            ?? { eid: anchor().value, ids: [], k: 7 };
          likesAggregate.ids = [...new Set([...likesAggregate.ids, ...newLikeIds])];
          save('aggregates', likesAggregate);

          const zapsAggregate: AggregateEvent = await find('aggregates', IDBKeyRange.only([anchor().value, 9735]))
            ?? { eid: anchor().value, ids: [], k: 9735, sum: 0 };
          zapsAggregate.sum = Object.entries(newZaps).reduce((acc, entry) => {
            if (zapsAggregate.ids.includes(entry[0])) return acc;
            return acc + entry[1];
          }, zapsAggregate.sum ?? 0);

          zapsAggregate.ids = [...new Set([...zapsAggregate.ids, ...Object.keys(newZaps)])];
          save('aggregates', zapsAggregate);
        })();

        setTimeout(async () => {
          // Update profiles of current events (including anchor author)
          await updateProfiles([...events().map(e => e.pk)], relays(), store.profiles());

          // Calculate latest received events for each relay
          calculateRelayLatest(_anchor);

          if (closeOnEose()) {
            sub?.unsub();
            pool.close(relays());
          }
        }, 96); // same as batched throttle in db.ts
      });
    } catch (e) {
      // TODO properly handle error
      console.log(e);
    }
  }, { defer: true }));

  // Login external npub/nsec
  const npubOrNsec = () => props.npub;

  // Auto login when external pubkey supplied
  createEffect(on(npubOrNsec, (_) => {
    if (_) {
      let pubkey: string;
      let privkey: string | undefined;
      if (_.startsWith('nsec')) {
        privkey = decode(_).data as string;
        pubkey = getPublicKey(privkey);
      } else {
        pubkey = decode(_).data as string;
      }
      signersStore.external = {
        pk: pubkey,
        signEvent: async (event) => {
          // Sign with private key if nsec was provided
          if (privkey) {
            return { sig: getSignature(event, privkey) };
          }

          // We validate here in order to delay prompting the user as much as possible
          if (!window.nostr) {
            alert('Please log in with a NIP-07 extension such as Alby or nos2x');
            signersStore.active = undefined;
            throw 'No extension available';
          }

          const extensionPubkey = await window.nostr!.getPublicKey();
          const loggedInPubkey = pubkey;
          if (loggedInPubkey !== extensionPubkey) {
            // If zapthreads was passed a different pubkey then error
            const error = `ERROR: Event not signed. Supplied pubkey does not match extension pubkey. ${loggedInPubkey} !== ${extensionPubkey}`;
            signersStore.active = undefined;
            alert(error);
            throw error;
          } else {
            return window.nostr!.signEvent(event);
          }

        }
      };
      signersStore.active = signersStore.external;
    }
  }));

  // Log out when external npub/nsec is absent
  createEffect(on(npubOrNsec, (_) => {
    if (!_) {
      signersStore.active = undefined;
    }
  }, { defer: true }));

  const articles = watchAll(() => ['events', 'k', [30023]]);

  const content = createMemo(() => {
    if (store.disable!.includes('hideContent') && anchor().type === 'naddr') {
      const [_, pubkey, identifier] = anchor().value.split(':');
      const contentEvent = articles().find(e => e.d === identifier && e.pk === pubkey);

      if (contentEvent) {
        const c = `# ${contentEvent.tl}\n ${contentEvent.c}`;
        return parseContent({ ...contentEvent, c }, store, []);
      }
    }
  });

  // Build JSX

  // Watch all events
  const eventsWatcher = createMemo(() => {
    switch (anchor().type) {
      case 'http':
      case 'note':
        return watchAll(() => ['events', 'ro', store.rootEventIds]);
      case 'naddr':
        return watchAll(() => ['events', 'a', [anchor().value]]);
    }
  });
  const events = () => eventsWatcher()();

  // Filter -> local events
  const nestedEvents = createMemo(() => {
    // calculate only once root event IDs are ready
    if (store.rootEventIds && store.rootEventIds.length) {
      const nested = nest(events());
      return nested.filter(e => {
        // remove all highlights without children (we only want those that have comments on them)
        return !(e.k === 9802 && e.children.length === 0);
      });
    }
    return [];
  });

  const commentsLength = () => {
    return nestedEvents().reduce((acc, n) => acc + totalChildren(n), nestedEvents().length);
  };

  const [showAdvanced, setShowAdvanced] = createSignal(false);

  return <>
    {content() && <div id="ztr-content" innerHTML={content()}></div>}
    <div id="ztr-root">
      <style>{style}</style>
      <RootComment />
      <h2 id="ztr-title">
        {commentsLength() > 0 && `${commentsLength()} comment${commentsLength() == 1 ? '' : 's'}`}
      </h2>
      <Thread nestedEvents={nestedEvents} articles={articles} />

      <div style="float:right; opacity: 0.2;" onClick={() => setShowAdvanced(!showAdvanced())}>{ellipsisSvg()}</div>
      {showAdvanced() && <Advanced />
      }
    </div></>;
};

const Advanced = () => <div>
  <small>Powered by <a href="https://github.com/fr4nzap/zapthreads">zapthreads</a></small><br />
  <small>
    <ul>
      <For each={Object.values(pool._conn)}>
        {r => <li>{r.url} [{r.status}] {r.status == 1 ? 'connected' : 'disconnected'}<br /></li>}
      </For>
    </ul>
  </small>
  <button onClick={clearCache}>Clear cache</button>
</div>;

export default ZapThreads;

customElement<ZapThreadsAttributes>('zap-threads', {
  anchor: "",
  version: "",
  relays: "",
  npub: "",
  disable: "",
  'url-prefixes': "",
}, (props) => {
  return <ZapThreads
    anchor={props.anchor ?? ''}
    version={props.version ?? ''}
    relays={props.relays ?? ''}
    npub={props.npub ?? ''}
    disable={props.disable ?? ''}
    urlPrefixes={props['url-prefixes'] ?? ''}
  />;
});

export type ZapThreadsAttributes = {
  [key in 'anchor' | 'version' | 'relays' | 'npub' | 'disable' | 'url-prefixes']?: string;
} & JSX.HTMLAttributes<HTMLElement>;

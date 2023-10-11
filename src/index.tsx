import { For, JSX, createEffect, createSignal, on, onCleanup } from "solid-js";
import { customElement } from 'solid-element';
import style from './styles/index.css?raw';
import { calculateRelayLatest, encodedEntityToFilterTag, encodedEntityToFilter, parseUrlPrefixes, updateProfiles, parseContent } from "./util/ui";
import { nest } from "./util/nest";
import { PreferencesStore, SignersStore, ZapThreadsContext, pool, StoredEvent, NoteEvent, isDisableType } from "./util/stores";
import { Thread, ellipsisSvg } from "./thread";
import { RootComment } from "./reply";
import { createMutable } from "solid-js/store";
import { Sub } from "./nostr-tools/relay";
import { decode as bolt11Decode } from "light-bolt11-decoder";
import { clear as clearCache, findAll, save, watchAll } from "./util/db";
import { decode } from "./nostr-tools/nip19";
import { getPublicKey } from "./nostr-tools/keys";
import { getSignature } from "./nostr-tools/event";

const ZapThreads = (props: { [key: string]: string; }) => {
  if (!['http', 'naddr', 'note', 'nevent'].some(e => props.anchor.startsWith(e))) {
    throw "Only NIP-19 naddr, note and nevent encoded entities and URLs are supported";
  }

  const anchor = () => props.anchor;
  const staticId = () => props.staticId;
  const _relays = (props.relays || "wss://relay.damus.io,wss://nos.lol").split(",");
  const relays = () => _relays.map(r => new URL(r).toString());

  const disable = () => props.disable.split(',').map(e => e.trim()).filter(isDisableType);
  const closeOnEose = () => disable().includes('watch');

  const signersStore = createMutable<SignersStore>({});
  const preferencesStore = createMutable<PreferencesStore>({
    disable: disable,
    urlPrefixes: parseUrlPrefixes(props.urlPrefixes),
  });

  const profiles = watchAll(() => ['profiles']);

  const [content, setContent] = createSignal('');
  const [anchorPubkey, setAnchorPubkey] = createSignal('');

  let sub: Sub | null;

  // Only update when anchor or relay props change
  createEffect(on([anchor, staticId, relays], async () => {
    preferencesStore.staticId = staticId();
    if (anchor().startsWith('http')) {
      const eventsForUrl = await pool.list(relays(), [
        { '#r': [anchor()], kinds: [1] }
      ]);
      const eventIdsForUrl = eventsForUrl.map((e) => e.id);
      preferencesStore.filter = { "#e": eventIdsForUrl };
    } else {
      preferencesStore.filter = encodedEntityToFilterTag(anchor());
    }
  }));

  const filter = () => preferencesStore.filter;

  createEffect(on([filter, relays], async () => {
    if (!filter()) return;

    // Ensure clean subs
    sub?.unsub();
    sub = null;
    onCleanup(() => {
      console.log('unsub!');
      sub?.unsub();
      sub = null;
    });

    const kinds: StoredEvent['kind'][] = [1];
    if (!preferencesStore.disable().includes('likes')) {
      kinds.push(7);
    }
    if (!preferencesStore.disable().includes('zaps')) {
      kinds.push(9735);
    }

    try {
      if (!anchor().startsWith('http')) {
        // find content and author
        const contentEvent = await pool.get(relays(), encodedEntityToFilter(anchor()));

        if (contentEvent) {
          setAnchorPubkey(contentEvent.pubkey);
          if (contentEvent.kind === 30023 && preferencesStore.disable().includes('hideContent')) {
            const titleTag = contentEvent.tags.find(t => t[0] == 'title');
            const title = titleTag && titleTag[1];
            contentEvent.content = `# ${title}\n ${contentEvent.content}`;
            setContent(parseContent(contentEvent, profiles(), anchor(), preferencesStore));
          }
        }
      }

      const relaysForAnchor = await findAll('relays', 'anchor', anchor());
      const relaysLatest = relaysForAnchor.filter(r => relays().includes(r.url)).map(t => t.latest);

      // TODO Do not use the common minimum, pass each relay's latest as its since
      // (but we need to stop using this pool)
      const since = relaysLatest.length > 0 ? Math.min(...relaysLatest) + 1 : 0;

      sub = pool.sub(relays(), [{ ...filter(), kinds, since: since }]);

      sub.on('event', async (e) => {
        if (e.kind === 1) {
          if (e.content.trim()) {
            save('events', {
              id: e.id,
              kind: e.kind,
              content: e.content,
              created_at: e.created_at,
              pubkey: e.pubkey,
              tags: e.tags,
              anchor: anchor()
            });
          }
        } else if (e.kind === 7) {
          save('events', {
            id: e.id,
            kind: 7,
            pubkey: e.pubkey,
            created_at: e.created_at,
            anchor: anchor()
          });
        } else if (e.kind === 9735) {
          const invoiceTag = e.tags.find(t => t[0] === "bolt11");
          if (invoiceTag) {
            const decoded = bolt11Decode(invoiceTag[1]);
            const amount = decoded.sections.find((e: { name: string; }) => e.name === 'amount');

            save('events', {
              id: e.id,
              kind: 9735,
              pubkey: e.pubkey,
              created_at: e.created_at,
              amount: Number(amount.value) / 1000,
              anchor: anchor()
            });
          }
        }
      });

      sub.on('eose', async () => {
        const _anchor = anchor();

        setTimeout(async () => {
          // Update profiles of current events (including anchor author)
          await updateProfiles([...events().map(e => e.pubkey), anchorPubkey()], relays(), profiles());

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
  }));

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

  // Build JSX

  const events = watchAll(() => ['events', 'kind+anchor', [1, anchor()] as [1, string]]);
  const nestedEvents = () => nest(events() as NoteEvent[]);
  const commentsLength = () => events().length;
  const [showAdvanced, setShowAdvanced] = createSignal(false);

  return <>
    {content() && <div id="ztr-content" innerHTML={content()}></div>}
    <div id="ztr-root">
      <style>{style}</style>
      <ZapThreadsContext.Provider value={{ relays, anchor, anchorPubkey, profiles, signersStore, preferencesStore }}>
        <RootComment />
        <h2 id="ztr-title">
          {commentsLength() > 0 && `${commentsLength()} comment${commentsLength() == 1 ? '' : 's'}`}
        </h2>
        <Thread nestedEvents={nestedEvents} />
        <div style="float:right; opacity: 0.2;" onClick={() => setShowAdvanced(!showAdvanced())}>{ellipsisSvg()}</div>
        {showAdvanced() && <div>
          <small>Powered by <a href="https://github.com/fr4nzap/zapthreads">zapthreads</a></small><br />
          <small>
            <ul>
              <For each={Object.values(pool._conn)}>
                {r => <li>{r.url} [{r.status}] {r.status == 1 ? 'connected' : 'disconnected'}<br /></li>}
              </For>
            </ul>
          </small>
          <button onClick={clearCache}>Clear cache</button>
        </div>
        }
      </ZapThreadsContext.Provider>
    </div></>;
};

export default ZapThreads;

customElement<ZapThreadsAttributes>('zap-threads', {
  anchor: "",
  staticId: "",
  relays: "",
  npub: "",
  disable: "",
  'url-prefixes': "",
}, (props) => {
  return <ZapThreads
    anchor={props.anchor ?? ''}
    staticId={props.staticId ?? ''}
    relays={props.relays ?? ''}
    npub={props.npub ?? ''}
    disable={props.disable ?? ''}
    urlPrefixes={props['url-prefixes'] ?? ''}
  />;
});

export type ZapThreadsAttributes = {
  [key in 'anchor' | 'static-id' | 'relays' | 'npub' | 'disable' | 'url-prefixes']?: string;
} & JSX.HTMLAttributes<HTMLElement>;

import { createEffect, createMemo, onCleanup } from "solid-js";
import { createScheduled, debounce } from "@solid-primitives/scheduled";
import { customElement } from 'solid-element';
import style from './styles/index.css?raw';
import { encodedEntityToFilter, parseUrlPrefixes, updateMetadata } from "./util/ui";
import { StoredEventWithId, nest } from "./util/nest";
import { EventsStore, PreferencesStore, SignersStore, StoredEvent, ZapThreadsContext, pool } from "./util/stores";
import { Thread } from "./thread";
import { RootComment } from "./reply";
import { createMutable, createStore, produce, unwrap } from "solid-js/store";
import { makePersisted } from "@solid-primitives/storage";

const ZapThreads = (props: ZapThreadsProps) => {
  if (!['http', 'naddr', 'note', 'nevent'].some(e => props.anchor.startsWith(e))) {
    throw "Only NIP-19 naddr, note and nevent encoded entities and URLs are supported";
  }

  const pubkey = () => props.pubkey;
  const anchor = () => props.anchor;
  const relays = () => props.relays.length > 0 ? props.relays : ["wss://relay.damus.io"];
  const closeOnEose = () => props.closeOnEose;

  const _eventsStore = createStore<EventsStore>({
    1: {},
    7: {},
    9735: {},
    version: 1
  });
  const [eventsStore, setEventsStore] = makePersisted(_eventsStore, { name: anchor() });
  const signersStore = createMutable<SignersStore>({});
  const preferencesStore = createMutable<PreferencesStore>({
    disableLikes: props.disableLikes || false,
    disableZaps: props.disableZaps || false,
    disablePublish: props.disablePublish || false,
    urlPrefixes: parseUrlPrefixes(props.urlPrefixes),
  });

  const events = () => Object.values(unwrap(eventsStore)[1]);

  createEffect(async () => {
    if (props.anchor.startsWith('http')) {
      const eventsForUrl = await pool.list(relays(), [
        {
          '#r': [props.anchor],
          kinds: [1]
        }
      ]);
      const eventIdsForUrl = eventsForUrl.map((e) => e.id);
      preferencesStore.filter = { "#e": eventIdsForUrl };
    } else {
      preferencesStore.filter = encodedEntityToFilter(props.anchor);
    }
  });

  createEffect(async () => {
    const kinds = [1];
    if (preferencesStore.disableLikes === false) {
      kinds.push(7);
    }
    if (preferencesStore.disableZaps === false) {
      kinds.push(9735);
    }

    if (!preferencesStore.filter) {
      return;
    }

    try {
      // All events have a created_at timestamp, find the latest to query since that time
      const createdAts = events().map(e => e.created_at);
      const since = createdAts.length > 0 ? Math.max(...createdAts) + 1 : undefined;

      const sub = pool.sub(relays(), [{ ...preferencesStore.filter, kinds, since: since }]);

      sub.on('event', e => {
        // TODO verify signature
        const storedEvent: StoredEvent = {
          content: e.content,
          created_at: e.created_at,
          pubkey: e.pubkey,
          tags: e.tags
        };
        if (e.kind === 1 || e.kind === 7 || e.kind === 9735) {
          const kind: keyof EventsStore = e.kind;
          setEventsStore(produce(s => s[kind][e.id] = storedEvent));
        }
      });

      sub.on('eose', () => {
        if (closeOnEose()) {
          sub?.unsub();
        }
      });

      onCleanup(() => {
        sub?.unsub();
      });
    } catch (e) {
      // TODO properly handle error
      console.log(e);
    }
  });

  const scheduledDebounce = createScheduled(fn => debounce(fn, 16));
  const debouncedEvents = createMemo((e: StoredEventWithId[] = []) => {
    if (scheduledDebounce() && Object.values(eventsStore[1]).length > 0) {
      const events = unwrap(eventsStore)[1];
      return Object.keys(events).map(k => ({ id: k, ...events[k] }));
    }
    return e;
  });
  const nestedEvents = () => nest(debouncedEvents());

  const profilesDebounce = createScheduled(fn => debounce(fn, 700));

  // Get all author pubkeys from known events when event loading has somewhat settled
  createEffect(async () => {
    if (profilesDebounce() && Object.keys(eventsStore).length > 0) {
      const authorPubkeys = events().map(e => e.pubkey);
      const result = await pool.list(relays(), [{
        kinds: [0],
        authors: [...new Set(authorPubkeys)] // Set makes pubkeys unique
      }]);
      updateMetadata(result);
    }
  });

  const commentsLength = () => debouncedEvents().length;

  return <div id="ztr-root">
    <style>{style}</style>
    <ZapThreadsContext.Provider value={{ relays, anchor, pubkey, eventsStore, setEventsStore, signersStore, preferencesStore }}>
      <RootComment />
      <h2 id="ztr-title">
        {commentsLength() > 0 && `${commentsLength()} comment${commentsLength() == 1 ? '' : 's'}`}
      </h2>
      {/* <Show when={!preferencesStore.disableZaps}>
        <h3 id="ztr-subtitle">Z sats</h3>
      </Show> */}
      <Thread nestedEvents={nestedEvents} />
    </ZapThreadsContext.Provider>
  </div>;
};

export default ZapThreads;

type ZapThreadsProps = {
  anchor: string,
  pubkey: string,
  relays: string[];
  closeOnEose: boolean;
  disableLikes?: boolean,
  disableZaps?: boolean,
  disablePublish?: boolean,
  urlPrefixes?: string,
};

customElement('zap-threads', {
  relays: "",
  anchor: "",
  'disable-likes': "",
  'disable-zaps': "",
  'disable-publish': "",
  'pubkey': "",
  'close-on-eose': "",
  'url-prefixes': ""
}, (props) => {
  const relays = props.relays === "" ? [] : props.relays.split(",");
  return <ZapThreads
    anchor={props.anchor}
    pubkey={props.pubkey}
    relays={relays}
    closeOnEose={!!props['close-on-eose']}
    disableLikes={!!props['disable-likes']}
    disableZaps={!!props['disable-zaps']}
    disablePublish={!!props['disable-publish']}
    urlPrefixes={props['url-prefixes']}
  />;
});
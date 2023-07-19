import { Show, createEffect, createMemo, onCleanup, onMount } from "solid-js";
import { createScheduled, debounce } from "@solid-primitives/scheduled";
import { customElement } from 'solid-element';
import style from './styles/index.css?raw';
import { encodedEntityToFilter, parseUrlPrefixes, updateMetadata } from "./util/ui";
import { nest } from "./util/nest";
import { EventsStore, PreferencesStore, SignersStore, ZapThreadsContext, pool } from "./util/stores";
import { Thread } from "./thread";
import { RootComment } from "./reply";
import { Event } from "./nostr-tools/event";
import { createMutable } from "solid-js/store";

const ZapThreads = (props: ZapThreadsProps) => {
  if (!['http', 'naddr', 'note', 'nevent'].some(e => props.anchor.startsWith(e))) {
    throw "Only NIP-19 naddr, note and nevent encoded entities and URLs are supported";
  }

  const pubkey = () => props.pubkey;
  const anchor = () => props.anchor;
  const relays = () => props.relays.length > 0 ? props.relays : ["wss://relay.damus.io"];
  const closeOnEose = () => props.closeOnEose;

  const eventsStore = createMutable<EventsStore>({});
  const signersStore = createMutable<SignersStore>({});
  const preferencesStore = createMutable<PreferencesStore>({
    disableLikes: props.disableLikes || false,
    disableZaps: props.disableZaps || false,
    disablePublish: props.disablePublish || false,
    urlPrefixes: parseUrlPrefixes(props.urlPrefixes),
  });

  onMount(async () => {
    try {
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

      const sub = pool.sub(relays(), [{ ...preferencesStore.filter, kinds: [1] }]);

      sub.on('event', e => {
        if (e.content) {
          eventsStore[e.id] = e;
        }
      });

      sub.on('eose', () => {
        if (closeOnEose()) {
          sub?.unsub();
        }
      });

      onCleanup(() => {
        return sub?.unsub();
      });
    } catch (e) {
      // TODO properly handle error
      console.log(e);
    }
  });

  const scheduledDebounce = createScheduled(fn => debounce(fn, 16));
  const debouncedEvents = createMemo((e: Event<1>[] = []) => {
    if (scheduledDebounce() && Object.keys(eventsStore).length > 0) {
      return Object.values(eventsStore);
    }
    return e;
  });
  const nestedEvents = () => nest(debouncedEvents());

  const profilesDebounce = createScheduled(fn => debounce(fn, 700));

  // Get all author pubkeys from known events when event loading has somewhat settled
  createEffect(async () => {
    if (profilesDebounce() && Object.keys(eventsStore).length > 0) {
      const authorPubkeys = Object.values(eventsStore).map(e => e.pubkey);
      const result = await pool.list(relays(), [{
        kinds: [0],
        authors: [...new Set(authorPubkeys)] // Set makes pubkeys unique
      }]);
      updateMetadata(result);
    }
  });

  const commentsLength = () => Object.keys(eventsStore).length;

  return <div id="ztr-root">
    <style>{style}</style>
    <ZapThreadsContext.Provider value={{ relays, anchor, pubkey, eventsStore, signersStore, preferencesStore }}>
      <RootComment />
      <h2 id="ztr-title">
        {commentsLength() > 0 && `${commentsLength()} comment${commentsLength() == 1 ? '' : 's'}`}
      </h2>
      <Show when={!preferencesStore.disableZaps}>
        <h3 id="ztr-subtitle">2397 sats</h3>
      </Show>
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
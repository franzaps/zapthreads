import { Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { createScheduled, debounce } from "@solid-primitives/scheduled";
import { customElement } from 'solid-element';
import style from './styles/index.css?raw';
import { encodedEntityToFilter, updateMetadata } from "./util/ui";
import { nest } from "./util/nest";
import { ZapThreadsContext, pool } from "./util/stores";
import { Thread } from "./thread";
import { RootComment } from "./reply";
import { Filter } from "./nostr-tools/filter";
import { Event } from "./nostr-tools/event";
import { createMutable } from "solid-js/store";

export default function ZapThreads(props: ZapThreadsProps) {
  if (!['http', 'naddr', 'note', 'nevent'].some(e => props.anchor.startsWith(e))) {
    throw "Only NIP-19 naddr, note and nevent encoded entities and URLs are supported";
  }

  const eventsStore = createMutable<{ [key: string]: Event<1>; }>({});
  const preferencesStore = createMutable<{ [key: string]: any; }>({});

  // Store preferences
  preferencesStore.disableLikes = props.disableLikes || false;
  preferencesStore.disableZaps = props.disableZaps || false;
  preferencesStore.disablePublish = props.disablePublish || false;

  const [filter, setFilter] = createSignal<Filter>();
  const pubkey = () => props.pubkey;
  const relays = () => props.relays.length > 0 ? props.relays : ["wss://relay.damus.io", "wss://eden.nostr.land"];
  const closeOnEose = () => props.closeOnEose;

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
        setFilter({ "#e": eventIdsForUrl });
      } else {
        setFilter(encodedEntityToFilter(props.anchor));
      }

      const sub = pool.sub(relays(), [{ ...filter(), kinds: [1] }]);

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
    <ZapThreadsContext.Provider value={{ relays, filter, pubkey, eventsStore, preferencesStore }}>
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

type ZapThreadsProps = {
  anchor: string,
  relays: string[];
  disableLikes?: boolean,
  disableZaps?: boolean,
  disablePublish?: boolean,
  pubkey: string,
  closeOnEose: boolean;
};

customElement('zap-threads', {
  relays: "",
  anchor: "",
  'disable-likes': "",
  'disable-zaps': "",
  'disable-publish': "",
  'pubkey': "",
  'close-on-eose': "",
}, (props) => {
  const relays = props.relays === "" ? [] : props.relays.split(",");
  return <ZapThreads
    anchor={props.anchor}
    relays={relays}
    pubkey={props.pubkey}
    disableLikes={props['disable-likes'] === "true"}
    disableZaps={props['disable-zaps'] === "true"}
    disablePublish={props['disable-publish'] === "true"}
    closeOnEose={props['close-on-eose'] === "true"}
  />;
});
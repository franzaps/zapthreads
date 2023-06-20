import { Accessor, Show, createContext, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import NDK, { NDKEvent, NDKSigner, NDKSubscription, NDKFilter, filterFromId } from "@nostr-dev-kit/ndk";
import { createScheduled, debounce } from "@solid-primitives/scheduled";
import { nest } from "@nostr-dev-kit/ndk";
import { Thread } from "./Thread";
import { createMutable } from "solid-js/store";
import { RootComment } from "./RootComment";
import { customElement } from 'solid-element';
import style from './styles/index.css?raw';

export const usersStore = createMutable<{ [key: string]: { timestamp: number, npub?: string, name?: string, imgUrl?: string; }; }>({});
export const eventsStore = createMutable<{ [key: string]: NDKEvent; }>({});
export const signersStore = createMutable<{ [key: string]: NDKSigner; }>({});
export const preferencesStore = createMutable<{ [key: string]: any; }>({});

const ZapThreads = (props: { anchor: string, relays: string[]; disableLikes?: boolean, disableZaps?: boolean; }) => {
  if (!props.anchor.startsWith('naddr') && !props.anchor.startsWith('http')) {
    throw "Only NIP-19 naddr and URLs are supported";
  }

  // Store preferences
  preferencesStore.disableLikes = props.disableLikes || false;
  preferencesStore.disableZaps = props.disableZaps || false;
  const relays = props.relays.length > 0 ? props.relays : ["wss://relay.damus.io", "wss://eden.nostr.land"];

  const [filter, setFilter] = createSignal<NDKFilter>();

  const ndk = new NDK({ explicitRelayUrls: relays });
  let sub: NDKSubscription;

  onMount(async () => {
    try {
      await ndk.connect();

      if (props.anchor.startsWith('http')) {
        const eventsForUrl = await ndk.fetchEvents({
          kinds: [1],
          '#r': [props.anchor]
        });
        const eventIdsForUrl = [...eventsForUrl].map((e) => e.id);
        setFilter({ "#e": eventIdsForUrl });
      } else { // naddr
        const id = filterToReplaceableId(filterFromId(props.anchor));
        setFilter({ "#a": [id] });
      }

      sub = ndk.subscribe({ ...filter(), kinds: [1] });
      sub.addListener('event', (e: NDKEvent) => {
        if (e.content) {
          eventsStore[e.id] = e;
        }
      });
      sub.on('error', () => 'error');
    } catch (e) {
      // TODO properly handle error
      console.log(e);
    }
  });

  onCleanup(() => {
    sub?.stop();
  });

  const scheduledDebounce = createScheduled(fn => debounce(fn, 16));
  const debouncedEvents = createMemo((e: NDKEvent[] = []) => {
    if (scheduledDebounce() && Object.keys(eventsStore).length > 0) {
      return Object.values(eventsStore);
    }
    return e;
  });
  const nestedEvents = () => nest(debouncedEvents());

  const profilesDebounce = createScheduled(fn => debounce(fn, 1200));

  // Get all author pubkeys from known events when event loading has somewhat settled
  createEffect(async () => {
    if (profilesDebounce() && Object.keys(eventsStore).length > 0) {
      const authorPubkeys = Object.values(eventsStore).map(e => e.author.hexpubkey());

      const result = await ndk.fetchEvents({
        kinds: [0],
        authors: [...new Set(authorPubkeys)] // make pubkeys unique
      });

      // For each metadata event, check if it was created later
      // and merge interesting properties into usersStore entry
      [...result].forEach(e => {
        const payload = JSON.parse(e.content);
        if (usersStore[e.pubkey].timestamp < e.created_at!) {
          usersStore[e.pubkey] = {
            ...usersStore[e.pubkey],
            timestamp: e.created_at!,
            imgUrl: payload.image || payload.picture,
            name: payload.displayName || payload.display_name || payload.name,
          };
        }
      });
    }
  });

  return <div id="ctr-root">
    <style>{style}</style>
    <ZapThreadsContext.Provider value={{ ndk, filter }}>
      <RootComment />
      <h2 id="ctr-title">{Object.keys(eventsStore).length} comments</h2>
      <Show when={!preferencesStore.disableZaps}>
        <h3 id="ctr-subtitle">2397 sats</h3>
      </Show>
      <Thread nestedEvents={nestedEvents} />
    </ZapThreadsContext.Provider>
  </div>;
};

export default ZapThreads;

export const ZapThreadsContext = createContext<{
  ndk: NDK,
  filter: Accessor<NDKFilter | undefined>;
}>();

const filterToReplaceableId = (filter: NDKFilter): string => {
  return `${filter.kinds![0]}:${filter.authors![0]}:${filter['#d']}`;
};

customElement('zap-threads', { relays: "", anchor: "", 'disable-likes': "", 'disable-zaps': "" }, (props) => {
  const relays = props.relays === "" ? [] : props.relays.split(",");

  return <ZapThreads
    anchor={props.anchor}
    relays={relays}
    disableLikes={props['disable-likes'] === "true"}
    disableZaps={props['disable-zaps'] === "true"}
  />;
});
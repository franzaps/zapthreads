import { Accessor, createContext, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import NDK, { NDKNip07Signer, NDKEvent, NDKPrivateKeySigner, NDKSigner, NDKSubscription, NDKFilter, filterFromId } from "@nostr-dev-kit/ndk";
import { createScheduled, debounce } from "@solid-primitives/scheduled";
import { nest } from "@nostr-dev-kit/ndk";
import { Thread } from "./Thread";
import { createMutable } from "solid-js/store";
import { RootComment } from "./RootComment";
import { customElement } from 'solid-element';
import style from './styles/index.css?raw';

export const usersStore = createMutable<{ [key: string]: { timestamp: number, npub?: string, name?: string, imgUrl?: string; }; }>({});
export const eventsStore = createMutable<{ [key: string]: NDKEvent; }>({});

const ZapThreads = (props: { anchor: string, relays: string[]; }) => {
  if (!props.anchor.startsWith('naddr') && !props.anchor.startsWith('http')) {
    throw "Only NIP-19 naddr and URLs are supported";
  }

  const [filter, setFilter] = createSignal<NDKFilter>();

  const ndk = new NDK({
    explicitRelayUrls: props.relays
  });

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
      sub.on('eose', () => console.log('EOSE'));
    } catch (e) {
      // TODO properly handle error
      console.log(e);
    }
  });

  onCleanup(() => {
    sub?.stop();
  });

  const anonymousSigner = NDKPrivateKeySigner.generate();
  const loggedInSigner = new NDKNip07Signer();

  const scheduledDebounce = createScheduled(fn => debounce(fn, 16));
  const debouncedEvents = createMemo((e: NDKEvent[] = []) => {
    if (scheduledDebounce() && Object.keys(eventsStore).length > 0) {
      return Object.values(eventsStore);
    }
    return e;
  });
  const nestedEvents = () => nest(debouncedEvents());

  const doubleDebounce = createScheduled(fn => debounce(fn, 1600));

  createEffect(async () => {
    if (doubleDebounce() && Object.keys(eventsStore).length > 0) {
      const authorPubkeys = Object.values(eventsStore).map(e => e.author.hexpubkey());
      const sAuthors = new Set(authorPubkeys);

      const result = await ndk.fetchEvents({
        kinds: [0],
        authors: [...sAuthors]
      });

      [...result].forEach(r => {
        const payload = JSON.parse(r.content);
        if (usersStore[r.pubkey].timestamp < r.created_at!) {
          usersStore[r.pubkey] = {
            ...usersStore[r.pubkey],
            timestamp: r.created_at!,
            imgUrl: payload.image || payload.picture,
            name: payload.displayName || payload.display_name || payload.name,
          };
        }
      });
    }
  });

  return <div id="ctr-root">
    <ZapThreadsContext.Provider value={{ ndk, filter, anonymousSigner, loggedInSigner }}>
      <RootComment />
      <h2 id="ctr-title">{Object.keys(eventsStore).length} comments</h2>
      <h3 id="ctr-subtitle">2397 sats</h3>
      <Thread nestedEvents={nestedEvents} />
    </ZapThreadsContext.Provider>
  </div>;
};

export default ZapThreads;

export const ZapThreadsContext = createContext<{
  ndk: NDK,
  filter: Accessor<NDKFilter | undefined>;
  anonymousSigner: NDKSigner,
  loggedInSigner: NDKSigner;
}>();

const filterToReplaceableId = (filter: NDKFilter): string => {
  return `${filter.kinds![0]}:${filter.authors![0]}:${filter['#d']}`;
};

customElement('zap-threads', { relays: "", anchor: "" }, (props) => {
  const relays = props.relays.split(",");
  return <>
    <style>{style}</style>
    <ZapThreads relays={relays} anchor={props.anchor} />
  </>;
});
import { Accessor, Signal, createContext, createSignal } from "solid-js";
import { SetStoreFunction, createStore } from "solid-js/store";
import { UnsignedEvent, Event } from "../nostr-tools/event";
import { SimplePool } from "../nostr-tools/pool";
import { Filter } from "../nostr-tools/filter";
import { makePersisted } from "@solid-primitives/storage";

export type EventSigner = (event: UnsignedEvent<1>) => Promise<{ sig: string; }>;
export type User = {
  timestamp: number,
  npub?: string,
  name?: string,
  imgUrl?: string;
  signEvent?: EventSigner;
};

// Global data (for now)
export const [usersStore, setUsersStore] = makePersisted(createStore<{ [key: string]: User; }>({}));
export const pool = new SimplePool();

export const ZapThreadsContext = createContext<{
  relays: Accessor<string[]>,
  anchor: Accessor<string>,
  pubkey: Accessor<string | undefined>;
  eventsStore: EventsStore,
  setEventsStore: SetStoreFunction<EventsStore>,
  signersStore: SignersStore;
  preferencesStore: PreferencesStore;
}>();

export type StoredEvent = {
  tags: string[][];
  content: string;
  created_at: number;
  pubkey: string;
};
export type EventsStore = {
  1: { [id: string]: StoredEvent; };
  7: { [id: string]: StoredEvent; };
  9735: { [id: string]: StoredEvent; };
  title?: string,
  version: number,
};

export type SignersStore = {
  [key in "internal" | "external"]?: string;
};


type PreferenceKeys =
  'disableLikes' |
  'disableZaps' |
  'disablePublish'
  ;

export type UrlPrefixesKeys = 'naddr' | 'nevent' | 'note' | 'npub' | 'nprofile' | 'tag';

export type PreferencesStore = { [key in PreferenceKeys]?: boolean } & {
  urlPrefixes: { [key in UrlPrefixesKeys]?: string },
  filter?: Filter;
};

// helpers

function createStoredSignal<T>(
  key: string,
  defaultValue: T,
  storage = localStorage
): Signal<T> {

  const initialValue = storage.getItem(key)
    ? JSON.parse(storage.getItem(key)!) as T
    : defaultValue;

  const [value, setValue] = createSignal<T>(initialValue);

  const setValueAndStore = ((arg) => {
    const v = setValue(arg);
    storage.setItem(key, JSON.stringify(v));
    return v;
  }) as typeof setValue;

  return [value, setValueAndStore];
}
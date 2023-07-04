import { Accessor, createContext } from "solid-js";
import { createMutable } from "solid-js/store";
import { UnsignedEvent, Event } from "../nostr-tools/event";
import { SimplePool } from "../nostr-tools/pool";
import { Filter } from "../nostr-tools/filter";

export type EventSigner = (event: UnsignedEvent<1>) => Promise<{ sig: string; }>;
export type User = {
  timestamp: number,
  npub?: string,
  name?: string,
  imgUrl?: string;
  signEvent?: EventSigner;
};

// Global data (for now)
export const usersStore = createMutable<{ [key: string]: User; }>({});
export const pool = new SimplePool();

export const ZapThreadsContext = createContext<{
  relays: Accessor<string[]>,
  filter: Accessor<Filter | undefined>;
  pubkey: Accessor<string | undefined>;
  eventsStore: EventsStore;
  signersStore: SignersStore;
  preferencesStore: PreferencesStore;
}>();

export type EventsStore = { [key: string]: Event<1>; };

export type SignersStore = {
  [key in "internal" | "external"]?: string;
};

export type PreferencesStore = { [key in 'disableLikes' | 'disableZaps' | 'disablePublish']?: any; };

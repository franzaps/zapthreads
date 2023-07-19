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
  anchor: Accessor<string>,
  pubkey: Accessor<string | undefined>;
  eventsStore: EventsStore;
  signersStore: SignersStore;
  preferencesStore: PreferencesStore;
}>();

export type EventsStore = { [key: string]: Event<1>; };

export type SignersStore = {
  [key in "internal" | "external"]?: string;
};


type PreferenceKeys =
  'disableLikes' |
  'disableZaps' |
  'disablePublish'
  ;

export type UrlPrefixesKeys = 'naddr' | 'nevent' | 'note' | 'npub' | 'nprofile' | 'tag';

export type PreferencesStore = { [key in PreferenceKeys]?: boolean } &
{ urlPrefixes: { [key in UrlPrefixesKeys]?: string }; } &
{ filter?: Filter; };

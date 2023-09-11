import { Accessor, createContext } from "solid-js";
import { UnsignedEvent } from "../nostr-tools/event";
import { SimplePool } from "../nostr-tools/pool";
import { Filter } from "../nostr-tools/filter";

// Global data (for now)
export const pool = new SimplePool();

export const ZapThreadsContext = createContext<{
  relays: Accessor<string[]>,
  anchor: Accessor<string>,
  pubkey: Accessor<string | undefined>;
  profiles: Accessor<StoredProfile[]>;
  signersStore: SignersStore;
  preferencesStore: PreferencesStore;
}>();

export type BaseEvent = {
  id: string;
  kind: 1 | 7 | 9735;
  created_at: number;
  pubkey: string;
};

export type NoteEvent = BaseEvent & {
  kind: 1;
  content: string;
  tags: string[][];
};

export type LikeEvent = BaseEvent & {
  kind: 7;
};

export type ZapEvent = BaseEvent & {
  kind: 9735;
  amount: number;
};

export type StoredEvent = (NoteEvent | LikeEvent | ZapEvent) & { anchor: string; };

export type StoredProfile = {
  pubkey: string,
  created_at: number,
  lastChecked: number,
  npub?: string,
  name?: string,
  imgUrl?: string;
};

export type StoredRelay = {
  url: string;
  anchor: string;
  latest: number;
};

// Signing

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent: SignEvent;
    };
  }
}

export type SignersStore = {
  [key in "active" | "anonymous" | "internal" | "external"]?: EventSigner;
};
export type SignEvent = (event: UnsignedEvent<1>) => Promise<{ sig: string; }>;
export type EventSigner = {
  pk: string,
  signEvent?: SignEvent;
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
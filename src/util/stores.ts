import { Accessor, createContext } from "solid-js";
import { UnsignedEvent } from "../nostr-tools/event";
import { SimplePool } from "../nostr-tools/pool";
import { Filter } from "../nostr-tools/filter";

// Global data (for now)
export const pool = new SimplePool();

export const ZapThreadsContext = createContext<{
  relays: Accessor<string[]>,
  anchor: Accessor<string>,
  anchorPubkey: Accessor<string | undefined>;
  profiles: Accessor<StoredProfile[]>;
  signersStore: SignersStore;
  preferencesStore: PreferencesStore;
}>();

export type NoteEvent = {
  id: string;
  kind: 1;
  content: string;
  tags: string[][];
  created_at: number;
  pubkey: string;
};

export type AggregateEvent = {
  eventId: string;
  sum: number;
  sourceIds: string[];
  kind: 7 | 9735;
};

export type LikesEvent = AggregateEvent & {
  kind: 7;
};

export type ZapsEvent = AggregateEvent & {
  kind: 9735;
};

export type StoredEvent = NoteEvent & { anchor: string; };

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
  [key in 'active' | 'anonymous' | 'internal' | 'external']?: EventSigner;
};
export type SignEvent = (event: UnsignedEvent<1>) => Promise<{ sig: string; }>;
export type EventSigner = {
  pk: string,
  signEvent?: SignEvent;
};

export type UrlPrefixesKeys = 'naddr' | 'nevent' | 'note' | 'npub' | 'nprofile' | 'tag';

const _types = ['likes', 'zaps', 'publish', 'watch', 'replyAnonymously', 'hideContent'] as const;
type DisableType = typeof _types[number];
export const isDisableType = (type: string): type is DisableType => {
  return _types.includes(type as DisableType);
};

export type PreferencesStore = {
  disable: () => DisableType[],
  urlPrefixes: { [key in UrlPrefixesKeys]?: string },
  filter?: Filter;
};
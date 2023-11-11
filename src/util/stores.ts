import { Accessor, createContext } from "solid-js";
import { UnsignedEvent } from "../nostr-tools/event";
import { SimplePool } from "../nostr-tools/pool";
import { Filter } from "../nostr-tools/filter";
import { Profile } from "./models";

// Global data (for now)
export const pool = new SimplePool();

// Signing

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
  filter: Filter;
  version?: string;
};

export type Anchor = { type: 'http' | 'naddr' | 'note', value: string; };

// Globals

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent: SignEvent;
    };
  }
}

export const ZapThreadsContext = createContext<{
  relays: Accessor<string[]>,
  anchor: Accessor<Anchor>,
  profiles: Accessor<Profile[]>;
  signersStore: SignersStore;
  preferencesStore: PreferencesStore;
}>();
import { Accessor, createContext } from "solid-js";
import { UnsignedEvent } from "nostr-tools/event";
import { SimplePool } from "nostr-tools/pool";
import { Filter } from "nostr-tools/filter";
import { Profile } from "./models";
import { createMutable } from "solid-js/store";

// Global data (for now)
export const pool = new SimplePool();

export const store = createMutable<PreferencesStore>({
  rootEventIds: [],
  filter: {},
  profiles: () => [],
});

export const signersStore = createMutable<SignersStore>({});

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

const _types = ['replies', 'likes', 'zaps', 'publish', 'watch', 'replyAnonymously', 'hideContent'] as const;
type DisableType = typeof _types[number];
export const isDisableType = (type: string): type is DisableType => {
  return _types.includes(type as DisableType);
};

export type PreferencesStore = {
  disable?: DisableType[],
  urlPrefixes?: { [key in UrlPrefixesKeys]?: string },
  filter: Filter;
  version?: string;
  anchorAuthor?: string;
  rootEventIds: string[];

  relays?: string[],
  anchor?: Anchor,
  profiles: () => Profile[];
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
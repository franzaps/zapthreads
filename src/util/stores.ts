import { UnsignedEvent } from "nostr-tools/pure";
import { SimplePool } from "nostr-tools/pool";
import { Filter } from "nostr-tools/filter";
import { Profile } from "./models.ts";
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
export type SignEvent = (event: UnsignedEvent) => Promise<{ sig: string; }>;
export type EventSigner = {
  pk: string,
  signEvent?: SignEvent;
};

export type UrlPrefixesKeys = 'naddr' | 'nevent' | 'note' | 'npub' | 'nprofile' | 'tag';

const _types = ['reply', 'likes', 'votes', 'zaps', 'publish', 'watch', 'replyAnonymously', 'hideContent'] as const;
type DisableType = typeof _types[number];
export const isDisableType = (type: string): type is DisableType => {
  return _types.includes(type as DisableType);
};

export type PreferencesStore = {
  anchor?: Anchor, // derived from anchor prop
  relays?: string[]; // prop
  version?: string;  // derived from version prop
  rootEventIds: string[];  // derived from anchor prop
  filter: Filter;  // derived from anchor prop
  externalAuthor?: string; // prop, mostly used with http anchor type
  disableFeatures?: DisableType[]; // prop
  urlPrefixes?: { [key in UrlPrefixesKeys]?: string }, // prop
  replyPlaceholder?: string,

  anchorAuthor?: string;
  profiles: () => Profile[];
};

export type Anchor = { type: 'http' | 'naddr' | 'note' | 'error', value: string; };

// Globals

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent: SignEvent;
    };
  }
}

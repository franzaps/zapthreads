import { Accessor, createContext } from "solid-js";
import { createStore } from "solid-js/store";
import { UnsignedEvent } from "../nostr-tools/event";
import { SimplePool } from "../nostr-tools/pool";
import { Filter } from "../nostr-tools/filter";
import Dexie, { Table } from "dexie";

export type EventSigner = (event: UnsignedEvent<1>) => Promise<{ sig: string; }>;
export type User = {
  timestamp: number,
  npub?: string,
  name?: string,
  imgUrl?: string;
  signEvent?: EventSigner;
};

// Global data (for now)
export const [usersStore, setUsersStore] = createStore<{ [key: string]: User; }>();
export const pool = new SimplePool();

export const ZapThreadsContext = createContext<{
  relays: Accessor<string[]>,
  anchor: Accessor<string>,
  pubkey: Accessor<string | undefined>;
  signersStore: SignersStore;
  preferencesStore: PreferencesStore;
}>();

type BaseEvent = {
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

export type StoredRelay = {
  url: string;
  anchor: string;
  latest: number;
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

export class ZTDatabase extends Dexie {
  events!: Table<StoredEvent>;
  relays!: Table<StoredRelay>;

  constructor() {
    super('zapthreads');

    this.version(1).stores({
      events: '&id,anchor,[kind+anchor]',
      relays: '[url+anchor],url,anchor',
      profiles: ''
    });
  }
}
export const db = new ZTDatabase();
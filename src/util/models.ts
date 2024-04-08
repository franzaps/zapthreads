import { DBSchema, IDBPDatabase, StoreNames } from "idb";
import { parse } from "nostr-tools/nip10";
import { UnsignedEvent } from "nostr-tools/pure";

// models

export type NoteEvent = {
  id: string;
  k: 1 | 8812 | 9802 | 30023;
  c: string;
  ts: number;
  pk: string;
  // tags
  ro?: string; // e root
  re?: string; // e reply
  me?: string[]; // e mentions
  p?: string[];
  a?: string; // a tag
  am?: boolean; // was a tag a mention?
  r?: string; // r tag
  t?: string[]; // t tags
  d?: string; // d tag
  tl?: string; // title
};

export type AggregateEvent = {
  eid: string;
  k: 7 | 9735;
  sum?: number; // useful for counting zaps (likes are ids.length)
  ids: string[]; // source ids
};

export type Profile = {
  pk: string,
  ts: number,
  l: number, // last checked
  n?: string,
  i?: string;
};

export type Relay = {
  n: string; // name
  a: string; // anchor
  l: number; // latest result
};

// DB schema

export interface ZapthreadsSchema extends DBSchema {
  events: {
    key: string;
    value: NoteEvent;
    indexes: {
      'a': string;
      'ro': string;
      'r': string;
      'd': string;
      'k': number;
    };
  };
  aggregates: {
    key: string[];
    value: AggregateEvent;
  },
  profiles: {
    key: string;
    value: Profile;
    indexes: {
      'l': number;
    };
  };
  relays: {
    key: string[];
    value: Relay;
    indexes: {
      'a': string;
    };
  };
}

export const indices: { [key in StoreNames<ZapthreadsSchema>]: any } = {
  'events': 'id',
  'aggregates': ['eid', 'k'],
  'profiles': ['pk'],
  'relays': ['n', 'a']
};

export const upgrade = async (db: IDBPDatabase<ZapthreadsSchema>, currentVersion: number) => {
  if (currentVersion <= 1) {
    const names = [...db.objectStoreNames];
    await Promise.all(names.map(n => db.deleteObjectStore(n)));
  }

  const events = db.createObjectStore('events', { keyPath: indices['events'] });
  events.createIndex('a', 'a');
  events.createIndex('ro', 'ro');
  events.createIndex('r', 'r');
  events.createIndex('d', 'd');
  events.createIndex('k', 'k');

  db.createObjectStore('aggregates', { keyPath: indices['aggregates'] });

  const profiles = db.createObjectStore('profiles', { keyPath: indices['profiles'] });
  profiles.createIndex('l', 'l');

  const relays = db.createObjectStore('relays', { keyPath: indices['relays'] });
  relays.createIndex('a', 'a');
};

// util

export const eventToNoteEvent = (e: UnsignedEvent & { id?: string; }): NoteEvent => {
  const nip10result = parse(e);

  const aTag = e.tags.find(t => t[0] === 'a');
  const a = aTag && aTag[1];
  const am = aTag && aTag[3] === 'mention';
  const rTag = e.tags.find(t => t[0] === 'r');
  const r = rTag && rTag[1];
  const tTags = e.tags.filter(t => t[0] === 't');
  const t = [...new Set(tTags.map(t => t[1]))]; // dedup tags
  const dTag = e.tags.find(t => t[0] === 'd');
  const d = dTag && dTag[1];
  const titleTag = e.tags.find(t => t[0] === 'title');
  const tl = titleTag && titleTag[1];

  return {
    id: e.id ?? "",
    k: e.kind as 1 | 9802 | 30023,
    c: e.content,
    ts: e.created_at,
    pk: e.pubkey,
    ro: nip10result.root?.id,
    re: nip10result.reply?.id,
    me: nip10result.mentions.map(m => m.id),
    p: nip10result.profiles.map(p => p.pubkey),
    a,
    am,
    r,
    t,
    d,
    tl,
  };
};
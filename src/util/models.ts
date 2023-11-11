import { DBSchema, IDBPDatabase } from "idb";
import { parse } from "../nostr-tools/nip10";
import { Event } from "../nostr-tools/event";

// models

export type NoteEvent = {
  id: string;
  k: 1 | 9802 | 30023;
  c: string;
  ts: number;
  pk: string;
  // tags
  ro?: string; // e root
  er?: string; // e reply
  em?: string[]; // e mentions
  p?: string[];
  a?: string;
  am?: boolean; // was a mentioned?
  r?: string;
  t?: string[];
  d?: string;
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

export const upgrade = async (db: IDBPDatabase<ZapthreadsSchema>, oldVersion: number, newVersion: number | null) => {
  if (oldVersion == 1) {
    // TODO test this works by going back to older version
    const names = [...db.objectStoreNames];
    await Promise.all(names.map(n => db.clear(n)));
  }

  const events = db.createObjectStore('events', { keyPath: 'id' });
  events.createIndex('a', 'a');
  events.createIndex('ro', 'ro');
  events.createIndex('r', 'r');
  events.createIndex('d', 'd');

  db.createObjectStore('aggregates', { keyPath: ['eid', 'k'] });

  const profiles = db.createObjectStore('profiles', { keyPath: 'pk' });
  profiles.createIndex('l', 'l');

  const relays = db.createObjectStore('relays', { keyPath: ['n', 'a'] });
  relays.createIndex('a', 'a');
};

// util

export const eventToNoteEvent = (e: Event): NoteEvent => {
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

  return {
    id: e.id,
    k: e.kind as 1 | 9802 | 30023,
    c: e.content,
    ts: e.created_at,
    pk: e.pubkey,
    ro: nip10result.root?.id,
    er: nip10result.reply?.id,
    em: nip10result.mentions.map(m => m.id),
    p: nip10result.profiles.map(p => p.pubkey),
    a,
    am,
    r,
    t,
    d,
  };
};
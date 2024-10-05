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

export type NoteId = string;
export type Pk = string;
export type Eid = string;
export type VoteKind = -1 | 0 | 1;
export type ReactionEvent = {
  id: Eid;
  noteId: NoteId;
  content: string;
  pk: Pk;
  ts: number;
  a: string;
};

export const voteKind = (r: ReactionEvent): VoteKind => {
  if (r.content === '-') {
    return -1;
  } else if (r.content.length === 0 || r.content === '+') {
    return 1;
  } else {
    return 0;
  }
}

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
  reactions: {
    key: string;
    value: ReactionEvent;
    indexes: {
      'a': string;
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
  'reactions': 'id',
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

  const reactions = db.createObjectStore('reactions', { keyPath: indices['reactions'] });
  reactions.createIndex('a', 'a');

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

export const eventToReactionEvent = (e: UnsignedEvent & { id?: string; }, anchor: string): ReactionEvent => {
  const nip10result = parse(e);

  // extracting note id we reply to, otherwise root note id
  const eTags = e.tags.filter(t => t.length > 1 && t[0] === 'e');
  const tags = eTags.filter(t => t.length > 2);
  const noteId = tags
    .filter(t => t[3] === 'reply')
    .concat(tags.filter(t => t[3] === 'root'))
    .map(t => t[1])
    .concat(eTags.length > 0 && eTags[0].length > 1 && [eTags[0][1]] || [])[0];

  return {
    id: e.id ?? '',
    noteId,
    pk: e.pubkey,
    content: e.content,
    ts: e.created_at,
    a: anchor,
  };
}

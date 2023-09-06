import { DBSchema, IDBPDatabase, StoreNames, openDB } from "idb";
import { InitializedResource, Signal, createMemo, createResource, on } from "solid-js";
import { StoredEvent, StoredProfile, StoredRelay } from "./stores";
import batchedFunction from "./batched-function";
import { createMutable, createStore, reconcile, unwrap } from "solid-js/store";

// Events

const sigStore = createMutable<{ [key: string]: number; }>({});

type S = StoreNames<ZapthreadsSchema>;

export const watchAll = <Name extends S, Value extends ZapthreadsSchema[Name]["value"], IndexName extends keyof ZapthreadsSchema[Name]["indexes"]>(query: () => [Name] | [Name, IndexName, ZapthreadsSchema[Name]["indexes"][IndexName]]) => {
  const get = createMemo(on(query, () => {
    const [type, index, value] = query();

    const fetchData = async (source: number) => {
      console.log('fetching', type);
      const _db = await db();
      if (index && value) {
        return await _db.getAllFromIndex(type, index, value) ?? [];
      }
      return _db.getAll(type);
    };

    const [resource, { mutate }] = createResource(() => sigStore[type], fetchData, {
      initialValue: [],
      storage: createDeepSignal
    });
    findAll(type, index, value).then(mutate);

    return resource as InitializedResource<Value[]>;
  }));
  return () => get()();
};

export const findAll = async <Name extends S, IndexName extends keyof ZapthreadsSchema[Name]["indexes"]>(type: Name, index?: IndexName, query?: ZapthreadsSchema[Name]["indexes"][IndexName]) => {
  const _db = await db();
  if (index && query) {
    return _db.getAllFromIndex(type, index, query);
  }
  return _db.getAll(type);
};

export const find = async <Name extends S>(type: Name, id: string) => {
  const _db = await db();
  return _db.get(type, id);
};

const batchFns: { [key: string]: Function; } = {};

export const save = async <Name extends S, R extends ZapthreadsSchema[Name]['value']>(type: Name, model: R) => {
  const _db = await db();
  batchFns[type] ||= batchedFunction(async (models: R[]) => {
    const tx = _db.transaction(type, 'readwrite');
    const result = await Promise.all([...models.map(e => tx.store.put(e)), tx.done]);
    if (result) {
      console.log('signaling', type);
      sigStore[type] = +new Date;
    }
  }, { delay: 96 });
  batchFns[type](model);
};

// idb

interface ZapthreadsSchema extends DBSchema {
  events: {
    key: string,
    value: StoredEvent,
    indexes: { 'anchor': string, 'kind+anchor': [StoredEvent['kind'], string]; };
  };
  relays: {
    key: string[],
    value: StoredRelay,
    indexes: { 'url': string, 'anchor': string; };
  };
  profiles: {
    key: string,
    value: StoredProfile;
    indexes: { 'pubkey': string; };
  };
}

let _db: IDBPDatabase<ZapthreadsSchema>;

const db = async () => _db ||= await
  openDB<ZapthreadsSchema>('zapthreads', 1, {
    upgrade(db) {
      const events = db.createObjectStore('events', { keyPath: 'id' });
      events.createIndex('anchor', 'anchor');
      events.createIndex('kind+anchor', ['kind', 'anchor']);

      const relays = db.createObjectStore('relays', {
        keyPath: ['url', 'anchor'],
      });
      relays.createIndex('url', 'url');
      relays.createIndex('anchor', 'anchor');

      const profiles = db.createObjectStore('profiles', { keyPath: 'pubkey' });
      profiles.createIndex('pubkey', 'pubkey');
    },
  });

// util

function createDeepSignal<T>(value: T): Signal<T> {
  const [store, setStore] = createStore({
    value,
  });
  return [
    () => store.value,
    (v: T) => {
      const unwrapped = unwrap(store.value);
      typeof v === "function" && (v = v(unwrapped));
      setStore("value", reconcile(v));
      return store.value;
    },
  ] as Signal<T>;
}


// export const _ = async <Name extends S, IndexName extends IndexNames<ZapthreadsSchema, Name>>(storeName: Name, indexName: IndexName, query?: IndexKey<ZapthreadsSchema, Name, IndexName>): Promise<StoreValue<ZapthreadsSchema, Name>[]> => {
//   console.log('in _');

//   return db.getAllFromIndex(storeName, indexName, query);
// };

// export const watchAll = <Name extends S, Value extends ZapthreadsSchema[Name]["value"]>(fetcher: () => Promise<Value[]>) => {
//   const get = createMemo(on([fetcher], () => {
//     console.log('new watchall');
//     const [resource] = createResource(fetcher, { initialValue: [] });
//     return resource as InitializedResource<Value[]>;
//   }));
//   return () => get()();
// };
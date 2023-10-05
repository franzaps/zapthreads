import { DBSchema, IDBPDatabase, StoreNames, openDB } from "idb";
import { InitializedResource, Signal, createMemo, createResource, on } from "solid-js";
import { AggregateEvent, StoredEvent, StoredProfile, StoredRelay } from "./stores";
import batchedFunction from "./batched-function";
import { createMutable, createStore, reconcile, unwrap } from "solid-js/store";

// Events

const sigStore = createMutable<{ [key: string]: number; }>({});

type S = StoreNames<ZapthreadsSchema>;

export const watchAll = <Name extends S, Value extends ZapthreadsSchema[Name]["value"], IndexName extends keyof ZapthreadsSchema[Name]["indexes"]>(query: () => [Name] | [Name, IndexName, ZapthreadsSchema[Name]["indexes"][IndexName]]) => {
  const get = createMemo(on(query, () => {
    const [type, index, value] = query();

    const fetchData = async () => {
      // console.log('fetching', type);
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
    // trigger initial value
    findAll(type, index, value).then(mutate);

    return resource as InitializedResource<Value[]>;
  }));
  return () => get()();
};

export const findAll = async <Name extends S, IndexName extends keyof ZapthreadsSchema[Name]["indexes"]>(type: Name, index?: IndexName, query?: ZapthreadsSchema[Name]["indexes"][IndexName] | IDBKeyRange) => {
  const _db = await db();
  if (index && query) {
    return _db.getAllFromIndex(type, index, query);
  }
  return _db.getAll(type);
};

export const findAllKeys = async <Name extends S, IndexName extends keyof ZapthreadsSchema[Name]["indexes"]>(type: Name, index?: IndexName, query?: ZapthreadsSchema[Name]["indexes"][IndexName] | IDBKeyRange) => {
  const _db = await db();
  if (index && query) {
    return _db.getAllKeysFromIndex(type, index, query);
  }
  return _db.getAllKeys(type);
};

export const find = async <Name extends S, IndexName extends keyof ZapthreadsSchema[Name]["indexes"]>(type: Name, query: ZapthreadsSchema[Name]["indexes"][IndexName] | IDBKeyRange) => {
  const _db = await db();
  return _db.get(type, query);
};

const batchFns: { [key: string]: Function; } = {};

export const save = async <Name extends S, R extends ZapthreadsSchema[Name]['value']>(type: Name, model: R, options: { immediate: boolean; } = { immediate: false }) => {
  const _db = await db();
  if (options.immediate) {
    const result = _db.put(type, model);
    sigStore[type] = +new Date;
    return result;
  }
  batchFns[type] ||= batchedFunction(async (models: R[]) => {
    const tx = _db.transaction(type, 'readwrite');
    const result = await Promise.all([...models.map(e => tx.store.put(e)), tx.done]);
    if (result) {
      // console.log('signaling', type);
      sigStore[type] = +new Date;
    }
  }, { delay: 96 });
  batchFns[type](model);
};

export const clear = async () => {
  const names = [..._db.objectStoreNames];
  await Promise.all(names.map(n => _db.clear(n)));
};

// idb

interface ZapthreadsSchema extends DBSchema {
  events: {
    key: string,
    value: StoredEvent,
    indexes: { 'anchor': string, 'kind+anchor': [StoredEvent['kind'], string]; };
  };
  aggregates: {
    key: string[],
    value: AggregateEvent,
    indexes: { 'eventId+kind': [string, AggregateEvent['kind']]; },
  },
  relays: {
    key: string[],
    value: StoredRelay,
    indexes: { 'url': string, 'anchor': string; };
  };
  profiles: {
    key: string,
    value: StoredProfile;
    indexes: { 'lastChecked': number; };
  };
}

let _db: IDBPDatabase<ZapthreadsSchema>;

const db = async () => _db ||= await
  openDB<ZapthreadsSchema>('zapthreads', 2, {
    upgrade(db, oldVersion, newVersion) {
      if (newVersion == 1) {
        const events = db.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('anchor', 'anchor');
        events.createIndex('kind+anchor', ['kind', 'anchor']);

        const relays = db.createObjectStore('relays', {
          keyPath: ['url', 'anchor'],
        });
        relays.createIndex('url', 'url');
        relays.createIndex('anchor', 'anchor');

        const profiles = db.createObjectStore('profiles', { keyPath: 'pubkey' });
        profiles.createIndex('lastChecked', 'lastChecked');
      }

      if (newVersion == 2) {
        const aggregates = db.createObjectStore('aggregates', { keyPath: 'eventId' });
        aggregates.createIndex('eventId+kind', ['eventId', 'kind']);
      }
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
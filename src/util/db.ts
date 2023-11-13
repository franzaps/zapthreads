import { InitializedResource, Signal, createMemo, createResource, on } from "solid-js";
import batchedFunction from "./batched-function.ts";
import { createMutable, createStore, reconcile, unwrap } from "solid-js/store";
import { IDBPDatabase, IndexKey, IndexNames, StoreNames, StoreValue, openDB } from "idb";
import { ZapthreadsSchema, upgrade } from "./models.ts";

type DBTypes = ZapthreadsSchema;

let _db: IDBPDatabase<ZapthreadsSchema>;
const db = async () => {
  return _db ||= await openDB<ZapthreadsSchema>('zapthreads', 2, { upgrade });
};

// db utils

export const watchAll = <Name extends StoreNames<DBTypes>, IndexName extends IndexNames<DBTypes, Name>, Value extends StoreValue<DBTypes, Name>>(cb: () => [Name] | [Name, IndexKey<DBTypes, Name, IndexName> | IndexKey<DBTypes, Name, IndexName>[] | IDBKeyRange, options?: { index: IndexName; }]) => {
  const get = createMemo(on(cb, () => {
    const [storeName, query, options] = cb();
    const fetchData = () => findAll(storeName, query, options);

    const [resource, { mutate }] = createResource(() => sigStore[storeName], fetchData, {
      initialValue: [],
      storage: createDeepSignal
    });
    // trigger initial value
    findAll(storeName, query, options).then(mutate);

    return resource as InitializedResource<Value[]>;
  }));
  return () => get()();
};

export const watch = <Name extends StoreNames<DBTypes>, IndexName extends IndexNames<DBTypes, Name>, Value extends StoreValue<DBTypes, Name>>(cb: () => [Name, IndexKey<DBTypes, Name, IndexName> | IDBKeyRange, options?: { index: IndexName; }]) => {
  const get = createMemo(on(cb, () => {
    const [storeName, query, options] = cb();
    const fetchData = () => find(storeName, query!, options);

    const [resource, { mutate }] = createResource(() => sigStore[storeName], fetchData, {
      initialValue: undefined,
      storage: createDeepSignal
    });
    // trigger initial value
    find(storeName, query!, options).then(mutate);

    return resource as InitializedResource<Value | undefined>;
  }));
  return () => get()();
};

export const findAll = async <Name extends StoreNames<DBTypes>, IndexName extends IndexNames<DBTypes, Name>>(storeName: Name, query?: IndexKey<DBTypes, Name, IndexName> | IndexKey<DBTypes, Name, IndexName>[] | IDBKeyRange, options?: { index: IndexName; }) => {
  const _db = await db();
  if (query && options) {
    if (Array.isArray(query)) {
      const queries = query.map(value => _db.getAllFromIndex(storeName, options.index, value));
      const resolved = await Promise.all(queries);
      return resolved.flat(); // flatten arrays of results\
    }
    return _db.getAllFromIndex(storeName, options.index, query);
  }
  return _db.getAll(storeName);
};

export const findAllKeys = async <Name extends StoreNames<DBTypes>, IndexName extends IndexNames<DBTypes, Name>>(storeName: Name, query?: IndexKey<DBTypes, Name, IndexName> | IDBKeyRange, options?: { index: IndexName; }) => {
  const _db = await db();
  if (query && options) {
    return _db.getAllKeysFromIndex(storeName, options.index, query);
  }
  return _db.getAllKeys(storeName);
};


export const find = async <Name extends StoreNames<DBTypes>, IndexName extends IndexNames<DBTypes, Name>>(storeName: Name, query: IndexKey<DBTypes, Name, IndexName> | IDBKeyRange, options?: { index: IndexName; }) => {
  const _db = await db();
  if (options) {
    return _db.getFromIndex(storeName, options.index, query);
  }
  return _db.get(storeName, query as IDBKeyRange);
};

const batchFns: { [key: string]: Function; } = {};

export const save = async <Name extends StoreNames<DBTypes>, Value extends StoreValue<DBTypes, Name>>(type: Name, model: Value, options: { immediate: boolean; } = { immediate: false }) => {
  const _db = await db();
  if (options.immediate) {
    const result = _db.put(type, model);
    sigStore[type] = +new Date;
    return result;
  }
  batchFns[type] ||= batchedFunction(async (models: Value[]) => {
    const tx = _db.transaction(type, 'readwrite');
    const result = await Promise.all([...models.map(e => tx.store.put(e)), tx.done]);
    if (result) {
      sigStore[type] = +new Date;
    }
  }, { delay: 96 });
  batchFns[type](model);
};

export const clear = async () => {
  const names = [..._db.objectStoreNames];
  await Promise.all(names.map(n => _db.clear(n)));
};

// util

// signal store
const sigStore = createMutable<{ [key: string]: number; }>({});

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
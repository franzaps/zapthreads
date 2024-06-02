import { InitializedResource, Signal, createMemo, createResource, on } from "solid-js";
import batchedFunction from "./batched-function.ts";
import { createMutable, createStore, reconcile, unwrap } from "solid-js/store";
import { IDBPDatabase, IndexKey, IndexNames, StoreNames, StoreValue, openDB } from "idb";
import { ZapthreadsSchema, indices, upgrade } from "./models.ts";

type DBTypes = ZapthreadsSchema;

type InMemoryDatabaseFactory = <Name extends StoreNames<DBTypes>>() => { [key in Name]?: { [key: string]: StoreValue<DBTypes, Name>; } };

const inMemoryDatabaseFactory: InMemoryDatabaseFactory = () => ({});
let memDb = inMemoryDatabaseFactory();
let _retryOpenDatabase = true;

let __db: IDBPDatabase<ZapthreadsSchema>;
const db = async () => {
  if (_retryOpenDatabase === false) {
    return;
  }
  try {
    return __db ||= await openDB<ZapthreadsSchema>('zapthreads', 2, { upgrade });
  }
  catch (e) {
    // IndexedDB is not supported, do not attempt to open again and use in-memory database
    _retryOpenDatabase = false;
  }
};

// db utils

export const watchAll = <Name extends StoreNames<DBTypes>, IndexName extends IndexNames<DBTypes, Name>, Value extends StoreValue<DBTypes, Name>>(cb: () => [Name] | [Name, IndexKey<DBTypes, Name, IndexName> | IndexKey<DBTypes, Name, IndexName>[] | IDBKeyRange, options?: { index: IndexName; }]) => {
  const get = createMemo(on(cb, () => {
    const [type, query, options] = cb();
    const fetchData = () => findAll(type, query, options);

    const [resource, { mutate }] = createResource(() => sigStore[type], fetchData, {
      initialValue: [],
      storage: createDeepSignal
    });
    // trigger initial value
    findAll(type, query, options).then(mutate);

    return resource as InitializedResource<Value[]>;
  }));
  return () => get()();
};

export const watch = <Name extends StoreNames<DBTypes>, IndexName extends IndexNames<DBTypes, Name>, Value extends StoreValue<DBTypes, Name>>(cb: () => [Name, IndexKey<DBTypes, Name, IndexName> | IDBKeyRange, options?: { index: IndexName; }]) => {
  const get = createMemo(on(cb, () => {
    const [type, query, options] = cb();
    const fetchData = () => find(type, query!, options);

    const [resource, { mutate }] = createResource(() => sigStore[type], fetchData, {
      initialValue: undefined,
      storage: createDeepSignal
    });
    // trigger initial value
    find(type, query!, options).then(mutate);

    return resource as InitializedResource<Value | undefined>;
  }));
  return () => get()();
};

export const findAll = async <Name extends StoreNames<DBTypes>, IndexName extends IndexNames<DBTypes, Name>>(type: Name, query?: IndexKey<DBTypes, Name, IndexName> | IndexKey<DBTypes, Name, IndexName>[] | IDBKeyRange, options?: { index: IndexName; }): Promise<StoreValue<DBTypes, Name>[]> => {
  const _db = await db();
  if (!_db) {
    const map = memDb[type];
    if (map) {
      if (options) {
        // If an index query is requested then filter on the property
        // NOTE: composite indices not supported!
        const values = Array.isArray(query) ? query : [query];
        // @ts-ignore
        return Object.values(map).filter(e => values.includes(e[options.index]));
      }
      return Object.values(map);
    }
    return [];
  }
  if (query && options) {
    if (Array.isArray(query)) {
      const queries = query.map(value => _db.getAllFromIndex(type, options.index, value));
      const resolved = await Promise.all(queries);
      return resolved.flat(); // flatten arrays of results\
    }
    return _db.getAllFromIndex(type, options.index, query);
  }
  return _db.getAll(type);
};

export const find = async <Name extends StoreNames<DBTypes>, IndexName extends IndexNames<DBTypes, Name>>(type: Name, query: IndexKey<DBTypes, Name, IndexName> | IDBKeyRange, options?: { index: IndexName; }): Promise<StoreValue<DBTypes, Name> | undefined> => {
  const _db = await db();
  if (!_db) {
    const map = memDb[type];
    if (map) {
      if (options) {
        // If an index query is requested then find on the property
        // NOTE: composite indices not supported!
        // @ts-ignore
        return Object.values(map).find(e => e[options.index] === query);
      }
      // Otherwise assume key
      // NOTE: key ranges not supported 
      // @ts-ignore
      const idx = (query.lower ? query.lower : query).toString();
      // @ts-ignore
      return map[idx];
    }
    return;
  }
  if (options) {
    return _db.getFromIndex(type, options.index, query);
  }
  return _db.get(type, query as IDBKeyRange);
};

const batchFns: { [key: string]: Function; } = {};

const _saveToMemoryDatabase = <Name extends StoreNames<DBTypes>, Value extends StoreValue<DBTypes, Name>>(type: Name, models: Value[]) => {
  memDb[type] ??= {};
  for (const model of models) {
    let indicesForType: any = indices[type];
    // array-ify indices for type
    indicesForType = Array.isArray(indicesForType) ? indicesForType : [indicesForType];

    // Stringify and join values
    // @ts-ignore
    const indexValue = indicesForType.map(index => model[index]).join(',');
    // Use value to index model in memory object
    // @ts-ignore
    memDb[type][indexValue] = model;
  }
};

const _removeFromMemoryDatabase = <Name extends StoreNames<DBTypes>, IndexName extends IndexNames<DBTypes, Name>, Value extends StoreValue<DBTypes, Name>>(type: Name, query: IndexKey<DBTypes, Name, IndexName> | IndexKey<DBTypes, Name, IndexName>[] | IndexKey<DBTypes, Name, IndexName>[][]) => {
  const map = memDb[type];
  if (map) {
    // @ts-ignore
    const idx = (query.lower ? query.lower : query).toString();
    delete map[idx];
  }
}

export const save = async <Name extends StoreNames<DBTypes>, Value extends StoreValue<DBTypes, Name>>(type: Name, model: Value, options: { immediate: boolean; } = { immediate: false }) => {
  const _db = await db();

  if (options.immediate) {
    if (!_db) {
      _saveToMemoryDatabase(type, [model]);
    } else {
      _db.put(type, model);
    }
    sigStore[type] = +new Date;
    return;
  }

  batchFns[type] ||= batchedFunction(async (models: Value[]) => {
    if (!_db) {
      _saveToMemoryDatabase(type, models);
      sigStore[type] = +new Date;
      return;
    }
    const tx = _db.transaction(type, 'readwrite');
    const result = await Promise.all([...models.map(e => tx.store.put(e)), tx.done]);
    if (result) {
      sigStore[type] = +new Date;
    }
  }, { delay: 96 });
  batchFns[type](model);
};

export const remove = async <Name extends StoreNames<DBTypes>, IndexName extends IndexNames<DBTypes, Name>, Value extends StoreValue<DBTypes, Name>>(type: Name, query: IndexKey<DBTypes, Name, IndexName>[] | IndexKey<DBTypes, Name, IndexName>[][], options: { immediate: boolean; } = { immediate: true }) => {
  const _db = await db();
  let ok = true;
  if (options.immediate) {
    if (!_db) {
      _removeFromMemoryDatabase(type, query);
    } else {
      const tx = _db.transaction(type, 'readwrite');
      ok = !!(await Promise.all([...query.map(q => tx.store.delete(q as IDBKeyRange)), tx.done]));
    }
  } else {
    throw new Error('unimplemented');
  }

  if (ok) {
    sigStore[type] = +new Date;
  }
};

export const clear = async () => {
  const _db = await db();
  if (!_db) {
    memDb = {};
    return;
  }
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

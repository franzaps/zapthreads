import { InitializedResource, Signal, createMemo, createResource, on } from "solid-js";
import batchedFunction from "./batched-function";
import { createMutable, createStore, reconcile, unwrap } from "solid-js/store";
import { IDBPDatabase, StoreNames, openDB } from "idb";
import { ZapthreadsSchema, upgrade } from "./models";

type S = StoreNames<ZapthreadsSchema>;

let _db: IDBPDatabase<ZapthreadsSchema>;
const db = async () => _db ||= await openDB<ZapthreadsSchema>('zapthreads', 2, { upgrade });

// db utils

export const watchAll = <Name extends S, Value extends ZapthreadsSchema[Name]["value"], IndexName extends keyof ZapthreadsSchema[Name]["indexes"]>(query: () => [Name] | [Name, IndexName, ZapthreadsSchema[Name]["indexes"][IndexName][] | IDBKeyRange[]]) => {
  const get = createMemo(on(query, () => {
    const [type, index, value] = query();
    const fetchData = () => findAll(type, index, value);

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

// TODO remove this "array" syntax for query?
export const findAll = async <Name extends S, IndexName extends keyof ZapthreadsSchema[Name]["indexes"]>(type: Name, index?: IndexName, query?: ZapthreadsSchema[Name]["indexes"][IndexName][] | IDBKeyRange[]) => {
  const _db = await db();
  if (index && query) {
    const queries = query.map(v => _db.getAllFromIndex(type, index, v));
    const resolved = await Promise.all(queries);
    return resolved.flat(); // flatten arrays of results
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

export const find = async <Name extends S, IndexName extends keyof ZapthreadsSchema[Name]["indexes"]>(type: Name, query: ZapthreadsSchema[Name]["indexes"][IndexName] | IDBKeyRange, index?: IndexName) => {
  const _db = await db();
  if (index && query) {
    return _db.getFromIndex(type, index, query);
  }
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
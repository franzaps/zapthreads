import { UnsignedEvent, Event, SimplePool, Filter } from "nostr-tools";
import { Accessor, createContext } from "solid-js";
import { createMutable } from "solid-js/store";

export type EventSigner = (event: UnsignedEvent<1>) => Promise<{ sig: string; }>;
export type User = { timestamp: number, npub?: string, name?: string, imgUrl?: string; loggedIn?: boolean, signEvent?: EventSigner; };

export const usersStore = createMutable<{ [key: string]: User; }>({});
export const eventsStore = createMutable<{ [key: string]: Event<1>; }>({});
export const preferencesStore = createMutable<{ [key: string]: any; }>({});

export const ZapThreadsContext = createContext<{
  pool: SimplePool,
  relays: string[],
  filter: Accessor<Filter | undefined>;
}>();
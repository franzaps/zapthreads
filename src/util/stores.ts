import { Accessor, createContext } from "solid-js";
import { createMutable } from "solid-js/store";
import { UnsignedEvent, Event } from "../nostr-tools/event";
import { SimplePool } from "../nostr-tools/pool";
import { Filter } from "../nostr-tools/filter";

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
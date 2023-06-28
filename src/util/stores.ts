import { UnsignedEvent, Event } from "nostr-tools";
import { createMutable } from "solid-js/store";

export type EventSigner = (event: UnsignedEvent<1>) => Promise<{ sig: string; }>;
export type User = { timestamp: number, npub?: string, name?: string, imgUrl?: string; loggedIn?: boolean, signEvent?: EventSigner; };

export const usersStore = createMutable<{ [key: string]: User; }>({});
export const eventsStore = createMutable<{ [key: string]: Event<1>; }>({});
export const preferencesStore = createMutable<{ [key: string]: any; }>({});
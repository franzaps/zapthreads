import { NoteEvent, eventToNoteEvent } from "./models.ts";
import { nest } from "./nest.ts";
import { Event } from 'nostr-tools/pure';

describe("NestedNote", () => {
  describe("nest", () => {
    it('nests events from marked tags without anchor', async () => {
      const events = rawEvents.map(e => eventToNoteEvent(e as Event)) as NoteEvent[];
      const nestedEvents = nest(events);
      expect(nestedEvents[0].c).toEqual("a");
      expect(nestedEvents[0].children[0].c).toEqual("b");
      expect(nestedEvents[0].children[0].children[0].c).toEqual("c");
    });
  });
});

// Test events with NIP-10 marked tags
const rawEvents = [{
  "created_at": 0,
  "pubkey": "a1b2b3",
  "id": "abc123",
  "content": "a",
  "tags": [["p", "123456"]],
  "kind": 1,
},
{
  "created_at": 1,
  "pubkey": "e4d3b2",
  "id": "456def",
  "content": "b",
  "tags": [
    ["p", "123456"],
    ["e", "abc123", "", "root"],
    ["e", "f1e2d3", "", "mention"]
  ],
  "kind": 1,
},
{
  "created_at": 2,
  "id": "789cef",
  "pubkey": "f6a9c5",
  "content": "c",
  "tags": [
    ["e", "456def", "", "reply"],
    ["p", "123456"],
    ["e", "abc123", "", "root"]
  ],
  "kind": 1,
}];
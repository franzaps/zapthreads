import { Event } from "../nostr-tools/event";
import { parse } from "../nostr-tools/nip10";

export type NestedNote = Event & { rootId?: string, replyId?: string, children: NestedNote[]; };

export function nest(events: Event[], anchorIds?: string[]): NestedNote[] {
  const nestedEvents = events.map(e => {
    let rootId: string | undefined;
    let replyId: string | undefined;

    const nip10Result = parse(e);
    const aTag = e.tags.find(t => t[0] === "a");
    // If "a" tag is present use it as sole anchor
    if (anchorIds && aTag) {
      rootId = anchorIds.find(a2 => a2 === aTag[1]);
      replyId = events.find(e2 => e2.id === nip10Result.reply?.id
        || e2.id === nip10Result.root?.id)?.id;
    } else {
      rootId = events.find(e2 => e2.id === nip10Result.root?.id)?.id;
      replyId = events.find(e2 => e2.id === nip10Result.reply?.id)?.id;
    }
    return { ...e, rootId, replyId, children: [] };
  }).filter(e => {
    if (anchorIds) {
      // If anchors were supplied, filter out events with no root
      return e.rootId;
    }
    return true;
  });
  return unflatten(nestedEvents, anchorIds);
}

function unflatten(events: NestedNote[], parentIds?: (string | undefined)[]): NestedNote[] {
  // Find all events at this level of recursion (filter by parent)
  // NIP-10: For top level replies only the "root" marker should be used
  const result = new Set(events.filter(e => {
    if (parentIds) {
      return parentIds.includes(e.replyId || e.rootId);
    }
    // If no parentEvents are supplied, match those without it
    return (e.replyId || e.rootId) === undefined;
  }));

  // Remove found events from the original event array
  events = events.filter(e => !result.has(e));

  // For every event at this level, apply the same logic and add to children
  for (let e of result) {
    e.children.push(...unflatten(events, [e.id]));
  }

  // Return an array of nested events
  return [...result];
}
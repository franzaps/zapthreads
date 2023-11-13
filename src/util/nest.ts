import { NoteEvent } from "./models";

// Parent & children are strictly UI concepts, an event with no parent
// means it sits at the first level, no children means no replies to it
export type NestedNoteEvent = NoteEvent & { parent?: NoteEvent, children: NestedNoteEvent[]; };

export const nest = (events: NoteEvent[], parent?: NoteEvent): NestedNoteEvent[] => {
  let nestedEvents: NestedNoteEvent[] = events.map(e => ({ ...e, children: [] }));

  // Find all events at this level of recursion (filter by parent)
  const currentLevelEvents = new Set(nestedEvents.filter(e => {
    if (parent) {
      const belongsToLevel: boolean = parent.id === (e.re || e.ro);
      if (belongsToLevel) {
        e.parent = parent;
      }
      return belongsToLevel;
    }

    // If no parent is found in the events array, match those without it
    return !nestedEvents.find(e2 => e2.id === (e.re || e.ro));
  }));

  // Remove found events from the original event array
  nestedEvents = nestedEvents.filter(e => !currentLevelEvents.has(e));

  // For every event at this level, apply the same logic and add to children
  for (let e of currentLevelEvents) {
    e.children.push(...nest(nestedEvents, e));
  }
  return [...currentLevelEvents];
};
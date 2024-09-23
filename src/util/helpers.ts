import {NestedNoteEvent} from "./nest.js";

export const flattenEvents = (arr: NestedNoteEvent[]) => {
    let result: NestedNoteEvent[] = [];

    const flatten = (item: NestedNoteEvent) => {
        result.push({ ...item, children: [] });
        if (item.children && item.children.length > 0) {
            item.children.forEach(flatten);
        }
    }

    arr.forEach(flatten);
    return result;
}
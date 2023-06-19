import { NDKFilter, NDKNestedEvent } from "@nostr-dev-kit/ndk";

// Misc profile helpers

export const userDisplay = (npub: string, name?: string) => {
  return name || npub.substring(0, 8) + '...' + npub.substring(npub.length - 4);
};

export const svgWidth = 20;
export const randomCount = () => Math.floor(Math.random() * 42);

export const defaultPicture = 'data:image/svg+xml;utf-8,<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="512" r="512" fill="%23333" fill-rule="evenodd" /></svg>';

export function timeAgo(timestamp: number) {
  const now = new Date();
  const secondsPast = Math.floor((now.getTime() - timestamp) / 1000);
  if (secondsPast < 60) {
    return 'now';
  }
  if (secondsPast < 3600) {
    return Math.floor(secondsPast / 60) + 'm ago';
  }
  if (secondsPast <= 86400) {
    return Math.floor(secondsPast / 3600) + 'h ago';
  }
  if (secondsPast > 86400) {
    const date: Date = new Date(timestamp);
    const day = date.toLocaleDateString('en-us', { day: "numeric", month: "long" });
    const year = date.getFullYear() === now.getFullYear() ? '' : ' ' + date.getFullYear();
    return day + year;
  }
}

// extensions

declare module '@nostr-dev-kit/ndk' {
  interface NDKNestedEvent {
    totalChildren(): number;
  }
}

NDKNestedEvent.prototype.totalChildren = function () {
  return this.children.reduce<number>((acc, c) => {
    return acc + c.totalChildren();
  }, this.children.length);
};
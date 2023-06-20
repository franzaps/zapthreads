import { NDKEvent, NDKNestedEvent } from "@nostr-dev-kit/ndk";
import { nip10, nip19, nip27 } from "nostr-tools";
import { micromark } from "micromark";
import { gfmAutolinkLiteral, gfmAutolinkLiteralHtml } from "micromark-extension-gfm-autolink-literal";
import { usersStore } from "./ZapThreads";


// Misc profile helpers

export const parseContent = (e: NDKEvent): string => {

  let content = e.content;

  // NIP-08 => NIP-27 + Markdown
  content = content.replace(/\#\[([0-9])\]/g, (match, capture) => {
    switch (e.tags[capture][0]) {
      case "e":
        return 'nostr:' + nip19.noteEncode(e.tags[capture][1]);
      case "a":
        const [kind, pubkey, identifier] = e.tags[capture][1].split(":");
        return 'nostr:' + nip19.naddrEncode({ identifier, pubkey, kind: parseInt(kind) });
      case "p":
        const _pubkey = e.tags[capture][1];
        const npub = nip19.npubEncode(_pubkey);
        const text = usersStore[_pubkey]?.name || shortenEncodedId(npub);
        return `[@${text}](https://nostr.com/${npub})`;
      default:
        return match;
    }
  });

  // NIP-27 => Markdown
  content = nip27.replaceAll(content, ({ decoded, value }) => {
    return `[@${shortenEncodedId(value)}](https://nostr.com/${value})`;
  });

  // Markdown => HTML
  return micromark(content, {
    extensions: [gfmAutolinkLiteral],
    htmlExtensions: [gfmAutolinkLiteralHtml]
  });
};

export const shortenEncodedId = (encoded: string) => {
  return encoded.substring(0, 8) + '...' + encoded.substring(encoded.length - 4);
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
    const m = Math.floor(secondsPast / 60);
    return `${m} minute${m === 1 ? '' : 's'} ago`;
  }
  if (secondsPast <= 86400) {
    const h = Math.floor(secondsPast / 3600);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
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
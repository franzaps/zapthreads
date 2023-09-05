import { Event, UnsignedEvent } from "../nostr-tools/event";
import { NestedNote } from "./nest";
import { PreferencesStore, StoredProfile, UrlPrefixesKeys } from "./stores";
import { decode, naddrEncode, noteEncode, npubEncode } from "../nostr-tools/nip19";
import { Filter } from "../nostr-tools/filter";
import { replaceAll } from "../nostr-tools/nip27";
import nmd from "nano-markdown";
import { findAll, save } from "./db";

// Misc profile helpers

export const updateMetadata = async (result: Event<0>[]): Promise<void> => {
  const profileData: { [x: string]: any; } = {};
  result.forEach(e => {
    const payload = JSON.parse(e.content);
    profileData[e.pubkey] = {
      timestamp: e.created_at!,
      imgUrl: payload.image || payload.picture,
      name: payload.displayName || payload.display_name || payload.name,
    };
  });

  const profiles = await findAll('profiles');

  const updatedProfiles = Object.keys(profileData).map(pubkey => {
    const profile = profiles.find(p => p?.pubkey === pubkey);
    if (!profile) {
      return { pubkey, ...profileData[pubkey] };
    }
    if (profile && profile.timestamp < profileData[profile.pubkey].timestamp) {
      return { pubkey: profile.pubkey, ...profileData[profile.pubkey] };
    }
  }).filter(e => e);
  console.log('saving profiles', updatedProfiles.length);

  for (const p of updatedProfiles) {
    save('profiles', p);
  }
};

export const encodedEntityToFilter = (entity: string): Filter => {
  const decoded = decode(entity);
  switch (decoded.type) {
    case 'nevent': return { "#e": [decoded.data.id] };
    case 'note': return { "#e": [decoded.data] };
    case 'naddr': return {
      "#a": [`${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`]
    };
    default: return {};
  }
};

export const tagFor = (filter: Filter): string[] => {
  if (filter["#a"]) {
    return ["a", filter["#a"][0], "", "root"];
  }
  if (filter["#e"] && filter["#e"].length > 0) {
    return ["e", filter["#e"][0], "", "root"];
  } else {
    return [];
  }
};

const URL_REGEX = /https?:\/\/\S+/g;
const NIP_08_REGEX = /\#\[([0-9])\]/g;

export const parseContent = (e: UnsignedEvent, profiles: StoredProfile[], anchor?: string, prefs?: PreferencesStore): string => {
  let content = e.content;

  // replace http(s) links
  content = content.replaceAll(URL_REGEX, '[$&]($&)');

  // NIP-08 => NIP-27
  content = content.replace(NIP_08_REGEX, (match, capture) => {
    switch (e.tags[capture][0]) {
      case "e":
        return 'nostr:' + noteEncode(e.tags[capture][1]);
      case "a":
        const [kind, pubkey, identifier] = e.tags[capture][1].split(":");
        return 'nostr:' + naddrEncode({ identifier, pubkey, kind: parseInt(kind) });
      case "p":
        const _pubkey = e.tags[capture][1];
        return 'nostr:' + npubEncode(_pubkey);
      default:
        return match;
    }
  });

  // NIP-27 => Markdown
  content = replaceAll(content, ({ decoded, value }) => {
    switch (decoded.type) {
      case 'nprofile':
        let p1 = profiles.find(p => p.pubkey === decoded.data.pubkey);
        const text1 = p1?.name || shortenEncodedId(value);
        return `[@${text1}](${prefs!.urlPrefixes.nprofile}${value})`;
      case 'npub':
        let p2 = profiles.find(p => p.pubkey === decoded.data);
        const text2 = p2?.name || shortenEncodedId(value);
        return `[@${text2}](${prefs!.urlPrefixes.npub}${value})`;
      case 'note':
        return `[@${shortenEncodedId(value)}](${prefs!.urlPrefixes.note}${value})`;
      case 'naddr':
        const same = value === anchor;
        if (same) return '';
        return `[@${shortenEncodedId(value)}](${prefs!.urlPrefixes.naddr}${value})`;
      case 'nevent':
        return `[@${shortenEncodedId(value)}](${prefs!.urlPrefixes.nevent}${value})`;
      default: return value;
    }
  });

  const hashtags = [...e.tags].filter(t => t[0] === 't');
  for (const hashtag of hashtags) {
    if (hashtag.length > 1) {
      content = content.replaceAll(`#${hashtag[1]}`,
        `[#${hashtag[1]}](${prefs!.urlPrefixes.tag}${hashtag[1]})`);
    }
  }

  // Markdown => HTML
  return nmd(content.trim());
};

export const parseUrlPrefixes = (value?: string) => {
  value ||= ["naddr:habla.news/a/",
    "npub:habla.news/p/",
    "nprofile:habla.news/p/",
    "nevent:habla.news/e/",
    "note:habla.news/n/",
    "tag:habla.news/t/"].join(',');
  const result: { [key in UrlPrefixesKeys]?: string; } = {};

  for (const pair of value.split(',')) {
    const [key, value] = pair.split(':');
    if (value) {
      result[key as UrlPrefixesKeys] = `https://${value}`;
    }
  }
  return result;
};

export const shortenEncodedId = (encoded: string) => {
  return encoded.substring(0, 8) + '...' + encoded.substring(encoded.length - 4);
};

export const svgWidth = 20;

export const defaultPicture = 'data:image/svg+xml;utf-8,<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="512" r="512" fill="%23333" fill-rule="evenodd" /></svg>';

export const timeAgo = (timestamp: number): string => {
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
  return '';
};

// extensions

export const totalChildren = (event: NestedNote): number => {
  return event.children.reduce<number>((acc, c) => {
    return acc + totalChildren(c);
  }, event.children.length);
};
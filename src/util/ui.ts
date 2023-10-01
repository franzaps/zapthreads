import { UnsignedEvent } from "../nostr-tools/event";
import { NestedNote } from "./nest";
import { PreferencesStore, StoredProfile, UrlPrefixesKeys, pool } from "./stores";
import { decode, naddrEncode, noteEncode, npubEncode } from "../nostr-tools/nip19";
import { Filter } from "../nostr-tools/filter";
import { matchAll, replaceAll } from "../nostr-tools/nip27";
import nmd from "nano-markdown";
import { findAll, save } from "./db";

// Misc profile helpers

export const updateProfiles = async (pubkeys: string[], relays: string[], profiles: StoredProfile[]): Promise<void> => {
  const now = +new Date;
  const sixHours = 21600000;

  const pubkeysToUpdate = [...new Set(pubkeys)].filter(pubkey => {
    const profile = profiles.find(p => p.pubkey === pubkey);
    if (profile?.lastChecked && profile!.lastChecked > now - sixHours) {
      // console.log(profile!.lastChecked, now - sixHours, profile!.lastChecked < now - sixHours);
      return false;
    } else {
      // console.log('old or no lastchecked for', profile?.pubkey);
      return true;
    }
  }).filter(e => !!e);

  if (pubkeysToUpdate.length === 0) {
    return;
  }

  const updatedProfiles = await pool.list(relays, [{
    kinds: [0],
    authors: pubkeysToUpdate
  }]);

  for (const pubkey of pubkeysToUpdate) {
    const e = updatedProfiles.find(u => u.pubkey === pubkey);
    if (e) {
      const payload = JSON.parse(e.content);
      const pubkey = e.pubkey;
      const updatedProfile = {
        pubkey,
        created_at: e.created_at,
        imgUrl: payload.image || payload.picture,
        name: payload.displayName || payload.display_name || payload.name,
      };
      const storedProfile = profiles.find(p => p.pubkey === pubkey);
      if (!storedProfile || !storedProfile?.name || storedProfile!.created_at < updatedProfile.created_at) {
        // console.log('saving profile');
        save('profiles', { ...updatedProfile, lastChecked: now });
      } else {
        // console.log('only last checked', now);
        save('profiles', { ...storedProfile, lastChecked: now });
      }
    } else {
      // console.log('was not found', pubkey);
      // TODO disable for now, leave for recheck 
      // save('profiles', { pubkey, lastChecked: now, created_at: 0, npub: npubEncode(pubkey) });
    }
  }
};

// Calculate latest created_at to be used as `since` on subsequent relay requests
export const calculateRelayLatest = async (anchor: string) => {
  const eventsForAnchor = await findAll('events', 'anchor', anchor);

  const obj: { [url: string]: number; } = {};

  for (const e of eventsForAnchor) {
    const relaysForEvent = pool.seenOn(e.id);
    for (const relayUrl of relaysForEvent) {
      if (e.created_at > (obj[relayUrl] || 0)) {
        obj[relayUrl] = e.created_at;
      }
    }
  }

  const relays = await findAll('relays', 'anchor', anchor);
  for (const url in obj) {
    const relay = relays.find(r => r.url === url);
    if (relay) {
      if (obj[url] > relay.latest) {
        relay.latest = obj[url];
        save('relays', relay);
      }
    } else {
      save('relays', { url, anchor, latest: obj[url] });
    }
  }
};

export const encodedEntityToFilterTag = (entity: string): Filter => {
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

export const encodedEntityToFilter = (entity: string): Filter => {
  const decoded = decode(entity);
  switch (decoded.type) {
    case 'nevent': return {
      'kinds': [1],
      'ids': [decoded.data.id]
    };
    case 'note': return {
      'kinds': [1],
      'ids': [decoded.data]
    };
    case 'naddr': return {
      'kinds': [decoded.data.kind],
      'authors': [decoded.data.pubkey],
      "#d": [decoded.data.identifier]
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

const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
const IMAGE_REGEX = /(\S*(?:png|jpg|jpeg|gif|webp))/g;
const NIP_08_REGEX = /\#\[([0-9])\]/g;
const ANY_HASHTAG = /\B\#([a-zA-Z0-9]+\b)(?!;)/g;

export const parseContent = (e: UnsignedEvent, profiles: StoredProfile[], anchor?: string, prefs?: PreferencesStore): string => {
  let content = e.content;

  // replace http(s) links + images
  content = content.replace(URL_REGEX, (matched) => {
    if (matched.match(IMAGE_REGEX)) {
      return `![image](${matched})`;
    }
    return `[${matched}](${matched})`;
  });

  // turn hashtags into links
  const hashtags = [...new Set(e.tags)].filter(t => t[0] === 't');
  if (hashtags.length > 0) {
    const re = new RegExp(`\\B#((?:${hashtags.map(h => h[1]).join('|')}))`, 'gi');
    content = content.replaceAll(re, `[#$1](${prefs!.urlPrefixes.tag}$1)`);
  }

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
        const same = e.tags.map(t => [...t]).find(t => t[0] === 'a' && t[1] === `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}` && t[3] === 'mention');
        if (same) return '';
        return `[@${shortenEncodedId(value)}](${prefs!.urlPrefixes.naddr}${value})`;
      case 'nevent':
        return `[@${shortenEncodedId(value)}](${prefs!.urlPrefixes.nevent}${value})`;
      default: return value;
    }
  });

  // Markdown => HTML
  return nmd(content.trim());
};

export const parseTags = (content: string): string[][] => {
  const result = [];
  // generate p and e tags in content
  const nostrMatches = matchAll(content);

  for (const m of nostrMatches) {
    // TODO will handle all of these with a separate library
    if (m.decoded.type === 'npub') {
      result.push(['p', m.decoded.data]);
    }
    if (m.decoded.type === 'naddr') {
      const data = m.decoded.data;
      result.push(['a', `${data.kind}:${data.pubkey}:${data.identifier}`, '', 'mention']);
    }
    if (m.decoded.type === 'nevent') {
      result.push(['e', m.decoded.data.id]);
    }
    if (m.decoded.type === 'note') {
      result.push(['e', m.decoded.data]);
    }
  }

  // add t tags from hashtags in content
  const hashtagMatches = content.matchAll(ANY_HASHTAG);
  const hashtags = new Set([...hashtagMatches].map(m => m[1].toLowerCase()));
  for (const t of hashtags) {
    result.push(['t', t]);
  }

  return result;
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

export const totalChildren = (event: NestedNote): number => {
  return event.children.reduce<number>((acc, c) => {
    return acc + totalChildren(c);
  }, event.children.length);
};
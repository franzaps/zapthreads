import { NestedNoteEvent } from "./nest.ts";
import { Anchor, UrlPrefixesKeys, pool, PreferencesStore } from "./stores.ts";
import { decode } from "nostr-tools/nip19";
import { Filter } from "nostr-tools/filter";
import { matchAll, replaceAll } from "nostr-tools/nip27";
import nmd from "nano-markdown";
import { findAll, save } from "./db.ts";
import { NoteEvent, Profile } from "./models.ts";

// Misc profile helpers

export const updateProfiles = async (pubkeys: string[], relays: string[], profiles: Profile[]): Promise<void> => {
  const now = +new Date;
  const sixHours = 21600000;

  const pubkeysToUpdate = [...new Set(pubkeys)].filter(pubkey => {
    const profile = profiles.find(p => p.pk === pubkey);
    if (profile?.l && profile!.l > now - sixHours) {
      // console.log(profile!.lastChecked, now - sixHours, profile!.lastChecked < now - sixHours);
      return false;
    } else {
      return true;
    }
  }).filter(e => !!e);

  if (pubkeysToUpdate.length === 0) {
    return;
  }

  const updatedProfiles = await pool.querySync(relays, {
    kinds: [0],
    authors: pubkeysToUpdate
  });

  for (const pubkey of pubkeysToUpdate) {
    const e = updatedProfiles.find(u => u.pubkey === pubkey);
    if (e) {
      const payload = JSON.parse(e.content);
      const pubkey = e.pubkey;
      const updatedProfile = {
        pk: pubkey,
        ts: e.created_at,
        i: payload.image || payload.picture,
        n: payload.displayName || payload.display_name || payload.name,
      };
      const storedProfile = profiles.find(p => p.pk === pubkey);
      if (!storedProfile || !storedProfile?.n || storedProfile!.ts < updatedProfile.ts) {
        save('profiles', { ...updatedProfile, l: now });
      } else {
        save('profiles', { ...storedProfile, l: now });
      }
    }
  }
};

export const getRelayLatest = async (anchor: Anchor, relayNames: string[]) => {
  const relaysForAnchor = await findAll('relays', anchor.value, { index: 'a' });
  const relaysLatest = relaysForAnchor.filter(r => relayNames.includes(r.n)).map(t => t.l);

  // TODO Do not use the common minimum, pass each relay's latest as its since
  // (but we need to stop using this pool)
  return relaysLatest.length > 0 ? Math.min(...relaysLatest) + 1 : 0;
};

// Calculate and save latest created_at to be used as `since`
// on subsequent relay requests (we use created_at to be a bit safer than with +Date.now)
// This since only applies to filter queries
// ({ "#e": store.rootEventIds }, { "#a": [anchor().value] })
// and not to aggregate or root event queries
export const saveRelayLatestForFilter = async (anchor: Anchor, events: NoteEvent[]) => {
  const obj: { [url: string]: number; } = {};

  for (const e of events) {
    const relaysForEvent = pool.seenOn.get(e.id);
    if (relaysForEvent) {
      for (const relay of relaysForEvent) {
        if (e.ts > (obj[relay.url] || 0)) {
          obj[relay.url] = e.ts;
        }
      }
    }
  }

  const relays = await findAll('relays', anchor.value, { index: 'a' });
  for (const name in obj) {
    const relay = relays.find(r => r.n === name);
    if (relay) {
      if (obj[name] > relay.l) {
        // update
        relay.l = obj[name];
        save('relays', relay);
      }
    } else {
      // create new
      save('relays', { n: name, a: anchor.value, l: obj[name] });
    }
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

const URL_REGEX = /(?<=^|\s)https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/gi;
const IMAGE_REGEX = /(\S*(?:png|jpg|jpeg|gif|webp))/gi;
const BAD_NIP27_REGEX = /(?<=^|\s)@?((naddr|npub|nevent|note)[a-z0-9]{20,})/g;
const BACKTICKS_REGEX = /\`(.*?)\`/g;

const ANY_HASHTAG = /\B\#([a-zA-Z0-9]+\b)(?!;)/g;

export const parseContent = (e: NoteEvent, store: PreferencesStore, articles: NoteEvent[] = []): string => {
  let content = e.c;
  const urlPrefixes = store.urlPrefixes!;
  const profiles = store.profiles!;

  // replace http(s) links + images
  content = content.replace(URL_REGEX, (url) => {
    if (url.match(IMAGE_REGEX)) {
      return `![image](${url})`;
    }
    return `[${url}](${url})`;
  });

  // turn hashtags into links (does not match hashes in URLs)
  const hashtags = [...new Set(e.t)];
  if (hashtags.length > 0) {
    const re = new RegExp(`(^|\\s)\\#(${hashtags.join('|')})`, 'gi');
    content = content.replaceAll(re, `$1[#$2](${urlPrefixes.tag}$2)`);
  }

  // NIP-27 attempts => NIP-27
  content = content.replaceAll(BAD_NIP27_REGEX, 'nostr:$1');

  // NIP-27 => Markdown
  content = replaceAll(content, ({ decoded, value }) => {
    switch (decoded.type) {
      case 'nprofile':
        let p1 = profiles().find(p => p.pk === decoded.data.pubkey);
        const text1 = p1?.n || shortenEncodedId(value);
        return `[@${text1}](${urlPrefixes.nprofile}${value})`;
      case 'npub':
        let p2 = profiles().find(p => p.pk === decoded.data);
        const text2 = p2?.n || shortenEncodedId(value);
        return `[@${text2}](${urlPrefixes.npub}${value})`;
      case 'note':
        return `[@${shortenEncodedId(value)}](${urlPrefixes.note}${value})`;
      case 'naddr':
        const d = decoded.data;
        const article = articles.find(a => a.pk === d.pubkey && a.d === d.identifier);
        if (article && article.tl) {
          return `[${article.tl}](${urlPrefixes.naddr}${value})`;
        }
        return `[@${shortenEncodedId(value)}](${urlPrefixes.naddr}${value})`;
      case 'nevent':
        return `[@${shortenEncodedId(value)}](${urlPrefixes.nevent}${value})`;
      default: return value;
    }
  });

  // Replace backticks with code
  content = content.replaceAll(BACKTICKS_REGEX, '<code>$1</code>');

  // Markdown => HTML
  return nmd(content.trim());
};

export const generateTags = (content: string): string[][] => {
  const result = [];
  // generate p and e tags in content
  const nostrMatches = matchAll(content);

  for (const m of nostrMatches) {
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

export const parseUrlPrefixes = (value: string = '') => {
  const result: { [key in UrlPrefixesKeys]?: string; } = {
    naddr: 'https://nostr.com/',
    npub: 'https://nostr.com/',
    nprofile: 'https://nostr.com/',
    nevent: 'https://nostr.com/',
    note: 'https://nostr.com/',
    tag: 'https://snort.social/t/'
  };

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

export const sortByDate = <T extends { ts?: number; }>(arr: T[]) => arr.sort((a, b) => (a.ts || 0) >= (b.ts || 0)
  ? -1
  : 1);

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
  // 604800ms = 1 week
  if (secondsPast <= 604800) {
    const d = Math.floor(secondsPast / 86400);
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }
  if (secondsPast > 604800) {
    const date: Date = new Date(timestamp);
    const day = date.toLocaleDateString('en-us', { day: "numeric", month: "long" });
    const year = date.getFullYear() === now.getFullYear() ? '' : ' ' + date.getFullYear();
    return 'on ' + day + year;
  }
  return '';
};

export const satsAbbrev = (sats: number): string => {
  if (sats < 10000) {
    return sats.toString();
  } else if (sats < 1000000) {
    return Math.round(sats / 1000) + 'k';
  } else {
    return Math.round(sats / 1000000) + 'M';
  }
};

export const currentTime = () => Math.round(Date.now() / 1000);

export const totalChildren = (event: NestedNoteEvent): number => {
  return event.children.reduce<number>((acc, c) => {
    return acc + totalChildren(c);
  }, event.children.length);
};

const removeSlashesRegex = /\/+$/;

export const normalizeURL = (url: string, removeSlashes: boolean = true): string => {
  const u = new URL(url);
  u.hash = "";
  if (removeSlashes) {
    u.pathname = u.pathname.replace(removeSlashesRegex, '');
  }
  return u.toString();
};

import { UnsignedEvent } from "nostr-tools/event";
import { parseContent, parseUrlPrefixes } from "./ui.ts";
import { createMutable } from "solid-js/store";
import { PreferencesStore } from "./stores.ts";
import { eventToNoteEvent } from "./models.ts";

describe("ui utils", () => {
  describe("parseContent", () => {
    const store = createMutable<PreferencesStore>({
      filter: {},
      profiles: () => [],
      rootEventIds: [],
      disableFeatures: [],
      urlPrefixes: parseUrlPrefixes('naddr:nostr.com/,')
    });

    it('links naddr with title if mentioned', () => {
      const naddr = "naddr1qqxnzd3cxqmrzv3exgmr2wfeqyf8wumn8ghj7ur4wfcxcetsv9njuetnqyxhwumn8ghj7mn0wvhxcmmvqy08wumn8ghj7mn0wd68yttjv4kxz7fwdehkkmm5v9ex7tnrdakszynhwden5te0danxvcmgv95kutnsw43qz9rhwden5te0wfjkccte9ejxzmt4wvhxjmcpzpmhxue69uhkummnw3ezuamfdejsygrwg6zz9hahfftnsup23q3mnv5pdz46hpj4l2ktdpfu6rhpthhwjvpsgqqqw4rskylmpy";
      const e: UnsignedEvent = {
        "kind": 1,
        "tags": [
          [
            'a', '30023:6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93:1680612926599', '', 'mention'
          ]
        ],
        "created_at": 0,
        "pubkey": "",
        "content": `awesome article\n nostr:${naddr}`
      };

      let result = parseContent(eventToNoteEvent(e), store);
      expect(result).toEqual('<p>awesome article\n <a href="https://nostr.com/naddr1qqxnzd3cxqmrzv3exgmr2wfeqyf8wumn8ghj7ur4wfcxcetsv9njuetnqyxhwumn8ghj7mn0wvhxcmmvqy08wumn8ghj7mn0wd68yttjv4kxz7fwdehkkmm5v9ex7tnrdakszynhwden5te0danxvcmgv95kutnsw43qz9rhwden5te0wfjkccte9ejxzmt4wvhxjmcpzpmhxue69uhkummnw3ezuamfdejsygrwg6zz9hahfftnsup23q3mnv5pdz46hpj4l2ktdpfu6rhpthhwjvpsgqqqw4rskylmpy">@naddr1qq...lmpy</a></p>');
    });

    it('parses a nostr url with a custom url prefix', () => {
      const e: UnsignedEvent = {
        "kind": 1,
        "tags": [],
        "created_at": 0,
        "pubkey": "",
        "content": "nostr:naddr1qqxnzd3cxqmrzv3exgmr2wfeqyf8wumn8ghj7ur4wfcxcetsv9njuetnqyxhwumn8ghj7mn0wvhxcmmvqy08wumn8ghj7mn0wd68yttjv4kxz7fwdehkkmm5v9ex7tnrdakszynhwden5te0danxvcmgv95kutnsw43qz9rhwden5te0wfjkccte9ejxzmt4wvhxjmcpzpmhxue69uhkummnw3ezuamfdejsygrwg6zz9hahfftnsup23q3mnv5pdz46hpj4l2ktdpfu6rhpthhwjvpsgqqqw4rskylmpy"
      };
      let result = parseContent(eventToNoteEvent(e), store);
      expect(result).toMatch('<p><a href="https://nostr.com/naddr1qqxnzd3cxqmrzv');

      e.content = 'I love #Bitcoin';
      e.tags = [['t', 'Bitcoin']];

      result = parseContent(eventToNoteEvent(e), store);
      expect(result).toEqual('<p>I love <a href="https://snort.social/t/Bitcoin">#Bitcoin</a></p>');
    });

    it('handles a wrongly placed tag', () => {
      const e: UnsignedEvent = {
        "kind": 1,
        "tags": [['t', 'nevent1qqs']],
        "created_at": 0,
        "pubkey": "",
        "content": "otoh:\nhttps://nostrapp.link/#nevent1qqs?select=true"
      };
      let result = parseContent(eventToNoteEvent(e), store);
      expect(result).toMatch('<p>otoh:\n<a href="https://nostrapp.link/#nevent1qqs?select=true');
    });

    it('replaces backticks', () => {
      const e: UnsignedEvent = {
        "kind": 1,
        "tags": [],
        "created_at": 0,
        "pubkey": "",
        "content": "should check for `var a = 1` tags"
      };
      let result = parseContent(eventToNoteEvent(e), store);
      expect(result).toMatch('<p>should check for <code>var a = 1</code> tags</p>');
    });

    // 

    it('replaces images', () => {
      const e: UnsignedEvent = {
        "kind": 1,
        "tags": [],
        "created_at": 0,
        "pubkey": "",
        "content": "image here ![image](https://cdn.nostr.build/i/1.png)"
      };
      let result = parseContent(eventToNoteEvent(e), store);
      expect(result).toMatch('<p>image here <img src="https://cdn.nostr.build/i/1.png" alt="image"/></p>');
    });
  });
});

import { UnsignedEvent } from "../nostr-tools/event";
import { parseContent, parseUrlPrefixes } from "./ui";

const emptyPrefs = { disable: () => [], urlPrefixes: parseUrlPrefixes('') };

describe("ui utils", () => {
  describe("parseContent", () => {
    it('removes naddr if mentioned', () => {
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

      let result = parseContent(e, [], naddr, emptyPrefs);
      expect(result).toEqual('<p>awesome article</p>');
    });

    it('parses a nostr url with a custom url prefix', () => {
      const e: UnsignedEvent = {
        "kind": 1,
        "tags": [],
        "created_at": 0,
        "pubkey": "",
        "content": "nostr:naddr1qqxnzd3cxqmrzv3exgmr2wfeqyf8wumn8ghj7ur4wfcxcetsv9njuetnqyxhwumn8ghj7mn0wvhxcmmvqy08wumn8ghj7mn0wd68yttjv4kxz7fwdehkkmm5v9ex7tnrdakszynhwden5te0danxvcmgv95kutnsw43qz9rhwden5te0wfjkccte9ejxzmt4wvhxjmcpzpmhxue69uhkummnw3ezuamfdejsygrwg6zz9hahfftnsup23q3mnv5pdz46hpj4l2ktdpfu6rhpthhwjvpsgqqqw4rskylmpy"
      };
      let result = parseContent(e, [], undefined, { disable: () => [], urlPrefixes: parseUrlPrefixes('naddr:nostr.com/') });
      expect(result).toMatch('<p><a href="https://nostr.com/naddr1qqxnzd3cxqmrzv');

      e.content = 'I love #Bitcoin';
      e.tags = [['t', 'Bitcoin']];

      result = parseContent(e, [], undefined, emptyPrefs);
      expect(result).toEqual('<p>I love <a href=\"https://habla.news/t/Bitcoin\">#Bitcoin</a></p>');
    });

    it('handles a wrongly placed tag', () => {
      const e: UnsignedEvent = {
        "kind": 1,
        "tags": [['t', 'nevent1qqs']],
        "created_at": 0,
        "pubkey": "",
        "content": "otoh:\nhttps://nostrapp.link/#nevent1qqs?select=true"
      };
      let result = parseContent(e, [], undefined, emptyPrefs);
      expect(result).toMatch('<p>otoh:\n<a href="https://nostrapp.link/#nevent1qqs?select=true');
    });

    it('replaces nip-08 correctly', () => {
      const e: UnsignedEvent = {
        "kind": 1,
        "tags": [
          ['p', '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2'],
          ['t', 'sunstrike']
        ],
        "created_at": 0,
        "pubkey": "",
        "content": "#sunstrike\n\nsome #[0]"
      };
      let result = parseContent(e, [], undefined, emptyPrefs);
      expect(result).toMatch('<p><a href=\"https://habla.news/t/sunstrike\">#sunstrike</a></p>\n\n<p>some <a href=\"https://habla.news/p/npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m\">@npub1sg6...f63m</a></p>');
    });

    it('replaces backticks', () => {
      const e: UnsignedEvent = {
        "kind": 1,
        "tags": [],
        "created_at": 0,
        "pubkey": "",
        "content": "should check for `var a = 1` tags"
      };
      let result = parseContent(e, [], undefined, emptyPrefs);
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
      let result = parseContent(e, [], undefined, emptyPrefs);

      expect(result).toMatch('<p>image here <img src="https://cdn.nostr.build/i/1.png" alt="image"/></p>');
    });
  });
});

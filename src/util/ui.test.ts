import { UnsignedEvent } from "../nostr-tools/event";
import { parseContent, parseUrlPrefixes } from "./ui";

describe("ui utils", () => {
  describe("parseContent", () => {
    it('removes naddr if mentioned', async () => {
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

      let result = parseContent(e, [], naddr);
      expect(result).toEqual('<p>awesome article</p>');
    });

    it('parses a nostr url with a custom url prefix', async () => {
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

      result = parseContent(e, [], undefined, { disable: () => [], urlPrefixes: parseUrlPrefixes('') });
      expect(result).toEqual('<p>I love <a href=\"https://habla.news/t/Bitcoin\">#Bitcoin</a></p>');
    });
  });
});

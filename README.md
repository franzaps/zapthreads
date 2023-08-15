# ZapThreads

A threaded web commenting system built on Nostr. Inspired by [stacker.news](https://stacker.news) and [NoComment](https://github.com/fiatjaf/nocomment).

![](https://cdn.nostr.build/i/a03024c8ce022f1207196b6efeaec7738e036463da5982795e6fc7b182dbaeb2.png)

## Features

 - Works on a variety of root events: `note`, `nevent`, `naddr`, URLs
 - Markdown support and nostr reference handling
 - Extremely versatile and customizable
   - Enable/disable many features via attributes
   - Light/dark modes
   - Full CSS control via `shadowRoot` style
   - Multiple languages (coming soon)
 - Lightweight (~35kb minified+gzipped with base styles and assets)
   - For comparison, nocomment is ~244kb
 - Available as web component, works everywhere

## Roadmap

 - Likes and zaps
   - Ability to like and zap comments
   - Prisms, zap splits with host
 - Signers
   - Proper relay selection (NIP-05, nprofile, NIP-65)
   - Ability to remote sign
   - World class onboarding for new users
 - [Much more](https://github.com/fr4nzap/zapthreads/issues)

## Usage

```bash
npm install zapthreads
// or
yarn add zapthreads
// or
pnpm add zapthreads
```

```html
import "zapthreads";

<zap-threads anchor="naddr1qqxnzd3cxqmrzv3exgmr2wfeqgsxu35yyt0mwjjh8pcz4zprhxegz69t4wr9t74vk6zne58wzh0waycrqsqqqa28pjfdhz" ... />
```

Arguments:

 - (required) `anchor`: NIP-19 naddr or URL from where to retrieve anchor events
 - `pubkey`: Pubkey (in hex format) to log in the user as (only works with NIP-07!)
 - `relays`: comma separated list of preferred relays (defaults to `["wss://relay.damus.io", "wss://eden.nostr.land"]`)
 - `disableLikes`: defaults to `false`
 - `disableZaps`: defaults to `false`
 - `disablePublish`: defaults to `false`
 - `closeOnEose`: defaults to `false`
 - `urlPrefixes`: defaults to `naddr:habla.news/a/,npub:habla.news/p/,nprofile:habla.news/p/,nevent:habla.news/e/,note:habla.news/n/,tag:habla.news/t/` (`https://` is automatically prepended)

```html
<zap-threads 
  anchor="naddr1qqxnzd3cxqmrzv3exgmr2wfeqgsxu35yyt0mwjjh8pcz4zprhxegz69t4wr9t74vk6zne58wzh0waycrqsqqqa28pjfdhz"
  pubkey="726a1e261cc6474674e8285e3951b3bb139be9a773d1acf49dc868db861a1c11"
  relays="wss://relay.nostr.band,wss://nostr-pub.wellorder.net/"
  disableLikes="true"
  />
```

As Solid component:

```js
import ZapThreads from 'zapthreads';

<ZapThreads anchor={anchor} relays={relays} closeOnEose={true} />
```

## Customize

### CSS

```js
const style = document.createElement('style');
style.innerHTML = '#ztr-root { font-size: 12em; }';
document.querySelector('zap-threads').shadowRoot.appendChild(style);
```

## Development

 - Install with `pnpm i` and run the app with `pnpm dev`
 - Build with `pnpm build`, it will place the bundles in `dist`

Any questions or ideas, please open an issue!

## LICENSE

This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org/>
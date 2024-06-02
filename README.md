# ZapThreads

A threaded web commenting system built on Nostr. Inspired by [stacker.news](https://stacker.news) and [NoComment](https://github.com/fiatjaf/nocomment).

Try it out:
 - [https://zapthreads.dev](https://zapthreads.dev)
 - Any article on [Habla.news](https://habla.news)

![](https://image.nostr.build/2cf766ce82678fa59dbb988e0efbf722877a5c768615704836f038c342858524.png)

## Features

 - Works on a variety of root events: `note`, `nevent`, `naddr`, URLs
 - Markdown support and nostr reference handling
 - Extremely versatile and customizable
   - Enable/disable many features via attributes
   - Light/dark modes
   - Full styling control
   - Multiple languages (coming soon)
 - Lightweight on clients and relays
   - Local storage caching, offline-first
   - ~40kb minified/compressed with styles and assets (nocomment is > 240kb)
 - Available as web component or embeddable script

## Usage

```
npm install zapthreads
```

or

```
<script type="text/javascript" src="https://unpkg.com/zapthreads/dist/zapthreads.iife.js"></script>
```

Then,

```html
import "zapthreads";

<zap-threads anchor="naddr1qqxnzd3cxqmrzv3exgmr2wfeqgsxu35yyt0mwjjh8pcz4zprhxegz69t4wr9t74vk6zne58wzh0waycrqsqqqa28pjfdhz" ... />
```

Arguments:

 - `anchor`:
   - Required!
   - NIP-19 naddr, note, nevent or URL from where to retrieve events
 - `version`
   - ID of the event to show in case a naddr (long-form note) has multiple versions
 - `relays`: comma-separated list of preferred relays
   - defaults to `wss://relay.damus.io,wss://nos.lol`)
 - `user`:
   - npub to log in the user as (they will only be able to sign with a NIP-07 extension)
   - nsec is also supported
 - `author`:
   - This npub will be added as a `p` tag to all comments
   - Useful for notifying the author of a website (http anchor)
 - `disable`: comma-separated string of features to disable, all enabled by default
   - `likes`
   - `votes`
   - `zaps`
   - `reply` (when disabled the component becomes read-only)
   - `publish` (when disabled does not send event to relays, useful for testing)
   - `watch` (when disabled queries relays and closes the connection immediately on EOSE)
   - `replyAnonymously` (when disabled requires logging in in order to publish)
   - `hideContent` (when disabled it shows the content if the anchor is a naddr)
 - `urls`: comma-separated pairs of URLs
   - defaults to `naddr:nostr.com/,npub:nostr.com/,nprofile:nostr.com/,nevent:nostr.com/,note:nostr.com/,tag:snort.social/t/`
   - `https://` will be automatically prepended

```html
<zap-threads 
  anchor="naddr1qqxnzd3cxqmrzv3exgmr2wfeqgsxu35yyt0mwjjh8pcz4zprhxegz69t4wr9t74vk6zne58wzh0waycrqsqqqa28pjfdhz"
  user="npub1wf4pufsucer5va8g9p0rj5dnhvfeh6d8w0g6eayaep5dhps6rsgs43dgh9"
  relays="wss://relay.nostr.band,wss://nostr-pub.wellorder.net/"
  disable="likes"
  />
```

## Customize

### CSS

Available CSS variables (define in `zap-threads`):
  - `--ztr-font`
  - `--ztr-font-size`
  - `--ztr-text-color`
  - `--ztr-link-color`
  - `--ztr-background-color`
  - `--ztr-icon-color`
  - `--ztr-login-button-color`

For more advanced CSS control via `shadowRoot`:

```js
const style = document.createElement('style');
style.innerHTML = '#ztr-root { font-size: 12em; }';
document.querySelector('zap-threads').shadowRoot.appendChild(style);
```

## Development

 - Install with `pnpm i` and run the app with `pnpm dev`
 - Build with `pnpm build`, it will place the bundles in `dist`

Any questions or ideas, please open an issue!

## Icons
- [Font Awesome](https://fontawesome.com/license/free)

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

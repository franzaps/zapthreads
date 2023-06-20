# ZapThreads

A threaded web commenting system built on Nostr. Inspired by [stacker.news](https://stacker.news) and [NoComment](https://github.com/fiatjaf/nocomment).

![](https://nostr.build/i/bcd4d4f15871f3d366681bea847b9a5b89b0fb118c17e2bb65da48177cc7dfc9.jpg)

![](https://nostr.build/i/0c9c2fbd41a9f6a8b0095bfbbae7562c8ed316f8cc5188de044fb453dbd2b1f5.jpg)

_(Zaps and likes count are fake random numbers at the moment)_

## Features (and goals)

Lightweight and extremely customizable. Available as web component.

 - [x] Threaded comments
   - [x] naddr
   - [x] URL
 - [x] Comment author metadata
 - [x] NIP-07 login
 - [-] Add comments to anchor and reply to other comments
   - [ ] Publish and sync with relay
 - [-] Rich text support
   - [x] Markdown
   - [ ] Parse nostr links and references, optional image loading
 - [ ] Zaps and likes (for both naddr/anchor and comments)
   - [ ] Read
   - [ ] Write
 - [ ] Sort by top, replies, zaps, oldest
 - [ ] Relay selection
   - [ ] Proper relay selection (NIP-05 + NIP-65)
 - [x] CSS themes (and dark theme)
   - [ ] Autodetect color mode
 - [ ] i18n, language support
   - [ ] Autodetect
   - [ ] Inherit from host
 - [ ] Zap splits
 - [ ] Share NIP-07 session with host
 - [ ] Optimized build
   - [ ] Reuse host NDK
   - [ ] Vite tree-shaking
 - [-] Allow to customize most elements
   - [x] Full CSS control via `shadowRoot` style
   - [ ] Better/more props (color mode, language)
 - [ ] Available as multiple libraries
   - [x] Web component (custom element)
   - [x] Solid
   - [ ] React
   - [ ] Vue
   - [ ] Svelte

## Usage

`npm add zapthreads` (SOON™️)

As web component:

```js
import "zapthreads";

// ...

<zap-threads relays="wss://relay.damus.io,wss://eden.nostr.land" anchor="naddr..." />
```

Arguments:

 - `relays`: comma separated list of preferred relays
 - `anchor`: NIP-19 naddr or URL from where to retrieve anchor events

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
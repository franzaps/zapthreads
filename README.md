# ZapThreads

A threaded web commenting system built on Nostr. Inspired by [stacker.news](https://stacker.news) and [NoComment](https://github.com/fiatjaf/nocomment).

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
# Changelog

## 0.5.1

### Bugfixes

 - Update `nostr-tools` to latest, fixes bug with d-tag
 - Show better relay error reporting upon publishing
 - Remove hashes and strip trailing slash from URL

### Features

 - Add custom reply placeholder

## 0.5.0

### Bugfixes

 - Fixed login button issue (#39)
 - Fix race conditions in EOSE closure when quickly switching anchor
 - Styling bugs when scaling

### Features

 - Much faster and efficient local storage
 - Implement fallback for windows with unavailable IndexedDB
 - Allow disabling `reply` for a read-only experience
 - Display notice when replies don't match root events (#35); allow passing `version`
 - Use `nostr-tools` directly now that it supports tree-shaking
 - Use njump (nostr.com) by default
 - Replace naddr mentions in comments with titles present in local storage
 - Revamped sample app and improved styling

## 0.3.2

### Bugfixes

 - Fix hasty release bugs: HTTP anchors and replies work properly again

### Features

 - nsec support (pass to `npub` attribute)
 - Even better event content parsing

## 0.3.1

### Bugfixes

 - Fix various issues with tags in replies
 - Simplify disable features

### Features

 - Show relay status in advanced pane
 - Early support for basic naddr rendering (disable `hideContent`)

## 0.2.0

### Bugfixes

 - Fix Various render issues (markdown and regex)
 - Fix NIP-07 eager load
 - Fix bugs related to quick switching anchors

### Features

 - IndexedDB-based cache for events, profiles and relays
 - Display likes and zaps for anchor
 - Proper color mode
 - Improve API
 - Improve UX and icons
 - Resizable textarea
 - Trim and toggle expand long content

## 0.1.0

### Bugfixes

 - Bug when logging in and clicking reply (#13)

### Features

 - Close on `EOSE` (pass `closeOnEose="true"`)
 - Customizable URL prefixes (pass `urlPrefixes="..."`)
 - Show info pane for every comment (part of the event JSON)
 - Replaced `micromark` with `nano-markdown`, down to 33kb gzipped
# Changelog

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
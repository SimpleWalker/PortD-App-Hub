# AGENTS.md: working on the PortD App Hub

This file is for AI coding agents and developers. The user guide is [README.md](README.md).

PortD 1.0 is a personal desktop in a single HTML file, opened from disk in Edge or Chrome on locked-down computers. This repository holds programs for it. Each program is packed into one `.portdapp` file that the user installs in PortD.

The target is **Microsoft Edge on Windows** (Chrome has the same engine). Programs run offline and must never need the network.

## Layout

```
README.md            user guide, with the table of programs
AGENTS.md            this file
CLAUDE.md            points to this file, for tools that look for CLAUDE.md
LICENSE
package.json         npm run build / npm test (Playwright is the only dependency)
build/
  pack.js            the packer: checks an app folder against the rules and writes its .portdapp
  build-all.js       packs every app folder (npm run build)
  test-all.js        packs and tests every app, writes each test-results.txt (npm test)
  apps.js            lists the app folders (every top-level folder with an app.json)
  harness.js         test helpers: drives the real PortD in headless Edge/Chrome through Playwright
  lib/host.js        the shared PortD-or-standalone helper; every app carries an identical copy
  portd-1.0.0.html   the PortD 1.0.0 build the tests run against
<app-id>/            one folder per program, named exactly as its id
  README.md          the user guide for that program
  app.json           manifest fields (see below)
  src/               the program's files; src/index.html is the entry page
  src/js/host.js     a copy of build/lib/host.js (the packer refuses a copy that differs)
  build.js           packs this app: node <app-id>/build.js
  test.js            this app's tests: node <app-id>/test.js
  test-results.txt   output of the last full test run
  (others)           test helpers an app needs, such as zip-viewer/make-fixtures.py (Python, standard library only)
  <id>-<version>.portdapp   the built package, committed so users can download it
```

## Package format 3

A `.portdapp` is a JSON file:

```json
{
  "format": "portd-app", "formatVersion": 3,
  "id": "table-viewer", "name": "Table Viewer", "version": "1.0.0",
  "description": "…", "icon": "icon.svg", "entry": "index.html",
  "width": 900, "height": 520, "singleInstance": false,
  "fileTypes": [{ "ext": ".csv", "name": "CSV table", "icon": "glyph:table" }],
  "files": { "index.html": { "enc": "text", "d": "<!DOCTYPE html>…" }, "logo.png": { "enc": "dataurl", "d": "data:image/png;base64,…" } }
}
```

| Field | Rules |
|---|---|
| `id` | `^[a-z0-9-]{1,40}$`. It is the install folder (`P:\Programs\<id>`) and the data folder (`P:\User\Config\<id>`). Never change it once released. |
| `version` | `x.y.z`. The file name is `<id>-<version>.portdapp`. |
| `icon` | A file in the package (SVG or picture), `emoji:<one emoji>`, or `glyph:<name>`. |
| `entry` | The page that opens, normally `index.html`. |
| `singleInstance` | `true`: a second start focuses the open window, and opening a file sends it to that window through `PortD.onOpenFile`. |
| `fileTypes` | Extensions the program offers to open: lowercase, with the dot. `.portd`, `.portdapp`, `.lnk` and `.url` are reserved for PortD. |
| `files` | Paths use `/`. `enc` is `text`, or `dataurl` for binary files. `manifest.json` is not allowed (PortD writes it). |
| Limits | 256 files, 8 MB per file, 24 MB in all. |

PortD 1.0 refuses packages with `formatVersion` below 3, including the packages of earlier, unreleased versions.

You never write the package by hand. Put the manifest fields in `app.json` and the files in `src/`, then run the packer.

## The sandbox

A program runs in `<iframe sandbox="allow-scripts allow-forms allow-modals" srcdoc="…">`. Its origin is null and it inherits PortD's CSP:

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:;
media-src data: blob:; font-src data:; form-action 'none'; base-uri 'none'
```

What that means in practice:

- **No network of any kind:** no `fetch`, XHR, WebSocket, remote images, fonts or scripts.
- **No ES modules, no `import()`, no workers.** Use classic `<script src>` files that share globals.
- **No downloads.** `allow-downloads` is not set, so files are saved through `PortD.ui.saveFile`.
- **No clipboard API.** `navigator.clipboard` logs a permissions-policy error. Use `document.execCommand('copy')`, which `Host.copy` does for you.
- **No `alert`, `confirm`, `prompt` or `<form>`** in hub apps. Draw confirmations inside the program.
- **When PortD assembles the page, it inlines:**
  - `<link rel=stylesheet>` (with `@import`)
  - classic `<script src>`
  - `<img src>`, `<source src>` and SVG `<image href>`
  - CSS `url()`

  Any other file is reached at run time through `PortD.assets['path/in/package']`: a data URL, or `null` if the file was already inlined, is over 2 MB, or comes after 8 MB of assets in total.
- **A program cannot:**
  - stop its window from closing, so save as you go
  - learn PortD's theme, so follow `prefers-color-scheme`
  - take keyboard focus back after a PortD dialog closes, so the user may need to click back in
- **Keys forwarded to PortD:** Ctrl+F6 and Ctrl+Shift+F6.

## The PortD API (`window.PortD`)

All calls return promises.

| Member | What it is |
|---|---|
| `PortD.app` | `{ id, name, version, dir, dataDir, args, portd, user }`. `args.open` is `{ path, name, ext }` (ext without the dot) when started with a file. |
| `PortD.assets` | Path → data URL, as above. |
| `PortD.fs.read / write / list / mkdir / remove / exists / move / copy / rename` | Relative paths are inside the data folder `P:\User\Config\<id>`. The program may also read its own program folder and any file the user has given it. `read` returns text, or a data URL for files stored as binary (files from the computer with extensions PortD doesn't treat as text). |
| `PortD.ui.openFile({ title, types })` | PortD's Open dialog. Returns `{ path, name }` or `null`, and grants that file to this window. One dialog per window at a time; it starts in Documents. |
| `PortD.ui.saveFile({ title, name, types })` | PortD's Save dialog. Asks before replacing a file, adds the extension, and grants the path. |
| `PortD.onOpenFile(cb)` | Single-instance programs only: called with `{ path, name, ext }` when the user opens another file with the running program. |
| `PortD.notify(text)` | A PortD notice. PortD adds `"<Program name>: "` in front, so don't repeat the name. |
| `PortD.setTitle(t)`, `PortD.close()`, `PortD.openUrl(u)` | Window title, close the window, open a link in a browser tab. |

Use `src/js/host.js` (`window.Host`) rather than `PortD` directly. It does the same inside PortD and falls back outside it (localStorage, `<input type=file>`, Blob downloads), which is how every program also works when its `src/index.html` is opened on its own. Its main members:

- `Host.inPortD`
- Settings and data: `loadSettings` / `saveSettings`, `loadData` / `saveData` / `removeData` / `listData`
- Files: `openFile`, `saveFile`, `readPath`, `writePath`, `readDropped`, `startFile()`, `onOpenFile`
- Window and messages: `copy`, `notify`, `setTitle`, `openUrl`
- Theme: `applyTheme('auto' | 'light' | 'dark')`, `watchTheme`

If you change `host.js`, edit `build/lib/host.js` and copy it into every `src/js/`.

## Known PortD 1.0 limits (may change in a later PortD)

These were found while building the apps here, by reading and testing PortD 1.0.0. A later PortD may lift some of them. When it does, update this list, the affected app READMEs (their "Known limits" sections), and the apps.

**Files and folders**

- A program can write only:
  - inside its own data folder (`P:\User\Config\<id>\`, subfolders allowed and created as needed)
  - to the single file the user picks in `PortD.ui.saveFile`

  The grant is for that one path, not its folder.
- **There is no folder picker** (`PortD.ui` has `openFile` and `saveFile` only). A program can't save several files into a folder the user chooses: Zip Viewer saves them one by one through Save dialogs, or all at once into its own folder.
- **A program can read only:**
  - its data folder
  - its own program folder
  - files the user has given it: picked in `openFile`, or opened with it from Files
- **Files must be in the home folder** (`P:\User\…`) to be opened with a program from Files.
- **A program can't open a Files window or show the user a location.** Tell the user the path in words (with a Copy button).
- **A file can be at most 64 MB.** Writes use `PortD.fs.write(path, text)` for text, or `PortD.fs.write(path, dataURL, 'dataurl')` for binary data.
- **PortD keeps some extensions as text.** For these, `read` returns a string, not a data URL; everything else from the computer is binary:
  - `txt md log json js mjs css html htm xml svg csv tsv`
  - `ini cfg conf yml yaml ps1 psm1 psd1 bat cmd sh py tf toml sql`

  To compare or hash a text file, use its UTF-8 bytes.
- **File names** can't contain `\ / : * ? " < > |`, start with a space, end with a space or dot, or be longer than 120 characters.
- **A program's `name` is also its desktop shortcut's file name**, so it can't contain those characters either: PortD turns `/` into `_` ("Encoder _ Decoder").

**Windows, focus and running code**

- **A nested `<iframe>` inside a program runs on the same thread as PortD.** Long-running code, such as a runaway regular expression, freezes all of PortD and can't be stopped from inside. There are no workers, so guard against it beforehand (Regex Tester).
- **After a PortD dialog (Open, Save) closes, the keyboard stays with PortD.** The browser's own undo doesn't see text a program replaced during that time, so keep your own undo if it matters (Regex Tester).
- **A program can't stop its window from closing.** Save as you go.
- **PortD's "can open these file types" notice** stays until the user presses a button on it, and can cover a program's top-right corner.
- **`navigator.clipboard` is blocked** by the permissions policy. `Host.copy` uses `document.execCommand('copy')`.

## Building

```
npm install           # once: installs Playwright
npm run build         # packs every app
node <app-id>/build.js
```

`build/pack.js` stops with a message if any of these fail:

- **Manifest:** the id, version, file types and paths, and that the entry page and icon exist.
- **Size limits:** as in the package format above.
- **host.js:** the copy is identical to `build/lib/host.js`.
- **Forbidden code in `.js` and `.html` lines:**
  - `type=module`, `import(`
  - `fetch(`, `XMLHttpRequest`, `new Worker`
  - `alert(`, `confirm(`, `prompt(`
  - `<form`
  - network addresses (`www.w3.org` namespaces are allowed)

  A line that really needs one, such as a link shown as text, can carry the comment `pack-ok`.

Text files (html, htm, css, js, json, md, txt, svg, csv, tsv, xml) are packed as text and everything else as data URLs. Old `.portdapp` files in the app folder are removed.

## Testing

```
npm test                         # packs and tests every app
node build/test-all.js sudoku    # just one or a few
node <app-id>/test.js            # run one app's test directly (build it first)
```

Each `test.js` does the following:

1. Copies `build/portd-1.0.0.html` to a temporary folder and opens it from `file://` in a fresh browser profile.
2. Installs the built package through **Settings > Programs > Install a program…**, using the real file chooser.
3. Uses the program with real mouse, keyboard and touch input.
4. Reads PortD's drive through `window.PortDHost`.
5. Checks, where they apply: saved data after a full PortD reload, opening by double-click in Files, single-instance behaviour, and the program on its own outside PortD.
6. Requires no console errors.

**Browser:** set by `BROWSER`, else Edge, else Chrome, else Playwright's Chromium. `PORTD` points at a different PortD build, and `STACKS=1` adds stack traces to page errors.

Tests print `ok` / `FAIL` per check and end with `N checks: N passed, 0 failed`. Only say something was tested if a test ran it, and say which browser and system it ran on.

## Conventions

- **Plain language for users:** in the UI and the READMEs, short sentences and no jargon. Every app README has these sections:
  - purpose
  - install
  - opening files
  - features
  - keys
  - where its data is kept (`P:\User\Config\<id>\`, and that the PortD backup includes it)
  - limits
  - changelog
- **Small and dependency-free.** Hand-written HTML, CSS and JS; no frameworks, bundlers or CDNs. Each app's shared code is a few classic scripts on one `window.<App>` object.
- **Themes:** follow `prefers-color-scheme` by default, plus a button that cycles auto → light → dark, saved in `settings.json`. Dark styles hang off `:root[data-theme="dark"]`.
- **Keyboard:** everything works from the keyboard, with a visible `:focus-visible` ring.
  - Dialogs keep Tab inside them, close with Esc, and give focus back where it was.
  - Give labels to icon buttons and anything a screen reader would otherwise read as a picture.
- **Touch:** react to `pointerdown` / `click`, not mouse-only events. Targets should be large enough to tap.
- **Destructive actions:** anything that throws away work or data needs a second click (within about 3 seconds) or an in-app confirmation.
- **Saving:** save as you go, because the window can be closed at any moment. Keep files in the data folder small and in readable JSON.
- **Versions:**
  - New apps start at 1.0.0.
  - Bump the version for any change you release, and add a changelog entry to the app README.
- **Tests:** each app keeps a test hook on `window.__<short>` (for example `__sc`) so tests can set up states. Don't use it in program code.
- **Git:** the default branch is `master`. Use one commit per app or per change, with a clear message (`starlight-cafe: …`). Commit the rebuilt `.portdapp` and `test-results.txt` with the source change.

## Before you commit

- [ ] `npm test` passes for every app you touched, and their `test-results.txt` files are updated.
- [ ] The `.portdapp` was rebuilt from the committed source, with the version in `app.json` matching the file name.
- [ ] The app README, and the table in the root README, are updated (features, keys, changelog).
- [ ] `src/js/host.js` is identical to `build/lib/host.js`.
- [ ] Light and dark were checked, as well as keyboard-only use.
- [ ] No new network, module, worker or dialog code, and no secrets.

## What not to do

- **No network.** Don't fetch, link to remote scripts, styles, fonts or images, add analytics, or "check for updates".
- **No ES modules, `import()` or workers.** They don't run in PortD.
- **No secrets, tokens, personal data or internal URLs** in the repository, the packages or the tests.
- **Don't change an app's `id`.** It would orphan users' saved data.
- **Don't change a save format without reading the old one.** Saved data must keep loading after an update.
- **Don't edit a `.portdapp` by hand.** Change `src/` and rebuild.
- **Don't edit `build/portd-1.0.0.html`.** It is the released PortD that the tests run against.
- **Don't add `alert`, `confirm`, `prompt` or `<form>`.** Don't rely on the clipboard API, downloads or popups.

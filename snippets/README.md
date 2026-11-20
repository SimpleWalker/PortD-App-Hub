# Snippets

A searchable library of text you reuse: PowerShell, KQL and Graph queries, email replies, anything. Find a snippet in a moment and copy it with one click.

Version 1.0.0 · for PortD 1.0 · file: `snippets-1.0.0.portdapp`

## Installing it in PortD

1. Download `snippets-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **Snippets** icon on the desktop, and the program is listed in the PortD menu.

## Opening files

Snippets keeps its library for you, so normally there is nothing to open. Files come in only through **Import…**, or by opening a library file that Snippets exported.

- To open an exported library from **Files**, right-click it and choose **Open with ▸ Snippets**. Snippets then asks whether to add the snippets to yours or replace yours.
- Snippets opens in one window only. Opening a library file while it is open brings that window to the front with the question.
- Only files made with **Export…** can be imported. Any other `.json` file is refused with a short message.
- PortD shows a note after installing: *"Snippets can open .json files"*. You don't need **Set as default** unless you want every `.json` to open in Snippets. JSON Viewer or Notepad are better for other JSON files.

## What it does

- **Your library.** Each snippet has a title, optional tags, an optional language label (such as *PowerShell*), and the text itself, shown in a monospace font.
- **Copy.** Press **Copy**, double-click a snippet in the list, or press Enter in the list. The exact text goes on the clipboard and a short notice confirms it. Snippets also remembers when you last used each one.
- **Search.** Type in **Search** to find snippets by title, tag, language or text. Case doesn't matter. Several words must all appear, in any order. Matching words are marked, and the list shows the first line of text that matches.
- **Tags and sorting.** Pick a tag in the list under the search box, or click a tag on a snippet, to see only those snippets. Sort **By title** or by **Last used**.
- **Pin.** Pinned snippets (★) always stay at the top of the list.
- **New, Edit and Duplicate.** **New** adds a snippet and opens it for editing. Separate tags with commas; a `#` in front is fine. Changes are saved as you type, with no Save button to forget. Press **Done** or Esc when finished. **Duplicate** makes a copy to change.
- **Delete.** Press **Delete**, then press it again within 3 seconds to confirm.
- **Import and Export.**
  - **Export…** saves the whole library as one `.json` file through PortD's Save dialog, for a backup or to share.
  - **Import…** reads such a file and asks how to bring it in:
    - **Add to my library** adds the new snippets and skips any you already have with the same title and text.
    - **Replace my library** swaps your library for the file's. It asks for a second click first, and warns you to export first.
- **Examples.** A new library starts with five harmless examples to show you around. Delete them whenever you like.
- **Light and dark.** The half-circle button switches between following your system, always light and always dark.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| Ctrl+F | Search; Esc clears the search |
| Up / Down, Home / End, Page Up / Page Down | Move through the list |
| Enter (in the list), Ctrl+Enter | Copy the chosen snippet |
| Alt+N | New snippet |
| F2 | Edit the chosen snippet |
| Esc (while editing) | Finish editing |
| Tab (in the text) | Type a tab; press Ctrl+M first to move on instead |
| Ctrl+D | Duplicate |
| P (in the list) | Pin or unpin |
| Delete (in the list) | Delete: press it twice |
| F1 | Show the shortcuts |

New is Alt+N rather than Ctrl+N, because Edge keeps Ctrl+N for a new browser window.

## Where it keeps its data

`P:\User\Config\snippets\`:

- `library.json`: your snippets, as readable JSON.
- `settings.json`: your sort order, tag filter and light/dark choice.

Your PortD backup (**Settings > Data > Download backup**) includes this folder. Uninstalling keeps it, so reinstalling brings your library back.

If `library.json` is ever damaged so it can't be read, Snippets doesn't overwrite it. It keeps a copy named `library-unreadable-<number>.json`, tells you so, and starts an empty library.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. Your library and settings are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Snippets.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. Your library is then kept in the browser, and Import and Export use the browser's own file picker and downloads.

## Known limits

- Copying uses the browser's older copy command, because PortD doesn't give programs the clipboard permission. If that is blocked too, a box opens with the text selected for Ctrl+C.
- There are no placeholders to fill in. A snippet is copied exactly as written.
- Replacing the library can't be undone, which is why it asks twice. Export first if you may want your old snippets back.
- Import skips a snippet only when both its title and text match one you have. A changed copy of the same snippet is added beside the old one.
- It's made for a personal library: up to 5,000 snippets, each up to 200,000 characters.

## Changelog

**1.0.0** (November 2026): first release.

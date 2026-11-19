# JSON Viewer

Explore JSON files as a tree. You can search keys and values, copy any value or its path, see the raw text, and find out exactly where a broken file goes wrong.

Version 1.0.0 · for PortD 1.0 · file: `json-viewer-1.0.0.portdapp`

## Installing it in PortD

1. Download `json-viewer-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **JSON Viewer** icon on the desktop, and the program is listed in the PortD menu.

## Opening files

- Double-click the **JSON Viewer** icon, then press **Open…** (or Ctrl+O) and choose a `.json` file.
- Press **Paste…** to look at JSON text you have copied from somewhere else.
- Or drop a file from your computer onto the JSON Viewer window.

**Making it the program for .json files.** Just after installing, PortD shows a note: *"JSON Viewer can open .json files"*. Press **Set as default**, and double-clicking a `.json` file then opens it here. You can also choose it later in **Settings > Programs > Default apps**, or for one file with right-click **Open with ▸ JSON Viewer**. Until you choose, `.json` files keep opening in Notepad.

Each file opens in its own window.

## What it does

- **Tree.** Objects and arrays open and close with the small arrows, a double-click, or the arrow keys. Keys keep the order they have in the file. Text values are shown in quotes, numbers in blue, and `true`, `false` and `null` in bold. A closed item shows how many keys or items it holds.
- **Opened as you go.** Only what you open is laid out, and only the rows on screen are drawn, so large files stay quick. An array or object with more than 100 entries opens as groups of 100 (`[0 … 99]`, `[100 … 199]`, …).
- **Expand all / Collapse all.** On a very large file, Expand all stops after the first 50,000 values and says so.
- **Search with paths.** Type in **Search** to find text in keys and values. Case doesn't matter. The list on the right shows every match with its path, such as `$.books[2].title`. Click a match, or use Enter / F3 and Shift+Enter / Shift+F3, to step through them. Each one is opened and highlighted in the tree.
- **Copying.** Right-click an item, or press Shift+F10, for these choices:
  - **Copy value:** text values without their quotes; objects and arrays as neatly indented JSON.
  - **Copy path:** for example `$.store["opening hours"].mon`.
  - **Copy JSON Pointer:** the standard pointer form, for example `/store/opening hours/mon`.
  - **Copy key.**
  - **Expand all below** and **Collapse all below**.

  The path of the current item is always shown in the status bar.
- **Raw text.** **Raw** shows the file's text with line numbers, either **As in the file** or **Formatted** (re-indented). **Copy all** copies it.
- **Errors shown where they are.** If a file isn't valid JSON, you get the line, the column and a plain explanation, for example *"Line 3, column 20: There is a comma after the last item: remove it."*. The nearby lines are shown with a marker under the spot. **Show it in the raw text** takes you to that exact character. It recognises the common mistakes: trailing commas, missing commas, single quotes, keys without quotes, comments, unclosed strings or brackets, and two values in one file.
- **Things JSON allows but programs trip over.** A number too long for most programs to hold exactly (such as a 20-digit ID) is shown exactly as written and marked *too large to be exact in most programs*. A key that appears twice in the same object is shown both times, marked *duplicate*, with a note at the top.
- **Light and dark.** The half-circle button switches between following your system, always light and always dark.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| Ctrl+O | Open a file |
| Ctrl+F | Search keys and values |
| Enter or F3 / Shift+Enter or Shift+F3 | Next / previous match |
| Esc (in the search box) | Clear the search |
| Up / Down | Move through the tree |
| Right | Open an item; if it's open, go to its first child |
| Left | Close an item; if it's closed, go to its parent |
| Enter, Space | Open or close an item |
| * | Open everything below the item |
| Home / End, Page Up / Page Down | First / last item, a page at a time |
| Ctrl+C | Copy the item's value |
| Ctrl+Shift+C | Copy the item's path |
| Shift+F10 or the Menu key | More copy choices |
| R | Raw text (Esc goes back to the tree) |
| F1 | Show the list of shortcuts |

Ctrl+F6 still moves between the PortD desktop, the taskbar and this window.

## Where it keeps its data

JSON Viewer only keeps your light/dark choice, in:

`P:\User\Config\json-viewer\settings.json`

It never changes your files: it can only read the files you open with it. Your PortD backup (**Settings > Data > Download backup**) includes this folder. Uninstalling keeps the folder, so reinstalling brings your setting back.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. Your setting, shortcut and default apps are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to JSON Viewer.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. **Open…** then uses the browser's file picker, and the theme choice is kept in the browser.

## Known limits

- It's a viewer: you can't edit values or save the file. To change a file, use Notepad (right-click **Open with ▸ Notepad**).
- It reads strict JSON. JSON with comments (JSONC), JSON5 and "JSON Lines" files (one value per line) are reported as errors, with the place shown.
- The whole file is read into memory. A 12 MB file with 1.4 million values opened in about a second and a quarter in testing. Much larger files will be slow, and PortD limits a file to 64 MB.
- Search finds plain text, not patterns. It lists the first 5,000 matches, and steps through the first 5,000 with the arrows.
- Copying uses the browser's older copy command, because PortD doesn't give programs the clipboard permission. If that is blocked too, a box opens with the text selected for Ctrl+C.
- A file is read when you open it. Open it again to see later changes.

## Changelog

**1.0.0** (November 2026): first release as an installable PortD 1.0 program (package format 3). Built from the feature list of the 0.5.0 prototype's built-in JSON Viewer; the prototype's source was not available.

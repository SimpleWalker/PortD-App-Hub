# Zip Viewer

Look inside zip files without unpacking them. Browse the folders, preview text and pictures, and extract the files you need. Word, Excel and PowerPoint files (`.docx`, `.xlsx`, `.pptx`) and Java `.jar` files are zip files too, so you can look inside those as well.

Version 1.0.0 · for PortD 1.0 · file: `zip-viewer-1.0.0.portdapp`

Tested with PortD 1.0.0 (earliest) and 1.1.0 (latest).

## Installing it in PortD

1. Download `zip-viewer-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **Zip Viewer** icon on the desktop, and the program is listed in the PortD menu.

## Opening files

Zip Viewer opens `.zip`, `.docx`, `.xlsx`, `.pptx` and `.jar` files. Put the file on your PortD drive first, for example by dragging it in from your computer.

- In **Files**, right-click the archive and choose **Open with ▸ Zip Viewer**. To make double-clicking a `.zip` open Zip Viewer, press **Set as default** in the note PortD shows after installing.
- In Zip Viewer, use **Open…** (Ctrl+O).

Each archive opens in its own window. Zip Viewer only reads archives: it never changes or creates them.

## What it does

- **The folder tree.** Every file and folder in the archive, with its size, its packed (compressed) size and when it was last changed. Folders show the total of what's inside. Small archives open their first level of folders; click ▸ or press → to open one. The line at the top gives the archive's name, how many files and folders it holds, the total and packed sizes, and the archive's comment if it has one.
- **Details and preview.** Choose a file to see its size, packed size and how much smaller it is, the compression method, the date, and its CRC-32 checksum. Then:
  - **Text** (`.txt`, `.json`, `.xml`, `.csv`, scripts and many more) shows its text, up to the first 1 MB.
  - **Pictures** (PNG, JPEG, GIF, WebP, BMP, ICO, SVG, AVIF) are shown, up to 16 MB.
  - **Anything else** shows its first 256 bytes in hex.

  Zip Viewer checks the checksum, and tells you if the file is damaged inside the archive.
- **Search.** **Search names** (Ctrl+F) finds files anywhere in the archive by part of their name, with the match marked.
- **Ticking.** Tick files with the box at the start of each row, or with Space. Ticking a folder ticks everything in it; a dash means only some of it is ticked. Ctrl+A ticks everything, and pressing it again unticks all.
- **Saving one file.** **Save file…** (Ctrl+S, or double-click or Enter on a file) opens PortD's Save dialog, so you choose where it goes.
- **Extracting several files.** **Extract ticked…**, **Extract all…**, or **Extract this folder…** on a folder, offers two ways:
  - **All at once** puts them into Zip Viewer's own folder, `P:\User\Config\zip-viewer\Extracted\<archive name>\`, keeping the folders inside. If that folder already exists, a new one is made, such as `<archive name> (2)`, so nothing is overwritten. At the end you get the path, with a button to copy it. From there, move the files where you want with **Files**.
  - **One by one** opens a Save dialog for each file, so you choose where each goes. This works for up to 30 files at a time. Cancelling one stops the rest.

  A summary lists anything that couldn't be extracted, and why.
- **Text stays text.** Extracted text files (`.txt`, `.csv`, `.json`, `.ps1`…) become text files that Notepad can open. Other files are saved byte for byte.
- **Light and dark.** The half-circle button switches between following your system, always light and always dark.

### Keeping you safe

- **Names that try to escape.** A name such as `../../evil.txt`, `/etc/passwd` or `C:\Windows\x.txt` would put a file outside the folder you extract to. Zip Viewer makes such names safe (`evil.txt`, `etc/passwd`, `Windows/x.txt`), marks them with ⚠, warns you at the top, and tells you again after extracting.
- **Characters PortD doesn't allow** in a name (`: * ? " < > |`) are replaced with `_`.
- **Size limits.**
  - A file that would be over 64 MB unpacked (PortD's largest file) is refused.
  - A file that keeps growing past the size the archive claims is stopped straight away. Such files are damaged, or made to fill up memory (a "zip bomb").
  - Previews read at most 1 MB of text or 16 MB of picture.
- **Files it can't open are explained:**
  - entries protected by a password
  - compression other than stored and deflate (for example BZIP2, LZMA or Deflate64)
  - damaged data, archives that are cut short, and parts of split archives

  They are marked ⛔ and can't be saved, and **Extract all** skips them and lists them.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| Ctrl+O | Open an archive |
| ↑ ↓, Home / End, Page Up / Page Down | Move through the rows |
| → | Open a folder, or go into it |
| ← | Close a folder, or go to the folder above |
| Space | Tick or untick (a folder ticks everything in it) |
| Ctrl+A | Tick everything, or untick all |
| Enter | Open or close a folder; save a file |
| Ctrl+S | Save the chosen file |
| Ctrl+F | Search names; Esc clears the search |
| Esc | Close a dialog, or stop extracting |

## Where it keeps its data

`P:\User\Config\zip-viewer\`:

- `settings.json`: your light/dark choice.
- `Extracted\`: what you extracted with **All at once**. Move the files from here to where you want them with **Files**, and delete what you don't need, because it uses space in your PortD drive.

Your PortD backup (**Settings > Data > Download backup**) includes this folder, extracted files too. Uninstalling keeps it.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Zip Viewer. The `Extracted` folder stays until you delete it.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. **Open…** then uses the browser's file picker, and saving downloads the file. **All at once** isn't available there.

## Known limits

- **No "extract to a folder of your choice".** PortD lets a program write only to its own folder, or to the single file you pick in a Save dialog; it has no folder picker. So several files go either all at once into Zip Viewer's folder, or one by one through Save dialogs. If a later version of PortD adds a way to choose a folder, Zip Viewer can be updated to use it.
- **Only stored and deflate compression**, which almost every zip uses. Password-protected entries and other methods (BZIP2, LZMA, Deflate64, Zstandard, XZ, AES) can't be opened.
- **Whole archives only.** Split archives (`.z01`, `.z02`…) can't be read.
- **Sizes:**
  - An archive can be as big as PortD allows a file to be (64 MB), and so can each file in it.
  - **One by one** handles up to 30 files at a time.
- **Old names.** Names in old archives without the Unicode flag are read as UTF-8 if they are valid UTF-8, otherwise as the old DOS character set (code page 437). An archive made with another code page, such as Japanese, may show some names wrongly; the files themselves are unaffected.
- **Read-only:** it can't make, change or add to archives.

## Changelog

**1.0.0** (November 2026): first release.

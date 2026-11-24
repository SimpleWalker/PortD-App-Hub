# Table Viewer

View CSV and TSV files as a table. You can sort, filter, copy rows and save a copy.

Version 1.0.0 · for PortD 1.0 · file: `table-viewer-1.0.0.portdapp`

Tested with PortD 1.0.0 (earliest) and 1.1.0 (latest).

## Installing it in PortD

1. Download `table-viewer-1.0.0.portdapp` to your computer.
2. Open PortD, then open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop the file onto the PortD desktop and choose **Install…**.

After installing you get a **Table Viewer** icon on the desktop, and the program is listed in the PortD menu.

## Opening files

- Double-click the **Table Viewer** icon, then press **Open…** (or Ctrl+O) and choose a file.
- Or drop a file from your computer onto the Table Viewer window.

Table Viewer reads `.csv` and `.tsv` files. The Open box also lists `.txt` files, for tables saved with that ending.

**Making it the program for .csv and .tsv files.** Just after installing, PortD shows a note: *"Table Viewer can open .csv and .tsv files"*. Press **Set as default**, and from then on double-clicking a `.csv` or `.tsv` file opens it in Table Viewer. You can also do this later in **Settings > Programs > Default apps**. To open a single file with it, right-click the file and choose **Open with ▸ Table Viewer**. Until you choose, nothing changes: those files keep opening in Notepad.

Each file opens in its own window, so you can have several tables open side by side.

## What it does

- **Finds the separator for you.** It works out whether the file uses commas, semicolons, tabs or `|`. The status bar at the bottom shows which one it found. If it guessed wrong, pick the right one from **Delimiter**.
- **Header row.** The first row is used for the column names. Untick **Header row** if your file has no names, and the columns become *Column 1*, *Column 2*, and so on.
- **Quoted values.** Values in "double quotes" can contain commas, line breaks and quotes (written as `""`), as in files saved by Excel.
- **Warnings about broken rows.** If some rows have more or fewer values than the header, a yellow bar names those rows and they are marked in the row-number column. Missing values show as empty cells, and extra values go into extra columns. **Show only these rows** lists just the broken ones. If a quote is never closed, the bar names the line where it starts.
- **Sorting.** Click a column heading to sort A to Z (or smallest first). Click again for Z to A, and a third time to go back to the file's own order. Number columns sort as numbers, so 9 comes before 10, and `1,234` and `12%` count as numbers. Empty cells always go last.
- **Filtering.** Type in **Filter rows** to show only the rows that contain that text, in any column or in one column you choose. Case doesn't matter.
- **Large files.** Only the rows you can see are drawn, so files with hundreds of thousands of rows stay quick.
- **Seeing a whole value.** Long values are cut short with "…". Rest the pointer on a cell to see all of it, or move to the cell with the arrow keys and read it in the status bar. Drag the right edge of a column heading to make the column wider.
- **Copy as TSV.** Copies the selected rows (or every row shown, if none are selected) with the header, separated by tabs. You can paste the result straight into Excel.
- **Save as.** Saves a copy as CSV (comma or semicolon) or TSV. You choose whether to save all rows or only the ones the filter shows. Either way the rows are saved in the order you sorted them. Your original file isn't changed unless you choose to save over it, and PortD asks before replacing a file.
- **Light and dark.** The half-circle button switches between following your system's setting, always light and always dark.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| Ctrl+O | Open a file |
| Ctrl+S | Save as |
| Ctrl+F | Go to the filter box |
| Esc | Clear the selection, then the filter. In a box, close it |
| Arrow keys | Move around the table |
| Page Up / Page Down | Move a screen at a time |
| Home / End | First or last column |
| Ctrl+Home / Ctrl+End | First or last row |
| Shift+Up / Shift+Down, Shift+click | Select several rows |
| Ctrl+click, Space | Add a row to the selection or take it out |
| Ctrl+A | Select every row shown |
| Ctrl+C | Copy the selected rows (or all shown rows) as TSV |
| S | Sort by the current column: up, down, off |
| F1 | Show the list of shortcuts |

Ctrl+F6 still moves between the PortD desktop, the taskbar and this window, as everywhere in PortD.

## Where it keeps its data

Table Viewer only keeps one setting, your choice of light or dark, in:

`P:\User\Config\table-viewer\settings.json`

Your tables stay where they are. Table Viewer can only read and write the files you open or save with it.

**Backing up:** your PortD backup (**Settings > Data > Download backup**) includes this folder and all your files. If you uninstall Table Viewer, its settings folder is kept, so reinstalling it brings your theme choice back.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. PortD shows *Update Table Viewer 1.0.0 → 1.x.x?*. Your settings, desktop shortcut and default apps are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Table Viewer.

## Outside PortD

You can also open `index.html` from the `src` folder straight in Edge or Chrome. **Open…** then uses the browser's own file picker, **Save as** downloads the file, and the theme choice is kept in the browser.

## Known limits

- It shows tables and saves copies, but you can't edit cells.
- It reads UTF-8 text, which is what Excel's "CSV UTF-8" and most programs write. Files saved in an older Windows encoding (ANSI) show accented letters wrongly.
- Copying uses the browser's older copy command, because PortD doesn't give programs the clipboard permission. If even that is blocked, a box opens with the text selected, so you can press Ctrl+C yourself.
- The whole file is read into memory. Files up to a few tens of MB are fine. PortD itself limits a file to 64 MB.
- A file is read when you open it. If the file changes on the drive later, open it again to see the changes.
- Sorting is by one column at a time.

## Changelog

**1.0.0** (November 2026): first release as an installable PortD 1.0 program (package format 3).

# Compare

See what changed between two files or two pieces of text, line by line and word by word. You can copy or save the differences as a standard unified diff.

Version 1.0.0 · for PortD 1.0 · file: `compare-1.0.0.portdapp`

## Installing it in PortD

1. Download `compare-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **Compare** icon on the desktop, and the program is listed in the PortD menu.

## Putting in the two texts

Double-click the **Compare** icon. The **Texts** tab has a left and a right side. For each side you can:

- press **Open…** to pick a file from your PortD drive (any text file: `.txt`, `.csv`, `.json`, `.ps1`, `.md` and so on);
- paste or type text into the box;
- drop a file from your computer onto it.

Press **Compare** (or Ctrl+Enter). When you open a file into each side, Compare runs by itself.

**Starting from Files.** Compare doesn't take over any file type. To compare two files you are looking at in Files:

1. Right-click the first file and choose **Open with ▸ Choose another program… ▸ Compare**. It goes on the left.
2. Do the same with the second file. It goes on the right of the same window, and the two are compared.

Opening a third file this way moves the right-hand file to the left and puts the new one on the right. Leave *Always use this* unticked, unless you want Compare to open that type of file every time.

## Reading the differences

- **Side by side.** The left text is on the left and the right text on the right, with line numbers. Removed lines are red, added lines green, and a hatched space stands in for a line that exists on only one side. Inside a changed line, the words that changed are marked more strongly. A line that changed almost completely is marked as a whole.
- **Unified.** One column, with `−` for removed lines and `+` for added ones, and both line numbers. This is how diffs usually look in emails and code reviews.
- **Unchanged stretches are folded.** Normally 3 unchanged lines are shown around each change, and the rest are folded into a bar: *⋯ 24 unchanged lines*. Press **Show** to open one fold, or choose **10 lines around changes** or **All lines**.
- **Moving between changes.** **Next** and **Previous**, or F7 and Shift+F7, jump from change to change. They go round from the last change back to the first.
- **The summary** at the top counts the changes and the lines removed and added.

## Options

- **White space:** *Spaces count* (exact), *Ignore space changes* (more or fewer spaces, or tabs instead of spaces, count as the same) or *Ignore all spaces*.
- **Ignore case:** `Pears` and `pears` count as the same.
- **Show changed words:** switch off the word marking inside changed lines.

Compare tells you when it ignores something. It also notes when the two files use different line endings (Windows or Unix); those don't count as a difference. A file whose last line has no line break *is* counted as different, because tools such as Git count it too.

## The unified diff

- **Copy unified diff** (Ctrl+Shift+C) copies the differences in the standard unified diff format, with 3 lines of context.
- **Save diff…** (Ctrl+S) saves the same text as a `.diff` or `.patch` file. The suggested name is *left vs right.diff*.

Other tools (Git, patch, code review sites) can read this format.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| Ctrl+Enter | Compare |
| Ctrl+O | Open a file for the left side, or the right side if the left has text |
| F7 / Shift+F7 | Next / previous change |
| Ctrl+Shift+C | Copy the unified diff |
| Ctrl+S | Save the unified diff |
| Esc | Back to the Texts tab |
| F1 | Help |

Ctrl+F6 still moves between the PortD desktop, the taskbar and this window.

## Where it keeps its data

Compare only keeps your settings (theme, layout and options) in:

`P:\User\Config\compare\settings.json`

It never changes the files you compare: it only reads them. Your PortD backup (**Settings > Data > Download backup**) includes this folder. Uninstalling keeps it.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. Your settings and shortcut are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Compare.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. **Open…** then uses the browser's file picker, **Save diff…** downloads the file, and settings are kept in the browser.

## Known limits

- It compares text. Word documents, spreadsheets, pictures and other binary files can't be compared, and you get a warning if a file looks binary.
- Edits you make in the text boxes are used for comparing, but they are never saved back to the files.
- Two very different texts (more than 3,000 separate changes in one stretch) are shown with the differing middle part as one block, rather than lined up line by line. A note says when this happens.
- Lines are compared exactly as written. Moved blocks of text show as removed in one place and added in another.
- 20,000 lines with 200 changes took under a second in testing. Very large files will be slower, and PortD limits a file to 64 MB.
- Only one Compare window is open at a time, so that files opened with it can join the same comparison.

## Changelog

**1.0.0** (November 2026): first release as an installable PortD 1.0 program (package format 3). Built from the feature list of the 0.5.0 prototype's built-in Compare; the prototype's source was not available.

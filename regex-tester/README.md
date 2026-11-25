# Regex Tester

Try a regular expression (a search pattern) on your own text. You see every match highlighted as you type, with its groups, and can try a replacement. A cheat sheet is built in.

Version 1.0.0 · for PortD 1.0 · file: `regex-tester-1.0.0.portdapp`

Tested with PortD 1.0.0 (earliest) and 1.1.0 (latest).

## Installing it in PortD

1. Download `regex-tester-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **Regex Tester** icon on the desktop, and the program is listed in the PortD menu.

## Opening files

Regex Tester can use a `.txt` or `.log` file as the test text.

- **Open…** (Ctrl+O) uses PortD's Open dialog.
- In **Files**, right-click a file and choose **Open with ▸ Regex Tester**. Each file opened this way gets its own window.
- PortD shows a note after installing: *"Regex Tester can open .txt and .log files"*. Nothing changes unless you press **Set as default**. Notepad stays the default for `.txt`, which is usually what you want.

Opening a file replaces the test text. Press Ctrl+Z in the text straight away to get the earlier text back. Regex Tester never changes your files.

## What it does

- **Pattern and flags.** Type the pattern between the slashes. The buttons turn the flags on and off:
  - **g** finds all matches.
  - **i** ignores upper and lower case.
  - **m** makes `^` and `$` work on each line.
  - **s** lets `.` match line breaks.
  - **u** is for Unicode.
  - **y** is sticky.

  The pattern uses JavaScript's rules, the same as Edge.
- **Live highlighting.** Matches are marked in the test text as you type, in two alternating colours so neighbours stand apart. Empty matches, such as `\b`, show as thin red lines.
- **Matches.** The list shows each match's position (counted from 0), length and text, and every group: numbered ones (`$1`, `$2`…) and named ones (`year ($1)`). A group that took no part says so. Click a match, or move with the arrow keys, to see it in the text; double-click or press Enter to put the cursor there.
- **Replace.** Type a replacement and see the result straight away:
  - `$1` gives a group's text, and `$<name>` gives a named group's text.
  - `$&` gives the whole match.
  - `` $` `` and `$'` give the text before and after the match.
  - `$$` gives a dollar sign.

  **Copy result** copies it all. Without **g** only the first match is replaced.
- **Mistakes.** A pattern with a mistake gives a short message, such as *"This pattern has a mistake: Unterminated group."*, and the box is underlined. Nothing breaks.
- **Cheat sheet.** The third panel lists the common pieces of a pattern, with examples.
- **Saved patterns.**
  - **Save pattern…** (Ctrl+S) keeps the pattern with its flags, replacement and test text (up to 100,000 characters) under a name. Saving under a name already in use asks first.
  - **Saved patterns…** (Alt+P) lists them to **Load** or **Delete**. Delete asks for a second click.
- **Your last session** (pattern, flags, text, replacement and open panel) is kept as you type and comes back next time.
- **Light and dark.** The half-circle button switches between following your system, always light and always dark.

### Keeping PortD responsive

Some patterns can take an extremely long time on text that almost matches, for example `(a+)+$` on a long run of `a`s. In a browser nothing can stop such a pattern once it starts, and it would freeze PortD itself, not just this window. Regex Tester guards against this in three ways:

1. **Risky shapes aren't run as you type.** A repeated group that holds another repeat (`(a+)+`, `(\w*)*`, `(a{1,3}){2,40}`), or repeated choices that can match the same text (`(a|aa)+`, `(\w|\d)*`), gets a warning instead. Press **Run** (Ctrl+Enter) if you want to try it anyway. A risky pattern left from last time is not run when the program starts either.
2. **Long runs stop.** Matching stops after half a second and says so, keeping what it found. Only the first 1,000 matches are listed and highlighted, but all of them are counted.
3. **Live turns itself off if a run is slow.** If one run takes more than 0.2 seconds, Live switches off and Regex Tester says so. Press **Run** after each change, or click **Live** to turn it back on.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| Ctrl+Enter, or Enter in the pattern box | Run now |
| Ctrl+O | Open a text or log file |
| Ctrl+S | Save the pattern |
| Alt+P | Saved patterns |
| Alt+1, Alt+2, Alt+3 | Matches, Replace, Cheat sheet |
| F1 | Cheat sheet |
| ← → (on the panel tabs) | Move between the panels |
| Up / Down, Home / End (in Matches) | Move through the matches |
| Enter (in Matches) | Put the cursor on the match in the text |
| Ctrl+Z (in the text) | After Open or Load: bring back the earlier text |
| Esc | Close a dialog |

The flag buttons, Live and Run are ordinary buttons: Tab to them and press Space.

## Where it keeps its data

`P:\User\Config\regex-tester\`:

- `session.json`: your last pattern, flags, test text (up to 1 MB), replacement and panel.
- `saved.json`: your saved patterns.
- `settings.json`: Live on or off, and your light/dark choice.

Your PortD backup (**Settings > Data > Download backup**) includes this folder. Uninstalling keeps it, so reinstalling brings everything back.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. Your saved patterns and settings are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Regex Tester.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. Your session and saved patterns are then kept in the browser, and **Open…** uses the browser's file picker.

## Known limits

- **A pattern that slips past the warning can still freeze PortD.** The warning catches the well-known shapes, but not every slow pattern. If it happens, Edge offers to wait or to close the page, and closing PortD's tab loses nothing that PortD has already saved. Regex Tester won't run that pattern again by itself when you reopen it. The session is saved half a second after you stop typing, so a pattern that froze while you typed is never kept, and one you ran with **Run** stays waiting for Run.
- **The warning is cautious.** A few safe patterns are flagged too, such as `(?:\r?\n|\r)+`. Press Run for those.
- **Size limits:**
  - The test text can be up to 5 MB.
  - Only texts up to 1 MB are kept for next time, and saved patterns keep up to 100,000 characters of text.
  - Only the first 1,000 matches are listed and highlighted.
- **The text box doesn't wrap long lines.** It scrolls sideways, so the highlights stay lined up with the text.
- **Only JavaScript's rules.** Some features of other tools (PowerShell, .NET, PCRE) differ: there are no possessive quantifiers or atomic groups, and `$0` doesn't mean the whole match (use `$&`). Most everyday patterns work the same.
- **Ctrl+Z after Open or Load** brings back the earlier text only until you change the new text.
- **Copying uses the browser's older copy command**, because PortD doesn't give programs the clipboard permission. If that is blocked too, a box opens with the text selected for Ctrl+C.

## Changelog

**1.0.0** (November 2026): first release.

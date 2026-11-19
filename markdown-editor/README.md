# Markdown Editor

Write Markdown documents with a live preview beside them. You can add pictures from your PortD drive and save the result as a web page.

Version 1.0.0 · for PortD 1.0 · file: `markdown-editor-1.0.0.portdapp`

## Installing it in PortD

1. Download `markdown-editor-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **Markdown Editor** icon on the desktop, and the program is listed in the PortD menu.

## Opening files

- Double-click the **Markdown Editor** icon to start a new document, or press **Open…** (Ctrl+O) to open one.
- Or drop a `.md` file from your computer onto the window.

It opens `.md` and `.markdown` files. The Open box also lists `.txt` files.

**Making it the program for Markdown files.** Just after installing, PortD shows a note: *"Markdown Editor can open .md and .markdown files"*. Press **Set as default**, and double-clicking a Markdown file then opens it here. You can also choose it later in **Settings > Programs > Default apps**, or for one file with right-click **Open with ▸ Markdown Editor**. Until you choose, these files keep opening in Notepad.

Each file opens in its own window.

## What it does

- **Three views.** **Source** shows just the text, **Preview** just the finished page, and **Split** both side by side, with the preview following as you scroll. Ctrl+Shift+E switches between them. The editor remembers your choice.
- **Formatting toolbar.** Bold, italic, strikethrough, heading (each press goes # → ## → ### → none), code, bulleted, numbered and check lists, quote, link, picture, table, code block and a dividing line. Press a button again to take the formatting off. Ctrl+Z undoes.
- **Lists that keep going.** Press Enter at the end of a list item to start the next one (numbers count up). Press Enter on an empty item to end the list. Tab and Shift+Tab indent and outdent an item.
- **Pictures from your drive.** **Picture…** opens PortD's Open box so you can choose a picture, usually from `Pictures`. The editor adds it with a path relative to the document, such as `![cat](../Pictures/cat.png)`, and shows it in the preview. You can also paste a picture (Ctrl+V) or drop one from your computer: the editor asks where on the drive to save it, then adds it.
- **Safe links.** In the preview, only web (`http`, `https`) and email (`mailto`) links can be followed, and they open in a new browser tab. `#heading` links jump within the document. Anything else, such as a `javascript:` link, is shown struck through and can't be clicked. A link to a file on the drive explains that you open it from Files.
- **HTML is never run.** HTML written in the text, such as `<script>` or `<img onerror=…>`, is shown as plain text in the preview and in exported pages.
- **Export as HTML…** saves the document as a single web page. Your pictures are included in the file, so it works on its own and can be emailed or opened anywhere.
- **Markdown it understands:** headings (`#` and underlined), **bold**, *italic*, ~~strikethrough~~, `code`, code blocks, quotes, bulleted, numbered and check lists, tables with column alignment, links (including `[text][ref]` references and plain web addresses), pictures, and dividing lines.
- **Line endings are kept.** A file that used Windows line endings is saved with them.
- **Light and dark.** The half-circle button switches between following your system, always light and always dark.

## Saving, and not losing work

- **Save** (Ctrl+S) writes back to the file you opened. A new document asks where to save it, and suggests a name taken from its first heading. **Save as…** (Ctrl+Shift+S) saves a copy under a new name.
- An unsaved document shows a `*` in its title and **Unsaved changes** in the status bar. **New** and **Open** ask before you lose changes: **Save**, **Don't save** or **Cancel**.
- **Closing the window does not ask.** PortD doesn't let a program stop its window closing. Instead the editor keeps a copy of unsaved changes in its data folder as you type. When you next open the file, or start the editor, a yellow bar offers **Recover** or **Discard**. If you recover a file you didn't reopen in that window, **Save** asks where to save it.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| Ctrl+O | Open |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save as |
| Ctrl+B / Ctrl+I | Bold / italic |
| Ctrl+K | Link |
| Ctrl+E | Code |
| Ctrl+Shift+H | Heading level: # → ## → ### → none |
| Ctrl+Shift+7 / 8 / 9 | Numbered list / bulleted list / checklist |
| Enter in a list | Next item; on an empty item, end the list |
| Tab / Shift+Tab in a list | Indent / outdent the item |
| Esc, then Tab | Leave the text box (elsewhere Tab moves on as usual) |
| Ctrl+Shift+E | Switch view: Source → Split → Preview |
| F1 | Help and shortcuts |

Ctrl+F6 still moves between the PortD desktop, the taskbar and this window. **New** has no shortcut, because the browser keeps Ctrl+N for itself.

## Where it keeps its data

Everything is in `P:\User\Config\markdown-editor\`:

- `settings.json`: your light/dark choice and your view.
- `drafts\`: unsaved changes, kept until you save, recover or discard them.
- `pictures\`: copies of the pictures you have shown the editor. PortD lets a program read only the files you choose for it, so the editor keeps its own copy to show the picture again next time and to put it in exported pages.

Your documents stay wherever you saved them. Your PortD backup (**Settings > Data > Download backup**) includes all of this. Uninstalling the editor keeps the folder.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. Your settings, drafts, pictures, shortcut and default apps are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Markdown Editor.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. **Open…** uses the browser's file picker, **Save** downloads the file, and drafts and settings are kept in the browser. Pictures from the PortD drive can't be shown there. A picture you paste or drop is put into the text itself.

## Known limits

- **Pictures in a document opened for the first time.** A picture the editor hasn't seen before shows as a box with **Show picture…**. Press it and choose the picture once, and it shows from then on.
- **Changed pictures.** If you later change a picture file on the drive, the editor keeps showing the copy it kept. Press **Picture…** and choose it again to refresh it.
- **Web pictures** (`https://…`) can't be shown, because PortD programs have no network.
- **Links to other files** on the drive can't be opened from the preview.
- **Markdown coverage.** It covers everyday Markdown and the common GitHub extras. Rare corners of the CommonMark rules (complicated nesting of emphasis, HTML blocks, footnotes, maths) are not supported.
- **Focus after a PortD dialog.** After a PortD Open or Save box closes, click back into the text before typing.
- **Spelling check** uses the browser's own checker, if it is turned on.

## Changelog

**1.0.0** (November 2026): first release as an installable PortD 1.0 program (package format 3). Built from the feature list of the 0.5.0 prototype's built-in Markdown Editor; the prototype's source was not available.

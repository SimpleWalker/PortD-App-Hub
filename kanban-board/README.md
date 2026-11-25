# Kanban Board

Keep track of work on boards of columns and cards. Cards can have due dates, colour labels, notes and checklists. Move them by dragging, from the keyboard, or with a menu.

Version 1.0.0 · for PortD 1.0 · file: `kanban-board-1.0.0.portdapp`

Tested with PortD 1.0.0 (earliest) and 1.1.0 (latest).

## Installing it in PortD

1. Download `kanban-board-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **Kanban Board** icon on the desktop, and the program is listed in the PortD menu.

## Opening files

Kanban Board keeps your boards for you, so normally there is nothing to open. Files come in only as boards exported with **Board ▾ › Export board…**.

- To open one, use **Board ▾ › Import board…**, or right-click the file in **Files** and choose **Open with ▸ Kanban Board**.
- Kanban Board asks before adding it as a **new** board. It never changes your other boards. If the name is taken, it becomes, for example, *My board (2)*.
- Kanban Board opens in one window only, so two windows can't overwrite each other's changes. Opening a board file while it is open brings that window to the front with the question.
- Only files made with **Export board** can be opened. Any other `.json` file is refused with a short message.
- PortD shows a note after installing: *"Kanban Board can open .json files"*. You don't need **Set as default** unless you want every `.json` to open here.

## What it does

- **Boards.** Choose a board in the list at the top left. **Board ▾** has **New board…**, **Rename board…**, **Export board…**, **Import board…** and **Delete board…**. Delete asks first, naming the board and how many cards it holds. A new board starts with **To do**, **Doing** and **Done**. Your first board has four example cards; archive them when you are done.
- **Columns.** **+ Column** (or **+ Add column** at the end) adds one. Each column's **⋯** menu can **Rename**, **Move left**, **Move right** or **Delete** it; double-clicking a name renames it too. Deleting a column asks first, and its cards go to the archive, not away. The number by a column's name is how many cards it holds.
- **Cards.** **+ Add card** at the bottom of a column asks for a title. Click a card, or press Enter, to open it. Everything is saved as you type:
  - its title and notes
  - a colour label (red, orange, yellow, green, blue or purple)
  - a due date
  - a checklist: add items with Enter, tick them, and remove them with ×

  On the board a card shows its label as a coloured edge, its due date, its checklist progress (☑ 1/3) and ≡ if it has notes. Overdue dates are red with ⚠, and today's are amber.
- **Moving cards.**
  - **Drag** a card with the mouse, a pen or a finger. A line shows where it will land, and Esc cancels.
  - **From the keyboard:** see the keys below.
  - **The ⋯ menu** on a card has **Move to** each other column, **Move to top**, **Move to bottom** and **Archive**.
  - **In the card**, the **Move to** list moves it straight away.
- **Search and filters.** **Search cards** finds words in titles, notes and checklist items. The two lists filter by label and by due date (**Overdue**, **Due today**, **Due within a week**, **No due date**). A yellow bar says how many cards are showing; **Show all** clears every filter.
- **Archive instead of delete.** **Archive** on a card (or Delete on the keyboard) moves it to the board's archive. **Archive** at the top lists them, with where each came from:
  - **Restore** puts it back in that column, or the first column if it's gone.
  - **Delete forever** asks for a second click.
- **Light and dark.** The half-circle button switches between following your system, always light and always dark.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| Tab | Move between columns, cards and buttons |
| ↑ ↓ | The card above or below |
| ← → | The card in the next column |
| Ctrl+↑, Ctrl+↓ | Move the card up or down in its column |
| Ctrl+←, Ctrl+→ | Move the card to the next column |
| Enter or Space | Open the card |
| M, Shift+F10 or the Menu key | The card's menu (Move to, top, bottom, Archive) |
| Delete | Archive the card |
| Alt+N | New card (in the column you are in) |
| Ctrl+F | Search |
| Alt+A | Archived cards |
| F1 | Show the shortcuts |
| Esc | Close a dialog or menu, or stop a drag |

After a move, the keyboard stays on the card, and screen readers hear where it went, for example *"Moved Write the report to Doing, position 1 of 3"*.

## Where it keeps its data

`P:\User\Config\kanban-board\`:

- `boards.json`: the list of your boards.
- `boards\<id>.json`: one file per board, with its columns, cards and archive. Each board is saved on its own, less than half a second after each change.
- `settings.json`: which board is open, and your light/dark choice.

Your PortD backup (**Settings > Data > Download backup**) includes this folder. Uninstalling keeps it, so reinstalling brings your boards back. **Export board…** gives you a single file to keep, move or share.

If a board's file is ever damaged so it can't be read, Kanban Board doesn't overwrite it. It keeps a copy named `<id>-unreadable-<number>.json`, tells you so, and starts that board empty.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. Your boards and settings are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Kanban Board.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. Your boards are then kept in the browser, and Import and Export use the browser's own file picker and downloads.

## Known limits

- **On a touch screen, a finger on a card drags it.** To scroll a long column or the board by touch, drag on empty space or a scroll bar. The **⋯** menu and the card's **Move to** list work by tapping too.
- **One window.** Kanban Board opens in one window only, so two copies can't overwrite each other's changes.
- **Deleting a board can't be undone**, which is why it asks first. Export it first if you may want it back. Deleting a card forever (from the archive) can't be undone either.
- **No sharing or syncing.** Each board lives in your PortD drive; others see it only if you export it and send them the file.
- **Sizes:** up to 50 columns per board and 2,000 cards per column. Card titles can be up to 300 characters, notes up to 20,000 and checklists up to 200 items.

## Changelog

**1.0.0** (November 2026): first release.

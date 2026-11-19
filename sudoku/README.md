# Sudoku 🔢

Sudoku with four difficulties, pencil notes, hints and undo. Your game is saved as you play.

Version 1.0.0 · for PortD 1.0 · file: `sudoku-1.0.0.portdapp`

## Installing it in PortD

1. Download `sudoku-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **Sudoku** icon on the desktop, and the game is listed in the PortD menu.

## How to play

Double-click the **Sudoku** icon. Fill the grid so that every row, every column and every 3×3 box holds the numbers 1 to 9 once each.

- **Click a cell, then a number** on the pad below the grid, or type it.
- The cell's row, column and box are shaded, and every cell with the same number is highlighted.
- **Auto-check** (on by default) shows wrong numbers in red and counts your mistakes. Turn it off to play without help.
- **✎ Notes** (or N) switches to pencil marks: numbers you type are pencilled into the corner of the cell. When you place a number, it is removed from the notes of the cells around it.
- **💡 Hint** (or H) fills in the selected cell with the right number, or a random wrong or empty cell if none is selected.
- **↶ Undo** (Ctrl+Z) and **⌫ Erase** (Delete).
- The small number on each pad button shows how many of that number are still to place.
- **⏸ Pause** (Space) hides the grid and stops the clock. Click the grid to carry on.

## Difficulties

| Difficulty | Numbers given |
|---|---|
| Easy | 40 |
| Medium | 32 |
| Hard | about 27 |
| Expert | about 24 |

Every puzzle has exactly one solution. Because numbers are taken out in mirror-image pairs, a puzzle sometimes has one fewer than the table says. Changing the difficulty starts a new puzzle straight away, unless you are in the middle of one: then it waits for **New game**.

## Saving, and statistics

- Your game in progress is saved as you play. Close the window, or even PortD, and it carries on where you left off next time (*"Resumed your last game"*).
- **New game** during a game asks you to click it again within three seconds, so you don't lose a puzzle by accident.
- **⋯** (or F1) shows, for each difficulty, how many games you have played and won and your best time, plus a short help. **Reset stats** clears them after a second click.
- When you solve a puzzle, PortD shows a notice with your time.

## Light and dark

The game follows your system's light or dark setting, as before. The half-circle button lets you choose always light or always dark instead.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| 1 – 9 | Enter a number (or a note, in notes mode) |
| Arrow keys | Move (they wrap round at the edges) |
| Delete, Backspace, 0 | Erase |
| N | Notes mode on / off |
| H | Hint |
| Ctrl+Z | Undo |
| Space | Pause / continue |
| F1 | Statistics and help |
| Esc | Close the statistics |

Ctrl+F6 still moves between the PortD desktop, the taskbar and this window.

## Where it keeps its data

`P:\User\Config\sudoku\`:

- `game.json`: the game in progress.
- `stats.json`: games played and won, and best times.
- `settings.json`: your theme.

Your PortD backup (**Settings > Data > Download backup**) includes this folder. Uninstalling keeps it.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. Your game, statistics and settings are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Sudoku.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. Your game and statistics are then kept in the browser.

## Known limits

- Difficulty is set by how many numbers are given, not by the solving techniques a puzzle needs, so two puzzles at the same level can feel different.

## Changelog

**1.0.0** (November 2026): first release for PortD 1.0 (package format 3).
- Four difficulties, pencil notes, hints, undo and statistics; your game is saved as you play.
- Light and dark following the system, with a theme button.
- Screen reader labels for every cell and button; F1 and Esc for the statistics box; Reset stats asks for a second click.
- Your game is also kept when it runs outside PortD.

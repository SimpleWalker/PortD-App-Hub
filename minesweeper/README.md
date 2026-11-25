# Minesweeper 💣

The classic mine-clearing puzzle. It has three levels plus a custom size, and keeps your best times.

Version 1.0.0 · for PortD 1.0 · file: `minesweeper-1.0.0.portdapp`

Tested with PortD 1.0.0 (earliest) and 1.1.0 (latest).

## Installing it in PortD

1. Download `minesweeper-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **Minesweeper** icon on the desktop, and the game is listed in the PortD menu.

## How to play

Double-click the **Minesweeper** icon. Reveal every square that isn't a mine. A number shows how many mines touch that square.

- **Left-click** reveals a square. Your first click is always safe and opens an area.
- **Right-click** puts a 🚩 flag, right-click again for a ❓ question mark, and once more to clear it. The counter on the left shows mines minus flags.
- **Click a number** whose flags are all placed to reveal all its other neighbours at once.
- **The face**, or **F2**, starts a new game. It shows 😮 while you press, 😵 when you lose and 😎 when you win.
- **On a touch screen**, tap to reveal and **long-press** to flag, or switch on **🚩 Flag mode** so that taps place flags.
- **With the keyboard**: the arrow keys move a highlighted square, **Space** or **Enter** reveals it (on a number, it reveals the neighbours), and **F** flags it. Home and End go to the start and end of the row.

## Levels

| Level | Size | Mines |
|---|---|---|
| Beginner | 9 × 9 | 10 |
| Intermediate | 16 × 16 | 40 |
| Expert | 30 × 16 | 99 |
| Custom… | 5 to 40 wide, 5 to 30 high | 1 up to one less than the number of squares |

The board grows and shrinks to fit the window: make the window bigger for larger squares.

## Best times

**Best times** shows your fastest win on each of the three levels, with the date (custom games aren't timed for records). When you beat a record, PortD shows a notice. To clear the records, press **Reset** and then **Click again to reset** within three seconds.

## Light and dark

The game follows your system's light or dark setting. The half-circle button lets you choose instead: following the system, always light, or always dark.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| Arrow keys | Move the highlighted square |
| Space, Enter | Reveal it (on a number: reveal its neighbours) |
| F | Flag / question mark / clear |
| Home / End | Start / end of the row |
| F2 | New game |
| F1 | How to play |
| Esc | Close a box |

Ctrl+F6 still moves between the PortD desktop, the taskbar and this window.

## Where it keeps its data

`P:\User\Config\minesweeper\`:

- `settings.json`: the level, the last custom size and your theme.
- `best.json`: your best times.

Your PortD backup (**Settings > Data > Download backup**) includes this folder. Uninstalling keeps it, so reinstalling brings your records back.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. Your records and settings are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Minesweeper.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome to play. Your level, theme and records are then kept in the browser.

## Known limits

- There's no pause: the clock runs until you win or lose.
- A game in progress isn't saved. Closing the window ends it.

## Changelog

**1.0.0** (November 2026): first release for PortD 1.0 (package format 3).
- Three levels and a custom size, best times, and playing from the keyboard.
- Light and dark colours following the system, with a theme button.
- Screen reader labels for every square; dialogs that keep the keyboard inside them and close with Esc; Reset asks for a second click.
- Settings and records are also kept when the game runs outside PortD.

# Solitaire 🃏

Klondike solitaire: draw 1 or draw 3, drag or tap to move, undo, and statistics.

Version 1.0.0 · for PortD 1.0 · file: `solitaire-1.0.0.portdapp`

## Installing it in PortD

1. Download `solitaire-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **Solitaire** icon on the desktop, and the game is listed in the PortD menu. The old 0.x package doesn't install in PortD 1.0, so use this one.

## How to play

Double-click the **Solitaire** icon. The goal is to build each of the four **foundations** (top right) up by suit, from Ace to King.

- In the seven **columns**, stack cards downwards in alternating colours, for example a red 6 on a black 7. You can move a whole run of face-up cards together. Only a King can go into an empty column.
- **Click the stock** (top left), or press **Space**, to turn cards onto the waste: one at a time in **Draw 1**, three in **Draw 3**. When the stock runs out, click it again to turn the waste back over.
- **Drag** a card, or a run of cards, onto another pile; the card it would land on is outlined. Or just **click / tap** a card to send it to the best place (a foundation if it can go there, otherwise a column).
- **↶ Undo** (Ctrl+Z) takes back a move, as many times as you like.
- When every card is face up and the stock is empty, **Auto-finish** appears and puts all the cards on the foundations for you.
- **New game** (F2) during a game asks you to click it again within three seconds.

**Draw 1 / Draw 3** is remembered, and a change applies from the next game.

## Scoring (Windows standard)

| | Points |
|---|---|
| A card to a foundation | +10 |
| A card from the waste to a column | +5 |
| Turning up a card in a column | +5 |
| A card from a foundation back to a column | −15 |
| Turning the waste over: Draw 1 | −100 each time |
| Turning the waste over: Draw 3 | −20 from the third time |
| Winning in 30 seconds or more | + 700,000 ÷ seconds taken |

The clock starts with your first move.

## Playing from the keyboard

New in this version. Click the table or Tab to it, then:

| Keys | What they do |
|---|---|
| Arrow keys | Move between the piles. In a column, Up and Down pick which face-up card (Up from the top card goes to the row above) |
| Enter | Play the card under the cursor as if you clicked it, or turn the stock |
| M | Pick up the card (and those on top of it); move to another pile and press M or Enter to put them down |
| Esc | Put back what you picked up |
| A | Auto-finish, when it is offered |
| Space | Turn the stock |
| Ctrl+Z | Undo |
| F2 | New game |
| F1 | Statistics and help |

A screen reader announces the card under the cursor and each move. Ctrl+F6 still moves between the PortD desktop, the taskbar and this window.

## Statistics

**⋯** (or F1) shows games played and won (with the win rate), the current and best winning streaks, and the best time and score for Draw 1 and for Draw 3. **Reset stats** clears them after a second click. When you win, PortD shows a notice with your time and score, and the cards bounce off the table (not if your system asks for reduced motion).

## Light and dark

The table follows your system's light or dark setting: the dark version has a deeper green felt and softer cards. The half-circle button lets you choose always light or always dark instead.

## Where it keeps its data

`P:\User\Config\solitaire\`:

- `game.json`: the game in progress. Close the window and it carries on next time (*"Resumed your last game"*).
- `stats.json`: your statistics.
- `settings.json`: Draw 1 or 3, and your theme.

Your PortD backup (**Settings > Data > Download backup**) includes this folder. Uninstalling keeps it.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. Your game, statistics and settings are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Solitaire.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. Your game and statistics are then kept in the browser (0.x saved nothing outside PortD).

## Known limits

- Undo history lasts while the window is open. A resumed game starts with an empty history.
- Not every deal can be won.
- Games and statistics from the 0.x prototype can't be carried over, because PortD 1.0 doesn't open 0.x data.

## Changelog

**1.0.0** (November 2026): the live 0.x game, ported to PortD 1.0 (package format 3). The version number is unchanged.
- The rules, scoring, statistics and every 0.x feature are the same. The saved files have the same names and contents (`settings.json` also holds the theme).
- Now a folder of files (page, stylesheet, scripts) instead of a single file.
- Added in the port: playing from the keyboard with screen reader announcements; a dark felt following the system, with a theme button; Reset stats asks for a second click; F1 and Esc for the statistics box; no win animation when reduced motion is asked for; saving outside PortD.
- Space turns the stock unless a button has the keyboard, so Space can press that button as usual.
- PortD's notice now reads *"Solitaire: won in 3:12 with 1234 points"* instead of naming the game twice.

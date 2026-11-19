# Starlight Café 🌙

A cute idle gacha game: tap the moon for stars, wish for café friends, level them up and fill your album.

Version 1.0.0 · for PortD 1.0 · file: `starlight-cafe-1.0.0.portdapp`

## Installing it in PortD

1. Download `starlight-cafe-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **Starlight Café** icon on the desktop, and the game is listed in the PortD menu.

Starlight Café opens in one window only: starting it again brings that window to the front. It doesn't open any files.

## How to play

The game has four tabs along the bottom.

- **☕ Café:** tap the moon for stars. Your friends earn stars every second too, even while the game is closed. Each friend card has **Level up** (one level) and **Max** (as many levels as you can afford). Click a portrait to see that friend's details.
- **🌟 Wish:** spend gems on wishes for new friends. **Wish ×1** costs 💎 100 and **Wish ×10** costs 💎 1000. The cards turn over by themselves; **Reveal all** turns them all at once, and **OK** closes.
- **📖 Album:** every friend, with the ones you haven't met yet shown as shadows. Click a friend you've met for their details.
- **🎁 Quests:** the daily gift (💎 150 once a day), the gem shop (💎 25 for stars, a little dearer each time), milestones to claim, and your stats.

A dot on **Wish** means you can afford a wish. A dot on **Quests** means there is something to claim.

### The rules

- **Stars per second:** R friends earn 1, SR earn 6 and SSR earn 35, times their level.
- **Duplicates:** wishing for a friend you already have raises their bond, worth +25% stars each, up to 10. After that, a duplicate turns into gems.
- **Wish chances:** SSR 3%, SR 17%, R 80%.
  - A ×10 wish always includes at least one SR or better.
  - An SSR is guaranteed by your 60th wish; the Wish tab counts down.
  - Half of all SSR wishes give the featured friend, Aurora.
- **While you're away:** you earn half your normal income, for up to 8 hours. *"Welcome back!"* tells you how much.

When you meet an SSR friend, PortD shows a notice, for example *"Starlight Café: ✨ Aurora joined your café!"*.

**Start over** (at the bottom of Quests) erases your café. Click it once, then again within 3 seconds to confirm.

## Keyboard

New in this version.

| Keys | What they do |
|---|---|
| 1, 2, 3, 4 | Café, Wish, Album, Quests |
| ← → (on the tab bar) | Move between the tabs; Home and End go to the first and last |
| Tab, Shift+Tab | Move between buttons |
| Space or Enter | Tap the focused moon, or press the focused button. Holding the key down counts as one tap |
| Enter on a portrait or album card | Show that friend's details |
| Esc | Close the wish results or the details |

When the results or details are open, Tab stays inside them. When they close, the keyboard goes back to where you were. Screen readers read each result card (for example *"Mochi, R, bond 1"*) and the messages at the bottom.

Ctrl+F6 still moves between the PortD desktop, the taskbar and this window.

## Light and dark

The game follows your system's light or dark setting. The dark version is a night sky with the same friends. The half-circle button at the top right lets you choose always light or always dark instead.

## Where it keeps its data

`P:\User\Config\starlight-cafe\`:

- `save.json`: your café. The game saves every 5 seconds, after each wish and when the window is hidden.
- `settings.json`: your theme.

Your PortD backup (**Settings > Data > Download backup**) includes this folder. Uninstalling keeps it.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. Your café and settings are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Starlight Café.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. Your café is then kept in the browser.

## Known limits

- Stars earned while away stop counting after 8 hours.
- Wishes are random, so two players will see different friends; the 60-wish guarantee is the only promise.

## Changelog

**1.0.0** (November 2026): first release for PortD 1.0 (package format 3).

- 13 café friends in three rarities, wishes with a 60-wish guarantee, levels, bonds, milestones, a daily gift and a gem shop.
- Keyboard use: 1 to 4 for tabs, arrow keys on the tab bar, Space or Enter on the moon, and Esc to close.
- Labels for screen readers.
- Light and dark following the system, with a theme button.

# Freeze Test 🧊

A test tool. It makes itself stop responding, for 15 seconds or for good, so that you can see what PortD does with a frozen program and practise getting out of it.

Version 1.0.0 · for PortD 1.0 · file: `freeze-test-1.0.0.portdapp`

Tested with PortD 1.0.0 (earliest) and 1.1.0 (latest).

## Installing it in PortD

1. Download `freeze-test-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen.

After installing you get a **Freeze Test** icon on the desktop, and it is listed in the PortD menu.

## Opening files

Freeze Test doesn't open files.

## What it does

- **A clock** shows that the program is answering. It stops while the program is frozen.
- **Freeze for 15 seconds, then recover** freezes the program for 15 seconds. Then it answers again by itself and says when it recovered.
- **Freeze for good** freezes it until its window is closed. Because this also freezes your other open programs, it asks for a second click within 3 seconds.

What you will see:

- **Other programs stop too.** Edge and Chrome run all PortD programs together, apart from PortD itself. So while this one is frozen, the others are frozen as well. PortD and its built-in apps, such as Notepad and Files, keep working.
- **PortD 1.1 and later** mark frozen programs after about 6 seconds: their title bars turn red with *(Not responding)*, and a red bar at the top offers **Close all programs**. After the 15-second freeze, the red goes away by itself.
- **PortD 1.0** shows nothing. Close this window with its × button. If other programs stay frozen, close them too: they recover once all program windows are closed.

## Light and dark

The colours follow your system's light or dark setting. The button at the top right cycles through *follow the system*, *always light* and *always dark*.

## Keyboard

There are no special keys. Tab moves between the buttons and Enter or Space presses them.

## Where it keeps its data

`P:\User\Config\freeze-test\settings.json` holds your theme choice, and nothing else. Your PortD backup (**Settings > Data > Download backup**) includes this folder.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Freeze Test.

## Outside PortD

You can open `src/index.html` straight in Edge or Chrome, but freezing it there freezes that browser tab. Close the tab to end it.

## Known limits

- Anything unsaved in your other open programs is lost if you close them to recover. Save your work before trying **Freeze for good**.

## Changelog

**1.0.0** (November 2026): first release (package format 3).
- Freeze for 15 seconds, then recover; freeze for good, after a second click.
- A clock that shows when the program answers.
- Light and dark colours following the system, with a theme button.

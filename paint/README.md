# Paint

Draw and touch up pictures. Pencil, line, rectangle, ellipse, fill, eraser and eyedropper, with undo, zoom, and saving as PNG or JPG. Works with a mouse, a pen (harder presses draw thicker lines), touch and the keyboard. Paint keeps a working copy as you go, so a picture you haven't saved is still there next time.

Version 1.0.0 · for PortD 1.0 · file: `paint-1.0.0.portdapp`

## Installing it in PortD

1. Download `paint-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **Paint** icon on the desktop, and the program is listed in the PortD menu.

## Opening pictures

Paint opens `.png`, `.jpg`, `.jpeg` and `.gif` files. Put the picture on your PortD drive first, for example by dragging it in from your computer.

- In **Files**, right-click the picture and choose **Open with ▸ Paint**. To make double-clicking open Paint, press **Set as default** in the note PortD shows after installing.
- In Paint, use **Open…** (Ctrl+O).

Paint uses one window. Opening another picture replaces the one you have; if it has unsaved changes, Paint asks first.

## What it does

- **Tools.** The tools are in the bar on the left:
  - **Pencil** (B): draws freehand. Sizes 1 and 2 give crisp pixels; bigger sizes draw round strokes.
  - **Line** (L).
  - **Rectangle** (R) and **Ellipse** (O): outlines, or solid shapes when **Filled** is ticked.
  - **Fill** (F): fills an area of one colour, including colours that are very close.
  - **Eraser** (E): rubs out to white, or to see-through on a picture with transparency.
  - **Eyedropper** (I): picks up a colour from the picture, then goes back to the tool you had.
  - **Hand** (H): moves around the picture.

  Hold **Shift** while drawing to keep lines straight (flat, upright or at 45°) and to make squares and circles.
- **Two colours.** The left mouse button draws in the main colour, the right button in the second colour. Click a palette colour to make it the main colour; right-click it (or Shift+click) for the second colour. Click either colour square to choose any colour, and press ⇄ or X to swap the two.
- **Brush size** 1 to 64, with the slider or `[` and `]`. With a pen, pressing harder draws thicker, up to the size chosen.
- **Undo and redo** the last 50 steps (Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z). Each stroke, shape or fill is one step. Very large pictures may keep fewer steps, to save memory.
- **Clear** wipes the whole picture after you confirm. Undo brings it back.
- **Zoom** from 5% to 800%: the − and + buttons, the list, Ctrl + mouse wheel, `+` and `-`, `1` for 100% and `0` or **Fit** to fit the window. From 200% the pixels show sharp, for detailed work. Move around with the scroll bars, the Hand, Space + drag, or the middle mouse button.
- **New picture** (Alt+N) with a size you choose (common sizes in the list, up to 8192 × 8192) and a white or see-through background.
- **Saving.**
  - **Save** (Ctrl+S) saves back into the picture you opened.
  - For a new picture, or with **Save as…** (Ctrl+Shift+S), choose PNG or JPG, then where it goes in PortD's Save dialog.
  - PNG keeps everything, including see-through areas. JPG makes smaller files for photos, but loses a little detail and has no see-through areas, so those become white.
- **The working copy.** About a second and a half after each change, and when you switch away, Paint keeps a copy of an unsaved picture in its data folder. If you close the window (or PortD) without saving, Paint offers to restore it next time it starts, with a small preview. **Throw it away** asks for a second click. Saving, or starting a new picture, removes the working copy.
- **Light and dark.** The half-circle button switches between following your system, always light and always dark.

### Drawing with the keyboard

Tab to the picture (it shows a focus ring), then:

| Keys | What they do |
|---|---|
| Arrow keys | Show a cross-shaped cursor, and move it one pixel (Shift: 10 pixels) |
| Enter | Put the pen down here; Enter again lifts it. For Line, Rectangle and Ellipse, the first Enter is one corner and the second finishes the shape |
| Shift+Enter | As Enter, but in the second colour |
| Esc | Cancel what you are drawing |

With **Fill** and **Eyedropper**, Enter acts straight away. The position is shown at the bottom right, and screen readers hear "Pen down" and "Done".

The tools are a group: Tab to them, then use the arrow keys. The palette works the same way, with Enter for the main colour and Shift+Enter for the second.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| B, L, R, O, F, E, I, H | Pencil, Line, Rectangle, Ellipse, Fill, Eraser, Eyedropper, Hand |
| `[` `]` | Smaller or bigger brush |
| X | Swap the two colours |
| Ctrl+Z | Undo |
| Ctrl+Y, Ctrl+Shift+Z | Redo |
| `+` `-` | Zoom in or out |
| 1 | 100% |
| 0 | Fit to the window |
| Space + drag | Move around |
| Alt+N | New picture (Ctrl+N belongs to the browser) |
| Ctrl+O | Open |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save as |
| F1 | Help |
| Esc | Cancel a drawing, or close a dialog |

## Where it keeps its data

`P:\User\Config\paint\`:

- `settings.json`: the tool, brush size, Filled, the two colours and your light/dark choice.
- `work.png` and `work.json`: the working copy of an unsaved picture, and its name and size. They are removed when you save or throw the picture away.

Your PortD backup (**Settings > Data > Download backup**) includes this folder. Uninstalling keeps it.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Paint.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. **Open…** then uses the browser's file picker, and saving downloads the file. The working copy is kept in the browser's own storage, if it allows it.

## Limits

- **GIF:** only the first frame opens, and it is saved as PNG (Paint can't write GIF). The original GIF is left as it was.
- **Size:**
  - Pictures can be up to 8192 pixels on each side.
  - A saved picture must also fit within PortD's 64 MB file limit. A big, busy PNG can go over that, in which case Paint says it could not save; JPG is much smaller.
- **Undo** keeps 50 steps, fewer for very large pictures (it stops at about 400 MB).
- **No copy and paste of pictures.** The sandbox PortD runs programs in only allows copying text, so pictures can't go to or come from the clipboard.
- **No layers, selections or text tool** in this version.
- **Keyboard drawing goes to the picture only while it has focus.** After a PortD dialog (Open or Save), click the picture or press Tab to give it focus again; PortD keeps the focus after its own dialogs.

## Changelog

**1.0.0** (November 2026): first release.

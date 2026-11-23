# PortD App Hub

Programs and games for **PortD 1.0**, the portable desktop that lives in one HTML file.

Each program is a single `.portdapp` file. Download it, install it in PortD, and it appears on your desktop. Everything runs inside PortD, with no internet connection and nothing installed on the computer.

## The programs

| | Program | What it does | Opens | Download |
|---|---|---|---|---|
| 📊 | [Table Viewer](table-viewer/) | View CSV and TSV files as a table; sort, filter, copy rows and save a copy | `.csv` `.tsv` | [table-viewer-1.0.0.portdapp](table-viewer/table-viewer-1.0.0.portdapp) |
| `{}` | [JSON Viewer](json-viewer/) | Explore JSON as a tree, search it, copy paths and values; shows where a broken file goes wrong | `.json` | [json-viewer-1.0.0.portdapp](json-viewer/json-viewer-1.0.0.portdapp) |
| 📝 | [Markdown Editor](markdown-editor/) | Write Markdown with a live preview beside it, add pictures, and save it as a web page | `.md` `.markdown` | [markdown-editor-1.0.0.portdapp](markdown-editor/markdown-editor-1.0.0.portdapp) |
| ⇆ | [Compare](compare/) | See what changed between two files or texts, line by line and word by word; save a standard diff | | [compare-1.0.0.portdapp](compare/compare-1.0.0.portdapp) |
| ✂️ | [Snippets](snippets/) | A searchable library of text you reuse: scripts, queries, email replies; copy with one click | `.json` (its own exports) | [snippets-1.0.0.portdapp](snippets/snippets-1.0.0.portdapp) |
| `.*` | [Regex Tester](regex-tester/) | Try a pattern on your own text: live highlighting, groups, replace, a cheat sheet and saved patterns | `.txt` `.log` | [regex-tester-1.0.0.portdapp](regex-tester/regex-tester-1.0.0.portdapp) |
| 🔐 | [Encoder-Decoder](encoder-decoder/) | Base64, URL, hex and HTML entities both ways, a JWT reader, hashes, GUIDs, passwords and passphrases | | [encoder-decoder-1.0.0.portdapp](encoder-decoder/encoder-decoder-1.0.0.portdapp) |
| 💣 | [Minesweeper](minesweeper/) | The classic, with three levels, custom boards, best times and keyboard play | | [minesweeper-1.0.0.portdapp](minesweeper/minesweeper-1.0.0.portdapp) |
| 🔢 | [Sudoku](sudoku/) | Four difficulties, pencil notes, hints and undo; your game is saved as you play | | [sudoku-1.0.0.portdapp](sudoku/sudoku-1.0.0.portdapp) |
| 🃏 | [Solitaire](solitaire/) | Klondike, draw 1 or 3, drag or tap, undo, scoring and statistics | | [solitaire-1.0.0.portdapp](solitaire/solitaire-1.0.0.portdapp) |
| 🌙 | [Starlight Café](starlight-cafe/) | A cute idle game: tap the moon, wish for café friends and fill your album | | [starlight-cafe-1.0.0.portdapp](starlight-cafe/starlight-cafe-1.0.0.portdapp) |

Click a program's name for its own guide: how to use it, its keys, where it keeps its data, and its limits.

## Installing a program

1. Download the program's `.portdapp` file from the [latest release](https://github.com/SimpleWalker/PortD-App-Hub/releases/latest), or from its folder above (on GitHub, use the **Download raw file** button).
2. In PortD, open **Settings** and choose **Programs**.
3. Press **Install a program…** and pick the file.
4. Check what PortD shows you and press **Install**.

The program gets an icon on the desktop and an entry in the PortD menu. If the file is already on your PortD drive, double-clicking it does the same.

To **update**, install the newer file the same way. Your saved data is kept. To **remove** a program, go to **Settings > Programs** and press **Uninstall**.

## Things all of them have in common

- **Your data stays in PortD.** Each program keeps its settings and saves in `P:\User\Config\<program>\`, which is part of your PortD backup (**Settings > Data > Download backup**).
- **No internet.** None of them fetch anything or send anything anywhere.
- **Light and dark.** They follow your system's light or dark setting, and each has a button to choose always light or always dark.
- **Keyboard and touch.** Everything can be done from the keyboard, and they work with a touch screen.
- **Nothing lost by accident.** Anything that throws work away asks for a second click or a confirmation first.
- **They also work on their own.** You can open a program's `src/index.html` straight in Edge or Chrome. It then keeps its data in the browser instead.

## Which PortD

These programs need **PortD 1.0** or later (package format 3). Get PortD from [SimpleWalker/PortD](https://github.com/SimpleWalker/PortD).

## For developers and AI agents

See [AGENTS.md](AGENTS.md) for the package format, the rules a program must follow, and how to build and test.

## Licence

MIT: see [LICENSE](LICENSE). You may use, change and share these programs, keeping the copyright notice.

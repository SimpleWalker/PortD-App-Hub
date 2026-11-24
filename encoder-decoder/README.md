# Encoder-Decoder

A toolbox for everyday encoding jobs:
- Base64, URL, hex and HTML entities, both ways.
- A JWT reader.
- File and text hashes.
- GUIDs, passwords and passphrases.

Everything updates as you type, and nothing you type is kept.

Version 1.0.0 · for PortD 1.0 · file: `encoder-decoder-1.0.0.portdapp`

Tested with PortD 1.0.0 (earliest) and 1.1.0 (latest).

## Installing it in PortD

1. Download `encoder-decoder-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get an **Encoder-Decoder** icon on the desktop, and the program is listed in the PortD menu.

## Opening files

Encoder-Decoder doesn't open files from **Files**. The **Hash** tool has its own **Open file…** button for hashing a file.

## What it does

There are seven tools on tabs. Each converter has the input on the left and the result on the right, updated as you type.

All four converters have:
- **Encode / Decode** to pick the direction.
- **Swap** to turn the result into the input and change direction.
- **Copy** for the result.
- **Clear** for the input. Ctrl+Z in the box brings the text back.

| Tool | What it does |
|---|---|
| **Base64** | Text to Base64 and back. **Base64URL** uses `-` and `_` and no `=` padding, as in web tokens. **Text is UTF-8** works for any language and emoji. **Latin-1** gives one byte per character, like PowerShell's or older tools' "ASCII" Base64. **Lines of 76** breaks the result into lines, as in email. When decoding, spaces, line breaks and missing `=` are fine. Bytes that aren't text are shown one character per byte, with a note giving their hex. |
| **URL** | Percent-encoding. Normally everything special is encoded, as for one part of an address. **Whole address** keeps `: / ? # & =`. When decoding, **+ means space** handles web form data. |
| **Hex** | Text to the hex of its UTF-8 bytes and back, with a choice of separator and upper case. Decoding accepts `0x`, spaces, commas, colons and dashes. |
| **HTML** | `& < > " '` to entities and back. **Also non-ASCII** writes letters like é and emoji as `&#233;`. Decoding understands numbered entities and about 100 common named ones, and lists any it doesn't know. |
| **JWT** | Paste a token, with or without `Bearer `, to see its header and payload as formatted JSON. **It doesn't check the signature**, so it can't tell you a token is genuine. The times (`iat`, `nbf`, `exp`, `auth_time`) are shown in your time and in UTC. Coloured labels say whether the token has expired or isn't valid yet, and which algorithm it uses. Unsigned tokens are flagged. Encrypted tokens (5 parts) are explained rather than read. |
| **Hash** | SHA-1, SHA-256, SHA-384 and SHA-512 of the text you type, or of a file (**Open file…**), each with its own Copy. **MD5** is there too, marked "not secure": use it only to check old checksums. Paste a hash into **Compare** to see which one, if any, it matches; upper or lower case and a label such as `SHA256:` are fine. |
| **Generate** | **GUID**: one or up to 1,000 random version-4 GUIDs, optionally in upper case or `{braces}`. **Password**: 4 to 128 characters from the kinds you choose, with at least one of each, and optionally no look-alikes (`I l 1 O 0 o`). **Passphrase**: 3 to 12 random words from a built-in list of 687, with a separator, capitals and a digit if you like. Each shows an estimate of its strength in bits. Everything comes from the browser's secure random numbers (`crypto.getRandomValues`). |

**Light and dark.** The half-circle button switches between following your system, always light and always dark.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| Alt+1 … Alt+7 | Base64, URL, Hex, HTML, JWT, Hash, Generate |
| ← → (on the tabs) | Move between the tools |
| Alt+S | Swap (converters) |
| Alt+C | Copy the result (on JWT: the payload; on Hash: the SHA-256) |
| Alt+X | Clear the input |
| Ctrl+Z (in the input) | After Clear or Swap: bring the earlier text back |
| Alt+G | Generate new ones (Generate) |

Options are ordinary buttons, check boxes and lists: Tab to them, and use Space or the arrow keys.

## Where it keeps its data

`P:\User\Config\encoder-decoder\settings.json` keeps the open tool, each tool's options and your light/dark choice. Your PortD backup (**Settings > Data > Download backup**) includes this folder.

**Nothing you type or generate is saved:** no text, tokens, hashes or passwords. Closing the window forgets it all. Copy what you need first.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. Your settings are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Encoder-Decoder.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. The settings are then kept in the browser, and **Open file…** uses the browser's file picker.

## Known limits

- **The program is called "Encoder-Decoder"**, not "Encoder / Decoder", because PortD names the desktop shortcut after the program and `/` isn't allowed in a file name.
- **Hashing a text file.** PortD stores text files as text, so a text file is hashed as its UTF-8 bytes. That matches the original file when it was saved as UTF-8 (most are). A file saved in another encoding, or with a byte order mark, can give a different hash than on Windows. Pictures, archives and other non-text files are hashed byte for byte. The tool says which of the two applies.
- **Big files.** Hashing a big file takes a moment, and MD5 is slower than the others.
- **JWT reading only.** It doesn't verify signatures or decrypt encrypted tokens.
- **HTML decoding** knows about 100 common named entities. Rarer names are listed and left as they are; numbered entities always work.
- **Strength estimates** assume the password or passphrase was made here at random. They are no guide to passwords you make up yourself.
- **Copying uses the browser's older copy command**, because PortD doesn't give programs the clipboard permission. If that is blocked too, a box opens with the text selected for Ctrl+C.

## Changelog

**1.0.0** (November 2026): first release.

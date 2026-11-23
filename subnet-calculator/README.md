# Subnet Calculator

Work out IPv4 and IPv6 subnets: network, broadcast, host range, masks and a binary view. You can also split a network into equal subnets, check whether an address is in a list of ranges, and summarise a list of ranges into the fewest blocks.

Version 1.0.0 · for PortD 1.0 · file: `subnet-calculator-1.0.0.portdapp`

## Installing it in PortD

1. Download `subnet-calculator-1.0.0.portdapp` to your computer.
2. In PortD, open **Settings** (on the desktop) and choose the **Programs** tab.
3. Press **Install a program…** and pick the file you downloaded.
4. PortD shows what the program is and where it will go. Press **Install**.

If the `.portdapp` file is already on your PortD drive, double-click it to get the same Install screen. You can also drop it onto the PortD desktop and choose **Install…**.

After installing you get a **Subnet Calculator** icon on the desktop, and the program is listed in the PortD menu.

## Opening files

Subnet Calculator doesn't open files. Type or paste addresses into it, and copy the results out.

## What it does

There are five tools on tabs. Each works things out as you type.

**IPv4.** Type an address with its prefix or mask, in any of these forms:
- `10.1.2.3/22`
- `10.1.2.3 255.255.252.0`
- `10.1.2.3/255.255.252.0`

You get:
- the network, broadcast, first and last host, the number of usable hosts and of all addresses
- the subnet mask, wildcard mask and class
- the type: public, private (RFC 1918), carrier-grade NAT, link-local, loopback, documentation, multicast and so on
- the address as a number

A binary view shows the address, mask, network and broadcast with the network bits highlighted, and a line says where the address sits, for example *"host 515 of this network"*.
- An address with no prefix counts as a single address (/32), and it says so.
- /31 has 2 usable addresses for point-to-point links (RFC 3021) and no broadcast. /32 is a single address.
- **Copy all** (Alt+C) copies every detail as text.

**Split.** Type a network, then choose either:
- **By count:** how many subnets you need. They come in powers of two, so 6 becomes 8, and it tells you so.
- **By prefix:** the new prefix length.

The table lists each subnet with its first and last host, broadcast and usable hosts.
- **Copy as text** gives one CIDR per line.
- **Copy as table** gives tab-separated rows with headings that paste into Excel as a table.

Up to 65,536 subnets can be made. The first 1,024 are shown, and Copy always copies all of them.

**In range?** Type an address and a list of ranges, one per line. Each range can be:
- a CIDR
- an address and mask
- a start–end range such as `10.0.0.1 - 10.0.0.9`
- a single address

Each range is marked ✓ or ✗, and a line says how many ranges the address is in. Lines that can't be read are listed with the reason. Copy gives a plain IN / NOT IN list.

**Summarise.** Paste a list of CIDRs, ranges or addresses, one per line or separated by commas. Text after `#` is ignored. Overlapping and neighbouring ranges are merged into the fewest CIDR blocks: for example, `10.1.0.0/24` and `10.1.1.0/24` become `10.1.0.0/23`. A range that isn't a neat block becomes the exact blocks that cover it. An address like `192.168.1.77/24` counts as its whole network, and it says so.

**IPv6.** Type an address, with or without a /prefix. You get:
- the compressed form (lower case, with the longest run of zero groups as `::`, as RFC 5952 sets out)
- the full expanded form
- the network, first and last address of the prefix, and how many addresses it holds (exactly when that fits, otherwise as a power of two)
- the type: global unicast, unique local, link-local, documentation, multicast, IPv4-mapped and so on

For prefixes up to /64 it also gives how many /64 networks fit inside. A zone such as `%Ethernet 2` is explained and set aside. `::ffff:192.0.2.1` keeps its IPv4 form.

**Mistakes** get a plain message instead of a wrong answer:
- a number over 255
- a leading zero, which some systems read as octal
- a mask with gaps
- a wildcard mask typed by mistake (the message says what the subnet mask would be)
- a prefix over 32 or 128
- `::` used twice, or too many or too few IPv6 groups

**Light and dark.** The half-circle button switches between following your system, always light and always dark.

## Keyboard shortcuts

| Keys | What they do |
|---|---|
| Alt+1 … Alt+5 | IPv4, Split, In range?, Summarise, IPv6 (the cursor goes into the first box) |
| ← → (on the tabs) | Move between the tools |
| Alt+C | Copy the result of the open tool |
| Enter (in an address box) | Work it out now |

Everything else is ordinary boxes and buttons: Tab to them, and press Space or Enter.

## Where it keeps its data

`P:\User\Config\subnet-calculator\settings.json` keeps each tool's last input, the open tool and your light/dark choice, so you carry on where you left off. Your PortD backup (**Settings > Data > Download backup**) includes this folder. Uninstalling keeps it.

## Updating and uninstalling

- **Update:** install a newer `.portdapp` the same way. Your inputs and settings are kept.
- **Uninstall:** **Settings > Programs**, then **Uninstall** next to Subnet Calculator.

## Outside PortD

You can also open `src/index.html` straight in Edge or Chrome. The inputs are then kept in the browser.

## Known limits

- **Split, In range? and Summarise are for IPv4 only.** IPv6 has its own tab for one address and prefix.
- **Split lists up to 65,536 subnets**, and shows the first 1,024 on screen.
- **Address types** come from the main IANA special-purpose lists. A few rare reserved blocks are shown simply as their larger range (for example *Reserved* or *Global unicast*).
- **Classes (A to E)** are shown for interest only: networks today use prefixes (CIDR), not classes.
- **Copying uses the browser's older copy command**, because PortD doesn't give programs the clipboard permission. If that is blocked too, a box opens with the text selected for Ctrl+C.

## Changelog

**1.0.0** (November 2026): first release.

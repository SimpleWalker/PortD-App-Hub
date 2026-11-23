"""Makes the test archives for Zip Viewer's test.js, with Python's own zipfile module (standard library only).
Usage: python3 make-fixtures.py <folder>"""
import os, struct, sys, zipfile, zlib

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
os.chdir(out)

def png(w, h):
    """a small picture: a yellow circle on blue"""
    rows = b''
    for y in range(h):
        row = b'\0'
        for x in range(w):
            inside = (x - w / 2) ** 2 / (w * 0.33) ** 2 + (y - h / 2) ** 2 / (h * 0.38) ** 2 <= 1
            row += bytes((250, 200, 40) if inside else (40, 90, 200))
        rows += row
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')

D, S = zipfile.ZIP_DEFLATED, zipfile.ZIP_STORED
z = zipfile.ZipFile('normal.zip', 'w')
z.writestr('readme.txt', 'Hello zip!\nSecond line.\n', compress_type=D)
z.writestr('docs/', '')
z.writestr('docs/notes.md', '# Notes\n' + 'line\n' * 50, compress_type=D)
z.writestr('docs/deep/data.csv', 'a,b\n1,2\n', compress_type=S)
z.writestr('img/pixel.png', png(1, 1), compress_type=S)
z.writestr('img/sun.png', png(120, 80), compress_type=D)
z.writestr('bin/blob.dat', bytes(range(256)) * 40, compress_type=D)
z.writestr('Zoë – café.txt', 'unicode name', compress_type=D)
z.comment = b'Made for the Zip Viewer test'
z.close()

z = zipfile.ZipFile('unsafe.zip', 'w')
for n in ['../../evil.txt', '/etc/passwd', 'C:/Windows/x.txt', 'ok/bad:name?.txt', 'a\\b\\c.txt']:
    z.writestr(zipfile.ZipInfo(n), 'x')
z.close()

z = zipfile.ZipFile('methods.zip', 'w')
z.writestr('bz.txt', 'bzip2 data ' * 100, compress_type=zipfile.ZIP_BZIP2)
z.writestr('lz.txt', 'lzma data ' * 100, compress_type=zipfile.ZIP_LZMA)
z.writestr('plain.txt', 'fine', compress_type=D)
z.close()

# a "zip bomb": 20 MB of zeros whose list claims 1000 bytes
z = zipfile.ZipFile('bomb.zip', 'w'); z.writestr('zeros.bin', b'\0' * (20 * 1048576), compress_type=D); z.close()
b = bytearray(open('bomb.zip', 'rb').read()); cd = b.rfind(b'PK\x01\x02')
struct.pack_into('<I', b, cd + 24, 1000); struct.pack_into('<I', b, 22, 1000); open('bomb.zip', 'wb').write(b)

z = zipfile.ZipFile('huge.zip', 'w'); z.writestr('big.bin', b'\0' * (70 * 1048576), compress_type=D); z.close()

z = zipfile.ZipFile('enc.zip', 'w'); z.writestr('secret.txt', 'x', compress_type=S); z.close()
b = bytearray(open('enc.zip', 'rb').read()); cd = b.rfind(b'PK\x01\x02'); b[cd + 8] |= 1; b[6] |= 1; open('enc.zip', 'wb').write(b)

z = zipfile.ZipFile('corrupt.zip', 'w'); z.writestr('c.txt', 'hello world ' * 200, compress_type=D); z.close()
b = bytearray(open('corrupt.zip', 'rb').read())
for i in range(40, 60): b[i] ^= 0x5a
open('corrupt.zip', 'wb').write(b)

open('cut.zip', 'wb').write(open('normal.zip', 'rb').read()[:300])

z = zipfile.ZipFile('report.docx', 'w')
z.writestr('[Content_Types].xml', '<Types/>', compress_type=D)
z.writestr('word/document.xml', '<w:document>Hello</w:document>', compress_type=D)
z.close()

# a true ZIP64 archive: the end record points to a ZIP64 end record, and the first entry's sizes and offset
# are 0xffffffff in the central directory with the real values in a ZIP64 extra field
b = bytearray(open('normal.zip', 'rb').read())
e = b.rfind(b'PK\x05\x06')
count, = struct.unpack_from('<H', b, e + 10); size, off = struct.unpack_from('<II', b, e + 12)
cd = off
csize, usize = struct.unpack_from('<II', b, cd + 20); lho, = struct.unpack_from('<I', b, cd + 42)
nl, xl, cl = struct.unpack_from('<HHH', b, cd + 28)
extra = struct.pack('<HHQQQ', 1, 24, usize, csize, lho)
entry = bytearray(b[cd:cd + 46 + nl + xl + cl])
struct.pack_into('<I', entry, 20, 0xffffffff); struct.pack_into('<I', entry, 24, 0xffffffff); struct.pack_into('<I', entry, 42, 0xffffffff)
struct.pack_into('<H', entry, 30, xl + len(extra))
entry = entry[:46 + nl + xl] + extra + entry[46 + nl + xl:]
newcd = bytes(entry) + bytes(b[cd + 46 + nl + xl + cl:e])
body = bytes(b[:cd]) + newcd
z64 = struct.pack('<IQHHIIQQQQ', 0x06064b50, 44, 45, 45, 0, 0, count, count, len(newcd), cd)
loc = struct.pack('<IIQI', 0x07064b50, 0, len(body), 1)
end = struct.pack('<IHHHHIIH', 0x06054b50, 0, 0, 0xffff, 0xffff, 0xffffffff, 0xffffffff, 0)
open('true64.zip', 'wb').write(body + z64 + loc + end)
assert zipfile.ZipFile('true64.zip').read('readme.txt') == b'Hello zip!\nSecond line.\n'

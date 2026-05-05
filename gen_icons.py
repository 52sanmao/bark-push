import struct, zlib, os

def make_png(size, bg, fg):
    cx, cy = size // 2, size // 2
    r = size * 0.4
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            dx, dy = x - cx, y - cy
            d = (dx*dx + dy*dy) ** 0.5
            if d < r:
                dot = d < r * 0.18
                bar = abs(dx) < r * 0.1 and dy < r * 0.1 and dy > -r * 0.6
                w1 = abs(((dx*dx)**0.5 + ((dy+r*0.1)**2)**0.5)**0.5 - r*0.45) < r*0.06 and dx > 0
                w2 = abs(((dx*dx)**0.5 + ((dy+r*0.1)**2)**0.5)**0.5 - r*0.7) < r*0.06 and dx > 0
                if dot or bar or w1 or w2:
                    row.extend(fg + [255])
                else:
                    row.extend(bg + [255])
            else:
                row.extend(bg + [0])
        rows.append(bytes(row))
    raw = b''.join(b'\x00' + r for r in rows)
    def chunk(ct, data):
        c = ct + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')

def png_to_ico(data, size):
    w = 0 if size >= 256 else size
    h = 0 if size >= 256 else size
    return struct.pack('<HHH', 0, 1, 1) + struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, len(data), 22) + data

os.makedirs('src-tauri/icons', exist_ok=True)
icons = {}
for sz in [32, 128, 256]:
    icons[sz] = make_png(sz, [10, 10, 16], [97, 32, 209])
with open('src-tauri/icons/32x32.png', 'wb') as f: f.write(icons[32])
with open('src-tauri/icons/128x128.png', 'wb') as f: f.write(icons[128])
with open('src-tauri/icons/128x128@2x.png', 'wb') as f: f.write(icons[256])
with open('src-tauri/icons/icon.png', 'wb') as f: f.write(icons[256])
with open('src-tauri/icons/icon.ico', 'wb') as f: f.write(png_to_ico(icons[256], 256))
with open('src-tauri/icons/icon.icns', 'wb') as f: f.write(icons[256])
print('Icons done')

"""Draws the Guidecap icon (blue rounded square, white step list, red click ring) as PNGs.
Pure Python, no dependencies. Run: python3 make_icons.py"""
import struct, zlib, math

def png(path, size, pixels):
    raw = b''.join(b'\x00' + bytes(pixels[y*size*4:(y+1)*size*4]) for y in range(size))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def rrect(x, y, x0, y0, x1, y1, r):
    cx, cy = min(max(x, x0 + r), x1 - r), min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

BLUE, WHITE, RED = (37, 99, 235), (255, 255, 255), (229, 72, 77)

def color_at(u, v):  # u, v in 0..1
    if not rrect(u, v, 0.02, 0.02, 0.98, 0.98, 0.22): return None
    c = BLUE
    for i, y in enumerate((0.26, 0.47, 0.68)):          # three "steps": dot + line
        if (u - 0.24) ** 2 + (v - y) ** 2 <= 0.065 ** 2: c = WHITE
        if rrect(u, v, 0.36, y - 0.04, 0.78 if i != 1 else 0.6, y + 0.04, 0.04): c = WHITE
    d = math.hypot(u - 0.72, v - 0.7)                     # click ring
    if 0.1 <= d <= 0.17: c = RED
    return c

for size in (16, 32, 48, 128):
    ss = 4
    px = []
    for y in range(size):
        for x in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    c = color_at((x + (sx + .5) / ss) / size, (y + (sy + .5) / ss) / size)
                    if c:
                        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 1
            n = acc[3]
            px += [acc[0] // n, acc[1] // n, acc[2] // n, 255 * n // (ss * ss)] if n else [0, 0, 0, 0]
    png(f'extension/icons/icon{size}.png', size, px)
print('ok')

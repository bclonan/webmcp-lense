"""Render Lens's existing aperture mark and paper/green palette. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'apps/web/public'
OUT.mkdir(exist_ok=True)
PAPER, INK, GREEN, LIME = '#f6f6f0', '#293c32', '#365b42', '#dfebba'
BLADES = [(14.31, 8, 20.05, 17.94), (9.69, 8, 21.17, 8), (7.38, 12, 13.12, 2.06), (9.69, 16, 3.95, 6.06), (14.31, 16, 2.83, 16), (16.62, 12, 10.88, 21.94)]
def mark(draw, x, y, size, color=GREEN):
    scale = size / 24
    width = max(2, round(scale * 1.5))
    draw.ellipse((x+2*scale, y+2*scale, x+22*scale, y+22*scale), outline=color, width=width)
    for x1, y1, x2, y2 in BLADES:
        draw.line((x+x1*scale, y+y1*scale, x+x2*scale, y+y2*scale), fill=color, width=width)

icon = Image.new('RGB', (512, 512), PAPER)
mark(ImageDraw.Draw(icon), 48, 48, 416)
icon.save(OUT / 'favicon.ico', format='ICO', sizes=[(16,16), (32,32), (48,48), (64,64)])
icon.resize((180, 180), Image.Resampling.LANCZOS).save(OUT / 'apple-touch-icon.png', optimize=True)
for size in [192, 512]:
    icon.resize((size, size), Image.Resampling.LANCZOS).save(OUT / f'icon-{size}.png', optimize=True)
paths = ''.join(f'<path d="M {a} {b} L {c} {d}"/>' for a,b,c,d in BLADES)
(OUT / 'favicon.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="{PAPER}"/><g transform="translate(4 4)" fill="none" stroke="{GREEN}" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/>{paths}</g></svg>\n')

def font(size, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf', size)

og = Image.new('RGB', (1200, 630), PAPER)
draw = ImageDraw.Draw(og)
draw.rounded_rectangle((810, -70, 1250, 690), radius=220, fill=LIME)
draw.rounded_rectangle((838, 114, 1124, 512), radius=24, fill='#fffef9', outline='#c6d0b4', width=2)
mark(draw, 61, 60, 62)
draw.text((138, 58), 'lens.', fill=INK, font=font(52, True))
draw.text((67, 181), 'See. Act. Verify.', fill=INK, font=font(73, True))
draw.text((70, 295), 'One workspace for people and agents.', fill=GREEN, font=font(30))
draw.text((70, 349), 'Structured tools. Visible approvals.', fill=GREEN, font=font(30))
draw.text((70, 524), 'WEBMCP  /  LOCAL FIRST  /  LENS', fill=GREEN, font=font(20, True))
mark(draw, 920, 159, 125)
for y, label in [(318, 'Observe'), (369, 'Review'), (420, 'Verify')]:
    draw.ellipse((867, y+12, 878, y+23), fill=GREEN)
    draw.text((899, y), label, fill=INK, font=font(24))
og.save(OUT / 'og-image.png', optimize=True)
print('Generated real ICO, SVG, Apple icon, manifest icons and 1200 x 630 OG image.')

from PIL import Image, ImageOps, ImageDraw
from pathlib import Path

root = Path('/Users/gimgutae/Downloads/WM-2026-9AF62D-website-character/reference-photos')
files = sorted(root.glob('*.png'))
thumbs = []
for f in files:
    im = Image.open(f).convert('RGB')
    im.thumbnail((500, 380))
    canvas = Image.new('RGB', (520, 430), 'white')
    canvas.paste(im, ((520-im.width)//2, 10))
    ImageDraw.Draw(canvas).text((12, 400), f.name, fill='black')
    thumbs.append(canvas)
sheet = Image.new('RGB', (1040, 1290), (235, 235, 235))
for i, im in enumerate(thumbs):
    sheet.paste(im, ((i%2)*520, (i//2)*430))
sheet.save('/private/tmp/kohaku-identity-references.png')
print('/private/tmp/kohaku-identity-references.png')

from PIL import Image

path = "/Users/gimgutae/Developer/dog-and-me/website-character-sprite.png"
im = Image.open(path)
assert im.mode == "RGBA"
assert im.size == (1448, 1086)
cell_w, cell_h = im.width // 4, im.height // 3
alpha = im.getchannel("A")
assert alpha.getextrema()[0] == 0
for row in range(3):
    for col in range(4):
        cell = alpha.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
        bbox = cell.getbbox()
        assert bbox is not None, (row, col)
        # Required 8% transparent gutter, including every cell edge.
        gx, gy = int(cell_w * 0.08), int(cell_h * 0.08)
        assert bbox[0] >= gx and bbox[1] >= gy
        assert bbox[2] <= cell_w - gx and bbox[3] <= cell_h - gy
        assert all(v == 0 for v in cell.crop((0, 0, cell_w, gy)).getdata())
        assert all(v == 0 for v in cell.crop((0, cell_h - gy, cell_w, cell_h)).getdata())
        assert all(v == 0 for v in cell.crop((0, 0, gx, cell_h)).getdata())
        assert all(v == 0 for v in cell.crop((cell_w - gx, 0, cell_w, cell_h)).getdata())
        print(f"frame {row * 4 + col + 1}: bbox={bbox}")
print("RGBA, 12 cells, 8% gutter, and transparent edges passed")

# Visual QA on white, black, and vivid magenta backgrounds.
panels = []
for bg in ((255, 255, 255, 255), (0, 0, 0, 255), (255, 0, 170, 255)):
    panel = Image.new("RGBA", im.size, bg)
    panel.alpha_composite(im)
    panels.append(panel.convert("RGB"))
preview = Image.new("RGB", (im.width, im.height * 3))
for i, panel in enumerate(panels):
    preview.paste(panel, (0, i * im.height))
preview.save("/private/tmp/website-character-sprite-background-check.png")
print("preview=/private/tmp/website-character-sprite-background-check.png")

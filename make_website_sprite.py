from PIL import Image, ImageFilter

SOURCE = "/Users/gimgutae/.codex/generated_images/01a0369a-0739-7701-8354-ec38e0d188fd/exec-bb718ecc-92f6-4a44-a780-353592ca85ec.png"
DEST = "/Users/gimgutae/Developer/dog-and-me/website-character-sprite.png"

src = Image.open(SOURCE).convert("RGB")
w, h = src.size
cell_w, cell_h = w // 4, h // 3
out = Image.new("RGBA", (w, h), (0, 0, 0, 0))

for row in range(3):
    for col in range(4):
        box = (col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h)
        cell = src.crop(box)
        pix = cell.load()
        mask = Image.new("L", cell.size, 0)
        mp = mask.load()
        for y in range(cell.height):
            for x in range(cell.width):
                r, g, b = pix[x, y]
                spread = max(r, g, b) - min(r, g, b)
                darkest = min(r, g, b)
                # The generated checkerboard is nearly neutral and very light;
                # the dog and collar carry hue or substantially darker values.
                if spread >= 14 or darkest < 160:
                    mp[x, y] = 255
        # Close tiny holes in the dog silhouette and soften only the outer edge.
        mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
        # Keep only the principal connected silhouette in this cell. This
        # removes any isolated fragment that could belong to a neighboring
        # generated frame.
        mp = mask.load()
        seen = set()
        components = []
        for yy in range(cell.height):
            for xx in range(cell.width):
                if mp[xx, yy] == 0 or (xx, yy) in seen:
                    continue
                stack = [(xx, yy)]
                seen.add((xx, yy))
                comp = []
                while stack:
                    cx, cy = stack.pop()
                    comp.append((cx, cy))
                    for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                        if 0 <= nx < cell.width and 0 <= ny < cell.height and mp[nx, ny] and (nx, ny) not in seen:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
                components.append(comp)
        if components:
            keep = max(components, key=len)
            keep_set = set(keep)
            for yy in range(cell.height):
                for xx in range(cell.width):
                    if (xx, yy) not in keep_set:
                        mp[xx, yy] = 0
        # Remove neutral light remnants such as generated motion-line or
        # checkerboard pixels while retaining the warm colored fur.
        for yy in range(cell.height):
            for xx in range(cell.width):
                r, g, b = pix[xx, yy]
                if mp[xx, yy] and max(r, g, b) - min(r, g, b) < 14 and min(r, g, b) > 160:
                    mp[xx, yy] = 0
        rgba = cell.convert("RGBA")
        rgba.putalpha(mask)
        # Enforce the required transparent gutter on every cell.
        gutter_x, gutter_y = int(cell.width * 0.08), int(cell.height * 0.08)
        clear = Image.new("L", cell.size, 0)
        cp = clear.load()
        for y in range(gutter_y, cell.height - gutter_y):
            for x in range(gutter_x, cell.width - gutter_x):
                cp[x, y] = 255
        rgba.putalpha(Image.composite(rgba.getchannel("A"), Image.new("L", cell.size, 0), clear))
        out.alpha_composite(rgba, (col * cell_w, row * cell_h))

out.save(DEST, "PNG")
print(DEST, out.size, out.mode)

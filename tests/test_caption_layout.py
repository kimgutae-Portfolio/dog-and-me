"""Run with: python3 -m unittest discover -s tests -p 'test_caption_layout.py'."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

from PIL import Image

spec = importlib.util.spec_from_file_location(
    "assemble_film", Path(__file__).resolve().parents[1] / "scripts/assemble_film.py"
)
film = importlib.util.module_from_spec(spec)
spec.loader.exec_module(film)


class CaptionLayoutTest(unittest.TestCase):
    def test_caption_pixels_stay_below_picture(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / "caption.png")
            film.make_story_caption_overlay(path, "一緒に歩いた、いつもの道。\n今日も大切な思い出です。")
            with Image.open(path) as image:
                bounds = image.getchannel("A").getbbox()
                self.assertIsNotNone(bounds)
                self.assertGreaterEqual(bounds[1], film.CAPTION_TOP)
                self.assertLess(bounds[3], film.H - 20)
                self.assertIsNone(image.crop((0, 0, film.W, film.CAPTION_TOP)).getchannel("A").getbbox())

    def test_long_caption_is_not_silently_truncated(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError, "2行"):
                film.make_story_caption_overlay(str(Path(tmp) / "caption.png"), "思い出" * 100)

    def test_real_render_keeps_source_and_ivory_footer(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = str(Path(tmp) / "source.mp4")
            framed = str(Path(tmp) / "framed.mp4")
            output = str(Path(tmp) / "captioned.mp4")
            frame = str(Path(tmp) / "frame.png")
            # Red center with a blue perimeter detects accidental cropping.
            film.run(["ffmpeg", "-y", "-f", "lavfi", "-i",
                      "color=red:s=640x360:r=24:d=1,drawbox=x=0:y=0:w=iw:h=ih:color=blue:t=12",
                      "-c:v", "libx264", "-pix_fmt", "yuv420p", source])
            film.normalize_story_clip(source, framed, 1, 0, 0, caption_layout=True)
            film.burn_story_captions(framed, ["一緒に歩いた日。"], [(0, 1)], output, 1, tmp)
            film.run(["ffmpeg", "-y", "-ss", "0.5", "-i", output, "-frames:v", "1", frame])
            with Image.open(frame) as image:
                self.assertEqual(image.size, (1920, 1080))
                for point in [(200, 40), (1718, 40), (200, 875), (1718, 875)]:
                    r, g, b = image.convert("RGB").getpixel(point)
                    self.assertGreater(b, r + 100, point)
                for point in [(20, 500), (100, 960)]:
                    pixel = image.convert("RGB").getpixel(point)
                    self.assertTrue(all(abs(a-b) < 12 for a, b in zip(pixel, film.CREAM)), pixel)
            info = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
                                            "format=duration", "-of", "csv=p=0", output], text=True)
            self.assertAlmostEqual(float(info), 1, delta=0.1)


if __name__ == "__main__":
    unittest.main()

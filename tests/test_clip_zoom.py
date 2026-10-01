import importlib.util
from pathlib import Path
import tempfile
import unittest
from PIL import Image

spec = importlib.util.spec_from_file_location('film', Path(__file__).resolve().parents[1] / 'scripts/assemble_film.py')
film = importlib.util.module_from_spec(spec)
spec.loader.exec_module(film)

class ClipZoomTest(unittest.TestCase):
    def test_video_zoom_grows_towards_selected_right_edge(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, out = str(Path(tmp)/'src.mp4'), str(Path(tmp)/'out.mp4')
            film.run(['ffmpeg','-y','-f','lavfi','-i','color=blue:s=320x180:r=24:d=1,drawbox=x=280:y=0:w=40:h=180:color=red:t=fill','-c:v','libx264',src])
            film.normalize_story_clip(src,out,1,0,0,caption_layout=True,zoom={'x':1,'y':0.5,'scale':2})
            widths=[]
            for i,t in enumerate([0,0.9]):
                p=str(Path(tmp)/f'{i}.png')
                film.run(['ffmpeg','-y','-ss',str(t),'-i',out,'-frames:v','1',p])
                with Image.open(p) as image:
                    widths.append(sum(1 for x in range(film.W) if (lambda c:c[0]>150 and c[2]<100)(image.convert('RGB').getpixel((x,400)))))
                    self.assertTrue(all(abs(a-b)<12 for a,b in zip(image.convert('RGB').getpixel((100,960)),film.CREAM)))
            self.assertGreater(widths[1],widths[0]*1.7)

if __name__=='__main__': unittest.main()

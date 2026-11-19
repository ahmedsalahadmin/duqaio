import sys, glob, os
from PIL import Image
d, out = sys.argv[1], sys.argv[2]
names = sorted({os.path.basename(f).rsplit('_',1)[0] for f in glob.glob(os.path.join(d,'*.png'))})
W=340; H=460
sheet = Image.new('RGB', (W*2, H*len(names)), (240,236,228))
for i,n in enumerate(names):
    for j,k in enumerate(['realistic','anime']):
        im = Image.open(os.path.join(d, f'{n}_{k}.png')).convert('RGBA')
        sheet.paste(im, (j*W+5, i*H+5), im)
sheet.save(out)

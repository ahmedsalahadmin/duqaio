import sys, glob, os
from PIL import Image
import numpy as np
d = sys.argv[1]
for f in sorted(glob.glob(os.path.join(d, '*.png'))):
    im = Image.open(f)
    a = np.array(im.convert('RGBA'))[..., 3]
    ys, xs = np.nonzero(a > 16)
    print(os.path.basename(f), im.size, im.mode, 'bbox', xs.min(), ys.min(), xs.max(), ys.max(), 'cov %.2f' % (a > 16).mean())

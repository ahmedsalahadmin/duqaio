import sys, os
from PIL import Image
d, out = sys.argv[1], sys.argv[2]
ids = ['spicy-ramen','shrimp-noodles','black-garlic-ramen','sesame-dan-dan','mushroom-udon']
W, H = 400, 470
sheet = Image.new('RGB', (W*2, H*len(ids)), (210,200,185))
for i,n in enumerate(ids):
    for j,k in enumerate(['real','anime']):
        im = Image.open(os.path.join(d, f'{n}_{k}.webp')).convert('RGBA')
        sheet.paste(im, (j*W+5, i*H+5), im)
sheet.save(out)

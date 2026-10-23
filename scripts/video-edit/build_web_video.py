"""
Makes the website's video (public/videos/interior-loop.mp4) from the studio's original "Interior Video.MP4".

  python scripts/video-edit/build_web_video.py [--fix-design-spelling] [--src "Interior Video.MP4"] [--out public/videos/interior-loop.mp4]

What it does, frame by frame:
  * decodes the original (HEVC, 1080 x 584, full range),
  * with --fix-design-spelling, repaints the burned-in misspelling "DESING" as "DESIGN" (see fixword.py),
  * crops off the black rounded frame baked into the original's edges (26 px left/right, 22 top, 18 bottom -> 1028 x 544),
  * encodes H.264 with no audio and the index at the front (faststart), so every browser can play it.

Needs ffmpeg (set the FFMPEG environment variable if it is not on the PATH) and Python with numpy, scipy and scikit-image.
The poster picture (interior-loop-poster.webp) is the first frame and is not affected by the spelling fix.
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fixword import fix_frame  # noqa: E402

FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
W, H = 1080, 584
FRAME_BYTES = W * H * 3
# The word never moves, so every frame uses the same letter positions (measured on the original: N 249-273, G 276-306).
# Detecting them frame by frame moved the repaint by one pixel in a few frames, which showed as a flicker.
LETTERS = ((249, 273), (276, 306))

parser = argparse.ArgumentParser()
parser.add_argument('--src', default='Interior Video.MP4')
parser.add_argument('--out', default='public/videos/interior-loop.mp4')
parser.add_argument('--fix-design-spelling', action='store_true')
args = parser.parse_args()

decoder = subprocess.Popen(
    [FFMPEG, '-v', 'error', '-i', args.src, '-an', '-vf', 'scale=in_range=pc:in_color_matrix=bt709,format=rgb24',
     '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    stdout=subprocess.PIPE,
)
encoder = subprocess.Popen(
    [FFMPEG, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '30', '-i', '-', '-an',
     '-vf', 'crop=1028:544:26:22,scale=out_color_matrix=bt709:out_range=tv:flags=lanczos,format=yuv420p,'
            'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv',
     '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-profile:v', 'high', '-level', '4.0',
     '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
     '-r', '30', '-movflags', '+faststart', args.out],
    stdin=subprocess.PIPE,
)

count, repainted = 0, []
while True:
    buf = b''
    while len(buf) < FRAME_BYTES:
        chunk = decoder.stdout.read(FRAME_BYTES - len(buf))
        if not chunk:
            break
        buf += chunk
    if len(buf) < FRAME_BYTES:
        break
    frame = np.frombuffer(buf, dtype=np.uint8).reshape(H, W, 3)
    if args.fix_design_spelling:
        frame, info = fix_frame(frame, force_geometry=LETTERS)
        if info.get('changed'):
            repainted.append(count)
    encoder.stdin.write(np.ascontiguousarray(frame).tobytes())
    count += 1

encoder.stdin.close()
encoder.wait()
decoder.wait()
print(json.dumps({'frames': count, 'repainted_frames': [repainted[0], repainted[-1], len(repainted)] if repainted else None, 'out': args.out}))

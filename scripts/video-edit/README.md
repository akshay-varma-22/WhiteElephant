# Making the website video from the original

`public/videos/interior-loop.mp4` is **not** the original file: it is made from `Interior Video.MP4` (the studio's own video, kept in the
project folder) by `build_web_video.py`, because the original is 19 MB, HEVC (many browsers cannot play it) and has a black frame
baked into its edges.

```
python scripts/video-edit/build_web_video.py --fix-design-spelling
```

(Set the `FFMPEG` environment variable to the ffmpeg program if it is not on your PATH. Python needs `numpy`, `scipy` and `scikit-image`.)

## The spelling fix (18 Oct 2026)

The original says “TO DESING” in the third scene (frames 178-267, about 5.9 s to 8.9 s). The words are part of the picture, so
`fixword.py` repaints them: it finds the letters N and G (cream capitals on wood), rebuilds the wood under them, measures how much of
each pixel is cream, and draws the two letters back in the opposite order in the same space, so the word reads “TO DESIGN” in the
video's own typeface and colour. Only a small box around those two letters changes, and only on those 90 frames.

Still in the original and **not** changed: “Spaces that feels like you.” (should be “feel”) in the fourth scene. To fix that one as well,
the same approach works (one letter removed and the rest of the line closed up); ask for it.

If you send a new, corrected video instead, replace `Interior Video.MP4` with it and run the script **without** `--fix-design-spelling`
(check first that the black frame is still there to be cropped: the crop numbers are in the script).

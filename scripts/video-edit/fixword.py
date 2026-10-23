"""
Swap the last two letters of the burned-in word "DESING" -> "DESIGN" in one RGB frame (numpy uint8, H x W x 3).

The letters are cream (253, 242, 224) rounded sans-serif capitals sitting on wood. For each frame:
  1. find the pixels of the letters N and G (cream and bright),
  2. rebuild the wood under them by inpainting,
  3. measure each letter's coverage (alpha) against that wood,
  4. put the two letters back in the opposite order, in the same overall span, with the same gap between them.
Everything outside the small box around "NG" is left exactly as it was.
"""
import numpy as np
from scipy import ndimage as ndi
from skimage.restoration import inpaint_biharmonic

TEXT = np.array([253.0, 242.0, 224.0])        # the cream the letters are drawn in (measured from the video)
BOX = (444, 484, 244, 312)                    # rows y0:y1, columns x0:x1 around the letters "NG" (and a margin)
NG_COLS = (249, 307)                          # columns that can hold the ink of N and G (frame x coordinates)


def strong_text_mask(sub):
    r, g, b = sub[..., 0].astype(int), sub[..., 1].astype(int), sub[..., 2].astype(int)
    return (b > 165) & (r > 232) & (g > 215)


def runs_of(flags, offset):
    out, start = [], None
    for i, v in enumerate(flags):
        if v and start is None:
            start = i
        if (not v) and start is not None:
            out.append((start + offset, i - 1 + offset))
            start = None
    if start is not None:
        out.append((start + offset, len(flags) - 1 + offset))
    return out


def fix_frame(img, force_geometry=None):
    """Returns (new_img, info). info['changed'] is False when the word is not on this frame."""
    y0, y1, x0, x1 = BOX
    sub = img[y0:y1, x0:x1].astype(np.float64)
    strong = strong_text_mask(sub)
    c0, c1 = NG_COLS[0] - x0, NG_COLS[1] - x0
    ink = strong.copy()
    ink[:, :c0] = False
    ink[:, c1 + 1:] = False
    if ink.sum() < 250:                       # the word is not on this frame
        return img, {'changed': False, 'ink': int(ink.sum())}

    # Wood under the two letters: inpaint everything the letters touch (grown by 2 px to take in their soft edges).
    grown = ndi.binary_dilation(ink, iterations=2)
    wood = inpaint_biharmonic(sub / 255.0, grown, channel_axis=-1) * 255.0

    # Coverage of the cream on top of that wood (least squares over the three colour channels).
    d_text = TEXT[None, None, :] - wood
    d_pix = sub - wood
    alpha = (d_pix * d_text).sum(axis=-1) / np.maximum((d_text * d_text).sum(axis=-1), 1.0)
    alpha = np.clip(alpha, 0.0, 1.0)
    alpha[~grown] = 0.0
    alpha[alpha < 0.04] = 0.0

    col_ink = (alpha > 0.10).any(axis=0)
    col_ink[:c0] = False
    col_ink[c1 + 1:] = False
    runs = runs_of(col_ink, 0)
    # The word is only really here if exactly two letters (N and G) are found; anything else (a light end card, say) is left alone.
    if len(runs) != 2:
        return img, {'changed': False, 'ink': int(ink.sum()), 'runs': runs, 'problem': 'expected two letter runs'}
    (nL, nR), (gL, gR) = runs
    if force_geometry is not None:
        # The word never moves, so the caller can fix the letter positions instead of using this frame's (which can be a pixel off).
        (nL, nR), (gL, gR) = force_geometry
        nL, nR, gL, gR = nL - x0, nR - x0, gL - x0, gR - x0

    wN, wG = nR - nL + 1, gR - gL + 1
    # Cut each letter out, with one spare pixel either side for the soft edge (the gap between the letters is wider than that).
    cutN = alpha[:, nL - 1:nR + 2].copy()
    cutG = alpha[:, gL - 1:gR + 2].copy()

    new_alpha = np.zeros_like(alpha)
    # G goes where N began; N goes where G ended; the gap between them stays what it was.
    gNewL = nL - 1
    nNewL = (gR + 1) - cutN.shape[1] + 1
    new_alpha[:, gNewL:gNewL + cutG.shape[1]] = np.maximum(new_alpha[:, gNewL:gNewL + cutG.shape[1]], cutG)
    new_alpha[:, nNewL:nNewL + cutN.shape[1]] = np.maximum(new_alpha[:, nNewL:nNewL + cutN.shape[1]], cutN)

    out = sub.copy()
    out[grown] = wood[grown]
    a = new_alpha[..., None]
    out = out * (1.0 - a) + TEXT[None, None, :] * a
    new = img.copy()
    new[y0:y1, x0:x1] = np.clip(np.rint(out), 0, 255).astype(np.uint8)
    return new, {'changed': True, 'ink': int(ink.sum()), 'N': (nL + x0, nR + x0), 'G': (gL + x0, gR + x0)}

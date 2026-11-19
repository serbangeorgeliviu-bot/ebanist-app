#!/usr/bin/env python3
"""Pune ecranul REAL al aplicației (vid-spot/ui[en]/f_*.png, din spot-ui.cjs) pe tableta din cadrul cu meseriașul (pA.mp4).
Urmărește ecranul (zona luminoasă din ramă neagră), pune partea de sus și proporția 4:3 din lățime, perspectivă prin homografie.
python3 spot-tablet.py [it|en] → vid-spot/in/pA_ui[_en].mp4"""
import cv2, numpy as np, os, sys, subprocess, glob
LANG = sys.argv[1] if len(sys.argv) > 1 else "it"
V = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../vid-spot")); IN = os.path.join(V, "in")
UI = os.path.join(V, "ui" + ("en" if LANG == "en" else ""))
THR = 62
def quad(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); h, w = g.shape
    m = (g > THR).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)); m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); best = None
    for c in cs:
        a = cv2.contourArea(c)
        if a < w * h * 0.03 or a > w * h * 0.6: continue
        hull = cv2.convexHull(c); r = cv2.minAreaRect(hull); ra = r[1][0] * r[1][1]
        if ra <= 0 or a / ra < 0.82: continue
        ring = np.zeros_like(m); cv2.drawContours(ring, [hull], -1, 255, -1); k = cv2.dilate(ring, np.ones((31, 31), np.uint8)) - ring
        dark = g[k > 0].mean()
        if dark < 45 and (best is None or a > best[0]): best = (a, hull)
    if best is None: return None
    hull = best[1]; peri = cv2.arcLength(hull, True)
    for eps in (0.02, 0.03, 0.05, 0.08):
        ap = cv2.approxPolyDP(hull, eps * peri, True)
        if len(ap) == 4: pts = ap[:, 0, :].astype(np.float32); break
    else: pts = cv2.boxPoints(cv2.minAreaRect(hull)).astype(np.float32)
    # ordine: sus-stânga, sus-dreapta, jos-dreapta, jos-stânga
    s = pts.sum(1); d = np.diff(pts, axis=1)[:, 0]
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]], np.float32)

paths = sorted(glob.glob(os.path.join(IN, "fa", "f_*.png"))); n = len(paths)
tops = [None] * n
for i, p in enumerate(paths):
    q = quad(cv2.imread(p))
    if q is not None: tops[i] = (q[0], q[1])
# umple golurile mici, netezește
idx = [i for i in range(n) if tops[i] is not None]
print("detectat", len(idx), "din", n, "intre", idx[0], idx[-1])
arr = np.full((n, 4), np.nan)
for i in idx: arr[i] = [*tops[i][0], *tops[i][1]]
for c in range(4):
    ok = ~np.isnan(arr[:, c]); arr[:, c] = np.interp(np.arange(n), np.where(ok)[0], arr[ok, c])
k = 7; ker = np.ones(k) / k
sm = np.stack([np.convolve(np.pad(arr[:, c], (k // 2, k // 2), mode="edge"), ker, mode="valid") for c in range(4)], 1)
ui = sorted(glob.glob(os.path.join(UI, "f_*.png")))
first, last = idx[0], idx[-1]
out = os.path.join(IN, "fx"); os.makedirs(out, exist_ok=True)
for i, p in enumerate(paths):
    img = cv2.imread(p)
    if first <= i <= last:
        tl = sm[i, :2].copy(); tr = sm[i, 2:].copy(); wv = tr - tl; wl = np.linalg.norm(wv); u = wv / wl; nrm = np.array([-u[1], u[0]])  # normala spre jos
        tl = tl - u * 0.016 * wl - nrm * 0.075 * wl; tr = tr + u * 0.016 * wl - nrm * 0.075 * wl
        wv = tr - tl; wl = np.linalg.norm(wv); u = wv / wl; nrm = np.array([-u[1], u[0]])
        hgt = wl * (0.84 + 0.10 * min(1.0, max(0.0, (i - 60) / 40)))
        bl = tl + nrm * hgt; br = tr + nrm * hgt
        dst = np.array([tl, tr, br, bl], np.float32)
        t = (i - first) / max(1, last - first)
        u_img = cv2.imread(ui[min(len(ui) - 1, int(t * (len(ui) - 1)))])
        u_img = u_img[:, 87:, :]  # fără bara de navigare: 1093×820 ≈ 4:3
        hh, ww = u_img.shape[:2]
        M = cv2.getPerspectiveTransform(np.array([[0, 0], [ww, 0], [ww, hh], [0, hh]], np.float32), dst)
        warp = cv2.warpPerspective(u_img, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_LANCZOS4)
        mask = np.zeros(img.shape[:2], np.uint8); cv2.fillConvexPoly(mask, dst.astype(np.int32), 255)
        mask = cv2.erode(mask, np.ones((5, 5), np.uint8)); mask = cv2.GaussianBlur(mask, (5, 5), 0).astype(np.float32)[:, :, None] / 255
        fade = min(1.0, (i - first + 1) / 6) * min(1.0, (last - i + 1) / 6)
        warp = np.clip(warp.astype(np.float32) * 0.96 + 6, 0, 255)
        img = (img * (1 - mask * fade) + warp * (mask * fade)).astype(np.uint8)
    cv2.imwrite(os.path.join(out, f"f_{i+1:03d}.png"), img)
dst_mp4 = os.path.join(IN, "pA_ui" + ("_en" if LANG == "en" else "") + ".mp4")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", "24", "-i", os.path.join(out, "f_%03d.png"), "-i", os.path.join(IN, "pA.mp4"),
                "-map", "0:v", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-an", dst_mp4], check=True)
print("gata", dst_mp4)

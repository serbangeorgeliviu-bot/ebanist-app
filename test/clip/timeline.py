"""Timeline-ul clipului din durațiile vocii (t1..t6, în secunde, după tăierea tăcerilor).
python3 timeline.py d1 d2 d3 d4 d5 d6 > timeline.json
Fiecare cadru urmează fraza lui; fracțiile împart o frază între două cadre/subtitrări."""
import json, sys
GAP = 0.08
d = [float(x) for x in sys.argv[1:7]]
s, t = [], 0.0
for x in d:
    s.append(round(t, 3)); t += x + GAP           # începutul fiecărei bucăți de voce
end = round(t - GAP, 3)
e = [round(s[i] + d[i], 3) for i in range(6)]
cut = lambda i, f: round(s[i] + d[i] * f, 3)      # punct la fracția f din fraza i
# (început, sfârșit) video pe cadre; fiecare cadru se termină unde începe următorul
b = [s[0], s[1], cut(1, .5), s[2], cut(2, .42), cut(2, .72), s[3], cut(3, .52), s[4], s[5], end]
seg = [(b[i], b[i + 1]) for i in range(10)]
cues = [  # (început, sfârșit, id-ul textului din captions.py)
 (s[0], e[0], 0), (s[1], cut(1, .5), 1), (cut(1, .5), e[1], 2), (s[2], cut(2, .42), 3), (cut(2, .42), e[2], 4),
 (s[3], cut(3, .52), 5), (cut(3, .52), e[3], 6), (s[4], cut(4, .37), 7), (cut(4, .37), cut(4, .75), 8),
 (cut(4, .75), s[5], 9), (s[5], end, 10)]
sfx_cut = [round(x - .13, 3) for x in (s[1], s[2], s[3], s[4], s[5])]            # swoosh la tăieturi
sfx_click = [round(x, 3) for x in (cut(1, .5), cut(2, .42), cut(2, .72), cut(3, .52))]
print(json.dumps({"start": s, "dur": d, "end": end, "seg": seg, "cues": cues,
                  "swoosh": sfx_cut, "click": sfx_click}))

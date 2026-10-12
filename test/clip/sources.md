# Surse clip 1 (v2)

Cadre AI (veo-3.1-fast, 1080p, 9:16, 4 s; marchează „AI-generated" la publicare). Prompturile sunt în
`00-business/Clip-1-Video-Promo-v2.md` din ebanist-hq.

- S1 hook: https://videogen.vidiq.com/cc981166-09f6-459a-939c-c3ef947c6276/4595348b-a457-4a78-9778-23ea48e55e84_5797bc33-1f82-4f38-bedc-e2dd22d0f789_1ee452d3-0eb3-4bb7-8174-f1b658db6fd8.mp4
- S2 tăiere: https://videogen.vidiq.com/cc981166-09f6-459a-939c-c3ef947c6276/8837b78d-f2ed-481f-9367-c0800b8ad2dc_e4fcfd8f-9c13-4efd-8e04-6a0cefabe157_647023ef-5aeb-436a-8c2f-df3c8217b738.mp4
- S3 montaj: https://videogen.vidiq.com/cc981166-09f6-459a-939c-c3ef947c6276/84c2e8f7-504a-43e1-b13b-ecc41e975e97_abdcce05-ad81-4b9a-a403-9af4b068a88e_9bee1f07-dce8-4deb-8841-53e05aa6b57b.mp4
- S4 final (se inversează în make-clip.sh): https://videogen.vidiq.com/cc981166-09f6-459a-939c-c3ef947c6276/c5e40313-32a7-47c9-9156-c22507d4205a_ced7b283-3e54-44e0-b522-4541a2c0921a_e72df8fd-b760-4849-8fb7-fce40f9660c3.mp4
- Muzică (WAV, momentul drop-ului neverificat): https://ai-music-tracks.s3.us-east-1.amazonaws.com/cc981166-09f6-459a-939c-c3ef947c6276/2eecbaf1-bcef-4a30-af32-d7ac6166ae36.wav
- Vocea: linkurile MP3 sunt semnate și expiră în 12 h → se regenerează din `voice-script.txt`.

## Skit „Cliente" (ep. 1)

Clip AI (veo-3.1-fast, 720p, 8 s, 9:16; marchează „AI-generated"): https://videogen.vidiq.com/cc981166-09f6-459a-939c-c3ef947c6276/9bfc6dff-81aa-4e70-b5c0-56b52839b1c3_2a80f9f1-8816-43e8-8470-686fc25d05c7_de5841c0-7ee5-4ec0-bc31-c1a19251f006.mp4
Prompt: vertical 9:16 smartphone video, handheld with slight natural shake, real Italian cabinetmaker's workshop lit by daylight from a window, natural colors, subtle film grain, no text, no music. A man of about 38 with short dark hair, light stubble, navy sweatshirt dusted with sawdust and a pencil behind his ear stands facing the camera, chest-up, as if someone off-camera is talking to him. First polite attention, then his eyes slowly go blank, one eyebrow lifts, a long slow blink, a quiet exhale through the nose, a tiny tired half-smile. Very slow push-in. He never speaks. Ambient workshop sound only.
Montaj: `python3 skit.py skit/ep1.json <clip.mp4> <out.mp4>` (video; sunetul: ambianța clipului + pop la baloane + thud la «200 €»).
Cost: ~240 credite vidIQ per clip de 8 s.

## Skit „Cliente" — același personaj în episoade (ep. 2+)

Veo generează o persoană nouă la fiecare clip, deci pentru același personaj: **imagine de start** (`startFrameB64`) = un cadru frontal din ep. 1 (216×384 JPEG, ~7 KB; ex.: `ffmpeg -ss 3.2 -i A.mp4 -frames:v 1 -vf scale=216:384 -q:v 9 st.jpg`), iar promptul descrie doar acțiunea („Same man, same workshop, same framing as the first frame…"). Verificat: ep. 2 are aceeași față, aceeași bluză, același atelier.
- Ep. 2 (clip 8 s): https://videogen.vidiq.com/cc981166-09f6-459a-939c-c3ef947c6276/db8d6a3e-6d8f-4990-a86c-fd0983e974af_379849c0-0b2b-4b56-bcf2-7f18cdd25e66_9105cfc5-4e5d-46be-bd96-87461aa553c4.mp4
- Prompt ep. 2: Same man, same workshop, same framing as the first frame, vertical 9:16 handheld smartphone look, natural daylight from the window, subtle film grain, no text, no music. He keeps staring at the camera, deadpan. Then he slowly takes the pencil from behind his ear, looks at it, looks back at the camera and lets out a long weary sigh while shaking his head very slightly. Very slow push-in. He never speaks. Ambient workshop sound only.
- Montaj video+sunet: `bash skit.sh skit/ep2.json <clip.mp4> <out.mp4> [thud_ms]`
- Ep. 3 (clip 8 s, același start frame): https://videogen.vidiq.com/cc981166-09f6-459a-939c-c3ef947c6276/d72af954-fd2f-4a7a-9ec4-87d1cbc80d42_0e552277-2cf6-4263-88c2-707138d9484c_3ffe2365-d93b-42cc-a127-93b778362eb4.mp4 — acțiune: zâmbet fals ținut prea mult, apoi privire goală.
- Ep. 4 (clip 8 s): https://videogen.vidiq.com/cc981166-09f6-459a-939c-c3ef947c6276/2600713d-1f12-4c34-b96b-7fd77d9c7528_d5447046-6708-415a-b1e0-31540419f844_9120cd42-b0a3-4923-b552-62fa9d1622b8.mp4 — acțiune: își încrucișează brațele, înclină capul, ridică o sprânceană, aprobă din cap.
- Ep. 5: două încercări respinse de filtrul Vertex (content_policy_rejected, cod 15236754, fără cost) la acțiunile „privește stânga + strânge ochii" și „privește lateral + închide ochii"; a treia, cu „privire nedumerită + umeri ridicați, palme în sus", a trecut. Dacă un prompt e respins, nu-l relua neschimbat: reformulează acțiunea.
- Ep. 5 (clip 8 s): https://videogen.vidiq.com/cc981166-09f6-459a-939c-c3ef947c6276/bf9797c6-e8ba-407c-861b-50e5e26c305b_84655bff-e6f9-490f-8da3-131e036dd77f_b864f5e9-f9d5-4c0b-a521-ea20f7f04173.mp4 — acțiune: privire nedumerită, ridică palmele în sus (umeri), expiră. Spec: `skit/ep5.json`.
Notă: clipurile conțin și audio nativ Veo (atmosferă; gura personajului se mișcă ușor în unele). La publicare pune oricum un sunet din trend deasupra / în loc.

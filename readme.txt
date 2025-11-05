KSM Happening 2026 – v8 update (foto + video, audioknop, smart‑TV fallback)

Wat is nieuw
------------
1) Gemengde carrousel: de site toont nu foto's én video's door elkaar op basis van één Drive-map.
   • De map met vaste volgorde is TOP_FOLDER_ID (curatie). De volgorde is op basis van bestandsnamen (A→Z).
   • Als TOP leeg is, valt de site terug op LIVE_FOLDER_ID (en toont recente foto's zoals vroeger).
   • Foto's blijven een vaste duur in beeld (DISPLAY_TIME). Video's spelen precies één keer en gaan dan verder.

2) Audioknop (rechtsboven): 🔇/🔊
   • De site start altijd “muted” (nodig voor autoplay in browsers).
   • Klik op het luidspreker‑icoon om geluid in te schakelen voor alle video's.
   • De instelling blijft actief zolang de pagina open staat.

3) Smart‑TV fallback (LG WebOS, Samsung Tizen, Android TV, Opera TV)
   • Sponsors schakelen automatisch over naar een statische weergave (geen animatie) – gegarandeerd zichtbaar.
   • Deze fallback beïnvloedt enkel de sponsorbalk. De slideshow blijft normaal werken.

Tips voor bestanden op Google Drive
-----------------------------------
• Zorg dat de bestanden publiek gedeeld zijn of “iedereen met link mag bekijken”.
• Voor een voorspelbare volgorde: gebruik nummering in bestandsnamen, bv. 001_foto.jpg, 002_video.mp4, …
• Aanbevolen videoformaat: MP4 (H.264 + AAC).
• Resolutie: bij voorkeur max 1080p (1920×1080) om vlot af te spelen op tv’s en oudere laptops.
• Verhouding: 16:9 (of 4:3) werkt het mooist met object‑fit in de slideshow.

Installatie
-----------
1) Vervang in je GitHub‑repo de 3 bestanden: index.html, style.css, slideshow.js (v8).
2) Publiceer/commit. Forceer eventueel een hard reload (Ctrl+F5) om caches te omzeilen.
3) Test:
   • Desktop/laptop (Chrome/Edge/Firefox).
   • Smartphone (portret en landschap).
   • Smart‑TV (LG/Samsung/Android TV). Sponsors moeten zichtbaar zijn (statisch).

Instellingen (in slideshow.js)
------------------------------
• FOTO_ANIMATIE – “kenburns” / “fade” / “fade‑zoom” / “slide” (images)
• DISPLAY_TIME – tijd per foto in ms (video's regelen zichzelf via “ended”).
• TOP_FOLDER_ID – map met je geordende media (foto’s én video’s).
• LIVE_FOLDER_ID – fallback voor recente foto’s als TOP leeg is.
• SPONSOR_FOLDER_ID – map met sponsorafbeeldingen (blijft werken zoals voorheen).

Veel plezier!

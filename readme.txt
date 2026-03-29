V2.2
- behoudt layout van de site
- lokale media ondersteund via map /media
- nieuw script: generate-media-files.bat
  - maakt media.json
  - maakt media.local.js
- media.local.js zorgt ervoor dat de site ook vanuit Verkenner / file:// lokale media kan tonen
- media.json blijft bruikbaar wanneer je de site via een lokale server opent

Gebruik:
1. Zet je foto's of video's in de map media
2. Dubbelklik op generate-media-files.bat
3. Open index.html

Ondersteunde bestanden:
- afbeeldingen: jpg, jpeg, png, webp, gif
- video: mp4, webm, mov

Opmerking:
- Als de site via file:// geopend wordt, gebruikt ze eerst media.local.js
- Als de site via localhost of een webserver draait, kan ze ook media.json gebruiken

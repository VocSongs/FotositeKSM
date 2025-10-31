/***** INSTELLINGEN DIE JE ZELF KAN AANPASSEN *********************************

Kies je animatiestijl door één van onderstaande opties te zetten.
Beschikbare waarden:

  FOTO_ANIM_MODE:
    - 'fade'
    - 'fade-zoom'
    - 'slide'
    - 'kenburns'

  SPONSOR_ANIM_MODE:
    - 'slide-up'
    - 'smooth-scroll'
    - 'fade'
    - 'glow'

******************************************************************************/

// ▼▼▼ Pas hier je keuzes aan ▼▼▼
const FOTO_ANIM_MODE     = 'kenburns';
const SPONSOR_ANIM_MODE  = 'smooth-scroll';

// Bestaande waarden bewaard:
const API_KEY            = "AIzaSyCcCnm--0E_87Jl0_oHpGA6q7h5_ZoOong";
const LIVE_FOLDER_ID     = "1DPRvYwG-nluiePp3ZRuCFcseze5kAHp4";
const TOP_FOLDER_ID      = "1N8wfqj7BFtx-jAYj0qM8-uqJVbblWXw3";
const SPONSOR_FOLDER_ID  = "18RJ4L_e30JlxDUcG945kWpcafy28KFIO";

// Foto's
const LIVE_MAX_AGE_HOURS = 2;
const DISPLAY_TIME       = 5000;
const REFRESH_INTERVAL   = 30* 60 * 1000;
const FADE_MS            = 1000;

// Sponsors
const NUM_SPONSORS_VISIBLE     = 4;
const SPONSOR_REFRESH_INTERVAL = 5 * 60 * 1000;

// Thumbnail kwaliteit
const PHOTO_THUMB_WIDTH   = 3000;
const SPONSOR_THUMB_WIDTH = 800;
/***** EINDE INSTELLINGEN *****************************************************/

let slideshowImages = [];
let sponsorImages   = [];
let currentIndex    = 0;

let containerEl     = null;
let lastRefreshEl   = null;
let noPhotosEl      = null;
let sponsorColEl    = null;

let currentImgEl    = null;
let slideTimer      = null;
let refreshTimer    = null;
let sponsorTimer    = null;

// LOADER
let loaderEl        = null;
let loaderGone      = false;

/** ---------- HULPFUNCTIES DRIVE ---------- **/
async function fetchFolderImages(folderId, isSponsor = false) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`
  );
  const fields = encodeURIComponent("files(id,name,createdTime,mimeType),nextPageToken");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&fields=${fields}&pageSize=200&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) { console.error("Drive API error for folder", folderId, res.status, res.statusText); return []; }
  const data = await res.json();
  const width = isSponsor ? SPONSOR_THUMB_WIDTH : PHOTO_THUMB_WIDTH;
  return (data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    createdTime: f.createdTime,
    url: `https://drive.google.com/thumbnail?id=${f.id}&sz=w${width}`,
  }));
}

function filterRecentLivePhotos(files) {
  const now = Date.now();
  const maxAgeMs = LIVE_MAX_AGE_HOURS * 60 * 60 * 1000;
  return files.filter((f) => now - new Date(f.createdTime).getTime() <= maxAgeMs);
}
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildSlideshowList(topFiles, liveFilesRecent) {
  return shuffleArray([...liveFilesRecent, ...topFiles]);
}

/** ---------- FOTO ANIMATIES ---------- **/
function createLayeredImgElement() {
  const el = document.createElement("img");
  el.className = "slideImage";
  el.style.position = "absolute";
  el.style.inset = "0";
  el.style.margin = "auto";
  el.style.maxWidth = "calc(100vw - var(--sidebar-w))";
  el.style.maxHeight = "100vh";
  el.style.objectFit = "contain";
  el.style.backgroundColor = "#000";
  el.style.borderRadius = "12px";
  el.style.boxShadow = "0 20px 60px rgba(0,0,0,0.8)";
  el.style.opacity = "0";
  el.alt = "live foto";
  el.referrerPolicy = "no-referrer";
  return el;
}
function applyPhotoEnterState(imgEl) {
  imgEl.classList.remove("anim-fade","anim-fadezoom","anim-slide","anim-kenburns");
  switch (FOTO_ANIM_MODE) {
    case 'fade-zoom': imgEl.classList.add("anim-fadezoom"); break;
    case 'slide':     imgEl.classList.add("anim-slide");     break;
    case 'kenburns':  imgEl.classList.add("anim-kenburns");  break;
    case 'fade':
    default:          imgEl.classList.add("anim-fade");
  }
}

/** LOADER helper **/
function hideLoaderOnce(){
  if (loaderGone || !loaderEl) return;
  loaderEl.classList.add('hide');
  setTimeout(() => {
    if (loaderEl && loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl);
    loaderEl = null;
  }, 700);
  loaderGone = true;
}

// Preload + transitie naar currentIndex
function transitionToCurrent() {
  if (!slideshowImages.length) {
    if (currentImgEl) { currentImgEl.remove(); currentImgEl = null; }
    noPhotosEl.style.opacity = 1;
    return;
  }
  noPhotosEl.style.opacity = 0;

  const photo = slideshowImages[currentIndex];
  const preloader = new Image();
  preloader.referrerPolicy = "no-referrer";
  preloader.src = photo.url;

  preloader.onload = () => {
    const nextImg = createLayeredImgElement();
    nextImg.src = preloader.src;
    applyPhotoEnterState(nextImg);
    containerEl.appendChild(nextImg);

    // ✅ verberg loader zodra de eerste foto succesvol geladen is
    hideLoaderOnce();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        nextImg.style.opacity = "1";
        if (currentImgEl) {
          if (FOTO_ANIM_MODE === 'slide') {
            currentImgEl.style.opacity = "0";
            currentImgEl.style.transform = "translateX(-6%)";
          } else {
            currentImgEl.style.opacity = "0";
          }
        }
      });
    });

    setTimeout(() => {
      if (currentImgEl) currentImgEl.remove();
      currentImgEl = nextImg;
    }, FADE_MS + 50);
  };

  preloader.onerror = () => {
    console.warn("Kon foto niet laden, sla over:", photo.url);
    currentIndex = (currentIndex + 1) % slideshowImages.length;
    transitionToCurrent();
  };
}

function nextImage() {
  if (!slideshowImages.length) return;
  currentIndex = (currentIndex + 1) % slideshowImages.length;

  // Bij elke fotowissel: sponsor-animatie
  if (SPONSOR_ANIM_MODE !== 'smooth-scroll') {
    rotateSponsorsOnce();
  }
  transitionToCurrent();
}

/** ---------- SPONSORS ---------- **/
async function refreshSponsorsFromDrive() {
  if (!SPONSOR_FOLDER_ID || SPONSOR_FOLDER_ID.includes("HIER_DE_SPONSOR_MAP_ID")) {
    sponsorImages = [];
    renderSponsorColumn();
    return;
  }
  try {
    const files = await fetchFolderImages(SPONSOR_FOLDER_ID, true);
    if (files.length) sponsorImages = shuffleArray(files);
    renderSponsorColumn();
  } catch (e) {
    console.error("Fout bij ophalen sponsors:", e);
  }
}
function renderSponsorColumn() {
  if (!sponsorColEl) return;
  sponsorColEl.innerHTML = "";

  if (SPONSOR_ANIM_MODE === 'smooth-scroll') {
    sponsorColEl.className = "sponsorCol smoothScroll";
    sponsorColEl.innerHTML = "";
    const track = document.createElement("div");
    track.className = "sponsorTrack";
    sponsorColEl.appendChild(track);

    const pushItems = (startIndex=0, count=NUM_SPONSORS_VISIBLE*6) => {
      for (let i=0; i<count; i++) {
        const idx = (startIndex + i) % Math.max(1, sponsorImages.length);
        const file = sponsorImages[idx] || {};
        const item = document.createElement("div");
        item.className = "sponsorItem";
        const img = document.createElement("img");
        img.alt = "sponsor logo";
        img.referrerPolicy = "no-referrer";
        img.src = file.url || "";
        item.appendChild(img);
        track.appendChild(item);
      }
    };

    if (!sponsorImages.length) {
      pushItems(0, NUM_SPONSORS_VISIBLE*6);
    } else {
      const loops = 3;
      for (let l=0; l<loops; l++) pushItems(l*NUM_SPONSORS_VISIBLE);
    }
    return;
  }

  sponsorColEl.className = "sponsorCol";
  if (!sponsorImages.length) {
    for (let i=0; i<NUM_SPONSORS_VISIBLE; i++){
      const ph = document.createElement("div");
      ph.className = "sponsorItem";
      sponsorColEl.appendChild(ph);
    }
    return;
  }

  for (let i=0; i<NUM_SPONSORS_VISIBLE; i++){
    const idx = i % sponsorImages.length;
    const file = sponsorImages[idx];
    const item = document.createElement("div");
    item.className = "sponsorItem";
    const img = document.createElement("img");
    img.alt = "sponsor logo";
    img.referrerPolicy = "no-referrer";
    img.src = file.url;
    item.appendChild(img);
    sponsorColEl.appendChild(item);
  }

  if (SPONSOR_ANIM_MODE === 'fade') {
    sponsorColEl.classList.remove('fadeChange');
    void sponsorColEl.offsetWidth;
    sponsorColEl.classList.add('fadeChange');
  } else if (SPONSOR_ANIM_MODE === 'glow') {
    const first = sponsorColEl.querySelector('.sponsorItem');
    if (first) {
      first.classList.add('glowPulse');
      setTimeout(()=> first.classList.remove('glowPulse'), 1200);
    }
  }
}
function rotateSponsorsOnce() {
  if (!sponsorImages.length) return;
  const first = sponsorImages.shift();
  sponsorImages.push(first);
  if (SPONSOR_ANIM_MODE === 'slide-up') {
    sponsorColEl.classList.add('slideOnce');
    setTimeout(() => {
      renderSponsorColumn();
      sponsorColEl.classList.remove('slideOnce');
    }, 450);
  } else {
    renderSponsorColumn();
  }
}

/** ---------- DATA REFRESH ---------- **/
async function refreshFromDrive() {
  try {
    const [topFiles, liveFiles] = await Promise.all([
      fetchFolderImages(TOP_FOLDER_ID, false),
      fetchFolderImages(LIVE_FOLDER_ID, false),
    ]);
    const liveRecent = filterRecentLivePhotos(liveFiles);
    slideshowImages = buildSlideshowList(topFiles, liveRecent);
    if (currentIndex >= slideshowImages.length) currentIndex = 0;

    const now = new Date();
    lastRefreshEl.textContent =
      "Laatste update: " +
      now.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });

    transitionToCurrent();
  } catch (err) {
    console.error("Fout bij refreshFromDrive:", err);
  }
}

/** ---------- INIT ---------- **/
async function init() {
  loaderEl      = document.getElementById("loader");   // ✅ loader referentie
  containerEl   = document.querySelector(".slideshow");
  lastRefreshEl = document.getElementById("lastRefresh");
  noPhotosEl    = document.getElementById("noPhotosMsg");
  sponsorColEl  = document.getElementById("sponsorCol");

  containerEl.style.position = "fixed";
  containerEl.style.overflow = "hidden";

  await Promise.all([ refreshFromDrive(), refreshSponsorsFromDrive() ]);

  slideTimer   = setInterval(nextImage, DISPLAY_TIME);
  refreshTimer = setInterval(refreshFromDrive, REFRESH_INTERVAL);
  sponsorTimer = setInterval(refreshSponsorsFromDrive, SPONSOR_REFRESH_INTERVAL);
}
init();

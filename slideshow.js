// =====================
//  FOTOSITE KSM – CLEAN BUILD (always scrolling sponsors)
// =====================

// ---- Drive-config ----
const API_KEY           = "AIzaSyCcCnm--0E_87Jl0_oHpGA6q7h5_ZoOong";
const LIVE_FOLDER_ID    = "1DPRvYwG-nluiePp3ZRuCFcseze5kAHp4";
const TOP_FOLDER_ID     = "1N8wfqj7BFtx-jAYj0qM8-uqJVbblWXw3";
const SPONSOR_FOLDER_ID = "18RJ4L_e30JlxDUcG945kWpcafy28KFIO";

// ---- Options ----
const FOTO_ANIMATIE     = "kenburns"; // "fade" | "kenburns"
const DISPLAY_TIME      = 5000;       // ms per foto
const FADE_MS           = 1000;
const LIVE_MAX_AGE_HRS  = 2;
const IS_MOBILE         = matchMedia("(max-width: 900px)").matches;
const PHOTO_W           = IS_MOBILE ? 1200 : 2000;
const SPONSOR_W         = IS_MOBILE ? 600  : 800;

// ---- Elements & state ----
let containerEl, lastRefreshEl, noPhotosEl, sponsorColEl, audioBtn;
let mediaItems = [];
let currentIndex = 0;
let currentEl = null;
let imageTimerId = null;

let sponsorImages = [];
let sponsorTimer = null;

// ---- Audio ----
let audioEnabled = false;

// ---- Sponsor scroll (interval motor) ----
let __scrollTimer = null;
const SCROLL_SPEED_PX_PER_SEC = 20;  // pas aan voor sneller/lager

// ===================== Helpers =====================
function clearImageTimer(){ if (imageTimerId){ clearTimeout(imageTimerId); imageTimerId = null; } }
function startImageTimer(){ clearImageTimer(); imageTimerId = setTimeout(nextMedia, DISPLAY_TIME); }

function hideLoader(){
  const loader = document.getElementById("loader");
  if (loader) loader.classList.add("fadeOut");
}

function setAudioIcon(){
  if (!audioBtn) return;
  audioBtn.textContent = audioEnabled ? "🔊" : "🔇";
  audioBtn.dataset.state = audioEnabled ? "unmuted" : "muted";
}
function applyAudioTo(el){
  if (!el || el.tagName !== "VIDEO") return;
  el.muted = !audioEnabled;
  if (audioEnabled) el.play().catch(()=>{});
}

function createImgEl(){
  const el = document.createElement("img");
  el.className = "slideImage";
  el.style.opacity = "0";
  return el;
}
function createVideoEl(){
  const el = document.createElement("video");
  el.className   = "slideVideo";
  el.playsInline = true;
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.autoplay = true;
  el.loop = false;
  el.controls = false;
  el.muted = !audioEnabled;
  el.preload = "auto";
  el.crossOrigin = "anonymous";
  el.style.opacity = "0";
  return el;
}

// ===================== Drive =====================
async function fetchFolderMediaOrdered(folderId){
  const q   = encodeURIComponent(`'${folderId}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=name&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.files || []).map(f=>{
    const isImg  = f.mimeType.startsWith("image/");
    const isVid  = f.mimeType.startsWith("video/");
    const imgUrl = `https://drive.google.com/thumbnail?id=${f.id}&sz=w${PHOTO_W}`;
    const vidUrl = `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${API_KEY}`;
    return { id:f.id, name:f.name, createdTime:f.createdTime, type: isImg?"image":(isVid?"video":"other"), url: isImg?imgUrl:vidUrl };
  }).filter(x=>x.type!=="other");
}

async function fetchFolderImages(folderId, isSponsor=false){
  const q   = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType contains 'image/'`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=name&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const w = isSponsor ? SPONSOR_W : PHOTO_W;
  return (data.files || []).map(f=>({ id:f.id, name:f.name, createdTime:f.createdTime, url:`https://drive.google.com/thumbnail?id=${f.id}&sz=w${w}` }));
}

function filterRecentLivePhotos(files){
  const maxAge = LIVE_MAX_AGE_HRS * 3600000;
  const now = Date.now();
  return files.filter(f => now - new Date(f.createdTime).getTime() <= maxAge);
}

// ===================== Slideshow =====================
function showCurrent(){
  clearImageTimer();
  if (!mediaItems.length){
    if (currentEl) { currentEl.remove(); currentEl = null; }
    if (noPhotosEl) noPhotosEl.hidden = false;
    return;
  }
  if (noPhotosEl) noPhotosEl.hidden = true;

  const it = mediaItems[currentIndex];
  let incoming;

  if (it.type === "image"){
    const pre = new Image();
    pre.src = it.url;
    pre.onload = ()=>{
      hideLoader();
      incoming = createImgEl();
      incoming.src = pre.src;
      if (FOTO_ANIMATIE === "kenburns"){
        incoming.classList.add("kenburns");
        incoming.style.setProperty("--kb-duration", Math.max(DISPLAY_TIME, 6000)+"ms");
      }
      containerEl.appendChild(incoming);
      requestAnimationFrame(()=>{ incoming.style.opacity="1"; if(currentEl) currentEl.style.opacity="0"; });
      setTimeout(()=>{ if(currentEl) currentEl.remove(); currentEl=incoming; startImageTimer(); }, FADE_MS);
    };
    pre.onerror = ()=> nextMedia(true);

  } else if (it.type === "video"){
    hideLoader();
    incoming = createVideoEl();
    incoming.src = it.url;
    applyAudioTo(incoming);
    incoming.addEventListener("ended", ()=> nextMedia());
    incoming.addEventListener("error", ()=> nextMedia(true));
    containerEl.appendChild(incoming);
    requestAnimationFrame(()=>{ incoming.style.opacity="1"; if(currentEl) currentEl.style.opacity="0"; });
    setTimeout(()=>{ if(currentEl) currentEl.remove(); currentEl=incoming; }, FADE_MS);
  }
}

function nextMedia(){
  if (!mediaItems.length) return;
  currentIndex = (currentIndex + 1) % mediaItems.length;
  showCurrent();
}

// ===================== Sponsors =====================
function createSponsorTile(url){
  const d = document.createElement("div");
  d.className = "sponsorItem";
  if (url) d.style.backgroundImage = `url("${url}")`;
  return d;
}

// ===== transform-gestuurde, naadloze verticale scroll =====
let __scrollTimer = null;
let __trackEl = null;
let __loopH = 0;
let __offset = 0;

function startAutoScroll(){
  if (__scrollTimer){ clearInterval(__scrollTimer); __scrollTimer = null; }
  const track = sponsorColEl?.querySelector('.sponsorTrack');
  if (!track) return;

  __trackEl = track;
  // hoogte van één set (we renderen min. 2 sets)
  __loopH = track.scrollHeight / 2 || 0;
  __offset = 0;

  // performance hints
  track.style.willChange = 'transform';
  track.style.transform = 'translateZ(0)';

  // container mag alles verbergen
  sponsorColEl.style.overflow = 'hidden';

  const SPEED = 20;   // px/s – pas aan naar smaak
  const STEP  = 16;   // ms ~60fps

  __scrollTimer = setInterval(()=>{
    if (!__trackEl) return;
    if (!__loopH) __loopH = __trackEl.scrollHeight / 2 || 0;

    __offset += SPEED * (STEP/1000);
    if (__loopH && __offset >= __loopH) __offset -= __loopH;

    __trackEl.style.transform = `translateY(-${__offset}px) translateZ(0)`;
  }, STEP);
}

function renderSponsorColumn(){
  if (!sponsorColEl) return;
  sponsorColEl.innerHTML = "";

  const list = sponsorImages && sponsorImages.length ? sponsorImages : [];
  if (!list.length) return;

  const track = document.createElement("div");
  track.className = "sponsorTrack";
  track.style.display = "flex";
  track.style.flexDirection = "column";
  track.style.gap = "12px";
  sponsorColEl.appendChild(track);

  // één set
  list.forEach(f => track.appendChild(createSponsorTile(f.url)));
  // duplicaat voor naadloze loop
  track.appendChild(track.cloneNode(true));

  // safety: zorg dat er ruim genoeg hoogte is
  while (track.scrollHeight < sponsorColEl.clientHeight * 2 && track.children.length < 300){
    track.appendChild(track.cloneNode(true));
  }

  startAutoScroll();
}

}

async function refreshSponsorsFromDrive(){
  const files = await fetchFolderImages(SPONSOR_FOLDER_ID, true);
  if (files.length) sponsorImages = files;
  renderSponsorColumn();
}

// ===================== Refresh media =====================
async function refreshMedia(){
  const top = await fetchFolderMediaOrdered(TOP_FOLDER_ID);
  if (top.length){
    mediaItems = top;
  } else {
    const live = await fetchFolderImages(LIVE_FOLDER_ID, false);
    mediaItems = filterRecentLivePhotos(live).map(x=>({type:'image', url:x.url, id:x.id, name:x.name}));
  }
  if (currentIndex >= mediaItems.length) currentIndex = 0;

  const now = new Date();
  if (lastRefreshEl) lastRefreshEl.textContent = "Last update: " + now.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"});

  showCurrent();
}

// ===================== Init =====================
async function init(){
  containerEl   = document.querySelector(".slideshow");
  lastRefreshEl = document.getElementById("lastRefresh");
  noPhotosEl    = document.getElementById("noPhotosMsg");
  sponsorColEl  = document.getElementById("sponsorCol");
  audioBtn      = document.getElementById("audioToggle");

// sponsor kolom voorbereiden voor transform-scroll
if (sponsorColEl){
  sponsorColEl.style.overflow = "hidden"; // niets buiten de kolom tonen
}
  }

  // fullscreen-knop
  const fsBtn = document.getElementById("startFsBtn");
  if (fsBtn){
    fsBtn.addEventListener("click", async ()=>{
      try { await document.documentElement.requestFullscreen(); } catch(e){}
      hideLoader();
      fsBtn.blur();
    });
  }

  // audio-knop
  if (audioBtn){
    setAudioIcon();
    audioBtn.addEventListener("click", ()=>{
      audioEnabled = !audioEnabled;
      setAudioIcon();
      applyAudioTo(currentEl);
    });
  }

  await Promise.all([refreshMedia(), refreshSponsorsFromDrive()]);
  sponsorTimer = setInterval(refreshSponsorsFromDrive, 5 * 60 * 1000);

  // keep-alive voor sponsor scroll
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'visible') startAutoScroll();
  });
  setInterval(()=>{
    const hasTrack = sponsorColEl && sponsorColEl.querySelector('.sponsorTrack');
    if (!hasTrack) renderSponsorColumn();
    else if (!__scrollTimer) startAutoScroll();
  }, 2000);
}

init();

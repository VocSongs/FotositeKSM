// ---------------------
// Config
// ---------------------
const API_KEY           = "AIzaSyCcCnm--0E_87Jl0_oHpGA6q7h5_ZoOong";
const LIVE_FOLDER_ID    = "1DPRvYwG-nluiePp3ZRuCFcseze5kAHp4";
const TOP_FOLDER_ID     = "1N8wfqj7BFtx-jAYj0qM8-uqJVbblWXw3";
const SPONSOR_FOLDER_ID = "18RJ4L_e30JlxDUcG945kWpcafy28KFIO";

const FOTO_ANIMATIE = "kenburns";  // "fade" | "kenburns"
const DISPLAY_TIME  = 5000;
const FADE_MS       = 1000;

const IS_MOBILE     = matchMedia("(max-width: 900px)").matches;
const PHOTO_W       = IS_MOBILE ? 1200 : 2000;
const SPONSOR_W     = IS_MOBILE ? 600  : 800;

// ---------------------
// State & elements
// ---------------------
let containerEl, lastRefreshEl, noPhotosEl, sponsorColEl, audioBtn;
let mediaItems = []; let currentIndex = 0; let currentEl = null;
let sponsorImages = [];
let imageTimerId = null;
let sponsorTimer  = null;

// transform-scroll vars
let __scrollTimer = null;
let __trackEl = null;
let __loopH = 0;
let __offset = 0;
const SCROLL_SPEED_PX_PER_SEC = 40; // pas aan naar smaak

// ---------------------
// Helpers
// ---------------------
function clearImageTimer(){ if (imageTimerId){ clearTimeout(imageTimerId); imageTimerId = null; } }
function startImageTimer(){ clearImageTimer(); imageTimerId = setTimeout(nextMedia, DISPLAY_TIME); }

function hideLoader(){
  const loader = document.getElementById("loader");
  if (loader) loader.classList.add("fadeOut");
}

function createImgEl(){ const el=document.createElement("img"); el.className="slideImage"; el.style.opacity="0"; return el; }
function createVideoEl(){
  const el=document.createElement("video");
  el.className="slideVideo";
  el.playsInline=true; el.setAttribute("playsinline",""); el.setAttribute("webkit-playsinline","");
  el.autoplay=true; el.loop=false; el.controls=false; el.muted=!audioEnabled; el.preload="auto"; el.crossOrigin="anonymous";
  el.style.opacity="0"; return el;
}

let audioEnabled=false;
function setAudioIcon(){ if(!audioBtn) return; audioBtn.textContent = audioEnabled ? "🔊" : "🔇"; }
function applyAudioTo(el){ if(el && el.tagName==="VIDEO"){ el.muted=!audioEnabled; if(audioEnabled) el.play().catch(()=>{}); }}

// ---------------------
// Drive fetchers
// ---------------------
async function fetchFolderMediaOrdered(folderId){
  const q=encodeURIComponent(`'${folderId}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')`);
  const url=`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=name&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
  const r=await fetch(url); if(!r.ok) return [];
  const d=await r.json();
  return (d.files||[]).map(f=>{
    const isImg=f.mimeType.startsWith("image/"), isVid=f.mimeType.startsWith("video/");
    const img=`https://drive.google.com/thumbnail?id=${f.id}&sz=w${PHOTO_W}`;
    const vid=`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${API_KEY}`;
    return {id:f.id,name:f.name,createdTime:f.createdTime,type:isImg?"image":(isVid?"video":"other"),url:isImg?img:vid};
  }).filter(x=>x.type!=="other");
}
async function fetchFolderImages(folderId, isSponsor=false){
  const q=encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType contains 'image/'`);
  const url=`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=name&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
  const r=await fetch(url); if(!r.ok) return [];
  const d=await r.json(); const w=isSponsor?SPONSOR_W:PHOTO_W;
  return (d.files||[]).map(f=>({id:f.id,name:f.name,createdTime:f.createdTime,url:`https://drive.google.com/thumbnail?id=${f.id}&sz=w${w}`}));
}

// ---------------------
// Slideshow
// ---------------------
function showCurrent(){
  clearImageTimer();
  if(!mediaItems.length){ if(currentEl) currentEl.remove(); return; }

  const it = mediaItems[currentIndex];
  let incoming;

  if (it.type === "image"){
    const pre = new Image(); pre.src = it.url;
    pre.onload = () => {
      // hideLoader();  // ← NIET meer automatisch; blijft staan tot op de fullscreen-knop geklikt wordt
      incoming = createImgEl();
      incoming.src = pre.src;
      if (FOTO_ANIMATIE === "kenburns"){
        incoming.classList.add("kenburns");
        incoming.style.setProperty("--kb-duration", Math.max(DISPLAY_TIME, 6000) + "ms");
      }
      containerEl.appendChild(incoming);
      requestAnimationFrame(() => {
        incoming.style.opacity = "1";
        if (currentEl) currentEl.style.opacity = "0";
      });
      setTimeout(() => {
        if (currentEl) currentEl.remove();
        currentEl = incoming;
        startImageTimer();
      }, FADE_MS);
    };
    pre.onerror = () => nextMedia(true);

  } else { // video
    // hideLoader();  // ← NIET meer automatisch
    incoming = createVideoEl();
    incoming.src = it.url;
    applyAudioTo(incoming);
    incoming.addEventListener("ended", () => nextMedia());
    incoming.addEventListener("error", () => nextMedia(true));
    containerEl.appendChild(incoming);
    requestAnimationFrame(() => {
      incoming.style.opacity = "1";
      if (currentEl) currentEl.style.opacity = "0";
    });
    setTimeout(() => {
      if (currentEl) currentEl.remove();
      currentEl = incoming;
    }, FADE_MS);
  }
}

function nextMedia(){ if(!mediaItems.length) return; currentIndex=(currentIndex+1)%mediaItems.length; showCurrent(); }

// ---------------------
// Sponsors (transform-scroll)
// ---------------------
function createSponsorTile(url){ const d=document.createElement("div"); d.className="sponsorItem"; d.style.backgroundImage=`url("${url}")`; return d; }

// ===== SUPER-SMOOTH SPONSORSCROLL (rAF + fallback) =====
let __scrollTimer = null;     // interval fallback
let __rafId = null;           // rAF id
let __trackEl = null;
let __loopH = 0;
let __offset = 0;

function startAutoScroll(){
  // stop vorige motor
  if (__scrollTimer){ clearInterval(__scrollTimer); __scrollTimer = null; }
  if (__rafId){ cancelAnimationFrame(__rafId); __rafId = null; }

  const track = sponsorColEl?.querySelector(".sponsorTrack");
  if (!track) return;

  __trackEl = track;
  __loopH   = track.scrollHeight / 2 || 0;
  __offset  = 0;

  // GPU hint & geen scrollbars
  track.style.willChange = 'transform';
  track.style.transform  = 'translateZ(0)';
  sponsorColEl.style.overflow = 'hidden';

  const SPEED = SCROLL_SPEED_PX_PER_SEC; // px/s
  let lastTs  = performance.now();
  let stagnantForMs = 0;
  const STALL_LIMIT = 600; // ms

  function step(ts){
    const dt = (ts - lastTs) / 1000;   // sec
    lastTs = ts;

    if (!__loopH) __loopH = __trackEl.scrollHeight / 2 || 0;

    // lineaire, tijd-gebaseerde beweging (super smooth)
    __offset += SPEED * dt;

    // naadloze loop
    if (__loopH && __offset >= __loopH) __offset -= __loopH;

    const prevTransform = __trackEl.style.transform;
    const nextTransform = `translate3d(0, -${__offset}px, 0)`;
    __trackEl.style.transform = nextTransform;

    // detecteer stagnatie (bv. tab in background op sommige devices)
    stagnantForMs = (prevTransform === nextTransform) ? (stagnantForMs + (dt*1000)) : 0;

    if (stagnantForMs > STALL_LIMIT){
      // fallback naar interval motor
      __rafId = null;
      startAutoScrollIntervalFallback(SPEED);
      return;
    }

    __rafId = requestAnimationFrame(step);
  }

  __rafId = requestAnimationFrame(step);
}

function startAutoScrollIntervalFallback(SPEED){
  if (__scrollTimer){ clearInterval(__scrollTimer); __scrollTimer = null; }
  const STEP = 16; // ~60fps
  __scrollTimer = setInterval(()=>{
    if (!__trackEl) return;
    if (!__loopH) __loopH = __trackEl.scrollHeight / 2 || 0;
    __offset += SPEED * (STEP/1000);
    if (__loopH && __offset >= __loopH) __offset -= __loopH;
    __trackEl.style.transform = `translate3d(0, -${__offset}px, 0)`;
  }, STEP);
}


function renderSponsorColumn(){
  if(!sponsorColEl) return;
  sponsorColEl.innerHTML = "";

  const list = sponsorImages && sponsorImages.length ? sponsorImages : [];
  if(!list.length) return;

  const track=document.createElement("div");
  track.className="sponsorTrack";
  track.style.display="flex"; track.style.flexDirection="column"; track.style.gap="12px";
  sponsorColEl.appendChild(track);

  // 1 set
  list.forEach(f=> track.appendChild(createSponsorTile(f.url)));
  // dup voor loop
  track.appendChild(track.cloneNode(true));
  // extra tot voldoende hoogte
  while (track.scrollHeight < sponsorColEl.clientHeight * 2 && track.children.length < 300){
    track.appendChild(track.cloneNode(true));
  }
  startAutoScroll();
}

async function refreshSponsorsFromDrive(){
  const files = await fetchFolderImages(SPONSOR_FOLDER_ID, true);
  if(files.length) sponsorImages = files;
  renderSponsorColumn();
}

// ---------------------
// Refresh media list
// ---------------------
async function refreshMedia(){
  const top = await fetchFolderMediaOrdered(TOP_FOLDER_ID);
  if(top.length){ mediaItems=top; }
  else{
    const live = await fetchFolderImages(LIVE_FOLDER_ID,false);
    mediaItems = live.map(x=>({type:'image',url:x.url,id:x.id,name:x.name}));
  }
  if(currentIndex>=mediaItems.length) currentIndex=0;
  if(lastRefreshEl){
    const now=new Date();
    lastRefreshEl.textContent = "Last update: " + now.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"});
  }
  showCurrent();
}

// ---------------------
// Init
// ---------------------
async function init(){
  containerEl   = document.querySelector(".slideshow");
  lastRefreshEl = document.getElementById("lastRefresh");
  noPhotosEl    = document.getElementById("noPhotosMsg");
  sponsorColEl  = document.getElementById("sponsorCol");
  audioBtn      = document.getElementById("audioToggle");

  if (sponsorColEl){ sponsorColEl.style.overflow = "hidden"; }

// ---------------------
// Init
// ---------------------
async function requestFullscreenAndHide(){
  try {
    await document.documentElement.requestFullscreen();
  } catch(e) {
    console.warn("Fullscreen niet toegestaan:", e);
  }
  // Na kleine vertraging fade loader uit
  setTimeout(() => { hideLoader(); }, 300);
}

async function init(){
  containerEl   = document.querySelector(".slideshow");
  lastRefreshEl = document.getElementById("lastRefresh");
  noPhotosEl    = document.getElementById("noPhotosMsg");
  sponsorColEl  = document.getElementById("sponsorCol");
  audioBtn      = document.getElementById("audioToggle");

  if (sponsorColEl){ sponsorColEl.style.overflow = "hidden"; }

  // --- Fullscreenknop + Enter/Space ---
  const fsBtn = document.getElementById("startFsBtn");
  if (fsBtn){
    fsBtn.addEventListener("click", requestFullscreenAndHide);

    // ENTER of SPACE activeert ook
    window.addEventListener('keydown', (e)=>{
      const loader = document.getElementById("loader");
      const visible = loader && !loader.classList.contains('fadeOut');
      if (!visible) return;

      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        requestFullscreenAndHide();
      }
    });
  }

  // --- Audio ---
  if(audioBtn){
    setAudioIcon();
    audioBtn.addEventListener("click", ()=>{
      audioEnabled = !audioEnabled;
      setAudioIcon();
      applyAudioTo(currentEl);
    });
  }

  // --- Data laden ---
  await Promise.all([refreshMedia(), refreshSponsorsFromDrive()]);
  sponsorTimer = setInterval(refreshSponsorsFromDrive, 5*60*1000);

  // --- Keep scroll alive ---
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'visible') startAutoScroll();
  });
  setInterval(()=>{
    const ok = sponsorColEl && sponsorColEl.querySelector('.sponsorTrack');
    if (ok && !__scrollTimer && !__rafId) startAutoScroll();
  }, 2000);
}

init();


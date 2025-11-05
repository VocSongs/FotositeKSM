// =====================
//  FOTOSITE KSM 2025
//  Slideshow + Sponsors
// =====================

// ***** GOOGLE DRIVE INSTELLINGEN *****
const API_KEY           = "AIzaSyCcCnm--0E_87Jl0_oHpGA6q7h5_ZoOong";
const LIVE_FOLDER_ID    = "1DPRvYwG-nluiePp3ZRuCFcseze5kAHp4";
const TOP_FOLDER_ID     = "1N8wfqj7BFtx-jAYj0qM8-uqJVbblWXw3";
const SPONSOR_FOLDER_ID = "18RJ4L_e30JlxDUcG945kWpcafy28KFIO";

// ***** ANIMATIEKEUZES *****
const FOTO_ANIMATIE    = "kenburns";        // "fade" | "kenburns"
let   SPONSOR_ANIMATIE = "smooth-scroll";   // "smooth-scroll" | "static"

// ***** GLOBALE INSTELLINGEN *****
const IS_MOBILE               = window.matchMedia("(max-width: 900px)").matches;
const LIVE_MAX_AGE_HOURS      = 2;
const DISPLAY_TIME            = 5000;
const FADE_MS                 = 1000;
const NUM_SPONSORS_VISIBLE    = 4;
const SPONSOR_REFRESH_INTERVAL= 5 * 60 * 1000;
const PHOTO_THUMB_WIDTH       = IS_MOBILE ? 1200 : 2000;
const SPONSOR_THUMB_WIDTH     = IS_MOBILE ? 600  : 800;

// Slideshow vars
let mediaItems = [];
let currentIndex = 0;
let currentEl = null;
let containerEl, lastRefreshEl, noPhotosEl, sponsorColEl;
let sponsorTimer;
let loaderHidden = false;
let canDismissLoader = false;

// Audio vars
let audioEnabled = false;
let audioBtn;

// Timerbeheer voor foto's
let imageTimerId = null;
function clearImageTimer(){ if(imageTimerId){ clearTimeout(imageTimerId); imageTimerId=null; } }
function startImageTimer(){ clearImageTimer(); imageTimerId=setTimeout(()=>nextMedia(), DISPLAY_TIME); }

// Scroll vars
const SCROLL_SPEED_PX_PER_SEC = 20;
let animationFrameId = null;
let lastScrollTick   = performance.now();

// ***** SMART-TV DETECTIE *****
function isSmartTV(){
  const ua = navigator.userAgent || "";
  return /(Web0S|Tizen|NetCast|HbbTV|Android\sTV|AppleTV|Viera|Bravia|TV\sBuild)/i.test(ua);
}
const IS_TV = isSmartTV();
SPONSOR_ANIMATIE = (IS_TV && /TV|SmartTV|Tizen|webOS/i.test(navigator.userAgent)) ? "static" : "smooth-scroll";
console.log("DEBUG → IS_TV =", IS_TV, "IS_MOBILE =", IS_MOBILE, "SPONSOR_ANIMATIE =", SPONSOR_ANIMATIE);

// ***** DRIVE HELPERS *****
async function fetchFolderMediaOrdered(folderId){
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=name&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
  const res = await fetch(url);
  if(!res.ok) return [];
  const data = await res.json();
  return (data.files||[]).map(f=>{
    const isImage=f.mimeType.startsWith("image/");
    const isVideo=f.mimeType.startsWith("video/");
    const imageUrl=`https://drive.google.com/thumbnail?id=${f.id}&sz=w${PHOTO_THUMB_WIDTH}`;
    const videoUrl=`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${API_KEY}`;
    return { id:f.id, name:f.name, createdTime:f.createdTime, type:isImage?"image":isVideo?"video":"other", url:isImage?imageUrl:videoUrl };
  }).filter(it=>it.type!=="other");
}

async function fetchFolderImages(folderId, isSponsor=false){
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType contains 'image/'`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=name&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
  const res = await fetch(url);
  if(!res.ok) return [];
  const data = await res.json();
  const width = isSponsor ? SPONSOR_THUMB_WIDTH : PHOTO_THUMB_WIDTH;
  return (data.files||[]).map(f=>({ id:f.id, name:f.name, createdTime:f.createdTime, url:`https://drive.google.com/thumbnail?id=${f.id}&sz=w${width}` }));
}

function filterRecentLivePhotos(files){
  const now=Date.now(), maxAge=LIVE_MAX_AGE_HOURS*3600000;
  return files.filter(f=> now - new Date(f.createdTime).getTime() <= maxAge );
}

// ***** UI HELPERS *****
function hideLoader(){
  if(!canDismissLoader || loaderHidden) return;
  const loader=document.getElementById("loader");
  if(loader) loader.classList.add("fadeOut");
  loaderHidden=true;
}

function createImgEl(){ const el=document.createElement("img"); el.className="slideImage"; el.style.opacity="0"; return el; }
function createVideoEl(){
  const el=document.createElement("video");
  el.className="slideVideo";
  el.playsInline=true;
  el.setAttribute("playsinline","");
  el.setAttribute("webkit-playsinline","");
  el.autoplay=true;
  el.loop=false;
  el.controls=false;
  el.muted=!audioEnabled;
  el.preload="auto";
  el.crossOrigin="anonymous";
  el.style.opacity="0";
  return el;
}

function setAudioIcon(){
  if(!audioBtn) return;
  audioBtn.textContent = audioEnabled ? "🔊" : "🔇";
  audioBtn.dataset.state = audioEnabled ? "unmuted" : "muted";
}
function applyAudioTo(el){
  if(!el || el.tagName!=="VIDEO") return;
  el.muted = !audioEnabled;
  if(audioEnabled) el.play().catch(()=>{});
}

// ***** SLIDESHOW *****
function showCurrent(){
  clearImageTimer();
  if(!mediaItems.length){ if(currentEl) currentEl.remove(); if(noPhotosEl) noPhotosEl.hidden=false; return; }
  if(noPhotosEl) noPhotosEl.hidden=true;

  const item = mediaItems[currentIndex];
  let incoming;

  if(item.type==="image"){
    const pre=new Image(); pre.src=item.url;
    pre.onload=()=>{
      hideLoader();
      incoming=createImgEl(); incoming.src=pre.src;
      if(FOTO_ANIMATIE==="kenburns"){ incoming.style.setProperty("--kb-duration",Math.max(DISPLAY_TIME,6000)+"ms"); incoming.classList.add("kenburns"); }
      containerEl.appendChild(incoming);
      requestAnimationFrame(()=>{ incoming.style.opacity="1"; if(currentEl) currentEl.style.opacity="0"; });
      setTimeout(()=>{ if(currentEl) currentEl.remove(); currentEl=incoming; startImageTimer(); },FADE_MS);
    };
    pre.onerror=()=>nextMedia(true);
  } else if(item.type==="video"){
    clearImageTimer(); hideLoader();
    incoming=createVideoEl(); incoming.src=item.url; applyAudioTo(incoming);
    incoming.addEventListener("ended",()=>nextMedia());
    containerEl.appendChild(incoming);
    requestAnimationFrame(()=>{ incoming.style.opacity="1"; if(currentEl) currentEl.style.opacity="0"; });
    setTimeout(()=>{ if(currentEl) currentEl.remove(); currentEl=incoming; },FADE_MS);
  }
}
function nextMedia(){ if(!mediaItems.length)return; currentIndex=(currentIndex+1)%mediaItems.length; showCurrent(); }

// ***** SPONSORS *****
let sponsorImages=[];
function createSponsorTile(url){ const d=document.createElement("div"); d.className="sponsorItem"; if(url) d.style.backgroundImage=`url("${url}")`; return d; }

async function refreshSponsorsFromDrive(){
  const files = await fetchFolderImages(SPONSOR_FOLDER_ID,true);
  if(files.length) sponsorImages = files;
  renderSponsorColumn();
}

// --- NAADLOZE SPONSOR-SCROLL met robuuste fallback (rAF -> setInterval) ---
function startSmoothScroll(){
  // Stop vorige engines
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (window.__sponsorIntervalId) { clearInterval(window.__sponsorIntervalId); window.__sponsorIntervalId = null; }

  const track = sponsorColEl?.querySelector(".sponsorTrack");
  if (!track || !sponsorColEl) return;

  let loopH = 0;
  const measure = () => { loopH = track.scrollHeight / 2; };
  measure();
  requestAnimationFrame(measure);

  let engine = 'raf';          // huidige motor: 'raf' of 'interval'
  let last = performance.now();
  let lastScroll = sponsorColEl.scrollTop;
  let stagnantMs = 0;          // hoe lang zonder beweging
  const STALL_LIMIT = 600;     // ms zonder beweging voordat we switchen

  function step(ts){
    const dt = (ts - last) / 1000;
    last = ts;

    // vooruitgang
    sponsorColEl.scrollTop += SCROLL_SPEED_PX_PER_SEC * dt;

    // meet loophoogte (bij traag ladende images)
    if (!loopH) loopH = track.scrollHeight / 2;

    // naadloze reset
    if (loopH && sponsorColEl.scrollTop >= loopH){
      sponsorColEl.scrollTop -= loopH;
    }

    // detecteer stilstand
    if (Math.abs(sponsorColEl.scrollTop - lastScroll) < 0.5) {
      stagnantMs += (dt * 1000);
    } else {
      stagnantMs = 0;
      lastScroll = sponsorColEl.scrollTop;
    }

    // als rAF stilvalt -> switch naar interval
    if (engine === 'raf' && stagnantMs > STALL_LIMIT){
      engine = 'interval';
      animationFrameId && cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      // ~60fps interval; geen dt-afhankelijke drift (we gebruiken 16ms stap)
      window.__sponsorIntervalId = setInterval(()=>{
        const stepDt = 16 / 1000;
        sponsorColEl.scrollTop += SCROLL_SPEED_PX_PER_SEC * stepDt;
        if (!loopH) loopH = track.scrollHeight / 2;
        if (loopH && sponsorColEl.scrollTop >= loopH){
          sponsorColEl.scrollTop -= loopH;
        }
        lastScrollTick = performance.now();
      }, 16);
      return; // stop rAF-loop
    }

    lastScrollTick = ts;
    animationFrameId = requestAnimationFrame(step);
  }

  // start rAF-engine
  animationFrameId = requestAnimationFrame(step);

  // safety: als track of container opnieuw wordt opgebouwd, herstart
  setTimeout(()=>{
    const hasTrack = sponsorColEl && sponsorColEl.querySelector('.sponsorTrack');
    if (!hasTrack) startSmoothScroll();
  }, 1200);
}


function renderSponsorColumn(){
  if(!sponsorColEl) return;
  sponsorColEl.innerHTML="";
  if(SPONSOR_ANIMATIE==="smooth-scroll"){
    const track=document.createElement("div");
    track.className="sponsorTrack";
    track.style.display="flex";
    track.style.flexDirection="column";
    track.style.gap="12px";
    sponsorColEl.appendChild(track);
    const list=sponsorImages.length?sponsorImages:[];
    if(list.length){
      const frag=document.createDocumentFragment();
      list.forEach(f=>frag.appendChild(createSponsorTile(f.url)));
      track.appendChild(frag.cloneNode(true));
      track.appendChild(frag.cloneNode(true));
    }
    startSmoothScroll(); return;
  }
  // fallback
  const list=sponsorImages.length?sponsorImages:[]; 
  const take=Math.max(NUM_SPONSORS_VISIBLE,list.length);
  for(let i=0;i<take;i++){ const f=list[i%(list.length||1)]; sponsorColEl.appendChild(createSponsorTile(f.url)); }
}

// ***** REFRESH MEDIA *****
async function refreshMedia(){
  const topMedia=await fetchFolderMediaOrdered(TOP_FOLDER_ID);
  mediaItems = topMedia.length ? topMedia : filterRecentLivePhotos(await fetchFolderImages(LIVE_FOLDER_ID,false)).map(x=>({type:'image',url:x.url,id:x.id,name:x.name}));
  if(currentIndex>=mediaItems.length) currentIndex=0;
  const now=new Date();
  if(lastRefreshEl) lastRefreshEl.textContent="Last update: "+ now.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"});
  showCurrent();
}

// ***** INIT *****
async function init(){
  containerEl=document.querySelector(".slideshow");
  lastRefreshEl=document.getElementById("lastRefresh");
  noPhotosEl=document.getElementById("noPhotosMsg");
  sponsorColEl=document.getElementById("sponsorCol");   // ✅ fix
  if(sponsorColEl){
    sponsorColEl.style.overflowY='auto';
    sponsorColEl.style.scrollBehavior='auto';
    sponsorColEl.classList.add('noScrollbars');
    const style=document.createElement('style');
    style.textContent=`.noScrollbars{scrollbar-width:none;-ms-overflow-style:none}.noScrollbars::-webkit-scrollbar{display:none}`;
    document.head.appendChild(style);
  }
  audioBtn=document.getElementById("audioToggle");

  // Fullscreen via loader
  const fsBtn=document.getElementById('startFsBtn');
  if(fsBtn){
    fsBtn.addEventListener('click',async()=>{ try{await document.documentElement.requestFullscreen();}catch(e){} canDismissLoader=true; hideLoader(); fsBtn.blur(); });
  }

  if(audioBtn){
    setAudioIcon();
    audioBtn.addEventListener("click",()=>{ audioEnabled=!audioEnabled; setAudioIcon(); applyAudioTo(currentEl); });
  }

  await Promise.all([refreshMedia(),refreshSponsorsFromDrive()]);
  sponsorTimer=setInterval(refreshSponsorsFromDrive,SPONSOR_REFRESH_INTERVAL);

if (SPONSOR_ANIMATIE === 'smooth-scroll'){
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') startSmoothScroll();
  });
  setInterval(() => {
    const hasTrack = sponsorColEl && sponsorColEl.querySelector('.sponsorTrack');
    const tooLong  = (performance.now() - lastScrollTick) > 3000;
    // herstart als er iets vastloopt
    if (!hasTrack || tooLong || !animationFrameId) startSmoothScroll();
  }, 2000);
}

// ✅ init() hoort HIER — buiten de if
init();


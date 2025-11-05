// ***** GOOGLE DRIVE INSTELLINGEN *****
const API_KEY           = "AIzaSyCcCnm--0E_87Jl0_oHpGA6q7h5_ZoOong";
const LIVE_FOLDER_ID    = "1DPRvYwG-nluiePp3ZRuCFcseze5kAHp4";
const TOP_FOLDER_ID     = "1N8wfqj7BFtx-jAYj0qM8-uqJVbblWXw3";   // Curatiemappen (geordend op naam)
const SPONSOR_FOLDER_ID = "18RJ4L_e30JlxDUcG945kWpcafy28KFIO";

// ***** ANIMATIEKEUZES *****
const FOTO_ANIMATIE    = "kenburns";        // "fade" | "fade-zoom" | "slide" | "kenburns"
let   SPONSOR_ANIMATIE = "smooth-scroll";   // "slide-up" | "smooth-scroll" | "fade" | "glow"

// ***** GLOBALE INSTELLINGEN *****
const IS_MOBILE               = window.matchMedia("(max-width: 900px)").matches;
const LIVE_MAX_AGE_HOURS      = 2;
const DISPLAY_TIME            = 7000;
const FADE_MS                 = 1000;
const NUM_SPONSORS_VISIBLE    = 4;
const SPONSOR_REFRESH_INTERVAL= 5 * 60 * 1000;
const PHOTO_THUMB_WIDTH       = IS_MOBILE ? 1200 : 2000;
const SPONSOR_THUMB_WIDTH     = IS_MOBILE ? 600  : 800;

// Initialisatie in init()


window.addEventListener('keydown', e => {
  if (e.key === 'F11') setTimeout(updateFsHint, 800);
});

// Slideshow
let mediaItems   = [];  // [{type:'image'|'video', url, id, name}]
let currentIndex = 0;
let currentEl    = null;
let containerEl, lastRefreshEl, noPhotosEl, sponsorColEl;
let slideTimer, sponsorTimer;
let loaderHidden = false;

// Audio
let audioEnabled = false; // start muted
let audioBtn;

// Smooth scroll vars
const SCROLL_SPEED_PX_PER_SEC = 15;
const SCROLL_EASE_FACTOR      = 0.08;
let animationFrameId = null;
let lastScrollTick   = performance.now();
let lastTime         = 0;
let scrollOffset     = 0;
let scrollTarget     = 0;

// ***** SMART TV DETECTIE & FALLBACK *****
function isSmartTV(){
  const ua = navigator.userAgent || "";
  return /(Web0S|NetCast|Tizen|SmartTV|SamsungBrowser|Android TV|Opera TV)/i.test(ua);
}
const IS_TV = isSmartTV();
if (IS_TV) {
  // Op TV vaste weergave voor sponsors — betrouwbaarder
  SPONSOR_ANIMATIE = "static";
  console.log("Smart TV gedetecteerd – sponsor-fallback actief.");
}

// ***** DRIVE HELPERS *****
async function fetchFolderMediaOrdered(folderId){
  // Haal *alle* media (image + video) op, geordend op naam (A→Z)
  const q   = encodeURIComponent(`'${folderId}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=name&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) { console.error("Drive API error:", res.status, res.statusText); return []; }
  const data = await res.json();
  return (data.files || []).map(f => {
    const isImage = f.mimeType.startsWith("image/");
    const isVideo = f.mimeType.startsWith("video/");
    // Voor publieke bestanden op Drive:
    const imageUrl = `https://drive.google.com/thumbnail?id=${f.id}&sz=w${PHOTO_THUMB_WIDTH}`;
   const videoUrl = `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${API_KEY}`; // werkt voor publieke mp4's
    return {
      id: f.id,
      name: f.name,
      createdTime: f.createdTime,
      mime: f.mimeType,
      type: isImage ? "image" : (isVideo ? "video" : "other"),
      url: isImage ? imageUrl : videoUrl
    };
  }).filter(it => it.type === "image" || it.type === "video");
}

async function fetchFolderImages(folderId, isSponsor=false){
  const q   = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType contains 'image/'`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=name&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) { console.error("Drive API error:", res.status, res.statusText); return []; }
  const data = await res.json();
  const width = isSponsor ? SPONSOR_THUMB_WIDTH : PHOTO_THUMB_WIDTH;
  return (data.files || []).map(f => ({
    id: f.id,
    name: f.name,
    createdTime: f.createdTime,
    url: `https://drive.google.com/thumbnail?id=${f.id}&sz=w${width}`,
  }));
}

function filterRecentLivePhotos(files){
  const now=Date.now(), maxAge=LIVE_MAX_AGE_HOURS*3600000;
  return files.filter(f=> now - new Date(f.createdTime).getTime() <= maxAge );
}

// ***** UI HELPERS *****
function hideLoader(){ if (loaderHidden) return; const loader=document.getElementById("loader"); if(loader){ loader.classList.add("fadeOut"); } loaderHidden=true; }

function createImgEl(){
  const el=document.createElement("img");
  el.className="slideImage";
  el.style.opacity="0";
  return el;
}
function createVideoEl(){
  const el = document.createElement("video");
  el.className = "slideVideo";
  el.playsInline = true;
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.autoplay   = true;
  el.loop       = false;
  el.controls   = false;
  el.muted      = !audioEnabled; // starttoestand (autoplay-safe)
  el.preload    = "auto";
  el.crossOrigin = "anonymous";  // belangrijk voor Drive-stream
  el.style.opacity="0";
  return el;
}

function setAudioIcon(){
  if(!audioBtn) return;
  if(audioEnabled){
    audioBtn.textContent = "🔊";
    audioBtn.dataset.state = "unmuted";
  }else{
    audioBtn.textContent = "🔇";
    audioBtn.dataset.state = "muted";
  }
}
function applyAudioTo(el){
  if(!el) return;
  if (el.tagName === "VIDEO"){
    el.muted = !audioEnabled;
    // Als audio net aangezet is, herstart of speel verder met geluid
    if (audioEnabled) {
      const p = el.play();
      if (p && typeof p.catch === "function") { p.catch(()=>{}); }
    }
  }
}

// ***** SLIDESHOW LOGICA *****
function showCurrent(){
  if (!mediaItems.length){
    if(currentEl){ currentEl.remove(); currentEl=null; }
    if(noPhotosEl) noPhotosEl.style.opacity=1;
    return;
  }
  if(noPhotosEl) noPhotosEl.style.opacity=0;

  const item = mediaItems[currentIndex];
  let incoming;

  if(item.type === "image"){
    const pre = new Image();
    pre.src = item.url;
    pre.onload = ()=>{
      hideLoader();
      incoming = createImgEl();
      incoming.src = pre.src;
      if(FOTO_ANIMATIE==="kenburns"){
        incoming.style.transform="scale(1.03) translate(0px,0px)";
        incoming.style.setProperty("--kb-duration", Math.max(DISPLAY_TIME,6000)+"ms");
      }
      containerEl.appendChild(incoming);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(FOTO_ANIMATIE==="kenburns") incoming.classList.add("kenburns");
        incoming.style.opacity="1";
        if(currentEl) currentEl.style.opacity="0";
      }));
      setTimeout(()=>{
        if(currentEl) currentEl.remove();
        currentEl = incoming;
      }, FADE_MS);
    };
    pre.onerror = ()=>{ nextMedia(true); };
  } else if (item.type === "video"){
    hideLoader();
    incoming = createVideoEl();
    incoming.src = item.url;
    // Als audioEnabled, onmiddellijk on-mute
    applyAudioTo(incoming);
    // Hint het formattype
    incoming.type = "video/mp4";

    incoming.addEventListener("ended", ()=> { nextMedia(); });
    incoming.addEventListener("error", ()=> { nextMedia(true); });
    // Als video niet binnen 15s start, skippen
    const startTimeout = setTimeout(()=>{
      if(incoming.readyState < 2){ nextMedia(true); }
    }, 15000);

    incoming.addEventListener("canplay", ()=>{
      clearTimeout(startTimeout);
      incoming.play().catch(()=>{});
    });

    containerEl.appendChild(incoming);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      incoming.style.opacity="1";
      if(currentEl) currentEl.style.opacity="0";
    }));
    setTimeout(()=>{
      if(currentEl) currentEl.remove();
      currentEl = incoming;
    }, FADE_MS);
  }
}

function nextMedia(skipDelay=false){
  if(!mediaItems.length) return;
  currentIndex = (currentIndex + 1) % mediaItems.length;
  if(skipDelay){
    showCurrent();
  }else{
    showCurrent();
  }
}

// ***** SPONSORS *****

function createSponsorTile(url){
  const item = document.createElement("div");
  item.className = "sponsorItem";
  if (url) item.style.backgroundImage = `url("${url}")`;
  return item;
}

async function refreshSponsorsFromDrive(){
  const files = await fetchFolderImages(SPONSOR_FOLDER_ID,true);
  if(files.length) sponsorImages = files; // geordend op naam
  renderSponsorColumn();
}

let sponsorImages = [];

function startSmoothScroll(){
  if(animationFrameId) cancelAnimationFrame(animationFrameId);
  const track = sponsorColEl?.querySelector(".sponsorTrack");
  if(!track) return;
  scrollOffset = 0; scrollTarget = 0; lastTime = 0;
  function step(ts){
    if(!lastTime) lastTime = ts;
    const delta = (ts - lastTime) / 1000;
    lastTime = ts;
    scrollTarget += SCROLL_SPEED_PX_PER_SEC * delta;
    scrollOffset += (scrollTarget - scrollOffset) * SCROLL_EASE_FACTOR;
    if(scrollOffset >= track.scrollHeight / 2){
      scrollOffset = 0;
      scrollTarget = 0;
    }
    sponsorColEl.scrollTop = scrollOffset;
    lastScrollTick = ts;
    animationFrameId = requestAnimationFrame(step);
  }
  animationFrameId = requestAnimationFrame(step);
}

function renderSponsorColumn(){
  if(!sponsorColEl) return;
  sponsorColEl.innerHTML="";

  // Fallback voor Smart TV: statische grid
  if (SPONSOR_ANIMATIE === "static"){
    const list = sponsorImages.length ? sponsorImages : [];
    list.forEach(file => {
      const item = createSponsorTile(file && file.url ? file.url : null);
      sponsorColEl.appendChild(item);
    });
    return;
  }

  if(SPONSOR_ANIMATIE==="smooth-scroll" && !IS_MOBILE){
    const track=document.createElement("div");
    track.className="sponsorTrack";
    track.style.display="flex";
    track.style.flexDirection="column";
    track.style.gap="24px";
    sponsorColEl.appendChild(track);

    const list = sponsorImages.length ? sponsorImages : [];
    // Dupliceer voor oneindige scroll
    for(let k=0;k<2;k++){
      list.forEach(file=>{
        const item = createSponsorTile(file && file.url ? file.url : null);
        track.appendChild(item);
      });
    }
    startSmoothScroll();
    return;
  }

  // Fallback voor andere animatiestanden: toon een paar
  const list = sponsorImages.length ? sponsorImages : [];
  const take = Math.max(NUM_SPONSORS_VISIBLE, list.length);
  for(let i=0; i<take; i++){
    const file=list[i%list.length];
    const item = createSponsorTile(file && file.url ? file.url : null);
    sponsorColEl.appendChild(item);
  }
}

// ***** REFRESH MEDIA *****
async function refreshMedia(){
  // Voorkeur: TOP-folder als geordende "curatie"-lijst (incl. video)
  const topMedia  = await fetchFolderMediaOrdered(TOP_FOLDER_ID);
  if (topMedia.length){
    mediaItems = topMedia;
  } else {
    // fallback op LIVE recente foto's (alleen images, zoals oorspronkelijk)
    const liveImgs = await fetchFolderImages(LIVE_FOLDER_ID,false);
    mediaItems = filterRecentLivePhotos(liveImgs).map(x=>({type:'image', url:x.url, id:x.id, name:x.name}));
  }

  if(currentIndex >= mediaItems.length) currentIndex = 0;

  const now=new Date();
  if(lastRefreshEl)
    lastRefreshEl.textContent="Last update: "+
      now.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"});

  showCurrent();
}

async function init(){
  containerEl   = document.querySelector(".slideshow");
  lastRefreshEl = document.getElementById("lastRefresh");
  noPhotosEl    = document.getElementById("noPhotosMsg");
  sponsorColEl  = document.getElementById("sponsorCol");
  audioBtn      = document.getElementById("audioToggle");

  
  // Fullscreen via loader-knop
  const fsBtn = document.getElementById('startFsBtn');
  if (fsBtn){
    fsBtn.addEventListener('click', async () => {
      try { await document.documentElement.requestFullscreen(); } catch(e) {}
      fsBtn.blur();
    });
  }
// Fullscreen-hint setup (géén wireFsHintClose meer nodig)
  window.addEventListener('keydown', e => {
    if (e.key === 'F11') setTimeout(updateFsHint, 800);
  });

  // Audio toggle
  if (audioBtn){
    setAudioIcon();
    audioBtn.addEventListener("click", ()=>{
      audioEnabled = !audioEnabled;
      setAudioIcon();
      applyAudioTo(currentEl);
    });
  }

  await Promise.all([refreshMedia(), refreshSponsorsFromDrive()]);

  // Timer voor foto's (video's sturen zelf 'ended')
  setInterval(()=>{
    if(!mediaItems.length) return;
    const cur = mediaItems[currentIndex];
    if(cur && cur.type === "image") nextMedia();
  }, DISPLAY_TIME);

  sponsorTimer = setInterval(refreshSponsorsFromDrive, SPONSOR_REFRESH_INTERVAL);

  // Watchdog smooth-scroll
  if (SPONSOR_ANIMATIE === 'smooth-scroll' && !IS_MOBILE){
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') startSmoothScroll();
    });
    setInterval(() => {
      const hasTrack = sponsorColEl && sponsorColEl.querySelector('.sponsorTrack');
      const tooLong  = (performance.now() - lastScrollTick) > 3000;
      if (!animationFrameId || !hasTrack || tooLong) startSmoothScroll();
    }, 2000);
  }
}
init();

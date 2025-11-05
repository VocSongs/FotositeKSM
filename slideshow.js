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
const DISPLAY_TIME            = 5000;  // ms per foto
const FADE_MS                 = 1000;
const NUM_SPONSORS_VISIBLE    = 4;
const SPONSOR_REFRESH_INTERVAL= 5 * 60 * 1000;
const PHOTO_THUMB_WIDTH       = IS_MOBILE ? 1200 : 2000;
const SPONSOR_THUMB_WIDTH     = IS_MOBILE ? 600  : 800;

// Slideshow
let mediaItems   = [];
let currentIndex = 0;
let currentEl    = null;
let containerEl, lastRefreshEl, noPhotosEl, sponsorColEl;
let sponsorTimer;
let loaderHidden = false;
let canDismissLoader = false;

// Audio
let audioEnabled = false; // start muted
let audioBtn;

// --- Image timing control (pauze tijdens video) ---
let imageTimerId = null;
function clearImageTimer(){
  if (imageTimerId){ clearTimeout(imageTimerId); imageTimerId = null; }
}
function startImageTimer(){
  clearImageTimer();
  imageTimerId = setTimeout(()=>{ nextMedia(); }, DISPLAY_TIME);
}

// Smooth scroll vars
const SCROLL_SPEED_PX_PER_SEC = 20;
let animationFrameId = null;
let lastScrollTick   = performance.now();

// ***** SMART TV DETECTIE & FALLBACK (veilig en voorspelbaar) *****
function isSmartTV(){
  const ua = navigator.userAgent || "";
  // Alleen echte TV-platforms; geen SamsungBrowser op desktop/phone
  return /(Web0S|Tizen|NetCast|HbbTV|Android\sTV|AppleTV|Viera|Bravia|TV\sBuild)/i.test(ua);
}

const IS_TV = isSmartTV();

// Standaard ALTIJD smooth-scroll…
SPONSOR_ANIMATIE = "smooth-scroll";

// …tenzij het echt een TV-UA is (dan static)
if (IS_TV && /TV|SmartTV|Tizen|webOS/i.test(navigator.userAgent)) {
  SPONSOR_ANIMATIE = "static";
  console.log("Smart-TV-fallback actief");
}

console.log("DEBUG → UA:", navigator.userAgent);
console.log("DEBUG → IS_TV =", IS_TV, "IS_MOBILE =", IS_MOBILE, "SPONSOR_ANIMATIE =", SPONSOR_ANIMATIE);


// ***** DRIVE HELPERS *****
async function fetchFolderMediaOrdered(folderId){
  const q   = encodeURIComponent(`'${folderId}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=name&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) { console.error("Drive API error:", res.status, res.statusText); return []; }
  const data = await res.json();
  return (data.files || []).map(f => {
    const isImage = f.mimeType.startsWith("image/");
    const isVideo = f.mimeType.startsWith("video/");
    const imageUrl = `https://drive.google.com/thumbnail?id=${f.id}&sz=w${PHOTO_THUMB_WIDTH}`;
    const videoUrl = `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${API_KEY}`;
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
function hideLoader(){
  if (!canDismissLoader || loaderHidden) return;
  const loader = document.getElementById("loader");
  if (loader) loader.classList.add("fadeOut");
  loaderHidden = true;
}

function createImgEl(){
  const el = document.createElement("img");
  el.className = "slideImage";
  el.style.opacity = "0";
  return el;
}
function createVideoEl(){
  const el = document.createElement("video");
  el.className = "slideVideo";
  el.playsInline = true;
  el.setAttribute("playsinline","");
  el.setAttribute("webkit-playsinline","");
  el.autoplay   = true;
  el.loop       = false;
  el.controls   = false;
  el.muted      = !audioEnabled;
  el.preload    = "auto";
  el.crossOrigin = "anonymous";
  el.style.opacity = "0";
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
    if (audioEnabled) {
      const p = el.play();
      if (p && typeof p.catch === "function") { p.catch(()=>{}); }
    }
  }
}

// ***** SLIDESHOW LOGICA *****
function showCurrent(){
  // reset image timer bij elke overgang
  clearImageTimer();

  if (!mediaItems.length){
    if(currentEl){ currentEl.remove(); currentEl=null; }
    if(noPhotosEl) noPhotosEl.hidden = false;
    return;
  }
  if(noPhotosEl) noPhotosEl.hidden = true;

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
        // start per-image timer NA de fade
        startImageTimer();
      }, FADE_MS);
    };
    pre.onerror = ()=>{ nextMedia(true); };
  } else if (item.type === "video"){
    clearImageTimer();
    hideLoader();
    incoming = createVideoEl();
    incoming.src = item.url;
    incoming.type = "video/mp4";
    applyAudioTo(incoming);

    incoming.addEventListener("ended", ()=> { nextMedia(); });
    incoming.addEventListener("error", ()=> { nextMedia(true); });

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

function nextMedia(){
  if(!mediaItems.length) return;
  currentIndex = (currentIndex + 1) % mediaItems.length;
  showCurrent();
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
  if(files.length) sponsorImages = files;
  renderSponsorColumn();
}

let sponsorImages = [];

// Naadloos scrollen (lineair; geen sprong)
function startSmoothScroll(){
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  const track = sponsorColEl?.querySelector(".sponsorTrack");
  if (!track) return;

  let loopH = 0;
  // direct meten én nog eens na layout; daarna blijven we meten tot bekend
  const measure = () => { loopH = track.scrollHeight / 2; };
  measure();
  requestAnimationFrame(measure);

  let last = performance.now();
  function step(ts){
    const dt = (ts - last) / 1000;
    last = ts;

    sponsorColEl.scrollTop += SCROLL_SPEED_PX_PER_SEC * dt;

    // Als loopH (nog) niet bekend is (images laden), blijf 'm proberen te meten
    if (!loopH) loopH = track.scrollHeight / 2;

    // naadloze reset zodra we voorbij 1 set zijn
    if (loopH && sponsorColEl.scrollTop >= loopH){
      sponsorColEl.scrollTop -= loopH;
    }

    lastScrollTick = ts;
    animationFrameId = requestAnimationFrame(step);
  }

  animationFrameId = requestAnimationFrame(step);
}

function renderSponsorColumn(){
  if (!sponsorColEl) return;
  sponsorColEl.innerHTML = "";

  if (SPONSOR_ANIMATIE === "smooth-scroll"){
    const track = document.createElement("div");
    track.className = "sponsorTrack";
    track.style.display = "flex";
    track.style.flexDirection = "column";
    track.style.gap = "12px";
    sponsorColEl.appendChild(track);

    const list = sponsorImages.length ? sponsorImages : [];
    if (list.length){
      const frag = document.createDocumentFragment();
      list.forEach(file => {
        const item = createSponsorTile(file && file.url ? file.url : null);
        frag.appendChild(item);
      });

      // Minstens 2 sets
      track.appendChild(frag.cloneNode(true));
      track.appendChild(frag.cloneNode(true));

      // Extra sets bijplakken totdat scroll zichtbaar is (veiligheidsmarge)
      const minHeight = sponsorColEl.clientHeight * 2;
      let safety = 0;
      while (track.scrollHeight < minHeight && safety < 10){
        track.appendChild(frag.cloneNode(true));
        safety++;
      }
    }

    startSmoothScroll();
    return;
  }

  // Fallback: statisch
  const list = sponsorImages.length ? sponsorImages : [];
  const take = Math.max(NUM_SPONSORS_VISIBLE, list.length);
  for (let i = 0; i < take; i++){
    const file = list[i % (list.length || 1)];
    const item = createSponsorTile(file && file.url ? file.url : null);
    sponsorColEl.appendChild(item);
  }
}

// ***** REFRESH MEDIA *****
async function refreshMedia(){
  const topMedia  = await fetchFolderMediaOrdered(TOP_FOLDER_ID);
  if (topMedia.length){
    mediaItems = topMedia;
  } else {
    const liveImgs = await fetchFolderImages(LIVE_FOLDER_ID,false);
    mediaItems = filterRecentLivePhotos(liveImgs).map(x=>({type:'image', url:x.url, id:x.id, name:x.name}));
  }
  if(currentIndex >= mediaItems.length) currentIndex = 0;

  const now=new Date();
  if(lastRefreshEl)
    lastRefreshEl.textContent="Last update: "+ now.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"});

  showCurrent();
}

// ***** INIT *****
async function init(){
  containerEl   = document.querySelector(".slideshow");
  lastRefreshEl = document.getElementById("lastRefresh");
  noPhotosEl    = document.getElementById("noPhotosMsg");
  if (sponsorColEl){
  // programmatic scroll aanzetten en smooth uitschakelen
  sponsorColEl.style.overflowY = 'auto';
  sponsorColEl.style.scrollBehavior = 'auto';

  // scrollbar onzichtbaar maken (maar wel scrollbaar)
  sponsorColEl.classList.add('noScrollbars');
  const style = document.createElement('style');
  style.textContent = `
    .noScrollbars { scrollbar-width: none; -ms-overflow-style: none; }
    .noScrollbars::-webkit-scrollbar { display: none; }
  `;
  document.head.appendChild(style);
}

  audioBtn      = document.getElementById("audioToggle");

  // Fullscreen via loader-knop
  const fsBtn = document.getElementById('startFsBtn');
  if (fsBtn){
    fsBtn.addEventListener('click', async () => {
      try { await document.documentElement.requestFullscreen(); } catch(e) {}
      canDismissLoader = true;   // loader mag nu weg
      hideLoader();
      fsBtn.blur();
    });
  }

  // Audio toggle
  if(audioBtn){
    setAudioIcon();
    audioBtn.addEventListener("click", ()=>{
      audioEnabled = !audioEnabled;
      setAudioIcon();
      applyAudioTo(currentEl);
    });
  }

  await Promise.all([refreshMedia(), refreshSponsorsFromDrive()]);
  // per-image timer wordt gestart in showCurrent() -> startImageTimer()

  sponsorTimer = setInterval(refreshSponsorsFromDrive, SPONSOR_REFRESH_INTERVAL);

  if (SPONSOR_ANIMATIE === 'smooth-scroll'){
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

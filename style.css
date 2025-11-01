/***** CONFIG *****/
const API_KEY              = "AIzaSyCcCnm--0E_87Jl0_oHpGA6q7h5_ZoOong";
const LIVE_FOLDER_ID       = "1DPRvYwG-nluiePp3ZRuCFcseze5kAHp4";
const TOP_FOLDER_ID        = "1N8wfqj7BFtx-jAYj0qM8-uqJVbblWXw3";
const SPONSOR_FOLDER_ID    = "18RJ4L_e30JlxDUcG945kWpcafy28KFIO";

/* Kies animaties */
const FOTO_ANIMATIE        = "kenburns";      // "fade" | "fade-zoom" | "slide" | "kenburns"
const SPONSOR_ANIMATIE     = "smooth-scroll"; // "slide-up" | "smooth-scroll" | "fade" | "glow"

const IS_MOBILE            = window.matchMedia("(max-width: 900px)").matches;
const LIVE_MAX_AGE_HOURS   = 2;
const DISPLAY_TIME         = 7000;                 // >6s oogt beter voor Ken Burns
const REFRESH_INTERVAL     = (IS_MOBILE ? 90 : 45) * 60000;
const FADE_MS              = 1000;
const NUM_SPONSORS_VISIBLE = 4;
const SPONSOR_REFRESH_INTERVAL = 5 * 60 * 1000;

const PHOTO_THUMB_WIDTH    = IS_MOBILE ? 1200 : 2000;
const SPONSOR_THUMB_WIDTH  = IS_MOBILE ?  600 :  800;

/***** STATE *****/
let slideshowImages = [];
let sponsorImages   = [];
let currentIndex    = 0;

let containerEl, lastRefreshEl, noPhotosEl, sponsorColEl, currentImgEl;
let slideTimer, refreshTimer, sponsorTimer, smoothScrollTimer;
let loaderHidden = false;

/***** DRIVE HELPERS *****/
async function fetchFolderImages(folderId, isSponsor=false){
  const q   = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType contains 'image/'`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
  const res = await fetch(url);
  if(!res.ok){
    console.error("Drive API error:", folderId, res.status, res.statusText);
    return [];
  }
  const data  = await res.json();
  const width = isSponsor ? SPONSOR_THUMB_WIDTH : PHOTO_THUMB_WIDTH;
  return (data.files||[]).map(f=>({
    id: f.id,
    name: f.name,
    createdTime: f.createdTime,
    url: `https://drive.google.com/thumbnail?id=${f.id}&sz=w${width}`
  }));
}

function filterRecentLivePhotos(files){
  const maxAge = LIVE_MAX_AGE_HOURS * 3600000;
  const now    = Date.now();
  return files.filter(f => (now - new Date(f.createdTime).getTime()) <= maxAge);
}
function shuffleArray(a){
  const arr = [...a];
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function buildSlideshowList(top, live){
  return shuffleArray([...live, ...top]);
}

/***** PHOTO SLIDESHOW *****/
function createLayeredImgElement(){
  const el = document.createElement("img");
  el.className = "slideImage";
  el.style.opacity = "0";
  return el;
}
function hideLoader(){
  if(loaderHidden) return;
  const loader = document.getElementById("loader");
  if(loader) loader.classList.add("fadeOut");
  loaderHidden = true;
}

function crossfadeToCurrent(){
  if(!slideshowImages.length){
    if(currentImgEl){ currentImgEl.remove(); currentImgEl = null; }
    if(noPhotosEl) noPhotosEl.style.opacity = 1;
    return;
  }
  if(noPhotosEl) noPhotosEl.style.opacity = 0;

  const photo = slideshowImages[currentIndex];
  const pre   = new Image();
  pre.src     = photo.url;

  pre.onload = () => {
    hideLoader();
    const incoming = createLayeredImgElement();
    incoming.src = pre.src;

    // Setup effect vóór in DOM plaatsen
    if(FOTO_ANIMATIE==="kenburns"){
      incoming.style.transform       = "scale(1.03) translate(-12px, -8px)";
      incoming.style.transformOrigin = "50% 50%";
      incoming.style.willChange      = "transform";
      incoming.style.setProperty("--kb-duration", Math.max(DISPLAY_TIME, 6000) + "ms");
    } else if(FOTO_ANIMATIE==="fade-zoom"){
      incoming.classList.add("slide-incoming","fade-zoom");
    } else if(FOTO_ANIMATIE==="slide"){
      incoming.classList.add("slide-incoming","slide-from-right");
    }

    containerEl.appendChild(incoming);

    requestAnimationFrame(()=>{ requestAnimationFrame(()=>{
      if(FOTO_ANIMATIE==="kenburns") incoming.classList.add("kenburns");
      incoming.style.opacity = "1";
      if(FOTO_ANIMATIE==="fade-zoom") incoming.style.transform = "scale(1.00)";
      if(currentImgEl) currentImgEl.style.opacity = "0";
      if(FOTO_ANIMATIE==="slide" && currentImgEl){
        currentImgEl.classList.add("slide-outgoing","slide-to-left");
      }
    });});

    setTimeout(()=>{
      if(currentImgEl) currentImgEl.remove();
      currentImgEl = incoming;
      incoming.classList.remove("slide-incoming","fade-zoom","slide-from-right");
    }, FADE_MS);
  };

  pre.onerror = () => {
    // sla deze over
    currentIndex = (currentIndex + 1) % slideshowImages.length;
    crossfadeToCurrent();
  };
}

function nextImage(){
  if(!slideshowImages.length) return;
  currentIndex = (currentIndex + 1) % slideshowImages.length;
  applySponsorSwitchEffect();
  crossfadeToCurrent();
}

/***** SPONSORS *****/
function createSponsorTile(url){
  const item = document.createElement("div");
  item.className = "sponsorItem";
  const fill = document.createElement("div");
  fill.className = "sponsorFill";
  if(url) fill.style.backgroundImage = `url("${url}")`;
  item.appendChild(fill);
  return item;
}

async function refreshSponsorsFromDrive(){
  if(!SPONSOR_FOLDER_ID){
    sponsorImages = [];
    renderSponsorColumn();
    return;
  }
  const files = await fetchFolderImages(SPONSOR_FOLDER_ID, true);
  if(files.length) sponsorImages = shuffleArray(files);
  renderSponsorColumn();
}

/* Lees CSS var --slot-h (px) of meet tegelhoogte als fallback */
function getTileHeightPx(){
  const ss = document.querySelector('.sponsorSidebar');
  if(ss){
    const cssH = getComputedStyle(ss).getPropertyValue('--slot-h').trim();
    if(cssH && cssH.endsWith('px')){
      const n = parseFloat(cssH);
      if(!isNaN(n) && n>0) return n;
    }
  }
  const first = document.querySelector('.sponsorItem');
  if(first){
    const r = first.getBoundingClientRect();
    if(r.height>0) return r.height;
  }
  return 160; // veilige default
}

/***** RENDER SPONSORCOL *****/
function renderSponsorColumn(){
  if(!sponsorColEl) return;

  // SMOOTH SCROLL (desktop): track met dubbele lijst
  if(SPONSOR_ANIMATIE==="smooth-scroll" && !IS_MOBILE){
    if(smoothScrollTimer){ clearInterval(smoothScrollTimer); smoothScrollTimer=null; }

    sponsorColEl.innerHTML = "";
    const track = document.createElement("div");
    track.className = "sponsorTrack";
    track.style.display = "flex";
    track.style.flexDirection = "column";
    track.style.gap = "var(--sponsor-gap)";
    sponsorColEl.appendChild(track);

    const list = sponsorImages.length ? sponsorImages : Array(NUM_SPONSORS_VISIBLE).fill(null);

    // duplicate list voor naadloze loop
    for(let k=0;k<2;k++){
      list.forEach(file=>{
        const url = file && file.url ? file.url : null;
        track.appendChild(createSponsorTile(url));
      });
    }

    sponsorColEl.scrollTop = 0;

    smoothScrollTimer = setInterval(()=>{
      sponsorColEl.scrollTop += 1;
      if(sponsorColEl.scrollTop >= (track.scrollHeight / 2)){
        sponsorColEl.scrollTop = 0;
      }
    }, 30);

    return;
  }

  // ANDERE MODES (slide-up / fade / glow)
  if(smoothScrollTimer){ clearInterval(smoothScrollTimer); smoothScrollTimer=null; }

  sponsorColEl.innerHTML = "";
  const list = sponsorImages.length ? sponsorImages : [];

  if(!list.length){
    for(let i=0;i<NUM_SPONSORS_VISIBLE;i++){
      sponsorColEl.appendChild(createSponsorTile(null));
    }
    return;
  }

  for(let i=0;i<NUM_SPONSORS_VISIBLE;i++){
    const file = list[i % list.length];
    sponsorColEl.appendChild(createSponsorTile(file.url));
  }
}

function rotateSponsorsOnce(){
  if(!sponsorImages.length) return;
  sponsorImages.push(sponsorImages.shift());
}

function applySponsorSwitchEffect(){
  if(!sponsorImages.length || !sponsorColEl) return;

  switch(SPONSOR_ANIMATIE){
    case "slide-up": {
      const gapPx = parseFloat(getComputedStyle(sponsorColEl).gap || 0) || 0;
      const h = getTileHeightPx() + gapPx;

      sponsorColEl.style.transition = 'transform 600ms ease';
      sponsorColEl.style.transform  = `translateY(-${h}px)`;

      setTimeout(()=>{
        sponsorColEl.style.transition = 'none';
        sponsorColEl.style.transform  = 'translateY(0)';
        rotateSponsorsOnce();
        renderSponsorColumn();
        void sponsorColEl.offsetHeight; // reflow
      }, 650);
      break;
    }

    case "fade": {
      sponsorColEl.classList.add("fade-anim");
      setTimeout(()=>{
        rotateSponsorsOnce();
        renderSponsorColumn();
        sponsorColEl.classList.add("show");
        setTimeout(()=>{
          sponsorColEl.classList.remove("fade-anim","show");
        }, 520);
      }, 20);
      break;
    }

    case "glow": {
      rotateSponsorsOnce();
      renderSponsorColumn();
      const firstItem = sponsorColEl.querySelector(".sponsorItem .sponsorFill");
      if(firstItem){
        firstItem.classList.add("glow");
        setTimeout(()=> firstItem.classList.remove("glow"), 650);
      }
      break;
    }

    case "smooth-scroll":
      // loopt continu
      break;
  }
}

/***** REFRESH CYCLES *****/
async function refreshFromDrive(){
  const [top,live] = await Promise.all([
    fetchFolderImages(TOP_FOLDER_ID,  false),
    fetchFolderImages(LIVE_FOLDER_ID, false)
  ]);
  const liveRecent    = filterRecentLivePhotos(live);
  slideshowImages     = buildSlideshowList(top, liveRecent);
  if(currentIndex >= slideshowImages.length) currentIndex = 0;

  const now = new Date();
  if(lastRefreshEl){
    lastRefreshEl.textContent = "Last update: " +
      now.toLocaleTimeString("nl-BE", {hour:"2-digit",minute:"2-digit"});
  }

  crossfadeToCurrent();

  if(SPONSOR_ANIMATIE==="fade"){
    sponsorColEl?.classList.add("fade-anim");
    setTimeout(()=>{
      renderSponsorColumn();
      sponsorColEl?.classList.add("show");
      setTimeout(()=> sponsorColEl?.classList.remove("fade-anim","show"), 520);
    }, 20);
  }else{
    renderSponsorColumn();
  }
}

/***** MOBILE nicety (alleen als je sponsors toont op mobiel) *****/
function autoScrollSponsorsMobile(){
  const el = document.getElementById('sponsorCol');
  if(!el) return;
  let dir = 1;
  setInterval(()=>{
    if(window.innerWidth > 900) return;
    el.scrollBy({ left: dir*2, behavior: 'smooth' });
    if(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2) dir = -1;
    if(el.scrollLeft <= 2) dir = 1;
  }, 40);
}

/***** INIT *****/
async function init(){
  containerEl   = document.querySelector(".slideshow");
  lastRefreshEl = document.getElementById("lastRefresh");
  noPhotosEl    = document.getElementById("noPhotosMsg");
  sponsorColEl  = document.getElementById("sponsorCol");

  await Promise.all([ refreshFromDrive(), refreshSponsorsFromDrive() ]);

  slideTimer    = setInterval(nextImage, DISPLAY_TIME);
  refreshTimer  = setInterval(refreshFromDrive, REFRESH_INTERVAL);
  sponsorTimer  = setInterval(refreshSponsorsFromDrive, SPONSOR_REFRESH_INTERVAL);

  autoScrollSponsorsMobile();
}
init();

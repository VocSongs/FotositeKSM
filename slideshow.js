/***** INSTELLINGEN *****/
const API_KEY           = "AIzaSyCcCnm--0E_87Jl0_oHpGA6q7h5_ZoOong";
const LIVE_FOLDER_ID    = "1DPRvYwG-nluiePp3ZRuCFcseze5kAHp4";
const TOP_FOLDER_ID     = "1N8wfqj7BFtx-jAYj0qM8-uqJVbblWXw3";
const SPONSOR_FOLDER_ID = "18RJ4L_e30JlxDUcG945kWpcafy28KFIO";

/* Kies je animaties hier */
const FOTO_ANIMATIE    = "kenburns";      // "fade" | "fade-zoom" | "slide" | "kenburns"
const SPONSOR_ANIMATIE = "smooth-scroll";  // "slide-up" | "smooth-scroll" | "fade" | "glow"

const IS_MOBILE             = window.matchMedia("(max-width: 900px)").matches;
const LIVE_MAX_AGE_HOURS    = 2;
const DISPLAY_TIME          = 7000;                     // >6s oogt mooier voor Ken Burns
const REFRESH_INTERVAL      = (IS_MOBILE ? 90 : 45) * 60000;
const FADE_MS               = 1000;
const NUM_SPONSORS_VISIBLE  = 4;
const SPONSOR_REFRESH_INTERVAL = 5 * 60 * 1000;

const PHOTO_THUMB_WIDTH   = IS_MOBILE ? 1200 : 2000;
const SPONSOR_THUMB_WIDTH = IS_MOBILE ?  600 :  800;

/***** VARIABELEN *****/
let slideshowImages = [];
let sponsorImages   = [];
let currentIndex    = 0;

let containerEl, lastRefreshEl, noPhotosEl, sponsorColEl, currentImgEl;
let slideTimer, refreshTimer, sponsorTimer;
let loaderHidden = false;
let smoothScrollTimer = null;

/***** DRIVE HELPERS *****/
async function fetchFolderImages(folderId, isSponsor=false){
  const q   = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType contains 'image/'`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
  const res = await fetch(url);
  if(!res.ok){ console.error("Drive API error:", res.status, res.statusText); return []; }
  const data = await res.json();
  const width = isSponsor ? SPONSOR_THUMB_WIDTH : PHOTO_THUMB_WIDTH;
  return (data.files||[]).map(f=>({
    id:f.id, name:f.name, createdTime:f.createdTime,
    // thumbnail end-point is snel en cache-vriendelijk
    url:`https://drive.google.com/thumbnail?id=${f.id}&sz=w${width}`
  }));
}

function filterRecentLivePhotos(files){
  const now=Date.now(), maxAge=LIVE_MAX_AGE_HOURS*3600000;
  return files.filter(f=>now - new Date(f.createdTime).getTime() <= maxAge);
}
function shuffleArray(a){
  const arr=[...a];
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}
function buildSlideshowList(top,live){ return shuffleArray([...live,...top]); }

/***** SLIDESHOW + EFFECTEN *****/
function createLayeredImgElement(){
  const el=document.createElement("img");
  el.className="slideImage";
  el.style.opacity="0";
  return el;
}
function hideLoader(){
  if(loaderHidden) return;
  const loader=document.getElementById("loader");
  if(loader) loader.classList.add("fadeOut");
  loaderHidden = true;
}

function crossfadeToCurrent(){
  if(!slideshowImages.length){
    if(currentImgEl){ currentImgEl.remove(); currentImgEl=null; }
    if(noPhotosEl) noPhotosEl.style.opacity=1;
    return;
  }
  if(noPhotosEl) noPhotosEl.style.opacity=0;

  const photo=slideshowImages[currentIndex];
  const pre=new Image();
  pre.src=photo.url;

  pre.onload=()=>{
    hideLoader();

    const incoming=createLayeredImgElement();
    incoming.src=pre.src;

    // FOTO-EFFECT setup vóór in DOM plaatsen
    if(FOTO_ANIMATIE==="kenburns"){
      // beginstand exact gelijk aan keyframes 0%
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
      if(FOTO_ANIMATIE==="kenburns"){ incoming.classList.add("kenburns"); }
      incoming.style.opacity="1";
      if(FOTO_ANIMATIE==="fade-zoom"){ incoming.style.transform="scale(1.00)"; }
      if(currentImgEl){ currentImgEl.style.opacity="0"; }
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

  pre.onerror=()=>{
    // sla over en probeer volgende
    currentIndex=(currentIndex+1)%slideshowImages.length;
    crossfadeToCurrent();
  };
}

function nextImage(){
  if(!slideshowImages.length) return;
  currentIndex=(currentIndex+1)%slideshowImages.length;
  applySponsorSwitchEffect();
  crossfadeToCurrent();
}

/***** SPONSOR HELPERS *****/
async function refreshSponsorsFromDrive(){
  if(!SPONSOR_FOLDER_ID || SPONSOR_FOLDER_ID.includes("HIER_DE_SPONSOR_MAP_ID")){
    sponsorImages=[]; renderSponsorColumn(); return;
  }
  const files=await fetchFolderImages(SPONSOR_FOLDER_ID,true);
  if(files.length) sponsorImages=shuffleArray(files);
  renderSponsorColumn();
}

/* Lees CSS-variabele --slot-h (px) of meet tegelhoogte als fallback */
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

/***** SPONSOR RENDERING *****/
function renderSponsorColumn(){
  if(!sponsorColEl) return;

  // SMOOTH SCROLL (desktop): maak een track met dubbele lijst
  if(SPONSOR_ANIMATIE==="smooth-scroll" && !IS_MOBILE){
    if(smoothScrollTimer){ clearInterval(smoothScrollTimer); smoothScrollTimer=null; }

    sponsorColEl.innerHTML="";
    const track=document.createElement("div");
    track.className="sponsorTrack";
    track.style.display="flex";
    track.style.flexDirection="column";
    track.style.gap="var(--sponsor-gap)";
    sponsorColEl.appendChild(track);

    const list = sponsorImages.length ? sponsorImages : Array(NUM_SPONSORS_VISIBLE).fill(null);

    // twee keer achter elkaar voor naadloos loopen
    for(let k=0;k<2;k++){
      list.forEach(file=>{
        const item=document.createElement("div");
        item.className="sponsorItem";
        if(file && file.url){
          item.style.backgroundImage = `url("${file.url}")`;
        } else {
          item.style.backgroundImage = "none";
        }
        track.appendChild(item);
      });
    }

    sponsorColEl.scrollTop = 0;

    // vloeiend laten lopen
    smoothScrollTimer = setInterval(()=>{
      sponsorColEl.scrollTop += 1;
      // half van de track is één "lijst"
      if(sponsorColEl.scrollTop >= (track.scrollHeight / 2)){
        sponsorColEl.scrollTop = 0;
      }
    }, 30);

    return;
  }

  // ANDERE MODES (slide-up / fade / glow)
  if(smoothScrollTimer){ clearInterval(smoothScrollTimer); smoothScrollTimer=null; }

  sponsorColEl.innerHTML="";
  const list = sponsorImages.length ? sponsorImages : [];

  if(!list.length){
    // lege placeholders
    for(let i=0;i<NUM_SPONSORS_VISIBLE;i++){
      const ph=document.createElement("div");
      ph.className="sponsorItem";
      ph.style.backgroundImage = "none";
      sponsorColEl.appendChild(ph);
    }
    return;
  }

  for(let i=0;i<NUM_SPONSORS_VISIBLE;i++){
    const file=list[i%list.length];
    const item=document.createElement("div");
    item.className="sponsorItem";
    item.style.backgroundImage = `url("${file.url}")`; // <<< background-tile
    sponsorColEl.appendChild(item);
  }
}

/* Roteer array één stap (bovenste naar onder) */
function rotateSponsorsOnce(){
  if(!sponsorImages.length) return;
  const first=sponsorImages.shift();
  sponsorImages.push(first);
}

/* Sponsor-switch effect aanroepen bij elke fotowissel */
function applySponsorSwitchEffect(){
  if(!sponsorImages.length || !sponsorColEl) return;

  switch(SPONSOR_ANIMATIE){
    case "slide-up": {
      // Visueel 1 tegel omhoog schuiven
      const gapPx = parseFloat(getComputedStyle(sponsorColEl).gap || 0) || 0;
      const h = getTileHeightPx() + gapPx;

      sponsorColEl.style.transition = 'transform 600ms ease';
      sponsorColEl.style.transform  = `translateY(-${h}px)`;

      setTimeout(()=>{
        sponsorColEl.style.transition = 'none';
        sponsorColEl.style.transform  = 'translateY(0)';

        rotateSponsorsOnce();
        renderSponsorColumn();

        // reflow zodat volgende transition pakt
        void sponsorColEl.offsetHeight;
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
      const firstItem = sponsorColEl.querySelector(".sponsorItem");
      if(firstItem){
        firstItem.classList.add("glow");
        setTimeout(()=> firstItem.classList.remove("glow"), 650);
      }
      break;
    }

    case "smooth-scroll":
      // loopt continu; geen discrete switch nodig
      break;
  }
}

/***** REFRESH *****/
async function refreshFromDrive(){
  const [top,live]=await Promise.all([
    fetchFolderImages(TOP_FOLDER_ID,false),
    fetchFolderImages(LIVE_FOLDER_ID,false)
  ]);
  const liveRecent=filterRecentLivePhotos(live);
  slideshowImages=buildSlideshowList(top,liveRecent);

  if(currentIndex>=slideshowImages.length) currentIndex=0;

  const now=new Date();
  if(lastRefreshEl){
    lastRefreshEl.textContent="Last update: "+
      now.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"});
  }

  crossfadeToCurrent();

  // sponsors bij verversen: in fade-mode zacht in
  if(SPONSOR_ANIMATIE==="fade"){
    sponsorColEl?.classList.add("fade-anim");
    setTimeout(()=>{
      renderSponsorColumn();
      sponsorColEl?.classList.add("show");
      setTimeout(()=> sponsorColEl?.classList.remove("fade-anim","show"), 520);
    }, 20);
  } else {
    renderSponsorColumn();
  }
}

/***** MOBIEL: zachte auto-scroll sponsors (horizontaal) *****/
function autoScrollSponsorsMobile(){
  const el=document.getElementById('sponsorCol');
  if(!el) return;
  let dir=1;
  setInterval(()=>{
    if(window.innerWidth>900) return;
    el.scrollBy({ left: dir*2, behavior: 'smooth' });
    if(el.scrollLeft+el.clientWidth>=el.scrollWidth-2) dir=-1;
    if(el.scrollLeft<=2) dir=1;
  }, 40);
}

/***** INIT *****/
async function init(){
  containerEl  = document.querySelector(".slideshow");
  lastRefreshEl= document.getElementById("lastRefresh");
  noPhotosEl   = document.getElementById("noPhotosMsg");
  sponsorColEl = document.getElementById("sponsorCol");

  await Promise.all([ refreshFromDrive(), refreshSponsorsFromDrive() ]);

  slideTimer   = setInterval(()=> nextImage(), DISPLAY_TIME);
  refreshTimer = setInterval(()=> refreshFromDrive(), REFRESH_INTERVAL);
  sponsorTimer = setInterval(()=> refreshSponsorsFromDrive(), SPONSOR_REFRESH_INTERVAL);

  autoScrollSponsorsMobile();
}
init();

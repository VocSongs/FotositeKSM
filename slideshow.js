/***** GOOGLE DRIVE INSTELLINGEN *****/
const API_KEY           = "AIzaSyCcCnm--0E_87Jl0_oHpGA6q7h5_ZoOong";
const LIVE_FOLDER_ID    = "1DPRvYwG-nluiePp3ZRuCFcseze5kAHp4";
const TOP_FOLDER_ID     = "1N8wfqj7BFtx-jAYj0qM8-uqJVbblWXw3";
const SPONSOR_FOLDER_ID = "18RJ4L_e30JlxDUcG945kWpcafy28KFIO";

/***** ANIMATIEKEUZES *****/
const FOTO_ANIMATIE    = "kenburns";        // "fade" | "fade-zoom" | "slide" | "kenburns"
const SPONSOR_ANIMATIE = "smooth-scroll";   // "slide-up" | "smooth-scroll" | "fade" | "glow"

/***** GLOBALE INSTELLINGEN *****/
const IS_MOBILE               = window.matchMedia("(max-width: 900px)").matches;
const LIVE_MAX_AGE_HOURS      = 2;
const DISPLAY_TIME            = 7000;
const REFRESH_INTERVAL        = (IS_MOBILE ? 90 : 45) * 60000;
const FADE_MS                 = 1000;
const NUM_SPONSORS_VISIBLE    = 4;
const SPONSOR_REFRESH_INTERVAL= 5 * 60 * 1000;
const PHOTO_THUMB_WIDTH       = IS_MOBILE ? 1200 : 2000;
const SPONSOR_THUMB_WIDTH     = IS_MOBILE ? 600  : 800;

/***** VLOEIENDE SCROLL-INSTELLINGEN *****/
const SCROLL_SPEED_PX_PER_SEC = 40;   // snelheid: 10–20 is ideaal
const SCROLL_EASE_FACTOR      = 0.08; // zachtheid: 0.05–0.15

/***** VARIABELEN *****/
let slideshowImages = [];
let sponsorImages   = [];
let currentIndex    = 0;

let containerEl, lastRefreshEl, noPhotosEl, sponsorColEl, currentImgEl;
let slideTimer, refreshTimer, sponsorTimer;
let loaderHidden = false;
let scrollOffset = 0;
let scrollTarget = 0;
let lastTime     = 0;
let animationFrameId = null;

/***** DRIVE HELPERS *****/
async function fetchFolderImages(folderId, isSponsor = false) {
  const q   = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType contains 'image/'`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
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
function shuffleArray(a){ const arr=[...a]; for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr;}
function filterRecentLivePhotos(files){ const now=Date.now(), maxAge=LIVE_MAX_AGE_HOURS*3600000; return files.filter(f=>now-new Date(f.createdTime).getTime()<=maxAge); }
function buildSlideshowList(top, live){ return shuffleArray([...live,...top]); }

/***** SPONSOR TILE (inner fill voor afgeronde hoeken) *****/
function createSponsorTile(url){
  const item = document.createElement("div");
  item.className = "sponsorItem";
  const fill = document.createElement("div");
  fill.className = "sponsorFill";
  if (url) fill.style.backgroundImage = `url("${url}")`;
  item.appendChild(fill);
  return item;
}

/***** SLIDESHOW *****/
function createLayeredImgElement(){ const el=document.createElement("img"); el.className="slideImage"; el.style.opacity="0"; return el; }
function hideLoader(){ if(loaderHidden) return; const loader=document.getElementById("loader"); if(loader) loader.classList.add("fadeOut"); loaderHidden=true; }

function crossfadeToCurrent(){
  if(!slideshowImages.length){
    if(currentImgEl){ currentImgEl.remove(); currentImgEl=null; }
    if(noPhotosEl) noPhotosEl.style.opacity=1;
    return;
  }
  if(noPhotosEl) noPhotosEl.style.opacity=0;

  const photo = slideshowImages[currentIndex];
  const pre = new Image(); pre.src = photo.url;

  pre.onload = () => {
    hideLoader();
    const incoming = createLayeredImgElement();
    incoming.src = pre.src;

    if(FOTO_ANIMATIE==="kenburns"){
      incoming.style.transform="scale(1.03) translate(0px,0px)";
      incoming.style.setProperty("--kb-duration", Math.max(DISPLAY_TIME,6000)+"ms");
    } else if(FOTO_ANIMATIE==="fade-zoom"){ incoming.classList.add("slide-incoming","fade-zoom"); }
      else if(FOTO_ANIMATIE==="slide"){ incoming.classList.add("slide-incoming","slide-from-right"); }

    containerEl.appendChild(incoming);

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(FOTO_ANIMATIE==="kenburns") incoming.classList.add("kenburns");
      incoming.style.opacity="1";
      if(FOTO_ANIMATIE==="fade-zoom") incoming.style.transform="scale(1.00)";
      if(currentImgEl) currentImgEl.style.opacity="0";
      if(FOTO_ANIMATIE==="slide" && currentImgEl) currentImgEl.classList.add("slide-outgoing","slide-to-left");
    }));

    setTimeout(()=>{
      if(currentImgEl) currentImgEl.remove();
      currentImgEl=incoming;
      incoming.classList.remove("slide-incoming","fade-zoom","slide-from-right");
    }, FADE_MS);
  };

  pre.onerror = ()=>{ currentIndex=(currentIndex+1)%slideshowImages.length; crossfadeToCurrent(); };
}
function nextImage(){ if(!slideshowImages.length) return; currentIndex=(currentIndex+1)%slideshowImages.length; crossfadeToCurrent(); }

/***** SPONSORS *****/
async function refreshSponsorsFromDrive(){
  const files = await fetchFolderImages(SPONSOR_FOLDER_ID,true);
  if(files.length) sponsorImages=shuffleArray(files);
  renderSponsorColumn();
}

/* Vloeiende scroll met easing */
function startSmoothScroll(){
  if(animationFrameId) cancelAnimationFrame(animationFrameId);
  const track=sponsorColEl.querySelector(".sponsorTrack");
  if(!track) return;

  scrollOffset=0; scrollTarget=0; lastTime=0;

  function step(timestamp){
    if(!lastTime) lastTime=timestamp;
    const delta=(timestamp-lastTime)/1000;
    lastTime=timestamp;

    scrollTarget += SCROLL_SPEED_PX_PER_SEC * delta;
    scrollOffset += (scrollTarget - scrollOffset) * SCROLL_EASE_FACTOR;

    if(scrollOffset >= track.scrollHeight/2){ scrollOffset=0; scrollTarget=0; }
    sponsorColEl.scrollTop = scrollOffset;

    animationFrameId=requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* Kolom met sponsorafbeeldingen renderen */
function renderSponsorColumn(){
  if(!sponsorColEl) return;
  sponsorColEl.innerHTML="";

  if(SPONSOR_ANIMATIE==="smooth-scroll" && !IS_MOBILE){
    const track=document.createElement("div");
    track.className="sponsorTrack";
    track.style.display="flex";
    track.style.flexDirection="column";
    track.style.gap="24px";
    sponsorColEl.appendChild(track);

    const list=sponsorImages.length ? sponsorImages : Array(NUM_SPONSORS_VISIBLE).fill(null);
    for(let k=0;k<2;k++){
      list.forEach(file=>{
        const item = createSponsorTile(file && file.url ? file.url : null);
        track.appendChild(item);
      });
    }
    startSmoothScroll();
    return;
  }

  const list=sponsorImages.length ? sponsorImages : [];
  for(let i=0;i<NUM_SPONSORS_VISIBLE;i++){
    const file=list[i%list.length];
    const item = createSponsorTile(file && file.url ? file.url : null);
    sponsorColEl.appendChild(item);
  }
}

/***** REFRESH *****/
async function refreshFromDrive(){
  const [top, live]=await Promise.all([
    fetchFolderImages(TOP_FOLDER_ID,false),
    fetchFolderImages(LIVE_FOLDER_ID,false)
  ]);
  const liveRecent=filterRecentLivePhotos(live);
  slideshowImages=buildSlideshowList(top,liveRecent);

  if(currentIndex>=slideshowImages.length) currentIndex=0;

  const now=new Date();
  if(lastRefreshEl)
    lastRefreshEl.textContent="Last update: "+
      now.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"});

  crossfadeToCurrent();
  renderSponsorColumn();
}

/***** INIT *****/
async function init(){
  containerEl=document.querySelector(".slideshow");
  lastRefreshEl=document.getElementById("lastRefresh");
  noPhotosEl=document.getElementById("noPhotosMsg");
  sponsorColEl=document.getElementById("sponsorCol");

  await Promise.all([refreshFromDrive(), refreshSponsorsFromDrive()]);

  slideTimer   = setInterval(nextImage, DISPLAY_TIME);
  refreshTimer = setInterval(refreshFromDrive, REFRESH_INTERVAL);
  sponsorTimer = setInterval(refreshSponsorsFromDrive, SPONSOR_REFRESH_INTERVAL);
}
init();

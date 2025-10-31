/***** INSTELLINGEN *****/
const API_KEY = "AIzaSyCcCnm--0E_87Jl0_oHpGA6q7h5_ZoOong";
const LIVE_FOLDER_ID = "1DPRvYwG-nluiePp3ZRuCFcseze5kAHp4";
const TOP_FOLDER_ID  = "1N8wfqj7BFtx-jAYj0qM8-uqJVbblWXw3";
const SPONSOR_FOLDER_ID = "HIER_DE_SPONSOR_MAP_ID";

const LIVE_MAX_AGE_HOURS = 2;
const DISPLAY_TIME = 5000;
const REFRESH_INTERVAL = 60 * 1000;
const FADE_MS = 1000;
const NUM_SPONSORS_VISIBLE = 4;
const SPONSOR_REFRESH_INTERVAL = 60 * 60 * 1000;
const PHOTO_THUMB_WIDTH = 1000;
const SPONSOR_THUMB_WIDTH = 500;

/***** VARIABELEN *****/
let slideshowImages = [];
let sponsorImages   = [];
let currentIndex    = 0;
let containerEl, lastRefreshEl, noPhotosEl, sponsorColEl, currentImgEl;
let slideTimer, refreshTimer, sponsorTimer;
let loaderHidden = false;

/***** FUNCTIES *****/
async function fetchFolderImages(folderId, isSponsor=false){
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType contains 'image/'`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,createdTime,mimeType)&pageSize=200&key=${API_KEY}`;
  const res = await fetch(url);
  if(!res.ok){console.error("Drive API error:",res.statusText);return[];}
  const data = await res.json();
  const width = isSponsor?SPONSOR_THUMB_WIDTH:PHOTO_THUMB_WIDTH;
  return (data.files||[]).map(f=>({
    id:f.id,
    name:f.name,
    createdTime:f.createdTime,
    url:`https://drive.google.com/thumbnail?id=${f.id}&sz=w${width}`
  }));
}

function filterRecentLivePhotos(files){
  const now=Date.now(),maxAge=LIVE_MAX_AGE_HOURS*3600000;
  return files.filter(f=>now-new Date(f.createdTime).getTime()<=maxAge);
}
function shuffleArray(a){const arr=[...a];for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
function buildSlideshowList(top,live){return shuffleArray([...live,...top]);}

function createLayeredImgElement(){
  const el=document.createElement("img");
  el.className="slideImage";
  el.style.position="absolute";
  el.style.inset="0";
  el.style.margin="auto";
  el.style.transition=`opacity ${FADE_MS}ms ease`;
  el.style.opacity="0";
  return el;
}

function hideLoader(){
  if(loaderHidden)return;
  const loader=document.getElementById("loader");
  if(loader)loader.classList.add("fadeOut");
  loaderHidden=true;
}

function crossfadeToCurrent(){
  if(!slideshowImages.length){
    if(currentImgEl){currentImgEl.remove();currentImgEl=null;}
    noPhotosEl.style.opacity=1;
    return;
  }
  noPhotosEl.style.opacity=0;
  const photo=slideshowImages[currentIndex];
  const pre=new Image();
  pre.src=photo.url;
  pre.onload=()=>{
    hideLoader();
    const next=createLayeredImgElement();
    next.src=pre.src;
    containerEl.appendChild(next);
    requestAnimationFrame(()=>{requestAnimationFrame(()=>{
      next.style.opacity="1";
      if(currentImgEl)currentImgEl.style.opacity="0";
    });});
    setTimeout(()=>{if(currentImgEl)currentImgEl.remove();currentImgEl=next;},FADE_MS);
  };
  pre.onerror=()=>{currentIndex=(currentIndex+1)%slideshowImages.length;crossfadeToCurrent();};
}

function nextImage(){
  if(!slideshowImages.length)return;
  currentIndex=(currentIndex+1)%slideshowImages.length;
  rotateSponsorsOnce();
  crossfadeToCurrent();
}

/* Sponsors */
async function refreshSponsorsFromDrive(){
  if(!SPONSOR_FOLDER_ID||SPONSOR_FOLDER_ID.includes("HIER_DE_SPONSOR_MAP_ID")){
    sponsorImages=[];renderSponsorColumn();return;
  }
  const files=await fetchFolderImages(SPONSOR_FOLDER_ID,true);
  if(files.length)sponsorImages=shuffleArray(files);
  renderSponsorColumn();
}
function renderSponsorColumn(){
  if(!sponsorColEl)return;
  sponsorColEl.innerHTML="";
  if(!sponsorImages.length){
    for(let i=0;i<NUM_SPONSORS_VISIBLE;i++){
      const ph=document.createElement("div");
      ph.className="sponsorItem";
      sponsorColEl.appendChild(ph);
    }return;
  }
  for(let i=0;i<NUM_SPONSORS_VISIBLE;i++){
    const file=sponsorImages[i%sponsorImages.length];
    const item=document.createElement("div");
    item.className="sponsorItem";
    const img=document.createElement("img");
    img.src=file.url;
    item.appendChild(img);
    sponsorColEl.appendChild(item);
  }
}
function rotateSponsorsOnce(){
  if(!sponsorImages.length)return;
  const first=sponsorImages.shift();
  sponsorImages.push(first);
  renderSponsorColumn();
}

/* Refresh */
async function refreshFromDrive(){
  const [top,live]=await Promise.all([
    fetchFolderImages(TOP_FOLDER_ID,false),
    fetchFolderImages(LIVE_FOLDER_ID,false)
  ]);
  const liveRecent=filterRecentLivePhotos(live);
  slideshowImages=buildSlideshowList(top,liveRecent);
  if(currentIndex>=slideshowImages.length)currentIndex=0;
  const now=new Date();
  lastRefreshEl.textContent="Laatste update: "+now.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"});
  crossfadeToCurrent();
}

/* Init */
async function init(){
  containerEl=document.querySelector(".slideshow");
  lastRefreshEl=document.getElementById("lastRefresh");
  noPhotosEl=document.getElementById("noPhotosMsg");
  sponsorColEl=document.getElementById("sponsorCol");
  await Promise.all([refreshFromDrive(),refreshSponsorsFromDrive()]);
  slideTimer=setInterval(nextImage,DISPLAY_TIME);
  refreshTimer=setInterval(refreshFromDrive,REFRESH_INTERVAL);
  sponsorTimer=setInterval(refreshSponsorsFromDrive,SPONSOR_REFRESH_INTERVAL);
}
init();

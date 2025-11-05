// =====================
//  FOTOSITE KSM - SAFE BUILD
// =====================

// ---- Globale (console-bare) settings ----
window.API_KEY           = "AIzaSyCcCnm--0E_87Jl0_oHpGA6q7h5_ZoOong";
window.LIVE_FOLDER_ID    = "1DPRvYwG-nluiePp3ZRuCFcseze5kAHp4";
window.TOP_FOLDER_ID     = "1N8wfqj7BFtx-jAYj0qM8-uqJVbblWXw3";
window.SPONSOR_FOLDER_ID = "18RJ4L_e30JlxDUcG945kWpcafy28KFIO";

window.FOTO_ANIMATIE     = "kenburns";              // "fade" | "kenburns"
window.SPONSOR_ANIMATIE  = window.SPONSOR_ANIMATIE || "smooth-scroll";

window.IS_MOBILE                = window.matchMedia("(max-width: 900px)").matches;
window.LIVE_MAX_AGE_HOURS       = 2;
window.DISPLAY_TIME             = 5000;
window.FADE_MS                  = 1000;
window.NUM_SPONSORS_VISIBLE     = 4;
window.SPONSOR_REFRESH_INTERVAL = 5 * 60 * 1000;
window.PHOTO_THUMB_WIDTH        = IS_MOBILE ? 1200 : 2000;
window.SPONSOR_THUMB_WIDTH      = IS_MOBILE ? 600  : 800;

console.log("[BOOT] slideshow.js geladen");

// Elements / state
let containerEl, lastRefreshEl, noPhotosEl, sponsorColEl, audioBtn;
let mediaItems = [], currentIndex = 0, currentEl = null;
let sponsorImages = [];
let sponsorTimer;
let loaderHidden = false, canDismissLoader = false;
let imageTimerId = null;

// Scroll engine vars (ook globaal zichtbaar)
window.SCROLL_SPEED_PX_PER_SEC = 20;
let animationFrameId = null;
let lastScrollTick = performance.now();
window.__sponsorIntervalId = null;

// -------- Utils --------
function clearImageTimer(){ if (imageTimerId) { clearTimeout(imageTimerId); imageTimerId = null; } }
function startImageTimer(){ clearImageTimer(); imageTimerId = setTimeout(nextMedia, DISPLAY_TIME); }

function hideLoader(){
  if (!canDismissLoader || loaderHidden) return;
  const loader = document.getElementById("loader");
  if (loader) loader.classList.add("fadeOut");
  loaderHidden = true;
}

function setAudioIcon(){
  if(!audioBtn

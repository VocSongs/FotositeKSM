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
let aud

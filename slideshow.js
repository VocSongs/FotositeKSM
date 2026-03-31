// =====================
// FOTOSITE KSM – V2 (onder de motorkap verbeterd)
// Layout bewust behouden.
// =====================

const CONFIG = {
  apiKey: "AIzaSyCcCnm--0E_87Jl0_oHpGA6q7h5_ZoOong",
  folders: {
    live: "1DPRvYwG-nluiePp3ZRuCFcseze5kAHp4",
    top: "1N8wfqj7BFtx-jAYj0qM8-uqJVbblWXw3",
    sponsor: "18RJ4L_e30JlxDUcG945kWpcafy28KFIO"
  },
  displayTime: 5000,
  fadeMs: 1000,
  animation: "kenburns",
  sponsorScrollSpeed: 50,
  refreshMediaMs: 15 * 60 * 1000,
  refreshSponsorsMs: 60 * 60 * 1000,
  requestTimeoutMs: 15000,
  cacheTtlMs: 5 * 60 * 1000,
  mobileBreakpoint: 900,
  localFallbackMedia: [
    { type: "image", url: "26.jpg", name: "Lokale fallback foto" }
  ],
  localJsonPath: "media.json"
};

const state = {
  isMobile: window.matchMedia(`(max-width: ${CONFIG.mobileBreakpoint}px)`).matches,
  prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  audioEnabled: false,
  mediaItems: [],
  sponsorImages: [],
  currentIndex: 0,
  currentEl: null,
  imageTimerId: null,
  sponsorRefreshTimerId: null,
  mediaRefreshTimerId: null,
  keepAliveTimerId: null,
  sponsorTrack: null,
  sponsorOffset: 0,
  sponsorLoopHeight: 0,
  sponsorRafId: null,
  sponsorFallbackId: null,
  wasPlayingBeforeHide: false
};

const els = {
  container: null,
  lastRefresh: null,
  sponsorCol: null,
  audioBtn: null,
  loader: null,
  startFsBtn: null
};

const derived = {
  get photoWidth(){ return state.isMobile ? 1200 : 2000; },
  get sponsorWidth(){ return state.isMobile ? 600 : 800; }
};

function qs(id){ return document.getElementById(id); }
function clearTimer(id){ if (id) clearTimeout(id); }
function clearIntervalSafe(id){ if (id) clearInterval(id); }
function cancelRaf(id){ if (id) cancelAnimationFrame(id); }
function safeJsonParse(value){ try { return JSON.parse(value); } catch { return null; } }
function dedupeById(items){
  const seen = new Set();
  return items.filter(item => {
    const key = item.id || `${item.type}:${item.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function setLastRefresh(text){
  if (els.lastRefresh) els.lastRefresh.textContent = text;
}
function updateLastRefreshTime(){
  const now = new Date();
  setLastRefresh(`Last update: ${now.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}`);
}
function getCache(key){
  const raw = localStorage.getItem(key);
  const parsed = raw ? safeJsonParse(raw) : null;
  if (!parsed || !parsed.expiresAt || Date.now() > parsed.expiresAt) return null;
  return parsed.data;
}
function setCache(key, data, ttlMs = CONFIG.cacheTtlMs){
  try {
    localStorage.setItem(key, JSON.stringify({ expiresAt: Date.now() + ttlMs, data }));
  } catch {}
}
function preloadImage(src){
  if (!src) return;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

async function fetchJsonWithTimeout(url){
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchDriveFiles({ folderId, imagesOnly = false, pageSize = 200 }){
  const mimeFilter = imagesOnly
    ? "mimeType contains 'image/'"
    : "(mimeType contains 'image/' or mimeType contains 'video/')";

  let pageToken = "";
  const files = [];

  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and ${mimeFilter}`);
    const pageTokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=name&fields=nextPageToken,files(id,name,createdTime,mimeType)&pageSize=${pageSize}${pageTokenParam}&key=${CONFIG.apiKey}`;
    const data = await fetchJsonWithTimeout(url);
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return files;
}

function mapDriveFile(file, { sponsor = false } = {}){
  const isImage = file.mimeType.startsWith("image/");
  const isVideo = file.mimeType.startsWith("video/");
  const width = sponsor ? derived.sponsorWidth : derived.photoWidth;
  return {
    id: file.id,
    name: file.name,
    createdTime: file.createdTime,
    type: isImage ? "image" : (isVideo ? "video" : "other"),
    url: isImage
      ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w${width}`
      : `https://drive.google.com/uc?export=download&id=${file.id}`
  };
}

function normalizeLocalMediaItems(items){
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      if (typeof item === "string") {
        const lower = item.toLowerCase();
        const isVideo = /\.(mp4|webm|mov)$/i.test(lower);
        return { type: isVideo ? "video" : "image", url: item, name: item.split("/").pop() || `Lokaal bestand ${index + 1}` };
      }
      if (!item || !item.url) return null;
      const type = item.type || (/\.(mp4|webm|mov)$/i.test(item.url) ? "video" : "image");
      return { ...item, type, name: item.name || item.url.split("/").pop() || `Lokaal bestand ${index + 1}` };
    })
    .filter(Boolean);
}

function getWindowLocalMedia(){
  return normalizeLocalMediaItems(window.LOCAL_MEDIA || []);
}

async function fetchLocalMediaJson(){
  try {
    const response = await fetch(CONFIG.localJsonPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return normalizeLocalMediaItems(data);
  } catch (error) {
    console.warn("Lokaal media.json laden mislukt.", error);
    return [];
  }
}

async function getBestLocalMedia(){
  const inlineLocal = getWindowLocalMedia();
  if (inlineLocal.length) return inlineLocal;
  return [];
}

async function fetchFolderMediaOrdered(folderId){
  const cacheKey = `ksm_media_${folderId}_${derived.photoWidth}`;
  try {
    const files = await fetchDriveFiles({ folderId, imagesOnly: false });
    const mapped = dedupeById(files.map(file => mapDriveFile(file)).filter(item => item.type !== "other"));
    setCache(cacheKey, mapped);
    return mapped;
  } catch (error) {
    console.warn("Media laden via Drive mislukt, cache wordt geprobeerd.", error);
    return getCache(cacheKey) || [];
  }
}

async function fetchFolderImages(folderId, isSponsor = false){
  const cacheKey = `ksm_images_${folderId}_${isSponsor ? derived.sponsorWidth : derived.photoWidth}`;
  try {
    const files = await fetchDriveFiles({ folderId, imagesOnly: true });
    const mapped = dedupeById(files.map(file => mapDriveFile(file, { sponsor: isSponsor })));
    setCache(cacheKey, mapped);
    return mapped;
  } catch (error) {
    console.warn("Afbeeldingen laden via Drive mislukt, cache wordt geprobeerd.", error);
    return getCache(cacheKey) || [];
  }
}

function clearImageTimer(){
  if (state.imageTimerId){
    clearTimeout(state.imageTimerId);
    state.imageTimerId = null;
  }
}

function startImageTimer(){
  clearImageTimer();
  state.imageTimerId = window.setTimeout(nextMedia, CONFIG.displayTime);
}

function hideLoader(){
  if (els.loader) els.loader.classList.add("fadeOut");
}

function createImgEl(){
  const el = document.createElement("img");
  el.className = "slideImage";
  el.style.opacity = "0";
  el.decoding = "async";
  el.loading = "eager";
  return el;
}

function createVideoEl(){
  const el = document.createElement("video");
  el.className = "slideVideo";
  el.playsInline = true;
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.autoplay = true;
  el.loop = false;
  el.controls = false;
  el.muted = true;
  el.preload = "auto";
  el.style.opacity = "0";
  return el;
}

function setAudioIcon(){
  if (!els.audioBtn) return;
  const isOn = state.audioEnabled;
  els.audioBtn.textContent = isOn ? "🔊" : "🔇";
  els.audioBtn.dataset.state = isOn ? "unmuted" : "muted";
  els.audioBtn.setAttribute("aria-pressed", String(isOn));
}

function applyAudioTo(el){
  if (!el || el.tagName !== "VIDEO") return;
  el.muted = !state.audioEnabled;
  if (state.audioEnabled) el.play().catch(() => {});
}

function fadeBetween(incoming){
  els.container.appendChild(incoming);
  requestAnimationFrame(() => {
    incoming.style.opacity = "1";
    if (state.currentEl) state.currentEl.style.opacity = "0";
  });
  window.setTimeout(() => {
    if (state.currentEl) state.currentEl.remove();
    state.currentEl = incoming;
  }, CONFIG.fadeMs);
}

function warmNextMedia(){
  if (!state.mediaItems.length) return;
  const nextIndex = (state.currentIndex + 1) % state.mediaItems.length;
  const nextItem = state.mediaItems[nextIndex];
  if (nextItem?.type === "image") preloadImage(nextItem.url);
}

function showCurrent(){
  clearImageTimer();
  if (!state.mediaItems.length){
    if (state.currentEl) {
      state.currentEl.remove();
      state.currentEl = null;
    }
    setLastRefresh("Geen online media gevonden — lokale fallback actief");
    return;
  }

  const item = state.mediaItems[state.currentIndex];
  warmNextMedia();

  if (item.type === "image"){
    const preloader = new Image();
    preloader.decoding = "async";
    preloader.src = item.url;

    preloader.onload = () => {
      const incoming = createImgEl();
      incoming.src = preloader.src;
      incoming.alt = item.name || "Sfeerbeeld";
      if (CONFIG.animation === "kenburns" && !state.prefersReducedMotion){
        incoming.classList.add("kenburns");
        incoming.style.setProperty("--kb-duration", `${Math.max(CONFIG.displayTime, 6000)}ms`);
      }
      fadeBetween(incoming);
      window.setTimeout(startImageTimer, CONFIG.fadeMs);
    };

    preloader.onerror = () => nextMedia(true);
    return;
  }

  const incoming = createVideoEl();
  incoming.src = item.url;
  incoming.setAttribute("aria-label", item.name || "Video");

  incoming.addEventListener("loadeddata", () => {
    applyAudioTo(incoming);
    fadeBetween(incoming);
    incoming.play().catch(err => console.warn("Video play mislukt:", err));
  }, { once: true });

  incoming.addEventListener("ended", () => nextMedia(), { once: true });
  incoming.addEventListener("error", (err) => {
    console.warn("Videofout:", item.name, err);
    nextMedia(true);
  }, { once: true });
}

function nextMedia(){
  if (!state.mediaItems.length) return;
  state.currentIndex = (state.currentIndex + 1) % state.mediaItems.length;
  showCurrent();
}

function createSponsorTile(url, alt = "Sponsor"){
  const d = document.createElement("div");
  d.className = "sponsorItem";
  d.style.backgroundImage = `url("${url}")`;
  d.setAttribute("role", "img");
  d.setAttribute("aria-label", alt);
  return d;
}

function stopSponsorMotion(){
  if (state.sponsorFallbackId){
    clearInterval(state.sponsorFallbackId);
    state.sponsorFallbackId = null;
  }
  if (state.sponsorRafId){
    cancelAnimationFrame(state.sponsorRafId);
    state.sponsorRafId = null;
  }
}

function startAutoScrollIntervalFallback(speed){
  stopSponsorMotion();
  const stepMs = 16;
  state.sponsorFallbackId = window.setInterval(() => {
    if (!state.sponsorTrack) return;
    if (!state.sponsorLoopHeight) state.sponsorLoopHeight = state.sponsorTrack.scrollHeight / 2 || 0;
    state.sponsorOffset += speed * (stepMs / 1000);
    if (state.sponsorLoopHeight && state.sponsorOffset >= state.sponsorLoopHeight) {
      state.sponsorOffset -= state.sponsorLoopHeight;
    }
    state.sponsorTrack.style.transform = `translate3d(0, -${state.sponsorOffset}px, 0)`;
  }, stepMs);
}

function startAutoScroll(){
  stopSponsorMotion();
  const track = els.sponsorCol?.querySelector(".sponsorTrack");
  if (!track) return;

  state.sponsorTrack = track;
  state.sponsorLoopHeight = track.scrollHeight / 2 || 0;
  state.sponsorOffset = 0;

  let lastTs = performance.now();
  let stagnantMs = 0;

  function step(ts){
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    if (!state.sponsorLoopHeight) state.sponsorLoopHeight = state.sponsorTrack.scrollHeight / 2 || 0;
    state.sponsorOffset += CONFIG.sponsorScrollSpeed * dt;
    if (state.sponsorLoopHeight && state.sponsorOffset >= state.sponsorLoopHeight) {
      state.sponsorOffset -= state.sponsorLoopHeight;
    }

    const previous = state.sponsorTrack.style.transform;
    const next = `translate3d(0, -${state.sponsorOffset}px, 0)`;
    state.sponsorTrack.style.transform = next;

    stagnantMs = previous === next ? stagnantMs + dt * 1000 : 0;
    if (stagnantMs > 600){
      state.sponsorRafId = null;
      startAutoScrollIntervalFallback(CONFIG.sponsorScrollSpeed);
      return;
    }

    state.sponsorRafId = requestAnimationFrame(step);
  }

  state.sponsorRafId = requestAnimationFrame(step);
}

function renderSponsorColumn(){
  if (!els.sponsorCol) return;
  els.sponsorCol.innerHTML = "";

  const list = state.sponsorImages || [];
  if (!list.length) return;

  const track = document.createElement("div");
  track.className = "sponsorTrack";
  els.sponsorCol.appendChild(track);

  list.forEach(file => track.appendChild(createSponsorTile(file.url, file.name || "Sponsor")));

  const clone = track.cloneNode(true);
  while (clone.firstChild) track.appendChild(clone.firstChild);

  while (track.scrollHeight < els.sponsorCol.clientHeight * 2 && track.children.length < 300){
    list.forEach(file => track.appendChild(createSponsorTile(file.url, file.name || "Sponsor")));
  }

  startAutoScroll();
}

async function refreshSponsorsFromDrive(){
  const files = await fetchFolderImages(CONFIG.folders.sponsor, true);
  if (files.length) {
    state.sponsorImages = files;
    renderSponsorColumn();
  }
}

async function refreshMedia(){
  const isFileProtocol = window.location.protocol === "file:";

  const top = await fetchFolderMediaOrdered(CONFIG.folders.top);
  if (top.length) {
    state.mediaItems = top;
    updateLastRefreshTime();
  } else {
    const live = await fetchFolderMediaOrdered(CONFIG.folders.live);
    if (live.length) {
      state.mediaItems = live;
      updateLastRefreshTime();
    } else {
      state.mediaItems = await getBestLocalMedia();
      if (isFileProtocol) {
        setLastRefresh(state.mediaItems.length ? "Lokale media actief — online media niet bereikbaar" : "Geen media gevonden");
      } else {
        setLastRefresh(state.mediaItems.length ? "Lokale media actief — online map niet bereikbaar" : "Geen media gevonden");
      }
    }
  }

  if (state.currentIndex >= state.mediaItems.length) state.currentIndex = 0;
  showCurrent();
}

async function requestFullscreenAndHide(){
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch (error) {
    console.warn("Fullscreen niet toegestaan:", error);
  }
  window.setTimeout(hideLoader, 300);
}

function pauseDynamicContent(){
  clearImageTimer();
  stopSponsorMotion();
  if (state.currentEl?.tagName === "VIDEO") {
    state.wasPlayingBeforeHide = !state.currentEl.paused;
    state.currentEl.pause();
  }
}

function resumeDynamicContent(){
  if (state.currentEl?.tagName === "VIDEO") {
    if (state.wasPlayingBeforeHide) state.currentEl.play().catch(() => {});
  } else if (state.mediaItems.length) {
    startImageTimer();
  }
  if (els.sponsorCol?.querySelector(".sponsorTrack")) startAutoScroll();
}

function handleVisibilityChange(){
  if (document.visibilityState === "hidden") {
    pauseDynamicContent();
  } else {
    resumeDynamicContent();
  }
}

function setupResizeWatcher(){
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const nextIsMobile = window.matchMedia(`(max-width: ${CONFIG.mobileBreakpoint}px)`).matches;
      if (nextIsMobile !== state.isMobile) {
        state.isMobile = nextIsMobile;
        refreshMedia();
        refreshSponsorsFromDrive();
      } else if (els.sponsorCol?.querySelector(".sponsorTrack")) {
        startAutoScroll();
      }
    }, 150);
  }, { passive: true });
}

function bindUi(){
  setAudioIcon();

  if (els.audioBtn){
    els.audioBtn.addEventListener("click", () => {
      state.audioEnabled = !state.audioEnabled;
      setAudioIcon();
      applyAudioTo(state.currentEl);
    });
  }

  if (els.startFsBtn){
    els.startFsBtn.addEventListener("click", requestFullscreenAndHide);
  }

  window.addEventListener("keydown", (event) => {
    const loaderVisible = els.loader && !els.loader.classList.contains("fadeOut");
    if (loaderVisible && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      requestFullscreenAndHide();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      nextMedia();
    }
    if (event.key === "ArrowLeft" && state.mediaItems.length) {
      event.preventDefault();
      state.currentIndex = (state.currentIndex - 1 + state.mediaItems.length) % state.mediaItems.length;
      showCurrent();
    }
  });

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", () => {
    refreshMedia();
    refreshSponsorsFromDrive();
  });
}

async function init(){
  els.container = qs("slideshow");
  els.lastRefresh = qs("lastRefresh");
  els.sponsorCol = qs("sponsorCol");
  els.audioBtn = qs("audioToggle");
  els.loader = qs("loader");
  els.startFsBtn = qs("startFsBtn");

  bindUi();
  setupResizeWatcher();

  await Promise.allSettled([
    refreshMedia(),
    refreshSponsorsFromDrive()
  ]);

  state.sponsorRefreshTimerId = window.setInterval(refreshSponsorsFromDrive, CONFIG.refreshSponsorsMs);
  state.mediaRefreshTimerId = window.setInterval(refreshMedia, CONFIG.refreshMediaMs);
  state.keepAliveTimerId = window.setInterval(() => {
    if (els.sponsorCol?.querySelector(".sponsorTrack") && !state.sponsorRafId && !state.sponsorFallbackId) {
      startAutoScroll();
    }
  }, 2000);
}

init();
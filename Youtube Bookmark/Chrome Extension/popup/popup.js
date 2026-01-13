const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const addBtn = document.getElementById("addBtn");

function formatTime(sec){
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  if(h>0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function showStatus(msg){
  statusEl.textContent = msg || "";
}

async function getActiveTab(){
  const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
  return tab;
}

function isYouTubeWatchUrl(url){
  try{
    const u = new URL(url);
    return u.hostname.includes("youtube.com") && u.pathname === "/watch" && u.searchParams.get("v");
  }catch(e){ return false; }
}

async function loadBookmarks(videoId){
  const key = `bookmarks_${videoId}`;
  const data = await chrome.storage.local.get(key);
  return data[key] || [];
}

async function saveBookmarks(videoId, bookmarks){
  const key = `bookmarks_${videoId}`;
  await chrome.storage.local.set({[key]: bookmarks});
}

async function loadCurrentVideoInfo(){
  const tab = await getActiveTab();
  if(!tab || !tab.url || !isYouTubeWatchUrl(tab.url)){
    return {tab, ok:false, reason:"Open a YouTube video (watch page) to use bookmarks."};
  }
  const url = new URL(tab.url);
  const videoId = url.searchParams.get("v");
  // Ask content script for current time + title
  const resp = await chrome.tabs.sendMessage(tab.id, {type:"GET_VIDEO_STATE"});
  if(!resp || !resp.ok){
    return {tab, ok:false, reason:"Couldn't access video player. Play the video once and try again."};
  }
  return {tab, ok:true, videoId, title: resp.title || "YouTube Video", currentTime: resp.currentTime || 0, url: tab.url};
}

function renderBookmarkItem(videoId, b){
  const li = document.createElement("li");
  li.className = "item";

  const title = document.createElement("div");
  title.className = "videoTitle";
  title.textContent = b.videoTitle || "YouTube Video";

  const row = document.createElement("div");
  row.className = "row";

  const meta = document.createElement("div");
  meta.className = "meta";

  const t = document.createElement("span");
  t.className = "pill";
  t.textContent = formatTime(b.time);

  const note = document.createElement("span");
  note.className = "pill";
  note.textContent = b.createdAt ? new Date(b.createdAt).toLocaleString() : "";

  meta.appendChild(t);
  if(note.textContent) meta.appendChild(note);

  const actions = document.createElement("div");
  actions.className = "meta";

  const jump = document.createElement("button");
  jump.className = "jump";
  jump.textContent = "Jump";
  jump.addEventListener("click", async ()=>{
    await chrome.runtime.sendMessage({
      type:"OPEN_AT_TIMESTAMP",
      videoId,
      time: b.time
    });
    window.close();
  });

  const del = document.createElement("button");
  del.className = "del";
  del.textContent = "Delete";
  del.addEventListener("click", async ()=>{
    const all = await loadBookmarks(videoId);
    const filtered = all.filter(x => x.id !== b.id);
    await saveBookmarks(videoId, filtered);
    await render();
  });

  actions.appendChild(jump);
  actions.appendChild(del);

  row.appendChild(meta);
  row.appendChild(actions);

  li.appendChild(title);
  li.appendChild(row);

  return li;
}

async function render(){
  listEl.innerHTML = "";
  emptyEl.style.display = "none";

  const tab = await getActiveTab();
  if(!tab || !tab.url || !isYouTubeWatchUrl(tab.url)){
    addBtn.disabled = true;
    showStatus("Open a YouTube video to see/add bookmarks.");
    emptyEl.style.display = "block";
    return;
  }

  addBtn.disabled = false;
  showStatus("");

  const url = new URL(tab.url);
  const videoId = url.searchParams.get("v");

  const bookmarks = await loadBookmarks(videoId);

  if(bookmarks.length === 0){
    emptyEl.style.display = "block";
    return;
  }

  // newest first
  bookmarks.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));

  for(const b of bookmarks){
    listEl.appendChild(renderBookmarkItem(videoId, b));
  }
}

addBtn.addEventListener("click", async ()=>{
  try{
    addBtn.disabled = true;
    const info = await loadCurrentVideoInfo();
    if(!info.ok){
      showStatus(info.reason);
      addBtn.disabled = false;
      return;
    }
    const {videoId, title, currentTime} = info;

    const bookmarks = await loadBookmarks(videoId);
    const newBm = {
      id: crypto.randomUUID(),
      time: Math.floor(currentTime),
      videoTitle: title,
      createdAt: Date.now()
    };
    bookmarks.push(newBm);
    await saveBookmarks(videoId, bookmarks);

    showStatus(`Saved bookmark at ${formatTime(newBm.time)} ✅`);
    await render();
  }catch(e){
    showStatus("Error adding bookmark.");
  }finally{
    addBtn.disabled = false;
  }
});

render();

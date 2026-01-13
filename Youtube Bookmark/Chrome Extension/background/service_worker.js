// MV3 service worker (background)
function buildYouTubeUrl(videoId, time){
  const t = Math.max(0, Math.floor(time || 0));
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${t}s`;
}

async function findTabForVideo(videoId){
  const tabs = await chrome.tabs.query({url: "https://www.youtube.com/watch*"});
  for(const tab of tabs){
    try{
      const u = new URL(tab.url);
      if(u.searchParams.get("v") === videoId){
        return tab;
      }
    }catch(e){}
  }
  return null;
}

async function openOrReuseTab(videoId, time){
  const existing = await findTabForVideo(videoId);
  const url = buildYouTubeUrl(videoId, time);

  if(existing){
    await chrome.tabs.update(existing.id, {active:true, url});
    return existing;
  }
  const tab = await chrome.tabs.create({url, active:true});
  return tab;
}

// After the tab loads, we additionally message the content script to ensure precise seek/play.
async function ensureSeek(tabId, time){
  // Retry a few times because YouTube takes time to load video element.
  for(let i=0;i<15;i++){
    try{
      const resp = await chrome.tabs.sendMessage(tabId, {type:"SEEK_TO", time});
      if(resp?.ok) return true;
    }catch(e){}
    await new Promise(r=>setTimeout(r, 500));
  }
  return false;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  (async ()=>{
    if(msg?.type === "OPEN_AT_TIMESTAMP"){
      const {videoId, time} = msg;
      const tab = await openOrReuseTab(videoId, time);
      // give it a moment, then try to seek + play precisely
      await new Promise(r=>setTimeout(r, 800));
      await ensureSeek(tab.id, time);
      sendResponse({ok:true});
      return;
    }
    sendResponse({ok:false});
  })();
  return true;
});

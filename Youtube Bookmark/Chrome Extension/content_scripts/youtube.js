// Runs on YouTube watch pages.
// Provides current playback time + title to the popup and helps jumping to a timestamp.

function getVideo(){
  return document.querySelector("video");
}

function getTitle(){
  const h1 = document.querySelector("h1.title") || document.querySelector("h1");
  const t = (h1 && h1.innerText) ? h1.innerText.trim() : document.title;
  return t.replace(" - YouTube","").trim();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  if(msg?.type === "GET_VIDEO_STATE"){
    const video = getVideo();
    if(!video){
      sendResponse({ok:false});
      return true;
    }
    sendResponse({ok:true, currentTime: video.currentTime, title: getTitle()});
    return true;
  }

  if(msg?.type === "SEEK_TO"){
    const video = getVideo();
    if(!video){
      sendResponse({ok:false});
      return true;
    }
    const time = Math.max(0, Number(msg.time || 0));
    video.currentTime = time;

    // Attempt to play
    const p = video.play();
    if(p && typeof p.catch === "function"){
      p.catch(()=>{});
    }
    sendResponse({ok:true});
    return true;
  }
});

// Initialize content script
console.log("YT Trackback content script initialized");

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "findMissingTitles") {
    findMissingTitles();
    sendResponse({ received: true });
  }
  return true;
});

// Function to get video details from search
async function getVideoDetailsFromSearch(videoId) {
  try {
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "searchVideo",
          videoId,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Extension error:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          resolve(response);
        }
      );
    });
    if (result && result.title) {
      return {
        title: result.title,
        source: result.source,
        snapshot: result.snapshot,
      };
    }
    if (result && result.error) {
      console.error(
        `❌ Archive.org search error for ${videoId}:`,
        result.error
      );
    }
    return null;
  } catch (error) {
    console.error(`Error searching Archive.org for ${videoId}:`, error);
    return null;
  }
}

// Function to send progress update to popup
function sendProgressUpdate(type, data) {
  chrome.runtime.sendMessage({
    type: "searchProgress",
    data: data,
  });
}

// Function to check if unavailable videos are shown
function areUnavailableVideosShown() {
  try {
    const playlistItems = document.querySelectorAll(
      "ytd-playlist-video-renderer"
    );
    for (const item of playlistItems) {
      const text = item.textContent || "";
      if (
        text.includes("[Private video]") ||
        text.includes("[Deleted video]") ||
        text.includes("[Unavailable video]")
      ) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Error checking for unavailable videos:", error);
    return false;
  }
}

// Function to get all videos from the current playlist
async function getPlaylistVideos() {
  sendProgressUpdate("status", "Scanning playlist...");
  console.log("[YT Trackback] Scanning playlist for unavailable videos...");
  const unavailableShown = areUnavailableVideosShown();
  if (!unavailableShown) {
    sendProgressUpdate(
      "status",
      "Please enable 'Show unavailable videos' in the playlist menu first"
    );
    return [];
  }
  const playlistCountText =
    document.querySelector(
      "#stats .style-scope.ytd-playlist-sidebar-primary-info-renderer"
    )?.textContent || "";
  const totalVideosMatch = playlistCountText.match(/(\d+)/);
  const expectedTotalVideos = totalVideosMatch
    ? parseInt(totalVideosMatch[1])
    : 0;
  const getLoadedVideoCount = () =>
    document.querySelectorAll("ytd-playlist-video-renderer").length;
  let currentCount = getLoadedVideoCount();
  sendProgressUpdate(
    "status",
    `Loading playlist videos (${currentCount}/${expectedTotalVideos})...`
  );
  const maxScrollAttempts = 20;
  const scrollTimeout = 30000; // 30 seconds timeout
  let scrollAttempts = 0;
  let lastVideoCount = 0;
  const startTime = Date.now();
  while (
    currentCount < expectedTotalVideos &&
    scrollAttempts < maxScrollAttempts &&
    Date.now() - startTime < scrollTimeout
  ) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    currentCount = getLoadedVideoCount();
    if (currentCount > expectedTotalVideos) {
      break;
    }
    sendProgressUpdate(
      "status",
      `Loading playlist videos (${currentCount}/${expectedTotalVideos})...`
    );
    if (currentCount === lastVideoCount) {
      scrollAttempts++;
    } else {
      scrollAttempts = 0;
      lastVideoCount = currentCount;
    }
  }
  window.scrollTo(0, 0);
  const finalVideoCount = getLoadedVideoCount();
  if (finalVideoCount < expectedTotalVideos) {
    sendProgressUpdate(
      "status",
      `Warning: Could only load ${finalVideoCount}/${expectedTotalVideos} videos`
    );
  } else {
    console.log(
      `[YT Trackback] Finished loading videos. Found ${finalVideoCount}/${expectedTotalVideos} videos.`
    );
  }
  const videos = [];
  const videoElements = document.querySelectorAll(
    "ytd-playlist-video-renderer"
  );
  let unavailableCount = 0;
  for (const [index, element] of videoElements.entries()) {
    const position = index + 1;
    const videoLink = element.querySelector("a#video-title");
    const videoId = videoLink
      ? new URL(videoLink.href).searchParams.get("v")
      : null;
    const videoTitle = videoLink?.textContent?.trim() || "Unknown Title";
    const isPrivate = element.textContent.includes("[Private video]");
    const isDeleted = element.textContent.includes("[Deleted video]");
    const isUnavailable = element.textContent.includes("[Unavailable video]");
    if ((isPrivate || isDeleted || isUnavailable) && videoId) {
      unavailableCount++;
      sendProgressUpdate("videoFound", {
        position,
        videoId,
        status: isPrivate ? "private" : isDeleted ? "deleted" : "unavailable",
        searching: true,
      });
      const searchResult = await getVideoDetailsFromSearch(videoId);
      if (searchResult) {
        videos.push({
          title: searchResult.title,
          videoId,
          position,
          isUnavailable: true,
          reason: isPrivate ? "private" : isDeleted ? "deleted" : "unavailable",
          source: searchResult.source,
          snapshot: searchResult.snapshot,
        });
        sendProgressUpdate("videoFound", {
          position,
          videoId,
          status: isPrivate ? "private" : isDeleted ? "deleted" : "unavailable",
          title: searchResult.title,
          source: searchResult.source,
          searching: false,
        });
      } else {
        videos.push({
          title: `[${
            isPrivate ? "Private" : isDeleted ? "Deleted" : "Unavailable"
          } video] (ID: ${videoId})`,
          videoId,
          position,
          isUnavailable: true,
          reason: isPrivate ? "private" : isDeleted ? "deleted" : "unavailable",
          source: "none",
        });
        sendProgressUpdate("videoFound", {
          position,
          videoId,
          status: isPrivate ? "private" : isDeleted ? "deleted" : "unavailable",
          searching: false,
        });
      }
    }
  }
  return videos;
}

async function findMissingTitles() {
  try {
    const videos = await getPlaylistVideos();

    chrome.runtime.sendMessage({
      type: "searchCompleted",
      unavailableVideos: videos,
    });
  } catch (error) {
    console.error("Error finding titles:", error);
    chrome.runtime.sendMessage({
      type: "error",
      error: error.message,
    });
  }
}

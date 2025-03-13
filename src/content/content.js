// Function to get all videos from the current playlist
async function getPlaylistVideos() {
  const videos = [];
  const videoElements = document.querySelectorAll(
    "ytd-playlist-video-renderer"
  );

  videoElements.forEach((element) => {
    const titleElement = element.querySelector("#video-title");
    const title = titleElement
      ? titleElement.textContent.trim()
      : "Unknown Title";
    const videoId = element.getAttribute("data-video-id");
    const isUnavailable = element.querySelector(
      ".ytd-badge-supported-renderer"
    );

    videos.push({
      title,
      videoId,
      isUnavailable: Boolean(isUnavailable),
      timestamp: new Date().toISOString(),
    });
  });

  return videos;
}

// Function to take a snapshot of the current playlist
async function takeSnapshot() {
  try {
    const videos = await getPlaylistVideos();
    const unavailableVideos = videos.filter((video) => video.isUnavailable);

    // Store the snapshot
    chrome.storage.local.set({
      lastSnapshot: {
        videos,
        timestamp: new Date().toISOString(),
      },
      unavailableVideos,
    });

    // Notify popup about the new snapshot
    chrome.runtime.sendMessage({
      type: "snapshotTaken",
      unavailableVideos,
    });
  } catch (error) {
    console.error("Error taking snapshot:", error);
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "takeSnapshot") {
    takeSnapshot();
  }
});

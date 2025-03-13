document.addEventListener("DOMContentLoaded", () => {
  const status = document.getElementById("status");
  const takeSnapshot = document.getElementById("takeSnapshot");
  const unavailableVideos = document.getElementById("unavailableVideos");

  // Function to update status message
  function updateStatus(message, isError = false) {
    status.textContent = message;
    status.style.backgroundColor = isError ? "#fde8e8" : "#f0f9ff";
    status.style.color = isError ? "#dc2626" : "#0369a1";
  }

  // Function to display unavailable videos
  function displayUnavailableVideos(videos) {
    unavailableVideos.innerHTML = "";
    if (!videos || videos.length === 0) {
      unavailableVideos.innerHTML =
        '<div class="video-item">No unavailable videos found</div>';
      return;
    }

    videos.forEach((video) => {
      const videoElement = document.createElement("div");
      videoElement.className = "video-item";
      videoElement.textContent = video.title;
      unavailableVideos.appendChild(videoElement);
    });
  }

  // Handle take snapshot button click
  takeSnapshot.addEventListener("click", async () => {
    try {
      // Send message to content script to take snapshot
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.url.includes("youtube.com/playlist")) {
        updateStatus("Please open a YouTube playlist first", true);
        return;
      }

      updateStatus("Taking snapshot...");
      chrome.tabs.sendMessage(tab.id, { action: "takeSnapshot" });
    } catch (error) {
      updateStatus("Error: " + error.message, true);
    }
  });

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "snapshotTaken") {
      updateStatus("Snapshot taken successfully!");
      displayUnavailableVideos(message.unavailableVideos);
    }
  });

  // Initial load of any existing unavailable videos
  chrome.storage.local.get(["unavailableVideos"], (result) => {
    if (result.unavailableVideos) {
      displayUnavailableVideos(result.unavailableVideos);
    }
  });
});

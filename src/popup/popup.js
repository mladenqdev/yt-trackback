document.addEventListener("DOMContentLoaded", () => {
  const status = document.getElementById("status");
  const findMissingTitles = document.getElementById("findMissingTitles");
  const unavailableVideos = document.getElementById("unavailableVideos");
  let currentProgressItems = new Map();
  let sequentialCounter = 1;

  // High-level log: popup initialized
  console.log("[YT Trackback] Popup initialized");

  function updateStatus(message, isError = false) {
    status.textContent = message;
    status.style.backgroundColor = isError ? "#fde8e8" : "#f0f9ff";
    status.style.color = isError ? "#dc2626" : "#0369a1";
  }

  function createProgressItem(data) {
    const item = document.createElement("div");
    item.className = "video-item";

    const position = document.createElement("span");
    position.className = "position-number";

    let sequentialNumber = currentProgressItems.size + 1;
    if (currentProgressItems.has(data.videoId)) {
      sequentialNumber =
        Array.from(currentProgressItems.keys()).indexOf(data.videoId) + 1;
    }

    const content = document.createElement("div");
    content.className = "content";

    const title = document.createElement("div");
    title.className = "video-title";

    if (data.searching) {
      title.textContent = `Found unavailable video #${sequentialNumber} at position ${data.position}:`;
      const status = document.createElement("div");
      status.className = "status-text";
      status.innerHTML = 'Fetching title <span class="loader"></span>';
      content.appendChild(title);
      content.appendChild(status);
    } else if (data.title) {
      position.textContent = `#${sequentialNumber} (${data.position})`;
      title.textContent = data.title;
      content.appendChild(title);
    } else {
      position.textContent = `#${sequentialNumber} (${data.position})`;
      title.textContent = `[${data.status} video] (ID: ${data.videoId})`;
      content.appendChild(title);
    }

    item.appendChild(position);
    item.appendChild(content);
    return item;
  }

  function updateProgressDisplay(data) {
    let progressSection = document.getElementById("searchProgress");
    if (!progressSection) {
      progressSection = document.createElement("div");
      progressSection.id = "searchProgress";
      progressSection.className = "progress-section";
      unavailableVideos.appendChild(progressSection);
    }

    if (data.videoId) {
      let progressItem = currentProgressItems.get(data.videoId);
      if (!progressItem) {
        progressItem = createProgressItem(data);
        currentProgressItems.set(data.videoId, progressItem);
        progressSection.appendChild(progressItem);
      } else {
        const newItem = createProgressItem(data);
        progressSection.replaceChild(newItem, progressItem);
        currentProgressItems.set(data.videoId, newItem);
      }
    }
  }

  // Function to display unavailable videos
  function displayUnavailableVideos(videos) {
    unavailableVideos.innerHTML = "";
    sequentialCounter = 1;
    if (!videos || videos.length === 0) {
      unavailableVideos.innerHTML =
        "<div class='video-item'>No unavailable videos found</div>";
      return;
    }
    videos.forEach((video) => {
      const videoElement = document.createElement("div");
      videoElement.className = "video-item";
      const positionSpan = document.createElement("span");
      positionSpan.className = "position-number";
      positionSpan.textContent = `#${sequentialCounter} (${video.position})`;
      const titleContainer = document.createElement("div");
      titleContainer.className = "content";
      const titleSpan = document.createElement("div");
      titleSpan.className = "video-title";
      titleSpan.textContent =
        video.title || `[${video.reason} video] (ID: ${video.videoId})`;
      titleContainer.appendChild(titleSpan);
      videoElement.appendChild(positionSpan);
      videoElement.appendChild(titleContainer);
      if (video.videoId) {
        videoElement.title = `Video ID: ${video.videoId}`;
      }
      unavailableVideos.appendChild(videoElement);
      sequentialCounter++;
    });
  }

  // Handle take snapshot button click
  findMissingTitles.addEventListener("click", async () => {
    // High-level log: search started
    console.log("[YT Trackback] Find missing titles button clicked");
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.url?.includes("youtube.com/playlist")) {
        updateStatus("Please open a YouTube playlist first", true);
        return;
      }
      unavailableVideos.innerHTML = "";
      currentProgressItems.clear();
      updateStatus("Finding missing titles...");
      chrome.tabs.sendMessage(
        tab.id,
        { action: "findMissingTitles" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError);
            updateStatus(
              "Error: Could not communicate with YouTube page. Please refresh the page and try again.",
              true
            );
          }
        }
      );
    } catch (error) {
      console.error("Error:", error);
      updateStatus("Error: " + error.message, true);
    }
  });

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case "searchProgress":
        if (message.data.videoId) {
          updateProgressDisplay(message.data);
        } else if (message.data.status) {
          updateStatus(message.data.status);
        }
        break;
      case "searchCompleted":
        updateStatus("Search complete!");
        displayUnavailableVideos(message.unavailableVideos);
        break;
      case "error":
        updateStatus("Error: " + message.error, true);
        break;
    }
  });

  // Initial load of any existing unavailable videos
  chrome.storage.local.get(["unavailableVideos"], (result) => {
    if (result.unavailableVideos) {
      displayUnavailableVideos(result.unavailableVideos);
    }
  });

  // Show initial status
  updateStatus("Ready to find missing titles");
});

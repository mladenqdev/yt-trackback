// Listen for search requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "searchVideo") {
    // High-level log: search request received
    console.log(
      "[YT Trackback] Background received search request for:",
      message.videoId
    );
    handleSearch(message.videoId).then(sendResponse);
    return true;
  }
});

// Archive.org CDX API configuration
const archiveConfig = {
  cdxApi: "https://web.archive.org/cdx/search/cdx",
  waybackApi: "https://web.archive.org/web",
  // Fields we want from CDX API
  fields: ["timestamp", "original", "mimetype", "statuscode", "digest"],
  // Only get HTML snapshots that were successful
  filters: ["mimetype:text/html", "statuscode:200"],
  // Collapse duplicate snapshots by digest
  collapseBy: "digest",
  // Get newest snapshots first
  reverse: true,
  // Limit results to avoid too many snapshots
  limit: 5,
};

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}

async function fetchText(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}

async function fetchWithRetry(url, maxRetries = 3, initialDelay = 2000) {
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      if (response.status === 503) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

async function fetchCdxApi(videoId) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(
    videoUrl
  )}&output=json&fl=original,timestamp,mimetype,statuscode,digest&filter=statuscode:200&filter=mimetype:text/html&collapse=digest&limit=5`;

  // High-level log: starting CDX API request
  console.log(`[YT Trackback] Querying CDX API for video: ${videoId}`);

  try {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const response = await fetchWithRetry(cdxUrl);
    const data = await response.json();
    if (!data || data.length < 2) {
      // High-level log: no snapshots found
      console.log("[YT Trackback] No snapshots found in CDX response");
      return [];
    }

    // First row contains field names, rest are snapshots
    const [fields, ...snapshots] = data;
    return snapshots;
  } catch (error) {
    console.error("CDX API error:", error);
    throw new Error(`Failed to fetch from CDX API: ${error.message}`);
  }
}

async function extractTitleFromSnapshot(timestamp, originalUrl) {
  const waybackUrl = `https://web.archive.org/web/${timestamp}/${originalUrl}`;

  try {
    const response = await fetchWithRetry(waybackUrl);
    const html = await response.text();

    const patterns = [
      /<meta\s+property="og:title"\s+content="([^"]+)"/i,
      /<meta\s+name="title"\s+content="([^"]+)"/i,
      /<title[^>]*>([^<]+)<\/title>/i,
      /<h1[^>]*>([^<]+)<\/h1>/i,
      /<h1 class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let title = match[1].trim();
        title = title.replace(/\s*- YouTube$/, "");
        title = title.replace(/^\s+|\s+$/g, "");
        title = title.replace(/\s+/g, " ");
        // High-level log: found title
        console.log(`[YT Trackback] Found title for snapshot: ${title}`);
        return {
          title,
          source: `wayback-${pattern.source.substring(0, 20)}...`,
          url: waybackUrl,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Snapshot fetch error:", error);
    throw error;
  }
}

async function handleSearch(videoId) {
  try {
    // High-level log: search started
    console.log(`[YT Trackback] Starting search for video: ${videoId}`);
    const snapshots = await fetchCdxApi(videoId);
    if (snapshots.length === 0) {
      // High-level log: no snapshots found
      console.log("[YT Trackback] No snapshots found for video.");
      return { title: null, error: "No snapshots found" };
    }

    // Try each snapshot until we find a title
    for (const snapshot of snapshots) {
      const [originalUrl, timestamp] = snapshot;
      try {
        const result = await extractTitleFromSnapshot(timestamp, originalUrl);
        if (result?.title) {
          return {
            title: result.title,
            source: result.source,
            snapshot: {
              timestamp,
              url: result.url,
            },
          };
        }
      } catch (error) {
        console.error("Error processing snapshot:", error);
        continue; // Try next snapshot
      }
    }

    // High-level log: no title found in any snapshot
    console.log("[YT Trackback] No title found in any snapshot");
    return { title: null, error: "No title found in any snapshot" };
  } catch (error) {
    console.error("Search error:", error);
    return { title: null, error: error.message };
  }
}

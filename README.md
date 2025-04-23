# YT Trackback

YT Trackback is a Chrome extension that helps you recover lost videos from your YT playlists. If you're like me and you don't use Spotify, Tidal, Deezer, or other popular music platforms, but instead carefully curate your playlists on YouTube, you've probably faced the frustrating moment when you open a playlist after a while, only to find that some videos are missing, with no way to know which ones! That's why I created YT Trackback: to help you identify, track, and recover information about unavailable videos in your YouTube playlists.

---

## Features

🎯 **Playlist Integrity**

- Scan any YouTube playlist for unavailable (deleted, private, or region-blocked) videos
- See a clear, organized list of all missing videos

🕵️‍♂️ **Title Recovery**

- Attempts to recover the original titles of unavailable videos using the Internet Archive (Wayback Machine)

📋 **User Experience**

- Simple, intuitive popup UI
- Real-time progress updates as your playlist is scanned
- Clear instructions if unavailable videos are hidden by YouTube

🔒 **Privacy-First**

- All processing happens locally in your browser
- No data is sent to any server except for public archive lookups

---

## Tech Stack

- **Platform:** Chrome Extension (Manifest V3)
- **Languages:** JavaScript, HTML, CSS
- **UI:** Vanilla JS, custom CSS
- **APIs:**
  - Chrome Extensions API (background, content, popup scripts)
  - Archive.org (Wayback Machine CDX API)
- **Other:**
  - DOM scraping and dynamic playlist scrolling
  - Service Worker for background tasks

---

## How It Works

1. **Open a YouTube playlist** and click the YT Trackback extension icon.
2. **Click "Find Missing Titles"** in the popup.
3. The extension **scans the playlist**, ensuring all videos are loaded (even in very large playlists).
4. **Unavailable videos are detected** (private, deleted, or otherwise missing).
5. For each unavailable video, YT Trackback **queries the Internet Archive** to try to recover the original title and provides a link to the archived page if found.
6. **Results are displayed** in a clean, scrollable list in the popup.

---

## Why I Built This

I love building and maintaining YouTube playlists, but YouTube doesn't tell you which videos have gone missing over time. This extension is for anyone who wants to preserve the integrity of their playlists and maybe even rediscover lost favorites. YT Trackback is my solution to a problem every YouTube curator eventually faces.

---

## Installation & Usage

1. Clone or download this repository.
2. Go to `chrome://extensions` in your browser.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select the project folder.
5. Open any YouTube playlist, click show unavailable videos (if there are any) and then click the YT Trackback icon to recover them!

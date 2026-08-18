<div align="center">

<img src="https://img.shields.io/badge/Spotified-v2.3.0-a855f7?style=for-the-badge&logo=spotify&logoColor=white" alt="Spotified">

# Spotified 🎵

**Open-source Spotify downloader with metadata, cover art & bulk queue**

[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-a855f7?style=flat-square)](LICENSE)
[![Author](https://img.shields.io/badge/Author-Shivam%20Kumar-ec4899?style=flat-square)](https://github.com/jakemusicartist-stack)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)]()

</div>

---

## 📖 About

**Spotified** is a free, open-source tool that lets you download Spotify tracks and playlists as high-quality MP3 files — complete with embedded metadata and album art. No account, no subscription, no API keys needed.

I built this as a personal project to learn Python, PyQt6, and web development. It started as a simple script and grew into a full desktop GUI, a web interface, and a scriptable CLI — all sharing the same core engine. The whole thing runs locally on your machine, meaning nothing is uploaded anywhere and your downloads are completely private.

Whether you want to grab a single song, pull an entire playlist, or automate downloads from a terminal script, Spotified has you covered. It works by pulling track info from Spotify's public embed pages and then finding and downloading the matching audio from YouTube using `yt-dlp` and FFmpeg — no DRM, no paywalls, just the music you already love.

> **Built by a 16-year-old developer** who wanted a tool that actually worked — so he built one himself.

---

## ✨ Features

- 🎧 **Download any Spotify track or playlist** — high-fidelity MP3 with full metadata
- 🖼️ **Cover art embedded** — album artwork baked directly into the file
- ⚡ **Bulk parallel queue** — process up to 5 links simultaneously
- 🌐 **Web UI + Desktop GUI** — use it in your browser or as a native app
- 🔁 **CLI support** — scriptable via `python spotified_cli.py`
- 🌓 **Dark / Light / System theme**

---

## 🚀 Quick Start

### Web App (Easiest)

1. **Clone the repo**
   ```bash
   git clone https://github.com/jakemusicartist-stack/spotified.git
   cd spotified
   ```

2. **Double-click `start.bat`** (Windows)
   - First run: auto-installs all dependencies
   - Subsequent runs: opens instantly (no dep check)
   - Your browser opens automatically at `http://localhost:5000`

### Desktop GUI

```bash
pip install -r req.txt
python Spotify_Downloader.py
```

### CLI

```bash
python spotified_cli.py download "https://open.spotify.com/track/..." --out "./Music"
python spotified_cli.py download "https://open.spotify.com/playlist/..." --json
```

---

## 📋 Requirements

| Requirement | Version |
|-------------|---------|
| Python | 3.9+ |
| PyQt6 | 6.11+ |
| yt-dlp | 2024.8.6+ |
| mutagen | 1.46+ |
| requests | 2.32+ |
| **ffmpeg** | Bundled (`ffmpeg.exe`) |

> ffmpeg is bundled in the repo — no separate install needed on Windows.

---

## 📁 Project Structure

```
spotified/
├── Spotify_Downloader.py   # Desktop GUI (PyQt6)
├── spotified_cli.py          # Headless CLI
├── spotifydown_api.py      # Spotify metadata API
├── req.txt                 # Python dependencies
├── ffmpeg.exe              # Bundled FFmpeg (Windows)
├── start.bat               # One-click web app launcher
├── web-app/
│   ├── static/             # Frontend (HTML, CSS, JS)
│   └── spotified-backend/    # Flask API backend
└── scripts/
    ├── install.ps1         # Windows installer
    └── install.sh          # macOS/Linux installer
```

---

## 🛠️ How It Works

1. Spotified fetches track metadata from Spotify's public embed API (no auth needed)
2. It searches YouTube for the matching audio using `yt-dlp`
3. The audio is downloaded and converted to MP3 via FFmpeg
4. Metadata (title, artist, album, year) and cover art are embedded using `mutagen`

---

## ⚠️ Disclaimer

This is a **student portfolio project** built for educational purposes only.

- Use only with content you own or have rights to download
- The developer is not responsible for any misuse
- Spotify and YouTube are trademarks of their respective owners
- This tool does not bypass DRM or paid content protections

---

## 👤 Developer

| | |
|---|---|
| **Name** | Shivam Kumar |
| **Age** | 16 (2026) |
| **GitHub** | [@jakemusicartist-stack](https://github.com/jakemusicartist-stack) |
| **Email** | jakemusicartist@gmail.com |

---

<div align="center">

Made with 💜 by **Shivam Kumar**

</div>

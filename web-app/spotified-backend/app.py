"""Flask backend for Spotified web client.

Lightweight API that fetches Spotify metadata without downloading.
Optimized for free-tier hosting (512MB RAM, 0.1 CPU).

For actual MP3 downloads, use the desktop app.
"""

from __future__ import annotations

import gc
import os
import sys
from pathlib import Path

from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS
import subprocess
import json

# Add parent directory to path for spotifydown_api import
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from spotifydown_api import (  # noqa: E402
    PlaylistClient,
    SpotifyDownAPIError,
    SpotifyEmbedAPI,
    detect_spotify_url_type,
)

app = Flask(__name__, static_folder="../static", static_url_path="")
CORS(app)

# Reusable client (saves memory on repeated requests)
_playlist_client: PlaylistClient | None = None


def get_playlist_client() -> PlaylistClient:
    """Get or create a playlist client (singleton pattern for memory efficiency)."""
    global _playlist_client
    if _playlist_client is None:
        _playlist_client = PlaylistClient()
    return _playlist_client


@app.route("/api/scrape-playlist", methods=["POST"])
def scrape_playlist():
    """Fetch Spotify playlist/track metadata (no downloads).

    This endpoint is optimized for free-tier hosting:
    - No file downloads (saves CPU/memory/disk)
    - No yt-dlp/FFmpeg processing
    - Just returns metadata for the frontend to display

    Request body:
        {"playlistUrl": "https://open.spotify.com/playlist/..."}

    Response:
        {"event": "complete", "data": {"playlistName": "...", "tracks": [...]}}
    """
    try:
        data = request.get_json()
        spotify_url = data.get("playlistUrl", "").strip()

        if not spotify_url:
            return jsonify({"event": "error", "data": {"message": "No URL provided"}}), 400

        # Detect URL type
        url_type, item_id = detect_spotify_url_type(spotify_url)

        if url_type == "unknown" or not item_id:
            return (
                jsonify({"event": "error", "data": {"message": "Invalid Spotify URL"}}),
                400,
            )

        client = get_playlist_client()
        tracks: list[dict] = []

        if url_type == "track":
            # Single track
            api = SpotifyEmbedAPI()
            track = api.get_track(item_id)
            tracks.append(
                {
                    "id": track.spotify_id,
                    "title": track.title,
                    "artists": track.artists,
                    "album": track.album or "",
                    "cover": track.cover_url or "",
                    "releaseDate": track.release_date or "",
                    "downloadLink": "",  # No server-side downloads
                }
            )
            playlist_name = f"{track.title} - {track.artists}"

        else:
            # Playlist or album (album reuses the same embed-parsing path).
            metadata = client.get_playlist_metadata(item_id, content_type=url_type)
            playlist_name = f"{metadata.name} - {metadata.owner or 'Unknown'}"
            playlist_cover = metadata.cover_url or ""

            # Fetch tracks with memory-efficient iteration
            for track in client.iter_playlist_tracks(item_id, content_type=url_type):
                # Use track cover if available, otherwise fall back to playlist cover
                cover = track.cover_url or playlist_cover
                tracks.append(
                    {
                        "id": track.spotify_id,
                        "title": track.title,
                        "artists": track.artists,
                        "album": track.album or "",
                        "cover": cover,
                        "releaseDate": track.release_date or "",
                        "downloadLink": "",  # No server-side downloads
                    }
                )

                # Memory management for large playlists
                if len(tracks) % 50 == 0:
                    gc.collect()

        # Final cleanup
        gc.collect()

        return jsonify(
            {
                "event": "complete",
                "data": {
                    "playlistName": playlist_name,
                    "tracks": tracks,
                },
            }
        )

    except ValueError:
        # bad/unsupported spotify url is client input error, not a server fault
        return jsonify({"event": "error", "data": {"message": "Invalid Spotify URL"}}), 400
    except SpotifyDownAPIError:
        # log the detail server-side; don't leak exception internals to the client
        app.logger.exception("spotify api error during scrape")
        return jsonify({"event": "error", "data": {"message": "Spotify API error"}}), 500
    except Exception:
        app.logger.exception("unexpected error during scrape")
        return jsonify({"event": "error", "data": {"message": "Internal server error"}}), 500


@app.route("/api/download", methods=["POST"])
def start_download():
    """Start a download using the local CLI and stream NDJSON progress via SSE."""
    data = request.get_json()
    spotify_url = data.get("url", "").strip()
    out_dir = data.get("out", "")

    if not spotify_url:
        return jsonify({"error": "No URL provided"}), 400

    def generate():
        cli_path = ROOT / "spotified_cli.py"
        cmd = [sys.executable, "-X", "utf8", str(cli_path), "download", spotify_url, "--json", "--no-lock"]
        if out_dir:
            cmd.extend(["--out", out_dir])

        # Run the CLI, streaming stdout as SSE
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        has_output = False
        for line in process.stdout:
            line_str = line.strip()
            if not line_str:
                continue
            has_output = True
            try:
                # Validate it's NDJSON
                json.loads(line_str)
                yield f"data: {line_str}\n\n"
            except json.JSONDecodeError:
                # If it's a traceback or error, wrap it in a proper JSON error event
                error_data = {"event": "error", "message": line_str}
                yield f"data: {json.dumps(error_data)}\n\n"

        process.wait()
        if process.returncode != 0 and not has_output:
            error_data = {"event": "error", "message": f"CLI failed to start (exit code {process.returncode})"}
            yield f"data: {json.dumps(error_data)}\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream")


@app.route("/api/health")
def health_check():
    """Health check endpoint for monitoring."""
    return jsonify({"status": "ok", "mode": "metadata-only"})


from flask import send_from_directory

@app.route("/")
def index():
    """Serve the Vanilla HTML frontend."""
    return send_from_directory(app.static_folder, "index.html")



if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))

    # ── Spotified branded startup banner ──────────────────────────────────────
    banner = f"""
\033[95m
  ███████╗██████╗  ██████╗ ████████╗██╗███████╗██╗███████╗██████╗
  ██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝██║██╔════╝██║██╔════╝██╔══██╗
  ███████╗██████╔╝██║   ██║   ██║   ██║█████╗  ██║█████╗  ██║  ██║
  ╚════██║██╔═══╝ ██║   ██║   ██║   ██║██╔══╝  ██║██╔══╝  ██║  ██║
  ███████║██║     ╚██████╔╝   ██║   ██║██║     ██║███████╗██████╔╝
  ╚══════╝╚═╝      ╚═════╝    ╚═╝   ╚═╝╚═╝     ╚═╝╚══════╝╚═════╝
\033[0m
  \033[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m
  \033[1m  Open-source Spotify Downloader\033[0m
  \033[90m  Built by Shivam Kumar  ·  github.com/jakemusicartist-stack\033[0m
  \033[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m

  \033[92m●\033[0m  Server running at  \033[1mhttp://localhost:{port}\033[0m
  \033[93m●\033[0m  Press \033[1mCtrl+C\033[0m to stop

  \033[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m
"""
    print(banner)

    # Suppress Flask/Werkzeug's own startup noise
    import logging as _logging
    _logging.getLogger("werkzeug").setLevel(_logging.ERROR)

    app.run(host="0.0.0.0", port=port, debug=False)

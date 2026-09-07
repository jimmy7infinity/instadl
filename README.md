# instadl

Web app: paste a public Instagram post or reel URL, preview original media, pick carousel items, download.

## Local

Install [yt-dlp](https://github.com/yt-dlp/yt-dlp) and ffmpeg, then:

```bash
npm install
npm run dev
```

Open http://localhost:3000

Optional: `YTDLP_PATH` if `yt-dlp` is not on `PATH`.

## Railway

This repo builds with the `Dockerfile` (Node standalone server + yt-dlp + ffmpeg). Create a Railway service from the GitHub repo; no extra env vars are required for public posts.

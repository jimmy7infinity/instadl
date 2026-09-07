import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { MediaItem, MediaKind } from "@/lib/jobs";

const DOWNLOAD_TIMEOUT_MS = 90_000;

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "bmp"]);
const VIDEO_EXTS = new Set(["mp4", "m4v", "webm", "mkv", "mov"]);

export class YtDlpError extends Error {
  constructor(
    message: string,
    readonly publicMessage: string,
  ) {
    super(message);
    this.name = "YtDlpError";
  }
}

function kindForExt(ext: string): MediaKind | null {
  if (IMAGE_EXTS.has(ext)) {
    return "image";
  }
  if (VIDEO_EXTS.has(ext)) {
    return "video";
  }
  return null;
}

function publicMessageFromLog(log: string): string {
  const lower = log.toLowerCase();
  if (lower.includes("login required") || lower.includes("please log in")) {
    return "Instagram asked for a login. This post may be private.";
  }
  if (lower.includes("private")) {
    return "This post is private.";
  }
  if (
    lower.includes("429") ||
    lower.includes("rate-limit") ||
    lower.includes("rate limit") ||
    lower.includes("http error 403") ||
    lower.includes("unable to extract") ||
    lower.includes("instagram sent an empty")
  ) {
    return "Instagram blocked this request. Try again in a few minutes.";
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return "That post could not be found.";
  }
  return "Could not fetch this post in original quality.";
}

export async function downloadWithYtDlp(url: string, outDir: string): Promise<void> {
  const bin = process.env.YTDLP_PATH ?? "yt-dlp";
  const args = [
    "--no-warnings",
    "--no-mtime",
    "--no-progress",
    "--restrict-filenames",
    "--yes-playlist",
    "--socket-timeout",
    "30",
    "--retries",
    "2",
    "--fragment-retries",
    "2",
    "--max-filesize",
    "500M",
    "-f",
    "bestvideo*+bestaudio/best",
    "--merge-output-format",
    "mp4",
    "-o",
    path.join(outDir, "%(autonumber)03d.%(ext)s"),
    "--autonumber-start",
    "1",
    url,
  ];

  const log = await run(bin, args, DOWNLOAD_TIMEOUT_MS);
  if (log.exitCode !== 0) {
    throw new YtDlpError(log.stderr || log.stdout || `yt-dlp exited ${log.exitCode}`, publicMessageFromLog(`${log.stderr}\n${log.stdout}`));
  }
}

export async function listMediaItems(dir: string, shortcode: string): Promise<MediaItem[]> {
  const names = await readdir(dir);
  const media: MediaItem[] = [];

  for (const diskName of names.sort()) {
    const ext = path.extname(diskName).slice(1).toLowerCase();
    const kind = kindForExt(ext);
    if (!kind) {
      continue;
    }
    const full = path.join(dir, diskName);
    const info = await stat(full);
    if (!info.isFile() || info.size <= 0) {
      continue;
    }
    media.push({
      index: media.length,
      kind,
      diskName,
      filename: downloadName(shortcode, media.length, ext),
      bytes: info.size,
    });
  }

  if (media.length === 0) {
    throw new YtDlpError("No media files after yt-dlp", "No image or video was found on that post.");
  }

  return media;
}

function downloadName(shortcode: string, index: number, ext: string): string {
  const n = String(index + 1).padStart(2, "0");
  return `instagram-${shortcode}-${n}.${ext}`;
}

type RunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

function run(bin: string, args: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      if (!settled) {
        settled = true;
        reject(
          new YtDlpError("yt-dlp timed out", "Fetching this post took too long. Try again."),
        );
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > 80_000) {
        stdout = stdout.slice(-40_000);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 80_000) {
        stderr = stderr.slice(-40_000);
      }
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      if (settled) {
        return;
      }
      settled = true;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new YtDlpError(
            "yt-dlp missing",
            "yt-dlp is not installed on this server.",
          ),
        );
        return;
      }
      reject(error);
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      if (settled) {
        return;
      }
      settled = true;
      resolve({ exitCode, stdout, stderr });
    });
  });
}

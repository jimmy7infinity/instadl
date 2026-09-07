import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
};

function contentType(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return TYPES[ext] ?? "application/octet-stream";
}

function contentDisposition(filename: string, mode: "inline" | "attachment"): string {
  const encoded = encodeURIComponent(filename);
  return `${mode}; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encoded}`;
}

export async function streamFile(options: {
  filePath: string;
  filename: string;
  request: Request;
  download: boolean;
}): Promise<Response> {
  const info = await stat(options.filePath);
  const type = contentType(options.filename);
  const disposition = contentDisposition(
    options.filename,
    options.download ? "attachment" : "inline",
  );

  const range = options.request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      return new Response("Invalid range", { status: 416 });
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : info.size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= info.size) {
      return new Response("Invalid range", {
        status: 416,
        headers: { "Content-Range": `bytes */${info.size}` },
      });
    }
    const chunkSize = end - start + 1;
    const nodeStream = createReadStream(options.filePath, { start, end });
    return new Response(Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${info.size}`,
        "Accept-Ranges": "bytes",
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=120",
      },
    });
  }

  const nodeStream = createReadStream(options.filePath);
  return new Response(Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(info.size),
      "Accept-Ranges": "bytes",
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=120",
    },
  });
}

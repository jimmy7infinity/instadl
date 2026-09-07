import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { streamFile } from "@/lib/file-response";
import { getJob, isJobId, type Job, type MediaItem } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function selectedItems(job: Job, indicesRaw: string | null): MediaItem[] | null {
  if (!indicesRaw) {
    return job.items;
  }
  const indices = indicesRaw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n));
  if (indices.length === 0) {
    return [];
  }
  const unique = [...new Set(indices)];
  const items: MediaItem[] = [];
  for (const index of unique) {
    const item = job.items.find((entry) => entry.index === index);
    if (!item) {
      return null;
    }
    items.push(item);
  }
  return items;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") ?? "";
  if (!isJobId(jobId)) {
    return Response.json({ error: "Unknown job." }, { status: 404 });
  }

  const job = getJob(jobId);
  if (!job) {
    return Response.json({ error: "This download expired. Fetch the link again." }, { status: 410 });
  }

  const items = selectedItems(job, url.searchParams.get("indices"));
  if (!items) {
    return Response.json({ error: "One of the selected files is missing." }, { status: 400 });
  }
  if (items.length === 0) {
    return Response.json({ error: "Select at least one file." }, { status: 400 });
  }

  if (items.length === 1) {
    const item = items[0];
    return streamFile({
      filePath: path.join(job.dir, item.diskName),
      filename: item.filename,
      request,
      download: true,
    });
  }

  const archive = new ZipArchive({ store: true });
  for (const item of items) {
    archive.append(createReadStream(path.join(job.dir, item.diskName)), {
      name: item.filename,
    });
  }
  void archive.finalize();

  const zipName = `instagram-${job.shortcode}.zip`;
  return new Response(Readable.toWeb(archive) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "no-store",
    },
  });
}

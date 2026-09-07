import path from "node:path";
import { streamFile } from "@/lib/file-response";
import { getJob, isJobId } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ jobId: string; index: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { jobId, index: indexRaw } = await context.params;
  if (!isJobId(jobId)) {
    return Response.json({ error: "Unknown job." }, { status: 404 });
  }

  const index = Number(indexRaw);
  if (!Number.isInteger(index) || index < 0) {
    return Response.json({ error: "Unknown file." }, { status: 404 });
  }

  const job = getJob(jobId);
  if (!job) {
    return Response.json({ error: "This preview expired. Fetch the link again." }, { status: 410 });
  }

  const item = job.items[index];
  if (!item || item.index !== index) {
    return Response.json({ error: "Unknown file." }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  return streamFile({
    filePath: path.join(job.dir, item.diskName),
    filename: item.filename,
    request,
    download,
  });
}

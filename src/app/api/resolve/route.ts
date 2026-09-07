import { randomUUID } from "node:crypto";
import { clientIp } from "@/lib/client-ip";
import { parseInstagramUrl } from "@/lib/instagram-url";
import { createJobDir, deleteJob, persistJob, putJob, type Job } from "@/lib/jobs";
import { allowResolve } from "@/lib/rate-limit";
import { downloadWithYtDlp, listMediaItems, YtDlpError } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type ResolveBody = {
  url?: unknown;
};

export async function POST(request: Request) {
  if (!allowResolve(clientIp(request))) {
    return Response.json(
      { error: "Too many requests. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  let body: ResolveBody;
  try {
    body = (await request.json()) as ResolveBody;
  } catch {
    return Response.json({ error: "Send a JSON body with a url." }, { status: 400 });
  }

  if (typeof body.url !== "string") {
    return Response.json({ error: "Paste an Instagram post or reel link." }, { status: 400 });
  }

  const parsed = parseInstagramUrl(body.url);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const id = randomUUID();
  const dir = await createJobDir(id);

  try {
    await downloadWithYtDlp(parsed.value.canonical, dir);
    const items = await listMediaItems(dir, parsed.value.shortcode);
    const job: Job = {
      id,
      createdAt: Date.now(),
      sourceUrl: parsed.value.canonical,
      shortcode: parsed.value.shortcode,
      dir,
      items,
    };
    putJob(job);
    await persistJob(job);

    return Response.json({
      jobId: job.id,
      shortcode: job.shortcode,
      items: job.items.map((item) => ({
        index: item.index,
        kind: item.kind,
        filename: item.filename,
        bytes: item.bytes,
      })),
    });
  } catch (error) {
    await deleteJob(id);
    if (error instanceof YtDlpError) {
      return Response.json({ error: error.publicMessage }, { status: 422 });
    }
    console.error(error);
    return Response.json({ error: "Could not fetch this post." }, { status: 500 });
  }
}

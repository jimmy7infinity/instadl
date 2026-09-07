import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type MediaKind = "image" | "video";

export type MediaItem = {
  index: number;
  kind: MediaKind;
  filename: string;
  diskName: string;
  bytes: number;
};

export type Job = {
  id: string;
  createdAt: number;
  sourceUrl: string;
  shortcode: string;
  dir: string;
  items: MediaItem[];
};

const TTL_MS = 15 * 60 * 1000;
const JOB_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type JobsGlobal = typeof globalThis & {
  __instadlJobs?: Map<string, Job>;
  __instadlCleanup?: ReturnType<typeof setInterval>;
};

function store(): Map<string, Job> {
  const g = globalThis as JobsGlobal;
  if (!g.__instadlJobs) {
    g.__instadlJobs = new Map();
  }
  return g.__instadlJobs;
}

export function jobsRoot(): string {
  return process.env.JOBS_DIR ?? path.join(tmpdir(), "instadl-jobs");
}

export function isJobId(value: string): boolean {
  return JOB_ID.test(value);
}

export async function createJobDir(id: string): Promise<string> {
  const dir = path.join(jobsRoot(), id);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function putJob(job: Job): void {
  store().set(job.id, job);
  ensureCleanup();
}

export function getJob(id: string): Job | undefined {
  const job = store().get(id);
  if (!job) {
    return undefined;
  }
  if (Date.now() - job.createdAt > TTL_MS) {
    void deleteJob(id);
    return undefined;
  }
  return job;
}

export async function persistJob(job: Job): Promise<void> {
  await writeFile(
    path.join(job.dir, "job.json"),
    JSON.stringify(
      {
        id: job.id,
        createdAt: job.createdAt,
        sourceUrl: job.sourceUrl,
        shortcode: job.shortcode,
        items: job.items,
      },
      null,
      2,
    ),
  );
}

export async function deleteJob(id: string): Promise<void> {
  const job = store().get(id);
  store().delete(id);
  const dir = job?.dir ?? path.join(jobsRoot(), id);
  await rm(dir, { recursive: true, force: true });
}

async function sweep(): Promise<void> {
  const now = Date.now();
  for (const [id, job] of store()) {
    if (now - job.createdAt > TTL_MS) {
      await deleteJob(id);
    }
  }
}

function ensureCleanup(): void {
  const g = globalThis as JobsGlobal;
  if (g.__instadlCleanup) {
    return;
  }
  g.__instadlCleanup = setInterval(() => {
    void sweep();
  }, 60_000);
  g.__instadlCleanup.unref?.();
}

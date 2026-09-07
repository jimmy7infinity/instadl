"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Download,
  Image as ImageIcon,
  LoaderCircle,
  Video,
} from "lucide-react";

type MediaKind = "image" | "video";

type ResolvedItem = {
  index: number;
  kind: MediaKind;
  filename: string;
  bytes: number;
};

type ResolveResponse = {
  jobId: string;
  shortcode: string;
  items: ResolvedItem[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kindLabel(kind: MediaKind): string {
  switch (kind) {
    case "image":
      return "Photo";
    case "video":
      return "Video";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function Downloader() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolveResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const selectedCount = selected.size;
  const allSelected = result !== null && selectedCount === result.items.length;

  const downloadHref = useMemo(() => {
    if (!result || selectedCount === 0) {
      return null;
    }
    const indices = [...selected].sort((a, b) => a - b).join(",");
    return `/api/download?jobId=${encodeURIComponent(result.jobId)}&indices=${indices}`;
  }, [result, selected, selectedCount]);

  const downloadAllHref = useMemo(() => {
    if (!result) {
      return null;
    }
    return `/api/download?jobId=${encodeURIComponent(result.jobId)}`;
  }, [result]);

  async function onFetch(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    setSelected(new Set());

    try {
      const response = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as ResolveResponse & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not fetch this post.");
        return;
      }
      setResult(data);
      setSelected(new Set(data.items.map((item) => item.index)));
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function selectAll() {
    if (!result) {
      return;
    }
    setSelected(new Set(result.items.map((item) => item.index)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  return (
    <div className="flex w-full flex-col gap-10">
      <form onSubmit={onFetch} className="flex flex-col gap-4">
        <label
          htmlFor="instagram-url"
          className="text-[13px] font-medium tracking-[0.14em] text-ink/55 uppercase"
        >
          Instagram link
        </label>
        <div className="viewfinder">
          <span className="vf-bl" aria-hidden />
          <span className="vf-br" aria-hidden />
          <input
            id="instagram-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.instagram.com/p/…"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Instagram post or reel URL"
            className="h-14 w-full rounded-none border-0 bg-transparent px-5 font-sans text-[16px] text-ink outline-none placeholder:text-ink/30 sm:text-[17px]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading || url.trim().length === 0}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 bg-ink px-5 text-[14px] font-medium text-paper transition-colors duration-200 hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/25"
          >
            {loading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                Fetching original…
              </>
            ) : (
              "Fetch original"
            )}
          </button>
          <p className="text-[13px] text-ink/50">Public posts, reels, and carousels.</p>
        </div>
      </form>

      {error ? (
        <p
          role="alert"
          className="border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-900"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="flex flex-col gap-5" aria-live="polite">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[13px] font-medium tracking-[0.14em] text-ink/55 uppercase">
                {result.items.length === 1 ? "1 file" : `${result.items.length} files`}
              </p>
              <p className="mt-1 text-[15px] text-ink/70">
                {selectedCount === 0
                  ? "Select the photos or videos you want."
                  : `${selectedCount} selected`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={allSelected ? selectNone : selectAll}
                className="h-10 cursor-pointer border border-line bg-paper px-3 text-[13px] font-medium text-ink transition-colors duration-200 hover:border-ink/30"
              >
                {allSelected ? "Clear selection" : "Select all"}
              </button>
              {downloadHref ? (
                <a
                  href={downloadHref}
                  className="inline-flex h-10 cursor-pointer items-center gap-2 bg-teal px-4 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-teal/90"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Download selected
                </a>
              ) : (
                <span className="inline-flex h-10 items-center gap-2 bg-teal/30 px-4 text-[13px] font-medium text-white">
                  <Download className="h-4 w-4" aria-hidden />
                  Download selected
                </span>
              )}
              {downloadAllHref ? (
                <a
                  href={downloadAllHref}
                  className="inline-flex h-10 cursor-pointer items-center border border-line bg-paper px-4 text-[13px] font-medium text-ink transition-colors duration-200 hover:border-ink/30"
                >
                  Download all
                </a>
              ) : null}
            </div>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {result.items.map((item) => {
              const isSelected = selected.has(item.index);
              const src = `/api/jobs/${result.jobId}/file/${item.index}`;
              return (
                <li
                  key={item.index}
                  className={`contact-frame overflow-hidden transition-colors duration-200 ${
                    isSelected ? "contact-frame-on" : ""
                  }`}
                >
                  <div className="relative aspect-[4/5] w-full bg-ink/[0.04]">
                    {item.kind === "video" ? (
                      <video
                        src={src}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        controls
                      />
                    ) : (
                      // Job media is streamed locally; next/image cannot optimize these.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full cursor-pointer object-cover"
                        onClick={() => toggle(item.index)}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(item.index)}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? "Deselect" : "Select"} ${kindLabel(item.kind)} ${item.index + 1}`}
                      className={`absolute top-3 left-3 flex h-7 w-7 cursor-pointer items-center justify-center border transition-colors duration-200 ${
                        isSelected
                          ? "border-gold bg-gold text-ink"
                          : "border-white/80 bg-black/25 text-white"
                      }`}
                    >
                      {isSelected ? (
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                      ) : null}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggle(item.index)}
                      className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink"
                    >
                      {item.kind === "video" ? (
                        <Video className="h-3.5 w-3.5 text-ink/50" aria-hidden />
                      ) : (
                        <ImageIcon className="h-3.5 w-3.5 text-ink/50" aria-hidden />
                      )}
                      {kindLabel(item.kind)} {String(item.index + 1).padStart(2, "0")}
                    </button>
                    <span className="font-mono text-[11px] tracking-wide text-ink/45">
                      {formatBytes(item.bytes)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

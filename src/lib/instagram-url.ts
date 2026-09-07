const ALLOWED_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
  "instagr.am",
  "www.instagr.am",
]);

const SHORTCODE = /^[A-Za-z0-9_-]+$/;

type InstagramKind = "post" | "reel" | "tv";

export type ParsedInstagramUrl = {
  canonical: string;
  kind: InstagramKind;
  shortcode: string;
};

export type ParseResult =
  | { ok: true; value: ParsedInstagramUrl }
  | { ok: false; error: string };

function kindFromSegment(segment: string): InstagramKind | null {
  switch (segment) {
    case "p":
      return "post";
    case "reel":
    case "reels":
      return "reel";
    case "tv":
      return "tv";
    default:
      return null;
  }
}

function canonicalPath(kind: InstagramKind, shortcode: string): string {
  switch (kind) {
    case "post":
      return `/p/${shortcode}/`;
    case "reel":
      return `/reel/${shortcode}/`;
    case "tv":
      return `/tv/${shortcode}/`;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function parseInstagramUrl(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste an Instagram post or reel link." };
  }
  if (trimmed.length > 500) {
    return { ok: false, error: "That link is too long." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "That does not look like a valid URL." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Use an https Instagram link." };
  }

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return { ok: false, error: "Only Instagram links are supported." };
  }

  const parts = parsed.pathname.split("/").filter(Boolean).map((part) => part.toLowerCase());
  if (parts.includes("stories")) {
    return {
      ok: false,
      error: "Stories are not supported. Use a public post or reel.",
    };
  }

  const kindIndex = parts.findIndex((part) => kindFromSegment(part) !== null);
  if (kindIndex === -1 || kindIndex + 1 >= parts.length) {
    return {
      ok: false,
      error: "Use a public post, reel, or IGTV link — not a profile.",
    };
  }

  const kind = kindFromSegment(parts[kindIndex]);
  if (!kind) {
    return {
      ok: false,
      error: "Use a public post, reel, or IGTV link — not a profile.",
    };
  }

  const shortcode = parsed.pathname.split("/").filter(Boolean)[kindIndex + 1];
  if (!SHORTCODE.test(shortcode) || shortcode.length < 5 || shortcode.length > 64) {
    return { ok: false, error: "Could not read the post id from that link." };
  }

  return {
    ok: true,
    value: {
      kind,
      shortcode,
      canonical: `https://www.instagram.com${canonicalPath(kind, shortcode)}`,
    },
  };
}

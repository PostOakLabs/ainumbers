#!/usr/bin/env node
// check-served-egress.mjs — SERVED-EGRESS-CHECK-1 (2026-09-03)
//
// Verifies the bytes the edge SERVES match what the repo SOURCE declares, on
// two axes:
//
//   AXIS 1 — EDGE INJECTION. Cloudflare edge features (Web Analytics beacon,
//   Rocket Loader, Zaraz, email-decode, challenge platform …) rewrite HTML AT
//   THE EDGE, so the injected markup exists in NO repo file and every
//   source-scanning egress/CSP gate is structurally blind to it. Live finding
//   (Tim DevTools, art-129): `static.cloudflareinsights.com/beacon.min.js`
//   auto-injected into served pages, absent from source, blocked at runtime
//   only by the page CSP. This gate fetches live pages, scans the SERVED
//   bytes with the row's injector pattern set, and diffs every external
//   <script src>/<link href> against the page's repo source file.
//   Served-but-not-source external reference ⇒ RED naming the URL.
//
//   AXIS 2 — BYTE INTEGRITY (2026-09-03 amendment, ESTATE-ATTACK-SURFACE
//   PB-1/PB-2). Fetches /.well-known/deploy-checksums.txt (written at rsync
//   time by deploy-to-dreamhost.yml, one "<sha256>  <path>" line per
//   published file), deterministically samples ≥10 listed URLs, sha256s the
//   served bytes, and REDs on any mismatch — one lane then covers BOTH edge
//   injection and origin tampering.
//
// ALLOWLIST — scripts/served-egress-allowlist.json, EMPTY BY DESIGN. Every
// entry needs { "match", "scope", "reason" } with a non-empty reason; an
// entry without one is itself a RED. Legitimate Cloudflare transforms that
// alter served bytes belong there with the transform NAMED in the reason —
// and each entry is a reviewed decision, never a default.
//
// STALE-CACHE DISCIPLINE. Every fetch carries cache-bust headers
// (Cache-Control/Pragma: no-cache), and the cf-cache-status of every response
// is reported beside any finding. A finding that comes only from a HIT-class
// response (HIT/STALE/UPDATING/REVALIDATED/EXPIRED) is re-fetched once with a
// unique query string (a cache key the edge cannot have served before): if
// the fresh copy is clean, the finding is reported as a WARN naming the stale
// cache, not a RED — a pre-toggle cached copy must not false-RED alone. If
// the fresh copy still carries the finding, it is RED with both cache
// statuses quoted.
//
// SO #34c: absence is a distinct state, never a pass — a fetch that errors, a
// non-200, an unparseable manifest, or a manifest with fewer than 10 entries
// is RED, not "skipped".
//
// WHERE IT RUNS: the post-deploy smoke lane of deploy-to-dreamhost.yml (it
// needs the live site; preflight/branch runs see no deployment of themselves).
// CI_ONLY-declared in check-workflow-gate-parity.mjs for exactly that reason.
// The paired fixture proof scripts/check-served-egress.test.mjs (no network)
// is the preflight-side RED control.
//
// USAGE
//   node scripts/check-served-egress.mjs [--base https://ainumbers.co]
//        [--docs-base https://docs.ainumbers.co] [--sample N] [--seed <epoch>]
//   Env override: SITE_URL / DH_SITE_URL (same meaning as --base; CLI wins).
//   --seed switches axis-2 sampling from the DETERMINISTIC even spread to a
//   seeded random draw (LIVE-INTEGRITY-SCHEDULE-1): same seed ⇒ same sample,
//   different seeds ⇒ coverage over time. WITHOUT --seed the behavior is
//   UNCHANGED — the post-deploy leg in deploy-to-dreamhost.yml stays
//   byte-reproducible. The scheduled leg (deploy-drift-check.yml) passes
//   --sample 25 --seed $(date +%s).
// Zero-dep. Node ≥ 20 (global fetch).

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const ALLOWLIST_PATH = resolve(HERE, "served-egress-allowlist.json");

// ── the row's detection pattern set (2026 best-practices research; every
// live injector class) — keep VERBATIM, it is the row's specification ──────
export const INJECTOR_PATTERN_SRC =
  "cloudflareinsights|beacon\\.min\\.js|/cdn-cgi/rum|rocket-loader|cfasync|email-decode|__cf_email__|/cdn-cgi/zaraz|challenge-platform|/cdn-cgi/scripts/";
export const INJECTOR_RE = new RegExp(INJECTOR_PATTERN_SRC, "gi");

// cf-cache-status values that mean "these bytes may be a stale edge copy".
const HIT_CLASS = new Set(["HIT", "STALE", "UPDATING", "REVALIDATED", "EXPIRED"]);

export const ALLOWLIST_SCOPES = ["injector", "external-ref", "checksum"];

// The fixed live sample (row-specified): index, one tool, one chaingraph
// node, mcp.html, PLUS one docs.ainumbers.co page — Cloudflare Pages has its
// own injection toggle with known persistence reports.
export const FIXED_PAGES = [
  { path: "/", source: "index.html" },
  { path: "/tools/01-a2a-fee-route-optimizer.html", source: "tools/01-a2a-fee-route-optimizer.html" },
  { path: "/chaingraph/art-01-ap2-mandate-chain-validator.html", source: "chaingraph/art-01-ap2-mandate-chain-validator.html" },
  { path: "/mcp.html", source: "mcp.html" },
  { path: "/", source: "docs/index.html", docs: true },
];

export const DEFAULT_SAMPLE = 12; // ≥10 per the amendment; 12 keeps it above the floor

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// ── allowlist ────────────────────────────────────────────────────────────────

/**
 * Parse + validate the allowlist. Returns { entries, notes }.
 * Missing file ⇒ empty allowlist (fail-CLOSED: nothing is exempted, and the
 * empty file is the goal state). Unparseable JSON or an entry lacking a
 * non-empty `match`/`scope`/`reason` ⇒ throws: a corrupted allowlist must be
 * a RED, never a silent "empty" that would mask intent (SO #34c).
 */
export function loadAllowlist(text) {
  if (text == null || text.trim() === "") return { entries: [] };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`served-egress-allowlist.json is not valid JSON: ${e.message}`);
  }
  if (!Array.isArray(parsed)) throw new Error("served-egress-allowlist.json must be a JSON array");
  const entries = [];
  for (const e of parsed) {
    if (!e || typeof e !== "object") throw new Error("allowlist entry must be an object");
    for (const k of ["match", "scope", "reason"]) {
      if (typeof e[k] !== "string" || e[k].trim() === "") {
        throw new Error(`allowlist entry missing non-empty "${k}" — every entry needs a reason: ${JSON.stringify(e)}`);
      }
    }
    if (!ALLOWLIST_SCOPES.includes(e.scope)) {
      throw new Error(`allowlist entry scope "${e.scope}" not in ${JSON.stringify(ALLOWLIST_SCOPES)}`);
    }
    entries.push({ match: e.match, scope: e.scope, reason: e.reason });
  }
  return { entries };
}

/** First allowlist entry (with scope) whose `match` is a substring of `value`. */
export function allowlistHit(entries, scope, value) {
  for (const e of entries) if (e.scope === scope && value.includes(e.match)) return e;
  return null;
}

// ── axis 1: injection detection (pure functions; fixture-proved by the .test) ─

/** Every injector-pattern match in served text, as [{pattern, index}]. */
export function detectInjectorPatterns(text) {
  const out = [];
  INJECTOR_RE.lastIndex = 0;
  let m;
  while ((m = INJECTOR_RE.exec(text))) out.push({ pattern: m[0], index: m.index });
  return out;
}

/** External (absolute http(s)) script srcs + link hrefs of an HTML document. */
export function extractExternalRefs(html) {
  const out = new Set();
  for (const m of html.matchAll(/<script\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) out.add(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)) out.add(m[1]);
  return [...out].filter((u) => /^https?:\/\//i.test(u));
}

/**
 * Diff one page's served bytes against its repo source.
 * Returns { reds: [{kind, detail, cacheStatus, refetchCacheStatus?}], warns, notes }.
 * `refetchBody`/`refetchCacheStatus` (optional) is the unique-query-string
 * re-fetch the caller made when the primary response was HIT-class.
 */
export function analyzePage({ url, servedBody, sourceBody, cacheStatus, refetchBody, refetchCacheStatus, allowlist }) {
  const reds = [];
  const warns = [];
  const notes = [];

  // (a) injector pattern set over SERVED bytes
  const hits = detectInjectorPatterns(servedBody);
  for (const h of hits) {
    const ctx = servedBody.slice(Math.max(0, h.index - 60), h.index + 80).replace(/\s+/g, " ");
    const al = allowlistHit(allowlist, "injector", ctx);
    if (al) {
      notes.push(`${url}: injector pattern "${h.pattern}" ALLOWLISTED (${al.reason}) [cf-cache-status=${cacheStatus}]`);
      continue;
    }
    const refetched = refetchBody != null;
    // does the unique-key refetch still carry this literal pattern anywhere?
    const stillThere = refetched && refetchBody.toLowerCase().includes(h.pattern.toLowerCase());
    if (refetched && !stillThere) {
      warns.push(`${url}: injector pattern "${h.pattern}" seen only on a cf-cache-status=${cacheStatus} copy; unique-key refetch (cf-cache-status=${refetchCacheStatus}) is CLEAN — stale edge cache, not active injection. Purge the zone cache; not a RED. Context: …${ctx}…`);
    } else {
      reds.push({
        kind: "INJECTOR",
        detail: `${url}: SERVED bytes contain injector-class pattern "${h.pattern}" absent from repo source [cf-cache-status=${cacheStatus}${refetched ? `; refetch cf-cache-status=${refetchCacheStatus} still carries it` : ""}]. Context: …${ctx}…`,
        cacheStatus,
      });
    }
  }

  // (b) external script/link refs present in served but not in source.
  // Same stale-cache rule as (a): a rogue ref seen only on a HIT-class copy,
  // clean on the unique-key refetch, is a stale-copy WARN, not a red. An
  // allowlist entry matched by the ref URL counts under EITHER scope — one
  // reviewed decision about an injected beacon URL should not need two rows.
  const servedRefs = extractExternalRefs(servedBody);
  const sourceRefs = new Set(extractExternalRefs(sourceBody));
  const refetchRefs = refetchBody != null ? new Set(extractExternalRefs(refetchBody)) : null;
  for (const ref of servedRefs) {
    if (sourceRefs.has(ref)) continue;
    const al = allowlistHit(allowlist, "external-ref", ref) || allowlistHit(allowlist, "injector", ref);
    if (al) {
      notes.push(`${url}: external ref ${ref} ALLOWLISTED (${al.reason}) [cf-cache-status=${cacheStatus}]`);
      continue;
    }
    if (refetchRefs != null && !refetchRefs.has(ref)) {
      warns.push(`${url}: external ref ${ref} seen only on a cf-cache-status=${cacheStatus} copy; unique-key refetch (cf-cache-status=${refetchCacheStatus}) is CLEAN — stale edge cache, not active injection. Purge the zone cache; not a RED.`);
      continue;
    }
    reds.push({
      kind: "EXTERNAL-REF",
      detail: `${url}: served-but-not-source external reference ${ref} [cf-cache-status=${cacheStatus}${refetchRefs != null ? `; refetch cf-cache-status=${refetchCacheStatus} still carries it` : ""}]`,
      cacheStatus,
    });
  }
  return { reds, warns, notes };
}

// ── axis 2: byte integrity (pure functions) ──────────────────────────────────

/** Parse "<sha256>  <path>" lines (sha256sum format, two-space separator). */
export function parseChecksumManifest(text) {
  const out = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const i = line.indexOf("  ");
    if (i !== 64) throw new Error(`manifest line is not sha256sum format (expected 64-hex + two spaces): ${line.slice(0, 80)}`);
    const sha = line.slice(0, 64);
    if (!/^[0-9a-f]{64}$/.test(sha)) throw new Error(`manifest sha256 is not 64 lowercase hex: ${line.slice(0, 80)}`);
    out.push({ sha256: sha, path: line.slice(i + 2) });
  }
  return out;
}

/** Deterministic even spread over the sorted manifest — same input, same
 *  sample, endpoints included (index k of n maps to round(k*(N-1)/(n-1))). */
export function selectSample(entries, count) {
  if (entries.length === 0) return [];
  const n = Math.min(count, entries.length);
  const out = [];
  const seen = new Set();
  if (n === 1) return [entries[0]];
  for (let k = 0; k < n; k++) {
    const idx = Math.round((k * (entries.length - 1)) / (n - 1));
    const e = entries[idx];
    if (!seen.has(e.path)) { seen.add(e.path); out.push(e); }
  }
  // degenerate rounding collisions (tiny lists): sequential fill to n
  for (const e of entries) {
    if (out.length >= n) break;
    if (!seen.has(e.path)) { seen.add(e.path); out.push(e); }
  }
  return out;
}

// ── seeded sampling (LIVE-INTEGRITY-SCHEDULE-1, 2026-09-03) ───────────────────

// mulberry32 — tiny deterministic PRNG: same seed, same sequence, no deps.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded random sample of `count` distinct entries: full Fisher–Yates shuffle
 * of a COPY under mulberry32(seed), take the first n. Same (entries, seed) ⇒
 * same sample; varying seeds ⇒ the scheduled leg covers different files over
 * time, which the fixed even spread cannot. Deterministic per invocation.
 */
export function selectSampleSeeded(entries, count, seed) {
  if (entries.length === 0) return [];
  const n = Math.min(count, entries.length);
  const rnd = mulberry32(seed);
  const arr = entries.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

/**
 * One sampled file: sha256 the served bytes, compare to the manifest value.
 * `refetched`/`refetchCacheStatus` follow the same HIT-class rule as pages.
 */
export function checkChecksumEntry({ entry, servedBytes, cacheStatus, refetchedBytes, refetchCacheStatus, allowlist }) {
  const served = sha256(servedBytes);
  if (served === entry.sha256) return { ok: true, cacheStatus };
  const al = allowlistHit(allowlist, "checksum", entry.path);
  if (al) {
    return { ok: true, allowlisted: true, reason: al.reason, cacheStatus };
  }
  if (refetchedBytes != null && sha256(refetchedBytes) === entry.sha256) {
    return { ok: true, staleCache: true, cacheStatus, refetchCacheStatus };
  }
  return {
    ok: false,
    cacheStatus,
    refetchCacheStatus,
    detail:
      `${entry.path}: sha256 MISMATCH — manifest ${entry.sha256}, served ${served}` +
      ` [cf-cache-status=${cacheStatus}${refetchedBytes != null ? `; refetch cf-cache-status=${refetchCacheStatus}` : ""}]`,
  };
}

// ── live fetch helpers ───────────────────────────────────────────────────────

const UA = "ainumbers-served-egress-check/1.0 (+SERVED-EGRESS-CHECK-1 post-deploy smoke)";

async function fetchLive(url, { bustQuery = false } = {}) {
  const target = bustQuery
    ? url + (url.includes("?") ? "&" : "?") + "_egresscb=" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)
    : url;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        // Cache-bust headers on EVERY fetch (the row's requirement) — the
        // edge may still answer from cache (measured: it does), which is why
        // cf-cache-status is read and the unique-query refetch exists.
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "User-Agent": UA,
      },
    });
    const body = Buffer.from(await res.arrayBuffer());
    return { ok: res.ok, status: res.status, body, cacheStatus: res.headers.get("cf-cache-status") || "(none)" };
  } finally {
    clearTimeout(timer);
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

function fail(lines) {
  console.error("⛔ SERVED-EGRESS-CHECK-1: RED — served bytes do not match source:");
  for (const l of lines) console.error("  - " + l);
  console.error("Fix: an injector-class finding means an edge feature (Web Analytics, Rocket Loader, Zaraz, …) is rewriting served HTML — turn it off in the Cloudflare dashboard (a Tim-side duty), or, if it is a REVIEWED legitimate transform, add a reasoned entry to scripts/served-egress-allowlist.json naming the transform. A checksum mismatch means the served bytes differ from the deployed manifest — investigate origin tampering or a half-finished deploy before anything else.");
  process.exit(1);
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i !== -1 && i + 1 < argv.length ? argv[i + 1] : null;
  };
  const base = (arg("--base") || env.SITE_URL || env.DH_SITE_URL || "https://ainumbers.co").replace(/\/+$/, "");
  const docsBase = (arg("--docs-base") || "https://docs.ainumbers.co").replace(/\/+$/, "");
  const sampleCount = Math.max(10, parseInt(arg("--sample") || String(DEFAULT_SAMPLE), 10) || DEFAULT_SAMPLE);
  // --seed (optional): seeded random draw instead of the deterministic even
  // spread. Absent ⇒ DEFAULT BEHAVIOR UNCHANGED (post-deploy leg reproducibility).
  const seedArg = arg("--seed");
  let seedNum = null;
  if (seedArg != null) {
    seedNum = Number(seedArg);
    if (!Number.isInteger(seedNum)) {
      return fail([`--seed must be an integer (epoch seconds); got "${seedArg}"`]);
    }
  }

  let allowlist;
  let allowlistNotes = [];
  try {
    let alText = null;
    try {
      alText = readFileSync(ALLOWLIST_PATH, "utf8");
    } catch {
      // missing file == empty allowlist (the goal state); say so, don't hide it
      allowlistNotes.push(`allowlist file ${ALLOWLIST_PATH} not present — treated as EMPTY (the goal state; nothing is exempted)`);
    }
    const loaded = loadAllowlist(alText);
    allowlist = loaded.entries;
  } catch (e) {
    return fail([`allowlist invalid: ${e.message}`]);
  }

  const reds = [];
  const warns = [];
  const notes = [...allowlistNotes];

  // ── axis 1: fixed live sample ────────────────────────────────────────────
  for (const page of FIXED_PAGES) {
    const origin = page.docs ? docsBase : base;
    const url = origin + page.path;
    let sourceBody;
    try {
      sourceBody = readFileSync(resolve(ROOT, page.source), "utf8");
    } catch (e) {
      reds.push(`${url}: repo source ${page.source} unreadable: ${e.message}`);
      continue;
    }
    let res;
    try {
      res = await fetchLive(url);
    } catch (e) {
      reds.push(`${url}: fetch failed (${e.name}: ${e.message}) — a page the gate cannot read is a RED, not a skip (SO #34c)`);
      continue;
    }
    if (!res.ok) {
      reds.push(`${url}: HTTP ${res.status} (cf-cache-status=${res.cacheStatus})`);
      continue;
    }
    let servedBody = res.body.toString("utf8");
    let refetchBody = null;
    let refetchCacheStatus = null;
    // If the served copy came from the edge cache, re-fetch once under a
    // cache key the edge cannot have served before — the finding must reflect
    // CURRENT edge behaviour, not a stale pre-toggle copy.
    if (HIT_CLASS.has(String(res.cacheStatus).toUpperCase())) {
      try {
        const r2 = await fetchLive(url, { bustQuery: true });
        if (r2.ok) { refetchBody = r2.body.toString("utf8"); refetchCacheStatus = r2.cacheStatus; }
      } catch { /* refetch failure leaves the primary evidence standing */ }
    }
    const verdict = analyzePage({ url, servedBody, sourceBody, cacheStatus: res.cacheStatus, refetchBody, refetchCacheStatus, allowlist });
    reds.push(...verdict.reds.map((r) => r.detail));
    warns.push(...verdict.warns);
    notes.push(...verdict.notes);
    if (verdict.reds.length === 0) {
      console.log(`✓ ${url} — clean vs ${page.source} [cf-cache-status=${res.cacheStatus}${refetchCacheStatus ? `; unique-key refetch ${refetchCacheStatus}` : ""}]`);
    }
  }

  // ── axis 2: byte integrity over the deployed manifest ────────────────────
  const manifestUrl = base + "/.well-known/deploy-checksums.txt";
  let manifestRes;
  try {
    manifestRes = await fetchLive(manifestUrl);
  } catch (e) {
    reds.push(`${manifestUrl}: fetch failed (${e.name}: ${e.message}) — no manifest means byte integrity is UNVERIFIED, not passed (SO #34c)`);
  }
  if (manifestRes) {
    if (!manifestRes.ok) {
      reds.push(`${manifestUrl}: HTTP ${manifestRes.status} (cf-cache-status=${manifestRes.cacheStatus})`);
    } else {
      let entries;
      try {
        entries = parseChecksumManifest(manifestRes.body.toString("utf8"));
      } catch (e) {
        reds.push(`${manifestUrl}: ${e.message}`);
      }
      if (entries) {
        if (entries.length < 10) {
          reds.push(`${manifestUrl}: only ${entries.length} entries listed (<10) — the byte-integrity sample cannot be drawn; not a pass (SO #34c)`);
        } else {
          const sample = seedNum != null
            ? selectSampleSeeded(entries, sampleCount, seedNum)
            : selectSample(entries, sampleCount);
          let matches = 0;
          for (const entry of sample) {
            const url = base + "/" + entry.path;
            let res;
            try {
              res = await fetchLive(url);
            } catch (e) {
              reds.push(`${url}: fetch failed (${e.name}: ${e.message}) — sampled file unreadable is a RED, not a skip (SO #34c)`);
              continue;
            }
            if (!res.ok) {
              reds.push(`${url}: HTTP ${res.status} (cf-cache-status=${res.cacheStatus}) — listed in deploy-checksums.txt but not served`);
              continue;
            }
            let refetchedBytes = null;
            let refetchCacheStatus = null;
            const served = checkChecksumEntry({ entry, servedBytes: res.body, cacheStatus: res.cacheStatus, allowlist });
            if (!served.ok && HIT_CLASS.has(String(res.cacheStatus).toUpperCase())) {
              try {
                const r2 = await fetchLive(url, { bustQuery: true });
                if (r2.ok) { refetchedBytes = r2.body; refetchCacheStatus = r2.cacheStatus; }
              } catch { /* primary evidence stands */ }
            }
            const verdict = checkChecksumEntry({ entry, servedBytes: res.body, cacheStatus: res.cacheStatus, refetchedBytes, refetchCacheStatus, allowlist });
            if (verdict.ok) {
              matches++;
              if (verdict.staleCache) {
                warns.push(`${entry.path}: manifest match only after unique-key refetch (cf-cache-status=${verdict.cacheStatus} → ${verdict.refetchCacheStatus}) — stale edge copy served first`);
              } else if (verdict.allowlisted) {
                notes.push(`${entry.path}: checksum mismatch ALLOWLISTED (${verdict.reason}) [cf-cache-status=${verdict.cacheStatus}]`);
              }
            } else {
              reds.push(verdict.detail);
            }
          }
          console.log(`✓ byte integrity: ${matches}/${sample.length} sampled deploy-checksums.txt URLs match sha256 (manifest lists ${entries.length} files)`);
        }
      }
    }
  }

  for (const w of warns) console.log("⚠ " + w);
  for (const n of notes) console.log("ℹ " + n);

  if (reds.length > 0) return fail(reds);
  console.log(`✅ served-egress check GREEN — ${FIXED_PAGES.length} fixed sample pages carry no injector-class markup and no served-but-not-source external refs; ≥${sampleCount}-URL byte sample matches the deployed manifest${seedNum != null ? ` (seeded draw, seed ${seedNum})` : ""}; allowlist holds ${allowlist.length} entries (0 is the goal).`);
}

// direct execution (not imported by the selftest)
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => fail([`unexpected error: ${e && e.stack ? e.stack : e}`]));
}

#!/usr/bin/env node
// check-served-egress.test.mjs — paired RED/GREEN fixture proof for
// check-served-egress.mjs (SERVED-EGRESS-CHECK-1, SO #34c / SO #40b via
// GATE-SELFTEST-META-1). NO LIVE DEPENDENCY: every control runs the REAL
// exported detectors against synthetic bodies, so the detector is proven able
// to fire without touching the network — the live lane is the deploy
// workflow's post-deploy smoke step, which this file deliberately is not.
//
// CONTROLS
//   RED 1 — the exact live incident shape (Tim DevTools, art-129): a served
//           body carrying the Cloudflare Web Analytics beacon must be flagged
//           INJECTOR RED naming the URL and the pattern.
//   RED 2 — a served-but-not-source EXTERNAL reference must be RED naming the
//           URL (the class every source-scanning gate is blind to).
//   RED 3 — a sha256 MISMATCH against deploy-checksums.txt must be RED.
//   RED 4 — every one of the row's 10 injector patterns fires on its exemplar.
//   RED 5 — an allowlist entry with no reason is itself a failure (every
//           future entry needs a reason — that is the design).
//   GREEN 1 — a clean served body (source externals only) is not flagged.
//   GREEN 2 — matching checksum passes.
//   STALE  — beacon on a HIT-class copy only, clean unique-key refetch ⇒ WARN
//           naming the cache, NOT a red (a pre-toggle cached copy must not
//           false-RED alone); same beacon on the refetch ⇒ RED.
import {
  INJECTOR_PATTERN_SRC, detectInjectorPatterns, extractExternalRefs,
  analyzePage, parseChecksumManifest, selectSample, checkChecksumEntry,
  loadAllowlist,
} from "./check-served-egress.mjs";
import { createHash } from "node:crypto";

const failures = [];
const check = (name, ok, detail) => {
  console.log((ok ? "  ok " : "  RED ") + name + (detail ? "  -- " + detail : ""));
  if (!ok) failures.push(name);
};
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

// The clean synthetic page pair every GREEN/stale control starts from: the
// served and source bodies agree on their (legitimate) external refs.
const CLEAN_SOURCE = `<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="canonical" href="https://ainumbers.co/">
<script src="js/app.js"></script></head><body><p>tool page</p></body></html>`;
const CLEAN_SERVED = CLEAN_SOURCE;

console.log("CONTROL RED 1 -- the live incident shape (beacon injected at the edge):");
const beaconTag = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "redacted"}'></script>`;
const injected = CLEAN_SERVED.replace("</body>", beaconTag + "</body>");
const v1 = analyzePage({ url: "https://ainumbers.co/", servedBody: injected, sourceBody: CLEAN_SOURCE, cacheStatus: "MISS", allowlist: [] });
// Both detectors are EXPECTED to fire on one injected beacon — over-determined
// by design: pattern set (content) AND external-ref diff (structure).
check("INJECTOR RED fires naming the URL and beacon.min.js",
  v1.reds.some((r) => r.kind === "INJECTOR" && r.detail.includes("https://ainumbers.co/") && r.detail.includes("beacon.min.js")),
  JSON.stringify(v1.reds));
check("EXTERNAL-REF RED also names the beacon URL (structural diff, same defect)",
  v1.reds.some((r) => r.kind === "EXTERNAL-REF" && r.detail.includes("https://static.cloudflareinsights.com/beacon.min.js")),
  JSON.stringify(v1.reds));
check("every red quotes cf-cache-status beside the hit (MISS here)",
  v1.reds.length > 0 && v1.reds.every((r) => r.detail.includes("cf-cache-status=MISS")), JSON.stringify(v1.reds));

console.log("CONTROL RED 2 -- served-but-not-source EXTERNAL reference:");
const rogueRef = CLEAN_SERVED.replace("<p>tool page</p>", `<p>tool page</p><script src="https://evil.example.net/collect.js"></script>`);
const v2 = analyzePage({ url: "https://ainumbers.co/mcp.html", servedBody: rogueRef, sourceBody: CLEAN_SOURCE, cacheStatus: "DYNAMIC", allowlist: [] });
check("external ref present in served, absent from source ⇒ RED naming the URL",
  v2.reds.length === 1 && v2.reds[0].kind === "EXTERNAL-REF" && v2.reds[0].detail.includes("https://evil.example.net/collect.js"),
  JSON.stringify(v2.reds));

console.log("CONTROL RED 3 -- sha256 mismatch vs deploy-checksums.txt:");
const truth = Buffer.from("file-bytes-v1");
const v3 = checkChecksumEntry({ entry: { path: "index.html", sha256: sha256(Buffer.from("different-bytes")) }, servedBytes: truth, cacheStatus: "MISS", allowlist: [] });
check("mismatched bytes ⇒ not ok, naming path + both hashes + cache status",
  !v3.ok && v3.detail.includes("index.html") && v3.detail.includes(sha256(Buffer.from("different-bytes"))) && v3.detail.includes(sha256(truth)) && v3.detail.includes("cf-cache-status=MISS"),
  JSON.stringify(v3));

console.log("CONTROL RED 4 -- the row's FULL injector pattern set (every live injector class):");
const exemplars = [
  ["cloudflareinsights", `<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>`],
  ["beacon.min.js", `<script src="/cdn-cgi/other/beacon.min.js"></script>`],
  ["/cdn-cgi/rum", `<script src="/cdn-cgi/rum.js"></script>`],
  ["rocket-loader", `<script type="rocket-loader">`],
  ["cfasync", `<script data-cfasync="false" src="x.js"></script>`],
  ["email-decode", `<script src="/cdn-cgi/l/email-decode.min.js"></script>`],
  ["__cf_email__", `<a href="/cdn-cgi/l/email-protection#abc" data-cfemail="x">[email&#160;protected]</a><script>__cf_email__</script>`],
  ["/cdn-cgi/zaraz", `<script src="/cdn-cgi/zaraz/b.js"></script>`],
  ["challenge-platform", `<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>`],
  ["/cdn-cgi/scripts/", `<script src="/cdn-cgi/scripts/5c8dd728/cloudflare-static/email-decode.min.js"></script>`],
];
for (const [needle, body] of exemplars) {
  const hits = detectInjectorPatterns(body);
  check(`pattern "${needle}" fires on its exemplar`,
    hits.some((h) => h.pattern.toLowerCase() === needle.toLowerCase()),
    JSON.stringify(hits.map((h) => h.pattern)));
}
check("pattern source is the row's verbatim set (10 alternatives)",
  INJECTOR_PATTERN_SRC === "cloudflareinsights|beacon\\.min\\.js|/cdn-cgi/rum|rocket-loader|cfasync|email-decode|__cf_email__|/cdn-cgi/zaraz|challenge-platform|/cdn-cgi/scripts/",
  INJECTOR_PATTERN_SRC);

console.log("CONTROL RED 5 -- an allowlist entry without a reason is itself rejected:");
let threw = null;
try { loadAllowlist(JSON.stringify([{ match: "beacon.min.js", scope: "injector" }])); } catch (e) { threw = e; }
check("entry missing `reason` throws", threw && /reason/.test(threw.message), threw && threw.message);
threw = null;
try { loadAllowlist("{not json"); } catch (e) { threw = e; }
check("corrupt allowlist JSON throws (never a silent empty)", threw && /not valid JSON/.test(threw.message), threw && threw.message);
check("missing/empty allowlist text loads as EMPTY (the goal state)", loadAllowlist("").entries.length === 0 && loadAllowlist(null).entries.length === 0);

console.log("CONTROL GREEN 1 -- clean served body vs source:");
const g1 = analyzePage({ url: "https://ainumbers.co/", servedBody: CLEAN_SERVED, sourceBody: CLEAN_SOURCE, cacheStatus: "HIT", allowlist: [] });
check("no injector hits, external refs all in source ⇒ zero reds",
  g1.reds.length === 0 && detectInjectorPatterns(CLEAN_SERVED).length === 0, JSON.stringify(g1));
check("extractExternalRefs keeps absolute http(s) refs and drops relative ones",
  JSON.stringify(extractExternalRefs(CLEAN_SOURCE)) === JSON.stringify(["https://fonts.googleapis.com", "https://ainumbers.co/"]),
  JSON.stringify(extractExternalRefs(CLEAN_SOURCE)));

console.log("CONTROL GREEN 2 -- matching checksum passes:");
const g2 = checkChecksumEntry({ entry: { path: "mcp.html", sha256: sha256(truth) }, servedBytes: truth, cacheStatus: "HIT", allowlist: [] });
check("identical bytes ⇒ ok", g2.ok && !g2.allowlisted && !g2.staleCache, JSON.stringify(g2));
const g2b = checkChecksumEntry({ entry: { path: "mcp.html", sha256: sha256(truth) }, servedBytes: Buffer.from("stale-edge-copy"), cacheStatus: "HIT", refetchedBytes: truth, refetchCacheStatus: "MISS", allowlist: [] });
check("mismatch on HIT copy but clean unique-key refetch ⇒ ok with staleCache named",
  g2b.ok && g2b.staleCache, JSON.stringify(g2b));

console.log("CONTROL STALE-CACHE -- a pre-toggle cached copy must not false-RED alone:");
const s1 = analyzePage({ url: "https://ainumbers.co/", servedBody: injected, sourceBody: CLEAN_SOURCE, cacheStatus: "HIT", refetchBody: CLEAN_SERVED, refetchCacheStatus: "MISS", allowlist: [] });
check("beacon on HIT copy + clean refetch ⇒ zero reds, WARNs naming the stale cache",
  s1.reds.length === 0 && s1.warns.length >= 1 && s1.warns.every((w) => w.includes("cf-cache-status=HIT") && /stale edge cache/.test(w)) && s1.warns.some((w) => w.includes("beacon.min.js")) && s1.warns.some((w) => w.includes("static.cloudflareinsights.com")),
  JSON.stringify({ reds: s1.reds, warns: s1.warns }));
const s2 = analyzePage({ url: "https://ainumbers.co/", servedBody: injected, sourceBody: CLEAN_SOURCE, cacheStatus: "HIT", refetchBody: injected, refetchCacheStatus: "MISS", allowlist: [] });
check("beacon on HIT copy AND still on the refetch ⇒ REDs with both cache statuses quoted",
  s2.reds.length >= 1 && s2.reds.some((r) => r.kind === "INJECTOR" && r.detail.includes("cf-cache-status=HIT") && r.detail.includes("refetch cf-cache-status=MISS still carries it")) && s2.reds.some((r) => r.kind === "EXTERNAL-REF" && r.detail.includes("refetch cf-cache-status=MISS still carries it")),
  JSON.stringify(s2.reds));

console.log("CONTROL ALLOWLIST -- a REVIEWED entry suppresses RED to a note, never silently:");
const al = loadAllowlist(JSON.stringify([{ match: "static.cloudflareinsights.com/beacon.min.js", scope: "injector", reason: "named transform: Web Analytics re-enabled by Tim 20XX-XX-XX, ticket #N" }])).entries;
const a1 = analyzePage({ url: "https://ainumbers.co/", servedBody: injected, sourceBody: CLEAN_SOURCE, cacheStatus: "MISS", allowlist: al });
check("allowlisted beacon ⇒ 0 reds, every suppression a note quoting the reason",
  a1.reds.length === 0 && a1.notes.length >= 2 && a1.notes.every((n) => n.includes("Web Analytics") && n.includes("ALLOWLISTED")),
  JSON.stringify({ reds: a1.reds, notes: a1.notes }));

console.log("CONTROL MANIFEST -- sha256sum-format parsing + deterministic ≥10 sample:");
const mtext = Array.from({ length: 23 }, (_, i) => `${sha256(String(i))}  page-${String(i).padStart(2, "0")}.html`).join("\n") + "\n";
const parsed = parseChecksumManifest(mtext);
check("23 lines parse to 23 entries with path+sha split at the two-space separator",
  parsed.length === 23 && parsed[0].path === "page-00.html" && parsed[0].sha256 === sha256(String(0)), JSON.stringify(parsed[0]));
const sA = selectSample(parsed, 12), sB = selectSample(parsed, 12);
check("sample is deterministic (same input ⇒ same sample) and spans the list head-to-tail",
  JSON.stringify(sA) === JSON.stringify(sB) && sA.length === 12 && sA[0].path === "page-00.html" && sA.some((e) => e.path === "page-22.html") && new Set(sA.map((e) => e.path)).size === 12,
  JSON.stringify(sA.map((e) => e.path)));
let mthrew = null;
try { parseChecksumManifest("not-a-manifest-line\n"); } catch (e) { mthrew = e; }
check("a malformed manifest line is rejected, not skipped", mthrew && /sha256sum format/.test(mthrew.message), mthrew && mthrew.message);

if (failures.length > 0) {
  console.error(`⛔ ${failures.length} control(s) failed — the detector is NOT proven:`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`✅ all controls green — served-egress detector proven RED-capable (fixture-only, no live dependency)`);

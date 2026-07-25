#!/usr/bin/env node
// check-helm-version-drift.mjs — HELM-RELEASE-DRIFT-GATES-1 gate 1.
//
// WHY: helm.html's download links hand-name a release tag (v0.1.0, v0.2.0, ...).
// The real release is cut in a SEPARATE repo (PostOakLabs/ainumbers-helm), so
// nothing in the site repo's own build asserted those links still match the
// actual latest release once #44-style version-bump PRs merge there.
//
// DESIGN: the site repo is zero-dep and its pre-push gate must work OFFLINE —
// no `gh`/network call in the hot path. `helm/version.json` is already the
// committed, pinned source of truth for "what Helm release is current": the
// helm repo's own release.yml (`publish-version-feed` job) pushes it to this
// repo's main on every GA tag, with the real version/timestamp/release URL.
// So this gate reconciles helm.html's hand-authored version strings against
// that pinned file — no GitHub API call needed, and the CROSS-repo half of
// the reconciliation (tag -> version.json) is already enforced by the helm
// repo's own release pipeline, not re-derived here.
//
// SCOPE: only version strings inside `ainumbers-helm/releases/(download|tag)/`
// URLs are asserted — NOT every version-shaped string in helm.html (the page
// also uses illustrative example strings, e.g. a kernel version in an SVG
// diagram, that have nothing to do with the Helm release).
//
// HELM-CALVER-1 (2026-07-25): the helm repo dropped the "v" tag prefix for
// CalVer releases (YYYY.M.D) going forward. `v0.1.0` (the last semver
// release) stays tagged and linked as-is, so this gate accepts an optional
// "v" — it must not assume every release link is prefixed.
//
// Usage:
//   node scripts/check-helm-version-drift.mjs             strict: exit 1 on any mismatch
//   node scripts/check-helm-version-drift.mjs --summary    counts only, exit 0

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const VERSION_JSON_PATH = resolve(REPO, 'helm', 'version.json');
const HELM_HTML_PATH = resolve(REPO, 'helm.html');

const RELEASE_URL_RE = /ainumbers-helm\/releases\/(?:download|tag)\/v?(\d+\.\d+\.\d+)/g;

// Pure function of file contents (as strings) so it's independently testable
// without touching the filesystem — see check-helm-version-drift.test.mjs.
export function evaluate({ versionJsonText, helmHtmlText }) {
  let versionJson;
  try {
    versionJson = JSON.parse(versionJsonText);
  } catch (e) {
    return { ok: false, reason: `helm/version.json is not valid JSON: ${e.message}` };
  }
  const expected = versionJson.latest_version;
  if (typeof expected !== 'string' || !/^\d+\.\d+\.\d+$/.test(expected)) {
    return { ok: false, reason: `helm/version.json.latest_version is missing or not a plain "X.Y.Z" string (got ${JSON.stringify(expected)})` };
  }

  const found = new Set();
  let occurrences = 0;
  let m;
  RELEASE_URL_RE.lastIndex = 0;
  while ((m = RELEASE_URL_RE.exec(helmHtmlText))) { found.add(m[1]); occurrences++; }

  if (occurrences === 0) {
    return { ok: false, reason: 'helm.html has no ainumbers-helm release download/tag links to check (page structure changed — update this gate\'s scope)' };
  }

  const drifted = [...found].filter((v) => v !== expected);
  if (drifted.length) {
    return {
      ok: false,
      reason: `helm/version.json says the current release is ${expected}, but helm.html links point at ${drifted.join(', ')}. ` +
        `Update helm.html's release links to ${expected} (or, if version.json itself is wrong, fix that at the source — the helm repo's release job).`,
    };
  }

  return { ok: true, version: expected, linkCount: occurrences };
}

function main() {
  const SUMMARY = process.argv.includes('--summary');
  const versionJsonText = readFileSync(VERSION_JSON_PATH, 'utf8');
  const helmHtmlText = readFileSync(HELM_HTML_PATH, 'utf8');
  const result = evaluate({ versionJsonText, helmHtmlText });

  if (SUMMARY) {
    console.log(result.ok
      ? `helm version-drift: ${result.version} consistent across ${result.linkCount} link(s).`
      : `helm version-drift: FAIL — ${result.reason}`);
    process.exit(0);
  }

  if (!result.ok) {
    console.error(`✗ helm version-drift gate FAILED — ${result.reason}`);
    process.exit(1);
  }
  console.log(`✓ helm version-drift gate clean — ${result.version} consistent across ${result.linkCount} link(s) in helm.html and helm/version.json.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

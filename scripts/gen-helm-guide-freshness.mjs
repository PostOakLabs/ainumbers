#!/usr/bin/env node
// gen-helm-guide-freshness.mjs — HELM-RELEASE-DRIFT-GATES-1 gate 2.
//
// WHY (Tim, 2026-07-24): "need a gate to add more to the guide on helm.html
// anytime there is a real update so users can see a new animation (in
// addition to the changelog)." A changelog entry costs nothing to write and
// is easy to satisfy without changing anything a user actually sees — this
// gate asserts the WALKTHROUGH content itself (the numbered "Scene N"
// sections s1..s6 — the animated pipeline/replay/etc. narrative) moved
// on a real release, not just the version string next to it.
//
// DESIGN: helm/guide-freshness.json is a committed snapshot of
// {synced_version, guide_hash} — the release version and a hash of the
// walkthrough markup as of the last time someone confirmed the guide was
// current for that release. helm/version.json (gate 1's SSOT, pushed by the
// helm repo's release job) names the actual latest release. Whenever those
// two versions disagree, this gate demands ONE of:
//   (a) the walkthrough markup hash changed since the snapshot (proof a
//       human actually added/edited something visible), or
//   (b) the new version is explicitly listed in guide-freshness.json's
//       `acknowledged_no_change` array — a documented, greppable escape for
//       a release with genuinely nothing user-visible to show (never a
//       forced fake animation).
// A changelog-only release satisfies neither (a) nor (b) by construction,
// because the changelog lives outside the s1..s6 scope this gate hashes.
//
// Usage:
//   node scripts/gen-helm-guide-freshness.mjs             sync: write the snapshot if in-scope conditions are met
//   node scripts/gen-helm-guide-freshness.mjs --check      verify only, exit 2 if a sync is owed and cannot be justified
//                                                            (a FINDING, not a crash — see exit-code note below)
//
// EXIT CODES for --check, deliberately distinct so a caller (the scheduled
// report-only workflow) can tell "the guide is stale" from "this script is
// broken" without parsing stderr text:
//   0 = clean, nothing owed
//   2 = a sync is owed and unjustified — the FINDING this gate exists to
//       raise. Not a crash; the script ran correctly and reported a fact.
//   1 = an uncaught error (missing helm.html, malformed JSON, a scene id no
//       longer present, etc.) — the checker itself is broken.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const VERSION_JSON_PATH = resolve(REPO, 'helm', 'version.json');
const STATE_PATH = resolve(REPO, 'helm', 'guide-freshness.json');
const HELM_HTML_PATH = resolve(REPO, 'helm.html');

const SCENE_IDS = ['s1', 's2', 's3', 's4', 's5', 's6'];

export function hashGuide(helmHtmlText) {
  const parts = [];
  for (const id of SCENE_IDS) {
    const re = new RegExp(`<section class="scene" id="${id}">[\\s\\S]*?<\\/section>`);
    const m = helmHtmlText.match(re);
    if (!m) throw new Error(`gen-helm-guide-freshness: scene #${id} not found in helm.html (page structure changed — update SCENE_IDS)`);
    parts.push(m[0]);
  }
  return createHash('sha256').update(parts.join('\n')).digest('hex');
}

// Pure function of parsed inputs — independently testable, see .test.mjs.
export function evaluate({ latestVersion, guideHash, state }) {
  const synced = state.synced_version;
  const ack = new Set(state.acknowledged_no_change || []);

  if (synced === latestVersion) {
    return { action: 'none', ok: true, reason: `already synced for ${latestVersion}` };
  }

  if (ack.has(latestVersion)) {
    return { action: 'sync', ok: true, reason: `${latestVersion} is in acknowledged_no_change — escape used` };
  }

  if (guideHash !== state.guide_hash) {
    return { action: 'sync', ok: true, reason: `walkthrough markup changed since ${synced} — real update present` };
  }

  return {
    action: 'none',
    ok: false,
    reason: `Helm released ${latestVersion} but the walkthrough (helm.html scenes s1-s6) is byte-identical to the last synced release ${synced}. ` +
      `Either add something a user can see to the walkthrough for this release, or add "${latestVersion}" to helm/guide-freshness.json's acknowledged_no_change array (with a reason comment) if there is genuinely nothing visible to show.`,
  };
}

function loadState() {
  if (!existsSync(STATE_PATH)) return null;
  return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
}

function main() {
  const CHECK = process.argv.includes('--check');
  const versionJson = JSON.parse(readFileSync(VERSION_JSON_PATH, 'utf8'));
  const latestVersion = versionJson.latest_version;
  const helmHtmlText = readFileSync(HELM_HTML_PATH, 'utf8');
  const guideHash = hashGuide(helmHtmlText);

  const state = loadState();
  if (!state) {
    if (CHECK) {
      console.error('✗ helm guide-freshness gate FAILED — helm/guide-freshness.json does not exist yet. Run: node scripts/gen-helm-guide-freshness.mjs');
      process.exit(2);
    }
    const seeded = { synced_version: latestVersion, guide_hash: guideHash, acknowledged_no_change: [] };
    writeFileSync(STATE_PATH, JSON.stringify(seeded, null, 2) + '\n');
    console.log(`gen-helm-guide-freshness: bootstrapped helm/guide-freshness.json at ${latestVersion}.`);
    return;
  }

  const result = evaluate({ latestVersion, guideHash, state });

  if (!result.ok) {
    console.error(`✗ helm guide-freshness gate FAILED — ${result.reason}`);
    process.exit(2);
  }

  if (result.action === 'none') {
    console.log(`✓ helm guide-freshness gate clean — ${result.reason}.`);
    return;
  }

  // action === 'sync': a real update or an acknowledged no-change release is
  // owed a snapshot write. --check FAILS here (like every other gen-*.mjs
  // --check gate) so the sync must be run and its result COMMITTED — a
  // silently-passing --check would let the record drift forever unwritten.
  if (CHECK) {
    console.error(`✗ helm guide-freshness gate FAILED — ${result.reason}, but helm/guide-freshness.json is not synced to ${latestVersion} yet. Run: node scripts/gen-helm-guide-freshness.mjs (then commit the updated file).`);
    process.exit(2);
  }
  const next = {
    synced_version: latestVersion,
    guide_hash: guideHash,
    acknowledged_no_change: (state.acknowledged_no_change || []).filter((v) => v !== latestVersion),
  };
  writeFileSync(STATE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`gen-helm-guide-freshness: synced helm/guide-freshness.json to ${latestVersion} — ${result.reason}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

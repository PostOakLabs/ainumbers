#!/usr/bin/env node
// scripts/check-verify-no-egress.mjs — AV-NOEGRESS-1 (ANCHOR-VERIFY-ENHANCE-WAVE-2026-07-21 #6).
//
// Makes "verification runs entirely client-side, nothing leaves the machine"
// a CI-enforced property of the VERIFY PATH ONLY (the local-bundle offline
// verifier). Scope is deliberately narrow — see AV-RESEARCH-1-REPORT.md
// survivor #6: the ANCHOR path has a live CSP `connect-src 'self' https:` for
// rotating OTS timestamping calls (memory project-ainumbers-ux-consistency-2026-07-20),
// so a whole-suite "zero-egress" claim would be FALSE. This gate covers ONLY
// the files in VERIFY_PATHS below — do not widen it to the anchor tool.
//
// What "no egress" means here, and why: the property being guaranteed is that
// pasted artifact data (the input a user is verifying) can never leave the
// browser. That is a runtime-network-after-load guarantee, matching
// CONTRACT.md's own "Zero network calls... after page load" line — it is not
// a ban on the static Google Fonts CDN load, which CONTRACT.md explicitly
// permits sitewide and which never touches user input.
//
// Two checks, both must hold:
//   1. CSP: <meta http-equiv="Content-Security-Policy"> must carry
//      `connect-src 'none'` — the browser-enforced backstop that blocks every
//      JS-initiated network primitive (fetch/XHR/WebSocket/EventSource/
//      sendBeacon/etc.) regardless of what the script content does.
//   2. Static scan: no inline <script> may reference a network-capable JS API
//      (fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon,
//      navigator.sendBeacon, dynamic import()) or load an external <script src>.
//
// Exit 1 with a diagnosis on any violation. Zero-dependency.
//
// --changed <REF> (PREREQ-CHANGED-SCOPING-1, B7 of GATE-MANIFEST-DRAFT.md §1):
// this gate already checks exactly one fixed file, so scoping only matters
// when that file is untouched — skip it (nothing to re-verify this diff).
// Undeterminable diff falls back to a FULL scan (fail-open, safe-by-cost).
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChangedScope, isTouched } from './_changed-files-lib.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// FENCE: verify path only. Do NOT add anchor.ainumbers.co / anchor-*.html here.
const ALL_VERIFY_PATHS = [
  'chaingraph/verify.html',
];

const changedArgIdx = process.argv.indexOf('--changed');
const changedRef = changedArgIdx !== -1 ? process.argv[changedArgIdx + 1] : null;
const CHANGED = resolveChangedScope(changedRef, { gate: 'check-verify-no-egress.mjs (B7)', failClosed: false });
const VERIFY_PATHS = CHANGED ? ALL_VERIFY_PATHS.filter(p => isTouched(p, CHANGED)) : ALL_VERIFY_PATHS;

const FORBIDDEN_PATTERNS = [
  [/\bfetch\s*\(/, 'fetch('],
  [/new\s+XMLHttpRequest\b/, 'XMLHttpRequest'],
  [/new\s+WebSocket\b/, 'WebSocket'],
  [/new\s+EventSource\b/, 'EventSource'],
  [/navigator\s*\.\s*sendBeacon\b/, 'navigator.sendBeacon'],
  [/\bimport\s*\(/, 'dynamic import()'],
];

let failed = false;
const problems = [];

for (const rel of VERIFY_PATHS) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) {
    problems.push(`${rel}: file not found — update VERIFY_PATHS in scripts/check-verify-no-egress.mjs`);
    failed = true;
    continue;
  }
  const html = readFileSync(abs, 'utf-8');

  // 1. CSP connect-src 'none'
  const cspMatch = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
  if (!cspMatch) {
    problems.push(`${rel}: no CSP meta tag found — cannot verify connect-src`);
    failed = true;
  } else {
    const connectSrcMatch = cspMatch[1].match(/connect-src\s+([^;]+);/);
    const connectSrc = connectSrcMatch ? connectSrcMatch[1].trim() : null;
    if (connectSrc !== "'none'") {
      problems.push(`${rel}: CSP connect-src is "${connectSrc ?? '(missing)'}", must be 'none' for the no-egress guarantee`);
      failed = true;
    }
  }

  // 2. External <script src="...">
  const externalScriptSrc = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'](https?:)?\/\/[^"']+["']/gi)];
  if (externalScriptSrc.length) {
    problems.push(`${rel}: ${externalScriptSrc.length} external <script src> reference(s) — must be inline`);
    failed = true;
  }

  // 3. Network-capable JS APIs inside inline <script> blocks
  const scriptBlocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  for (const [pattern, label] of FORBIDDEN_PATTERNS) {
    if (scriptBlocks.some(block => pattern.test(block))) {
      problems.push(`${rel}: found "${label}" inside an inline <script> block — a network-capable API is not allowed on the verify path`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('check-verify-no-egress: FAILED — the verify-path no-egress claim does not hold:');
  problems.forEach(p => console.error(`  - ${p}`));
  console.error('\nFix the file(s) above, or if the boundary genuinely cannot be drawn cleanly, STOP and flag Tim (per AV-NOEGRESS-1 row) rather than narrowing the claim silently.');
  process.exit(1);
}

console.log(`check-verify-no-egress: 0 violations across ${VERIFY_PATHS.length} verify-path file(s)${CHANGED ? ' (touched-scope)' : ''} (connect-src 'none' + no network-capable JS API).`);

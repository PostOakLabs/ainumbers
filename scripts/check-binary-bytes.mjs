#!/usr/bin/env node
/**
 * scripts/check-binary-bytes.mjs — BINARY-BYTE-GATE-1.
 *
 * Fail the build on NUL (0x00) and other stray control bytes in text-source
 * files. Reports file, byte offset, line and column for every hit.
 *
 * ── WHY THIS GATE EXISTS (the gap is proven, not hypothetical) ─────────────
 * board/done/DISE-SEG-T-2.md landed a raw NUL byte inside a JS string
 * delimiter in tools/582-dise-readiness-gap-analyzer.html. `node
 * scripts/check_tools.js` — the JS syntax gate — was GREEN both before and
 * after the fix, because a NUL inside a string literal parses as perfectly
 * valid JavaScript. Nothing in the estate would have caught it. It surfaced
 * only because a grep happened to answer "Binary file matches" and the author
 * noticed.
 *
 * The damage is bigger than tidiness. A NUL byte makes a file read as BINARY
 * to grep, file(1), ripgrep, and every tool sharing that heuristic. Each
 * grep-based gate, sweep and audit in this repo then silently stops matching
 * that file: it becomes invisible to exactly the instruments used to police
 * it, while still shipping to users and still passing CI. That is the worst
 * failure shape this estate has — a file that looks covered but is not.
 *
 * ── WHAT IS REJECTED ──────────────────────────────────────────────────────
 *   1. NUL (0x00) — the proven, high-impact case.
 *   2. Every other C0 control byte except TAB (0x09), LF (0x0A), CR (0x0D):
 *      0x01-0x08, 0x0B, 0x0C, 0x0E-0x1F. Free to cover — it is one range
 *      check, and it catches the same corrupted-escape shape (a `\b` regex
 *      anchor that lost its backslash becomes a raw 0x08; see the
 *      tools/56-chain-config-auditor.html finding fixed alongside this gate).
 *   3. DEL (0x7F).
 *   4. Lone surrogates encoded as WTF-8 (ED A0 80 .. ED BF BF) — the byte
 *      shape a UTF-16 half survives as when it is written out as UTF-8. Cheap
 *      (one byte-triple check) and the estate carries zero today, so the
 *      check ships clean and stays clean.
 *
 * ── WHAT IS NOT REJECTED (deliberately) ───────────────────────────────────
 * ⛔ Legitimate non-ASCII is NEVER rejected. This estate's HTML is full of
 * emoji and typographic characters (—, ", ', …, ✅, 🔒) and its own board rows
 * use glyphs heavily. A gate that reds on an em-dash or an emoji is worse
 * than no gate. Correctness here is structural, not a denylist: every byte of
 * a multi-byte UTF-8 sequence is >= 0x80, so a check confined to 0x00-0x1F
 * and 0x7F cannot touch one. scripts/check-binary-bytes.test.mjs proves it
 * against real emoji, em-dashes, curly quotes, CJK, RTL marks and astral-plane
 * codepoints.
 *
 * ── ALLOWLIST, AND WHY IT HAS NO --update ─────────────────────────────────
 * scripts/binary-byte-allowlist.json shields the handful of DELIBERATE
 * control bytes the 2026-08-15 estate sweep found — a fuzz corpus that must
 * contain a NUL, a spec-mandated PDF padding constant, and two sentinel/
 * separator uses. Each entry carries a mandatory written `reason`; an entry
 * without one fails the gate. Ratchet: a listed file may carry AT MOST the
 * listed count of each listed byte, may carry no byte value that is not
 * listed, and an unlisted file must be clean.
 *
 * ⛔ There is deliberately NO --update flag. Every other baseline in this repo
 * has one because its debt is bulk legacy prose; this gate's whole purpose is
 * to make a single stray byte impossible to ignore, and a one-command
 * "make it green" would hand the next session the exact escape hatch the gate
 * exists to remove. Adding an entry must cost a human sentence.
 *
 * ── SCANNED SET ───────────────────────────────────────────────────────────
 * Derived from extension + directory (SCAN_RULES below), never from a
 * hand-maintained file list. Binary assets are never scanned: images, fonts,
 * archives and generated base64 payload blobs (chaingraph/vm/*.b64.mjs) would
 * fail by construction and carry no text-source risk. The exclusion list is
 * printed in this gate's own output on every run, so it is visible rather
 * than silent.
 *
 * Usage:
 *   node scripts/check-binary-bytes.mjs           # gate (preflight + CI)
 *   node scripts/check-binary-bytes.mjs --sweep   # widen to every text
 *                                                 # extension anywhere in the
 *                                                 # repo; REPORT-ONLY, exit 0
 *   node scripts/check-binary-bytes.mjs --json    # machine-readable findings
 *
 * Zero dependencies (site repo is zero-dep, forever).
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWLIST_PATH = resolve(REPO, 'scripts', 'binary-byte-allowlist.json');

// ── Scanned set: the text-source files a stray byte can hide in and ship ───
// { label, dir (repo-relative), exts, recursive }. `label` is what the gate
// prints, so the scanned set is self-describing in its own output.
export const SCAN_RULES = [
  { label: 'tools/*.html', dir: 'tools', exts: ['.html'], recursive: false },
  { label: 'guides/*.html', dir: 'guides', exts: ['.html'], recursive: false },
  { label: 'chaingraph/**/*.mjs', dir: 'chaingraph', exts: ['.mjs'], recursive: true },
  { label: 'manifests/*.json', dir: 'manifests', exts: ['.json'], recursive: false },
  { label: '<repo root>/*.html', dir: '.', exts: ['.html'], recursive: false },
  // scripts/ is NOT in BINARY-BYTE-GATE-1's originally named set. It was added
  // on evidence, twice over: the estate sweep found a raw NUL already living in
  // scripts/check-node-surface-parity.mjs, and then this gate's own fixture
  // proof acquired one during authoring, when a unicode escape for NUL written
  // into a doc comment arrived as a raw byte and had to be cleaned out before
  // the file could pass. The gates themselves live here, so a scripts/ file
  // that reads as binary to grep is the same invisible-to-its-own-instruments
  // failure this gate exists to stop, one level closer to home.
  { label: 'scripts/*.mjs, scripts/*.js', dir: 'scripts', exts: ['.mjs', '.js'], recursive: false },
];

// Directories never walked. '.wt'/'worktrees'/'.worktrees' are sibling git
// worktree checkouts (canonical locations per workspace-root CLAUDE.md), not
// site content — the same exclusion check-copy-hallmarks.mjs and
// check-nav-reachability.mjs already apply. A live sibling worktree otherwise
// double-reports every file in the estate.
export const EXCLUDED_DIRS = ['.git', 'node_modules', '.github', '.claude', '.wt', 'worktrees', '.worktrees'];

// Generated base64 payload blobs. These are binary artifacts that merely wear
// a .mjs extension: a wasm image re-encoded as a base64 string literal. They
// carry no hand-authored text and no stray-byte risk, and scanning them buys
// nothing. Named explicitly (not pattern-guessed) so the exclusion is auditable.
export const EXCLUDED_FILES = ['chaingraph/vm/quickjs-ng-wasm.b64.mjs'];

// Binary asset extensions — documented for the printed exclusion list. They
// are excluded BY CONSTRUCTION (SCAN_RULES admits only .html/.mjs/.json), so
// this array is descriptive, never load-bearing.
export const EXCLUDED_ASSET_EXTS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.gz', '.wasm', '.bin',
];

// Every text extension --sweep widens to (report-only mode).
const SWEEP_EXTS = ['.html', '.mjs', '.js', '.json', '.md', '.txt', '.xml', '.css', '.py', '.yml', '.yaml', '.csv', '.sh'];

// ── Byte classification ───────────────────────────────────────────────────
// Allowed control bytes — the three that legitimately appear in text.
const TAB = 0x09, LF = 0x0a, CR = 0x0d;

/** True for a control byte that must never appear in a text-source file. */
export function isDisallowedByte(b) {
  if (b === TAB || b === LF || b === CR) return false;
  return b < 0x20 || b === 0x7f;
}

const BYTE_NAMES = {
  0x00: 'NUL', 0x01: 'SOH', 0x02: 'STX', 0x03: 'ETX', 0x04: 'EOT', 0x05: 'ENQ',
  0x06: 'ACK', 0x07: 'BEL', 0x08: 'BS (a `\\b` escape that lost its backslash?)',
  0x0b: 'VT', 0x0c: 'FF', 0x0e: 'SO', 0x0f: 'SI', 0x10: 'DLE', 0x11: 'DC1',
  0x12: 'DC2', 0x13: 'DC3', 0x14: 'DC4', 0x15: 'NAK', 0x16: 'SYN', 0x17: 'ETB',
  0x18: 'CAN', 0x19: 'EM', 0x1a: 'SUB', 0x1b: 'ESC', 0x1c: 'FS', 0x1d: 'GS',
  0x1e: 'RS', 0x1f: 'US', 0x7f: 'DEL',
};
export const hexByte = (b) => '0x' + b.toString(16).padStart(2, '0');
const byteLabel = (b) => `${hexByte(b)} ${BYTE_NAMES[b] || 'control'}`;
export const SURROGATE_KEY = 'lone-surrogate';

/**
 * Scan one buffer. Returns [{ byte, key, offset, line, column, context }].
 * `key` is the allowlist key: a hex byte string, or SURROGATE_KEY.
 * Single pass, no regex, no decode — a NUL cannot survive a utf8 round-trip
 * check honestly, so this reads raw bytes and never a decoded string.
 */
export function scanBuffer(buf) {
  const hits = [];
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === LF) { line++; lineStart = i + 1; continue; }
    // WTF-8 lone surrogate: ED A0 80 .. ED BF BF encodes U+D800..U+DFFF.
    // Well-formed UTF-8 never emits this range; a UTF-16 half that leaked
    // through a naive encoder does.
    if (b === 0xed && i + 2 < buf.length && buf[i + 1] >= 0xa0 && buf[i + 1] <= 0xbf) {
      hits.push({ byte: b, key: SURROGATE_KEY, label: 'lone surrogate (WTF-8 ED A0 80..ED BF BF)', offset: i, line, column: i - lineStart + 1, context: contextAround(buf, i) });
      continue;
    }
    if (!isDisallowedByte(b)) continue;
    hits.push({ byte: b, key: hexByte(b), label: byteLabel(b), offset: i, line, column: i - lineStart + 1, context: contextAround(buf, i) });
  }
  return hits;
}

/**
 * A short, PRINT-SAFE rendering of the bytes around a hit. Control bytes are
 * escaped rather than emitted: a gate that prints a raw NUL to the terminal
 * would corrupt its own report, and a gate whose report is itself unreadable
 * by grep is the very failure it exists to catch.
 */
function contextAround(buf, i, span = 44) {
  const slice = buf.slice(Math.max(0, i - span), Math.min(buf.length, i + span));
  let out = '';
  for (const b of slice) {
    if (b === LF) out += '\\n';
    else if (b === CR) out += '\\r';
    else if (b === TAB) out += '\\t';
    else if (b < 0x20 || b === 0x7f) out += `«${hexByte(b)}»`;
    else if (b < 0x80) out += String.fromCharCode(b);
    else out += '.'; // a multi-byte UTF-8 lead/continuation — never a hit, elided
  }
  return out;
}

// ── File discovery ────────────────────────────────────────────────────────
function walk(dir, exts, recursive, out) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (recursive && !EXCLUDED_DIRS.includes(name)) walk(p, exts, recursive, out);
    } else if (exts.includes(extname(name).toLowerCase())) {
      out.push(p);
    }
  }
  return out;
}

/** The gate's scanned set: absolute paths, deduped, exclusions applied. */
export function scannedFiles(repo = REPO) {
  const excluded = new Set(EXCLUDED_FILES.map((f) => resolve(repo, f)));
  const seen = new Set();
  for (const rule of SCAN_RULES) {
    for (const p of walk(resolve(repo, rule.dir), rule.exts, rule.recursive, [])) {
      if (!excluded.has(resolve(p))) seen.add(resolve(p));
    }
  }
  return [...seen].sort();
}

/** --sweep set: every text extension anywhere in the repo. Report-only. */
function sweepFiles(repo = REPO) {
  const excluded = new Set(EXCLUDED_FILES.map((f) => resolve(repo, f)));
  return walk(repo, SWEEP_EXTS, true, []).filter((p) => !excluded.has(resolve(p))).sort();
}

// ── Allowlist ─────────────────────────────────────────────────────────────
/**
 * Compare per-file hits against the allowlist. Returns { failures, improvements }.
 * Rules, in order:
 *   - an entry with no non-empty `reason` string is itself a failure;
 *   - a file absent from the allowlist must have zero hits;
 *   - a listed file may carry AT MOST the listed count of each listed key;
 *   - a listed file carrying a key that is not listed fails on that key;
 *   - a listed file carrying fewer than allowed is reported as an improvement
 *     (the ratchet: counts only ever go down).
 */
export function evaluate(hitsByFile, rawAllowlist) {
  const failures = [];
  const improvements = [];
  // Keys beginning with '_' are inert comment blocks (e.g. "_README"), never
  // file paths — no repo-relative path starts with an underscore at the root.
  const allowlist = Object.fromEntries(Object.entries(rawAllowlist).filter(([k]) => !k.startsWith('_')));

  for (const [rel, entry] of Object.entries(allowlist)) {
    if (typeof entry?.reason !== 'string' || !entry.reason.trim()) {
      failures.push(`${rel}: allowlist entry has no written \`reason\` — every shielded byte must say why it is deliberate`);
    }
  }

  for (const [rel, hits] of Object.entries(hitsByFile)) {
    const allowed = allowlist[rel]?.bytes || {};
    const counts = {};
    for (const h of hits) counts[h.key] = (counts[h.key] || 0) + 1;
    for (const [key, n] of Object.entries(counts)) {
      const cap = allowed[key] || 0;
      if (n > cap) {
        const sample = hits.filter((h) => h.key === key).slice(0, 5);
        const where = sample.map((h) => `byte ${h.offset} (line ${h.line}, col ${h.column})`).join(', ');
        failures.push(
          `${rel}: ${n} × ${sample[0].label} — allowed ${cap}\n` +
          `      at ${where}${n > sample.length ? ` … +${n - sample.length} more` : ''}\n` +
          sample.map((h) => `      line ${h.line}: …${h.context}…`).join('\n')
        );
      } else if (n < cap) {
        improvements.push(`${rel}: ${key} ${cap} -> ${n} (tighten the allowlist entry)`);
      }
    }
    for (const [key, cap] of Object.entries(allowed)) {
      if (!counts[key] && cap > 0) improvements.push(`${rel}: ${key} ${cap} -> 0 (allowlist entry can be dropped)`);
    }
  }

  for (const [rel, entry] of Object.entries(allowlist)) {
    if (!hitsByFile[rel] && entry?.bytes && Object.keys(entry.bytes).length) {
      improvements.push(`${rel}: clean (allowlist entry can be dropped)`);
    }
  }

  return { failures, improvements };
}

// ── Gate body ─────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const SWEEP = process.argv.includes('--sweep');
  const JSON_OUT = process.argv.includes('--json');

  const files = SWEEP ? sweepFiles() : scannedFiles();
  const hitsByFile = {};
  for (const abs of files) {
    const hits = scanBuffer(readFileSync(abs));
    if (hits.length) hitsByFile[relative(REPO, abs).replace(/\\/g, '/')] = hits;
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ mode: SWEEP ? 'sweep' : 'gate', filesScanned: files.length, hitsByFile }, null, 2));
    process.exit(0);
  }

  // The scanned set and the exclusion list print on EVERY run, pass or fail —
  // the row's requirement, and the reason a green result here is evidence
  // rather than a shrug. A reader must be able to see what was NOT looked at.
  console.log(`binary-bytes: scanned ${files.length} file(s)`);
  if (SWEEP) {
    console.log(`  set (--sweep, REPORT-ONLY): every ${SWEEP_EXTS.join('/')} file in the repo`);
  } else {
    console.log(`  set: ${SCAN_RULES.map((r) => r.label).join(' · ')}`);
  }
  console.log(`  excluded dirs: ${EXCLUDED_DIRS.join(' ')}`);
  console.log(`  excluded files (generated base64 payload blobs): ${EXCLUDED_FILES.join(' ') || '(none)'}`);
  console.log(`  excluded by construction (binary assets, never text-source): ${EXCLUDED_ASSET_EXTS.join(' ')}`);
  console.log(`  rejected: NUL 0x00 · every other C0 control except TAB/LF/CR · DEL 0x7f · WTF-8 lone surrogates`);
  console.log(`  NOT rejected: all non-ASCII — emoji, em-dashes, curly quotes, CJK, astral-plane codepoints (every UTF-8 byte is >= 0x80, outside the checked range by construction)`);

  if (SWEEP) {
    const total = Object.values(hitsByFile).reduce((a, h) => a + h.length, 0);
    if (!total) {
      console.log('\n✅ sweep CLEAN: zero control bytes across the widened text-source set.');
      process.exit(0);
    }
    console.log(`\n📋 sweep findings (REPORT-ONLY, exit 0 — widened set is not the gate's scanned set):`);
    for (const [rel, hits] of Object.entries(hitsByFile)) {
      const counts = {};
      for (const h of hits) counts[h.label] = (counts[h.label] || 0) + 1;
      console.log(`  ${rel}: ${Object.entries(counts).map(([l, n]) => `${n} × ${l}`).join(', ')}`);
      console.log(`      first at byte ${hits[0].offset} (line ${hits[0].line}, col ${hits[0].column}): …${hits[0].context}…`);
    }
    process.exit(0);
  }

  const allowlist = existsSync(ALLOWLIST_PATH) ? JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) : {};
  const { failures, improvements } = evaluate(hitsByFile, allowlist);

  if (improvements.length) {
    console.log(`\nbinary-bytes: ${improvements.length} allowlist entry/entries now beat their cap — tighten scripts/binary-byte-allowlist.json:\n  ` + improvements.join('\n  '));
  }

  if (failures.length) {
    console.error(`\n✗ binary-bytes: ${failures.length} FAILURE(s) — stray control byte(s) in text-source files:\n\n  ` + failures.join('\n\n  '));
    console.error(`\n  A NUL makes the whole file read as BINARY to grep/ripgrep/file(1), so every`);
    console.error(`  grep-based gate and audit in this repo silently stops matching it while it`);
    console.error(`  still ships. Remove the byte (it is usually an escape that lost its`);
    console.error(`  backslash: \\0, \\b, \\f written raw). If the byte is genuinely DELIBERATE,`);
    console.error(`  add it to scripts/binary-byte-allowlist.json WITH a written reason — there`);
    console.error(`  is no --update flag, and that is on purpose.`);
    process.exit(1);
  }

  const shielded = Object.keys(allowlist).filter((k) => !k.startsWith('_')).length;
  console.log(`\n✅ binary-bytes: OK — 0 stray control bytes (${shielded} file(s) allowlisted with a written reason, all within cap).`);
}

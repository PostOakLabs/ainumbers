// Advisory lint: near-duplicate WebMCP tool metadata over manifests/*.manifest.json.
// Scoring structure pattern-ported from HectorTa1989/ContractLab-WebMCP src/lib/lint.ts
// @b0f4c55 (MIT, read at pin): Jaccard over name+description tokens (x0.75) +
// required-parameter overlap (x0.15) + vague-description pair bonus (0.25),
// flagging pairs scoring >= 0.42. Class-P lift per
// research/WEBMCP-BORROW-AUDIT-2026-09-29.md — no upstream bytes copied.
// The upstream stoplist is ticket-domain; ours is adapted for financial-tool
// prose (kept deliberately small so true duplicates still score high).
// Report mode by default (always exit 0); --strict exits 1 on any finding.
//
// CEILING mode (WEBMCP-META-LINT-CEILING-1, 2026-10-01, Tim's "Advisory + count
// ceiling" decision): --ceiling turns this report into a DOWN-ONLY ratchet, the
// same shape as the §18 compute-proof deferred ratchet. The pinned baseline
// (scripts/webmcp-meta-neardupes-baseline.json) holds the near-duplicate pair
// count measured at the pin, and the gate exits 1 ONLY when the live count
// EXCEEDS that ceiling, quoting the delta and the new pair(s). Below the
// ceiling it prints the re-pin command (--update-baseline); the gate never
// raises a ceiling. The baseline is loaded through the shared hard-failing
// loader (scripts/ratchet-baseline.mjs, RATCHET-BASELINE-LOADER-1), so a
// missing or garbled baseline exits 1 and is never read as green. In ceiling
// mode the exit code keys on the count alone (--strict is not consulted).
// Report mode and --strict are unchanged by any of this, and the 0.42
// threshold is untouched (no threshold changes in this row).
//
// Optional argv entries restrict the scan to explicit files/directories
// (fixture testing); directories are read one level deep for *.manifest.json.
//
// Usage:
//   node scripts/check-webmcp-meta-neardupes.mjs                 # report (always exit 0)
//   node scripts/check-webmcp-meta-neardupes.mjs --strict        # exit 1 on any finding
//   node scripts/check-webmcp-meta-neardupes.mjs --ceiling       # DOWN-ONLY ratchet vs the pinned baseline
//   node scripts/check-webmcp-meta-neardupes.mjs --update-baseline  # re-pin (down only; refuses to raise)
//
// Self-test (SO #40b, RED before GREEN): scripts/check-webmcp-meta-neardupes.test.mjs.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadRatchetBaselineOrExit, readBaselineForUpdate, assertFiniteCeiling } from './ratchet-baseline.mjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.resolve(HERE, 'webmcp-meta-neardupes-baseline.json');
const BASELINE_LABEL = 'WebMCP meta neardupes ceiling';
const REPIN_COMMAND = 'node scripts/check-webmcp-meta-neardupes.mjs --update-baseline';
// Required by the shared hard-failing loader (RATCHET-BASELINE-LOADER-1):
// `pairs` is the DOWN-ONLY ceiling; `pair_keys` is the provenance snapshot used
// only to NAME the new pair(s) in a breach message — the exit code keys on the
// count alone.
const BASELINE_REQUIRED_KEYS = ['pairs', { key: 'pair_keys', type: 'name-list' }];
const BASELINE_OPTS = { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND };

const THRESHOLD = 0.42;
const MAX_PRINTED = 40;

// Baseline snapshots must be portable across OSes (CI is linux, dev may be
// win32): store/compare rel paths POSIX-normalised. Display strings below keep
// the raw path.relative output, unchanged.
const toPosix = (p) => p.split(path.sep).join('/');

// Upstream neutral function words + this estate's ubiquitous nouns.
const STOP_TOKENS = new Set([
  'the', 'this', 'that', 'with', 'from', 'when', 'one', 'and', 'for', 'are',
  'current', 'version', 'requires', 'mutates', 'state', 'stable', 'allowed',
  'value', 'values', 'new', 'read', 'based', 'using', 'returns', 'given',
  'tool', 'tools', 'calculator', 'calculators', 'calculate', 'calculates',
  'computed', 'computes', 'ainumbers',
]);

// Adapted from contractlab's vague-verb test: a bare short verb phrase
// describing nothing specific.
const VAGUE_DESCRIPTION =
  /^(find|gets?|updates?|changes?|adds?|closes?|calculates?|computes?|scores?|checks?|validates?|builds?|models?)\s+[^.]{0,30}\.?$/i;

const tokens = (value) =>
  new Set(
    String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9_ ]/g, ' ')
      .split(/[_\s]+/)
      .map((t) => (t === 'update' || t === 'change' ? 'mutate' : t))
      .filter((t) => t.length > 2 && !STOP_TOKENS.has(t)),
  );

const jaccard = (a, b) => {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const t of small) if (big.has(t)) inter += 1;
  const union = a.size + b.size - inter || 1;
  return inter / union;
};

export function collectManifestFiles(targets = [], root = ROOT) {
  const argvTargets = targets;
  if (argvTargets.length > 0) {
    const files = [];
    for (const t of argvTargets) {
      const abs = path.resolve(process.cwd(), t);
      if (statSync(abs).isDirectory()) {
        files.push(
          ...readdirSync(abs)
            .filter((f) => f.endsWith('.manifest.json'))
            .map((f) => path.join(abs, f)),
        );
      } else {
        files.push(abs);
      }
    }
    return files;
  }
  const dir = path.join(root, 'manifests');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.manifest.json') && !f.includes('DELETE ME'))
    .map((f) => path.join(dir, f));
}

/** Stable key for one flagged pair: POSIX rel paths + tool names, so the
 * baseline snapshot is portable across OSes and names its two sides. */
export function pairKey(p) {
  return `${toPosix(p.a.rel)}#${p.a.name} <-> ${toPosix(p.b.rel)}#${p.b.name}`;
}

/** The full scan as a pure result (no printing, no exiting): flagged pairs
 * (score-descending, as always), their stable keys, and the parse-error lines
 * the CLI prints exactly where it always did. */
export function scanNeardupes(targets = [], root = ROOT) {
  const files = collectManifestFiles(targets, root);
  const tools = [];
  const parseErrorLines = [];
  let parseErrors = 0;

  for (const file of files) {
    const rel = path.relative(root, file);
    let json;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      parseErrors += 1;
      parseErrorLines.push(`${rel}: JSON parse error (${err.message})`);
      continue;
    }
    const mf = json && json.mcp_tool_definition;
    if (!mf || typeof mf !== 'object') continue;
    tools.push({
      rel,
      name: typeof mf.name === 'string' ? mf.name : '(no name)',
      tokens: new Set([...tokens(mf.name), ...tokens(mf.description)]),
      required: new Set(
        mf.inputSchema && Array.isArray(mf.inputSchema.required) ? mf.inputSchema.required : [],
      ),
      vague: typeof mf.description === 'string' && VAGUE_DESCRIPTION.test(mf.description.trim()),
    });
  }

  const pairs = [];
  for (let i = 0; i < tools.length; i += 1) {
    for (let j = i + 1; j < tools.length; j += 1) {
      const a = tools[i];
      const b = tools[j];
      const vagueBonus = a.vague && b.vague ? 0.25 : 0;
      const score = Math.min(
        1,
        jaccard(a.tokens, b.tokens) * 0.75 + jaccard(a.required, b.required) * 0.15 + vagueBonus,
      );
      if (score >= THRESHOLD) pairs.push({ score, a, b });
    }
  }

  pairs.sort((x, y) => y.score - x.score);
  return {
    files,
    tools: tools.length,
    parseErrors,
    parseErrorLines,
    pairs,
    pairKeys: pairs.map(pairKey),
  };
}

// The DOWN-ONLY ceiling check as a pure function (same shape as
// check-compute-proof-coverage.mjs's ratchetBreach): `over` is true iff the
// live pair count ROSE above the pinned ceiling; `added` names the pairs that
// were absent at the pin. ⛔ NO `?? Infinity` DEFAULT on the ceiling —
// RATCHET-BASELINE-LOADER-1 (gate-integrity F-11): a ceiling that cannot be
// breached is not a ratchet, so this pure function enforces the same
// finite-ceiling rule the strict CLI path gets from loadRatchetBaselineOrExit().
export function ceilingBreach(scan, baseline) {
  const ceiling = assertFiniteCeiling(baseline?.pairs, { label: BASELINE_LABEL, keyName: 'pairs' });
  const known = Array.isArray(baseline?.pair_keys) ? new Set(baseline.pair_keys) : new Set();
  return {
    ceiling,
    count: scan.pairs.length,
    over: scan.pairs.length > ceiling,
    added: scan.pairKeys.filter((k) => !known.has(k)),
  };
}

function baselineDocument(scan) {
  return {
    _comment:
      'Ratchet ceiling for near-duplicate WebMCP tool metadata (check-webmcp-meta-neardupes.mjs --ceiling). ' +
      'Counts only go DOWN — the gate refuses to raise it. pair_keys is the provenance snapshot used only ' +
      'to NAME new pair(s) in a breach message; the exit code keys on the count alone. ' +
      `Re-pin (down only): ${REPIN_COMMAND}`,
    pairs: scan.pairs.length,
    pair_keys: [...new Set(scan.pairKeys)].sort(),
  };
}

// Gate body runs only when this file is executed directly, never on `import` —
// the self-test imports the exported pure pieces without triggering a full
// estate scan or a process.exit as an import side effect.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const CEILING = process.argv.includes('--ceiling');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');
const strict = process.argv.includes('--strict');
const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const scan = scanNeardupes(targets);

if (UPDATE_BASELINE) {
  // ⚖ THE ONE SANCTIONED ABSENT-BASELINE PATH (ratchet-baseline.mjs): this mode
  // is the file's WRITER — on a first-ever pin there is legitimately nothing to
  // read (null), while an EXISTING corrupt baseline still hard-fails rather
  // than being overwritten as if it had been a clean pin. ⛔ Never raises: a
  // live count above the current pin is refused — fix duplicates first.
  const old = readBaselineForUpdate(BASELINE_PATH, BASELINE_REQUIRED_KEYS, BASELINE_OPTS);
  if (old && scan.pairs.length > old.pairs) {
    console.error(
      `webmcp-meta-neardupes: --update-baseline REFUSED — live pairs ${scan.pairs.length} exceed the ` +
        `pinned ceiling ${old.pairs} (counts only go DOWN). Fix duplicates first, then re-pin.`,
    );
    process.exit(1);
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(baselineDocument(scan), null, 2) + '\n');
  console.log(
    `webmcp-meta-neardupes: baseline written — ${scan.pairs.length} pair(s) → ` +
      `scripts/webmcp-meta-neardupes-baseline.json${old ? ` (was ${old.pairs})` : ' (first pin)'}`,
  );
  process.exit(0);
}

for (const line of scan.parseErrorLines) console.log(line);
for (const p of scan.pairs.slice(0, MAX_PRINTED)) {
  console.log(
    `${p.score.toFixed(2)}  ${p.a.name} (${path.basename(p.a.rel)}) <-> ${p.b.name} (${path.basename(p.b.rel)})`,
  );
}
if (scan.pairs.length > MAX_PRINTED) console.log(`... and ${scan.pairs.length - MAX_PRINTED} more pairs`);
console.log(
  `webmcp-meta-neardupes: scanned ${scan.files.length} manifests, ${scan.tools} tools, ` +
    `${(scan.files.length * (scan.files.length - 1)) / 2} pairs, findings >= ${THRESHOLD}: ${scan.pairs.length}` +
    (scan.parseErrors > 0 ? ` (incl. ${scan.parseErrors} parse errors)` : ''),
);

if (CEILING) {
  // Hard-failing load: a missing or garbled baseline exits 1 here, never green
  // (RATCHET-BASELINE-LOADER-1). The exit code keys on the count alone.
  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_REQUIRED_KEYS, BASELINE_OPTS);
  const ratchet = ceilingBreach(scan, baseline);
  if (ratchet.over) {
    console.error(
      `webmcp-meta-neardupes: FAIL (ceiling) — pairs ${ratchet.count} > pinned ceiling ${ratchet.ceiling} ` +
        `(+${ratchet.count - ratchet.ceiling}); counts only go DOWN.`,
    );
    if (ratchet.added.length) console.error('  New pair(s): ' + ratchet.added.join(' | '));
    console.error(`  Disambiguate the new pair(s) (distinct name/description tokens) — or, for a deliberate net-zero swap, re-pin lower with: ${REPIN_COMMAND} (never raises).`);
    process.exit(1);
  }
  if (ratchet.count < ratchet.ceiling) {
    console.log(`webmcp-meta-neardupes: within ceiling (${ratchet.count} < ${ratchet.ceiling}) — re-pin lower with: ${REPIN_COMMAND}`);
  } else {
    console.log(`webmcp-meta-neardupes: at ceiling (${ratchet.count} = ${ratchet.ceiling})`);
  }
  process.exit(0);
}

if (strict && (scan.pairs.length > 0 || scan.parseErrors > 0)) {
  console.error('webmcp-meta-neardupes: FAIL (--strict, findings above)');
  process.exit(1);
}
console.log('webmcp-meta-neardupes: done (' + (strict ? 'strict' : 'report') + ' mode)');
}

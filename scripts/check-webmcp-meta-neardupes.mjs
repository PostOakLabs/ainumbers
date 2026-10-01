// Advisory lint: near-duplicate WebMCP tool metadata over manifests/*.manifest.json.
// Scoring structure pattern-ported from HectorTa1989/ContractLab-WebMCP src/lib/lint.ts
// @b0f4c55 (MIT, read at pin): Jaccard over name+description tokens (x0.75) +
// required-parameter overlap (x0.15) + vague-description pair bonus (0.25),
// flagging pairs scoring >= 0.42. Class-P lift per
// research/WEBMCP-BORROW-AUDIT-2026-09-29.md — no upstream bytes copied.
// The upstream stoplist is ticket-domain; ours is adapted for financial-tool
// prose (kept deliberately small so true duplicates still score high).
// Report mode by default (always exit 0); --strict exits 1 on any finding.
// Optional argv entries restrict the scan to explicit files/directories
// (fixture testing); directories are read one level deep for *.manifest.json.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');

const THRESHOLD = 0.42;
const MAX_PRINTED = 40;

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

function collectFiles() {
  const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (targets.length > 0) {
    const files = [];
    for (const t of targets) {
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
  const dir = path.join(ROOT, 'manifests');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.manifest.json') && !f.includes('DELETE ME'))
    .map((f) => path.join(dir, f));
}

const files = collectFiles();
const tools = [];
let parseErrors = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  let json;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    parseErrors += 1;
    console.log(`${rel}: JSON parse error (${err.message})`);
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
for (const p of pairs.slice(0, MAX_PRINTED)) {
  console.log(
    `${p.score.toFixed(2)}  ${p.a.name} (${path.basename(p.a.rel)}) <-> ${p.b.name} (${path.basename(p.b.rel)})`,
  );
}
if (pairs.length > MAX_PRINTED) console.log(`... and ${pairs.length - MAX_PRINTED} more pairs`);
console.log(
  `webmcp-meta-neardupes: scanned ${files.length} manifests, ${tools.length} tools, ` +
    `${(tools.length * (tools.length - 1)) / 2} pairs, findings >= ${THRESHOLD}: ${pairs.length}` +
    (parseErrors > 0 ? ` (incl. ${parseErrors} parse errors)` : ''),
);

const strict = process.argv.includes('--strict');
if (strict && (pairs.length > 0 || parseErrors > 0)) {
  console.error('webmcp-meta-neardupes: FAIL (--strict, findings above)');
  process.exit(1);
}
console.log('webmcp-meta-neardupes: done (' + (strict ? 'strict' : 'report') + ' mode)');

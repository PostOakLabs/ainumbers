// check-embed-parity.mjs (WB-BRIDGE-1 done-criterion check)
//
// tools/554-workbook-table-editor.html embeds a stripped-verbatim inline copy
// of chaingraph/workbook/workbook.mjs (+ chaingraph/kernels/_hash.mjs) so the
// tool stays a single self-contained HTML file with zero network calls
// (CONTRACT §0) -- it cannot `import` the canonical module at runtime.
//
// That means the two copies can silently drift: someone fixes a bug in
// workbook.mjs and forgets to port it into the inline <script> block. This
// script is the mechanical proof they haven't drifted -- it extracts a fixed
// list of top-level function/const declarations from BOTH files, strips the
// only expected difference (the `export ` keyword), normalizes whitespace,
// and asserts the two bodies are byte-identical. Run before every commit that
// touches either file: `node chaingraph/workbook/check-embed-parity.mjs`.
//
// Zero-dep, Node-only (dev tool, never shipped to the browser).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKBOOK_PATH = join(HERE, 'workbook.mjs');
const HASH_PATH = join(HERE, '..', 'kernels', '_hash.mjs');
const EMBED_PATH = join(HERE, '..', '..', 'tools', '554-workbook-table-editor.html');

// name -> which canonical source file it's declared in. The embed inlines
// BOTH workbook.mjs and _hash.mjs (see the embed's own header comment).
const CHECKED_NAMES = {
  colLettersToIndex: 'workbook', indexToColLetters: 'workbook', parseCellRef: 'workbook',
  cellKey: 'workbook', expandRange: 'workbook', fullRangeRef: 'workbook',
  parseFormula: 'workbook', createWorkbook: 'workbook', setCell: 'workbook', recalc: 'workbook',
  parseCSV: 'workbook', serializeCSV: 'workbook', csvToWorkbook: 'workbook', workbookToCSV: 'workbook',
  rangeValuesMatrix: 'workbook', rangeDigest: 'workbook',
  VOLATILE_FUNCTION_NAMES: 'workbook', detectVolatileFormulas: 'workbook',
  digestRows: 'workbook', digestCols: 'workbook', exportArtifact: 'workbook',
  // shared _hash.mjs primitives, also inlined verbatim at the top of the block
  assertIJson: 'hash', cgCanon: 'hash', canonicalPreimage: 'hash', executionHash: 'hash',
};

// Extracts `export? (async)? function NAME(...) { ... }` or
// `export? const NAME = ...;` as a single top-level declaration by walking
// brace/paren depth from the declaration keyword to its natural close. Good
// enough for this file's plain declarations (no braces inside string/regex
// literals that aren't already balanced within the literal itself).
function extractDecl(source, name) {
  const fnRe = new RegExp(`(?:^|\\n)(export\\s+)?(async\\s+function|function)\\s+${name}\\s*\\(`, 'm');
  const constRe = new RegExp(`(?:^|\\n)(export\\s+)?const\\s+${name}\\s*=`, 'm');

  let m = fnRe.exec(source);
  if (m) {
    const start = m.index + m[0].indexOf(m[2]); // start at "function"/"async function"
    const braceStart = source.indexOf('{', m.index + m[0].length - 1);
    let depth = 0, i = braceStart, end = -1;
    for (; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end === -1) throw new Error(`unbalanced braces extracting function ${name}`);
    return source.slice(start, end);
  }

  m = constRe.exec(source);
  if (m) {
    const start = m.index + m[0].indexOf('const');
    const semi = source.indexOf(';\n', m.index);
    const semi2 = semi === -1 ? source.indexOf(';', m.index) : semi;
    if (semi2 === -1) throw new Error(`no terminating ';' extracting const ${name}`);
    return source.slice(start, semi2 + 1);
  }

  return null;
}

// The embed's own header says "import/export stripped for inline same-origin
// execution" -- and, pre-existing (WB-1), it also drops a handful of
// trailing `//` explainer comments the canonical module keeps. Logic drift
// is what this check exists to catch, not comment wording, so line comments
// are stripped from both sides before comparing. (No string literal in this
// checked-function set contains "//", so this is safe here.)
function normalize(decl) {
  return decl
    .replace(/^export\s+/, '')        // the one allowed keyword difference: canonical exports, embed doesn't
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s*\/\/.*$/, ''))
    .join('\n')
    .replace(/[ \t]+$/gm, '')          // trailing whitespace per line
    .replace(/\n{2,}/g, '\n')          // blank lines left behind by a stripped comment-only line
    .trim();
}

const workbookSrc = readFileSync(WORKBOOK_PATH, 'utf8');
const hashSrc = readFileSync(HASH_PATH, 'utf8');
const embedSrc = readFileSync(EMBED_PATH, 'utf8');

let failures = 0;
for (const [name, from] of Object.entries(CHECKED_NAMES)) {
  const canonicalSrc = from === 'hash' ? hashSrc : workbookSrc;
  const canonicalDecl = extractDecl(canonicalSrc, name);
  const embedDecl = extractDecl(embedSrc, name);
  if (!canonicalDecl) { console.log(`FAIL  ${name}: not found in ${from === 'hash' ? '_hash.mjs' : 'workbook.mjs'} (checked-name list is stale?)`); failures++; continue; }
  if (!embedDecl) { console.log(`FAIL  ${name}: not found in tools/554-workbook-table-editor.html embed`); failures++; continue; }
  const a = normalize(canonicalDecl), b = normalize(embedDecl);
  if (a !== b) {
    console.log(`FAIL  ${name}: embedded copy has drifted from its canonical source`);
    failures++;
  } else {
    console.log(`PASS  ${name}`);
  }
}

const checkedCount = Object.keys(CHECKED_NAMES).length;
console.log(`\n${failures === 0 ? `✅ ALL ${checkedCount} EMBEDDED DECLARATIONS MATCH THEIR CANONICAL SOURCE` : `❌ ${failures} DECLARATION(S) DRIFTED — port the fix from workbook.mjs into tools/554-workbook-table-editor.html (or vice versa) and re-run`}`);
process.exit(failures === 0 ? 0 : 1);

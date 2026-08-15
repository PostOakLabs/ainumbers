/**
 * scripts/check-inline-ssot-sync.fixtures.mjs — INLINE-SSOT-PORTS-GATE-1
 *
 * Negative-control fixtures for the "codeOnly" normalizer in
 * scripts/check-inline-ssot-sync.mjs. Run: node scripts/check-inline-ssot-sync.mjs --self-test
 *
 * WHY THESE EXIST, stated plainly: the codeOnly mode's whole value rests on the
 * normalizer removing ONLY comments, ES-module linkage, and insignificant
 * whitespace. A normalizer that quietly went further would turn the gate green
 * over a real defect — a verifier saying PASS on something the fixed module
 * would reject. Reading the normalizer to convince yourself it is narrow is the
 * self-consistent-checker shape one level up (STANDING-ORDERS #34: "verify a
 * checker by mutation, NOT by reading it"), so instead every class of change the
 * normalizer MUST NOT mask is asserted here as an executable case.
 *
 * `expect` is one of:
 *   "insync" — the two sides MUST normalize to the same text (incidental diff)
 *   "drift"  — the two sides MUST NOT (a real code difference; the gate must see it)
 *   "throws" — the normalizer must refuse rather than guess (fail closed)
 *
 * The mutations mirror the real hazard: `ics23-verify.mjs` carries the
 * VSA-2022-103 domain-separation fix and `c2sp-tlog-verify.mjs` carries
 * signature/quorum verification, so a masked operator, constant, identifier or
 * string change is exactly the silent divergence this gate is built to stop.
 */

// A miniature stand-in for a verifier module: an exported constant, an exported
// function with a comparison operator, a domain-separator string, a template
// literal, and a re-export statement — one of each shape the ports actually use.
const SSOT_MODULE = `// module banner comment — a port omits this
// second banner line
const CHILD_SIZE = 33;
const DOMAIN = 'ics23:inner';

export function checkPrefix(prefixLen, minLen) {
  /* block banner
     spanning lines */
  if (prefixLen >= minLen) return true;   // trailing comment
  return false;
}

export const describe = (n) => \`\${DOMAIN}/\${n}\`;

export { CHILD_SIZE };
`;

// The faithful inline port: banners gone, `export` keywords gone, the whole
// `export { ... };` statement gone, indented one level inside an IIFE.
const PORT_FAITHFUL = `
  const CHILD_SIZE = 33;
  const DOMAIN = 'ics23:inner';

  function checkPrefix(prefixLen, minLen) {
    if (prefixLen >= minLen) return true;
    return false;
  }

  const describe = (n) => \`\${DOMAIN}/\${n}\`;
`;

const mutate = (from, to) => PORT_FAITHFUL.replace(from, to);

export const CASES = [
  // ── POSITIVE CONTROLS: incidental differences that MUST normalize away ──
  {
    name: 'faithful port (banners stripped, export keywords stripped, re-export dropped, re-indented)',
    ssot: SSOT_MODULE,
    port: PORT_FAITHFUL,
    expect: 'insync',
  },
  {
    name: 'blank lines added/removed are incidental',
    ssot: SSOT_MODULE,
    port: PORT_FAITHFUL.replace(/\n\n/g, '\n\n\n'),
    expect: 'insync',
  },
  {
    name: 'a comment may be re-worded on either side without moving the gate',
    ssot: SSOT_MODULE.replace('// module banner comment — a port omits this', '// completely different banner text'),
    port: PORT_FAITHFUL,
    expect: 'insync',
  },

  // ── NEGATIVE CONTROLS: real code changes the gate MUST still catch ──────
  {
    name: 'NEGATIVE: comparison operator changed (>= to >)',
    ssot: SSOT_MODULE,
    port: mutate('prefixLen >= minLen', 'prefixLen > minLen'),
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: numeric literal changed by one character (33 to 32)',
    ssot: SSOT_MODULE,
    port: mutate('CHILD_SIZE = 33', 'CHILD_SIZE = 32'),
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: hash-domain separator string changed by one character',
    ssot: SSOT_MODULE,
    port: mutate("'ics23:inner'", "'ics23:innel'"),
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: identifier renamed',
    ssot: SSOT_MODULE,
    port: mutate('checkPrefix(prefixLen, minLen)', 'checkPrefix(prefixLength, minLen)'),
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: control flow added (an early return the module does not have)',
    ssot: SSOT_MODULE,
    port: mutate('if (prefixLen >= minLen) return true;', 'if (!minLen) return false;\n    if (prefixLen >= minLen) return true;'),
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: negation inserted',
    ssot: SSOT_MODULE,
    port: mutate('return true;\n    return false;', 'return true;\n    return !false;'),
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: template literal rewritten as string concatenation',
    ssot: SSOT_MODULE,
    port: mutate('`${DOMAIN}/${n}`', "DOMAIN + '/' + n"),
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: a global scope qualifier dropped (globalThis.crypto to crypto)',
    ssot: 'export const d = globalThis.crypto.subtle;\n',
    port: 'const d = crypto.subtle;\n',
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: whitespace INSIDE a string literal is never trimmed',
    ssot: "export const s = 'a  b';\n",
    port: "const s = 'a b';\n",
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: a comment-lookalike inside a string is code, not a comment',
    ssot: "export const u = 'https://example.test/path';\n",
    port: "const u = 'https:';\n",
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: a block-comment-lookalike inside a string is code, not a comment',
    ssot: "export const g = 'a/*b*/c';\n",
    port: "const g = 'ac';\n",
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: quote character change is a real difference',
    ssot: "export const q = 'x';\n",
    port: 'const q = "x";\n',
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: minification (intra-line spacing) is NOT normalized away',
    ssot: 'export function f(a, b) { return a + b; }\n',
    port: 'function f(a,b){return a+b;}\n',
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: newline inside a multi-line template literal is preserved, not trimmed',
    ssot: 'export const t = `line1\n   line2`;\n',
    port: 'const t = `line1 line2`;\n',
    expect: 'drift',
  },
  {
    name: 'NEGATIVE: a regex literal body is compared exactly',
    ssot: 'export const r = /a+b/g;\n',
    port: 'const r = /a*b/g;\n',
    expect: 'drift',
  },

  // ── FAIL-CLOSED CONTROLS: shapes the normalizer must refuse, not guess ──
  {
    name: 'FAIL-CLOSED: an `import` statement is refused rather than silently dropped',
    ssot: "import { x } from './x.mjs';\nexport const y = x;\n",
    port: 'const y = x;\n',
    expect: 'throws',
  },
  {
    name: 'FAIL-CLOSED: `export default` is refused rather than guessed at',
    ssot: 'export default function f() { return 1; }\n',
    port: 'function f() { return 1; }\n',
    expect: 'throws',
  },
  {
    name: 'FAIL-CLOSED: unterminated block comment is an error, not an empty pass',
    ssot: 'const a = 1;\n/* never closed\n',
    port: 'const a = 1;\n',
    expect: 'throws',
  },

  // ── SCANNER CORRECTNESS: division vs regex must not corrupt the scan ────
  {
    name: 'division is not mistaken for a regex literal (comment after it still strips)',
    ssot: 'export const h = (n) => n / 2; // halve\nexport const k = (n) => n / 4;\n',
    port: 'const h = (n) => n / 2;\nconst k = (n) => n / 4;\n',
    expect: 'insync',
  },
  {
    name: 'NEGATIVE: a divisor change survives the division/regex heuristic',
    ssot: 'export const h = (n) => n / 2;\n',
    port: 'const h = (n) => n / 3;\n',
    expect: 'drift',
  },
];

#!/usr/bin/env node
// scripts/check-innerhtml-ratchet.selftest.mjs — RED/GREEN fixture proof for
// check-innerhtml-ratchet.mjs.
//
// A checker that cannot be shown red proves nothing. This self-test builds
// small tool-page trees in a temp dir, pins a baseline with the writer, then
// tampers with the tree (or the baseline) and asserts the checker's EXIT CODE
// on every case — non-zero for each RED, zero for each GREEN — exactly the
// contract preflight invokes. It proves the blocking mode fails from day one,
// so preflight's advisory first cycle is a policy choice, not an untested one.
//
// RED cases: an added interpolated assignment (direct + indirect), a
// brand-new file with one site, a multi-line template assignment, an escaper
// that skips " (unverified), four escaped-but-attribute-context holes
// (on* / href / style / unquoted), a hand-raised baseline (both tamper
// shapes: bumped totals and a padded hash), --update refusing a raise, and a
// deleted baseline (the hard-failing loader). GREEN cases: a baseline-equal
// tree, a tree with a site removed (--update lowers it), and a fully-escaped
// tree whose verified escaper / toFixed / Number / Math / numeric / concat
// holes produce ZERO sites at all.
//
// Pure Node, no network. Exits 0 iff every case has the expected exit code.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = resolve(HERE, 'check-innerhtml-ratchet.mjs');

// ── fixture statements (single-quoted: backticks and ${ stay literal) ────────
const ESC_VERIFIED = 'const esc = s => String(s).replace(/[&<>"\']/g, c => ({\'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\'}[c]));';
const ESC_MISSING_QUOTE = 'const esc = s => String(s).replace(/[&<>]/g, c => ({\'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\'}[c]));';
const STMT_DIRECT = 'tr.innerHTML = `<td>${row.name}</td><td>${esc(row.label)}</td><td>${row.n.toFixed(2)}</td>`;';
const STMT_INDIRECT = 'box.innerHTML = parts.join(\'\');';
const STMT_CLEAN_EMPTY = 'title.innerHTML = \'\';';
const STMT_CLEAN_LITERAL = 'static2.innerHTML = \'<b>done</b>\';';
const STMT_WRITE_CLEAN = 'document.write(\'rendered\');';
const STMT_ADDED_DIRECT = 'note.innerHTML = `<i>${msg}</i>`;';
const STMT_ADDED_INDIRECT = 'note2.innerHTML = otherParts.join(\'\');';
const STMT_ESCQUOTE_USE = 'elq.innerHTML = `<b>${esc(v)}</b>`;';
const STMT_CONTEXT_HREF = 'c1.innerHTML = `<a href="${esc(u)}">x</a>`;';
const STMT_CONTEXT_ON = 'c2.innerHTML = `<span onmouseover="${esc(h)}">y</span>`;';
const STMT_CONTEXT_STYLE = 'c3.innerHTML = `<i style="${esc(s)}">z</i>`;';
const STMT_CONTEXT_UNQUOTED = 'c4.innerHTML = `<b data-x=${esc(d)}>w</b>`;';
const STMT_MULTILINE = [
  'tr.innerHTML = `',
  '  <td class="x">${rail.label}</td>',
  '  <td>${saving}</td>',
  '`;',
].join('\n');
// GREEN safe-wrappers page: every hole is provably safe, so the page must
// produce ZERO findings (an empty baseline entry — asserted, not assumed).
// (Escaping OUTSIDE a hole — `innerHTML = 'v=' + esc(x)` — is a non-literal
// payload and records as indirect by design; that class lives in the A tree.)
const STMTS_SAFE = [
  'el.innerHTML = `<a title="${esc(u)}">${n.toFixed(2)} / ${Number(q)} / ${Math.round(r)} / ${5}</a>`;',
].join('\n');

const page = (name, body) => ({ [`tools/${name}`]: `<!doctype html><html><body><script>\n${body}\n</script></body></html>\n` });

function makeTree(root, name, files) {
  const tree = join(root, name);
  mkdirSync(join(tree, 'tools'), { recursive: true });
  mkdirSync(join(tree, 'scripts'), { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(tree, rel)), { recursive: true });
    writeFileSync(join(tree, rel), text);
  }
  return tree;
}

function runGate(tree, ...args) {
  const r = spawnSync(process.execPath, [GATE, '--root', tree, ...args], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

const results = [];
function expect(name, cond, detail) {
  results.push({ name, ok: !!cond, detail: cond ? '' : String(detail).split('\n').slice(-6).join('\n') });
}

// ── the run ───────────────────────────────────────────────────────────────────
const BASE_BODY = [ESC_VERIFIED, 'function render(row) {', STMT_DIRECT, STMT_INDIRECT, STMT_CLEAN_EMPTY, STMT_CLEAN_LITERAL, STMT_WRITE_CLEAN, '}'].join('\n');
const A_FILES = page('aa-base.html', BASE_BODY);

const tmp = mkdtempSync(join(tmpdir(), 'innerhtml-ratchet-selftest-'));
try {
  // GREEN 1 — baseline-equal tree: init pins it, check stays green.
  const tA = makeTree(tmp, 'A', A_FILES);
  const init1 = runGate(tA, '--init');
  expect('G1 init baseline-equal tree exits 0', init1.code === 0, init1.out);
  const g1 = runGate(tA);
  expect('G1 check baseline-equal tree exits 0', g1.code === 0, g1.out);

  // GREEN 2 — a site removed: check green, --update lowers the baseline.
  const tA2 = makeTree(tmp, 'A2', page('aa-base.html', BASE_BODY.replace(`${STMT_INDIRECT}\n`, '')));
  cpSync(join(tA, 'scripts', 'innerhtml-ratchet-baseline.json'), join(tA2, 'scripts', 'innerhtml-ratchet-baseline.json'));
  const g2 = runGate(tA2);
  expect('G2 check with site removed exits 0', g2.code === 0, g2.out);
  const g2u = runGate(tA2, '--update');
  expect('G2 --update lowers the baseline (exit 0)', g2u.code === 0, g2u.out);
  const b2 = JSON.parse(readFileSync(join(tA2, 'scripts', 'innerhtml-ratchet-baseline.json'), 'utf8'));
  expect('G2 lowered baseline: indirect 0, direct 1', b2.indirect === 0 && b2.direct === 1, JSON.stringify({ direct: b2.direct, indirect: b2.indirect }));

  // GREEN 3 — fully-escaped tree: verified escaper + numeric wrappers => no sites.
  const tB = makeTree(tmp, 'B', page('bb-esc.html', [ESC_VERIFIED, STMTS_SAFE].join('\n')));
  const initB = runGate(tB, '--init');
  expect('G3 init fully-escaped tree exits 0', initB.code === 0, initB.out);
  const bB = JSON.parse(readFileSync(join(tB, 'scripts', 'innerhtml-ratchet-baseline.json'), 'utf8'));
  expect('G3 zero sites pinned (escaper + wrappers verified, not ignored)', bB.direct === 0 && bB.indirect === 0, initB.out);
  const g3 = runGate(tB);
  expect('G3 check fully-escaped tree exits 0', g3.code === 0, g3.out);
  const g3a = runGate(tB, '--advisory');
  expect('G3 advisory on green tree exits 0', g3a.code === 0, g3a.out);

  // RED 1 — added interpolated assignment (direct) + added indirect payload.
  const tR1 = makeTree(tmp, 'R1', page('aa-base.html', `${BASE_BODY}\n${STMT_ADDED_DIRECT}\n${STMT_ADDED_INDIRECT}`));
  cpSync(join(tA, 'scripts', 'innerhtml-ratchet-baseline.json'), join(tR1, 'scripts', 'innerhtml-ratchet-baseline.json'));
  const r1 = runGate(tR1);
  expect('R1 added assignments exit non-zero', r1.code !== 0, r1.out);
  expect('R1 names the direct site', r1.out.includes('[direct]') && r1.out.includes('${msg}'), r1.out);
  expect('R1 names the indirect site', r1.out.includes('[indirect]') && r1.out.includes('otherParts.join'), r1.out);
  const r1a = runGate(tR1, '--advisory');
  expect('R1 advisory stays exit 0 by design', r1a.code === 0, r1a.out);
  expect('R1 advisory still prints the sites', r1a.out.includes('ADVISORY') && r1a.out.includes('${msg}'), r1a.out);

  // RED 2 — a brand-new file with one site.
  const tR2 = makeTree(tmp, 'R2', { ...A_FILES, ...page('zz-new.html', `x();\n${STMT_ADDED_DIRECT}\n`) });
  cpSync(join(tA, 'scripts', 'innerhtml-ratchet-baseline.json'), join(tR2, 'scripts', 'innerhtml-ratchet-baseline.json'));
  const r2 = runGate(tR2);
  expect('R2 brand-new file with a site exits non-zero', r2.code !== 0, r2.out);
  expect('R2 names the new file', r2.out.includes('zz-new.html'), r2.out);

  // RED 3 — baseline raised by hand: bumped totals, and a padded hash.
  const tamper = (mut) => {
    const t = makeTree(tmp, `R3-${mut.name}`, A_FILES);
    const bp = join(t, 'scripts', 'innerhtml-ratchet-baseline.json');
    const b = JSON.parse(readFileSync(join(tA, 'scripts', 'innerhtml-ratchet-baseline.json'), 'utf8'));
    mut.fn(b);
    writeFileSync(bp, JSON.stringify(b, null, 2) + '\n');
    return runGate(t);
  };
  const r3a = tamper({ name: 'totals', fn: (b) => { b.direct += 1; } });
  expect('R3a hand-raised totals exit non-zero', r3a.code !== 0, r3a.out);
  expect('R3a says the totals do not match', r3a.out.includes('do not match'), r3a.out);
  const r3b = tamper({ name: 'hash', fn: (b) => { b.files['tools/aa-base.html'].direct.push('0123456789abcdef'); } });
  expect('R3b padded hash exits non-zero', r3b.code !== 0, r3b.out);

  // RED 4 — multi-line template assignment is one statement (not line-parsed).
  const tR4base = makeTree(tmp, 'R4base', A_FILES);
  runGate(tR4base, '--init');
  const tR4 = makeTree(tmp, 'R4', { ...A_FILES, ...page('cc-multi.html', `${STMT_MULTILINE}\n`) });
  cpSync(join(tR4base, 'scripts', 'innerhtml-ratchet-baseline.json'), join(tR4, 'scripts', 'innerhtml-ratchet-baseline.json'));
  const r4 = runGate(tR4);
  expect('R4 multi-line template assignment exits non-zero', r4.code !== 0, r4.out);
  expect('R4 reports the whole statement, whitespace-normalized',
    r4.out.includes('<td class="x">${rail.label}</td> <td>${saving}</td>'), r4.out);

  // RED 5 — an escaper that skips " is NOT verified: its wrapping counts for nothing.
  const D_BODY = `${ESC_MISSING_QUOTE}\n${STMT_DIRECT}`;
  const tD0 = makeTree(tmp, 'D0', page('dd-escquote.html', D_BODY));
  const initD = runGate(tD0, '--init');
  expect('R5 setup: init on the quote-skipping-escaper tree (its unsafe holes pinned)', initD.code === 0, initD.out);
  const tD1 = makeTree(tmp, 'D1', page('dd-escquote.html', `${D_BODY}\n${STMT_ESCQUOTE_USE}`));
  cpSync(join(tD0, 'scripts', 'innerhtml-ratchet-baseline.json'), join(tD1, 'scripts', 'innerhtml-ratchet-baseline.json'));
  const r5 = runGate(tD1);
  expect('R5 escaper missing " exits non-zero', r5.code !== 0, r5.out);
  expect('R5 says the escaper is not verified', r5.out.includes('NOT verified'), r5.out);

  // RED 6 — attribute-context holes flagged even though every hole is escaped.
  const E_BODY = `${ESC_VERIFIED}\n${STMT_DIRECT}`;
  const tE0 = makeTree(tmp, 'E0', page('ee-ctx.html', E_BODY));
  runGate(tE0, '--init');
  const tE1 = makeTree(tmp, 'E1', page('ee-ctx.html', `${E_BODY}\n${STMT_CONTEXT_HREF}\n${STMT_CONTEXT_ON}\n${STMT_CONTEXT_STYLE}\n${STMT_CONTEXT_UNQUOTED}`));
  cpSync(join(tE0, 'scripts', 'innerhtml-ratchet-baseline.json'), join(tE1, 'scripts', 'innerhtml-ratchet-baseline.json'));
  const r6 = runGate(tE1);
  expect('R6 attribute-context holes exit non-zero', r6.code !== 0, r6.out);
  const ctxHits = (r6.out.match(/attribute-context/g) || []).length;
  expect('R6 all four context fixtures named (href/on*/style/unquoted)', ctxHits >= 4, `attribute-context hits: ${ctxHits}\n${r6.out.split('\n').slice(0, 12).join('\n')}`);

  // RED 7 — the writer refuses to raise, --allow-raise is the explicit override.
  const r7 = runGate(tR1, '--update');
  expect('R7 --update refuses the raise (exit 2)', r7.code === 2, `exit ${r7.code}\n${r7.out}`);
  expect('R7 refusal names the policy', r7.out.includes('REFUSES'), r7.out);
  const r7b = runGate(tR1, '--update', '--allow-raise');
  expect('R7b --allow-raise proceeds (exit 0)', r7b.code === 0, r7b.out);

  // RED 8 — a deleted baseline is a broken control, never a silent pass.
  const tR8 = makeTree(tmp, 'R8', A_FILES);
  cpSync(join(tA, 'scripts', 'innerhtml-ratchet-baseline.json'), join(tR8, 'scripts', 'innerhtml-ratchet-baseline.json'));
  rmSync(join(tR8, 'scripts', 'innerhtml-ratchet-baseline.json'));
  const r8 = runGate(tR8);
  expect('R8 deleted baseline exits non-zero', r8.code !== 0, r8.out);
  expect('R8 names the missing-baseline state', r8.out.includes('MISSING-FILE'), r8.out);
  expect('R8 advisory mode ALSO fails on a missing baseline', runGate(tR8, '--advisory').code !== 0, 'advisory passed a deleted baseline');

  // sanity: the fixture runs really did exercise files (no empty-tree vacuous pass)
  expect('S fixtures exist on disk', existsSync(join(tA, 'tools', 'aa-base.html')), 'aa-base.html missing');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ── report ───────────────────────────────────────────────────────────────────
let failed = 0;
for (const r of results) {
  if (!r.ok) {
    failed++;
    console.error(`FAIL ${r.name}`);
    if (r.detail) console.error(r.detail.split('\n').map((l) => `     ${l}`).join('\n'));
  }
}
console.log(`check-innerhtml-ratchet.selftest: ${results.length - failed}/${results.length} case(s) passed${failed ? ` — ${failed} FAILED` : ''}.`);
process.exit(failed ? 1 : 0);

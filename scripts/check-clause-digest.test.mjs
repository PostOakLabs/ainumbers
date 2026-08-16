#!/usr/bin/env node
// check-clause-digest.test.mjs — fixture proof for CLAUSE-DIGEST-GATE-1 (SPEC.md §30.5).
//
// Proves all three directions named in §30.5:
//   (a) a new/changed in-scope node with NO resolvable cited_clause_digest FAILS, naming the node.
//   (b) a new/changed in-scope node WITH a registered digest PASSES.
//   (c) a digest that does NOT resolve to a registered snapshot FAILS — the case that matters.
// Plus: undeclared standards_basis fails; "not_applicable" passes with no digest required; and the
// §30.2 granularity refusal (pin-clause-snapshot.mjs rejects an over-cap excerpt).
//
// Zero-dependency. Non-zero exit blocks.  node scripts/check-clause-digest.test.mjs

import { validateNode, touchedNodeFiles } from './check-clause-digest.mjs';
import { buildRegistryEntry, EXCERPT_MAX_BYTES } from '../chaingraph/standard/pin-clause-snapshot.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const out = [];
let fail = 0;
const log = (s) => { out.push(s); console.log(s); };
const err = (s) => { out.push(s); console.error(s); fail++; };
const ok = (cond, label) => (cond ? log(`✓ ${label}`) : err(`✗ ${label}`));

const REGISTERED_DIGEST = 'sha256:' + 'a'.repeat(64);
const UNREGISTERED_DIGEST = 'sha256:' + 'b'.repeat(64);
const REGISTRY = new Set([REGISTERED_DIGEST]);

const validEntry = {
  digest: REGISTERED_DIGEST,
  source_url: 'https://example.gov/reg',
  retrieved_at: '2026-08-15',
  clause_path: '(a)(2)',
};

log('— §30.5(a): new node, no cited_clause_digest, standards_basis implements_standard —');
{
  const node = { tool_id: 'art-999-fixture', standards_basis: 'implements_standard' };
  const { ok: pass, reasons } = validateNode(node, REGISTRY);
  ok(!pass, 'empty cited_clause_digest FAILS');
  ok(reasons.some((r) => r.includes('empty/missing')), 'failure names the empty-array reason');
}

log('— §30.5(b): new node, one valid registered entry —');
{
  const node = { tool_id: 'art-999-fixture', standards_basis: 'implements_standard', cited_clause_digest: [validEntry] };
  const { ok: pass, reasons } = validateNode(node, REGISTRY);
  ok(pass, 'valid registered digest PASSES');
  ok(reasons.length === 0, 'no reasons on pass');
}

log('— §30.5(c): new node, digest not in registry (the case that matters) —');
{
  const node = { tool_id: 'art-999-fixture', standards_basis: 'implements_standard', cited_clause_digest: [{ ...validEntry, digest: UNREGISTERED_DIGEST }] };
  const { ok: pass, reasons } = validateNode(node, REGISTRY);
  ok(!pass, 'unregistered digest FAILS');
  ok(reasons.some((r) => r.includes('does not resolve')), 'failure names the non-resolving-digest reason');
}

log('— mutation control: flip one char of a registered digest, must still fail —');
{
  const flipped = REGISTERED_DIGEST.slice(0, -1) + (REGISTERED_DIGEST.endsWith('a') ? 'b' : 'a');
  const node = { tool_id: 'art-999-fixture', standards_basis: 'implements_standard', cited_clause_digest: [{ ...validEntry, digest: flipped }] };
  ok(!validateNode(node, REGISTRY).ok, 'a single-character-flipped digest is rejected (registry membership is exact, not fuzzy)');
}

log('— §30.3: undeclared standards_basis on a touched node —');
{
  const node = { tool_id: 'art-999-fixture' };
  const { ok: pass, reasons } = validateNode(node, REGISTRY);
  ok(!pass, 'missing standards_basis FAILS (no silent default)');
  ok(reasons.some((r) => r.includes('standards_basis missing')), 'failure names the undeclared reason');
}
{
  const node = { tool_id: 'art-999-fixture', standards_basis: 'yes_probably' };
  ok(!validateNode(node, REGISTRY).ok, 'an invalid standards_basis value FAILS (closed vocabulary)');
}

log('— explicit opt-out: not_applicable requires nothing further —');
{
  const node = { tool_id: 'art-999-fixture', standards_basis: 'not_applicable' };
  ok(validateNode(node, REGISTRY).ok, 'not_applicable PASSES with zero cited_clause_digest entries');
}

log('— entry shape: missing required member fails, naming the entry index —');
{
  const node = { tool_id: 'art-999-fixture', standards_basis: 'implements_standard', cited_clause_digest: [{ digest: REGISTERED_DIGEST, source_url: 'https://x', retrieved_at: '2026-08-15' /* clause_path missing */ }] };
  const { ok: pass, reasons } = validateNode(node, REGISTRY);
  ok(!pass, 'entry missing clause_path FAILS');
  ok(reasons.some((r) => r.includes('cited_clause_digest[0]') && r.includes('clause_path')), 'failure names the missing member');
}

log('— §30.2 granularity: pin-clause-snapshot.mjs refuses an over-cap excerpt —');
{
  const tooBig = Buffer.alloc(EXCERPT_MAX_BYTES + 1, 'x');
  let threw = false, msg = '';
  try {
    buildRegistryEntry(tooBig, { clause_path: '(a)', source_url: 'https://x', retrieved_at: '2026-08-15', registered_by: 'test', registered_at: '2026-08-15' });
  } catch (e) { threw = true; msg = e.message; }
  ok(threw, `excerpt of ${EXCERPT_MAX_BYTES + 1} bytes is REFUSED (whole-document digests structurally impossible)`);
  ok(msg.includes('whole-document'), 'refusal message cites the whole-document rule');
}
{
  const small = Buffer.from('This paragraph states X shall not exceed Y.', 'utf8');
  let threw = false;
  try {
    buildRegistryEntry(small, { clause_path: '(a)', source_url: 'https://x', retrieved_at: '2026-08-15', registered_by: 'test', registered_at: '2026-08-15' });
  } catch { threw = true; }
  ok(!threw, `a real clause-sized excerpt (${small.length} bytes) is ACCEPTED`);
}
{
  const small = Buffer.from('excerpt text', 'utf8');
  let threw = false;
  try {
    buildRegistryEntry(small, { clause_path: '(a)', source_url: 'https://x', retrieved_at: 'not-a-date', registered_by: 'test', registered_at: '2026-08-15' });
  } catch { threw = true; }
  ok(threw, 'a non-ISO retrieved_at is refused');
}

log('— CLAUSE-DIGEST-SCOPE-FIX-1: touchedNodeFiles diffs against origin/main, not a stale @{u} —');
{
  const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'] });
  const rel = (f) => f.replace(/\\/g, '/');
  const root = mkdtempSync(join(tmpdir(), 'cdg-scope-'));
  try {
    const originDir = join(root, 'origin.git');
    const workDir = join(root, 'work');
    const otherDir = join(root, 'other');

    sh(`git init --bare -q "${originDir}"`, root);
    sh(`git clone -q "${originDir}" "${workDir}"`, root);
    sh('git config user.email t@t.test', workDir);
    sh('git config user.name t', workDir);
    mkdirSync(join(workDir, 'chaingraph', 'graph', 'nodes'), { recursive: true });
    writeFileSync(join(workDir, 'chaingraph', 'graph', 'nodes', 'existing.json'), '{}');
    sh('git add -A', workDir);
    sh('git commit -q -m base', workDir);
    sh('git push -q origin HEAD:main', workDir);
    sh('git symbolic-ref HEAD refs/heads/main', originDir); // bare repo's HEAD must match the pushed branch or a later clone checks out nothing

    // Cut a feature branch and push it — this is what makes @{u} exist and go stale.
    sh('git checkout -q -b feature', workDir);
    sh('git push -q -u origin feature', workDir);

    // Simulate an UNRELATED PR landing on main after the branch was cut (DISE-NODE-PAGES-LAND-1's shape).
    sh(`git clone -q "${originDir}" "${otherDir}"`, root);
    sh('git config user.email t@t.test', otherDir);
    sh('git config user.name t', otherDir);
    writeFileSync(join(otherDir, 'chaingraph', 'graph', 'nodes', 'other.json'), '{}');
    sh('git add -A', otherDir);
    sh('git commit -q -m other-pr', otherDir);
    sh('git push -q origin HEAD:main', otherDir);

    // The branch's OWN change, still sitting on the pre-other-pr base — mirrors ACCT-AMORT-K-1's
    // real shape (rebased locally, @{u} left pointing at the earlier push).
    writeFileSync(join(workDir, 'chaingraph', 'graph', 'nodes', 'new.json'), '{}');
    sh('git add -A', workDir);
    sh('git commit -q -m branch-change', workDir);
    sh('git fetch -q origin', workDir);

    const touched = touchedNodeFiles(workDir);
    const has = (name) => [...touched].some((f) => rel(f).endsWith(name));

    ok(has('new.json'), "the branch's own new node file IS touched");
    ok(!has('other.json'), 'a file landed by an UNRELATED PR after the branch was cut is NOT falsely touched (the REBASE-1290-1 false positive)');
    ok(!has('existing.json'), 'the untouched pre-existing node is NOT touched');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

log('— scoping: no origin/main resolvable (shallow/no-remote checkout) degrades gracefully, no crash —');
{
  const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'] });
  const rel = (f) => f.replace(/\\/g, '/');
  const root = mkdtempSync(join(tmpdir(), 'cdg-noremote-'));
  try {
    sh('git init -q', root);
    sh('git config user.email t@t.test', root);
    sh('git config user.name t', root);
    mkdirSync(join(root, 'chaingraph', 'graph', 'nodes'), { recursive: true });
    writeFileSync(join(root, 'chaingraph', 'graph', 'nodes', 'existing.json'), '{}');
    sh('git add -A', root);
    sh('git commit -q -m base', root);
    writeFileSync(join(root, 'chaingraph', 'graph', 'nodes', 'untracked.json'), '{}');

    let threw = false;
    let touched = new Set();
    try { touched = touchedNodeFiles(root); } catch { threw = true; }
    ok(!threw, 'no origin/main and no upstream at all — resolveBaseRef fails closed to null, function does not throw');
    ok([...touched].some((f) => rel(f).endsWith('untracked.json')), 'the working-tree/staged/untracked legs still catch local work with no base ref');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log(`\n${fail} failure(s) of ${out.filter((s) => s.startsWith('✓') || s.startsWith('✗')).length} assertion(s).`);
process.exit(fail ? 1 : 0);

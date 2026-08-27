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

import { validateNode, touchedNodeFiles, makeIsPreExisting, readOriginFileText } from './check-clause-digest.mjs';
import { changedLineSet } from './diff-scope.mjs';
import { buildRegistryEntry, EXCERPT_MAX_BYTES } from '../chaingraph/standard/pin-clause-snapshot.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isolatedChildEnv } from './_git-env-lib.mjs';

// CHILD-ENVIRONMENT ISOLATION (SHARD-HARNESS-ENV-LEAK-1's fix, same shape here). Git exports
// GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE/... to every hook it runs. This file is wired into
// scripts/preflight.mjs, which the pre-push hook invokes — a child git spawned here with a
// copied process.env inherits a GIT_DIR pointing at the OUTER repo, and every git call below
// then operates on THAT repo instead of its throwaway sandbox. Measured while building this
// fix: under the pre-push hook, an un-isolated version of this exact test committed its
// sandbox's "work" tree onto the real worktree branch, mass-deleting the tracked tree in a
// bogus commit (recovered with `git reset --hard`). An ALLOWLIST, not copy-and-delete, so the
// next unnamed GIT_* variable is excluded by construction rather than missed by omission.
// GIT-ENV-LEAK-SWEEP-1 (2026-08-23): the 40-key allowlist and the childEnv() that filtered on it
// used to be written out here. Three harnesses carried a byte-identical copy; all three now share
// isolatedChildEnv() from scripts/_git-env-lib.mjs. Same key list, same filter, same `extra`-last
// override — a de-duplication, not a behaviour change. The local name is kept so the call sites
// below are untouched.
const childEnv = isolatedChildEnv;
function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: childEnv() });
}

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
  const rel = (f) => f.replace(/\\/g, '/');
  const root = mkdtempSync(join(tmpdir(), 'cdg-scope-'));
  try {
    const originDir = join(root, 'origin.git');
    const workDir = join(root, 'work');
    const otherDir = join(root, 'other');

    git(root, ['init', '--bare', '-q', '-b', 'main', originDir]);
    git(root, ['clone', '-q', originDir, workDir]);
    git(workDir, ['config', 'user.email', 't@t.test']);
    git(workDir, ['config', 'user.name', 't']);
    mkdirSync(join(workDir, 'chaingraph', 'graph', 'nodes'), { recursive: true });
    writeFileSync(join(workDir, 'chaingraph', 'graph', 'nodes', 'existing.json'), '{}');
    git(workDir, ['add', '-A']);
    git(workDir, ['commit', '-q', '-m', 'base']);
    git(workDir, ['push', '-q', 'origin', 'HEAD:main']);

    // Cut a feature branch and push it — this is what makes @{u} exist and go stale.
    git(workDir, ['checkout', '-q', '-b', 'feature']);
    git(workDir, ['push', '-q', '-u', 'origin', 'feature']);

    // Simulate an UNRELATED PR landing on main after the branch was cut (the DISE-NODE-PAGES-LAND-1 shape).
    git(root, ['clone', '-q', originDir, otherDir]);
    git(otherDir, ['config', 'user.email', 't@t.test']);
    git(otherDir, ['config', 'user.name', 't']);
    writeFileSync(join(otherDir, 'chaingraph', 'graph', 'nodes', 'other.json'), '{}');
    git(otherDir, ['add', '-A']);
    git(otherDir, ['commit', '-q', '-m', 'other-pr']);
    git(otherDir, ['push', '-q', 'origin', 'HEAD:main']);

    // The branch's OWN change, still sitting on the pre-other-pr base — mirrors the real
    // acct-amort-k-1 shape (rebased locally, @{u} left pointing at the earlier push).
    writeFileSync(join(workDir, 'chaingraph', 'graph', 'nodes', 'new.json'), '{}');
    git(workDir, ['add', '-A']);
    git(workDir, ['commit', '-q', '-m', 'branch-change']);
    git(workDir, ['fetch', '-q', 'origin']);

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
  const rel = (f) => f.replace(/\\/g, '/');
  const root = mkdtempSync(join(tmpdir(), 'cdg-noremote-'));
  try {
    git(root, ['init', '-q']);
    git(root, ['config', 'user.email', 't@t.test']);
    git(root, ['config', 'user.name', 't']);
    mkdirSync(join(root, 'chaingraph', 'graph', 'nodes'), { recursive: true });
    writeFileSync(join(root, 'chaingraph', 'graph', 'nodes', 'existing.json'), '{}');
    git(root, ['add', '-A']);
    git(root, ['commit', '-q', '-m', 'base']);
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

log('— TOUCHTAX-DIFFSCOPE-1 (J19 §3.3): the B4 fixture shape, against a real sandbox —');
{
  const rel = (f) => f.replace(/\\/g, '/');
  const root = mkdtempSync(join(tmpdir(), 'cdg-diffscope-'));
  try {
    const originDir = join(root, 'origin.git');
    const workDir = join(root, 'work');
    git(root, ['init', '--bare', '-q', '-b', 'main', originDir]);
    git(root, ['clone', '-q', originDir, workDir]);
    git(workDir, ['config', 'user.email', 't@t.test']);
    git(workDir, ['config', 'user.name', 't']);
    mkdirSync(join(workDir, 'chaingraph', 'graph', 'nodes'), { recursive: true });

    const nodePath = join(workDir, 'chaingraph', 'graph', 'nodes', 'art-fixture.json');
    const legacyEntry = { digest: UNREGISTERED_DIGEST, source_url: 'https://old.example.gov', retrieved_at: '2026-01-01', clause_path: '(old)' };
    const baseNode = {
      tool_id: 'art-fixture',
      standards_basis: 'implements_standard',
      cited_clause_digest: [legacyEntry],
      description: 'before',
    };
    writeFileSync(nodePath, JSON.stringify(baseNode, null, 2) + '\n');
    git(workDir, ['add', '-A']);
    git(workDir, ['commit', '-q', '-m', 'base: node with a pre-existing UNREGISTERED (invalid) legacy citation']);
    git(workDir, ['push', '-q', 'origin', 'HEAD:main']);
    git(workDir, ['fetch', '-q', 'origin']);

    // (ii) touch the file for an UNRELATED reason only (description) — the legacy citation line
    // never moves. This is the DESC-HONESTY-APPLY-1 / PAYROLL shape.
    const touchedOnlyDesc = { ...baseNode, description: 'after' };
    writeFileSync(nodePath, JSON.stringify(touchedOnlyDesc, null, 2) + '\n');
    {
      const fileText = readFileSync(nodePath, 'utf8');
      const scope = changedLineSet(workDir, 'chaingraph/graph/nodes/art-fixture.json', 'origin/main');
      const node = JSON.parse(fileText);
      const { ok: pass, reasons } = validateNode(node, REGISTRY, { isPreExisting: makeIsPreExisting(fileText, scope) });
      ok(pass, '(ii) untouched legacy citation line stays GREEN under the shield (the PAYROLL kill-proof), despite the FILE differing from origin/main');
      ok(reasons.length === 0, '(ii) no reasons reported for the shielded legacy entry');
    }

    // (i) a NEW unpinned citation is added alongside the untouched legacy one — must RED, naming
    // the new entry, while the legacy one stays shielded.
    const newUnpinned = { digest: 'sha256:' + 'c'.repeat(64), source_url: 'https://new.example.gov', retrieved_at: '2026-08-27', clause_path: '(new)' };
    const withNewCitation = { ...baseNode, description: 'after', cited_clause_digest: [legacyEntry, newUnpinned] };
    writeFileSync(nodePath, JSON.stringify(withNewCitation, null, 2) + '\n');
    {
      const fileText = readFileSync(nodePath, 'utf8');
      const scope = changedLineSet(workDir, 'chaingraph/graph/nodes/art-fixture.json', 'origin/main');
      const node = JSON.parse(fileText);
      const { ok: pass, reasons } = validateNode(node, REGISTRY, { isPreExisting: makeIsPreExisting(fileText, scope) });
      ok(!pass, '(i) adding a NEW unregistered citation turns the gate RED');
      ok(reasons.length === 1, `(i) exactly ONE reason reported (the new entry only, not the shielded legacy one) — got ${reasons.length}`);
      ok(reasons.some((r) => r.includes(newUnpinned.digest)), '(i) the failing reason names the NEW digest, not the legacy one');
      ok(!reasons.some((r) => r.includes(legacyEntry.digest)), '(i) the legacy (shielded) digest is NOT named in any failure reason');
    }

    // (iii) fail-closed: an UNDETERMINABLE base ref must never exempt anything — the legacy entry
    // that was GREEN under a resolvable shield goes RED again when the comparison itself cannot be
    // trusted. This is the mutation-of-the-shield control: break diff-scoping, prove it fails CLOSED.
    {
      const fileText = readFileSync(nodePath, 'utf8'); // still the withNewCitation content on disk
      const undeterminedScope = changedLineSet(workDir, 'chaingraph/graph/nodes/art-fixture.json', null);
      ok(undeterminedScope.ok === false, '(iii) an unresolvable base ref reports ok:false (undeterminable)');
      const node = JSON.parse(fileText);
      const { ok: pass, reasons } = validateNode(node, REGISTRY, { isPreExisting: makeIsPreExisting(fileText, undeterminedScope) });
      ok(!pass, '(iii) FAIL CLOSED: with an undeterminable diff, NOTHING is shielded — even the legacy entry now fails');
      ok(reasons.some((r) => r.includes(legacyEntry.digest)), '(iii) the previously-shielded legacy digest is named once shielding cannot be trusted');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

log('— TOUCHTAX-DIFFSCOPE-1: ABSENT-KEY shielding — the REGZ-CORRECTION-APPLY-1 (#1502) shape —');
{
  const rel = (f) => f.replace(/\\/g, '/');
  const root = mkdtempSync(join(tmpdir(), 'cdg-abskey-'));
  try {
    const originDir = join(root, 'origin.git');
    const workDir = join(root, 'work');
    git(root, ['init', '--bare', '-q', '-b', 'main', originDir]);
    git(root, ['clone', '-q', originDir, workDir]);
    git(workDir, ['config', 'user.email', 't@t.test']);
    git(workDir, ['config', 'user.name', 't']);
    mkdirSync(join(workDir, 'chaingraph', 'graph', 'nodes'), { recursive: true });

    const nodePath = join(workDir, 'chaingraph', 'graph', 'nodes', 'art-regz-fixture.json');
    // standards_basis was NEVER declared — matches REGZ-CORRECTION-APPLY-1's own check-off: "written,
    // tested, REVERTED because digests must resolve ... out of fence". No `standards_basis` key at all.
    const baseNode = { tool_id: 'art-regz-fixture', threshold_2024: 1305, description: 'before' };
    writeFileSync(nodePath, JSON.stringify(baseNode, null, 2) + '\n');
    git(workDir, ['add', '-A']);
    git(workDir, ['commit', '-q', '-m', 'base: node with NO standards_basis key at all']);
    git(workDir, ['push', '-q', 'origin', 'HEAD:main']);
    git(workDir, ['fetch', '-q', 'origin']);

    // The REGZ diff: correct a real threshold value elsewhere in the file. standards_basis stays
    // entirely absent — before AND after. This must NOT newly demand a declaration.
    const corrected = { ...baseNode, threshold_2024: 1309 };
    writeFileSync(nodePath, JSON.stringify(corrected, null, 2) + '\n');
    {
      const fileText = readFileSync(nodePath, 'utf8');
      const scope = changedLineSet(workDir, 'chaingraph/graph/nodes/art-regz-fixture.json', 'origin/main');
      const originFileText = readOriginFileText('origin/main', 'chaingraph/graph/nodes/art-regz-fixture.json', workDir);
      const node = JSON.parse(fileText);
      const { ok: pass, reasons, shieldedGap } = validateNode(node, REGISTRY, { isPreExisting: makeIsPreExisting(fileText, scope, originFileText) });
      ok(pass, 'a node whose standards_basis key was NEVER present (absent before AND after this diff) is NOT newly gated by an unrelated field correction — the REGZ #1502 shape');
      ok(shieldedGap === true, 'reported as a shielded pre-existing gap, not a pass-by-accident');
      ok(reasons.length === 0, 'zero reasons — nothing to report as a failure');
    }

    // Control: if the key is genuinely NEW (this diff is the FIRST time it appears, with an invalid
    // value), it must still fail — the absent-key shield never covers a real regression the other
    // direction (someone declaring a bad basis for the first time).
    const withNewBadBasis = { ...corrected, standards_basis: 'yes_probably' };
    writeFileSync(nodePath, JSON.stringify(withNewBadBasis, null, 2) + '\n');
    {
      const fileText = readFileSync(nodePath, 'utf8');
      const scope = changedLineSet(workDir, 'chaingraph/graph/nodes/art-regz-fixture.json', 'origin/main');
      const originFileText = readOriginFileText('origin/main', 'chaingraph/graph/nodes/art-regz-fixture.json', workDir);
      const node = JSON.parse(fileText);
      const { ok: pass, reasons } = validateNode(node, REGISTRY, { isPreExisting: makeIsPreExisting(fileText, scope, originFileText) });
      ok(!pass, 'a NEWLY added (this diff) invalid standards_basis value still fails — the absent-key shield only covers absence that was ALREADY absence');
      ok(reasons.some((r) => r.includes('missing or invalid')), 'failure names the invalid-value reason');
    }

    // Control: originFileText null (undeterminable) must fail CLOSED even for the absent-key case.
    {
      const fileText = readFileSync(nodePath, 'utf8');
      const undeterminedScope = changedLineSet(workDir, 'chaingraph/graph/nodes/art-regz-fixture.json', null);
      const node = JSON.parse(fileText);
      const { ok: pass } = validateNode(node, REGISTRY, { isPreExisting: makeIsPreExisting(fileText, undeterminedScope, null) });
      ok(!pass, 'FAIL CLOSED: originFileText null (undeterminable) never shields the absent-key case either');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log(`\n${fail} failure(s) of ${out.filter((s) => s.startsWith('✓') || s.startsWith('✗')).length} assertion(s).`);
process.exit(fail ? 1 : 0);

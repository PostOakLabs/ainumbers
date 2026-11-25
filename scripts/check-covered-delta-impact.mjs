#!/usr/bin/env node
// check-covered-delta-impact.mjs — COVERED-DELTA-IMPACT-1 (2026-11-24). ADVISORY.
//
// WHY. Two COVERED entries added to scripts/derived-artifacts.mjs on 2026-11-24 broke downstream
// consumers that no PR-side gate exercises, and their vets missed it:
//   * PROOFLINKS-GEN-1 (#3208) writes a block INSIDE node pages a PR authors, but was not added to
//     scripts/ci/pr-sync-main.mjs PER_PR_PAGE_PATCHERS. Result: 17 PR Autofix main failures, and
//     every main sync left kernel PRs red on dead proof-links.
//   * REGEN-QUARANTINE-PRUNE-1 (#3282) was placed after debt-ledger, but gen-debt-ledger reads every
//     `*-quarantine.json`, so `derived-artifacts --verify` failed "NOT a fixpoint" on every main regen
//     (fix #3298). Its artifact also became a main-only path that check-main-only-paths refuses on every
//     PR, which removed the §18 quarantine route for re-prove PRs.
//
// WHAT. Compares COVERED at a base ref with COVERED at HEAD and, for every added / removed / changed /
// moved entry, prints four impact sections:
//   1 MAIN-ONLY   paths that become refused / stop being refused on a PR (check-main-only-paths.mjs's
//                 own classify(), imported, run on both versions). FLAG when a newly refused path
//                 already existed on the base ref (PRs used to edit it; that route is now closed).
//   2 PR-SYNC     the delta of pr-sync-main.mjs mainOwnedPaths(), and a FLAG when an entry writes into a
//                 PR-authored page (chaingraph/**/*.html, tools/*.html, guides/*.html) or a PR-authored
//                 tree but is not in PER_PR_PAGE_PATCHERS (the #3208 class).
//   3 ORDER       a FLAG when the order cannot reach a fixpoint in one pass: an entry that runs BEFORE
//                 this one reads this one's artifacts (the #3282 class), or this entry reads the
//                 artifacts of one that runs after it. Inputs come from a declared `reads` / `inputs`
//                 field when present; else from the entry's regen script (plus its relative imports):
//                 literal artifact paths / basenames and extension-anchored regex literals.
//   4 READERS     scripts/check-*.mjs and scripts/preflight.mjs files that mention the entry's artifacts,
//                 i.e. the PR-side gates that read them.
//
// ADVISORY: exit 0 always unless --strict (FLAGs exit 1). Nothing is written to the repo. The order check
// is a heuristic over script text, so a FLAG is a "go look", never a proof.
//
// Usage:
//   node scripts/check-covered-delta-impact.mjs                       # merge-base(origin/main, HEAD) vs HEAD
//   node scripts/check-covered-delta-impact.mjs --base <ref> --head <ref>
//   node scripts/check-covered-delta-impact.mjs --strict              # exit 1 on any FLAG
//   node scripts/check-covered-delta-impact.mjs --run-fixpoint --scratch <new abs dir>
//                                                                     # opt-in: regen twice in a scratch
//                                                                     # detached worktree of --head
//   node scripts/check-covered-delta-impact.mjs --self-test
//
// Silent (no output, exit 0) when COVERED is byte-for-byte unchanged between the two refs.

import { readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gitEnv } from './_git-env-lib.mjs';
import { classify, REGION_WRITER_IDS } from './check-main-only-paths.mjs';
import { mainOwnedPaths, PER_PR_PAGE_PATCHERS, BROAD_PREFIX_ENTRIES, SENTINEL_PATCHER } from './ci/pr-sync-main.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const DA = 'scripts/derived-artifacts.mjs';

// Pages a PR authors itself; an entry that rewrites one generated block inside them is a per-PR patcher.
const PR_PAGE_RES = [/^chaingraph\/.+\.html$/, /^tools\/[^/]+\.html$/, /^guides\/[^/]+\.html$/];
// Bare-tree artifacts that PRs author into.
const PR_TREES = new Set(['tools', 'chaingraph', 'guides', 'manifests']);

function git(args, cwd = REPO) {
  const r = spawnSync('git', args, { cwd, env: gitEnv(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout ?? '').replace(/\s+$/, ''), err: (r.stderr ?? '').trim() };
}

// ── loading COVERED at a ref ────────────────────────────────────────────────────────────────────
// The module is copied next to the live one so its relative imports (gen-* helpers that compute page
// lists) resolve against the current checkout, then imported and deleted.
async function loadCovered(ref) {
  let src;
  if (ref === 'WORKTREE') src = readFileSync(join(REPO, DA), 'utf8');
  else {
    const g = git(['show', `${ref}:${DA}`]);
    if (!g.ok) throw new Error(`git show ${ref}:${DA} failed: ${g.err}`);
    src = g.out + '\n';
  }
  const tmp = join(HERE, `.covered-delta-${process.pid}-${createHash('sha1').update(ref).digest('hex').slice(0, 8)}.mjs`);
  writeFileSync(tmp, src);
  try {
    const mod = await import(pathToFileURL(tmp).href);
    if (!Array.isArray(mod.COVERED)) throw new Error(`${ref}:${DA} exports no COVERED array`);
    return JSON.parse(JSON.stringify(mod.COVERED));
  } finally {
    try { rmSync(tmp, { force: true }); } catch { /* best effort */ }
  }
}

// ── pure analysis ───────────────────────────────────────────────────────────────────────────────

const isDirPath = (p) => p.endsWith('/') || !/\.[A-Za-z0-9]+$/.test(basename(p));
const declaredInputs = (e) => [...(e.reads || []), ...(e.inputs || [])];

/** check-main-only-paths' classify(), tolerant of ids the other version lacks (drift guard is for the gate). */
function safeClassify(covered, classifyFn) {
  const have = new Set(covered.map((c) => c.id));
  const pad = [...REGION_WRITER_IDS, 'counts', 'stats'].filter((id) => !have.has(id)).map((id) => ({ id, artifacts: [] }));
  try { return { sets: classifyFn([...covered, ...pad]) }; } catch (e) { return { sets: null, error: e.message }; }
}

/** Pull extension-anchored regex literals out of script text (crude; wrong ones are filtered by test()). */
function regexLiterals(text) {
  const out = [];
  const re = /(?<![\w)\]\/<])\/((?![*\/])(?:\\.|\[(?:\\.|[^\]\n])*\]|[^\/\n\\\[])+)\/([dgimsuvy]*)/g;
  let m;
  while ((m = re.exec(text))) {
    const src = m[1];
    if (!/\\\.(json|html|md|mjs|js|txt|py)/.test(src)) continue;
    // Require a distinctive literal word, so a bare /\.json$/ does not match every json artifact.
    if (!/[A-Za-z]{5,}/.test(src.replace(/\\\.(json|html|md|mjs|js|txt|py)/g, ''))) continue;
    try { out.push(new RegExp(src, m[2].replace(/[gy]/g, ''))); } catch { /* not a regex */ }
  }
  return out;
}

/** Script paths named in a regen/gate command. */
const scriptsOf = (cmd) => [...String(cmd || '').matchAll(/(?:^|\s)((?:\.\/)?[\w./-]+\.(?:mjs|js|py))\b/g)].map((m) => m[1].replace(/^\.\//, ''));

/** Text of an entry's regen script plus the relative modules it imports (one level). */
function scriptCorpus(entry, readText) {
  const texts = [];
  for (const s of scriptsOf(entry.regen)) {
    const t = readText(s);
    if (t == null) continue;
    texts.push(t);
    for (const m of t.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+\.(?:mjs|js))['"]/g)) {
      const rel = join(dirname(s), m[1]).replace(/\\/g, '/');
      const it = readText(rel);
      if (it != null) texts.push(it);
    }
  }
  return texts;
}

/** Which of `artifacts` does this entry read (declared reads/inputs, else script text). */
function readsOf(entry, artifacts, readText, cache) {
  const hits = [];
  const declared = declaredInputs(entry);
  const key = entry.id;
  if (!cache.has(key)) {
    const texts = scriptCorpus(entry, readText);
    cache.set(key, { joined: texts.join('\n'), res: texts.flatMap(regexLiterals) });
  }
  const { joined, res } = cache.get(key);
  for (const a of artifacts) {
    const bare = a.replace(/\/+$/, '');
    if (declared.includes(a) || declared.includes(bare)) { hits.push(`${a} (declared input)`); continue; }
    if (!joined) continue;
    if (joined.includes(bare)) { hits.push(a); continue; }
    if (isDirPath(a)) continue;
    const b = basename(a);
    if (b.length >= 10 && joined.includes(b)) { hits.push(`${a} (by file name)`); continue; }
    const rx = res.find((r) => r.test(a) || r.test(b));
    if (rx) hits.push(`${a} (matches ${rx})`);
  }
  return hits;
}

/**
 * Pure analysis of two COVERED arrays. deps (all injectable for the self-test):
 *   classifyFn(covered), mainOwnedFn(covered), patchers:Set, broad:Set, regionIds:Set,
 *   readText(path)->string|null, existsInBase(path)->bool, corpus: Map(file->text) for check 4.
 */
export function analyze(base, head, deps) {
  const d = {
    classifyFn: (c) => classify(c), mainOwnedFn: mainOwnedPaths, patchers: PER_PR_PAGE_PATCHERS, broad: BROAD_PREFIX_ENTRIES,
    regionIds: REGION_WRITER_IDS, readText: () => null, existsInBase: () => false, corpus: new Map(), ...deps,
  };
  const bm = new Map(base.map((e, i) => [e.id, { e, i }]));
  const hm = new Map(head.map((e, i) => [e.id, { e, i }]));
  const added = head.filter((e) => !bm.has(e.id)).map((e) => e.id);
  const removed = base.filter((e) => !hm.has(e.id)).map((e) => e.id);
  const changed = head.filter((e) => bm.has(e.id) && JSON.stringify(bm.get(e.id).e) !== JSON.stringify(e)).map((e) => e.id);
  const cb = base.map((e) => e.id).filter((id) => hm.has(id));
  const ch = head.map((e) => e.id).filter((id) => bm.has(id));
  const moved = ch.filter((id, i) => cb[i] !== id && cb.indexOf(id) !== i).filter((id) => !changed.includes(id));
  const res = { changed: added.length + removed.length + changed.length + moved.length > 0, added, removed, changedIds: changed, moved, notes: [], flags: [], sections: [] };
  if (!res.changed) return res;

  const touched = [...added, ...changed];                       // entries that exist at head and differ
  const touchedEntries = touched.map((id) => hm.get(id).e);
  const newArtifacts = (e) => {
    const old = new Set(bm.has(e.id) ? bm.get(e.id).e.artifacts || [] : []);
    return (e.artifacts || []).filter((a) => !old.has(a));
  };
  const flag = (section, id, msg) => res.flags.push({ section, id, msg });
  const sec = (title, lines) => res.sections.push({ title, lines });

  // 1 MAIN-ONLY
  {
    const lines = [];
    const b = safeClassify(base, d.classifyFn), h = safeClassify(head, d.classifyFn);
    if (!b.sets || !h.sets) lines.push(`classification unavailable (${b.error || h.error}); skipped`);
    else {
      const refusedOf = (s) => new Set([...s.whole, ...s.sentinel]);
      const rb = refusedOf(b.sets), rh = refusedOf(h.sets);
      const newly = [...rh].filter((p) => !rb.has(p)).sort();
      const freed = [...rb].filter((p) => !rh.has(p)).sort();
      for (const p of newly) {
        if (d.existsInBase(p)) {
          lines.push(`FLAG  now refused on every PR: ${p} (exists on the base ref, so PRs could edit it before; that route is closed)`);
          flag(1, '', `${p} becomes main-only but already existed on the base ref (a route PRs used is now refused by check-main-only-paths)`);
        } else lines.push(`note  now refused on every PR: ${p} (new file)`);
      }
      for (const p of freed) lines.push(`note  no longer refused on a PR: ${p}`);
      if (!newly.length && !freed.length) lines.push('no change to the refused set');
    }
    sec('1 Main-only delta (check-main-only-paths classification)', lines);
  }

  // 2 PR-SYNC
  {
    const lines = [];
    const mb = d.mainOwnedFn(base), mh = d.mainOwnedFn(head);
    const ex = [...mh.exact].filter((p) => !mb.exact.has(p)), exGone = [...mb.exact].filter((p) => !mh.exact.has(p));
    const px = mh.prefixes.filter((p) => !mb.prefixes.includes(p)), pxGone = mb.prefixes.filter((p) => !mh.prefixes.includes(p));
    const sample = (a) => a.slice(0, 5).join(', ') + (a.length > 5 ? `, ... (+${a.length - 5})` : '');
    if (!ex.length && !exGone.length && !px.length && !pxGone.length) lines.push('pr-sync mainOwnedPaths unchanged');
    else {
      if (ex.length) lines.push(`note  mainOwnedPaths +${ex.length} exact (a PR sync takes main's side outright): ${sample(ex)}`);
      if (exGone.length) lines.push(`note  mainOwnedPaths -${exGone.length} exact: ${sample(exGone)}`);
      if (px.length) lines.push(`note  mainOwnedPaths +${px.length} prefix: ${px.join(', ')}`);
      if (pxGone.length) lines.push(`note  mainOwnedPaths -${pxGone.length} prefix: ${pxGone.join(', ')}`);
    }
    for (const e of touchedEntries) {
      if (d.patchers.has(e.id) || d.broad.has(e.id) || e.id === SENTINEL_PATCHER) continue;
      const arts = e.artifacts || [];
      const pages = arts.filter((a) => PR_PAGE_RES.some((r) => r.test(a)));
      const trees = arts.filter((a) => PR_TREES.has(a.replace(/\/+$/, '')) && e.writesReport);
      if (!pages.length && !trees.length) continue;
      const region = d.regionIds.has(e.id) ? ' It is a declared region writer in check-main-only-paths (high confidence).' : '';
      const what = pages.length ? `${pages.length} PR-authored page(s) (${sample(pages)})` : `the PR-authored tree(s) ${trees.join(', ')}`;
      const msg = `'${e.id}' writes into ${what} but is not in PER_PR_PAGE_PATCHERS / BROAD_PREFIX_ENTRIES in scripts/ci/pr-sync-main.mjs, so a main sync takes main's side of whole PR pages or leaves them stale (the #3208 class). Ignore only if the entry owns each page outright.${region}`;
      lines.push(`FLAG  ${msg}`);
      flag(2, e.id, msg);
    }
    sec('2 PR-sync delta (scripts/ci/pr-sync-main.mjs)', lines);
  }

  // 3 ORDER / FIXPOINT
  {
    const lines = [];
    const cache = new Map();
    for (const e of touchedEntries) {
      const arts = newArtifacts(e);
      const i = hm.get(e.id).i;
      if (!arts.length && !declaredInputs(e).length) continue;
      const checked = [];
      for (let j = 0; j < head.length; j++) {
        if (j === i || head[j].id === e.id) continue;
        const o = head[j];
        if (j < i && arts.length) {
          const hits = readsOf(o, arts, d.readText, cache);
          checked.push(o.id);
          if (hits.length) {
            const msg = `'${o.id}' (position ${j}) runs BEFORE '${e.id}' (position ${i}) but reads its artifact(s): ${hits.slice(0, 3).join('; ')}. One regen pass cannot reach a fixpoint; move '${e.id}' before '${o.id}' or declare the dependency (the #3282 class).`;
            lines.push(`FLAG  ${msg}`);
            flag(3, e.id, msg);
          }
        } else if (j > i) {
          const hits = readsOf(e, o.artifacts || [], d.readText, cache);
          if (hits.length) {
            const msg = `'${e.id}' (position ${i}) reads artifact(s) written by '${o.id}' (position ${j}), which runs AFTER it: ${hits.slice(0, 3).join('; ')}. It sees the previous pass's bytes.`;
            lines.push(`FLAG  ${msg}`);
            flag(3, e.id, msg);
          }
        }
      }
      if (!lines.some((l) => l.includes(`'${e.id}'`))) lines.push(`ok    '${e.id}': no entry ordered against it reads its artifacts / it reads no later entry's artifacts (heuristic over script text)`);
    }
    if (moved.length) lines.push(`note  reordered without other change: ${moved.join(', ')} (re-run: node scripts/derived-artifacts.mjs --verify)`);
    if (!touchedEntries.length && !moved.length) lines.push('no added or changed entry to order-check');
    sec('3 Order / fixpoint', lines);
  }

  // 4 READERS
  {
    const lines = [];
    for (const e of touchedEntries) {
      const arts = newArtifacts(e).filter((a) => !isDirPath(a)).slice(0, 400);
      if (!arts.length) continue;
      const ownGate = scriptsOf(e.gate).concat(scriptsOf(e.regen)).map((s) => basename(s));
      const found = [];
      for (const [file, text] of d.corpus) {
        const hit = arts.filter((a) => text.includes(a));
        if (hit.length) found.push(`${file}${ownGate.includes(basename(file)) ? ' (its own gate/regen)' : ''} [${hit.slice(0, 2).join(', ')}${hit.length > 2 ? ', ...' : ''}]`);
      }
      lines.push(found.length ? `'${e.id}' artifacts are read by ${found.length} PR-side script(s): ${found.join('; ')}` : `'${e.id}': no scripts/check-*.mjs or preflight.mjs mentions its artifacts`);
    }
    if (!lines.length) lines.push('no added or changed file artifacts');
    sec('4 Readers (scripts/check-*.mjs, scripts/preflight.mjs)', lines);
  }
  return res;
}

export function render(res) {
  if (!res.changed) return [];
  const out = [];
  const fmt = (label, a) => a.length && out.push(`${label}: ${a.join(', ')}`);
  out.push('COVERED delta impact (advisory)');
  fmt('  added', res.added); fmt('  removed', res.removed); fmt('  changed', res.changedIds); fmt('  moved', res.moved);
  for (const s of res.sections) { out.push(`\n[${s.title}]`); for (const l of s.lines) out.push(`  ${l}`); }
  out.push(res.flags.length ? `\n${res.flags.length} FLAG(s). Advisory: exit 0 unless --strict.` : '\nno FLAGs.');
  return out;
}

// ── real-world dependencies ────────────────────────────────────────────────────────────────────

function realDeps(baseRef) {
  const corpus = new Map();
  const dir = join(REPO, 'scripts');
  for (const f of readdirSync(dir)) {
    if (f === 'check-covered-delta-impact.mjs') continue; // this tool's own fixtures name paths
    if (/^check-.*\.mjs$/.test(f) || f === 'preflight.mjs') corpus.set(`scripts/${f}`, readFileSync(join(dir, f), 'utf8'));
  }
  return {
    readText: (p) => { const f = join(REPO, p); return existsSync(f) ? readFileSync(f, 'utf8') : null; },
    existsInBase: (p) => git(['cat-file', '-e', `${baseRef}:${p}`]).ok,
    corpus,
  };
}

// ── opt-in fixpoint run ────────────────────────────────────────────────────────────────────────

function runFixpoint(headRef, scratch) {
  if (!scratch || !/^([A-Za-z]:)?[\\/]/.test(scratch)) return { error: '--run-fixpoint needs --scratch <absolute path of a NEW directory under the workspace .wt/>' };
  if (existsSync(scratch)) return { error: `--scratch ${scratch} already exists; refusing to reuse it` };
  const add = git(['worktree', 'add', '--detach', scratch, headRef === 'WORKTREE' ? 'HEAD' : headRef]);
  if (!add.ok) return { error: `git worktree add failed: ${add.err}` };
  const snap = () => {
    const st = git(['status', '--porcelain', '--untracked-files=all'], scratch).out.split('\n').filter(Boolean).sort();
    return new Map(st.map((l) => { const p = l.slice(3); const f = join(scratch, p); return [p, existsSync(f) ? createHash('sha1').update(readFileSync(f)).digest('hex') : 'deleted']; }));
  };
  try {
    const run = () => spawnSync('node', ['scripts/derived-artifacts.mjs', '--regen'], { cwd: scratch, env: gitEnv(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const r1 = run(); const s1 = snap();
    const r2 = run(); const s2 = snap();
    const diff = [...new Set([...s1.keys(), ...s2.keys()])].filter((p) => s1.get(p) !== s2.get(p)).sort();
    return { pass1Exit: r1.status, pass2Exit: r2.status, pass1Changed: s1.size, pass2Changed: diff };
  } finally {
    git(['worktree', 'remove', '--force', scratch]);
  }
}

// ── self-test ──────────────────────────────────────────────────────────────────────────────────

async function selfTest() {
  let fails = 0;
  const check = (name, ok, detail = '') => { console.log(`${ok ? '  ok ' : '  FAIL'} ${name}${ok || !detail ? '' : ` — ${detail}`}`); if (!ok) fails++; };
  const need = ['counts', 'stats', 'chain-ask-agent', 'hub-scenes', 'node-page-footers', 'root-page-footers', 'mcp-activity-embed',
    'errata-page-regions', 'replay-roll-surface', 'fact-stamps'];
  const baseCov = () => [
    ...need.map((id) => ({ id, artifacts: id === 'node-page-footers' ? ['chaingraph/art-01.html'] : [], regen: `node scripts/gen-${id}.mjs` })),
    { id: 'debt-ledger', artifacts: ['fv-explainer.html'], regen: 'node scripts/gen-debt-ledger.mjs --write' },
  ];
  const classifyFn = (c) => classify(c, (p) => p.endsWith('/'), []);
  const texts = new Map([
    ['scripts/gen-debt-ledger.mjs', "const RATCHET_NAME_RE = /(-baseline|-allowlist|-quarantine)\\.json$/i;\nimport { x } from './lib/y.mjs';"],
    ['scripts/lib/y.mjs', 'export const x = 1;'],
  ]);
  const deps = { classifyFn, readText: (p) => texts.get(p) ?? null, existsInBase: () => false, corpus: new Map() };

  console.log('case A: unchanged COVERED is silent');
  {
    const r = analyze(baseCov(), baseCov(), deps);
    check('changed=false', r.changed === false);
    check('renders nothing', render(r).length === 0);
    check('no flags', r.flags.length === 0);
  }

  console.log('case B: #3208 shape (region writer into node pages, not a PER_PR_PAGE_PATCHER)');
  {
    const head = [...baseCov(), { id: 'brand-new-page-block', artifacts: ['chaingraph/art-01.html', 'chaingraph/art-02.html'], regen: 'node scripts/gen-new-block.mjs' }];
    const r = analyze(baseCov(), head, { ...deps, regionIds: new Set([...REGION_WRITER_IDS, 'brand-new-page-block']) });
    const f2 = r.flags.filter((f) => f.section === 2 && f.id === 'brand-new-page-block');
    check('flag 2 raised for the new entry', f2.length === 1, JSON.stringify(r.flags));
    check('flag 2 names PER_PR_PAGE_PATCHERS and region-writer confidence', /PER_PR_PAGE_PATCHERS/.test(f2[0]?.msg || '') && /high confidence/.test(f2[0]?.msg || ''));
    const ok = analyze(baseCov(), head, { ...deps, patchers: new Set([...PER_PR_PAGE_PATCHERS, 'brand-new-page-block']) });
    check('flag 2 cleared once the id is a patcher', ok.flags.filter((f) => f.section === 2).length === 0);
    check('no section-1 flag (new file, region)', r.flags.filter((f) => f.section === 1).length === 0);
  }

  console.log('case C: #3282 shape (whole-file artifact PRs edited, placed after a reader of it)');
  {
    const head = [...baseCov(), { id: 'recompute-quarantine-prune', artifacts: ['scripts/recompute-equality-quarantine.json'], regen: 'node scripts/prune-recompute-quarantine.mjs', after: 'debt-ledger' }];
    const r = analyze(baseCov(), head, { ...deps, existsInBase: (p) => p === 'scripts/recompute-equality-quarantine.json' });
    const f1 = r.flags.filter((f) => f.section === 1), f3 = r.flags.filter((f) => f.section === 3);
    check('flag 1: newly main-only path that existed on base', f1.length === 1 && /recompute-equality-quarantine\.json/.test(f1[0].msg), JSON.stringify(r.flags));
    check('flag 3: debt-ledger (earlier) reads it via its -quarantine.json regex', f3.length === 1 && /debt-ledger/.test(f3[0].msg), JSON.stringify(f3));
    check('no flag 2 (json artifact, not a page)', r.flags.filter((f) => f.section === 2).length === 0);
    const fixed = [...baseCov().filter((e) => e.id !== 'debt-ledger')];
    fixed.push({ id: 'recompute-quarantine-prune', artifacts: ['scripts/recompute-equality-quarantine.json'], regen: 'node scripts/prune-recompute-quarantine.mjs' });
    fixed.push(baseCov().find((e) => e.id === 'debt-ledger'));
    const r2 = analyze(baseCov(), fixed, { ...deps, existsInBase: () => false });
    check('placed before the reader: flag 3 is now the reverse direction only if it reads later artifacts, none here', r2.flags.filter((f) => f.section === 3).length === 0, JSON.stringify(r2.flags));
    const out = render(r).join('\n');
    check('render lists both flags and all four sections', /\[1 Main-only/.test(out) && /\[2 PR-sync/.test(out) && /\[3 Order/.test(out) && /\[4 Readers/.test(out) && /2 FLAG\(s\)/.test(out), out);
  }

  console.log('case D: declared reads, removal, readers');
  {
    const head = [...baseCov(), { id: 'late', artifacts: ['data/late.json'], regen: 'node scripts/late.mjs' }, { id: 'early-decl', artifacts: ['x/y.json'], regen: 'node scripts/none.mjs', reads: ['data/late.json'] }];
    const r = analyze(baseCov(), head.slice(0, -2).concat([head[head.length - 1], head[head.length - 2]]), deps);
    check('declared reads: entry placed before the writer of its input is flagged', r.flags.some((f) => f.section === 3 && /declared input/.test(f.msg)), JSON.stringify(r.flags));
    const rm = analyze(baseCov(), baseCov().filter((e) => e.id !== 'debt-ledger'), deps);
    check('removed entry is reported, no flags', rm.removed.join() === 'debt-ledger' && rm.flags.length === 0);
    const withCorpus = analyze(baseCov(), [...baseCov(), { id: 'late', artifacts: ['data/late.json'], regen: 'node scripts/late.mjs' }],
      { ...deps, corpus: new Map([['scripts/check-late.mjs', 'readFileSync("data/late.json")'], ['scripts/check-other.mjs', 'nothing']]) });
    check('readers: lists the scripts that mention the artifact', /check-late\.mjs/.test(JSON.stringify(withCorpus.sections[3].lines)) && !/check-other/.test(JSON.stringify(withCorpus.sections[3].lines)));
    const mv = baseCov(); const [a, b] = [mv.length - 2, mv.length - 1]; [mv[a], mv[b]] = [mv[b], mv[a]];
    const rmv = analyze(baseCov(), mv, deps);
    check('pure reorder is reported as moved', rmv.changed && rmv.moved.length > 0, JSON.stringify(rmv.moved));
  }

  console.log('case E: live COVERED loads at HEAD and is self-consistent');
  {
    const live = await loadCovered('HEAD');
    check('HEAD COVERED loads', Array.isArray(live) && live.length > 10, String(live?.length));
    const r = analyze(live, live, deps);
    check('HEAD vs HEAD is silent', !r.changed);
  }

  if (fails) { console.error(`check-covered-delta-impact self-test: ${fails} check(s) FAILED`); process.exit(1); }
  console.log('check-covered-delta-impact self-test: all checks passed');
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────

const invokedAsMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) {
  const argv = process.argv.slice(2);
  const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
  if (argv.includes('--self-test')) { await selfTest(); process.exit(0); }
  const strict = argv.includes('--strict');
  const headRef = val('--head') || 'HEAD';
  let baseRef = val('--base');
  try {
    if (!baseRef) {
      const mb = git(['merge-base', 'origin/main', headRef === 'WORKTREE' ? 'HEAD' : headRef]);
      if (!mb.ok || !mb.out) { console.log(`check-covered-delta-impact: no merge-base with origin/main (${mb.err || 'empty'}); nothing to compare (advisory).`); process.exit(0); }
      baseRef = mb.out;
    }
    const [base, head] = [await loadCovered(baseRef), await loadCovered(headRef)];
    const res = analyze(base, head, realDeps(baseRef));
    for (const l of render(res)) console.log(l);
    if (argv.includes('--run-fixpoint') && res.changed) {
      const fp = runFixpoint(headRef, val('--scratch'));
      if (fp.error) console.log(`\n[fixpoint run] not run: ${fp.error}`);
      else {
        console.log(`\n[fixpoint run] pass1 exit ${fp.pass1Exit} (${fp.pass1Changed} changed path(s)); pass2 exit ${fp.pass2Exit}`);
        if (fp.pass2Changed.length) {
          console.log(`FLAG  pass 2 changed ${fp.pass2Changed.length} path(s): the regen is NOT a fixpoint: ${fp.pass2Changed.slice(0, 10).join(', ')}`);
          res.flags.push({ section: 3, id: '', msg: 'fixpoint run: pass 2 changed files' });
        } else console.log('ok    pass 2 changed nothing: fixpoint reached');
      }
    }
    process.exit(strict && res.flags.length ? 1 : 0);
  } catch (e) {
    // Advisory: a tool failure must not block anyone, but it must not look like a clean result either.
    console.log(`check-covered-delta-impact: could not run (${e.message}); NO result (advisory).`);
    process.exit(strict ? 1 : 0);
  }
}

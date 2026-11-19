// scripts/check-obligation-coverage.mjs — obligation map gates O1, O2 and O4.
//
// Row OBLIGATION-SCHEMA-1-RESUME-1 (2026-11-15). Spec: the obligation-map build
// spec sections 3 to 6 (workspace research; never cited in public text).
// Re-pin flow in O4: row OBLIGATION-REPIN-1 (2026-11-17).
//
// What this gate family claims and does not claim:
//   It claims a vector exists that exercises an obligation. It never claims a
//   kernel implements the obligation correctly; correctness stays with the
//   audits, the proof and the clause-binding lane.
//
// Artifacts it reads (all sidecars; no kernel, fixture or golden byte moves):
//   chaingraph/obligations/<digest-hex>.json      obligation list (per clause digest)
//   chaingraph/obligations/coverage/<node>.json   coverage file (per node)
//   chaingraph/obligations/o4-baseline.json       digests allowed to lack a list, with a reason
//   chaingraph/graph/nodes/*.json                 node shards (cited_clause_digest)
//   chaingraph/kernels/fixtures/<node>.fixtures.json  vector names + expected outputs
//
// Gates:
//   O1  a list is well formed: spans in range for excerpt_bytes, no overlap,
//       unique ids, reviewer differs from splitter.
//   O2  coverage is real: every named vector exists in the node's fixtures and
//       its expected verdict class matches the side it is listed on (the
//       expectedVerdictClass reader below; the first shared verdict reader in
//       the repo, shipped here because no fail-open classifier existed on main
//       to reuse).
//   O4  stale lists: a citing node whose cited digest has neither a list nor a
//       baseline entry; a baseline entry whose digest now has a list (baseline
//       only shrinks); a coverage file naming a digest the node no longer
//       cites; a baseline entry no node cites. Re-pin flow (row
//       OBLIGATION-REPIN-1): when a clause digest changes, the old list does
//       not carry over silently; the gate prints the old obligation list
//       beside the digest the node now cites and requires a fresh split.
//       NOT in scope here: O3 (nothing uncovered; advisory later), O5 (span
//       bytes; needs the local excerpt), O6 (page agreement; the page block is
//       a later row).
//
// Exit 0 green, 1 any red. Selftest: scripts/check-obligation-coverage.selftest.mjs
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const hex = (d) => String(d).replace(/^sha256:/, '');
const KINDS = ['condition', 'threshold', 'exception', 'definition', 'procedure', 'deadline'];

// ── shared verdict reader ────────────────────────────────────────────────────
// The estate's first shared expected-verdict classifier, in the vocabulary the
// missing-input fail-open sweep fixed: positive, negative, refusal. A vector's
// class comes from its own expected output_payload, never from a re-run.
//   1. refusal markers in the payload win (hash_refusal, refused, or a
//      status/error field whose value reads refused/refusal/error).
//   2. an explicit `signal` (dot path into output_payload) decides: truthy is
//      positive, falsy is negative. A path that resolves to nothing returns
//      null so the caller can red a misdeclared signal.
//   3. without a signal, non-empty compliance_flags is positive, empty is
//      negative.
export function expectedVerdictClass(vector, signal) {
  const out = vector && vector.output_payload ? vector.output_payload : {};
  for (const [k, v] of Object.entries(out)) {
    const kl = k.toLowerCase();
    const vl = typeof v === 'string' ? v.toLowerCase() : v;
    if ((kl === 'hash_refusal' || kl === 'refused') && v) return 'refusal';
    if ((kl === 'status' || kl === 'error') && (vl === 'refused' || vl === 'refusal' || vl === 'error')) return 'refusal';
  }
  if (signal !== undefined && signal !== null && signal !== '') {
    let cur = out;
    for (const part of String(signal).split('.')) {
      if (cur === null || typeof cur !== 'object' || !(part in cur)) return null;
      cur = cur[part];
    }
    return cur ? 'positive' : 'negative';
  }
  const flags = Array.isArray(vector && vector.compliance_flags) ? vector.compliance_flags : [];
  return flags.length > 0 ? 'positive' : 'negative';
}

// ── O1: the list is well formed ──────────────────────────────────────────────
export function checkO1(list) {
  const errors = [];
  const bad = (m) => errors.push(m);
  if (!list || typeof list !== 'object' || Array.isArray(list)) { bad('list is not an object'); return errors; }
  if (!DIGEST_RE.test(list.clause_digest || '')) bad(`clause_digest "${list.clause_digest}" is not sha256:<64 hex>`);
  if (!Number.isInteger(list.excerpt_bytes) || list.excerpt_bytes <= 0) bad('excerpt_bytes must be a positive integer');
  for (const f of ['split_by', 'split_at', 'reviewed_by', 'reviewed_at']) {
    if (typeof list[f] !== 'string' || !list[f].trim()) bad(`${f} must be a non-empty string (a split is recorded as judgment)`);
  }
  if (list.split_by && list.reviewed_by && list.split_by === list.reviewed_by) {
    bad(`reviewed_by ("${list.reviewed_by}") must differ from split_by ("${list.split_by}")`);
  }
  const obs = Array.isArray(list.obligations) ? list.obligations : null;
  if (!obs) { bad('obligations must be an array'); return errors; }
  if (obs.length < 3 || obs.length > 25) bad(`obligation count ${obs.length} outside the 3..25 range`);
  const seen = new Set();
  const spans = [];
  for (const o of obs) {
    const id = o && o.id;
    if (typeof id !== 'string' || !/^O[0-9]+$/.test(id)) { bad(`obligation id "${id}" is not O<number>`); continue; }
    if (seen.has(id)) bad(`duplicate obligation id ${id}`);
    seen.add(id);
    if (typeof o.label !== 'string' || o.label.trim().length < 8) bad(`${id}: label must be a non-trivial string`);
    if (!KINDS.includes(o.kind)) bad(`${id}: kind "${o.kind}" not in ${KINDS.join(', ')}`);
    const s = o.span || {};
    for (const k of ['start', 'end']) if (!Number.isInteger(s[k]) || s[k] < 0) bad(`${id}: span.${k} must be a non-negative integer`);
    if (Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= s.end) bad(`${id}: span start ${s.start} >= end ${s.end}`);
    if (Number.isInteger(s.end) && Number.isInteger(list.excerpt_bytes) && s.end > list.excerpt_bytes) {
      bad(`${id}: span end ${s.end} exceeds excerpt_bytes ${list.excerpt_bytes}`);
    }
    if (Number.isInteger(s.start) && Number.isInteger(s.end) && s.start < s.end) spans.push({ id, start: s.start, end: s.end });
  }
  spans.sort((a, b) => a.start - b.start);
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].start < spans[i - 1].end) bad(`span overlap: ${spans[i - 1].id} [${spans[i - 1].start},${spans[i - 1].end}) and ${spans[i].id} [${spans[i].start},${spans[i].end})`);
  }
  return errors;
}

// ── O2: coverage is real ─────────────────────────────────────────────────────
function resolveSignal(out, signal) {
  let cur = out;
  for (const part of String(signal).split('.')) {
    if (cur === null || typeof cur !== 'object' || !(part in cur)) return null;
    cur = cur[part];
  }
  return cur;
}

export function checkO2(cov, fixtures, lists) {
  // lists: Map digest -> obligations array (loaded by the caller; may be partial)
  const errors = [];
  const bad = (m) => errors.push(m);
  if (!cov || typeof cov !== 'object') { bad('coverage is not an object'); return errors; }
  if (typeof cov.node_id !== 'string' || !cov.node_id.trim()) bad('node_id must be a non-empty string');
  const digs = Array.isArray(cov.clause_digests) ? cov.clause_digests : null;
  if (!digs || digs.length === 0) bad('clause_digests must be a non-empty array');
  else for (const d of digs) if (!DIGEST_RE.test(d)) bad(`clause_digests entry "${d}" is not sha256:<64 hex>`);

  const vecByName = new Map();
  if (!fixtures || !Array.isArray(fixtures.vectors)) bad('fixtures file has no vectors array');
  else for (const v of fixtures.vectors) {
    if (vecByName.has(v.name)) bad(`fixtures declare duplicate vector name ${v.name}`);
    vecByName.set(v.name, v);
  }
  const knownIds = new Set();
  for (const d of digs || []) {
    for (const o of (lists && lists.get(d)) || []) knownIds.add(o.id);
  }
  const inCovers = new Set(), inOOS = new Set(), inUncovered = new Set();
  for (const [id, entry] of Object.entries(cov.covers || {})) {
    inCovers.add(id);
    if (!knownIds.has(id)) bad(`covers names ${id}, which is not in any cited digest's obligation list`);
    for (const side of ['accept', 'refuse']) {
      const names = Array.isArray(entry && entry[side]) ? entry[side] : null;
      if (!names) { bad(`covers.${id}.${side} must be an array of vector names`); continue; }
      for (const name of names) {
        const vec = vecByName.get(name);
        if (!vec) { bad(`covers.${id}.${side} names vector "${name}", which does not exist in the node's fixtures`); continue; }
        const cls = expectedVerdictClass(vec, entry.signal);
        if (cls === null) { bad(`covers.${id}.signal "${entry.signal}" does not resolve in vector "${name}" output_payload`); continue; }
        const ok = side === 'accept' ? cls === 'positive' : (cls === 'negative' || cls === 'refusal');
        if (!ok) bad(`covers.${id}.${side} lists "${name}" whose expected verdict class is ${cls}, which does not match the ${side} side`);
      }
    }
  }
  for (const item of Array.isArray(cov.out_of_scope) ? cov.out_of_scope : []) {
    inOOS.add(item.id);
    if (!knownIds.has(item.id)) bad(`out_of_scope names ${item.id}, which is not in any cited digest's obligation list`);
    if (typeof item.reason !== 'string' || item.reason.trim().length < 8) bad(`out_of_scope ${item.id}: a non-trivial reason is required`);
  }
  for (const item of Array.isArray(cov.uncovered) ? cov.uncovered : []) {
    inUncovered.add(item.id);
    if (!knownIds.has(item.id)) bad(`uncovered names ${item.id}, which is not in any cited digest's obligation list`);
    if (typeof item.reason !== 'string' || item.reason.trim().length < 8) bad(`uncovered ${item.id}: a non-trivial reason is required`);
  }
  for (const id of inUncovered) {
    if (inCovers.has(id)) bad(`uncovered lists ${id}, which is also in covers`);
    if (inOOS.has(id)) bad(`uncovered lists ${id}, which is also out_of_scope`);
  }
  for (const id of inCovers) if (inOOS.has(id)) bad(`covers lists ${id}, which is also out_of_scope`);
  return errors;
}

// ── O4: stale lists (estate sweep) ───────────────────────────────────────────
function citedDigestsOfShard(text) {
  let j;
  try { j = JSON.parse(text); } catch { return null; }
  const found = [];
  (function walk(o) {
    if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) {
        if (k === 'cited_clause_digest') [].concat(v).forEach((d) => found.push(typeof d === 'string' ? d : d && d.digest));
        else walk(v);
      }
    }
  })(j);
  return [...new Set(found.filter(Boolean))];
}

// Old-list reader for the re-pin flow: the obligation list file for one
// digest, or null when it is absent or does not parse.
function readListFile(obligationsDir, digest) {
  if (typeof digest !== 'string' || !DIGEST_RE.test(digest)) return null;
  const p = join(obligationsDir, hex(digest) + '.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

// The re-pin flow (row OBLIGATION-REPIN-1): when a clause digest changes, the
// gate prints the old obligation list beside the digest the node now cites and
// requires a fresh split; the old list does not carry over. Labels are our own
// paraphrases (never source text), so the printout is public-safe. Deduped per
// (node, old digest, new digests): the same re-pin prints once even when both
// the unlisted-new-digest red and the stale-coverage red fire for it.
function repinLines(nid, oldDigest, newDigests, oldList, printed) {
  const key = nid + '|' + oldDigest + '|' + [...newDigests].sort().join(',');
  if (printed.has(key)) return [];
  printed.add(key);
  const obs = Array.isArray(oldList && oldList.obligations) ? oldList.obligations : [];
  const news = [...new Set(newDigests)].sort().map((x) => x.slice(7, 15)).join(', ') || '(none)';
  const lines = [`re-pin ${nid}: old list ${oldDigest.slice(7, 15)} (split by ${oldList.split_by || 'unknown'}, reviewed by ${oldList.reviewed_by || 'unknown'}, ${obs.length} obligations) beside new digest ${news}:`];
  for (const o of obs) {
    const s = o && o.span ? o.span : {};
    lines.push(`  re-pin ${nid}: ${o.id || '?'} [${s.start},${s.end}) ${o.kind || '?'}: ${o.label || '(no label)'}`);
  }
  lines.push(`  re-pin ${nid}: the old list does not carry over; write a fresh split for ${news} (scripts/propose-obligation-split.mjs) before the coverage file may name it`);
  return lines;
}

export function checkO4({ nodesDir, obligationsDir, coverageDir, baselinePath }) {
  const errors = [];
  const bad = (m) => errors.push(m);
  const repinsPrinted = new Set();

  const listed = new Set();
  if (existsSync(obligationsDir)) {
    for (const f of readdirSync(obligationsDir)) {
      if (/^[0-9a-f]{64}\.json$/.test(f)) listed.add('sha256:' + f.replace(/\.json$/, ''));
    }
  }
  const baseline = existsSync(baselinePath)
    ? JSON.parse(readFileSync(baselinePath, 'utf8'))
    : {};

  // citation inventory: digest -> [node ids]
  const citedBy = new Map();
  const nodeCites = new Map(); // node id -> Set(digests)
  if (existsSync(nodesDir)) {
    for (const f of readdirSync(nodesDir)) {
      if (!f.endsWith('.json')) continue;
      const digs = citedDigestsOfShard(readFileSync(join(nodesDir, f), 'utf8'));
      if (digs === null) { bad(`node shard ${f} does not parse`); continue; }
      if (!digs.length) continue;
      const nid = f.replace(/\.json$/, '');
      nodeCites.set(nid, new Set(digs));
      for (const d of digs) { if (!citedBy.has(d)) citedBy.set(d, []); citedBy.get(d).push(nid); }
    }
  } else bad(`nodes directory not found: ${nodesDir}`);

  // coverage inventory: read once, used by the stale-coverage sweep and by the
  // re-pin flow under part 1
  const covByNode = new Map(); // node id -> { cov, file }
  if (existsSync(coverageDir)) {
    for (const f of readdirSync(coverageDir)) {
      if (!f.endsWith('.json')) continue;
      let cov;
      try { cov = JSON.parse(readFileSync(join(coverageDir, f), 'utf8')); } catch { bad(`coverage file ${f} does not parse`); continue; }
      covByNode.set(cov.node_id || f.replace(/\.json$/, ''), { cov, file: f });
    }
  }

  // 1. every cited digest is listed or baselined; when the citation is a
  //    re-pin (the node's coverage file still names the old digest), the old
  //    list prints beside the new digest
  for (const [d, nodes] of citedBy) {
    if (!listed.has(d) && !(d in baseline)) {
      bad(`citing node ${nodes[0]} cites ${d.slice(7, 15)} which has no obligation list and no o4-baseline entry (write the list, or add a baseline entry with a reason)`);
      for (const nid of nodes) {
        const hit = covByNode.get(nid);
        const olds = hit && Array.isArray(hit.cov.clause_digests) ? hit.cov.clause_digests.filter((x) => x !== d) : [];
        const oldList = olds.length ? readListFile(obligationsDir, olds[0]) : null;
        if (!oldList) continue;
        errors.push(...repinLines(nid, olds[0], [d], oldList, repinsPrinted));
        break;
      }
    }
  }
  // 2. baseline entries are live: their digest must be cited and unlisted
  for (const [d, reason] of Object.entries(baseline)) {
    if (typeof reason !== 'string' || !reason.trim()) bad(`o4-baseline entry ${d.slice(0, 8)} has no reason`);
    if (listed.has(d)) bad(`stale o4-baseline entry ${d.slice(0, 8)}: an obligation list now exists, remove the entry (the baseline only shrinks)`);
    else if (!citedBy.has(d)) bad(`stale o4-baseline entry ${d.slice(0, 8)}: no node cites this digest any more, remove the entry`);
  }
  // 3. a coverage file may not name a digest its node no longer cites; that is
  //    the re-pin signal, and the old list prints beside the new digest
  for (const [nid, hit] of covByNode) {
    const cites = nodeCites.get(nid);
    if (!cites) { bad(`coverage file ${hit.file} names node ${nid}, which has no shard or cites no digest`); continue; }
    const named = Array.isArray(hit.cov.clause_digests) ? hit.cov.clause_digests : [];
    for (const d of named) {
      if (!cites.has(d)) bad(`stale coverage: ${nid} names ${d.slice(7, 15)} which it no longer cites (a re-pin needs a fresh split, the old list does not carry over)`);
    }
    for (const d of named) {
      if (cites.has(d)) continue;
      const oldList = readListFile(obligationsDir, d);
      if (oldList) errors.push(...repinLines(nid, d, [...cites].filter((x) => x !== d), oldList, repinsPrinted));
    }
  }
  return errors;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function loadListFor(obligationsDir, digest) {
  const p = join(obligationsDir, hex(digest) + '.json');
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    return Array.isArray(j.obligations) ? j.obligations : null;
  } catch { return null; }
}

function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const writeBaseline = argv.includes('--write-baseline');
  const root = argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : REPO_ROOT;
  const obligationsDir = join(root, 'chaingraph', 'obligations');
  const coverageDir = join(obligationsDir, 'coverage');
  const nodesDir = join(root, 'chaingraph', 'graph', 'nodes');
  const fixturesDir = join(root, 'chaingraph', 'kernels', 'fixtures');
  const baselinePath = join(obligationsDir, 'o4-baseline.json');

  let failed = false;
  const red = (gate, m) => { failed = true; console.log(`${gate} RED: ${m}`); };

  // O1 over every list file
  if (!only || only === 'O1') {
    const files = existsSync(obligationsDir) ? readdirSync(obligationsDir).filter((f) => /^[0-9a-f]{64}\.json$/.test(f)) : [];
    if (!files.length) console.log('O1 OK: no obligation lists present (nothing to check)');
    for (const f of files) {
      let list;
      try { list = JSON.parse(readFileSync(join(obligationsDir, f), 'utf8')); } catch (e) { red('O1', `list ${f} does not parse: ${e.message}`); continue; }
      const errs = checkO1(list);
      if (errs.length) errs.forEach((m) => red('O1', `${f.slice(0, 12)}: ${m}`));
      else console.log(`O1 OK: ${f.slice(0, 12)} (${list.obligations.length} obligations, split by ${list.split_by}, reviewed by ${list.reviewed_by})`);
    }
  }

  // O2 over every coverage file
  if (!only || only === 'O2') {
    const files = existsSync(coverageDir) ? readdirSync(coverageDir).filter((f) => f.endsWith('.json')) : [];
    if (!files.length) console.log('O2 OK: no coverage files present (nothing to check)');
    for (const f of files) {
      let cov;
      try { cov = JSON.parse(readFileSync(join(coverageDir, f), 'utf8')); } catch (e) { red('O2', `coverage ${f} does not parse: ${e.message}`); continue; }
      const fxPath = join(fixturesDir, `${cov.node_id}.fixtures.json`);
      let fixtures = null;
      if (existsSync(fxPath)) { try { fixtures = JSON.parse(readFileSync(fxPath, 'utf8')); } catch (e) { red('O2', `fixtures for ${cov.node_id} do not parse: ${e.message}`); continue; } }
      const lists = new Map();
      for (const d of Array.isArray(cov.clause_digests) ? cov.clause_digests : []) {
        const l = loadListFor(obligationsDir, d);
        if (l) lists.set(d, l);
      }
      const errs = checkO2(cov, fixtures, lists);
      if (errs.length) errs.forEach((m) => red('O2', `${f}: ${m}`));
      else console.log(`O2 OK: ${cov.node_id} (${Object.keys(cov.covers || {}).length} covered, ${(cov.out_of_scope || []).length} out of scope, ${(cov.uncovered || []).length} uncovered)`);
    }
  }

  // O4 estate sweep
  if (!only || only === 'O4') {
    if (writeBaseline) {
      // Recompute the baseline: every cited-but-unlisted digest gets (or keeps)
      // an entry; entries for listed or no-longer-cited digests are dropped, so
      // the baseline only shrinks except when a NEW digest is cited, which is
      // the normal flow that a backfill row later replaces with a real list.
      const hexd = (d) => String(d).replace(/^sha256:/, '');
      const listedNow = new Set(existsSync(obligationsDir)
        ? readdirSync(obligationsDir).filter((f) => /^[0-9a-f]{64}\.json$/.test(f)).map((f) => 'sha256:' + f.replace(/\.json$/, ''))
        : []);
      const citedNow = new Set();
      if (existsSync(nodesDir)) {
        for (const f of readdirSync(nodesDir)) {
          if (!f.endsWith('.json')) continue;
          for (const d of citedDigestsOfShard(readFileSync(join(nodesDir, f), 'utf8')) || []) citedNow.add(d);
        }
      }
      const prev = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {};
      const next = {};
      for (const d of citedNow) {
        if (listedNow.has(d)) continue;
        next[d] = typeof prev[d] === 'string' && prev[d].trim() ? prev[d] : 'pending obligation backfill (OBLIGATION-BACKFILL-n)';
      }
      writeFileSync(baselinePath, JSON.stringify(next, Object.keys(next).sort(), 2) + '\n');
      console.log(`O4 baseline written: ${Object.keys(next).length} entries (${Object.keys(prev).length} before)`);
    }
    const errs = checkO4({ nodesDir, obligationsDir, coverageDir, baselinePath });
    if (errs.length) errs.forEach((m) => red('O4', m));
    else console.log(`O4 OK: every cited digest is listed or baselined; baseline entries all live`);
  }

  if (failed) { console.log('check-obligation-coverage: RED'); process.exit(1); }
  console.log('check-obligation-coverage: GREEN');
  process.exit(0);
}

if (process.argv[1] && basename(process.argv[1]) === 'check-obligation-coverage.mjs' && !process.argv.includes('--selftest-only')) {
  main();
}

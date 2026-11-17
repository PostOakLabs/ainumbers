// scripts/compare-obligation-spans.mjs — given the OLD obligation list and the
// re-pinned (new) local excerpt, show which obligation spans still match byte
// for byte at the same offsets and which do not. Part of the O4 re-pin flow
// (scripts/check-obligation-coverage.mjs): when a clause digest changes the old
// list does not carry over, and this helper is the reviewer's triage view of
// which obligations survived the re-pin untouched.
//
//   node scripts/compare-obligation-spans.mjs --list <old-list.json>
//        --old-excerpt <path> --new-excerpt <path> [--new-digest <sha256:...>]
//
// It calls no model and writes nothing anywhere: the report goes to stdout
// only. The old excerpt must hash (sha256, bytes) to the list's clause_digest,
// and the new excerpt must hash to --new-digest when that flag is given, so
// spans are byte offsets into exactly those texts. A span is a MATCH when the
// new excerpt carries the very same bytes at the same offsets; anything else
// (changed bytes, a span past the end of the new text) is a DIFFERS and the
// obligation needs a fresh look in the new split. Excerpt bytes themselves are
// never printed (only our own labels), so no source text leaks through the
// report.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const argv = process.argv.slice(2);
const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const listPath = arg('--list');
const oldPath = arg('--old-excerpt');
const newPath = arg('--new-excerpt');
const newDigest = arg('--new-digest');

function usage() {
  console.error('usage: node scripts/compare-obligation-spans.mjs --list <old-list.json> --old-excerpt <path> --new-excerpt <path> [--new-digest <sha256:...>]');
  process.exit(2);
}
if (!listPath || !oldPath || !newPath) usage();
for (const p of [listPath, oldPath, newPath]) {
  if (!existsSync(p)) { console.error(`file not found: ${p}`); process.exit(2); }
}

let list;
try { list = JSON.parse(readFileSync(listPath, 'utf8')); } catch (e) { console.error(`list does not parse: ${e.message}`); process.exit(2); }
if (!list || typeof list !== 'object' || !DIGEST_RE.test(list.clause_digest || '')) {
  console.error(`list clause_digest "${list && list.clause_digest}" is not sha256:<64 hex>`);
  process.exit(2);
}
const obs = Array.isArray(list.obligations) ? list.obligations : [];
if (!obs.length) { console.error('list has no obligations array'); process.exit(2); }

const oldBytes = readFileSync(oldPath);
const oldHex = createHash('sha256').update(oldBytes).digest('hex');
if ('sha256:' + oldHex !== list.clause_digest) {
  console.error(`old excerpt does not hash to the list's clause_digest: file is sha256:${oldHex}, the list pins ${list.clause_digest}`);
  process.exit(1);
}
const newBytes = readFileSync(newPath);
const newHex = createHash('sha256').update(newBytes).digest('hex');
if (newDigest) {
  if (!DIGEST_RE.test(newDigest)) { console.error(`--new-digest "${newDigest}" is not sha256:<64 hex>`); process.exit(2); }
  if ('sha256:' + newHex !== newDigest) {
    console.error(`new excerpt does not hash to --new-digest: file is sha256:${newHex}, asked for ${newDigest}`);
    process.exit(1);
  }
} else {
  console.log(`note: no --new-digest given; the new excerpt hashes to sha256:${newHex}`);
}

const d8 = (d) => String(d).replace(/^sha256:/, '').slice(0, 8);
console.log(`SPAN COMPARE old ${d8(list.clause_digest)} -> new ${newDigest ? d8(newDigest) : d8('sha256:' + newHex)}`);
console.log(`old excerpt: ${oldBytes.length} bytes (verified ${list.clause_digest})`);
console.log(`new excerpt: ${newBytes.length} bytes (sha256:${newHex})`);
console.log(`list: ${basename(listPath)}, ${obs.length} obligations, split by ${list.split_by || 'unknown'}, reviewed by ${list.reviewed_by || 'unknown'}`);

let matches = 0;
const differs = [];
for (const o of obs) {
  const s = o && o.span ? o.span : {};
  const id = o && o.id ? o.id : '?';
  const kind = o && o.kind ? o.kind : '?';
  const label = o && o.label ? o.label : '(no label)';
  let why = null;
  if (!Number.isInteger(s.start) || !Number.isInteger(s.end) || s.start < 0 || s.end <= s.start) why = 'span is not a valid byte range';
  else if (s.end > oldBytes.length) why = `span runs past the end of the old excerpt (${oldBytes.length} bytes)`;
  else if (s.end > newBytes.length) why = `span runs past the end of the new excerpt (${newBytes.length} bytes)`;
  else if (!oldBytes.slice(s.start, s.end).equals(newBytes.slice(s.start, s.end))) {
    const a = oldBytes.slice(s.start, s.end);
    const b = newBytes.slice(s.start, s.end);
    let at = 0;
    while (at < a.length && a[at] === b[at]) at++;
    why = `first differing byte at offset ${s.start + at}`;
  }
  if (why) {
    differs.push(id);
    console.log(`DIFFERS ${id} [${s.start},${s.end}) ${kind}: ${label} (${why})`);
  } else {
    matches++;
    console.log(`MATCH   ${id} [${s.start},${s.end}) ${kind}: ${label}`);
  }
}
console.log(`summary: ${matches} of ${obs.length} obligation spans still match byte for byte; ${differs.length} differ`);
console.log(`next: a changed digest needs a fresh split; run scripts/propose-obligation-split.mjs --excerpt <new excerpt> --digest ${newDigest || 'sha256:' + newHex}`);

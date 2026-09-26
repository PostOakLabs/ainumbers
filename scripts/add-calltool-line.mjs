/**
 * add-calltool-line.mjs — PROMPTS-CALLTOOL-LINE-1 (one-shot; run once).
 *
 * Adds ONE sentence to every prompt body in mcp/showcase-prompts.json:
 *
 *   If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.
 *
 * The wording tracks the landed call_tool contract (MCP-REACH-BUILD-SPEC-2026-09-24.md §D,
 * "D1 — call_tool dispatcher": inputs { name, arguments? }; "Same execution, same validation:
 * the dispatcher runs the target through the SAME single-tool path a direct tools/call uses,
 * including input validation against the target's inputSchema ... execution_hash must be
 * byte-identical to a direct call", verified live on https://mcp.ainumbers.co/mcp tools/list).
 *
 * Placement: immediately after the existing call-shape sentence ("...flat arguments are
 * discarded by schema validation.") for the bodies that carry it; appended as the final
 * sentence for the bodies that do not. The sentence carries NO dash of any kind (verification
 * amendment 2026-09-24: an em-dash would red check-copy-hallmarks on main's prompts.html regen,
 * and this text flows into that public page).
 *
 * Surgical text edit: each body is replaced via its exact JSON literal
 * ('"body": ' + JSON.stringify(body), asserted unique), so the file's
 * collapsed-inline formatting survives byte-for-byte everywhere else.
 * Guards: 46 entries; sentence exactly once per body after the edit; every
 * non-body field deep-equal to the original; idempotent on re-run.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const FILE = join(REPO, 'mcp', 'showcase-prompts.json');

const SENTENCE =
  'If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { … } }. It runs the same validation and returns the same receipt.';
const ANCHOR = 'flat arguments are discarded by schema validation.';

const fail = (msg) => { console.error('GEN-ERROR: ' + msg); process.exit(1); };

const raw = readFileSync(FILE, 'utf8');
const prompts = JSON.parse(raw);
if (!Array.isArray(prompts) || prompts.length !== 46) {
  fail(`expected 46 entries, found ${Array.isArray(prompts) ? prompts.length : typeof prompts}`);
}

const original = JSON.parse(JSON.stringify(prompts));
let afterAnchor = 0;
let atEnd = 0;
let already = 0;
let trimmed = 0;

for (const e of prompts) {
  if (typeof e.body !== 'string' || !e.body) fail(`entry ${e.id}: body is not a non-empty string`);
  if (e.body.includes(SENTENCE)) { already++; continue; }
  const i = e.body.indexOf(ANCHOR);
  if (i >= 0) {
    if (e.body.indexOf(ANCHOR, i + 1) >= 0) fail(`entry ${e.id}: anchor sentence appears more than once`);
    e.body = e.body.slice(0, i + ANCHOR.length) + ' ' + SENTENCE + e.body.slice(i + ANCHOR.length);
    afterAnchor++;
  } else {
    const base = e.body.replace(/\s+$/, '');
    if (base !== e.body) trimmed++;
    e.body = base + ' ' + SENTENCE;
    atEnd++;
  }
  if (e.body.split(SENTENCE).length - 1 !== 1) fail(`entry ${e.id}: sentence count after edit != 1`);
}

// No other field, no key added/removed, no entry added/removed.
if (prompts.length !== original.length) fail('entry count changed');
for (let k = 0; k < prompts.length; k++) {
  if (Object.keys(original[k]).join(',') !== Object.keys(prompts[k]).join(',')) fail(`entry ${prompts[k].id}: key set changed`);
  for (const key of Object.keys(original[k])) {
    if (key === 'body') continue;
    if (JSON.stringify(original[k][key]) !== JSON.stringify(prompts[k][key])) fail(`entry ${prompts[k].id}: field "${key}" changed`);
  }
}

let out = raw;
for (let k = 0; k < prompts.length; k++) {
  if (prompts[k].body === original[k].body) continue;
  const oldLit = '"body": ' + JSON.stringify(original[k].body);
  const newLit = '"body": ' + JSON.stringify(prompts[k].body);
  const parts = out.split(oldLit);
  if (parts.length !== 2) fail(`entry ${prompts[k].id}: body literal not found exactly once in file`);
  out = parts[0] + newLit + parts[1];
}

const verify = JSON.parse(out);
for (let k = 0; k < prompts.length; k++) {
  if (JSON.stringify(verify[k]) !== JSON.stringify(prompts[k])) fail(`entry ${prompts[k].id}: post-write entry mismatch`);
}
if (out === raw && already !== 46) fail('no text change produced');

writeFileSync(FILE, out);
console.log(
  `add-calltool-line: 46 entries — ${afterAnchor} placed after the call-shape sentence, ${atEnd} appended at body end (no anchor present), ${already} already carried it` +
  (trimmed ? `, ${trimmed} bodies had trailing whitespace stripped` : '') +
  '; sentence once per body, no dash, no other field touched.'
);

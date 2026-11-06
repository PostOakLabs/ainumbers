#!/usr/bin/env node
// Bookkeeping for automerge-label.yml's merge-queue eject hold.
// A PR dequeued for a failed check gets the `mq-ejected` label plus ONE comment
// that names the failing workflow, step and run and records the head sha it
// failed at. While the label is present and the head is unchanged nothing
// re-arms the PR; a new head clears it (workflow `synchronize` path).
//   node scripts/mq-eject-hold.mjs comment <workflow> <step> <run-id> <head-sha>
//     prints the comment body.
//   node scripts/mq-eject-hold.mjs held <head-sha> < comment-body
//     exits 0 when the recorded sha equals <head-sha>, 1 otherwise.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const LABEL = 'mq-ejected';
const MARKER = 'merge-queue: ejected';
const SHA_RE = /\bhead ([0-9a-f]{7,40})\b/;

export function holdComment({ workflow, step, runId, sha }) {
  return `${MARKER} for a failed check (workflow ${workflow}, step ${step}, run ${runId}), head ${sha}. `
    + `Not re-armed at this head: push a new commit to clear the \`${LABEL}\` label.`;
}

export function isHoldComment(body) {
  return String(body).startsWith(MARKER);
}

export function recordedSha(body) {
  const m = SHA_RE.exec(String(body));
  return m ? m[1] : null;
}

// Held while the label is present and the comment's recorded head is the live head.
export function isHeld(labels, headSha, commentBody) {
  if (!labels.includes(LABEL)) return false;
  const rec = recordedSha(commentBody);
  return rec !== null && rec === headSha;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === 'comment') {
    const [workflow, step, runId, sha] = a;
    console.log(holdComment({ workflow, step, runId, sha }));
  } else if (cmd === 'held') {
    process.exit(recordedSha(readFileSync(0, 'utf8')) === a[0] ? 0 : 1);
  } else {
    console.error('usage: mq-eject-hold.mjs comment <workflow> <step> <run-id> <head-sha> | held <head-sha>');
    process.exit(2);
  }
}

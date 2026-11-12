#!/usr/bin/env node
/**
 * scripts/check-standards-drift.test.mjs — fixture proof for
 * STDWATCH-DEDUPE-1.
 *
 * Stubs global `fetch` (no network, no token against the real repo) and proves
 * the three dedupe cases of `reportDrift()`:
 *   1. no existing open `standards-drift` issue with the title → POSTs a NEW issue;
 *   2. same title, body already names the new digest → NO write at all;
 *   3. same title, body names a DIFFERENT digest → exactly ONE comment, no new issue.
 * Also proves the fallback invariant: when the list call fails, the script
 * falls back to opening the issue (a drift is never swallowed silently).
 *
 * Usage: node scripts/check-standards-drift.test.mjs
 * Exit 0 = all assertions passed. Exit 1 = a fixture assertion failed.
 */

// Env must be set BEFORE importing the module under test — it reads
// GITHUB_TOKEN/GITHUB_REPOSITORY at import time.
process.env.GITHUB_TOKEN = 'test-token';
process.env.GITHUB_REPOSITORY = 'owner/repo';

const { reportDrift, driftTitle } = await import('./check-standards-drift.mjs');

const ENTRY = {
  name: 'AP2',
  url: 'https://example.com/ap2.md',
  adopted_version: 'v1.0',
  pinned_digest: 'sha256:oldoldoldoldoldoldoldoldoldoldoldoldoldoldoldoldoldoldol',
};
const NEW_DIGEST = 'sha256:newnewnewnewnewnewnewnewnewnewnewnewnewnewnewnewnewnew';

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.log(`✗ ${msg}`);
  } else {
    console.log(`✓ ${msg}`);
  }
}

const REAL_FETCH = globalThis.fetch;

function githubJson(body, status = 200) {
  return { ok: true, status, json: async () => body };
}

async function withFetch(stub, fn) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : null });
    return stub(calls[calls.length - 1]);
  };
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = REAL_FETCH;
  }
}

const title = driftTitle(ENTRY);
const existingIssue = (body) => ({ number: 2493, title, body });

// ── Case 1: no existing issue → POST a new issue ───────────────────────
await withFetch(
  (call) => (call.method === 'GET' ? githubJson([]) : githubJson({ number: 2500 })),
  async (calls) => {
    await reportDrift(ENTRY, NEW_DIGEST);
    const posts = calls.filter((c) => c.method === 'POST');
    assert(calls[0]?.url.includes('/issues?state=open&labels=standards-drift'), 'case 1: lists OPEN issues with the standards-drift label first');
    assert(posts.length === 1 && posts[0].url.endsWith('/repos/owner/repo/issues'), 'case 1: exactly one write, a POST to the issues endpoint');
    assert(posts[0].body.title === title && posts[0].body.body.includes(NEW_DIGEST) && posts[0].body.labels.includes('standards-drift'), 'case 1: new issue carries the exact drift title, the new digest and the standards-drift label');
  },
);

// ── Case 2: same title, same digest in body → no write ─────────────────
await withFetch(
  () => githubJson([existingIssue(`**New (fetched) digest:** \`${NEW_DIGEST}\``)]),
  async (calls) => {
    await reportDrift(ENTRY, NEW_DIGEST);
    assert(calls.length === 1, 'case 2: same title and same digest → no write (list call only)');
  },
);

// ── Case 3: same title, different digest → one comment, no new issue ───
await withFetch(
  () => githubJson([existingIssue(`**New (fetched) digest:** \`sha256:stalestalestale\``)]),
  async (calls) => {
    await reportDrift(ENTRY, NEW_DIGEST);
    const posts = calls.filter((c) => c.method === 'POST');
    assert(posts.length === 1, 'case 3: exactly one write total');
    assert(posts[0].url.endsWith('/issues/2493/comments'), 'case 3: the write is ONE comment on the existing issue #2493');
    assert(posts[0].body.body.includes(ENTRY.pinned_digest) && posts[0].body.body.includes(NEW_DIGEST), 'case 3: comment names both the old (pinned) and the new digest');
  },
);

// ── Fallback: list call fails → still opens the issue (never swallow) ──
await withFetch(
  (call) => (call.method === 'GET' ? { ok: false, status: 502, json: async () => [] } : githubJson({ number: 2501 })),
  async (calls) => {
    await reportDrift(ENTRY, NEW_DIGEST);
    const posts = calls.filter((c) => c.method === 'POST');
    assert(posts.length === 1 && posts[0].url.endsWith('/repos/owner/repo/issues'), 'fallback: HTTP 502 on the list call → falls back to opening the issue (drift not swallowed)');
  },
);

console.log(failures === 0 ? '\nall check-standards-drift dedupe assertions passed' : `\n${failures} assertion(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);

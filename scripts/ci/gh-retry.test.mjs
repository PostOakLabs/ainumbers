// Unit test for scripts/ci/gh-retry.sh: a fake gh replays scripted results.
// No network.
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHIM = fileURLToPath(new URL('./gh-retry.sh', import.meta.url));

// A fake gh: try N prints line N of `script` (rc|stdout|stderr) and logs argv.
function run(script, args = ['api', 'graphql'], env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gh-retry-'));
  writeFileSync(join(dir, 'script'), script.join('\n') + '\n');
  writeFileSync(join(dir, 'n'), '0');
  const fake = join(dir, 'gh');
  writeFileSync(fake, [
    '#!/usr/bin/env bash',
    `d=${JSON.stringify(dir)}`,
    'n=$(( $(cat "$d/n") + 1 )); echo "$n" > "$d/n"',
    'echo "$*" >> "$d/argv"',
    'line=$(sed -n "${n}p" "$d/script")',
    'IFS="|" read -r rc o e <<< "$line"',
    '[ -n "$o" ] && echo "$o"',
    '[ -n "$e" ] && echo "$e" >&2',
    'exit "$rc"',
  ].join('\n'));
  chmodSync(fake, 0o755);
  const r = spawnSync('bash', [SHIM, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GH_RETRY_REAL: fake, GH_RETRY_SLEEP: '0', ...env },
  });
  return { ...r, tries: Number(readFileSync(join(dir, 'n'), 'utf8')), argv: readFileSync(join(dir, 'argv'), 'utf8') };
}

const WRONG = 'GraphQL: Something went wrong while executing your query on 2026-11-25T15:54:34Z.';

test('#3285 replay: a transient GraphQL error then success returns the success', () => {
  const r = run([`1||${WRONG}`, '0|{"ok":true}|']);
  assert.equal(r.status, 0);
  assert.equal(r.tries, 2);
  assert.equal(r.stdout.trim(), '{"ok":true}');
  assert.match(r.stderr, /gh-retry: transient GitHub API failure \(try 1 of 4\)/);
});

test('error JSON on stdout (gh api graphql) is recognised too', () => {
  const r = run([`1|{"errors":[{"message":"${WRONG}"}]}|`, '0|done|']);
  assert.equal(r.status, 0);
  assert.equal(r.tries, 2);
});

test('HTTP 502 and 429 retry; the tries stop at the cap with the last result', () => {
  const r = run(['1||HTTP 502: Bad Gateway', '1||HTTP 429: too many', '1||HTTP 503', '1||HTTP 504: last']);
  assert.equal(r.status, 1);
  assert.equal(r.tries, 4);
  assert.match(r.stderr, /HTTP 504: last/);
  assert.doesNotMatch(r.stdout + r.stderr.replace(/HTTP 504: last/, ''), /HTTP 502/);
});

test('a non-transient failure returns at once with gh exit code (no merge queue, 404)', () => {
  const q = run(["1||gh: No merge queue found for branch 'master'"]);
  assert.equal(q.status, 1);
  assert.equal(q.tries, 1);
  const nf = run(['4||HTTP 404: Not Found']);
  assert.equal(nf.status, 4);
  assert.equal(nf.tries, 1);
});

test('success on the first try is passed through untouched, args intact', () => {
  const r = run(['0|hello world|warn line'], ['pr', 'comment', '7', '--body', 'a b']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'hello world\n');
  assert.equal(r.stderr, 'warn line\n');
  assert.equal(r.argv.trim(), 'pr comment 7 --body a b');
});

test('GH_RETRY_ATTEMPTS bounds the tries', () => {
  const r = run([`1||${WRONG}`, `1||${WRONG}`, '0|late|'], ['api', 'x'], { GH_RETRY_ATTEMPTS: '2' });
  assert.equal(r.status, 1);
  assert.equal(r.tries, 2);
});

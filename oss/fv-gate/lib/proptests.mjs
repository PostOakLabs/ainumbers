// proptests.mjs — property-test floor runner, extracted from repo/scripts/run-proptests.mjs.
// Behavior preserved exactly: glob *.proptest.mjs in a directory, run each as a child `node <file>`
// process, aggregate pass/fail by exit code only (a broken file cannot crash the runner). An empty
// directory (or a directory that doesn't exist) is a no-op PASS.

import { existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

export function findPropertyFiles(dir, ext = '.proptest.mjs') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => join(dir, f));
}

export function kernelIdOf(filePath, ext = '.proptest.mjs') {
  return basename(filePath).replace(new RegExp(`\\${ext}$`), '');
}

export function runOne(filePath, cwd) {
  const result = spawnSync(process.execPath, [filePath], { cwd, encoding: 'utf8' });
  return {
    file: filePath,
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    spawnError: result.error ? String(result.error) : null,
  };
}

// Pure over an already-globbed file list, so callers/tests can inject the list.
export function runAll(files, cwd) {
  return files.map((f) => runOne(f, cwd));
}

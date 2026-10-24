// receipt-bundle-attest-subjects.mjs — SIGSTORE-BUNDLE-V03-EXPORT-4.
//
// Pure, network-free derivation of the `subject-path` value the deploy
// workflow's receipt-bundle attest step feeds to actions/attest-build-provenance.
// It reads chaingraph/receipt-bundles/index.json (the PUBLISHED index — never
// the §5 fixtures under chaingraph/standard/fixtures/) and prints the
// subject-path form that covers every published bundle exactly once.
//
// The form is ONE glob line: chaingraph/receipt-bundles/*.bundle.json. The
// glob is derived, not hardcoded: every `bundles[].bundle` entry in the index
// must match it, and the script exits 1 if any published bundle would NOT be
// covered (or if the glob would pick up a file the index does not name, so a
// stray file in the directory can never be silently attested).
//
// Run: node scripts/receipt-bundle-attest-subjects.mjs [path-to-index.json]
// (default path is relative to the repo root, matching how the deploy
// workflow checks out the tree).

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const SUBJECT_GLOB = 'chaingraph/receipt-bundles/*.bundle.json';
export const BUNDLE_DIR = 'chaingraph/receipt-bundles';

/** Repo-relative subject path for an index bundle entry. The index stores bare
 * file names; a repo-relative path is honoured verbatim for forward safety. */
export function subjectPathForBundle(name) {
  return name.includes('/') ? name : `${BUNDLE_DIR}/${name}`;
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

/**
 * Derive the subject-path form from a parsed index.json and validate coverage.
 * Pure: takes the parsed index object, returns { subjectPath, files, errors }.
 */
export function subjectPathsForIndex(index) {
  const errors = [];
  const bundles = Array.isArray(index?.bundles) ? index.bundles : null;
  if (!bundles || bundles.length === 0) {
    errors.push('index.json carries no bundles array (or it is empty)');
    return { subjectPath: SUBJECT_GLOB, files: [], errors };
  }
  const re = globToRegExp(SUBJECT_GLOB);
  const files = [];
  for (const entry of bundles) {
    const name = typeof entry?.bundle === 'string' ? entry.bundle : null;
    if (!name) {
      errors.push(`index entry for ${entry?.tool_id ?? '(unknown tool)'} names no bundle file`);
      continue;
    }
    const rel = subjectPathForBundle(name);
    if (!re.test(rel)) {
      errors.push(`bundle ${rel} is NOT covered by the subject-path glob ${SUBJECT_GLOB}`);
    }
    files.push(rel);
  }
  return { subjectPath: SUBJECT_GLOB, files, errors };
}

export function main(argv) {
  const indexPath = argv[0] ?? join('chaingraph', 'receipt-bundles', 'index.json');
  let index;
  try {
    index = JSON.parse(readFileSync(indexPath, 'utf8'));
  } catch (err) {
    console.error(`receipt-bundle-attest-subjects: cannot read ${indexPath}: ${err.message}`);
    return 1;
  }
  const { subjectPath, files, errors } = subjectPathsForIndex(index);
  if (errors.length > 0) {
    for (const e of errors) console.error(`receipt-bundle-attest-subjects: ${e}`);
    return 1;
  }
  console.log(`# ${files.length} published receipt bundles under ${relative('.', indexPath)}`);
  console.log(subjectPath);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('receipt-bundle-attest-subjects.mjs')) {
  process.exit(main(process.argv.slice(2)));
}

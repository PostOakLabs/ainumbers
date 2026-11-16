// gen-replay-house-line.mjs: main-side writer for data/replay-house-line.json, the house line of
// the determinism record (REPLAY-HOUSE-SIGN-1).
//
// The line is derived from the same replay the attested workflow runs: it calls replayCorpus()
// from scripts/replay-result.mjs over the tracked fixture corpus, so it states the exact digests
// that .github/workflows/replay-house-attest.yml signs on upstream:
//   result_sha256  sha256 of replay-result.json (attestation subject 2)
//   beacon_digest  sha256("ainumbers-replay-witness/v1:" + corpus_digest) (attestation subject 1)
// Content only: no timestamps, no host facts, so the file is a fixpoint of its inputs and a
// reader can recompute it. A PR never commits it (single writer: derived-artifacts-regen.yml).
//
//   node scripts/gen-replay-house-line.mjs          # write data/replay-house-line.json
//   node scripts/gen-replay-house-line.mjs --check  # freshness gate (advisory on PR, blocking on main)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jcsStringify } from '../chaingraph/kernels/_hash.mjs';
import { replayCorpus, serializeResult } from './replay-result.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..');
export const HOUSE_LINE_REL = 'data/replay-house-line.json';
export const PREDICATE_TYPE = 'ainumbers.co/replay-witness/v1';
export const BEACON_PREFIX = 'ainumbers-replay-witness/v1:';
export const WORKFLOW_PATH = '.github/workflows/replay-house-attest.yml';

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

export function buildHouseLine({ result, counts }) {
  const differing = Object.values(result.mismatches).reduce((n, ids) => n + ids.length, 0);
  return {
    schema: 'ainumbers.co/replay-house-line/v1',
    corpus_digest: result.corpus_digest,
    root: result.root,
    result_sha256: sha256(serializeResult(result)),
    beacon_digest: sha256(BEACON_PREFIX + result.corpus_digest),
    modules_covered: counts.modules,
    modules_excluded: result.excluded_count,
    vectors: counts.vectors,
    vectors_differing: differing,
    signature_status: 'signed',
    signed_by: `GitHub artifact attestation, predicate ${PREDICATE_TYPE}, workflow ${WORKFLOW_PATH}`,
    verify: 'gh attestation verify replay-result.json --repo PostOakLabs/ainumbers --predicate-type ' + PREDICATE_TYPE,
  };
}

export const serializeLine = (line) => jcsStringify(line) + '\n';

async function main() {
  const check = process.argv.includes('--check');
  const out = join(REPO, HOUSE_LINE_REL);
  const replay = await replayCorpus({
    kernelsDir: join(REPO, 'chaingraph', 'kernels'),
    rulesPath: join(REPO, 'data', 'replay-exclusion-rules.json'),
  });
  const body = serializeLine(buildHouseLine(replay));
  if (!check) { writeFileSync(out, body); console.log(`gen-replay-house-line: wrote ${HOUSE_LINE_REL}`); return 0; }
  if (!existsSync(out)) {
    console.error(`gen-replay-house-line --check: ${HOUSE_LINE_REL} is ABSENT. Expected on a PR checkout (main's regen writes it after merge; the COVERED entry is prAbsentOk); on MAIN run node scripts/gen-replay-house-line.mjs.`);
    return 1;
  }
  if (readFileSync(out, 'utf8') === body) { console.log('gen-replay-house-line --check: byte-exact'); return 0; }
  console.error(`gen-replay-house-line --check: ${HOUSE_LINE_REL} is STALE vs the fixture corpus. main's derived-artifacts regen owns this file (SO #35); a PR must not rewrite it.`);
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main());

// replay-house-subjects.mjs: derive the two attestation subjects from replay-result.json.
//
//   node scripts/replay-house-subjects.mjs <dir>
//       writes <dir>/replay-subjects.txt, a checksums file for actions/attest:
//         <beacon digest>  replay-beacon
//         <result digest>  replay-result
//   node scripts/replay-house-subjects.mjs <dir> --compare <house-line.json>
//       reports whether this run's digests equal the committed house line. Never fatal: a stale
//       or absent line is printed, since main's regen owns that file.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEACON_PREFIX } from './gen-replay-house-line.mjs';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

export function deriveSubjects(resultBytes) {
  const result = JSON.parse(resultBytes.toString('utf8'));
  if (typeof result.corpus_digest !== 'string') throw new Error('replay-result.json has no corpus_digest');
  return {
    corpus_digest: result.corpus_digest,
    beacon: sha256(BEACON_PREFIX + result.corpus_digest),
    result: sha256(resultBytes),
  };
}

export const checksumsText = (s) => `${s.beacon}  replay-beacon\n${s.result}  replay-result\n`;

function main() {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node scripts/replay-house-subjects.mjs <dir> [--compare <house-line.json>]'); return 2; }
  const subjects = deriveSubjects(readFileSync(join(dir, 'replay-result.json')));
  const ci = process.argv.indexOf('--compare');
  if (ci < 0) {
    writeFileSync(join(dir, 'replay-subjects.txt'), checksumsText(subjects));
    console.log(`replay-beacon ${subjects.beacon}\nreplay-result ${subjects.result}`);
    return 0;
  }
  const linePath = process.argv[ci + 1];
  if (!linePath || !existsSync(linePath)) { console.log('house line absent; nothing to compare'); return 0; }
  const line = JSON.parse(readFileSync(linePath, 'utf8'));
  const same = line.beacon_digest === subjects.beacon && line.result_sha256 === subjects.result;
  console.log(same ? 'MATCH: this run equals the committed house line' : 'DIFFERS: this run does not equal the committed house line (main regen has not caught up, or a vector differs)');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());

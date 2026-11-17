// scripts/propose-obligation-split.mjs — print a split prompt and a skeleton
// obligation list from a LOCAL excerpt. It calls no model itself: the prompt is
// meant to be handed to the splitter model by the row that runs this script.
//
//   node scripts/propose-obligation-split.mjs --excerpt <path> --digest <sha256:...>
//   node scripts/propose-obligation-split.mjs --excerpt <path> --digest <sha256:...> --show-span 272,416
//
// The excerpt must hash (sha256, bytes) to the digest or the script refuses:
// spans are byte offsets into exactly that text. The excerpt itself only ever
// prints to stdout; nothing excerpt-derived is written to disk, so no quoted
// source text can enter the repo through this helper.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const excerptPath = arg('--excerpt');
const digest = arg('--digest');
const showSpan = arg('--show-span');

if (!excerptPath || !digest) {
  console.error('usage: node scripts/propose-obligation-split.mjs --excerpt <path> --digest <sha256:...> [--show-span start,end]');
  process.exit(2);
}
if (!existsSync(excerptPath)) {
  console.error(`excerpt not found: ${excerptPath}`);
  process.exit(2);
}
const bytes = readFileSync(excerptPath);
const hex = createHash('sha256').update(bytes).digest('hex');
if (digest !== 'sha256:' + hex) {
  console.error(`excerpt does not hash to the cited digest: file is sha256:${hex}, asked for ${digest}`);
  process.exit(1);
}

if (showSpan) {
  const [a, b] = showSpan.split(',').map((n) => parseInt(n, 10));
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b <= a || b > bytes.length) {
    console.error(`--show-span needs start,end byte offsets with 0 <= start < end <= ${bytes.length}`);
    process.exit(2);
  }
  console.log(`bytes [${a},${b}) of ${basename(excerptPath)} (${bytes.length} bytes total):`);
  console.log(JSON.stringify(bytes.toString('utf8').slice(a, b)));
  process.exit(0);
}

// byte-offset ruler view: every line shows its start offset, and a tick marks
// each 50-byte boundary inside the line so a splitter can locate spans by eye
// and then verify them with --show-span.
const text = bytes.toString('utf8');
console.log('SPLIT PROMPT (hand this to the splitter model; the splitter must not be the covered node\'s builder):');
console.log('');
console.log(`You are splitting a pinned excerpt (${bytes.length} bytes, ${digest}) into numbered obligations.`);
console.log('Rules:');
console.log('  1. One obligation per testable sentence; exceptions are their own obligations;');
console.log('     a cross-reference to another clause is an obligation of kind "definition".');
console.log('  2. Kinds: condition, threshold, exception, definition, procedure, deadline.');
console.log('  3. Keep 3 to 25 obligations. Finer beats coarser, but every obligation must be testable.');
console.log('  4. span = BYTE range into the excerpt, start inclusive, end exclusive.');
console.log('     Byte offsets, not character offsets (the text has multi-byte characters).');
console.log('  5. Spans must not overlap and must stay inside 0..' + bytes.length + '.');
console.log('  6. Labels are our own short PARAPHRASES. Never quote the source text in any output');
console.log('     file. Verify each span with the --show-span flag before submitting.');
console.log('  7. Output only the skeleton JSON below, filled in, no commentary.');
console.log('');
console.log('EXCERPT (byte-offset view; <n> is the byte offset at the start of the line):');
console.log('');
let off = 0;
for (const line of text.split('\n')) {
  console.log(`<${off}> ${line}`);
  off += Buffer.byteLength(line) + 1;
}
console.log('');
console.log('SKELETON (fill in; the reviewer must be a different model family or person):');
console.log(JSON.stringify({
  clause_digest: digest,
  excerpt_bytes: bytes.length,
  split_by: '<model or person>',
  split_at: '<ISO date>',
  reviewed_by: '<a different model or person>',
  reviewed_at: '<ISO date>',
  obligations: [
    { id: 'O1', label: '<our own short paraphrase>', span: { start: 0, end: 0 }, kind: 'condition' },
    { id: 'O2', label: '<our own short paraphrase>', span: { start: 0, end: 0 }, kind: 'threshold' },
    { id: 'O3', label: '<our own short paraphrase>', span: { start: 0, end: 0 }, kind: 'definition' },
  ],
}, null, 2));

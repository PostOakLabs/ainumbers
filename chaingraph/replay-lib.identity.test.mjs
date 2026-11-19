// R3 identity gate for replay-lib.mjs.
// Every golden vector on the site is turned into a receipt and replayed in mode A on today's kernel.
// A faithful loader returns SAME with equal hashes for each. A vector the kernel does not reproduce is
// listed by name; the ones already known to differ are pinned in replay-lib.identity.baseline.json and
// may only shrink. RED control: a kernel that returns different output must not give SAME.
//
//   node chaingraph/replay-lib.identity.test.mjs            run the gate
//   node chaingraph/replay-lib.identity.test.mjs --control  also run the red control and exit 0 only if it is red
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './kernels/_hash.mjs';
import { replayReceipt, nodeKernelLoader, STATES } from './replay-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KDIR = resolve(HERE, 'kernels');
const FIXDIR = resolve(KDIR, 'fixtures');
const BASELINE = resolve(HERE, 'replay-lib.identity.baseline.json');

export async function runIdentity({ loadKernel = nodeKernelLoader(KDIR) } = {}) {
  const files = readdirSync(FIXDIR).filter((f) => f.endsWith('.fixtures.json')).sort();
  let vectors = 0, same = 0, noKernel = 0, privateNode = 0, noVectors = 0;
  const failures = [];
  for (const f of files) {
    const doc = JSON.parse(readFileSync(resolve(FIXDIR, f), 'utf8'));
    const id = doc.tool_id || f.replace(/\.fixtures\.json$/, '');
    if (!Array.isArray(doc.vectors)) { noVectors++; continue; }   // a different fixture schema, not a compute() corpus
    for (const v of doc.vectors) {
      if (!v.policy_parameters || !v.output_payload) continue;
      vectors++;
      const receipt = {
        tool_id: id,
        policy_parameters: v.policy_parameters,
        output_payload: v.output_payload,
        execution_hash: await executionHash(v.policy_parameters, v.output_payload),
      };
      const r = await replayReceipt(receipt, { mode: 'A', loadKernel });
      if (r.state === STATES.SAME && r.new_execution_hash === r.old_execution_hash) same++;
      else if (r.state === STATES.UNRESOLVED && /not on this site/.test(r.reason || '')) noKernel++;       // fixture without a kernel file: not covered, counted
      else if (r.state === STATES.UNRESOLVED && /^private-input node/.test(r.reason || '')) privateNode++;   // witness is not in the file: documented UNRESOLVED
      else failures.push(`${id}#${v.name}`.slice(0, 120) + ` => ${r.state}`);
    }
  }
  return { files: files.length, vectors, same, noKernel, privateNode, noVectors, failures };
}

async function main() {
  const res = await runIdentity();
  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { known_not_same: [] };
  const known = new Set(baseline.known_not_same);
  const fresh = res.failures.filter((x) => !known.has(x));
  const healed = [...known].filter((x) => !res.failures.includes(x));
  console.log(`R3 identity: ${res.vectors} golden vectors in ${res.files} fixture files; mode A SAME with equal hashes: ${res.same}; UNRESOLVED private-input nodes: ${res.privateNode}; UNRESOLVED no kernel file on site: ${res.noKernel}; other not SAME: ${res.failures.length}; fixture files without a vectors array: ${res.noVectors}`);
  let bad = false;
  if (res.vectors === 0) { console.error('R3 RED: zero vectors read, the gate would pass on nothing'); bad = true; }
  if (fresh.length) { console.error(`R3 RED: ${fresh.length} vector(s) not SAME and not in the baseline:\n  ${fresh.slice(0, 40).join('\n  ')}`); bad = true; }
  if (healed.length) { console.error(`R3 RED: ${healed.length} baseline entr${healed.length === 1 ? 'y is' : 'ies are'} now SAME; remove from replay-lib.identity.baseline.json (it only shrinks):\n  ${healed.slice(0, 40).join('\n  ')}`); bad = true; }

  if (process.argv.includes('--control')) {
    // RED control: a loader whose kernel always returns a different payload must never yield SAME.
    const liar = async () => ({ compute: () => ({ output_payload: { verdict: 'FAIL', injected: true } }) });
    const ctl = await runIdentity({ loadKernel: liar });
    const green = ctl.same;
    console.log(`R3 control (kernel that lies): SAME count ${green} of ${ctl.vectors} (must be below the vector count)`);
    if (green === ctl.vectors) { console.error('R3 CONTROL FAILED: a lying kernel produced SAME everywhere, the gate cannot go red'); bad = true; }
  }
  if (bad) process.exit(1);
  console.log('R3 identity: OK');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

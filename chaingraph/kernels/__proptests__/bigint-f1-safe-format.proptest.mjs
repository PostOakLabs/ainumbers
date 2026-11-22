// bigint-f1-safe-format.proptest.mjs: regression cases for family F1 (a BigInt input made compute()
// throw "Do not know how to serialize a BigInt" while the kernel built a refusal detail or its
// config fingerprint). Each case plants a BigInt on a real input field of the kernel's first
// fixture vector and asserts compute() returns instead of throwing.
//
// Run: node chaingraph/kernels/__proptests__/bigint-f1-safe-format.proptest.mjs [kernelsDir]
// The optional kernelsDir lets the same cases run against another checkout (RED on main).

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const kdir = path.resolve(process.argv[2] || path.join(here, '..'));
const fixDir = path.join(here, '..', 'fixtures');

const CASES = [
  ['art-12-acp-checkout-conformance-validator', 'payload.amount'],
  ['art-208-royalty-split-validator', 'entries.0.basis_points'],
  ['art-707-tsv-tier-cap-ladder', 'stocks.0.prior_month_adv_shares'],
  ['art-708-v4-hook-permission-reconciler', 'pool_fee'],
  ['art-709-v4-hook-fee-conformance', 'protocol_fee'],
  ['art-710-tsv-stoppage-concurrency', 'stoppages.0.start_ts'],
  ['art-760-espp-break-even-optimal-sell', 'purchase_price'],
  ['art-780-solana-pda-ata-audit', 'bump'],
];

function plant(obj, dotted, value) {
  const keys = dotted.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] === undefined || o[keys[i]] === null) o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}

let throws = 0;
const rows = [];
for (const [id, field] of CASES) {
  const fx = JSON.parse(readFileSync(path.join(fixDir, id + '.fixtures.json'), 'utf8'));
  const { compute } = await import(pathToFileURL(path.join(kdir, id + '.kernel.mjs')).href);
  const row = { id, field, threw: false, note: '' };
  for (const big of [7n, 123456789012345678901234567890n, -1n, 0n]) {
    const pp = structuredClone(fx.vectors[0].policy_parameters);
    plant(pp, field, big);
    try {
      const r = compute(pp);
      row.note = r && r.output_payload && (r.output_payload.refusal_code || r.output_payload.code || r.output_payload.valid) !== undefined ? 'returned' : 'returned';
    } catch (e) {
      row.threw = true;
      row.note = String(e && e.message);
    }
    if (row.threw) break;
  }
  if (row.threw) throws++;
  rows.push(row);
}
console.log(JSON.stringify({ kernels_dir: kdir, throws, rows }, null, 2));
process.exit(throws > 0 ? 1 : 0);

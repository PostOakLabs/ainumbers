#!/usr/bin/env node
/**
 * chaingraph/chains/summa-reserves-coverage-private.binding-check.mjs — SOLVENCY-CHAIN-1
 *
 * The G6 binding for the chain `summa-reserves-coverage-private`
 * (research/SOLVENCY-G6-DESIGN-AMEND-2026-11.md, repair b-i): step 2's outstanding
 * figure is declared equal to pad20(step 1's recomputed root sum), and the evidence is an
 * opening of art-809's `outstanding_commitment` published as a SEPARATE disclosure file
 * beside the composite (SPEC section 25.1 salt rule 2: the salt never enters the artifact).
 *
 * checkBinding() refuses, in order, unless:
 *   1. step 1 verdict is VERIFIED and computed_root.sum is a decimal string below 10^20;
 *   2. step 2's chain.parent_hashes contains step 1's execution_hash;
 *   3. opening.input_value.outstanding_minor equals computed_root.sum zero-padded to 20 digits;
 *   4. "sha256:" + hex(SHA-256(salt bytes || UTF-8(JSON.stringify(cgCanon(input_value)))))
 *      equals step 2's policy_parameters.outstanding_commitment (the exact art-809
 *      commitPrivateInput construction, cgCanon from kernels/_hash.mjs).
 * It recomputes; it never reads a stored verdict. The reserves salt and amounts are never opened.
 *
 * Usage (synthetic run; every figure and salt below is made up):
 *   node chaingraph/chains/summa-reserves-coverage-private.binding-check.mjs
 *       exit 0 on the synthetic run (art-621-shaped tree summing to 100000, art-620 VERIFIED,
 *       art-809 outstanding 00000000000000100000 against a covering reserve vector)
 *   node ... --mutate=outstanding-off-by-one   step 2 outstanding is 100001; exit 1
 *   node ... --mutate=salt                      opening salt changed; exit 1
 *   node ... --mutate=sum                       step 1 sum changed, step 2 unchanged; exit 1
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { cgCanon } from '../kernels/_hash.mjs';
import * as art620 from '../kernels/art-620-summa-mst-inclusion-checker.kernel.mjs';
import * as art809 from '../kernels/art-809-check-reserves-cover-outstanding-private.kernel.mjs';

const WIDTH = 20;
const LIMIT = 10n ** 20n;

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// Same node layout as art-620 section 2: leaf H(id|balance); middle H(sum|left|right).
const leaf = (id, bal) => ({ hash: sha(`${id}|${bal}`), sum: BigInt(bal) });
const mid = (l, r) => {
  const sum = l.sum + r.sum;
  return { hash: sha(`${sum}|${l.hash}|${r.hash}`), sum };
};

// Four-leaf synthetic tree; the proof is for leaf 0.
function syntheticTree(balances) {
  const ids = ['a1', 'b2', 'c3', 'd4'].map((p) => p.repeat(8));
  const [l0, l1, l2, l3] = ids.map((id, i) => leaf(id, String(balances[i])));
  const right = mid(l2, l3);
  const root = mid(mid(l0, l1), right);
  return {
    root: { hash: root.hash, sum: root.sum.toString() },
    proof: {
      leaf: { id: ids[0], balance: String(balances[0]) },
      path: [
        { side: 'right', sibling_hash: l1.hash, sibling_sum: l1.sum.toString() },
        { side: 'right', sibling_hash: right.hash, sibling_sum: right.sum.toString() },
      ],
    },
  };
}

const RESERVES_SALT = 'a'.repeat(64);
const OUTSTANDING_SALT = 'b'.repeat(64);
const pad20 = (n) => String(n).padStart(WIDTH, '0');

function reserveVector(total) {
  const slots = [{ category: '01', amount_minor: pad20(total) }];
  while (slots.length < 16) slots.push({ category: '00', amount_minor: pad20(0) });
  return slots;
}

async function commit(saltHex, inputValue) {
  const salt = Buffer.from(saltHex, 'hex');
  const body = Buffer.from(JSON.stringify(cgCanon(inputValue)), 'utf8');
  return 'sha256:' + createHash('sha256').update(Buffer.concat([salt, body])).digest('hex');
}

/** Returns an array of failure strings; empty means the binding holds. */
export async function checkBinding(step1, step2, opening) {
  const fails = [];
  const out1 = step1?.output_payload;
  const sumStr = out1?.computed_root?.sum;
  if (!out1 || out1.verdict !== 'VERIFIED') fails.push('1: step 1 verdict is not VERIFIED');
  else if (typeof sumStr !== 'string' || !/^[0-9]+$/.test(sumStr) || BigInt(sumStr) >= LIMIT) {
    fails.push('1: computed_root.sum is not a decimal string below 10^20');
  }
  if (!step2?.chain?.parent_hashes?.includes(step1?.execution_hash)) {
    fails.push('2: step 2 chain.parent_hashes does not carry step 1 execution_hash');
  }
  if (fails.length) return fails;
  const expected = sumStr.padStart(WIDTH, '0');
  if (opening?.pointer !== '/outstanding_commitment') fails.push('3: opening pointer is not /outstanding_commitment');
  if (opening?.input_value?.outstanding_minor !== expected) {
    fails.push('3: opening outstanding_minor is not computed_root.sum zero-padded to 20 digits');
  }
  if (typeof opening?.salt !== 'string' || !/^[0-9a-f]{64,}$/i.test(opening.salt)) {
    fails.push('4: opening salt is not a hex string of at least 256 bits');
  } else if ((await commit(opening.salt, opening.input_value)) !== step2.policy_parameters?.outstanding_commitment) {
    fails.push('4: opening does not recompute step 2 outstanding_commitment');
  }
  return fails;
}

async function syntheticRun(mutation) {
  const balances = [10000, 20000, 30000, 40000];
  const t = syntheticTree(balances);
  const now = '2026-11-16T00:00:00Z';
  const step1 = await art620.buildArtifact({ root: t.root, proof: t.proof }, { now });
  const outstanding = mutation === 'outstanding-off-by-one' ? 100001 : 100000;
  const step2 = await art809.buildArtifact({
    reserves: reserveVector(150000),
    outstanding: { outstanding_minor: pad20(outstanding) },
    reserves_salt: RESERVES_SALT,
    outstanding_salt: OUTSTANDING_SALT,
    unit: 'USD_cents',
    as_of: '2026-10-31',
  }, { now, parent_hashes: [step1.execution_hash], parent_tool_ids: [step1.tool_id], chain_depth: step1.chain.chain_depth + 1 });

  let s1 = step1;
  if (mutation === 'sum') {
    // A different tree total at step 1 (leaf 0 raised by one unit); step 2 is unchanged.
    const t2 = syntheticTree([10001, 20000, 30000, 40000]);
    s1 = await art620.buildArtifact({ root: t2.root, proof: t2.proof }, { now });
    step2.chain.parent_hashes = [s1.execution_hash];
  }
  const opening = {
    pointer: '/outstanding_commitment',
    salt: mutation === 'salt' ? 'c'.repeat(64) : OUTSTANDING_SALT,
    input_value: { outstanding_minor: pad20(100000) },
  };
  return { step1: s1, step2, opening };
}

async function main() {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--mutate='));
  const mutation = arg ? arg.slice('--mutate='.length) : null;
  if (mutation && !['outstanding-off-by-one', 'salt', 'sum'].includes(mutation)) {
    console.error(`unknown mutation: ${mutation}`);
    process.exit(2);
  }
  const { step1, step2, opening } = await syntheticRun(mutation);
  const fails = await checkBinding(step1, step2, opening);
  const verdict = step2.output_payload.reserves_cover_outstanding;
  if (fails.length) {
    console.error(`BINDING-RED${mutation ? ` (mutation ${mutation})` : ''}:`);
    for (const f of fails) console.error('  ' + f);
    process.exit(1);
  }
  console.log(`BINDING-OK root.sum=${step1.output_payload.computed_root.sum} outstanding=${opening.input_value.outstanding_minor} reserves_cover_outstanding=${verdict}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();

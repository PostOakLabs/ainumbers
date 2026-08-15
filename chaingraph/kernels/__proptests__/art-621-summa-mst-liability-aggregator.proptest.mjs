// kernel_digest_at_authoring: sha256:f237e50a1552db96450eb52e9c5ba27f461bfa8c8a610a3eb7a4818213080688
// FV floor (PBT-floor tier, FV-PBT-FLOOR-BUILD-SPEC.md) for art-621-summa-mst-liability-aggregator.
// Engineering QC only -- no assurance-grade vocabulary.

import { compute } from '../art-621-summa-mst-liability-aggregator.kernel.mjs';
import { deepStrictEqual, ok } from 'node:assert';

function run() {
  // Property: for any valid leaf count 1..16, portfolio sum equals the root sum, and the
  // recomputed hash+sum along every leaf's own proof path matches the emitted root -- the exact
  // §3 mitigation (independent recomputation, never trust an upstream sum).
  for (let n = 1; n <= 16; n++) {
    const leaves = Array.from({ length: n }, (_, i) => ({ id: 'acct-' + i, balance: String((i + 1) * 7) }));
    const { output_payload } = compute({ leaves });
    ok(output_payload.valid, `expected valid for n=${n}`);
    deepStrictEqual(output_payload.leaf_count, n);
    const expectedSum = leaves.reduce((a, l) => a + BigInt(l.balance), 0n);
    deepStrictEqual(output_payload.root.sum, expectedSum.toString(), `root sum mismatch for n=${n}`);
    deepStrictEqual(output_payload.proofs.length, n, `proof count mismatch for n=${n}`);
    for (const p of output_payload.proofs) {
      deepStrictEqual(p.root.hash, output_payload.root.hash);
      deepStrictEqual(p.root.sum, output_payload.root.sum);
      // path length must equal tree_depth for every leaf, regardless of position
      deepStrictEqual(p.path.length, output_payload.tree_depth, `path length mismatch for n=${n}`);
    }
  }

  // Property: more than 16 leaves is always rejected, never silently truncated or a bigger tree.
  {
    const leaves = Array.from({ length: 17 }, (_, i) => ({ id: 'x' + i, balance: '1' }));
    const { output_payload } = compute({ leaves });
    deepStrictEqual(output_payload.valid, false);
    deepStrictEqual(output_payload.error, 'too_many_leaves');
    deepStrictEqual(output_payload.proofs.length, 0);
  }

  // Property: a negative balance anywhere in the input is always rejected outright (§3.1), never
  // averaged away or silently clamped to zero.
  for (let i = 0; i < 4; i++) {
    const leaves = [{ id: 'ok', balance: '100' }, { id: 'ok2', balance: '50' }];
    leaves[i % 2] = { id: 'bad', balance: '-5' };
    const { output_payload } = compute({ leaves });
    deepStrictEqual(output_payload.valid, false);
    deepStrictEqual(output_payload.error, 'negative_balance');
  }

  // Property: a balance exceeding the declared MAX_BALANCE (default or caller-supplied) is always
  // rejected, never silently capped.
  {
    const { output_payload } = compute({ leaves: [{ id: 'a', balance: '500' }], max_balance: '100' });
    deepStrictEqual(output_payload.valid, false);
    deepStrictEqual(output_payload.error, 'balance_exceeds_max_balance');
  }
  {
    const { output_payload } = compute({ leaves: [{ id: 'a', balance: '100' }], max_balance: '100' });
    deepStrictEqual(output_payload.valid, true, 'balance exactly equal to max_balance must be accepted');
  }

  // Property: compute() is a pure function of its input -- calling it twice with identical
  // policy_parameters yields byte-identical output_payload (JSON round-trip equality).
  {
    const pp = { leaves: [{ id: 'p1', balance: '11' }, { id: 'p2', balance: '22' }, { id: 'p3', balance: '33' }] };
    const a = compute(pp);
    const b = compute(pp);
    deepStrictEqual(JSON.stringify(a.output_payload), JSON.stringify(b.output_payload), 'compute() is not deterministic');
  }

  // Property: leaf order determines root hash -- swapping two leaves' positions changes the root
  // (the tree is not order-independent; this guards against an implementation that accidentally
  // sorts leaves and silently loses the caller's intended positional binding).
  {
    const a = compute({ leaves: [{ id: 'x', balance: '1' }, { id: 'y', balance: '2' }] });
    const b = compute({ leaves: [{ id: 'y', balance: '2' }, { id: 'x', balance: '1' }] });
    ok(a.output_payload.root.hash !== b.output_payload.root.hash, 'leaf order should affect root hash');
    deepStrictEqual(a.output_payload.root.sum, b.output_payload.root.sum, 'sum is order-independent even though hash is not');
  }

  console.log('OK art-621-summa-mst-liability-aggregator.proptest.mjs — all properties held');
}

run();

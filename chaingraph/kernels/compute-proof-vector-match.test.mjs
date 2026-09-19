// @ts-nocheck — plain CLI gate script, never meant to be type-checked; only swept into tsc
// --checkJs's program because it lives under chaingraph/kernels/ (JSDOC-CHECKJS-PREFLIGHT-1's
// path filter watches the whole directory). Without this it fails on bare node:url/node:path/
// process usage — no @types/node is wired in (SO #10) and compute-proof.test.mjs's own
// identical usage is shielded only because those lines predate this row (TOUCHTAX-DIFFSCOPE-1);
// a brand-new file has no such shield. Matches determinism-replay.test.mjs's precedent.
// compute-proof-vector-match.test.mjs — COMPUTE-PROOF-ANY-PUBLISHED-VECTOR-1
//
// FIXTURE-FREE unit test of the §18 vector-matcher used by compute-proof.test.mjs's widened-coverage loop.
// No chaingraph.json read, no *.fixtures.json read, no real kernel — every vector below is an in-memory
// literal. This isolates the MATCHING ALGORITHM from the estate: a red here means the algorithm itself is
// wrong, never that some node's fixture drifted.
//
// Exports (also imported by compute-proof.test.mjs, which has no top-level side effects when imported
// because the `isMain` guard below fences off this file's own gate run):
//   matchVectors(output, vectors)      -> sorted array of indices whose vectors[i].output_payload
//                                          canonically (cgCanon/JCS) equals `output` — never the receipt,
//                                          independent of it (§18.0's independence requirement).
//   honestyStatement(index, vectors)   -> { ok, statement }. index 0 is the implicit default (ok:true,
//                                          statement:null, no new field required). A non-zero index needs
//                                          `vectors[index].name` to be a non-empty descriptive string — the
//                                          fixture vector's own `name` already carries which vector + its
//                                          scale in words (e.g. art-371's "vector-own-inputs (... n_paths
//                                          100, conf 0.95 ...)" fixture name), so no schema/field addition
//                                          is needed for kernels that already name their vectors.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { cgCanon } from './_hash.mjs';

const canon = (o) => JSON.stringify(cgCanon(o ?? null));

export function matchVectors(output, vectors) {
  const target = canon(output);
  const matches = [];
  for (let i = 0; i < vectors.length; i++) {
    if (canon(vectors[i]?.output_payload) === target) matches.push(i);
  }
  return matches;
}

export function honestyStatement(matchedIndex, vectors) {
  if (matchedIndex === 0) return { ok: true, statement: null };
  const name = vectors[matchedIndex]?.name;
  const ok = typeof name === 'string' && name.trim().length > 0;
  return { ok, statement: ok ? name : null };
}

// ── fixture-free self-test — synthetic vectors only ──
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  let fail = 0;
  const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

  const v0 = { name: 'vector-0-default', output_payload: { a: 1, n: 10 } };
  const v1 = { name: 'vector-1-larger-scale (n:1000)', output_payload: { a: 1, n: 1000 } };
  const v2unnamed = { output_payload: { a: 1, n: 5 } }; // no `name` — honesty must fail if matched
  const vDup = { name: 'vector-dup', output_payload: { a: 1, n: 1000 } }; // canonically equal to v1

  // (RED-then-GREEN control 1) zero matches — output not published anywhere.
  {
    const matches = matchVectors({ a: 1, n: 999 }, [v0, v1]);
    ok(matches.length === 0, 'control 1 (zero matches): unpublished output matches no vector');
  }

  // (RED-then-GREEN control 2) two matches — ambiguous, must name both indices, not pick one silently.
  {
    const matches = matchVectors({ a: 1, n: 1000 }, [v0, v1, vDup]);
    ok(matches.length === 2 && matches.join(',') === '1,2',
      `control 2 (ambiguous): output matching two vectors reports BOTH indices (got [${matches.join(',')}])`);
  }

  // (RED-then-GREEN control 3) non-zero match, NO honesty statement (vectors[i].name missing) -> fails.
  {
    const matches = matchVectors({ a: 1, n: 5 }, [v0, v1, v2unnamed]);
    ok(matches.length === 1 && matches[0] === 2, 'control 3 setup: matches unnamed vector at index 2');
    const h = honestyStatement(matches[0], [v0, v1, v2unnamed]);
    ok(h.ok === false, 'control 3 (non-zero, no honesty statement): honestyStatement reports NOT ok');
  }

  // (RED-then-GREEN control 4) non-zero match WITH a descriptive name -> passes.
  {
    const matches = matchVectors({ a: 1, n: 1000 }, [v0, v1]);
    ok(matches.length === 1 && matches[0] === 1, 'control 4 setup: matches named vector at index 1');
    const h = honestyStatement(matches[0], [v0, v1]);
    ok(h.ok === true && h.statement === v1.name, 'control 4 (non-zero, WITH honesty statement): honestyStatement reports ok and the vector\'s own name');
  }

  // (RED-then-GREEN control 5) vector-0 match passes with NO new field required (index 0 is the default).
  {
    const matches = matchVectors({ a: 1, n: 10 }, [v0, v1]);
    ok(matches.length === 1 && matches[0] === 0, 'control 5 setup: matches vector 0');
    const h = honestyStatement(matches[0], [v0, v1]);
    ok(h.ok === true && h.statement === null, 'control 5 (vector-0 match): passes with no new field / no statement required');
  }

  // independence — matching is over the vector's OWN output_payload, never the receipt/output object identity.
  {
    const clone = JSON.parse(JSON.stringify(v0.output_payload));
    const matches = matchVectors(clone, [v0, v1]);
    ok(matches.length === 1 && matches[0] === 0, 'independence: a structurally-equal-but-distinct object still matches by value (JCS canon, not identity)');
  }

  console.log(fail ? `\n✗ ${fail} FAILED` : '\n✓ all compute-proof-vector-match assertions passed');
  process.exit(fail ? 1 : 0);
}

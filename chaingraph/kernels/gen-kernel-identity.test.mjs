// @ts-nocheck — plain CLI utility script, never meant to be type-checked; only
// swept into tsc --checkJs's program because it lives under chaingraph/kernels/
// and touching this directory makes it "touched" (JSDOC-CHECKJS-PREFLIGHT-1's
// own path filter watches the whole directory, not just *.kernel.mjs). Without
// this it fails on bare node:fs/node:child_process/node:os usage — a
// directory-wide @types/node gap (SO #47's exemption only reaches
// chaingraph/kernels/__proptests__/). Same precedent as golden-parity.test.mjs.
//
// gen-kernel-identity.test.mjs — regression fixture for GENKERNELID-UPSERT-FIX-1.
//
// THE DEFECT: gen-kernel-identity.mjs's monolith --write path found a node's
// END boundary by re-searching for "the next tool_id at THIS node's OWN
// indent" — silently assuming every node in chaingraph.json shares one
// uniform indent. It does not: the monolith mixes 2-space (assembler output)
// and 6-space (hand-edited legacy) top-level node formatting. When a node's
// own indent search skipped past a differently-indented neighbor, it swallowed
// every node in between into one oversized blockTxt; if one of the swallowed
// nodes ALSO needed its own edit, the two edits' [start,end) ranges
// overlapped. The apply loop assumes non-overlapping ranges (each edit's
// offsets are computed once against the pristine `raw`, then spliced in
// descending-start order) — an overlap desyncs a later (lower-start) edit's
// `end` against the already-mutated `out`, corrupting the splice.
//
// REPRODUCED, NOT SYNTHESISED: run cold (pre-fix) against the REAL, current
// origin/main chaingraph.json (commit 47779a2929cc8e29e4bbb5cd74f6b490d1bd07a4
// — the exact tree the Lander's monolith --write crashed on), a plain
// `node gen-kernel-identity.mjs --write` threw:
//   SyntaxError: Expected property name or '}' in JSON at position 104526 (line 2301 column 6)
//       at JSON.parse (<anonymous>)
//       at .../gen-kernel-identity.mjs:350:23
// with literal `{e,` garbage sitting at the splice boundary — an uncaught
// crash (fails closed: writeFileSync is never reached, so chaingraph.json was
// never corrupted on disk), but the monolith --write path crashed on every
// invocation against that tree, which blocks the single-writer Lander's whole
// batch (RIDER-KERNEL: chaingraph.json has exactly one writer). The two real
// nodes at the exact swallow boundary were art-18-mcp-developer-readiness-
// scorecard (2-space) and art-19-agentic-checkout-protocol-selector (6-space).
//
// THIS FIXTURE is the minimal real slice that reproduces the SAME root cause
// (adjacent nodes, mixed indent, both in scope) — the three adjacent nodes
// art-18/19/20, extracted VERBATIM from that exact origin/main tree via a
// bracket-depth JSON scanner (not hand-typed, not regex-guessed): art-18's own
// properties sit at 2-space indent, art-19/20's at 6-space, exactly like the
// real trip. In this smaller slice art-18's own next-tool search finds no
// later 2-space node at all (there are only 3 nodes here), so its swallow
// runs to EOF rather than mid-token — which turns the same defect into a
// DIFFERENT, more dangerous symptom worth guarding separately: silent data
// loss. Proven pre-fix on this exact fixture: the write reported
// "3 merged" and exited 0, but art-19 and art-20's compute_images were left
// holding their STALE pre-existing digests — the overlap silently discarded
// two of the three intended edits while claiming success.
//
// Run against a COPY of gen-kernel-identity.mjs + its one import
// (_buildid.mjs) in a throwaway temp dir — this exercises the REAL CLI
// exactly as the Lander invokes it. Never run against the live tree to test
// (board/STANDING-ORDERS.md; this row's own fence).

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── VERBATIM real node text, art-18/19/20, origin/main@47779a2929cc8e29e4bbb5cd74f6b490d1bd07a4 ──
// (see the file header above for provenance and extraction method)
const ART18 = `{
  "tool_id": "art-18-mcp-developer-readiness-scorecard",
  "tool_version": "1.0.0",
  "display_name": "MCP Developer Readiness Scorecard",
  "mcp_name": "score_mcp_server_readiness",
  "mandate_type": "compliance_control",
  "wave": "A",
  "gpu": false,
  "url": "https://ainumbers.co/chaingraph/art-18-mcp-developer-readiness-scorecard.html",
  "description": "Rolls up caller-supplied yes/partial/no answers across six MCP ship-readiness sections into an overall 0-100 score and a prioritized gap list.",
  "input_schema_ref": "chaingraph/art-18-mcp-developer-readiness-scorecard.html#manifest",
  "consumes": [
    "art-17-ap2-mcp-policy-validator"
  ],
  "feeds": [],
  "status": "live",
  "conformance_fixtures": false,
  "compute_capability": "server",
  "compute_images": [
    {
      "system": "sha256-source",
      "image_id": "sha256:c81916c6a7e22cfeeef2b25f1f7aabff7bdbe4b32867e558653e5324e016ab4c",
      "valid_from": "2026-07-10"
    },
    {
      "system": "risc0",
      "image_id": "sha256:a1a0bc89b5b1febaeda3519f6dbade0fa5ac16beeb143c4e1b01689573567bc6",
      "valid_from": "2026-07-31"
    }
  ],
  "compute_proof_ready": "ready",
  "export_capability": [
    "json"
  ]
}`;

const ART19 = `{
      "tool_id": "art-19-agentic-checkout-protocol-selector",
      "tool_version": "1.0.0",
      "display_name": "Agentic Checkout Protocol Selector",
      "mcp_name": "select_agentic_checkout_protocol",
      "mandate_type": "routing_policy",
      "wave": "A",
      "gpu": false,
      "url": "https://ainumbers.co/chaingraph/art-19-agentic-checkout-protocol-selector.html",
      "description": "Scores ACP, UCP, x402, and Visa TAP against platform profile and returns a ranked protocol recommendation.",
      "input_schema_ref": "chaingraph/art-19-agentic-checkout-protocol-selector.html#manifest",
      "consumes": [],
      "feeds": [
        "art-20-acp-ucp-product-feed-conformance-auditor"
      ],
      "status": "live",
      "conformance_fixtures": false,
      "compute_capability": "server",
      "compute_images": [{"system":"sha256-source","image_id":"sha256:4219bb286318e4b2c15e45b65ee7be8d960c49a3f2a805aee2e9b9d49ff797e0","valid_from":"2026-07-10"},{"system":"risc0","image_id":"sha256:a1a0bc89b5b1febaeda3519f6dbade0fa5ac16beeb143c4e1b01689573567bc6","valid_from":"2026-06-28"}],
      "export_capability": [
        "xlsx"
      ]
    }`;

const ART20 = `{
      "tool_id": "art-20-acp-ucp-product-feed-conformance-auditor",
      "tool_version": "1.0.0",
      "display_name": "ACP/UCP Product-Feed Conformance Auditor",
      "mcp_name": "audit_acp_ucp_product_feed",
      "mandate_type": "scheme_rule",
      "wave": "A",
      "gpu": false,
      "url": "https://ainumbers.co/chaingraph/art-20-acp-ucp-product-feed-conformance-auditor.html",
      "description": "Validates product/checkout/mandate JSON payloads against ACP or UCP field schemas.",
      "input_schema_ref": "chaingraph/art-20-acp-ucp-product-feed-conformance-auditor.html#manifest",
      "consumes": [
        "art-19-agentic-checkout-protocol-selector"
      ],
      "feeds": [],
      "status": "live",
      "conformance_fixtures": false,
      "compute_capability": "server",
      "compute_images": [{"system":"sha256-source","image_id":"sha256:6fcabf3a24030e00fb8df1723c7c77039066139306f2100a0bb8a97b53eb07c8","valid_from":"2026-07-10"},{"system":"risc0","image_id":"sha256:a1a0bc89b5b1febaeda3519f6dbade0fa5ac16beeb143c4e1b01689573567bc6","valid_from":"2026-06-28"}],
      "export_capability": [
        "xlsx"
      ]
    }`;

const IDS = [
  'art-18-mcp-developer-readiness-scorecard',
  'art-19-agentic-checkout-protocol-selector',
  'art-20-acp-ucp-product-feed-conformance-auditor',
];

const INDEX_STUB = `export const KERNELS = {\n${IDS.map((id) => `  ${JSON.stringify(id)}: null,`).join('\n')}\n};\n`;
const STUB_KERNEL_SRC = '// fixture stub — content is irrelevant to the boundary bug, only its digest is exercised.\nexport function compute() { return {}; }\n';

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}${detail ? '\n    ' + String(detail).replace(/\n/g, '\n    ') : ''}`); }
}

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'genkernelid-fixture-'));
  const kdir = join(dir, 'chaingraph', 'kernels');
  mkdirSync(kdir, { recursive: true });
  // Real modules, copied verbatim — never a reproduction of their content.
  cpSync(resolve(__dirname, 'gen-kernel-identity.mjs'), join(kdir, 'gen-kernel-identity.mjs'));
  cpSync(resolve(__dirname, '_buildid.mjs'), join(kdir, '_buildid.mjs'));
  writeFileSync(join(kdir, 'index.mjs'), INDEX_STUB);
  for (const id of IDS) writeFileSync(join(kdir, id + '.kernel.mjs'), STUB_KERNEL_SRC);
  return { dir, kdir };
}

// ── CASE 1: the real mixed-indent trio upserts correctly (GREEN) ──────────
// All three nodes must end up with a FRESH digest matching the stub kernel
// source (proving no edit was silently dropped by an overlap), the file must
// stay valid JSON, and nothing beyond compute_images may move.
{
  const { dir, kdir } = makeSandbox();
  try {
    const doc = '{\n  "nodes": [\n' + ART18 + ',\n' + ART19 + ',\n' + ART20 + '\n  ]\n}\n';
    // Sanity: the hand-assembled fixture itself must be valid JSON with the
    // three real node objects present, before the script under test ever
    // touches it.
    const pre = JSON.parse(doc);
    check('fixture assembles to 3 valid node objects', pre.nodes?.length === 3, JSON.stringify(pre.nodes?.map((n) => n.tool_id)));
    writeFileSync(join(dir, 'chaingraph', 'chaingraph.json'), doc);

    const out = execFileSync('node', ['gen-kernel-identity.mjs', '--write'], { cwd: kdir, encoding: 'utf8' });
    check('write exits 0 and reports all 3 stamped', /stamped 3 node/.test(out), out);

    const after = JSON.parse(readFileSync(join(dir, 'chaingraph', 'chaingraph.json'), 'utf8'));
    check('output is still valid JSON with 3 nodes', after.nodes?.length === 3);
    const today = new Date().toISOString().slice(0, 10);
    const digests = new Set();
    for (const id of IDS) {
      const n = after.nodes.find((x) => x.tool_id === id);
      const src = (n?.compute_images ?? []).find((i) => i.system === 'sha256-source');
      check(`${id}: carries a FRESH sha256-source entry (not a stale/reused one)`,
        !!src && src.valid_from === today, src && JSON.stringify(src));
      if (src) digests.add(src.image_id);
      // Non-compute_images fields must be untouched.
      check(`${id}: display_name untouched`, n?.display_name === pre.nodes.find((x) => x.tool_id === id).display_name);
      check(`${id}: risc0 compute_images entry preserved`, (n?.compute_images ?? []).some((i) => i.system === 'risc0'));
    }
    // All three stub kernels are byte-identical, so all three digests must
    // match ONE value — if the historical bug reasserts itself, one or two
    // of them silently keep their OLD (pre-existing, differing) digest
    // instead, and this collapses to more than one distinct value.
    check('all 3 nodes share ONE digest (none silently skipped)', digests.size === 1, [...digests]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── CASE 2: genuinely malformed input still REFUSES (fail-closed control) ─
// A node with neither a compute_images entry NOR a compute_capability line
// gives the generator nowhere structurally sound to insert — it must still
// throw and exit non-zero, proving the fix did not trade fail-closed for
// fail-open.
{
  const { dir, kdir } = makeSandbox();
  try {
    const malformed = ART20.replace(/"compute_capability": "server",\n\s*/, '').replace(/"compute_images": \[.*?\],\n\s*/s, '');
    // Sanity: the malformed fixture is itself valid JSON (the ambiguity is
    // structural per this generator's own contract, not a JSON syntax error)
    // and genuinely lacks both anchors.
    const parsedMalformed = JSON.parse(malformed);
    check('malformed fixture is valid JSON', typeof parsedMalformed === 'object');
    check('malformed fixture genuinely lacks compute_capability', !('compute_capability' in parsedMalformed));
    check('malformed fixture genuinely lacks compute_images', !('compute_images' in parsedMalformed));

    const doc = '{\n  "nodes": [\n' + ART18 + ',\n' + ART19 + ',\n' + malformed + '\n  ]\n}\n';
    writeFileSync(join(dir, 'chaingraph', 'chaingraph.json'), doc);

    let threw = false, detail = '';
    try {
      execFileSync('node', ['gen-kernel-identity.mjs', '--write'], { cwd: kdir, encoding: 'utf8' });
    } catch (e) {
      threw = true;
      detail = (e.stderr || e.stdout || e.message || '').toString();
    }
    check('write still refuses on structurally ambiguous input', threw, detail || '(no error thrown — FAIL-OPEN REGRESSION)');
    check('refusal names the anchor problem, not a generic crash', /no compute_capability anchor/.test(detail), detail);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`\n${fail === 0 ? '✓' : '✗'} gen-kernel-identity.test.mjs — ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);

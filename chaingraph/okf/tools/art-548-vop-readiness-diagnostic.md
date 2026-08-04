---
type: DecisionTool
title: "VoP Readiness Diagnostic"
description: "EU Instant Payments Regulation Verification-of-Payee (VoP) readiness/consistency diagnostic. Deterministically classifies a caller-declared match_score against caller-declared thresholds into match, close_match, no_match, or not_verifiable, then cross-checks that classification against the caller-declared psp_vop_response_code -- flagging, never silently correcting, a mismatch. Outcome-attestation shape, not recompute-the-match: this node does not implement the EPC VoP fuzzy name-matching algorithm and makes no live IBAN/account-holder-name directory call. Carries an OCG Standard §25 ocg-private-input@1 declaration: the IBAN, payee name, and account-holder identifier (if collected) are committed via sha256-salted@1, never in the clear. Distinct from simulate_vop_matching (art-11, a batch aggregate match-rate analyser using its own similarity math), score_payee_name_match (art-376, computes a name-match score from a name pair), and build_vop_session_receipt (art-377, builds the downstream session receipt); use this node for the upstream threshold/response-code consistency check. ZERO plaintext PII disclosed."
resource: https://ainumbers.co/chaingraph/art-548-vop-readiness-diagnostic.html
tags: ["vop_readiness_attestation", "wave-52", "mcp:run_vop_readiness_diagnostic"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-548-vop-readiness-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-548-vop-readiness-diagnostic.html
    title: "public tool page"
---

# VoP Readiness Diagnostic

> Exports a decision via MCP `run_vop_readiness_diagnostic` — mandate type `vop_readiness_attestation`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-548-vop-readiness-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-548-vop-readiness-diagnostic.md) — §10.2.

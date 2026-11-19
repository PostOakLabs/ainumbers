---
type: DecisionTool
title: "Open-Source Agent-Governance Audit-Chain Verifier"
description: "Recomputes the hash chain of an exported agent-governance audit log offline, from the exported entries alone, and reports exactly where it breaks. Subject format: the open-source agent-governance-toolkit audit-log format (MIT), pinned at upstream commit 3433fa7: each link hash is sha256 over a Python json.dumps(sort_keys=True) serialisation of the entry (default separators, ensure_ascii=True, parent_hash null coalesced to empty string) , deliberately not RFC 8785; the chain root is the last link hash, not a Merkle root. Input: the exported entries (values only) plus an optional claimed root. Output: entry_count, chain_intact, first_break_index, per-break reason codes (HASH_MISMATCH, CHAIN_BROKEN), recomputed_root, and claimed_root_match. Fail-closed: any field outside the pinned entry schema (including free-form payloads, floats, or unknown keys) rejects the whole input, naming each rejected field; entry content is never echoed , the output carries hashes and indices only. The format carries no keyed signature field, so signature_status is reported as not checkable. Scope limits: verifies structural hash integrity and linkage only; it does not attribute blame, interpret change semantics, or validate timestamps against wall-clock time."
resource: https://ainumbers.co/chaingraph/art-805-agt-audit-chain-verifier.html
tags: ["compliance_control", "wave-142", "mcp:verify_agent_governance_audit_chain"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-805-agt-audit-chain-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-805-agt-audit-chain-verifier.html
    title: "public tool page"
---

# Open-Source Agent-Governance Audit-Chain Verifier

> Exports a decision via MCP `verify_agent_governance_audit_chain` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-805-agt-audit-chain-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-805-agt-audit-chain-verifier.md) — §10.2.

---
type: DecisionTool
title: "ACDC Delegation Chain Verifier"
description: "Verifies a chain of Authentic Chained Data Containers (ACDC): per-credential SAID self-addressing integrity, issuer-to-issuee edge linkage between successive credentials, schema SAID match, termination at a stated root AID, and revocation-status passthrough (report, never resolve). KERI/ACDC/CESR ratified by the Trust over IP Foundation, January 2026. Verify-only; JSON-serialized ACDCs only, CESR binary streams not yet accepted."
resource: https://ainumbers.co/chaingraph/art-285-acdc-delegation-chain-verifier.html
tags: ["compliance_mandate", "wave-50", "mcp:verify_acdc_delegation_chain"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-285-acdc-delegation-chain-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-285-acdc-delegation-chain-verifier.html
    title: "public tool page"
---

# ACDC Delegation Chain Verifier

> Exports a decision via MCP `verify_acdc_delegation_chain` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-285-acdc-delegation-chain-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [did:webvh DID Log Verifier](./art-284-did-webvh-log-verifier.md)

**Feeds:** _terminal node_

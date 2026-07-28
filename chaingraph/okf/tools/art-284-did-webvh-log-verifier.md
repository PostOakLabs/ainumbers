---
type: DecisionTool
title: "did:webvh DID Log Verifier"
description: "Verifies a did:webvh self-certifying DID log: per-entry self-hash integrity, sequential versionId numbering, update-key-authorized Ed25519 signatures on every entry, deactivation status, and optional resolved-document match. did:webs is superseded by did:webvh (DIF/ToIP, June 2026). Verify-only: never operates witness/registry infrastructure, never resolves a live document over the network."
resource: https://ainumbers.co/chaingraph/art-284-did-webvh-log-verifier.html
tags: ["compliance_mandate", "wave-50", "mcp:verify_did_webvh_log"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-284-did-webvh-log-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-284-did-webvh-log-verifier.html
    title: "public tool page"
---

# did:webvh DID Log Verifier

> Exports a decision via MCP `verify_did_webvh_log` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-284-did-webvh-log-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agent Identity & Authorization Attestation Checker](./art-04-agent-identity-attestation-checker.md)

**Feeds:** [ACDC Delegation Chain Verifier](./art-285-acdc-delegation-chain-verifier.md)

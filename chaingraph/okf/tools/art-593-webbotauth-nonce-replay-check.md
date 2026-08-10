---
type: DecisionTool
title: "Web Bot Auth Nonce & Replay-Window Checker"
description: "Checks a Visa TAP-shaped nonce for format (minimum entropy, base64url), freshness against a caller-supplied now_unix (created/expires spread capped at TAP's 8-minute limit), and an optional caller-supplied seen-nonce record. This kernel is a pure function invoked fresh per call with zero persistent storage -- it cannot itself remember whether a nonce was seen on a prior invocation. Replay prevention depends entirely on the caller supplying an accurate seen-nonce record from its own storage; this verifier is stateless and cannot detect replay on its own. Zero network calls; never a facilitator, proxy, or settlement relay. Feeds the signatures-directory validator (art-130) in the visa-tap-agent-verification chain."
resource: https://ainumbers.co/chaingraph/art-593-webbotauth-nonce-replay-check.html
tags: ["compliance_control", "wave-99", "mcp:check_webbotauth_nonce_replay"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-593-webbotauth-nonce-replay-check.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-593-webbotauth-nonce-replay-check.html
    title: "public tool page"
---

# Web Bot Auth Nonce & Replay-Window Checker

> Exports a decision via MCP `check_webbotauth_nonce_replay` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-593-webbotauth-nonce-replay-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [HTTP Signatures Directory Validator](./art-130-signature-directory-validator.md)

## Attested computation

[executor + attester binding](../computations/art-593-webbotauth-nonce-replay-check.md) — §10.2.

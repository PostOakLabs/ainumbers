---
type: DecisionTool
title: "Qr Interop Uat Pack"
description: "Generates a QR payment scheme participant user-acceptance test pack from a declared participant list (pseudonymous codes and issuer/acquirer/wallet/aggregator roles) and a scheme profile (generic, fjqr, pix_brcode). The interoperability matrix covers every ordered presenter/payer pair whose roles can transact, at most N x (N-1), with self-pairs and role-impossible pairs excluded and counted with reasons. Each transactable pair gets positive static and dynamic cases and negative cases described as mutations only (bad CRC including the excluded-6304 generator bug, wrong profile-pinned currency, missing merchant account template, malformed tag 62, static payload carrying an amount where the profile forbids it), plus optional reversal, refund, dispute and payee-name outcome cases, phased domestic first and then cross-border when foreign link profiles are declared. Case ids are content-derived and stable, counts are per phase and kind, and per-phase exit criteria are emitted. Scope limits: no payloads with real participant, merchant or account data are accepted or emitted; negative cases are described as mutations, never emitted as live QR strings; no network, no signature verification, no endorsement by EMVCo, any central bank or the World Bank is implied."
resource: https://ainumbers.co/chaingraph/art-786-qr-interop-uat-pack.html
tags: ["compliance_control", "wave-139", "mcp:build_qr_interop_uat_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-786-qr-interop-uat-pack.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-786-qr-interop-uat-pack.html
    title: "public tool page"
---

# Qr Interop Uat Pack

> Exports a decision via MCP `build_qr_interop_uat_pack` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-786-qr-interop-uat-pack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-786-qr-interop-uat-pack.md) — §10.2.

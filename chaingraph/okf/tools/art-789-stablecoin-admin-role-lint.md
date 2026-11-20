---
type: DecisionTool
title: "Stablecoin Admin Role Lint"
description: "Lints a stablecoin token's declared admin-role configuration for separation of duties, key concentration and issuance-policy fit, over ROLE LABELS ONLY (never addresses or key material). Given a profile (Circle FiatToken, Paxos USDP, or generic caller-declared), holder kinds (eoa, multisig, timelock, hsm_service), a role-to-holder map (owner, proxy_admin, master_minter, pauser, blacklister, rescuer, supply_controller, asset_protection as the profile defines), minter allowances and an issuance policy, it reports: distinctness pairs held by the same label; labels holding multiple critical roles and single-signer holders of critical roles; per-minter and total allowance breaches against the declared ceilings; and whether pause, freeze and upgrade capabilities exist and who holds them. Verdict is PASS, PASS_WITH_FINDINGS or FAIL, each finding cited to the pinned source or marked caller-declared policy. Scope limits: configuration lint only: no live-chain reads, no key custody advice, no statutory claims (no lawful-order or GENIUS Act obligations are asserted); reserve-evidence questions are out of scope (art-06, art-275 cover reserve evidence; art-45 is the sibling linter for Arc xReserve bridge configuration). Any label resembling an address, public key or private key is refused."
resource: https://ainumbers.co/chaingraph/art-789-stablecoin-admin-role-lint.html
tags: ["compliance_control", "wave-140", "mcp:lint_stablecoin_admin_roles"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-789-stablecoin-admin-role-lint.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-789-stablecoin-admin-role-lint.html
    title: "public tool page"
---

# Stablecoin Admin Role Lint

> Exports a decision via MCP `lint_stablecoin_admin_roles` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-789-stablecoin-admin-role-lint.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-789-stablecoin-admin-role-lint.md) — §10.2.

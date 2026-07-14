---
type: DecisionTool
title: "Canton Party Allowlist Validator"
description: "Screen counterparties against FATF Travel Rule, AML/KYA requirements, and canton allowlist rules for Canton Network onboarding. Emits allowlist_verdict, FATF flags, and approved party list."
resource: https://ainumbers.co/tools/509-canton-party-allowlist-validator.html
tags: ["compliance_mandate", "wave-8", "mcp:validate_canton_party_allowlist", "iso20022:party-identification"]
timestamp: 2026-07-14
---

# Canton Party Allowlist Validator

> Exports a decision via MCP `validate_canton_party_allowlist` — mandate type `compliance_mandate`.

**Context:** Canton counterparty onboarding. FATF Recommendation 16 Travel Rule; AMLAR/6AMLD KYA requirements.

**Semantic profile:** `iso20022:party-identification` (ISO 20022-aligned)

**Conforms to (`dct:conformsTo`):** <https://ainumbers.co/chaingraph/profiles/iso20022/party-identification.jsonld>

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/509-canton-party-allowlist-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

---
type: DecisionTool
title: "Workload Identity Claims Lint"
description: "Lints the DECODED claims of a workload-identity token and, optionally, of a token produced by an exchange, against a policy you declare: a maximum lifetime in seconds, a maximum actor-chain depth, required audience values, an allowed trust-domain list, and whether the exchanged scope must narrow. Checks that the subject is a well-formed SPIFFE identifier in an allowed trust domain, that the audience is present and matches, that expiry is present and the lifetime stays within the declared maximum, that issued-at and not-before are sane against a clock you supply, that every actor in the actor chain is an identifier and the chain is not deeper than allowed, that a may-act claim is consistent with the first actor of the exchanged token, and that an exchanged scope is a subset of the subject scope and the exchanged audience or resource is not wider. The verdict is within policy, outside policy, or indeterminate when a claim the policy needs is absent; an absent claim is never guessed. Values only: names, e-mail addresses, free text, unknown claims, signature material and anything shaped like a compact signed token are refused with an explicit code and never echoed, as are claim values of the wrong type, negative numeric dates, and a may-act claim that is not one well-formed actor object. Lints claims you paste against a policy you declare. It does not verify signatures, does not contact an identity provider and does not prove the token is genuine."
resource: https://ainumbers.co/chaingraph/844-workload-identity-claims.html
tags: ["compliance_control", "wave-147", "mcp:lint_workload_identity_token_claims"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/844-workload-identity-claims.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/844-workload-identity-claims.html
    title: "public tool page"
---

# Workload Identity Claims Lint

> Exports a decision via MCP `lint_workload_identity_token_claims` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/844-workload-identity-claims.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/844-workload-identity-claims.md) — §10.2.

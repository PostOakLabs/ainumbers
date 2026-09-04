---
type: DecisionTool
title: "Proxy Voting Record"
description: "Deterministic proxy-voting record arithmetic over caller-declared synthetic inputs. From a declared meeting record date and vote deadline, declared record-date positions, and a declared voting instruction, it computes: entitled_shares as the sum of record-date position shares; days_before_deadline as whole UTC calendar days from the declared instruction received date to the declared deadline; instruction_within_deadline as whether received is not after the deadline; and an overall execution-confirm verdict of VOTE_RECORDED when the instruction is within the deadline or INSTRUCTION_LATE when it is not, with the late instruction still reported rather than dropped. No registrar, no share register, no SSR tape, no borrow list, no cutoff feed, no network, no clock: every date, position, and instruction is a caller-declared input, never fetched or inferred. This is a record-keeping calculator, NOT voting advice, NOT a recommendation on how to vote, NOT a proxy solicitation, and NOT a submission channel: no instruction is transmitted anywhere. An absent or malformed date, position list, or instruction resolves to a fail-closed payload naming each rejected input, never a silently repaired record. Settled calendar and quantity arithmetic; it cites no external standard."
resource: https://ainumbers.co/tools/676-proxy-voting-record.html
tags: ["compliance_control", "wave-114", "mcp:compute_proxy_voting_record"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-676-proxy-voting-record.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/676-proxy-voting-record.html
    title: "public tool page"
---

# Proxy Voting Record

> Exports a decision via MCP `compute_proxy_voting_record` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/676-proxy-voting-record.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-676-proxy-voting-record.md) — §10.2.

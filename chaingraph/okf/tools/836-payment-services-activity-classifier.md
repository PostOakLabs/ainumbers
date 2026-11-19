---
type: DecisionTool
title: "Payment Services Activity Classifier"
description: "Reads a caller-declared business model as a closed set of boolean payment-activity facts and classifies it into the licence classes of one of three pinned payment-services regimes: Bermuda’s proposed Payment Services Act (consultation-response status: proposed, never presented as enacted), EU PSD2 Annex I with its Article 3 exclusions, and the UK Payment Services Regulations 2017 Schedule 1 Parts 1 and 2. Considers the regime’s exclusions against the declared facts (technical service providers, one-sided commercial agents, limited-network instruments), reports conflicts such as a declared technology-only model that holds customer funds, and emits transition notes (for example the transition note for existing Bermuda money service businesses). Refuses an unknown profile or a missing activities object with a recorded reason, and records non-boolean activity values as rejected inputs. The output is a structured reading of declared facts against pinned primary text, not legal advice: every payload carries not_legal_advice: true, and the page makes the same statement. Scope limits: no real firms or licence statuses, no threshold or perimeter arithmetic, no consumer-rights obligations (PSD2 Title III), and the Bermuda reading reflects proposed text only."
resource: https://ainumbers.co/chaingraph/836-payment-services-activity-classifier.html
tags: ["compliance_control", "wave-141", "mcp:classify_payment_services"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/836-payment-services-activity-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/836-payment-services-activity-classifier.html
    title: "public tool page"
---

# Payment Services Activity Classifier

> Exports a decision via MCP `classify_payment_services` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/836-payment-services-activity-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/836-payment-services-activity-classifier.md) — §10.2.

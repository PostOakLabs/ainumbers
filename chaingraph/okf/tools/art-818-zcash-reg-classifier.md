---
type: DecisionTool
title: "Privacy Coin Regulatory Classifier (MiCA and AMLR)"
description: "Places caller-declared properties of a privacy-feature coin and of the declaring entity against two pinned provisions of the Official Journal text: Article 76(3) of Regulation (EU) 2023/1114 (operating rules of a trading platform for crypto-assets and an inbuilt anonymisation function, with the unless clause on identifiability of holders and transaction history) and Article 79(1) of Regulation (EU) 2024/1624 (the prohibition on accounts allowing anonymisation or increased obfuscation of transactions, including through anonymity-enhancing coins). Application dates come from the text: 30 December 2024 for the first (Article 149(2)), 10 July 2027 for the second, or 10 July 2029 for obliged entities in Article 3(3) points (n) and (o) (Article 90); before those dates the rule is reported as not yet applicable and is never presented as in force. Each rule cites its pinned paragraph. The output is a classification of the declared inputs against the text: whether a coin has an inbuilt anonymisation function, or whether an account allows anonymisation or obfuscation, is declared by the caller and is not judged here, and the declarations are not verified. This is technical documentation, not legal advice. Malformed input is refused with INPUT_REFUSED."
resource: https://ainumbers.co/chaingraph/art-818-zcash-reg-classifier.html
tags: ["compliance_mandate", "wave-142", "mcp:classify_privacy_coin_regulatory_treatment"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-818-zcash-reg-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-818-zcash-reg-classifier.html
    title: "public tool page"
---

# Privacy Coin Regulatory Classifier (MiCA and AMLR)

> Exports a decision via MCP `classify_privacy_coin_regulatory_treatment` — mandate type `compliance_mandate`.

**Context:** No deadline of its own: the node reports the application dates the pinned text states.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-818-zcash-reg-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-818-zcash-reg-classifier.md) — §10.2.

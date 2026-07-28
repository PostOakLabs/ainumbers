---
type: DecisionTool
title: "Agent Incident Record Composer"
description: "Composes a structured agent incident/failure record from caller-declared inputs: agent identity, an optional mandate hash, an incident description with an honest severity class, session evidence digests, remediation status, and an optional cross-link to an escalation record or a signed failure receipt. A missing agent identity degrades the record's claim strength rather than being silently accepted, and a malformed cross-link hash is flagged, not hidden. This is an evidence format for an incident the caller declares, not an incident-detection system, not a determination of fault, and not an insurance adjudication. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-379-agent-incident-record-composer.html
tags: ["compliance_mandate", "wave-65", "mcp:build_agent_incident_record"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-379-agent-incident-record-composer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-379-agent-incident-record-composer.html
    title: "public tool page"
---

# Agent Incident Record Composer

> Exports a decision via MCP `build_agent_incident_record` — mandate type `compliance_mandate`.

**Context:** No regulatory deadline; evidence-format tooling recorded on the adopter's own incident-response cadence.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-379-agent-incident-record-composer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

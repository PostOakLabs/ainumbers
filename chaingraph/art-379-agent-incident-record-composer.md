# Agent Incident Record Composer

Composes a structured agent incident/failure record from caller-declared inputs: agent identity, an optional mandate hash, an incident description with an honest severity class, session evidence digests, remediation status, and an optional cross-link to an escalation record or a signed failure receipt. A missing agent identity degrades the record's claim strength rather than being silently accepted, and a malformed cross-link hash is flagged, not hidden. This is an evidence format for an incident the caller declares, not an incident-detection system, not a determination of fault, and not an insurance adjudication. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-379-agent-incident-record-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-379-agent-incident-record-composer.md
- MCP tool: build_agent_incident_record (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agent_identity (unknown, required)
- escalation_cross_link (unknown, required)
- incident (unknown, required)
- mandate_hash (unknown, required)
- remediation (unknown, required)
- session_evidence (unknown, required)

## Outputs

- agent_identity (object, optional)
- cross_linked (boolean, optional)
- escalation_cross_link (object, optional)
- evidence_count (integer, optional)
- incident (object, optional)
- invalid_evidence_count (integer, optional)
- mandate_hash (string, optional)
- record_claim_strength (string, optional)
- record_note (string, optional)
- remediation (object, optional)
- session_evidence (array, optional)

## Sample

```json
{
  "agent_identity": {
    "agent_id": "agent://underwriting-bot/v3",
    "agent_version": "3.2.1"
  },
  "mandate_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "incident": {
    "incident_id": "INC-2026-0417",
    "description": "Agent issued three duplicate payment instructions within a single session.",
    "severity_class": "contraindicated",
    "detected_at": "2026-07-18T14:02:00Z"
  },
  "session_evidence": [
    {
      "evidence_type": "otel_span",
      "digest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    },
    {
      "evidence_type": "in_toto_link",
      "digest": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    }
  ],
  "remediation": {
    "status": "in_progress",
    "notes": "Duplicate instruction #3 held pending manual review."
  },
  "escalation_cross_link": {
    "escalation_record_hash": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    "failure_receipt_hash": null
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_agent_incident_record` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

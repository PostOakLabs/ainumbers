# IDV/KYC Verification-Failure Incident Composer

Composes a structured verification-failure/fraud-attempt incident record from an IDV/KYC session for fraud teams, regulators, and insurers: a cross-link to the session's hash-chained receipt (art-359), an honest failure classification (type + AR4SI severity tier), session evidence digests, remediation status, and an optional cross-link to an escalation record or a signed failure receipt. Reuses the art-379 agent-incident-record shape and vocabulary. A missing session-receipt link degrades the record's claim strength rather than being silently accepted, and a malformed cross-link hash is flagged, not hidden. This is an evidence format for an incident the caller declares, not a fraud-detection system, not a determination of fault, and not a regulatory or insurance adjudication. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-418-idv-verification-failure-incident-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-418-idv-verification-failure-incident-composer.md
- MCP tool: build_idv_verification_incident_record (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- escalation_cross_link (unknown, required)
- failure_classification (unknown, required)
- remediation (unknown, required)
- session_evidence (unknown, required)
- session_receipt (unknown, required)

## Outputs

- cross_linked (boolean, optional)
- escalation_cross_link (object, optional)
- evidence_count (integer, optional)
- failure_classification (object, optional)
- invalid_evidence_count (integer, optional)
- record_claim_strength (string, optional)
- record_note (string, optional)
- remediation (object, optional)
- session_evidence (array, optional)
- session_receipt (object, optional)

## Sample

```json
{
  "session_receipt": {
    "session_id": "sess-2026-0001",
    "verifier_id": "vendor-alpha-idv",
    "receipt_hash": "sha256:11111111111111111111111111111111111111111111111111111111111111"
  },
  "failure_classification": {
    "incident_id": "INC-IDV-2026-0090",
    "failure_type": "injection_detected",
    "description": "Virtual-camera injection flagged mid-session by the injection-detection vendor.",
    "severity_class": "contraindicated",
    "detected_at": "2026-07-20T09:12:00Z"
  },
  "session_evidence": [
    {
      "evidence_type": "otel_span",
      "digest": "sha256:22222222222222222222222222222222222222222222222222222222222222"
    },
    {
      "evidence_type": "in_toto_link",
      "digest": "sha256:33333333333333333333333333333333333333333333333333333333333333"
    }
  ],
  "remediation": {
    "status": "in_progress",
    "notes": "Session flagged for manual fraud-team review; verifier account suspended pending outcome."
  },
  "escalation_cross_link": {
    "escalation_record_hash": "sha256:44444444444444444444444444444444444444444444444444444444444444",
    "failure_receipt_hash": null
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_idv_verification_incident_record` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

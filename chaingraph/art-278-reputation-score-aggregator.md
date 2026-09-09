# Provable Reputation Score Aggregator

Aggregates a set of OCG execution receipts (attestations) into a deterministic, groth16-provable reputation score across competence, integrity, timeliness, and cooperation. Exponential decay by age, self-issued attestations excluded, duplicate receipts deduped. Aggregation-math design credit: Vouch Protocol (Apache-2.0, never a runtime dependency); this is a clean-room reimplementation of the aggregation math only.

- Page: https://ainumbers.co/chaingraph/art-278-reputation-score-aggregator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-278-reputation-score-aggregator.md
- MCP tool: aggregate_reputation_score (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, optional)
- attestations (unknown, required)
- decay_half_life_days (number, optional): Duration in days
- subject_id (unknown, optional)

## Outputs

- as_of (string, optional)
- attestation_count (integer, optional)
- composite (number, optional)
- decay_half_life_days (integer, optional)
- dims (object, optional)
- excluded_self_issued (integer, optional)
- insufficient_evidence (boolean, optional)
- subject_id (string, optional)

## Sample

```json
{
  "subject_id": "agent-alpha",
  "as_of": "2026-01-01",
  "decay_half_life_days": 180,
  "attestations": [
    {
      "subject_id": "agent-alpha",
      "issuer_id": "agent-beta",
      "receipt_hash": "sha256:aaa1",
      "dims": {
        "competence": 0.8,
        "integrity": 0.6,
        "timeliness": 0.4,
        "cooperation": 0.2
      },
      "issued_at": "2025-12-02"
    },
    {
      "subject_id": "agent-alpha",
      "issuer_id": "agent-gamma",
      "receipt_hash": "sha256:bbb2",
      "dims": {
        "competence": 0.4,
        "integrity": 0.4,
        "timeliness": 0.4,
        "cooperation": 0.4
      },
      "issued_at": "2025-11-02"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `aggregate_reputation_score` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

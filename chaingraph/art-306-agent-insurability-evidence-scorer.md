# Agent Insurability Evidence Scorer

Scores an agent execution evidence bundle for underwriter-facing evidence completeness across four dimensions (determinism, replayability, oversight density, dispute history) using a version-pinned rubric selected by underwriter_profile: aiuc, aisure (Munich Re aiSure evidence-doc list), armilla (KPI-warranty dimensions), or generic (equal-weight union). Optional incident_history (shared incident_record schema) and reputation inputs are supported; self-asserted reputation is recorded but zero-weighted in the composite. This scores evidence completeness only, never an insurability decision, a reserve attestation, or an insurable/not-insurable verdict - selling or underwriting insurance is out of scope. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-306-agent-insurability-evidence-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-306-agent-insurability-evidence-scorer.md
- MCP tool: score_agent_insurability_evidence (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- execution_claims (unknown, required)
- incident_history (unknown, required)
- receipts (unknown, required)
- reputation (unknown, required)
- underwriter_profile (unknown, required)

## Outputs

- composite (number, optional)
- dims (object, optional)
- incident_history_provided (boolean, optional)
- insufficient_evidence (boolean, optional)
- reputation_self_asserted (boolean, optional)
- rubric_version (string, optional)
- underwriter_profile (string, optional)

## Sample

```json
{
  "underwriter_profile": "aiuc",
  "execution_claims": [
    {
      "execution_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "human_oversight": true
    },
    {
      "execution_hash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "human_oversight": false
    }
  ],
  "receipts": [
    {
      "receipt_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    {
      "receipt_hash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_agent_insurability_evidence` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

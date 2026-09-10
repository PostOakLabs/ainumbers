# Claim Dispute Bundle Builder

Assembles a two-sided replay-challenge dossier for a disputed execution_claim: binds the claim digest and challenge to replay instructions and receipt digests, and, when a warranty_kpi_breach input is supplied (matching both Armilla Guaranteed and Munich Re aiSure settlement shapes), computes measured-vs-threshold from the supplied receipts and records breach or no-breach as a replayable claim. Never a settlement decision - the bundle serves both the underwriter and the insured party reviewing the same replay instructions. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-307-claim-dispute-bundle-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-307-claim-dispute-bundle-builder.md
- MCP tool: build_claim_dispute_bundle (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- challenge (unknown, required)
- execution_claim (unknown, required)
- warranty_kpi_breach (unknown, required)

## Outputs

- bundle_claim_strength (string, optional)
- challenge_digest (string, optional)
- claim_digest (string, optional)
- insufficient_evidence (boolean, optional)
- kpi_breach (object, optional)
- receipts (array, optional)
- replay_instructions (string, optional)

## Sample

```json
{
  "execution_claim": {
    "execution_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "tool_id": "art-251-compute-parametric-trigger-payout",
    "receipts": [
      {
        "receipt_hash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      }
    ]
  },
  "challenge": {
    "digest": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  },
  "warranty_kpi_breach": {
    "kpi": "uptime_pct",
    "threshold": 99.5,
    "direction": "below",
    "receipts": [
      {
        "receipt_hash": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        "measured_metric": 97.2
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_claim_dispute_bundle` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

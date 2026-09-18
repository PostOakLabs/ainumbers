# Ledger Consensus Finality Classifier

Classifies a ledger-consensus position under a deadline-bounded-inclusion model (XRPL) or a federated-BFT model (Stellar SCP), each expressed as terminal outcome branches rather than a monotone tier ladder. Flags an overstated finality claim and a fee-consuming tec final failure, and names the unprovable-absence gap where validated history is not continuous. Caller-supplied signed ledger facts only: no live network fetch, no witness/light-client infrastructure, no embedded validator-list snapshot. Zero PII. Client-side.

- Page: https://ainumbers.co/chaingraph/art-527-classify-ledger-consensus-finality.html
- Markdown twin: https://ainumbers.co/chaingraph/art-527-classify-ledger-consensus-finality.md
- MCP tool: classify_ledger_consensus_finality (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_ts (any, required): type not evidenced by kernel source
- chain_label (any, required): type not evidenced by kernel source
- claimed_outcome (any, required): type not evidenced by kernel source
- claimed_tier (any, required): type not evidenced by kernel source
- continuous_history_ok (any, required): type not evidenced by kernel source
- externalized (any, required): type not evidenced by kernel source
- highest_validated_ledger (any, required): type not evidenced by kernel source
- included_in_ledger (any, required): type not evidenced by kernel source
- issuer_clawback_enabled (any, required): type not evidenced by kernel source
- last_ledger_sequence (any, required): type not evidenced by kernel source
- ledger_validated (any, required): type not evidenced by kernel source
- quorum_slice_trust_ok (any, required): type not evidenced by kernel source
- required_tier (any, required): type not evidenced by kernel source
- result_class (any, required): type not evidenced by kernel source
- settlement_model (any, required): type not evidenced by kernel source
- submitted_at_ledger (any, required): type not evidenced by kernel source
- time_bounds_max (any, required): type not evidenced by kernel source

## Outputs

- settlement_model (string, optional)
- outcome (string, optional)
- finality_tier (string, optional)
- reorg_exposure (string, optional)
- required_tier (string, optional)
- meets_required_tier (boolean, optional)
- claimed_tier (string,null, optional)
- claim_verdict (string, optional)
- chain_label (string,null, optional)
- as_of_ts (integer, optional)
- draft_pinned (boolean, optional)
- rationale (array, optional)
- submitted_at_ledger (integer,null, optional)
- included_in_ledger (integer,null, optional)
- highest_validated_ledger (integer,null, optional)
- result_class (string,null, optional)
- time_bounds_max (integer,null, optional)

## Sample

```json
{
  "settlement_model": "deadline_bounded_inclusion",
  "as_of_ts": 1753000000,
  "last_ledger_sequence": 1000,
  "submitted_at_ledger": 990,
  "included_in_ledger": 995,
  "ledger_validated": true,
  "result_class": "tes",
  "highest_validated_ledger": 996,
  "continuous_history_ok": true,
  "required_tier": "final_success",
  "claimed_tier": "final_success",
  "chain_label": "XRPL mainnet"
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_ledger_consensus_finality` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# Settlement Finality Classifier

Vendor-neutral settlement-finality classifier covering three settlement models, each on its own ordered tier ladder: an optimistic challenge window (soft, posted, challengeable, final), a validity proof (soft, committed, proven_unfinalized, final) and single-slot BFT consensus (soft, final). The ladders are deliberately kept separate because a posted batch on an optimistic rollup and a committed batch on a validity rollup are not the same claim, and the ladder actually used is emitted as tier_ladder so the receipt is self-describing. Validity-proof finality is treated as two gates rather than a timer, proof accepted and settlement-layer block finalised, so the in-between position is reported as proven_unfinalized. Adjudicates an asserted finality tier and flags an overstated claim. Chain identity is free text echoed verbatim: there is no chain enum, no named chain profile and no published window table, so the node cannot go stale when a network changes. Evaluation time is caller supplied and the kernel reads no clock. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-492-classify-settlement-finality.html
- Markdown twin: https://ainumbers.co/chaingraph/art-492-classify-settlement-finality.md
- MCP tool: classify_settlement_finality (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_ts (any, required): type not evidenced by kernel source
- assertion_created_at (any, required): type not evidenced by kernel source
- batch_committed_at (any, required): type not evidenced by kernel source
- batch_posted (any, required): type not evidenced by kernel source
- chain_label (any, required): type not evidenced by kernel source
- challenge_window_seconds (any, required): type not evidenced by kernel source
- claimed_tier (any, required): type not evidenced by kernel source
- expected_proof_cadence_seconds (any, required): type not evidenced by kernel source
- included_in_block (any, required): type not evidenced by kernel source
- l1_finality_seconds (any, required): type not evidenced by kernel source
- l1_finalized (any, required): type not evidenced by kernel source
- proof_accepted (any, required): type not evidenced by kernel source
- proof_submitted_at (any, required): type not evidenced by kernel source
- quorum_committed (any, required): type not evidenced by kernel source
- quorum_pct_of_stake (any, required): type not evidenced by kernel source
- required_tier (any, required): type not evidenced by kernel source
- settlement_model (any, required): type not evidenced by kernel source

## Outputs

- as_of_ts (integer, optional)
- chain_label (string, optional)
- claim_verdict (string, optional)
- claimed_tier (string, optional)
- draft_pinned (boolean, optional)
- earliest_final_at (integer, optional)
- finality_tier (string, optional)
- meets_required_tier (boolean, optional)
- rationale (array, optional)
- reorg_exposure (string, optional)
- required_tier (string, optional)
- settlement_model (string, optional)
- tier_ladder (array, optional)
- tier_rank (integer, optional)

## Sample

```json
{
  "settlement_model": "optimistic_challenge",
  "as_of_ts": 1753000000,
  "assertion_created_at": 1752800000,
  "challenge_window_seconds": 604800,
  "batch_posted": true,
  "required_tier": "final",
  "claimed_tier": "final",
  "chain_label": "example optimistic rollup"
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_settlement_finality` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

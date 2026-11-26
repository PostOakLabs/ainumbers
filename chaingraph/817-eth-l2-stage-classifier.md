# Ethereum L2 Stage Criteria Classifier

Classifies the properties a caller declares for one Ethereum layer-2 against the L2BEAT stages framework text, and reports for each criterion whether the declared property meets it, fails it, leaves it unresolved or does not engage it. The caller declares whether the project calls itself a rollup, posts state roots and data availability on layer 1, publishes state-reconstruction software and has a proper proof system; the proof system type (fraud or validity), the number of external actors who can submit a fraud proof and whether fraud proofs are permissionless; whether a Security Council exists, the smallest share of it that must be compromised to block or push an invalid withdrawal, whether upgrades outside the Council are possible and their exit window in days; the exit window in days for unwanted upgrades; and whether the Council is restricted to errors detected on chain. Eleven criteria are evaluated: six for the first stage, two for the second and three for the third, using the thresholds in the framework text (five external fraud-proof actors, a 75 percent Council share, a 7 day exit window for upgrades outside the Council, a 30 day exit window for unwanted upgrades). The two fraud-proof criteria are not engaged for a validity-proof system. The Council share criterion is not engaged when no Council exists, and the Council restriction criterion likewise. A property the caller leaves out is reported as indeterminate and is never guessed. The stages are read in order: a failed criterion fixes the reading at the stage below, and an unresolved criterion before any failure leaves the reading indeterminate. This node classifies declared inputs against the framework text as retrieved on 2026-11-03. It never asserts the stage of any live project, because stages change and the framework itself is expected to change. It does not evaluate the edge cases the framework lists as open (the liveness failure upper bound, the forced transaction delay upper bound, frontrunning risk and based preconfirmations) and says so in its output. It reads no chain and checks no contract. For the finality and withdrawal timing of a layer-2 bridge, see the separate layer-2 finality node art-290.

- Page: https://ainumbers.co/chaingraph/817-eth-l2-stage-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/817-eth-l2-stage-classifier.md
- MCP tool: classify_l2_stage_criteria (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "self_identifies_as_rollup": true,
  "state_roots_posted_on_l1": true,
  "da_on_l1": true,
  "reconstruction_software_available": true,
  "has_proper_proof_system": true,
  "proof_system_type": "fraud",
  "fraud_proof_external_actors": 8,
  "fraud_proof_permissionless": true,
  "security_council_present": true,
  "council_min_share_to_compromise_pct": 80,
  "non_council_upgrades_possible": true,
  "non_council_upgrade_exit_window_days": 10,
  "unwanted_upgrade_exit_window_days": 45,
  "council_restricted_to_onchain_detected_errors": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_l2_stage_criteria` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

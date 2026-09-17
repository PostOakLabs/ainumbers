# Evergreen Permissioning-Control Classifier

Classifies six Evergreen supervisory controls - transaction permissioning, contract deployment permissioning, native asset issuance, fee policy, reward distribution, and validator set membership - as protocol-enforced, application-enforced, or absent, from caller-transcribed genesis precompile configuration and validator-manager mode. Distinct from the segregation-of-duties matrix checker: that tool asks who holds conflicting power, this asks where the control lives at all. An undeclared input never falls through to a silent guess - it becomes a named judgment_required entry naming the undetermined fact, the input that resolves it, and who decides. Zero network, zero PII - opaque control and precompile keys only.

- Page: https://ainumbers.co/chaingraph/art-495-avax-permissioning-control-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-495-avax-permissioning-control-classifier.md
- MCP tool: classify_avax_permissioning_controls (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- application_controls (unknown, required)
- precompiles (unknown, required)
- validator_manager_mode (unknown, required)

## Outputs

- absent_count (integer, optional)
- application_enforced_count (integer, optional)
- controls (array, optional)
- controls_evaluated (integer, optional)
- gap_register (array, optional)
- judgment_required (array, optional)
- judgment_required_count (integer, optional)
- protocol_enforced_count (integer, optional)

## Sample

```json
{
  "precompiles": {
    "txallowlist": {
      "activated": true
    },
    "deployerallowlist": {
      "activated": true
    },
    "nativeminter": {
      "activated": false
    },
    "feemanager": {
      "activated": false
    },
    "rewardmanager": {
      "activated": false
    }
  },
  "application_controls": {
    "fee_policy_control": true,
    "native_asset_issuance_control": false,
    "reward_distribution_control": false
  },
  "validator_manager_mode": "poa"
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_avax_permissioning_controls` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

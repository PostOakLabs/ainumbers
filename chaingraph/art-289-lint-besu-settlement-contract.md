# Besu Settlement Contract Linter

Static conformance lint of a permissioned-EVM settlement contract (Solidity source or ABI) against six invariants: atomic PvP/DvP (paired-or-revert), no native-token/msg.value settlement dependence, a finality-hook/settlement event, a compliance-gate modifier preceding every value transfer, bounded participant-set loops, and upgradeability disclosure. Lightweight in-browser parse only, never solc, never a network call. v1 scope is source + ABI; bytecode/opcode heuristics are deferred. Not a security audit.

- Page: https://ainumbers.co/chaingraph/art-289-lint-besu-settlement-contract.html
- Markdown twin: https://ainumbers.co/chaingraph/art-289-lint-besu-settlement-contract.md
- MCP tool: lint_besu_settlement_contract (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- artifact_kind (unknown, required)
- ruleset_profile (unknown, required)
- source (unknown, required)

## Outputs

- artifact_kind (string, optional)
- fail_count (integer, optional)
- findings (array, optional)
- invariants_pass (object, optional)
- overall (string, optional)
- ruleset_profile (string, optional)
- warn_count (integer, optional)

## Sample

```json
{
  "artifact_kind": "solidity",
  "source": "contract Settlement {\n  event Settled(bytes32 indexed id);\n  function transferPair(address a, address b) external onlyCompliant {\n    require(safeTransfer(a, 1), \"fail\");\n    require(transferFrom(b, address(this), 1), \"fail\");\n    emit Settled(bytes32(0));\n  }\n}",
  "ruleset_profile": "sli-besu-settlement-v1"
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_besu_settlement_contract` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

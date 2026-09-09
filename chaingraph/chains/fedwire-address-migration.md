# Fedwire/CHIPS Structured-Address Migration

Fedwire and CHIPS structured-address readiness for the 2026-11-16 cutover. Lint a single message (art-349, network param selects fedwire or chips - rules are byte-identical between the two networks), gate on the lint result: a fully compliant message ends the chain immediately, anything else continues to a batch sweep (art-350) of the full payment file for a rejection-risk report, then a before/after remediation diff receipt (tools/548) binding both file digests and the rule-clearance delta a bank shows its regulator or correspondents.

- Page: https://ainumbers.co/chaingraph/chains/fedwire-address-migration.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/fedwire-address-migration.md

## Workflow chain: Fedwire/CHIPS Structured-Address Migration

Fedwire and CHIPS structured-address readiness for the 2026-11-16 cutover. Lint a single message (art-349, network param selects fedwire or chips - rules are byte-identical between the two networks), gate on the lint result: a fully compliant message ends the chain immediately, anything else continues to a batch sweep (art-350) of the full payment file for a rejection-risk report, then a before/after remediation diff receipt (tools/548) binding both file digests and the rule-clearance delta a bank shows its regulator or correspondents.

Domain: Wholesale Settlement

### Steps

1. art-349-fedwire-structured-address-linter
   Structural lint of one message (network=fedwire|chips, same kernel, same rules). If compliant, no remediation is needed - the chain ends. Otherwise error_count and violations[] carry into the batch sweep.
2. art-350-fedwire-address-sweep
   Rejection-risk report (violation counts by rule, worst offenders) and remediation worksheet receipt (file digest, per-record findings digest, risk score) for the whole payment file. Feeds the before/after diff receipt once remediation is applied.
3. 548-fedwire-remediation-diff-receipt
   Before/after remediation-evidence receipt binding both file digests and the rule-clearance delta (N failures to 0) - the artifact a bank shows its regulator or correspondents.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

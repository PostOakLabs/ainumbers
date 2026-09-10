# ZK Compliance Proof Generator

Synthetic ZK compliance proof token for AML/Travel Rule predicates (amount threshold, sanctions clear, KYC complete, velocity normal, source of funds). NTT simulation: models the number-theoretic transform in real ZK-SNARK/STARK backends. GDPR Art. 25 data-minimisation demonstrator. Explicitly educational.

- Page: https://ainumbers.co/chaingraph/cry-01-zk-compliance-proof-generator.html
- Markdown twin: https://ainumbers.co/chaingraph/cry-01-zk-compliance-proof-generator.md
- MCP tool: generate_zk_compliance_proof (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- data (unknown, required)
- predicate_type (unknown, optional)
- seed (unknown, optional)

## Outputs

- checks (array, optional)
- compliance_flags (array, optional)
- constraint_count (integer, optional)
- predicate_label (string, optional)
- predicate_type (string, optional)
- proof_commitment (string, optional)
- proof_ms_simulated (integer, optional)
- proof_result (string, optional)
- proof_system (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `generate_zk_compliance_proof` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

# TLS / X.509 PKI Migration Planner

Sequences TLS and X.509 PKI migration from RSA/ECDSA to post-quantum algorithms (ML-KEM/ML-DSA per NIST FIPS 203/204 Aug 2024). Builds a phased plan (root CAs -> intermediates -> leaf certificates), models payload impact for hybrid/composite/replace strategies, and flags interoperability risks. Reuses CBOM inventory from tool 499.

- Page: https://ainumbers.co/chaingraph/art-86-tls-pki-migration-planner.html
- Markdown twin: https://ainumbers.co/chaingraph/art-86-tls-pki-migration-planner.md
- MCP tool: plan_tls_pki_migration (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- interop_constraints (unknown, optional)
- inventory_ref (unknown, optional)
- migration_strategy (unknown, optional)
- pki (unknown, optional)

## Outputs

- algorithm_refs (object, optional)
- estimated_total_weeks (integer, optional)
- interop_risks (array, optional)
- inventory_ref (string, optional)
- migration_plan (array, optional)
- note (string, optional)
- payload_impact_bytes (integer, optional)
- pki_summary (object, optional)
- reference_version (string, optional)
- rollback_points (array, optional)
- strategy (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `plan_tls_pki_migration` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

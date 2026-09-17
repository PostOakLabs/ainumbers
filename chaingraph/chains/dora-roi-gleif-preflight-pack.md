# DORA RoI GLEIF Pre-Submission Preflight Pack

DORA (EU) 2022/2554 Art. 28/30 Register of Information build, GLEIF-hardened: art-466's RoI template set feeds a GLEIF snapshot digest + relationship-consistency check for each LEI-bearing counterparty (provider) in the register, and art-601 composes the results into one preparation-aid evidence pack with a named-human attestation closure. Preparation aid only - not a submission, not a filing, not a determination that a submission is complete or accurate, and not a statement that any regulator has reviewed or would accept this output.

- Page: https://ainumbers.co/chaingraph/chains/dora-roi-gleif-preflight-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/dora-roi-gleif-preflight-pack.md

## Workflow chain: DORA RoI GLEIF Pre-Submission Preflight Pack

DORA (EU) 2022/2554 Art. 28/30 Register of Information build, GLEIF-hardened: art-466's RoI template set feeds a GLEIF snapshot digest + relationship-consistency check for each LEI-bearing counterparty (provider) in the register, and art-601 composes the results into one preparation-aid evidence pack with a named-human attestation closure. Preparation aid only - not a submission, not a filing, not a determination that a submission is complete or accurate, and not a statement that any regulator has reviewed or would accept this output.

Domain: DORA / NIS2 / ICT Resilience

### Steps

1. art-466-dora-roi-builder
   Constructs and cross-validates the RoI template set. The caller identifies every LEI-bearing counterparty (provider) in the resulting providers[] array to drive Stage 2/3, one GLEIF check pair per counterparty.
2. art-599-gleif-snapshot-digest
   Run once per LEI-bearing counterparty from Stage 1 (paste-in GLEIF Golden Copy record for that counterparty's LEI). Each result's lei/lei_checksum_valid/source_sha256/captured_at/snapshot_captured feeds that counterparty's gleif_snapshot slot in Stage 4.
3. art-600-lei-relationship-consistency
   Run once per counterparty from Stage 1, over that counterparty's pasted GLEIF Level-2 relationship record set. Each result's records_assessed/consistent/violation_count feeds that counterparty's lei_relationship_check slot in Stage 4.
4. art-601-dora-roi-gleif-preflight-pack
   Terminal stage. Links the Stage 1 artifact by execution_hash + tool_id (never the raw dataset), composes each counterparty's Stage 2 + Stage 3 results, rolls up all_snapshots_captured and any_relationship_violation across the set, and records the management-body attestation closure - the final preparation-aid evidence pack.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

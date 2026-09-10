# AML Lookback Completeness Reconciler

Reconciles an AML consent-order remediation lookback's order-scope population against the extract actually produced for re-screening, per historical period. Coverage is always measured against the caller-declared SOURCE-SYSTEM record count, never the extract's own self-reported count - a lookback that reports zero gaps because it only counted what the extract already contains is indistinguishable from a clean lookback, and catching that blind spot is this node's purpose. A second axis reconciles versioned policy-list snapshot availability: any period whose sanctions/PEP list snapshot was not preserved is flagged unverifiable and excluded from the screened-coverage total rather than silently re-screened against today's list. Also flags duplicate records surviving dedup. Deterministic reconciliation arithmetic only. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-470-lookback-completeness-reconciler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-470-lookback-completeness-reconciler.md
- MCP tool: reconcile_aml_lookback_completeness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- periods (array, required)

## Outputs

- gap_periods (array, optional)
- lookback_status (string, optional)
- overall_coverage_pct (integer, optional)
- period_count (integer, optional)
- periods (array, optional)
- total_duplicate_count (integer, optional)
- total_extract_record_count (integer, optional)
- total_source_record_count (integer, optional)
- unverifiable_periods (array, optional)
- verifiable_extract_count (integer, optional)
- verifiable_source_count (integer, optional)

## Sample

```json
{
  "periods": [
    {
      "period_label": "2023-Q4",
      "source_record_count": 500,
      "extract_record_count": 500,
      "dedup_record_count": 500,
      "snapshot_available": true
    },
    {
      "period_label": "2024-Q1",
      "source_record_count": 620,
      "extract_record_count": 620,
      "dedup_record_count": 620,
      "snapshot_available": true
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_aml_lookback_completeness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

## Workflow chain: AML Lookback Cycle

Reconciles a consent-order lookback's population against the extract actually re-screened, flagging any period with no preserved list snapshot as unverifiable rather than screening it against today's list. Re-screens the verifiable population against the sanctions/export-control program in force, versioned list snapshots as policy inputs. Builds a deterministic disposition sampling frame and reviewer workload allocation for the final independent-validator disposition review.

Domain: Sanctions

### Steps

1. art-470-lookback-completeness-reconciler
   verifiable_source_count, verifiable_extract_count, and unverifiable_periods (excluded from re-screen scope) feed Stage 2's population definition
2. art-90-sanctions-screening-fit-diagnostic
   program-config diagnostic against the versioned list snapshot in force for the verifiable period feeds Stage 3's quality scorecard
3. art-97-sanctions-screening-quality-scorer
   composite program-conformance grade and delta-vs-original-dispositions priorities feed Stage 4's sampling population
4. art-471-disposition-sampling-frame
   reviewer_workload allocation hands off to the independent-validator human disposition review - final stage, never an auto-generated SAR

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

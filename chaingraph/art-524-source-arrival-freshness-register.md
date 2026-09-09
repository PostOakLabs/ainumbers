# Source Arrival & Freshness Register

Reconciles a caller-declared EXPECTED-source inventory against caller-declared OBSERVED arrivals, per source: arrived, missing, late (arrived after its declared expected-as-of), or stale (arrived but older than its declared freshness threshold relative to a declared reference-as-of). The expected inventory is always an independently supplied caller input, never derived from the observed set - a register that only counts what showed up cannot tell 'nothing broke' from 'a whole source never arrived,' and closing that blind spot is this node's purpose. If no expected-source inventory is declared, the node refuses to report on arrivals alone and emits a did-not-run execution state instead of a degraded pass. All sources current yields auto_pass; any late-but-present source yields review_required (which routes to an exception step, never a human blocker); any missing expected source yields reject; an observed arrival supplied with no as-of yields a ran-stale execution state rather than a guessed decision. Deterministic reconciliation arithmetic only, no clock, no network, zero PII. Not a log tailer: completeness is measured against the declared expected inventory, never the extract's own self-reported arrivals. Clause: GAO-25-107721 SS13.07 (currency as an attribute of the information itself); ECB RDARR Guide (May 2024) SS3.5(1) (timeliness).

- Page: https://ainumbers.co/chaingraph/art-524-source-arrival-freshness-register.html
- Markdown twin: https://ainumbers.co/chaingraph/art-524-source-arrival-freshness-register.md
- MCP tool: register_source_arrival_freshness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- expected_sources (array, required)
- observed_arrivals (array, required)
- reference_as_of (unknown, required)

## Outputs

- execution_state (string, optional)
- decision (string, optional)
- reason (string, optional)
- source_count (integer, optional)
- sources (array, optional)
- missing_sources (array, optional)
- late_or_stale_sources (array, optional)
- unknown_freshness_sources (array, optional)

## Sample

```json
{
  "reference_as_of": 1000,
  "expected_sources": [
    {
      "source_id": "core-ledger-extract",
      "expected_as_of": 990,
      "freshness_threshold_hours": 50
    },
    {
      "source_id": "trade-blotter-feed",
      "expected_as_of": 995,
      "freshness_threshold_hours": 50
    }
  ],
  "observed_arrivals": [
    {
      "source_id": "core-ledger-extract",
      "arrived": true,
      "observed_as_of": 980
    },
    {
      "source_id": "trade-blotter-feed",
      "arrived": true,
      "observed_as_of": 985
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `register_source_arrival_freshness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

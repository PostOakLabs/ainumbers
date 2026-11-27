# Receipt Export Envelopes

Deterministically re-expresses one caller-supplied execution receipt as two wire envelopes: a lineage RunEvent (eventType COMPLETE, eventTime from the receipt, runId derived as a pure function of the receipt's execution_hash, job namespace/name from the receipt, one input dataset per parent hash named by hash in the estate lineage-card facet dialect) and a structured-mode event envelope (specversion 1.0, id = execution_hash, type co.ainumbers.ocg.receipt.v1, time = the receipt's event time, data echoing the receipt fields unchanged). The receipt is caller-supplied and caller-asserted: the kernel never verifies the hash values, reads no clock, uses no randomness and performs no network access. Fail-closed on any missing or malformed hash, timestamp or URI-reference; a refused export carries no envelopes. Declared domain: one receipt per call, parent hashes and tool ids of equal length. Scope limits: this node does not verify receipt correctness, does not assign timestamps, and is a terminal export view: it consumes nothing and feeds nothing.

- Page: https://ainumbers.co/chaingraph/art-831-receipt-export-envelopes.html
- Markdown twin: https://ainumbers.co/chaingraph/art-831-receipt-export-envelopes.md
- MCP tool: export_receipt_lineage_events (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- receipt (object, required)

## Outputs

- status (string, optional)
- event_time (string,null, optional)
- refused_field (string,null, optional)
- reason (string,null, optional)
- lineage_event (object,null, optional)
- event_envelope (object,null, optional)

## Sample

```json
{
  "receipt": {
    "tool_id": "art-801-example-agent-run",
    "execution_hash": "656e6fd6346925d1293a6dcffbebdb8dbc2fe3709033a5d95554f8a301140c68",
    "parent_hashes": [],
    "parent_tool_ids": [],
    "chain_depth": 0,
    "policy_parameters_hash": "4df584296e5be38d975aef7914d9c0bc02fd63d3a4b658447e542d50ac2a8f98",
    "event_time": "2026-11-02T09:00:00Z",
    "source": "https://ainumbers.co/chaingraph",
    "namespace": "ainumbers.co"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `export_receipt_lineage_events` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

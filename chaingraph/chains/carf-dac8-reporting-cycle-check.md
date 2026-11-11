# CARF / DAC8 Reporting Cycle Check

Check a CARF/DAC8 reporting cycle in two stages, plus a session receipt. First, classify crypto-asset user records and their transactions against a policy set the caller declares rather than one the node asserts: reportable residence jurisdictions, in-scope transaction classes, due-diligence rule codes and pinned schema version, with self-certification as the gating step and undetermined verdicts naming the missing input and the deciding role (ART-504). Then dispose the authority's returned CARF/DAC8 status message for that filed population into a break list, counting only dispositions signed by a named signer and carrying prior-cycle dispositions forward with signer and cycle attached; the node refuses to invent a break list when the jurisdiction's return channel is not declared (ART-505). Finally, a session receipt aggregating the run's execution hashes (CRY-05). The classification output is the filing population that the disposition stage answers; disposition without a classified filing has nothing to disposition, and classification alone cannot say whether the filing came back clean. The nodes state no view on how any jurisdiction has implemented CARF or DAC8, compute no tax liability, submit and transmit nothing, and are not legal or tax advice.

- Page: https://ainumbers.co/chaingraph/chains/carf-dac8-reporting-cycle-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/carf-dac8-reporting-cycle-check.md

## Workflow chain: CARF / DAC8 Reporting Cycle Check

Check a CARF/DAC8 reporting cycle in two stages, plus a session receipt. First, classify crypto-asset user records and their transactions against a policy set the caller declares rather than one the node asserts: reportable residence jurisdictions, in-scope transaction classes, due-diligence rule codes and pinned schema version, with self-certification as the gating step and undetermined verdicts naming the missing input and the deciding role (ART-504). Then dispose the authority's returned CARF/DAC8 status message for that filed population into a break list, counting only dispositions signed by a named signer and carrying prior-cycle dispositions forward with signer and cycle attached; the node refuses to invent a break list when the jurisdiction's return channel is not declared (ART-505). Finally, a session receipt aggregating the run's execution hashes (CRY-05). The classification output is the filing population that the disposition stage answers; disposition without a classified filing has nothing to disposition, and classification alone cannot say whether the filing came back clean. The nodes state no view on how any jurisdiction has implemented CARF or DAC8, compute no tax liability, submit and transmit nothing, and are not legal or tax advice.

Domain: Digital-Asset Rails

### Steps

1. art-504-classify-carf-reportable
   Classifies crypto-asset user records and transactions against a caller-declared policy set: reportable residence jurisdictions, in-scope transaction classes, due-diligence rule codes and pinned schema version; self-certification gates, undetermined verdicts name the missing input and the deciding role
2. art-505-dispose-carf-status-message
   Turns the authority's returned CARF/DAC8 status message for the filed population into a dispositioned break list, counting only dispositions signed by a named signer and carrying prior-cycle dispositions forward with signer and cycle attached; refuses to invent a break list when the return channel is not declared
3. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Which of these records are reportable under CARF, and which need a judgment call?
Run the AINumbers MCP tool `run_chain` with {"chain":"carf-dac8-reporting-cycle-check"} and read `art-504-classify-carf-reportable.records`.
Re-run with `inputs` for `art-504-classify-carf-reportable`, reusing the values that result echoed, with `records` changed so add a record with an undetermined residence. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/carf-dac8-reporting-cycle-check.html

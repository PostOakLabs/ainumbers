# Agent Trade Evidence

A nine-stage agent trade evidence workflow over caller-declared inputs. Step 1 validates the trading agent's on-behalf-of mandate, its subject, scope, intent and validity window, and step 2 then applies a fixed ten-rule authorization order to the declared mandate, budget, rail state and proposed request. Step 3 aggregates the declared oracle submissions into the single price an oracle network would publish, and step 4 then publishes the head event that sequence-numbers the mark-price print stream. Step 5 slices the declared order into VWAP, TWAP and participation-of-volume schedules and decomposes implementation shortfall; step 6 then scores every declared fill for price improvement against the NBBO at execution, and step 7 weighs the declared per-venue figures into a monitoring evidence pack with an overall verdict. Step 8 validates the agent's audit-trail records for completeness and chain-link conformance, and step 9 then aggregates the session into one Merkle-root receipt with inclusion proofs. Each step computes from its own declared inputs; the order is analytical, not a statutory sequence, and the chain certifies nothing.

- Page: https://ainumbers.co/chaingraph/chains/agent-trade-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-trade-evidence.md

## Workflow chain: Agent Trade Evidence

A nine-stage agent trade evidence workflow over caller-declared inputs. Step 1 validates the trading agent's on-behalf-of mandate, its subject, scope, intent and validity window, and step 2 then applies a fixed ten-rule authorization order to the declared mandate, budget, rail state and proposed request. Step 3 aggregates the declared oracle submissions into the single price an oracle network would publish, and step 4 then publishes the head event that sequence-numbers the mark-price print stream. Step 5 slices the declared order into VWAP, TWAP and participation-of-volume schedules and decomposes implementation shortfall; step 6 then scores every declared fill for price improvement against the NBBO at execution, and step 7 weighs the declared per-venue figures into a monitoring evidence pack with an overall verdict. Step 8 validates the agent's audit-trail records for completeness and chain-link conformance, and step 9 then aggregates the session into one Merkle-root receipt with inclusion proofs. Each step computes from its own declared inputs; the order is analytical, not a statutory sequence, and the chain certifies nothing.

Domain: AI & Agent Governance

### Steps

1. art-151-agent-obo-mandate-validator
   Validates the caller-declared on-behalf-of mandate for the trading agent, testing the subject, the bounded scope array, the intent string and a non-expired validity window, and returns a mandate verdict that refuses on mismatch or expiry. The next step then applies a fixed ten-rule authorization order to the declared mandate, budget and rail state. Stage 1 of 9.
2. art-703-mandate-authorization-gate
   Applies a fixed ten-rule order, amount validity through rail allowlist, to the caller-declared mandate, budget, rail state and proposed request, listing every failing rule and issuing a one-use authorization bound to both digests when none fails. The next step then aggregates the declared oracle submissions into one publishable price. Stage 2 of 9.
3. art-560-oracle-price-aggregation
   Aggregates the declared oracle submissions into the single price a decentralized oracle network would publish, by the declared aggregation mechanism, and gives that print its own citable hash. The next step then publishes the head event that sequence-numbers the mark-price print stream. Stage 3 of 9.
4. art-655-publish-market-mark-head
   Publishes one head-commit publication event for the market's mark-price print stream, so a series of prints for the same pair reads as a sequence-numbered, signer-continuous chain. The next step then slices the declared order into schedules and decomposes implementation shortfall. Stage 4 of 9.
5. art-669-algo-execution-schedule-simulator
   Slices the declared order into VWAP, TWAP and participation-of-volume schedules, failing closed unless the declared volume profile sums to one hundred, and decomposes implementation shortfall against the declared arrival and average-fill prices. The next step then scores every declared fill against the NBBO at execution. Stage 5 of 9.
6. art-541-best-execution-recompute
   Scores every declared fill for price improvement in basis points against the NBBO at execution and aggregates the share at or better, the average improvement and the fill count. The next step then weighs the declared per-venue figures into a monitoring evidence pack. Stage 6 of 9.
7. art-681-best-execution-evidence-pack
   Weighs the declared per-venue improvement figures into a fill-weighted average, lists any venue whose declared improvement prints negative and returns an overall monitoring verdict that flags review when one does. The next step then validates the agent's audit-trail records for completeness and chain-link conformance. Stage 7 of 9.
8. art-237-validate-agent-audit-trail
   Validates the agent's declared audit-trail records for required fields, chain-link format, signature presence and enum conformance, returning a conformance result with a completeness score and validation errors. The next step then aggregates the session's execution artifacts into one Merkle-root receipt. Stage 8 of 9.
9. cry-05-agent-action-audit-trail-aggregator
   Aggregates the session's execution artifacts into one SHA-256 Merkle-root session receipt with per-leaf inclusion proofs and an ordered chain-depth map, setting the session receipt root. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our agent traded on a user's behalf. Does its mandate validate on subject, scope and expiry, or does the validator refuse it?
Run the AINumbers MCP tool `run_chain` with {"chain":"agent-trade-evidence"} and read `art-151-agent-obo-mandate-validator.verdict`.
Re-run with `inputs` for `art-151-agent-obo-mandate-validator`, reusing the values that result echoed, with `now_unix` set to 10000000000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/agent-trade-evidence.html

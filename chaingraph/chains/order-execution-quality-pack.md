# Order Execution Quality Pack

A three-stage order execution quality workflow over caller-declared fill data. Step 1 scores every declared fill for price improvement in basis points against the NBBO at execution and reports the share of fills at or better, the average improvement, and the fill count (art-541). Step 2 then compiles a best-execution monitoring evidence pack over the declared per-venue figures, weighing improvement by venue and flagging any venue whose declared improvement prints negative for committee review (art-681). Step 3 composes the periodic publication rows, reporting the effective-versus-quoted spread ratio and the covered-order roll-up over the declared covered orders, shares and spread statistics (art-682). Each step computes from its own declared inputs; the order is analytical, not a statutory sequence.

- Page: https://ainumbers.co/chaingraph/chains/order-execution-quality-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/order-execution-quality-pack.md

## Workflow chain: Order Execution Quality Pack

A three-stage order execution quality workflow over caller-declared fill data. Step 1 scores every declared fill for price improvement in basis points against the NBBO at execution and reports the share of fills at or better, the average improvement, and the fill count (art-541). Step 2 then compiles a best-execution monitoring evidence pack over the declared per-venue figures, weighing improvement by venue and flagging any venue whose declared improvement prints negative for committee review (art-681). Step 3 composes the periodic publication rows, reporting the effective-versus-quoted spread ratio and the covered-order roll-up over the declared covered orders, shares and spread statistics (art-682). Each step computes from its own declared inputs; the order is analytical, not a statutory sequence.

Domain: Securities Compliance & Corporate Governance

### Steps

1. art-541-best-execution-recompute
   Scores every declared fill for price improvement in basis points against the NBBO at execution and reports the share at or better, the average improvement, and the fill count. Stage 1 of 3.
2. art-681-best-execution-evidence-pack
   Weighs the declared per-venue improvement figures into a fill-weighted average and flags any venue whose declared improvement prints negative, returning an overall monitoring verdict for the committee. Stage 2 of 3.
3. art-682-rule-605-publication-composer
   Composes the periodic publication rows over the declared covered orders, covered shares and spread statistics, reporting the effective-versus-quoted spread ratio and a rows-built verdict. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: One venue printed worse than NBBO this quarter. Does the monitoring pack flag it for committee review, or is the book within policy?
Run the AINumbers MCP tool `run_chain` with {"chain":"order-execution-quality-pack"} and read `art-681-best-execution-evidence-pack.overall`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/order-execution-quality-pack.html

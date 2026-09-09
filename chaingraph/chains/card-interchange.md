# Interchange Optimisation to Scheme Compliance

Interchange optimisation > Visa/MC qualification testing > scheme fee benchmarking > 3DS/EMV compliance.

- Page: https://ainumbers.co/chaingraph/chains/card-interchange.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/card-interchange.md

## Workflow chain: Interchange Optimisation to Scheme Compliance

Interchange optimisation > Visa/MC qualification testing > scheme fee benchmarking > 3DS/EMV compliance.

Domain: Card & Payment Economics

### Steps

1. 52-interchange-optimizer
   optimal_mcc and routing_strategy feed T225 qualification testing
2. 225-visa-mc-interchange-qualification-tester
   ic_category and qualification_flags feed T233 scheme fee benchmarking
3. 233-card-scheme-fee-benchmarking
   fee_delta and scheme_comparison feed T228 3DS/EMV compliance
4. 228-3ds-emv-compliance-checker
   Exports card interchange Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

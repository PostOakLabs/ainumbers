# PSD3 / PSR Readiness Checker

Six-domain PSD3/PSR readiness rubric: Open Finance access rights (Art.35/36), TPP categorisation (PISP/AISP/PIISP), SCA exemption alignment (Art.85–90), consent framework maturity, fraud liability model (Art.59–65), and embedded finance/BaaS scope. Radar chart + prioritised gap table. Root node (no upstream dependency). Feeds ART-04 (DORA Mapper) and PTG-01. EU transposition ~2027; UK PSR enacted 2024.

- Page: https://ainumbers.co/chaingraph/art-14-psd3-psr-readiness-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-14-psd3-psr-readiness-checker.md
- MCP tool: assess_psd3_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- baasScope (unknown, required)
- consentMaturity (unknown, required)
- fraudLiability (unknown, required)
- instType (unknown, required)
- jurisdiction (unknown, required)
- openBankingLevel (unknown, required)
- openFinance (array, required)
- psd2Status (unknown, required)
- scaExemptions (array, required)
- tppTypes (array, required)

## Outputs

- band (string, optional)
- critical_gaps (integer, optional)
- domain_scores (object, optional)
- overall_readiness_score (integer, optional)
- verdict (string, optional)

## Sample

```json
{
  "instType": "payment_institution",
  "jurisdiction": "eu_single",
  "psd2Status": "mostly_compliant",
  "openBankingLevel": "ob_testing",
  "tppTypes": [
    "tpp_pisp"
  ],
  "scaExemptions": [
    "sca_low_value"
  ],
  "consentMaturity": "standard",
  "openFinance": [
    "of_none"
  ],
  "fraudLiability": "shared",
  "baasScope": "none"
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_psd3_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

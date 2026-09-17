# Life Illustration Self-Support Test

Linear two-step chain for life insurance illustration compliance and insurer capital review. Step 1 runs the NAIC Model 582 §8C self-support test (year 15 and year 20) and §8D lapse-support check per ASOP 24 - certifies the illustration is not lapse-supported and maintains a non-negative account value. Step 2 computes the RBC action level for the issuing insurer to confirm adequate capital supports the product offering. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/life-illustration-self-support-test.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/life-illustration-self-support-test.md

## Workflow chain: Life Illustration Self-Support Test

Linear two-step chain for life insurance illustration compliance and insurer capital review. Step 1 runs the NAIC Model 582 §8C self-support test (year 15 and year 20) and §8D lapse-support check per ASOP 24 - certifies the illustration is not lapse-supported and maintains a non-negative account value. Step 2 computes the RBC action level for the issuing insurer to confirm adequate capital supports the product offering. ZERO PII BY CONSTRUCTION.

Domain: Insurance & Reinsurance

### Steps

1. art-253-run-illustration-selfsupport-test
   Illustration validity: self_support_pass (yr15+yr20), lapse_support_flag, and issues list. Passes to RBC capital review.
2. art-254-compute-rbc-action-level
   RBC action level classification (NO_ACTION / COMPANY_ACTION / REGULATORY_ACTION / AUTHORIZED_CONTROL / MANDATORY_CONTROL). Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

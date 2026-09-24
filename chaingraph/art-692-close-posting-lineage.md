# Close Posting Lineage

A month-end close lineage verdict over declared entries: GL coding entries and accrual entries in (lineage key, GL account, amount, optional source document digest, optional traces_to references), linkage structure out (the accruals that resolve to a declared coding entry, the accruals with no reference at all, every reference naming a key no coding entry declares, the coding entries nothing traces to, the coding entries with no declared source digest, repeated lineage keys, and an overall CLOSE_READY, GAPS_FOUND or INDETERMINATE determination). Four stages in one pure compute(): intake with fail-closed shape validation, lineage key uniqueness across both declared lists, per accrual linkage classification, and the coding side observations plus the verdict. The scope is the structure of declared linkage, not business validity: the node never checks that a traced pair agrees on amount, never opens a document behind a digest, and never posts or approves anything, so an accrual of 1200 tracing to a coding entry of 300 reads as linked here and that is the honest boundary. Unlinked accruals, dangling references and duplicate keys gate the verdict; a coding entry nobody accrued against and a missing source digest are recorded as observations and never gate. An empty or malformed register returns INDETERMINATE with the reason, because zero declared accruals cannot make every accrual linked. All inputs are caller declared and synthetic, nothing is stored or transmitted, and no regime is cited: the thresholds are internal design, so a reader holding an accounting manual uses this as lineage arithmetic over their own declarations, not as a statement of what any standard requires. Built per CLOSE-COMMAND-CENTER-BUILD-SPEC-2026-09-23.md section D2, narrowed to this single node by the 2026-09-24 value review; the spec worked example's canonical policy parameters and output payload are carried as this node's oracle backed golden fixture with execution_hash 46b2cee4111553128514447ded7e205fb45bbdedccd75579f04c7ebc360d63d1, and compute() reproduces that payload byte identically.

- Page: https://ainumbers.co/chaingraph/art-692-close-posting-lineage.html
- Markdown twin: https://ainumbers.co/chaingraph/art-692-close-posting-lineage.md
- MCP tool: verify_close_posting_lineage (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (string, optional): Optional as-of date, YYYY-MM-DD; validated as a date string by the kernel whenever present, and never used as a clock.
- coding_entries (array, required): Declared GL coding entries. May be empty; each entry must carry a non-empty key, a non-empty gl_account and a finite amount.
- accrual_entries (array, required): Declared accrual entries. An empty list makes the register INDETERMINATE.

## Outputs

- linked_accruals (array, required)
- unlinked_accruals (array, required)
- dangling_trace_refs (array, required)
- orphan_coding (array, required)
- missing_source_refs (array, required)
- duplicate_lineage_keys (array, required)
- overall (string, required)
- errors (array, optional)

## Sample

```json
{
  "as_of": "2026-09-30",
  "coding_entries": [
    {
      "key": "COD-1",
      "gl_account": "6100-office",
      "amount": 1200,
      "source_document_digest": "doc-digest-1"
    }
  ],
  "accrual_entries": [
    {
      "key": "ACC-1",
      "gl_account": "2100-accrued-expense",
      "amount": 1200,
      "traces_to": [
        "COD-1"
      ]
    },
    {
      "key": "ACC-2",
      "gl_account": "2200-accrued-interest",
      "amount": 300,
      "traces_to": []
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_close_posting_lineage` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

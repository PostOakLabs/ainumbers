# AP2 Prompt Template Generator

Transforms any ChainGraph artifact JSON into a structured, regulator-framed prompt for any external LLM. Template registry v1.0.0: one entry per mandate_type with regulatory citations, audience framing, stochastic-output conventions, escalation conditions.

- Page: https://ainumbers.co/chaingraph/ptg-01-ap2-prompt-template-generator.html
- Markdown twin: https://ainumbers.co/chaingraph/ptg-01-ap2-prompt-template-generator.md
- MCP tool: compose_ap2_prompt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- artifact_json (string, optional): OpenChainGraph artifact JSON from any suite tool
- task (string, required): Output task type
- audience (string, required): Target audience for the generated prompt
- tone (string, optional)
- include_citations (boolean, optional)

## Outputs

- audience (string, required)
- claude_deeplink (string, required)
- generated_prompt (string, required)
- generated_prompt_length (number, required)
- include_citations (boolean, required)
- mandate_type_matched (string, required)
- source_execution_hash (string, required)
- source_tool_id (string, required)
- task (string, required)
- tone (string, required)

## Sample

```json
{
  "artifact_json": null,
  "task": "plain_english_summary",
  "audience": "board",
  "tone": "formal",
  "include_citations": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `compose_ap2_prompt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

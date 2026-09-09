# MCP Task Lifecycle State Machine Validator

Validate that a long-running MCP task state transitions are legal per the new MCP specification state machine: working to input_required or terminal states (completed, failed, cancelled); input_required back to working or terminal. Flags each illegal jump. Terminal stage of the agent-authorization-lifecycle chain. Exports lifecycle attestation with execution_hash. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-152-mcp-task-lifecycle-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-152-mcp-task-lifecycle-validator.md
- MCP tool: validate_mcp_task_lifecycle (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- transitions (unknown, optional)

## Outputs

- illegal_transitions (array, optional)
- lifecycle_valid (boolean, optional)
- transition_count (integer, optional)

## Sample

```json
{
  "transitions": [
    {
      "from": "working",
      "to": "working"
    },
    {
      "from": "working",
      "to": "input_required"
    },
    {
      "from": "input_required",
      "to": "working"
    },
    {
      "from": "working",
      "to": "completed"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_mcp_task_lifecycle` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

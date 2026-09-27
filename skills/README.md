# AINumbers prompt library as Agent Skills

Every example prompt AINumbers publishes, exported as an Agent Skill: one directory per prompt, each holding a SKILL.md in the agentskills.io format. Hosts that do not implement MCP prompts can still load these from disk.

This tree is generated from mcp/showcase-prompts.json, the same source the hosted worker serves at prompts/list and the same source prompts.html renders. Do not hand-edit anything under skills/: run `node scripts/gen-agent-skills.mjs` instead. Source digest of this build: 1e8cd3fdd287.

## What is here

- 46 skills, one per prompt
- banking: 6
- commerce: 5
- compliance: 8
- crypto: 7
- everyday: 9
- governance: 3
- persona: 3
- showcase: 5

## Install

1. Connect the MCP server, which every skill here calls: `claude mcp add --transport http ainumbers https://mcp.ainumbers.co/mcp`. One-click alternatives: [Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=ainumbers&config=eyJ1cmwiOiJodHRwczovL21jcC5haW51bWJlcnMuY28vbWNwIn0=) · [Add to VS Code](vscode:mcp/install?%7B%22name%22%3A%22ainumbers%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.ainumbers.co%2Fmcp%22%7D).
2. Copy a skill directory into the skills directory your host reads. Claude Code reads `~/.claude/skills/<name>/` for a user skill and `.claude/skills/<name>/` inside a project. Codex, Cursor, Gemini CLI and VS Code read the same SKILL.md layout; check each host's own documentation for the path it scans, because the directory name is the only thing that has to match the skill's `name` field.
3. Restart the host and ask for the skill by name.

## Format

Each SKILL.md carries the required `name` and `description` frontmatter fields, plus `license`, `compatibility`, and a `metadata` map recording the source file, the prompt id, the verify surfaces, and the source digest. The body is the prompt text as published, followed by a fixed section naming the endpoint, the call shape, the arguments, and where to verify a result.

## Reliance

Not legal, investment, tax, or compliance advice. A computed view of the cited authority as of generated_at, not a substitute for review by a qualified advisor against the current official source text. For this tree, generated_at is the build that produced it: source digest 1e8cd3fdd287, taken over mcp/showcase-prompts.json. Check every regulation, standard, or rule a prompt names against its current official text before relying on a result.

## License

CC-BY-4.0. Attribution: AINumbers.co (Post Oak Labs).

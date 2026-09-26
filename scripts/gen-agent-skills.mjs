#!/usr/bin/env node
/**
 * scripts/gen-agent-skills.mjs — skills/, the Agent Skills export of the prompt
 * library. AGENT-SKILLS-EXPORT-1 (PROMPT-INFRA-UNSTAGED-2026-09-24 item A3).
 *
 * WHY: hosts that ignore MCP `prompts/list` still load Agent Skills from disk.
 * The same 46 showcase prompts the worker serves become one skill directory
 * each, so a Claude Code / Codex / Cursor / Gemini CLI / VS Code user gets the
 * library without the host implementing prompts at all.
 *
 * SSOT: mcp/showcase-prompts.json — the same file gen-prompts-page.mjs renders
 * and the worker's prompts/list reads. ⛔ No prompt text is authored here: every
 * sentence in a generated SKILL.md is either copied from the SSOT or is one of
 * the fixed template strings in this file.
 *
 * FORMAT (agentskills.io/specification, re-fetched 2026-09-26, unchanged from
 * the row's 2026-09-24 quote):
 *   - a skill is a directory containing SKILL.md; `name` must match the parent
 *     directory name
 *   - SKILL.md = YAML frontmatter + Markdown body
 *   - required: `name` (1-64 chars, lowercase a-z 0-9 and hyphens, no leading/
 *     trailing hyphen, no consecutive hyphens), `description` (1-1024 chars,
 *     what it does AND when to use it)
 *   - optional: `license`, `compatibility` (max 500), `metadata` (a map from
 *     string keys to STRING values), `allowed-tools`
 *   - "Keep your main SKILL.md under 500 lines"
 *   - reference validator: `skills-ref validate ./my-skill`
 * The reference validator is an npm package and this repo is zero-dep with npm
 * forbidden (../CLAUDE.md), so `--validate` below is the in-repo substitute: it
 * enforces exactly the frontmatter rules quoted above, and `--selftest` proves
 * it goes RED on a deliberately bad `name` before it reads green.
 *
 * A non-conforming prompt id is a HALT naming the id — never a silent rename.
 *
 * SINGLE WRITER (SO #35): skills/ is a SHARED DERIVED ARTIFACT, derived-
 * artifacts.mjs COVERED id 'agent-skills'. A PR never commits the generated
 * tree; derived-artifacts-regen.yml writes it on main after merge. So the
 * `--check` freshness gate is ADVISORY on a PR (the tree is stale there by
 * construction) and BLOCKING on main, via the generic string-match downgrade in
 * preflight.mjs — the gate string here must stay byte-identical to the COVERED
 * entry's `gate`.
 *
 * Usage:
 *   node scripts/gen-agent-skills.mjs            # write skills/ (skip byte-exact files, prune strays)
 *   node scripts/gen-agent-skills.mjs --check    # freshness gate: exit 1 on any drift
 *   node scripts/gen-agent-skills.mjs --validate # spec validator over the skills/ tree ON DISK
 *   node scripts/gen-agent-skills.mjs --selftest # RED mutation battery + GREEN controls, in memory
 *
 * Idempotent by construction: no wall clock, no network, no randomness — every
 * byte is a pure function of mcp/showcase-prompts.json, so a second pass is
 * byte-identical.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync, rmdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
// CONTRACT §A9.1/§A9.2: the canonical reliance hedge, imported rather than
// restated, so the README can never drift from the text every §13 export embeds.
import { RELIANCE_NOTICE } from '../chaingraph/exporters/_meta.mjs';
// MCP-INSTALL-LINKS-1's derivation — the one-click install links and the
// canonical endpoint are never hand-written here.
import { installLinks } from './gen-install-links.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const OUT_REL = 'skills';
const OUT = resolve(REPO, OUT_REL);
const SSOT_REL = 'mcp/showcase-prompts.json';

const CHECK = process.argv.includes('--check');
const VALIDATE = process.argv.includes('--validate');
const SELFTEST = process.argv.includes('--selftest');

// ── Spec constants (agentskills.io/specification) ────────────────────────────

export const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const NAME_MAX = 64;
export const DESC_MAX = 1024;
export const COMPAT_MAX = 500;
export const FILE_MAX_LINES = 500;

const LICENSE = 'CC-BY-4.0';
const COMPATIBILITY =
  'Needs an MCP-capable host connected to https://mcp.ainumbers.co/mcp (or the same tools locally)';
const METADATA_SOURCE = 'ainumbers.co/mcp/showcase-prompts.json';

// ── SSOT load ────────────────────────────────────────────────────────────────

export function loadPrompts(repo = REPO) {
  const raw = JSON.parse(readFileSync(resolve(repo, SSOT_REL), 'utf8'));
  const prompts = Array.isArray(raw) ? raw : (Array.isArray(raw.prompts) ? raw.prompts : null);
  if (!Array.isArray(prompts)) throw new Error(`${SSOT_REL}: expected a JSON array or {prompts:[…]}`);
  if (prompts.length < 1) throw new Error(`${SSOT_REL}: zero entries — the export needs at least 1`);
  return prompts;
}

/** First 12 hex of sha256 over the SSOT bytes — metadata.version on every skill. */
export function ssotVersion(repo = REPO) {
  return createHash('sha256').update(readFileSync(resolve(repo, SSOT_REL))).digest('hex').slice(0, 12);
}

// ── Fixed template strings ───────────────────────────────────────────────────
// Every one of these is authored HERE, once. Nothing below composes new prose
// out of SSOT fragments: an SSOT value is either copied verbatim or placed in a
// slot of one of these sentences.

// The "when" half of the required description (the spec asks for what + when).
// Keyed by the SSOT's own `group` field; an unknown group falls back to a
// generic clause naming the group, so a group added later still generates.
const GROUP_CLAUSE = {
  showcase: 'you want one run that shows the same tool returning the same answer through every AINumbers doorway',
  persona: 'you are walking a role through a full scenario and want the evidence captured at each step',
  everyday: 'you want a short routine task run against the AINumbers suite',
  commerce: 'the task is an agentic commerce or payments question',
  crypto: 'the task is a crypto-asset or on-chain question',
  banking: 'the task is a banking or payment-operations question',
  compliance: 'the task is a regulatory compliance question that needs an evidence trail',
  governance: 'the task is a governance, model-risk, or control question',
};
const groupClause = (group) =>
  GROUP_CLAUSE[group] ?? `the task falls in the ${group} group of the AINumbers prompt library`;

const HOW_TO_RUN_CONNECT =
  `Connect an MCP-capable host to ${installLinks.endpoint}, then give the prompt above to the assistant.`;
// PROMPTS-CALLTOOL-LINE-1 put the call shape and the call_tool fallback in the
// SSOT body itself. Repeating them under "How to run" for a body that already
// carries them would say the same thing twice, so these two sentences are
// emitted only for a body that does not (deterministic: a pure test of the
// committed SSOT text, see CALLSHAPE_MARKER).
const HOW_TO_RUN_CALLSHAPE = [
  'Every ChainGraph node tool takes its arguments nested under one wrapper object, for example {"policy_parameters": { ... }}; flat arguments are discarded by schema validation.',
  'If a named tool is not in your tool list, call call_tool with { "name": "<tool>", "arguments": { ... } }. It runs the same validation and returns the same receipt.',
].join('\n\n');
const HOW_TO_RUN_SYNTHETIC = 'Use synthetic inputs only. Never paste personal or production data.';
const CALLSHAPE_MARKER = 'call_tool';

function howToRun(body) {
  const parts = [HOW_TO_RUN_CONNECT];
  if (!body.includes(CALLSHAPE_MARKER)) parts.push(HOW_TO_RUN_CALLSHAPE);
  parts.push(HOW_TO_RUN_SYNTHETIC);
  return parts.join('\n\n');
}

const README_TITLE = 'AINumbers prompt library as Agent Skills';

// ── Rendering ────────────────────────────────────────────────────────────────

/** YAML double-quoted scalar. Refuses anything that would need block syntax. */
export function yamlScalar(value, where) {
  const s = String(value);
  if (/[\n\r\t]/.test(s) || /[\u0000-\u001f]/.test(s)) {
    throw new Error(`${where}: value contains a control character or newline, which this generator refuses to quote: ${JSON.stringify(s.slice(0, 80))}`);
  }
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** The required `description`: what (the SSOT one_line) + when (the fixed clause). */
export function description(entry) {
  const one = String(entry.one_line ?? '').trim();
  if (!one) throw new Error(`prompt ${entry.id}: empty one_line, so no description can be built without inventing text`);
  const audience = entry.audience ? ` Written for the ${entry.audience} audience.` : '';
  return `${one} Use when ${groupClause(entry.group)}.${audience}`;
}

function verifySurfaces(entry) {
  const v = entry.verify_surface;
  return Array.isArray(v) ? v.filter(Boolean).map(String) : (v ? [String(v)] : []);
}

function argumentsTable(entry) {
  const args = Array.isArray(entry.arguments) ? entry.arguments : [];
  if (!args.length) return '';
  const rows = args.map((a) => {
    const name = String(a?.name ?? '').trim();
    if (!name) throw new Error(`prompt ${entry.id}: an arguments[] entry has no name`);
    const desc = String(a?.description ?? '').replace(/\|/g, '\\|').trim();
    return `| \`${name}\` | ${a?.required ? 'yes' : 'no'} | ${desc} |`;
  });
  return ['### Arguments', '', '| name | required | what it is |', '| --- | --- | --- |', ...rows].join('\n');
}

/** One SKILL.md. `entry` is an SSOT prompt; `version` the SSOT digest. */
export function skillMd(entry, version) {
  const id = String(entry.id ?? '');
  const desc = description(entry);
  const surfaces = verifySurfaces(entry);

  const meta = [
    `  source: ${yamlScalar(METADATA_SOURCE, `${id} metadata.source`)}`,
    `  prompt_id: ${yamlScalar(id, `${id} metadata.prompt_id`)}`,
  ];
  // Spec: metadata is a map from string keys to STRING values — verify_surface
  // is an array in the SSOT, so it is serialized space-joined, never emitted
  // as a YAML list.
  if (surfaces.length) meta.push(`  verify_surface: ${yamlScalar(surfaces.join(' '), `${id} metadata.verify_surface`)}`);
  meta.push(`  version: ${yamlScalar(version, `${id} metadata.version`)}`);

  const frontmatter = [
    '---',
    `name: ${id}`,
    `description: ${yamlScalar(desc, `${id} description`)}`,
    `license: ${yamlScalar(LICENSE, `${id} license`)}`,
    `compatibility: ${yamlScalar(COMPATIBILITY, `${id} compatibility`)}`,
    'metadata:',
    ...meta,
    '---',
  ].join('\n');

  const argsSection = argumentsTable(entry);
  const verifySection = surfaces.length
    ? ['### Verify what came back', '', ...surfaces.map((u) => `- ${u}`)].join('\n')
    : '';

  const body = String(entry.body ?? '').trim();
  const sections = [
    frontmatter,
    `# ${String(entry.title ?? id)}`,
    String(entry.one_line ?? '').trim(),
    '## Prompt',
    body,
    '## How to run',
    howToRun(body),
    argsSection,
    verifySection,
  ].filter(Boolean);

  return `${sections.join('\n\n')}\n`;
}

/** skills/README.md — generator-owned, so the --check byte-compare covers it. */
export function readmeMd(prompts, version) {
  const claudeAdd = `claude mcp add --transport http ainumbers ${installLinks.endpoint}`;
  const groups = new Map();
  for (const e of prompts) groups.set(e.group, (groups.get(e.group) ?? 0) + 1);
  const groupLines = [...groups.keys()].sort().map((g) => `- ${g}: ${groups.get(g)}`);

  return [
    `# ${README_TITLE}`,
    'Every example prompt AINumbers publishes, exported as an Agent Skill: one directory per prompt, each holding a SKILL.md in the agentskills.io format. Hosts that do not implement MCP prompts can still load these from disk.',
    `This tree is generated from mcp/showcase-prompts.json, the same source the hosted worker serves at prompts/list and the same source prompts.html renders. Do not hand-edit anything under skills/: run \`node scripts/gen-agent-skills.mjs\` instead. Source digest of this build: ${version}.`,
    '## What is here',
    [`- ${prompts.length} skills, one per prompt`, ...groupLines].join('\n'),
    '## Install',
    [
      `1. Connect the MCP server, which every skill here calls: \`${claudeAdd}\`. One-click alternatives: [Add to Cursor](${installLinks.cursor}) · [Add to VS Code](${installLinks.vscode}).`,
      '2. Copy a skill directory into the skills directory your host reads. Claude Code reads `~/.claude/skills/<name>/` for a user skill and `.claude/skills/<name>/` inside a project. Codex, Cursor, Gemini CLI and VS Code read the same SKILL.md layout; check each host\'s own documentation for the path it scans, because the directory name is the only thing that has to match the skill\'s `name` field.',
      '3. Restart the host and ask for the skill by name.',
    ].join('\n'),
    '## Format',
    'Each SKILL.md carries the required `name` and `description` frontmatter fields, plus `license`, `compatibility`, and a `metadata` map recording the source file, the prompt id, the verify surfaces, and the source digest. The body is the prompt text as published, followed by a fixed section naming the endpoint, the call shape, the arguments, and where to verify a result.',
    '## Reliance',
    // CONTRACT §A9.1: not advice, a computed view as of a stated date, verify
    // against the current official text. The canonical notice supplies the first
    // and third; the fixed sentence after it states what "generated_at" pins to
    // for this tree, so the hedge has a referent outside an export artifact.
    `${RELIANCE_NOTICE} For this tree, generated_at is the build that produced it: source digest ${version}, taken over mcp/showcase-prompts.json. Check every regulation, standard, or rule a prompt names against its current official text before relying on a result.`,
    '## License',
    `${LICENSE}. Attribution: AINumbers.co (Post Oak Labs).`,
  ].join('\n\n') + '\n';
}

/** The HALT rail: a prompt id that cannot be a skill name stops the run and
 *  names itself. ⛔ Never a silent rename — the directory name IS the id. */
export function assertLegalId(id) {
  if (!NAME_RE.test(id)) {
    throw new Error(`prompt id "${id}" is not a legal Agent Skills name (lowercase a-z 0-9 and single hyphens, no leading, trailing, or consecutive hyphen). HALTING rather than renaming it — fix the id in ${SSOT_REL}.`);
  }
  if (id.length > NAME_MAX) {
    throw new Error(`prompt id "${id}" is ${id.length} chars, over the ${NAME_MAX}-char Agent Skills name limit. HALTING rather than truncating it.`);
  }
  return id;
}

/** The whole expected tree: relative path (under skills/) -> file contents. */
export function buildTree(repo = REPO) {
  const prompts = loadPrompts(repo);
  const version = ssotVersion(repo);
  const files = new Map();
  const seen = new Set();
  for (const entry of prompts) {
    const id = assertLegalId(String(entry.id ?? ''));
    if (seen.has(id)) throw new Error(`duplicate prompt id "${id}" in ${SSOT_REL} — two skills cannot share a directory`);
    seen.add(id);
    const text = skillMd(entry, version);
    const desc = description(entry);
    if (desc.length > DESC_MAX) {
      throw new Error(`prompt ${id}: description is ${desc.length} chars, over the ${DESC_MAX}-char limit. HALTING rather than truncating it.`);
    }
    const lines = text.split('\n').length;
    if (lines > FILE_MAX_LINES) {
      throw new Error(`prompt ${id}: SKILL.md would be ${lines} lines, over the ${FILE_MAX_LINES}-line spec guidance. Split the body into references/ or shorten it in ${SSOT_REL}.`);
    }
    // The generator holds its OWN output to the spec before it ever reaches
    // disk: validateSkill() is the same function --validate runs over the tree,
    // so the single wired gate (--check) cannot pass on a tree the validator
    // would reject. REFUSING to write beats writing an invalid skill.
    const bad = validateSkill(id, text);
    if (bad.length) {
      throw new Error(`prompt ${id}: generated SKILL.md fails the Agent Skills frontmatter rules:\n  ${bad.join('\n  ')}`);
    }
    files.set(`${id}/SKILL.md`, text);
  }
  files.set('README.md', readmeMd(prompts, version));
  return { files, prompts, version };
}

// ── The in-repo spec validator (skills-ref substitute) ───────────────────────

/** Minimal frontmatter reader: top-level `key: value` plus a one-level
 *  `metadata:` map. Values are returned as strings, double quotes unwrapped. */
export function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return { error: 'no YAML frontmatter: file does not start with "---"' };
  const end = text.indexOf('\n---\n', 3);
  if (end === -1) return { error: 'unterminated YAML frontmatter: no closing "---" line' };
  const fields = {};
  const metadata = {};
  let inMeta = false;
  for (const raw of text.slice(4, end + 1).split('\n')) {
    if (!raw.trim()) continue;
    const unquote = (v) => {
      const t = v.trim();
      if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
        return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      return t;
    };
    const nested = /^ {2}([A-Za-z0-9_.-]+):\s*(.*)$/.exec(raw);
    if (inMeta && nested) {
      metadata[nested[1]] = unquote(nested[2]);
      continue;
    }
    const top = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(raw);
    if (!top) return { error: `frontmatter line is neither a top-level key nor a metadata entry: ${JSON.stringify(raw)}` };
    inMeta = top[1] === 'metadata' && top[2].trim() === '';
    if (inMeta) continue;
    fields[top[1]] = unquote(top[2]);
  }
  return { fields, metadata, body: text.slice(end + 5) };
}

/** Every spec rule quoted in this file's header, over one SKILL.md. */
export function validateSkill(dirName, text) {
  const errs = [];
  const parsed = parseFrontmatter(text);
  if (parsed.error) return [`${dirName}/SKILL.md: ${parsed.error}`];
  const { fields, metadata } = parsed;

  const name = fields.name;
  if (!name) errs.push(`${dirName}/SKILL.md: required field "name" is missing`);
  else {
    if (name.length < 1 || name.length > NAME_MAX) errs.push(`${dirName}/SKILL.md: name is ${name.length} chars, must be 1-${NAME_MAX}`);
    if (!NAME_RE.test(name)) errs.push(`${dirName}/SKILL.md: name "${name}" must be lowercase a-z 0-9 and single hyphens, with no leading, trailing, or consecutive hyphen`);
    if (name !== dirName) errs.push(`${dirName}/SKILL.md: name "${name}" does not match its parent directory "${dirName}"`);
  }

  const desc = fields.description;
  if (!desc) errs.push(`${dirName}/SKILL.md: required field "description" is missing or empty`);
  else if (desc.length > DESC_MAX) errs.push(`${dirName}/SKILL.md: description is ${desc.length} chars, over the ${DESC_MAX} limit`);

  if (fields.compatibility && fields.compatibility.length > COMPAT_MAX) {
    errs.push(`${dirName}/SKILL.md: compatibility is ${fields.compatibility.length} chars, over the ${COMPAT_MAX} limit`);
  }
  for (const [k, v] of Object.entries(metadata)) {
    if (typeof v !== 'string' || v === '') errs.push(`${dirName}/SKILL.md: metadata.${k} must be a non-empty string value (the spec's map is string to string)`);
  }
  const lines = text.split('\n').length;
  if (lines > FILE_MAX_LINES) errs.push(`${dirName}/SKILL.md: ${lines} lines, over the ${FILE_MAX_LINES}-line spec guidance`);
  return errs;
}

// ── Disk helpers ─────────────────────────────────────────────────────────────

function walk(dir, prefix = '') {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(abs).isDirectory()) for (const [k, v] of walk(abs, rel)) out.set(k, v);
    else out.set(rel, readFileSync(abs, 'utf8'));
  }
  return out;
}

function diff(expected, onDisk) {
  const errs = [];
  for (const [rel, text] of expected) {
    if (!onDisk.has(rel)) errs.push(`missing: ${OUT_REL}/${rel}`);
    else if (onDisk.get(rel) !== text) errs.push(`stale: ${OUT_REL}/${rel}`);
  }
  for (const rel of onDisk.keys()) {
    if (!expected.has(rel)) errs.push(`unexpected file (no prompt owns it): ${OUT_REL}/${rel}`);
  }
  return errs;
}

// ── Modes ────────────────────────────────────────────────────────────────────

if (SELFTEST) {
  // RED mutation battery + GREEN controls, entirely in memory: the validator
  // must go red on each planted defect and stay green on the real tree
  // (SO #40b: a checker that cannot be shown red proves nothing).
  const { files, prompts, version } = buildTree();
  const misses = [];
  const first = prompts[0];

  const expectGreen = (label, dir, text) => {
    const errs = validateSkill(dir, text);
    if (errs.length) misses.push(`GREEN control "${label}" went red: ${errs[0]}`);
    else console.log(`  selftest GREEN ok: ${label}`);
  };
  const expectRed = (label, dir, text) => {
    const errs = validateSkill(dir, text);
    if (!errs.length) misses.push(`RED mutation "${label}" did NOT go red`);
    else console.log(`  selftest RED ok: ${label} -> ${errs[0]}`);
  };

  const good = files.get(`${first.id}/SKILL.md`);
  expectGreen('the real generated skill validates', first.id, good);
  expectRed('bad name: uppercase', first.id, good.replace(`name: ${first.id}`, 'name: Bad-Name'));
  expectRed('bad name: leading hyphen', first.id, good.replace(`name: ${first.id}`, 'name: -bad'));
  expectRed('bad name: consecutive hyphens', first.id, good.replace(`name: ${first.id}`, 'name: bad--name'));
  expectRed('name does not match the parent directory', 'other-dir', good);
  expectRed('description missing', first.id, good.replace(/^description: .*$/m, 'description: ""'));
  expectRed('description over the 1024-char limit', first.id,
    good.replace(/^description: .*$/m, `description: ${JSON.stringify('x'.repeat(DESC_MAX + 1))}`));
  expectRed('compatibility over the 500-char limit', first.id,
    good.replace(/^compatibility: .*$/m, `compatibility: ${JSON.stringify('x'.repeat(COMPAT_MAX + 1))}`));
  expectRed('metadata value is not a string', first.id, good.replace(/^ {2}prompt_id: .*$/m, '  prompt_id:'));
  expectRed('no frontmatter at all', first.id, good.replace(/^---\n/, ''));
  expectRed('unterminated frontmatter', first.id, good.replace(/\n---\n/, '\n'));

  // The generator's own HALT rail: a non-conforming id must THROW, not rename.
  for (const badId of ['Bad-Id', 'bad-', '-bad', 'a--b', 'has space', 'x'.repeat(NAME_MAX + 1)]) {
    let threw = null;
    try { assertLegalId(badId); } catch (e) { threw = e; }
    if (!threw) misses.push(`HALT rail did NOT throw on illegal id ${JSON.stringify(badId)}`);
    else console.log(`  selftest RED ok: illegal id ${JSON.stringify(badId)} HALTs -> ${threw.message.slice(0, 70)}…`);
  }
  try {
    assertLegalId(first.id);
    console.log('  selftest GREEN ok: the real first prompt id passes the HALT rail');
  } catch (e) {
    misses.push(`GREEN control "real id passes the HALT rail" threw: ${e.message}`);
  }
  void version;

  if (misses.length) {
    console.error('selftest FAILED:');
    for (const m of misses) console.error('  ' + m);
    process.exit(1);
  }
  console.log(`selftest: every mutation went RED, every control stayed GREEN (${files.size} files, ${prompts.length} prompts).`);
  process.exit(0);
}

if (VALIDATE) {
  // The skills-ref substitute, run over the tree ON DISK.
  const onDisk = walk(OUT);
  if (!onDisk.size) {
    console.error(`gen-agent-skills --validate: ${OUT_REL}/ is absent or empty on disk. On a PR branch that is expected (single writer, SO #35): main's regen writes it. Run: node scripts/gen-agent-skills.mjs`);
    process.exit(1);
  }
  const errs = [];
  let n = 0;
  for (const [rel, text] of onDisk) {
    if (!rel.endsWith('/SKILL.md')) continue;
    n += 1;
    errs.push(...validateSkill(rel.slice(0, rel.length - '/SKILL.md'.length), text));
  }
  if (!n) errs.push(`${OUT_REL}/: no <name>/SKILL.md found`);
  if (errs.length) {
    console.error(`gen-agent-skills --validate: ${errs.length} problem(s) across ${n} skill(s):`);
    for (const e of errs) console.error('  ' + e);
    process.exit(1);
  }
  console.log(`gen-agent-skills --validate: ${n} skill(s) conform to the agentskills.io frontmatter rules (name regex + 64-char cap + directory match, description 1-${DESC_MAX}, compatibility <= ${COMPAT_MAX}, metadata string values, SKILL.md under ${FILE_MAX_LINES} lines).`);
  process.exit(0);
}

const { files, prompts, version } = buildTree();

if (CHECK) {
  const errs = diff(files, walk(OUT));
  if (errs.length) {
    console.error(`gen-agent-skills --check: STALE, ${errs.length} problem(s) against a fresh generation from ${SSOT_REL}. Run: node scripts/gen-agent-skills.mjs`);
    for (const e of errs.slice(0, 20)) console.error('  ' + e);
    if (errs.length > 20) console.error(`  … and ${errs.length - 20} more`);
    process.exit(1);
  }
  console.log(`gen-agent-skills --check: byte-exact. ${prompts.length} skills + README (${files.size} files), source digest ${version}.`);
  process.exit(0);
}

let wrote = 0;
for (const [rel, text] of files) {
  const abs = join(OUT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  if (existsSync(abs) && readFileSync(abs, 'utf8') === text) continue;
  writeFileSync(abs, text);
  wrote += 1;
}
// Prune anything under skills/ that no prompt owns — the tree is generator-owned
// in full, so a removed prompt must not leave an orphan skill behind.
let pruned = 0;
for (const rel of walk(OUT).keys()) {
  if (files.has(rel)) continue;
  rmSync(join(OUT, rel));
  pruned += 1;
}
for (const name of existsSync(OUT) ? readdirSync(OUT) : []) {
  const abs = join(OUT, name);
  if (statSync(abs).isDirectory() && !readdirSync(abs).length) rmdirSync(abs);
}
console.log(`gen-agent-skills: ${prompts.length} skills + README in ${OUT_REL}/ (${wrote} file(s) written, ${pruned} pruned, source digest ${version}).`);

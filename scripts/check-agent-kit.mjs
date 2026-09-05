#!/usr/bin/env node
/**
 * check-agent-kit.mjs — AIN-AGENT-KIT-1 gate (AGENT-REACH-BUILD-SPEC §3.4).
 *
 * Wired into preflight.mjs directly after the copy-hallmarks gate. Three
 * independent validators, each fail-closed:
 *
 *   1. FRESHNESS — regenerates the kit TWICE into temp dirs via
 *      `gen-agent-kit.mjs --out <tmp>` and byte-compares: temp A vs temp B
 *      (determinism) and temp A vs the committed tree (freshness; a stale or
 *      hand-edited emitted file is red). The gate recomputes the artifacts
 *      from kit.json — it never trusts the committed bytes' own claims
 *      (SO #34 independent derivation).
 *   2. SKILL FRONTMATTER — validates the emitted SKILL.md against the
 *      AgentSkills field list: `name` matches the AgentSkills name regex,
 *      `description` ≤ 1024 chars, no unknown top-level keys
 *      (allowed: name, description, license, metadata).
 *   3. PLUGIN MANIFEST — validates the emitted plugin.json against the
 *      vendored unofficial schema
 *      `chaingraph/standard/vendor/claude-plugin.schema.json` (pinned commit
 *      recorded in `chaingraph/standard/vendor/VENDORED.md`), via the minimal
 *      local JSON Schema validator below — no npm, no external validator
 *      process (SO #10); `skills-ref` / `claude-plugin-validate` stay
 *      reference-only.
 *
 * Exit 0 only when all three pass.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const scriptDir = dirname(fileURLToPath(import.meta.url));
// `--root <dir>` validates a fixture tree instead of the real repo (used by
// --self-test below to prove RED on tampered fixtures); the generator and the
// kit source always come from the real scripts/ and agent-kit/.
const rootArgIdx = process.argv.indexOf('--root');
const repoRoot = rootArgIdx !== -1 ? resolve(process.argv[rootArgIdx + 1]) : resolve(scriptDir, '..');
const genScript = join(scriptDir, 'gen-agent-kit.mjs');
const schemaPath = join(repoRoot, 'chaingraph', 'standard', 'vendor', 'claude-plugin.schema.json');

const failures = [];
function fail(msg) {
  failures.push(msg);
  console.error(`check-agent-kit: FAIL ${msg}`);
}

// --- regenerate into two temp dirs (determinism + freshness) -----------------

const tmpBase = mkdtempSync(join(tmpdir(), 'agent-kit-check-'));
const tmpA = join(tmpBase, 'a');
const tmpB = join(tmpBase, 'b');

function runGen(outDir) {
  execFileSync(process.execPath, [genScript, '--out', outDir], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'], // stdout carries the wrote-lines; silence on success
  });
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

function dirMap(dir) {
  const map = new Map();
  for (const p of walk(dir)) map.set(relative(dir, p).split('\\').join('/'), readFileSync(p));
  return map;
}

try {
  runGen(tmpA);
  runGen(tmpB);
} catch (err) {
  fail(`generator raised: ${err.message}`);
  rmSync(tmpBase, { recursive: true, force: true });
  process.exit(1);
}

const genA = dirMap(tmpA);
const genB = dirMap(tmpB);

if (genA.size === 0) fail('generator emitted nothing');
for (const [rel, buf] of genA) {
  const sha = createHash('sha256').update(buf).digest('hex');
  const bufB = genB.get(rel);
  if (!bufB || !bufB.equals(buf)) {
    fail(`determinism: ${rel} differs between two consecutive generations (${sha})`);
  }
  const committed = join(repoRoot, rel);
  if (!existsSync(committed)) {
    fail(`freshness: ${rel} is emitted by the generator but missing from the tree`);
    continue;
  }
  if (!readFileSync(committed).equals(buf)) {
    fail(`freshness: ${rel} is stale or hand-edited; run "node scripts/gen-agent-kit.mjs" and commit the result (${sha})`);
  }
}
for (const rel of genB.keys()) {
  if (!genA.has(rel)) fail(`determinism: ${rel} appeared only in the second generation`);
}

// --- SKILL.md frontmatter (AgentSkills field list) ---------------------------

const SKILL_ALLOWED_KEYS = new Set(['name', 'description', 'license', 'metadata']);
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

for (const skillPath of ['agent-kit/skill/SKILL.md', 'agent-kit/claude-plugin/skills/ainumbers/SKILL.md']) {
  const text = genA.get(skillPath)?.toString('utf8');
  if (text === undefined) {
    fail(`skill: ${skillPath} not among emitted artifacts`);
    continue;
  }
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) {
    fail(`skill: ${skillPath} has no frontmatter block`);
    continue;
  }
  const fm = {};
  let currentKey = null;
  for (const line of m[1].split('\n')) {
    if (/^\s/.test(line) && currentKey) {
      fm[currentKey] += '\n' + line; // nested block, kept verbatim under its key
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) {
      fail(`skill: ${skillPath} unparsable frontmatter line: ${JSON.stringify(line)}`);
      continue;
    }
    currentKey = kv[1];
    fm[currentKey] = kv[2];
  }
  const unknown = Object.keys(fm).filter((k) => !SKILL_ALLOWED_KEYS.has(k));
  if (unknown.length) fail(`skill: ${skillPath} unknown top-level frontmatter keys: ${unknown.join(', ')}`);
  if (typeof fm.name !== 'string' || !NAME_RE.test(fm.name)) {
    fail(`skill: ${skillPath} name ${JSON.stringify(fm.name)} fails the AgentSkills name regex`);
  }
  if (typeof fm.description !== 'string' || fm.description.length === 0 || fm.description.length > 1024) {
    fail(`skill: ${skillPath} description must be 1..1024 chars (got ${fm.description?.length ?? 'none'})`);
  }
  if (fm.license !== 'CC-BY-4.0') fail(`skill: ${skillPath} license must be CC-BY-4.0 (got ${JSON.stringify(fm.license)})`);
  if (!/\n\s*bins:\s*\[\s*\]/.test(String(fm.metadata))) {
    fail(`skill: ${skillPath} metadata.openclaw.requires.bins must be []`);
  }
}

// --- minimal JSON Schema validator (vendored plugin manifest schema) ---------

/**
 * Deliberately minimal draft-2020-12 subset — exactly the keywords the
 * vendored schema uses. Unknown validation keywords fail CLOSED (never
 * silently ignored): if the upstream schema grows a keyword we do not
 * implement, the gate demands an implementation, not a shrug (SO #34 rider:
 * the gate must not become the vulnerability by being weaker than its source).
 */
function makeValidator(rootSchema) {
  const KNOWN = new Set([
    '$schema', '$id', '$defs', '$comment', 'title', 'description', 'default', 'examples',
    'type', 'required', 'properties', 'additionalProperties', 'pattern', 'enum',
    'const', 'oneOf', 'anyOf', 'allOf', 'items', 'minItems', 'maxItems',
    'minLength', 'maxLength', 'minimum', 'maximum', 'format', '$ref',
  ]);

  function resolveRef(ref) {
    if (!ref.startsWith('#/')) throw new Error(`unsupported non-local $ref: ${ref}`);
    let node = rootSchema;
    for (const part of ref.slice(2).split('/')) {
      node = node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
      if (node === undefined) throw new Error(`unresolvable $ref: ${ref}`);
    }
    return node;
  }

  function checkType(v, t) {
    switch (t) {
      case 'object': return v !== null && !Array.isArray(v) && typeof v === 'object';
      case 'array': return Array.isArray(v);
      case 'string': return typeof v === 'string';
      case 'number': return typeof v === 'number' && Number.isFinite(v);
      case 'integer': return Number.isInteger(v);
      case 'boolean': return typeof v === 'boolean';
      case 'null': return v === null;
      default: throw new Error(`unsupported type keyword value: ${t}`);
    }
  }

  function validate(node, v, path) {
    for (const kw of Object.keys(node)) {
      if (!KNOWN.has(kw)) throw new Error(`unsupported schema keyword "${kw}" at ${path || '<root>'} — extend the validator, do not ignore it`);
    }
    if (node.$ref !== undefined) return validate(resolveRef(node.$ref), v, path);
    if (node.type !== undefined) {
      const types = Array.isArray(node.type) ? node.type : [node.type];
      if (!types.some((t) => checkType(v, t))) return `${path}: expected type ${types.join('|')}`;
    }
    if (node.enum !== undefined && !node.enum.some((e) => JSON.stringify(e) === JSON.stringify(v))) {
      return `${path}: not in enum`;
    }
    if (node.const !== undefined && JSON.stringify(node.const) !== JSON.stringify(v)) {
      return `${path}: not the const value`;
    }
    for (const combiner of ['oneOf', 'anyOf']) {
      if (node[combiner] !== undefined) {
        const passed = node[combiner].filter((sub) => validate(sub, v, path) === null).length;
        const ok = combiner === 'oneOf' ? passed === 1 : passed >= 1;
        if (!ok) return `${path}: ${combiner} matched ${passed} branches`;
      }
    }
    if (node.allOf !== undefined) {
      for (const sub of node.allOf) {
        const err = validate(sub, v, path);
        if (err) return err;
      }
    }
    if (typeof v === 'string') {
      if (node.minLength !== undefined && v.length < node.minLength) return `${path}: shorter than minLength`;
      if (node.maxLength !== undefined && v.length > node.maxLength) return `${path}: longer than maxLength`;
      if (node.pattern !== undefined && !new RegExp(node.pattern).test(v)) return `${path}: fails pattern ${node.pattern}`;
    }
    if (Array.isArray(v)) {
      if (node.minItems !== undefined && v.length < node.minItems) return `${path}: fewer than minItems`;
      if (node.maxItems !== undefined && v.length > node.maxItems) return `${path}: more than maxItems`;
      if (node.items !== undefined) {
        for (let i = 0; i < v.length; i++) {
          const err = validate(node.items, v[i], `${path}[${i}]`);
          if (err) return err;
        }
      }
    }
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const req of node.required ?? []) {
        if (!(req in v)) return `${path}: missing required property "${req}"`;
      }
      if (node.properties) {
        for (const [k, sub] of Object.entries(node.properties)) {
          if (k in v) {
            const err = validate(sub, v[k], path ? `${path}.${k}` : k);
            if (err) return err;
          }
        }
      }
      if (node.additionalProperties === false && node.properties) {
        const extra = Object.keys(v).filter((k) => !(k in node.properties));
        if (extra.length) return `${path}: unexpected properties ${extra.join(', ')}`;
      }
    }
    return null; // format/minimum/maximum: not load-bearing in this schema; noted, not enforced
  }

  return validate;
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const validate = makeValidator(schema);
const pluginJson = JSON.parse(readFileSync(join(repoRoot, 'agent-kit', 'claude-plugin', '.claude-plugin', 'plugin.json'), 'utf8'));
const pluginErr = validate(schema, pluginJson, 'plugin.json');
if (pluginErr) fail(`plugin.json fails the vendored claude-plugin schema: ${pluginErr}`);

rmSync(tmpBase, { recursive: true, force: true });

// --- self-test: RED+GREEN mutation control (GATE-SELFTEST-META-1) ------------

if (process.argv.includes('--self-test')) {
  const assert = (cond, label) => {
    if (!cond) {
      console.error(`check-agent-kit self-test: FAIL ${label}`);
      process.exit(1);
    }
    console.log(`check-agent-kit self-test: ok ${label}`);
  };
  const run = (root, args = []) => {
    try {
      execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--root', root, ...args], {
        cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'],
      });
      return 0;
    } catch (err) {
      return err.status ?? 1;
    }
  };
  const cp = (from, to) => {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  };
  const cpTree = (fromDir, toDir) => {
    for (const entry of readdirSync(fromDir)) {
      const f = join(fromDir, entry);
      const t = join(toDir, entry);
      if (statSync(f).isDirectory()) cpTree(f, t);
      else cp(f, t);
    }
  };
  const { copyFileSync, rmSync: rmRf } = await import('node:fs');
  const { mkdtempSync: mkdtemp } = await import('node:fs');

  // GREEN: a faithful copy of the emitted tree passes.
  const fx = mkdtemp(join(tmpdir(), 'agent-kit-selftest-'));
  const fxRoot = join(fx, 'root');
  const repoTree = resolve(scriptDir, '..');
  cpTree(join(repoTree, 'agent-kit'), join(fxRoot, 'agent-kit'));
  cp(schemaPath, join(fxRoot, 'chaingraph', 'standard', 'vendor', 'claude-plugin.schema.json'));
  assert(run(fxRoot) === 0, 'GREEN: faithful copy of the emitted tree passes');

  // RED (mutation 1): a tampered emitted file must fail freshness.
  appendFileSync(join(fxRoot, 'agent-kit', 'skill', 'SKILL.md'), '\nTAMPERED\n');
  assert(run(fxRoot) === 1, 'RED: tampered emitted file fails freshness');
  cp(join(repoTree, 'agent-kit', 'skill', 'SKILL.md'), join(fxRoot, 'agent-kit', 'skill', 'SKILL.md'));

  // RED (mutation 2): a plugin.json the vendored schema rejects must fail.
  const pluginPath = join(fxRoot, 'agent-kit', 'claude-plugin', '.claude-plugin', 'plugin.json');
  const plugin = JSON.parse(readFileSync(pluginPath, 'utf8'));
  plugin.Name = 'Not-Kebab'; // unknown top-level property AND bad casing
  writeFileSync(pluginPath, JSON.stringify(plugin, null, 2));
  assert(run(fxRoot) === 1, 'RED: schema-invalid plugin.json fails the vendored schema');
  rmRf(fx, { recursive: true, force: true });

  // Known-answer: the real emitted zip carries the store-only local header magic.
  const zip = readFileSync(join(repoTree, 'agent-kit', 'ainumbers-skill.zip'));
  assert(zip.readUInt32LE(0) === 0x04034b50, 'known-answer: zip starts with a local file header');
  assert(zip.readUInt16LE(8) === 0, 'known-answer: zip entries are store-only (method 0)');

  console.log('check-agent-kit self-test: ALL OK');
  process.exit(failures.length ? 1 : 0);
}

if (failures.length) {
  console.error(`\ncheck-agent-kit: ${failures.length} failure(s) — regenerate with "node scripts/gen-agent-kit.mjs" and commit, per AIN-AGENT-KIT-1.`);
  process.exit(1);
}
console.log('check-agent-kit: OK (freshness byte-identical across regen + committed tree; determinism proven; SKILL.md frontmatter and plugin.json valid against the vendored schema)');

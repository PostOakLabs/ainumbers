#!/usr/bin/env node
/**
 * scripts/check-chain-prompts.mjs — CHAIN-PROMPT-INFRA-1
 *
 * WHY: a chain page tells a reader what the workflow does. It does not tell an
 * agent which decision the workflow settles, which output field settles it, or
 * which input moves that field. The 569 node pages carry a manifest-derived
 * "Ask your agent" block; measured 2026-09-27, none of the 368 chain pages
 * carried anything of the kind. Tim ruled on 2026-09-27 that every new chain
 * ships a genuinely useful example prompt, fixture-backed chains first.
 *
 * The prompt SSOT is one file per chain at chaingraph/chain-prompts/<chain>.json
 * carrying only the authored fields (question, look_at, try_changing). Every
 * other word an agent reads is fixed template text in
 * chaingraph/_page-chrome.mjs buildChainAskAgentCopyText(), so a kernel change
 * can never make a shipped prompt false. This gate is what makes the rule bite:
 * hard in preflight and in CI, with a completeness leg whose baseline can only
 * shrink, so a chain that lands after this row cannot ship without a prompt.
 *
 * WHAT IT CHECKS
 *   1. Schema: the closed key set, types, and filename equal to `chain`.
 *   2. Budget: the rendered prompt is at most 110 words, the question at most
 *      30 (decisions F1 and F2; the six pilot prompts rendered 101 to 110 with
 *      the longer node PII line, which F3 replaced).
 *   3. Copy hallmarks on the rendered block, via the exported hallmarkFindings()
 *      the repo gate itself consumes (the PROMPTS-BORROW-LABELS-1 pattern).
 *      Zero tolerance: these files are new, so there is no legacy debt to shield.
 *   4. References (F2): `step` is a step of that chain, `field` exists in that
 *      step node's manifest inputSchema, a scalar `value` matches its declared
 *      type or enum, and `look_at` names the SAME step as `try_changing`. The
 *      pilot proved an upstream change never moves a downstream step's output
 *      (no output-to-input dataflow, worker.mjs:2843-2848), so a cross-step
 *      pair would ship a variant instruction that moves nothing.
 *   5. The chain is live: present in chaingraph.json `chains[]`. Chain records
 *      carry no `status` field (measured: 370 of 370 absent), so presence in
 *      the assembled graph IS the liveness test for a chain.
 *   6. Completeness: every live chain has a prompt file or appears in
 *      scripts/chain-prompts-baseline.json, which is seeded with every live
 *      chain that had no prompt when this row landed and may only SHRINK
 *      against origin/main. A chain absent from origin/main can never enter it
 *      (the first introduction of the file is the one exception, and every
 *      entry in it is checked against origin/main's chain shard set). A missing
 *      baseline makes this leg STRICTER, never looser.
 *
 * Exit codes: 0 green, 1 on any finding. Advisory only where a fact cannot be
 * established offline: with no reachable origin/main the shrink-only leg prints
 * why it was skipped and the rest of the gate stays hard.
 *
 * Usage:
 *   node scripts/check-chain-prompts.mjs             # gate (preflight + CI)
 *   node scripts/check-chain-prompts.mjs --self-test # RED + GREEN controls (SO #34c; --selftest works too)
 *   node scripts/check-chain-prompts.mjs --seed-baseline
 *                                                    # ONE-SHOT: write the baseline seed
 *
 * Zero-dependency: node builtins plus two first-party modules.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { hallmarkFindings, DEFAULT_NOTX_CAP, OVERUSE_CAP } from './check-copy-hallmarks.mjs';
import { gitEnv } from './_git-env-lib.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROMPT_DIR = resolve(REPO, 'chaingraph', 'chain-prompts');
const BASELINE = resolve(REPO, 'scripts', 'chain-prompts-baseline.json');
const GRAPH = resolve(REPO, 'chaingraph', 'chaingraph.json');

export const WORD_BUDGET = 110;
export const QUESTION_WORD_BUDGET = 30;
export const VALUE_NOTE_WORD_BUDGET = 20;
const PROMPT_KEYS = new Set(['chain', 'question', 'look_at', 'try_changing']);
const TRY_KEYS = new Set(['step', 'field', 'value', 'value_note']);

function words(s) {
  return String(s).split(/\s+/).filter(Boolean).length;
}

function normalizeProse(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** chain name -> { title, steps: [tool_id] } for every chain in the graph. */
export function loadChains(repo = REPO) {
  const cg = JSON.parse(readFileSync(resolve(repo, 'chaingraph', 'chaingraph.json'), 'utf8'));
  const out = new Map();
  for (const c of cg.chains ?? []) {
    out.set(c.name, { title: c.title || c.name, steps: (c.steps ?? []).map((s) => s.tool_id) });
  }
  return out;
}

/** tool_id -> inputSchema.properties, read on demand from the node manifest. */
function inputSchemaProps(repo, toolId) {
  const p = resolve(repo, 'manifests', `${toolId}.manifest.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'))?.mcp_tool_definition?.inputSchema?.properties ?? null;
  } catch {
    return null;
  }
}

function typeMatches(declared, value) {
  const types = Array.isArray(declared) ? declared : [declared];
  for (const t of types) {
    if (t === 'string' && typeof value === 'string') return true;
    if ((t === 'number' || t === 'integer') && typeof value === 'number') return true;
    if (t === 'boolean' && typeof value === 'boolean') return true;
    if (t === 'null' && value === null) return true;
    if (t === 'array' && Array.isArray(value)) return true;
    if (t === 'object' && value && typeof value === 'object' && !Array.isArray(value)) return true;
  }
  return false;
}

function hallmarkErrors(html) {
  const f = hallmarkFindings(html);
  const errs = [];
  const gt = (v, cap, label, detail) => {
    if (v > cap) errs.push(`copy-hallmark ${label}: ${v} (cap ${cap})${detail ? ' — ' + detail : ''}`);
  };
  gt(f.emdash, 0, 'em-dash in visible text');
  gt(f.jargon.length, 0, 'build jargon', f.jargon.join('; '));
  gt(f.bold, 0, 'bold/strong in visible text');
  gt(f.insider.length, 0, 'insider-register', f.insider.join('; '));
  gt(f.aiVocab.length, 0, 'AI-vocabulary', f.aiVocab.join('; '));
  gt(f.absolutes.length, 0, 'absolute/certainty-claim', f.absolutes.join('; '));
  gt(f.panel.length, 0, 'SCOPE-panel negation-wall', f.panel.join('; '));
  gt(f.fragHead.length, 0, 'comma-splice fragment heading', f.fragHead.join('; '));
  gt(f.notX, DEFAULT_NOTX_CAP, '", not X" defensive-negation');
  gt(f.triad, 0, 'rule-of-three triad');
  for (const [k, v] of Object.entries(f.overuse)) gt(v, OVERUSE_CAP, `"${k}" overuse`);
  if (f.doubleEscaped) errs.push(`copy-hallmark double-escaped HTML entity ×${f.doubleEscaped}`);
  if (f.hallmarks.length) errs.push(`ANTI-AI-TELL: ${f.hallmarks.join('; ')}`);
  if (f.twotoneHP) errs.push(`HIGH-PRECISION twotone ×${f.twotoneHP}`);
  if (f.cosignVocab.length) errs.push(`counter_signed_receipt vocabulary: ${f.cosignVocab.join('; ')}`);
  return errs;
}

/**
 * Every finding for ONE prompt object. PURE over its inputs, which is what the
 * --selftest battery mutates. `render` is the template pair from _page-chrome
 * (injected so this module stays importable without loading the graph).
 */
export function validatePrompt(prompt, { basename, chains, repo = REPO, render }) {
  const errs = [];
  const id = basename ?? prompt?.chain ?? '(unnamed)';
  if (!prompt || typeof prompt !== 'object' || Array.isArray(prompt)) {
    return [`${id}: prompt file must hold a JSON object`];
  }
  for (const k of Object.keys(prompt)) {
    if (!PROMPT_KEYS.has(k)) errs.push(`${id}: unknown field \`${k}\` (allowed: ${[...PROMPT_KEYS].join(', ')})`);
  }
  for (const k of ['chain', 'question', 'look_at']) {
    if (typeof prompt[k] !== 'string' || !prompt[k].trim()) errs.push(`${id}: \`${k}\` is required and must be a non-empty string`);
  }
  if (errs.length) return errs;

  if (basename && basename !== prompt.chain) errs.push(`${id}: filename does not match \`chain\` (${prompt.chain})`);

  const chain = chains.get(prompt.chain);
  if (!chain) {
    errs.push(`${id}: chain \`${prompt.chain}\` is not in chaingraph.json chains[] (not live)`);
    return errs;
  }

  if (words(prompt.question) > QUESTION_WORD_BUDGET) {
    errs.push(`${id}: question is ${words(prompt.question)} words (budget ${QUESTION_WORD_BUDGET})`);
  }
  const nt = normalizeProse(chain.title);
  if (nt && normalizeProse(prompt.question).includes(nt)) {
    errs.push(`${id}: question restates the chain title ("${chain.title}"); state the decision a practitioner faces`);
  }

  const dot = prompt.look_at.indexOf('.');
  const lookStep = dot === -1 ? prompt.look_at : prompt.look_at.slice(0, dot);
  const lookPath = dot === -1 ? '' : prompt.look_at.slice(dot + 1);
  if (!lookPath) {
    errs.push(`${id}: \`look_at\` must be step-qualified as \`<step tool_id>.<path>\` (a chain response nests step output under composite_artifact.output_payload.steps[].output_payload)`);
  }
  if (!chain.steps.includes(lookStep)) {
    errs.push(`${id}: \`look_at\` step \`${lookStep}\` is not a step of chain \`${prompt.chain}\` (steps: ${chain.steps.join(', ')})`);
  }

  const tc = prompt.try_changing;
  if (tc !== undefined) {
    if (!tc || typeof tc !== 'object' || Array.isArray(tc)) {
      errs.push(`${id}: \`try_changing\` must be an object`);
    } else {
      for (const k of Object.keys(tc)) {
        if (!TRY_KEYS.has(k)) errs.push(`${id}: unknown \`try_changing\` field \`${k}\``);
      }
      const hasValue = Object.prototype.hasOwnProperty.call(tc, 'value');
      const hasNote = Object.prototype.hasOwnProperty.call(tc, 'value_note');
      if (hasValue === hasNote) {
        errs.push(`${id}: \`try_changing\` carries exactly one of \`value\` (scalar field) or \`value_note\` (object or array field)`);
      }
      if (typeof tc.step !== 'string' || typeof tc.field !== 'string') {
        errs.push(`${id}: \`try_changing.step\` and \`try_changing.field\` are required strings`);
      } else {
        if (!chain.steps.includes(tc.step)) {
          errs.push(`${id}: \`try_changing.step\` \`${tc.step}\` is not a step of chain \`${prompt.chain}\``);
        } else {
          const props = inputSchemaProps(repo, tc.step);
          if (!props) {
            errs.push(`${id}: no manifest inputSchema for step \`${tc.step}\`, so \`field\` cannot be checked`);
          } else if (!Object.prototype.hasOwnProperty.call(props, tc.field)) {
            errs.push(`${id}: \`${tc.field}\` is not an input of \`${tc.step}\` (inputs: ${Object.keys(props).join(', ')})`);
          } else if (hasValue) {
            const schema = props[tc.field];
            if (Array.isArray(schema.enum) && !schema.enum.includes(tc.value)) {
              errs.push(`${id}: \`value\` ${JSON.stringify(tc.value)} is not in the declared enum for \`${tc.field}\` (${JSON.stringify(schema.enum)})`);
            } else if (schema.type && !typeMatches(schema.type, tc.value)) {
              errs.push(`${id}: \`value\` ${JSON.stringify(tc.value)} does not match the declared type of \`${tc.field}\` (${JSON.stringify(schema.type)})`);
            }
          }
        }
        if (lookStep !== tc.step) {
          errs.push(`${id}: \`look_at\` step \`${lookStep}\` differs from \`try_changing.step\` \`${tc.step}\`; a change to one step never moves another step's output, so the variant instruction would move nothing`);
        }
      }
      if (hasNote && (typeof tc.value_note !== 'string' || words(tc.value_note) > VALUE_NOTE_WORD_BUDGET)) {
        errs.push(`${id}: \`value_note\` must be a string of at most ${VALUE_NOTE_WORD_BUDGET} words`);
      }
    }
  }

  if (render) {
    const count = render.wordCount(prompt);
    if (count > WORD_BUDGET) errs.push(`${id}: rendered prompt is ${count} words (budget ${WORD_BUDGET})`);
    // TWO documents, because proseHtml() strips <pre> and <code>: the block's
    // own chrome prose, and the copy text the agent reads, re-wrapped as a
    // paragraph so the battery can see the authored words at all. Without the
    // second pass an em-dash in `question` would ship unflagged.
    errs.push(...hallmarkErrors(render.block(prompt)).map((e) => `${id}: ${e}`));
    errs.push(...hallmarkErrors(`<p>${render.copyText(prompt)}</p>`).map((e) => `${id}: copy text ${e}`));
  }
  return errs;
}

function promptFiles() {
  if (!existsSync(PROMPT_DIR)) return [];
  return readdirSync(PROMPT_DIR).filter((f) => f.endsWith('.json')).sort();
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return { present: false, chains: new Set() };
  const raw = JSON.parse(readFileSync(BASELINE, 'utf8'));
  return { present: true, chains: new Set(raw.chains ?? []) };
}

function git(args) {
  try {
    // GIT-ENV-LEAK-SWEEP-1: under .githooks/pre-push an inherited GIT_DIR/GIT_WORK_TREE
    // would point this shrink-only leg at the OUTER repository, so the baseline leg
    // would compare against a tree this branch never sat on. `-C REPO` alone does not
    // win over those exports; the scrub does.
    return execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: gitEnv() });
  } catch {
    return null;
  }
}

/**
 * The shrink-only leg. Returns { errs, notes }. origin/main unreachable is a
 * NOTE, never a pass for anything else: the completeness leg above already ran
 * against the committed baseline, which no unreachable ref can loosen.
 */
function baselineErrors(baseline) {
  const errs = [];
  const notes = [];
  const probe = git(['rev-parse', '--verify', '--quiet', 'origin/main']);
  if (probe === null) {
    notes.push('origin/main does not resolve here, so the shrink-only leg was SKIPPED (the completeness leg above still ran against the committed baseline).');
    return { errs, notes };
  }
  const onMain = git(['show', 'origin/main:scripts/chain-prompts-baseline.json']);
  if (onMain === null) {
    // First introduction of the file: every entry must be a chain that already
    // exists on origin/main, which is what stops a brand-new chain from being
    // born baselined. Chain shards are one file per chain (370 of 370 measured
    // 2026-09-27), so the shard tree on main IS the published chain set.
    const tree = git(['ls-tree', '-r', '--name-only', 'origin/main', '--', 'chaingraph/graph/chains']);
    if (tree === null) {
      notes.push('origin/main carries no baseline yet and its chain shard tree could not be read, so the first-introduction leg was SKIPPED.');
      return { errs, notes };
    }
    const published = new Set(
      tree.split('\n').filter(Boolean).map((p) => p.replace(/^chaingraph\/graph\/chains\//, '').replace(/\.json$/, '')),
    );
    const unpublished = [...baseline.chains].filter((c) => !published.has(c)).sort();
    if (unpublished.length) {
      errs.push(`baseline first introduction: ${unpublished.length} entr(ies) name a chain that is NOT on origin/main, which can never be baselined: ${unpublished.slice(0, 10).join(', ')}${unpublished.length > 10 ? ', …' : ''}`);
    }
    notes.push(`baseline first introduction against origin/main: ${baseline.chains.size} entr(ies), all present in origin/main's ${published.size} chain shards.`);
    return { errs, notes };
  }
  let mainSet;
  try {
    mainSet = new Set(JSON.parse(onMain).chains ?? []);
  } catch {
    errs.push('origin/main:scripts/chain-prompts-baseline.json does not parse as JSON, so shrink-only cannot be established');
    return { errs, notes };
  }
  const added = [...baseline.chains].filter((c) => !mainSet.has(c)).sort();
  if (added.length) {
    errs.push(`baseline grew by ${added.length} entr(ies) against origin/main, and it may only shrink: ${added.slice(0, 10).join(', ')}${added.length > 10 ? ', …' : ''}`);
  }
  notes.push(`baseline vs origin/main: ${baseline.chains.size} entr(ies) here, ${mainSet.size} there (${mainSet.size - baseline.chains.size} retired).`);
  return { errs, notes };
}

async function templates() {
  const m = await import(pathToFileURL(resolve(REPO, 'chaingraph', '_page-chrome.mjs')).href);
  return { block: m.buildChainAskAgentBlock, wordCount: m.chainAskAgentWordCount, copyText: m.buildChainAskAgentCopyText };
}

async function run() {
  const chains = loadChains();
  const render = await templates();
  const baseline = loadBaseline();
  const errs = [];
  const notes = [];

  const files = promptFiles();
  const covered = new Set();
  for (const f of files) {
    const basename = f.replace(/\.json$/, '');
    let prompt;
    try {
      prompt = JSON.parse(readFileSync(resolve(PROMPT_DIR, f), 'utf8'));
    } catch (e) {
      errs.push(`${basename}: prompt file does not parse as JSON (${e.message})`);
      continue;
    }
    covered.add(basename);
    errs.push(...validatePrompt(prompt, { basename, chains, render }));
  }

  const missing = [...chains.keys()].filter((c) => !covered.has(c) && !baseline.chains.has(c)).sort();
  if (missing.length) {
    errs.push(`${missing.length} live chain(s) ship no prompt file and are not baselined (CONTRACT §A3.1): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ', …' : ''}`);
  }
  const stale = [...baseline.chains].filter((c) => covered.has(c)).sort();
  if (stale.length) notes.push(`${stale.length} baseline entr(ies) now have a prompt file and can be retired: ${stale.slice(0, 6).join(', ')}${stale.length > 6 ? ', …' : ''}`);
  if (!baseline.present) notes.push('scripts/chain-prompts-baseline.json is absent, so every live chain needs a prompt file (this leg only gets stricter without it).');

  const b = baselineErrors(baseline);
  errs.push(...b.errs);
  notes.push(...b.notes);

  return { errs, notes, files, chains, covered, baseline };
}

function seedBaseline(chains, covered) {
  const list = [...chains.keys()].filter((c) => !covered.has(c)).sort();
  return {
    _comment: 'CHAIN-PROMPT-INFRA-1 completeness baseline: live chains that had no chaingraph/chain-prompts/<chain>.json when the gate landed. SHRINK-ONLY against origin/main (scripts/check-chain-prompts.mjs enforces it). A chain absent from origin/main can never be added here, which is what makes a prompt mandatory for every new chain. Backfill rows delete entries as they ship prompts; one final row deletes the file when the list reaches zero.',
    chains: list,
  };
}

/**
 * RED + GREEN controls (SO #34c). Every mutation is applied to an in-memory
 * copy of a real shipped prompt, so the battery proves the live rules fire
 * without touching a byte on disk.
 */
async function selftest() {
  const chains = loadChains();
  const render = await templates();
  const base = JSON.parse(readFileSync(resolve(PROMPT_DIR, 'call-report-edit-gate.json'), 'utf8'));
  const noteBase = JSON.parse(readFileSync(resolve(PROMPT_DIR, 'stablecoin-examiner-pack.json'), 'utf8'));
  const misses = [];
  const check = (p, basename = p.chain) => validatePrompt(p, { basename, chains, render });
  const clone = (p) => JSON.parse(JSON.stringify(p));
  const red = (label, mutate, from = base) => {
    const p = clone(from);
    const basename = mutate(p) ?? p.chain;
    const errs = check(p, basename);
    if (!errs.length) misses.push(`RED mutation "${label}" did NOT go red`);
    else console.log(`  selftest RED ok: ${label} -> ${errs[0]}`);
  };
  const green = (label, mutate, from = base) => {
    const p = clone(from);
    const basename = mutate(p) ?? p.chain;
    const errs = check(p, basename);
    if (errs.length) misses.push(`GREEN control "${label}" went red: ${errs[0]}`);
    else console.log(`  selftest GREEN ok: ${label}`);
  };

  green('the shipped scalar-value prompt', () => {});
  green('the shipped value_note prompt', () => {}, noteBase);
  red('unknown field', (p) => { p.notes = 'x'; });
  red('missing look_at', (p) => { delete p.look_at; });
  red('filename does not match chain', () => 'some-other-chain');
  red('chain absent from the graph', (p) => { p.chain = 'chain-that-does-not-exist'; return 'chain-that-does-not-exist'; });
  red('look_at not step-qualified', (p) => { p.look_at = 'total_capital_pass'; });
  red('look_at step outside the chain', (p) => { p.look_at = 'art-001-not-a-step.ratios.total_capital_pass'; });
  red('try_changing step outside the chain', (p) => { p.try_changing.step = 'art-001-not-a-step'; });
  red('field absent from the manifest inputSchema', (p) => { p.try_changing.field = 'field_that_does_not_exist'; });
  red('scalar value of the wrong type', (p) => { p.try_changing.value = 'three billion'; });
  red('both value and value_note', (p) => { p.try_changing.value_note = 'raise the risk weights'; });
  red('neither value nor value_note', (p) => { delete p.try_changing.value; });
  red('look_at and try_changing on different steps', (p) => {
    p.look_at = 'art-432-call-report-rc-balance-sheet.total_assets_usd';
  });
  red('question over budget', (p) => { p.question = Array(QUESTION_WORD_BUDGET + 2).fill('capital').join(' ') + '?'; });
  red('question restates the chain title', (p) => { p.question = `Run the ${chains.get(p.chain).title} and tell me what it says.`; });
  red('rendered prompt over the word budget', (p) => {
    p.try_changing.value_note = undefined;
    delete p.try_changing.value_note;
    p.question = Array(QUESTION_WORD_BUDGET).fill('capital').join(' ');
    p.look_at = 'art-433-call-report-rcr-capital.' + Array(WORD_BUDGET).fill('ratio path segment').join(' ');
  });
  red('em-dash in the authored question', (p) => { p.question = 'Does capital clear the minimum — before the Call Report goes out?'; });
  red('AI-vocabulary in the authored question', (p) => { p.question = 'Is it crucial that the total capital ratio clears the minimum here?'; });
  red('value_note over budget', (p) => {
    p.try_changing.value_note = Array(VALUE_NOTE_WORD_BUDGET + 3).fill('leg').join(' ');
  }, noteBase);
  green('no try_changing at all', (p) => { delete p.try_changing; });

  if (misses.length) {
    console.error('✗ check-chain-prompts selftest FAILED:');
    for (const m of misses) console.error('    ' + m);
    process.exit(1);
  }
  console.log('✓ check-chain-prompts selftest: every RED mutation went red, every GREEN control stayed green.');
}

async function main() {
  const args = process.argv.slice(2);
  // Both spellings run the same battery: --self-test is the form
  // check-gate-selftest-pairing.mjs recognises on a check-X.mjs gate, and
  // --selftest is the form this row's done gates name.
  if (args.includes('--self-test') || args.includes('--selftest')) { await selftest(); return; }
  const { errs, notes, files, chains, covered, baseline } = await run();
  if (args.includes('--seed-baseline')) {
    // One-shot seeder, the KERNEL-INPUT-USAGE-CHECK-1 `--init` shape: it ran
    // exactly once, in the row that introduced the file. Afterwards the
    // baseline is shrink-only, so re-running this would try to grow it back
    // and the shrink-only leg above would red on the next run.
    const seed = seedBaseline(chains, covered);
    writeFileSync(BASELINE, JSON.stringify(seed, null, 2) + '\n', 'utf8');
    console.log(`seeded scripts/chain-prompts-baseline.json with ${seed.chains.length} live chain(s) that have no prompt file.`);
    return;
  }
  for (const n of notes) console.log(`  note: ${n}`);
  if (errs.length) {
    console.error(`✗ check-chain-prompts: ${errs.length} finding(s) — chain example prompts (CONTRACT §A3.1, CHAIN-PROMPT-INFRA-1):`);
    for (const e of errs.slice(0, 30)) console.error('    ' + e);
    if (errs.length > 30) console.error(`    … and ${errs.length - 30} more`);
    console.error('  A new chain ships chaingraph/chain-prompts/<chain>.json. Format and rubric: research/chain-prompts-2026-09/PLAN.md.');
    process.exit(1);
  }
  console.log(`✓ chain example prompts: ${files.length} prompt file(s) valid, ${chains.size} live chain(s) covered (${covered.size} with a prompt, ${baseline.chains.size} baselined), budget ${WORD_BUDGET} words.`);
}

const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (IS_CLI) main().catch((e) => { console.error(`check-chain-prompts: ${e.stack || e.message}`); process.exit(1); });

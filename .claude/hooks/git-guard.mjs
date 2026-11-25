// Keeps agents to read-only git (AGENTS.md rule 15: the human commits; agents
// only read). For whoever opts in (see IGNOREME.md's Git guard section),
// Claude Code runs this before every Bash command, as a PreToolUse hook in
// their .claude/settings.local.json, with the tool call as JSON on stdin. Every word "git" in the command, wherever it appears (after &&, inside
// bash -c '...', after env, xargs or a path like /usr/bin/git), must be followed
// by a subcommand in READ_ONLY. Otherwise this exits with code 2, which blocks
// the command and shows the agent why. Text that only mentions git, like
// echo "git push", is blocked too: failing closed beats guessing which
// mentions are commands. The hook's onFailure is "block", so a crash here
// blocks the command rather than letting it through.
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Subcommands that change neither the repo's refs, its index, nor the working
// tree. Anything not listed, aliases included, counts as mutating.
export const READ_ONLY = new Set([
  'annotate', 'blame', 'cat-file', 'check-attr', 'check-ignore', 'cherry',
  'count-objects', 'describe', 'diff', 'diff-files', 'diff-index', 'diff-tree',
  'for-each-ref', 'grep', 'help', 'log', 'ls-files', 'ls-tree', 'merge-base',
  'name-rev', 'range-diff', 'rev-list', 'rev-parse', 'shortlog', 'show',
  'show-branch', 'show-ref', 'status', 'var', 'version', 'whatchanged',
]);

// Global options whose value is the next word (git -C dir status).
const TAKES_VALUE = new Set(['-C', '--git-dir', '--work-tree', '--namespace']);
// Global options that let even a read-only subcommand run any program
// (-c core.pager=..., -c diff.external=...) or a different git.
const UNSAFE_OPTION = /^(-c|--config-env|--exec-path)/;

// What may sit right before and right after a word for it to be the word
// "git" and not part of another one (.gitignore, digital, src/git/x).
const BEFORE = /[\s;&|()`'"{}!=$\\/<>]/;
const AFTER = /[\s;&|)`'"<>}]/;

// Each git invocation in the command, as the subcommand it runs ('' for a bare
// git, '-c' etc. for an unsafe option) and whether that is read-only.
export function gitCalls(command) {
  assert.equal(typeof command, 'string', `the Bash command should be a string, got ${typeof command}`);
  const calls = [];
  for (const match of command.matchAll(/git/g)) {
    const start = match.index;
    const before = command[start - 1];
    const after = command[start + 3];
    if (before !== undefined && !BEFORE.test(before)) continue;
    if (after !== undefined && !AFTER.test(after)) continue;
    calls.push(subcommandOf(command.slice(start + 3)));
  }
  return calls;
}

function subcommandOf(rest) {
  // The words up to the end of this command (;, &, |, a newline, a backtick).
  const words = rest.split(/[;&|\n`]/)[0].split(/\s+/)
    .map((word) => word.replace(/^['"\\(]+|['"\\)]+$/g, ''))
    .filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (UNSAFE_OPTION.test(word)) return { sub: word, readOnly: false };
    if (TAKES_VALUE.has(word)) { i++; continue; }
    if (word.startsWith('-')) continue;
    return { sub: word, readOnly: READ_ONLY.has(word) };
  }
  return { sub: '', readOnly: true };
}

// Why the command is blocked, or null if every git in it is read-only.
export function blockReason(command) {
  const bad = gitCalls(command).filter((call) => !call.readOnly);
  if (bad.length === 0) return null;
  const named = bad.map((call) => `git ${call.sub}`).join(', ');
  return `Blocked by .claude/hooks/git-guard.mjs: agents may run only read-only git commands ` +
    `in this repo (AGENTS.md rule 15). Not read-only: ${named}. ` +
    `Allowed subcommands: ${[...READ_ONLY].join(', ')}.`;
}

assert.equal(typeof import.meta.main, 'boolean', 'this Node is too old to tell whether the guard was run or imported');
if (import.meta.main) {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const reason = blockReason(input.tool_input.command);
  if (reason !== null) {
    process.stderr.write(reason + '\n');
    process.exit(2);
  }
}

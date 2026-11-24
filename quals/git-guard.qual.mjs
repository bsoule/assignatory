// Keeping agents to read-only git (AGENTS.md rule 15), in two layers that each
// person opts into (quals/git-guard-setup.qual.mjs checks one's own setup):
//  - .claude/hooks/git-guard.mjs, which Claude Code can run before every Bash
//    command: which commands it lets through and which it blocks;
//  - .githooks/reference-transaction, git's own backstop for git run where the
//    guard can't see it (from inside a script): under AI_AGENT, which Claude
//    Code sets for everything it runs, no ref may change. Proven in a
//    throwaway repo, so this repo is never touched.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { blockReason } from '../.claude/hooks/git-guard.mjs';
import { ROOT, rer } from './app.mjs';

const ALLOWED = [
  'git status', 'git diff', 'git diff --stat -- src', 'git log --oneline -5', 'git show HEAD:package.json',
  'git blame server.js', 'git -C /tmp status', 'git --no-pager log', 'git --git-dir=.git log', 'git ls-files',
  'cd src && git status', 'GIT_PAGER=cat git log', 'echo "$(git rev-parse HEAD)"', 'git', 'git --version',
  'git help commit', 'ls .github', 'cat .gitignore', 'grep -rn digital src', 'cat src/git/notes.txt',
  'npm run quals', 'node server.js',
];
const BLOCKED = [
  'git commit -m x', 'git add -A', 'git push', 'git pull', 'git fetch', 'git checkout -- src', 'git checkout main',
  'git switch -c topic', 'git restore src', 'git reset --hard', 'git stash', 'git rebase main', 'git merge topic',
  'git cherry-pick abc', 'git revert abc', 'git tag v1', 'git branch topic', 'git branch -D topic', 'git rm x',
  'git mv a b', 'git clean -fd', 'git apply fix.diff', 'git am fix.mbox', 'git init', 'git config user.name x',
  'git remote add origin u', 'git worktree add ../x', 'git submodule update', 'git gc', 'git update-ref HEAD x',
  'git notes add', 'git bisect start', 'git reflog expire --all', 'git ci -m x',
  'git status && git commit -am x', 'git status; git push', 'git diff | xargs git add', 'bash -c "git push"',
  "sh -c 'git commit -m x'", 'env git commit', 'command git push', '/usr/bin/git commit -m x',
  'git -C src commit -m x', 'git -c core.pager=less log', 'git --exec-path=/x status', 'git --config-env=a=b log',
  '"git" push', 'cd src\ngit add .',
  // Fails closed: text that only mentions a mutating git command is blocked too.
  'echo "git push"',
];
for (const command of ALLOWED) {
  const reason = blockReason(command);
  assert.equal(reason, null, rer(`blockReason(${JSON.stringify(command)})`, 'null: allowed', reason));
}
for (const command of BLOCKED) {
  const reason = blockReason(command);
  assert.equal(typeof reason, 'string', rer(`blockReason(${JSON.stringify(command)})`, 'a reason: blocked', String(reason)));
}

// Run as Claude Code runs it: the tool call as JSON on stdin; exit 0 lets the
// command run, exit 2 blocks it and shows stderr to the agent.
const hook = path.join(ROOT, '.claude/hooks/git-guard.mjs');
const run = (input) => spawnSync(process.execPath, [hook], { input, encoding: 'utf8' });
const asToolCall = (command) => JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
const allowed = run(asToolCall('git status'));
assert.equal(allowed.status, 0, rer('pipe a Bash call of "git status" into the hook', 'exit 0', `exit ${allowed.status}: ${allowed.stderr}`));
const blocked = run(asToolCall('git commit -m x'));
assert.ok(blocked.status === 2 && blocked.stderr.length > 0, rer('pipe a Bash call of "git commit -m x" into the hook',
  'exit 2, with the reason on stderr', `exit ${blocked.status}, stderr ${JSON.stringify(blocked.stderr)}`));
const garbage = run('not json');
assert.ok(garbage.status !== 0 && garbage.status !== 2, rer('pipe text that is not JSON into the hook',
  'a crash (neither 0 nor 2), which the hook\'s onFailure "block" turns into a block', `exit ${garbage.status}`));

// The backstop.
const hooksDir = path.join(ROOT, '.githooks');
const hookFile = path.join(hooksDir, 'reference-transaction');
assert.ok(fs.existsSync(hookFile) && (fs.statSync(hookFile).mode & 0o111) !== 0, rer('look for .githooks/reference-transaction',
  'an executable file (git skips hooks that aren\'t executable)', fs.existsSync(hookFile) ? 'not executable' : 'missing'));

// A throwaway repo using .githooks, run with no system or global git config.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'assignatory-githooks-'));
const git = (args, agent) => spawnSync('git', [
  '-c', `core.hooksPath=${hooksDir}`, '-c', 'user.name=Qual', '-c', 'user.email=qual@example.invalid',
  '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args,
], {
  cwd: scratch,
  encoding: 'utf8',
  env: { PATH: process.env.PATH, HOME: scratch, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', ...(agent ? { AI_AGENT: 'qual' } : {}) },
});
const refs = () => git(['show-ref', '--head'], false).stdout;
try {
  const init = git(['init', '-q', '-b', 'main'], false);
  assert.equal(init.status, 0, rer(`git init in a scratch folder (${scratch})`, 'a new repo, exit 0', `exit ${init.status}: ${init.stderr}`));
  fs.writeFileSync(path.join(scratch, 'dish.txt'), 'turkey\n');
  git(['add', 'dish.txt'], false);
  const agentCommit = git(['commit', '-qm', 'agent'], true);
  assert.ok(agentCommit.status !== 0 && refs() === '', rer('in a scratch repo using .githooks, with AI_AGENT set: git commit',
    'refused, no commit made', `exit ${agentCommit.status}, refs ${JSON.stringify(refs())}`));
  const humanCommit = git(['commit', '-qm', 'human'], false);
  assert.ok(humanCommit.status === 0 && refs() !== '', rer('the same repo, without AI_AGENT (the human): git commit',
    'the commit is made', `exit ${humanCommit.status}: ${humanCommit.stderr}`));
  const before = refs();
  fs.writeFileSync(path.join(scratch, 'dish.txt'), 'tofurky\n');
  for (const args of [['commit', '-qam', 'agent'], ['branch', 'topic'], ['tag', 'v1'], ['checkout', '-q', '-b', 'topic'],
    ['update-ref', 'refs/heads/main', 'HEAD~0'], ['stash'], ['merge', '--ff-only', 'main'], ['reset', '--soft', 'HEAD']]) {
    const run = git(args, true);
    const what = `in that repo, with AI_AGENT set and dish.txt edited: git ${args.join(' ')}`;
    assert.deepEqual(refs(), before, rer(what, 'every ref unchanged', `refs now ${JSON.stringify(refs())} (exit ${run.status})`));
  }
  const kept = fs.readFileSync(path.join(scratch, 'dish.txt'), 'utf8');
  assert.equal(kept, 'tofurky\n', rer('after all those refused agent commands (stash among them)', 'the edit to dish.txt still there',
    JSON.stringify(kept)));
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

console.log(`qual pass: git guard (${ALLOWED.length} allowed, ${BLOCKED.length} blocked) and the git backstop`);

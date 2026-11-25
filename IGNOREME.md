This file is for agents. Humans get out!

## Running it

- `npm install`, then `npm start`: server.js (API) on port 3000 and Vite on 5173, with Vite proxying `/api` to the API. If either one exits, `--kill-others` stops the other.
- `API_PORT` moves the API and Vite's proxy follows. `DATA_FILE` points the server at another JSON file, e.g. a scratch copy for testing.
- Local data is `data.json` at the repo root (gitignored). An empty list gets six default dishes on the first page load.
- Production is `npm run build`, then `node server.js`, which serves `dist/` and the API from one port. On Fly (app `tgdinner`, region sjc) that's port 8080, with data in `/data/data.json` on the `data` volume. Deploy with `fly deploy`; the repo has no CI workflow.
- Port 5000 is taken on the human's Mac (macOS AirPlay Receiver).

## History

- Built on Replit (Replit DB under key `dishes`, `.replit`, `replit.nix`), moved to Fly.io 2026-11-20, Replit files and code deleted 2026-11-23 (`git log --diff-filter=D -- .replit`). replit.nix only installed vim. .replit ran `npm run start`, i.e. the Vite dev server, even in Replit's deployment, on port 5000.
- 2026-11-23: every package to its latest major (React 19, Vite 8, Tailwind 4, Express 5, lucide-react 1.x, concurrently 10), Docker base to node:24-slim, and the project to ESM (`"type": "module"`). Dropped as unneeded: cors (all requests are same-origin), autoprefixer, postcss, postcss.config.js, tailwind.config.js (its theme is now `@theme` in src/index.css), tsconfig.json (no .ts files), src/App.jsx and src/App.css, and the `dev`/`preview` scripts.

## Gotchas

- Tailwind 4 and Vite 8 both target Safari/iOS 16.4+. Tailwind 4's CSS sits in native `@layer` blocks, which browsers older than Safari 15.4 ignore entirely. The human judged that fine on 2026-11-23. The only devices stuck below 16.4 are 2014–2016 models (iPhone 6s, first SE, 7, iPad Air 2, iPad mini 4), and on iOS 15.4+ they get Tailwind's fallback styles. The old build's JavaScript already needed iOS 13.4+.
- Express 5 passes `app.listen` errors (like EADDRINUSE) to the callback instead of throwing, so server.js asserts on it.
- src/index.css restores Tailwind 3's pointer cursor on buttons.
- Tailwind 4's `space-y-*` puts margin below every child but the last, so a hidden last child (the `<datalist>`) leaves a gap. The main column uses `flex flex-col gap-6` instead.
- Tailwind 4 lets `leading-tight` beat the line-height inside `sm:text-4xl`; Tailwind 3 did the opposite. The h1 is 45px tall at ≥640px, not 40px.
- npm warns that fsevents' install script isn't approved. Harmless: it's Vite's optional macOS file-watcher dependency, ships a prebuilt binary, and loads.
- Lucide's `Edit2` and `HelpCircle` are now aliases of `Pen` and `CircleQuestionMark`.
- The upgrade grew the JS bundle from 52 to 76 KB gzipped, mostly React 19's larger react-dom. Lucide tree-shakes: only the imported icons ship (checked 2026-11-24).
- Tailwind 4 applies `hover:` styles only on devices that can hover, so on phones a tapped button no longer stays highlighted. Its preflight also turns off the browser's own tap flash (`-webkit-tap-highlight-color: transparent`). So, the usual convention: every hover look also shows while pressed (`active:` twin), which is a phone's only tap feedback. Keep the twins in step when restyling. No qual pins this, since it's purely visual.
- Green in the list means confirmed (the human's task [CHK], 2026-11-24): at rest, only a confirmed dish's name pill is green. Every ✓ button (confirm, and save in the editor) is cream until hovered or pressed, like Decline turning red. quals/confirmed-look.qual.mjs pins this without pinning a color. The category headers, the help header and the Schedule pill are green as decoration.
- Every text box that takes something has its own button ([ENT], 2026-11-24): the assign box is a `<form>` with a submit button (a person with a plus; its tooltip is Latin until the human writes it). Enter, or a phone keyboard's Go key, submits through the browser's own form handling, and the button is grayed out (disabled) while the box is blank, so blank Enter does nothing either. A failed save keeps the typed name. On phones (below `sm`) the box is 7rem wide, not 9rem, so unclaimed rows stay on one line.
- macOS filenames ignore case, and imports omit extensions, so a `src/schedule.js` would capture `import Schedule from './Schedule'` (meant for Schedule.jsx). That's why the parser is src/parseSchedule.js. After such a collision, restart the dev server: Vite caches the wrong resolution.

## Quals

- `npm run quals` runs every `quals/*.qual.mjs` in turn and stops at the first failure (1.5 to 3 minutes). Each file is a plain Node script using `node:assert/strict` that ends by printing `qual pass: ...`. Its assert messages are Replicata/Expectata/Resultata (`rer()` in quals/app.mjs).
- The browser quals build the app, run the real server.js on a free port with a temp DATA_FILE, and drive it in Playwright's Chromium, Firefox and WebKit (quals/app.mjs). On a new machine, first run `npx playwright-core install chromium firefox webkit`. Requests that would leave the machine (the web font) get an empty answer.
- The human's rule: no quals that break when wording, fonts, colors or layout change. Quals find elements through hooks only: `data-dish={id}` on dish rows, `data-view={id}` on view buttons, `data-qual="..."` on controls, plus ARIA roles (dialog, alert, aria-pressed). They assert on the stored list, the URL and ARIA state, and take expected values from the app's own helpers (src/dishes.js, src/parseSchedule.js), never from copied text.
- Page state settles a moment after whatever changed it (React renders, and runs effects, after the event or the server's answer), so read it with `settled()` (quals/app.mjs) or a `waitFor`, never just once right after acting. And read it once: an assert message that reads the page again can report a different value than the one that failed (seen 2026-11-24, as flaky Firefox and WebKit runs).
- On 2026-11-23 every qual file was shown to go red: one bug planted per file in a scratch copy of the repo. On 2026-11-24 the same was done for the validation, refresh and git-backstop assertions. One bug per file isn't enough, though. On 2026-11-24 the "remembered person" check turned out to pass with the remembering removed, because a `goto` that changes only the hash doesn't reload the page, so React's state stood in for localStorage. A fresh load needs `page.reload()` or a new tab in the same context. Two other checks were also too weak to fail ("a click inside the dialog leaves it open", "a full list isn't seeded"). Plant a bug for each new assertion.

## Git guard

AGENTS.md rule 15 is the human's own; collaborators' agents may commit. So each person opts in, and nothing in the shared files imposes the guard. Two layers, the mechanism pinned by quals/git-guard.qual.mjs:

- `.claude/hooks/git-guard.mjs`, run before every Bash command when wired up. It allows only the read-only git subcommands in its `READ_ONLY` list. Anything else (aliases, `-c` options, even `echo "git push"`) is blocked with exit 2.
- The backstop: `.githooks/reference-transaction` refuses every ref change (commit, branch, tag, reset, stash, merge, fetch, pull) made with `AI_AGENT` in the environment, so it catches git run from inside scripts too. Claude Code sets `AI_AGENT` itself (claude-code_<version>_agent). Checked 2026-11-23: neither VS Code nor its extension host has it, so the human's commits go through. It can't stop index or working-tree changes (git add, restore, checkout -- path, clean): only the guard stops those, and only when they appear in a command's text.

Opting in, per clone (the human has, in theirs):
- `.claude/settings.local.json` (gitignored) with `env.AI_AGENT` set, `permissions.deny` holding `Edit(**/.git/**)`, and a `PreToolUse` hook, matcher `Bash`, running `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/git-guard.mjs` with `onFailure: "block"` (a crash in the guard then blocks too).
- `git config core.hooksPath .githooks`, run by the human (agents can't).
- quals/git-guard-setup.qual.mjs (gitignored too) checks both, so the opt-in can't quietly stop working.

## Data validation

`listProblems` in src/dishes.js is the one definition of a valid dish list: the shapes every version of the app has saved. The server refuses a list with problems (400, `{"error": [problems]}`), and the page won't show one (it shows the alert instead). server.js imports src/dishes.js, so the Dockerfile copies that file into the runtime image. The first, Replit-era version saved assignees untrimmed and accepted names that were only spaces, which listProblems refuses. So before a deploy, check production: `curl -s https://tgdinner.fly.dev/api/dishes | node --input-type=module -e "import fs from 'node:fs'; import { listProblems } from './src/dishes.js'; const problems = listProblems(JSON.parse(fs.readFileSync(0, 'utf8'))); console.log(problems.length ? problems.join('\n') : 'passes')"`. A failed refresh (on tab focus or becoming visible) shows the same alert as a failed load: both go through loadDishes. Load and save failures have separate alerts (loadError, saveError), each cleared only when that kind of thing works again, so a refresh that works can't hide a failed save. A save that works clears both, since it loads the latest list first. Only the first load seeds an empty list with the default dishes; a refresh never does.

Since listProblems guarantees them, `categoryOf` trusts a stored category (guessing only when there is none, as in older dishes), and `isUnclaimed` is just `status === 'unassigned'`. The JSON shape is unchanged; production is in active use.

URLs are as strict: readRoute accepts only a hash the app itself writes (`routeHash`: `#<view>`, or `#mine/<encoded name>`, or none). Any other hash shows the whole list under an alert (`BAD_ROUTE` in src/ThanksgivingPlanner.jsx, in the human's words).

<!-- shared-agents:start (do not edit; run bin/sync-agents-md) -->
# Mental models

Use these when reasoning about design and implementation decisions. Do not name them in code comments or in your output unless naming one clarifies a choice.

- The Map Is Not the Territory: Trust reality over representations; update your map when reality changes.
- Circle of Competence: Know where your competence ends; use it when a decision may exceed your real expertise.
- First Principles Thinking: Strip away inherited assumptions and rebuild from what must be true; use it when convention limits better solutions.
- Second-Order Thinking: Look beyond the immediate effect; use it when downstream consequences may outweigh the first-order payoff.
- Probabilistic Thinking: Hold beliefs with calibrated confidence and update them with evidence; use it under uncertainty or when confidence is high.
- Inversion: Work backward from failure and eliminate its causes; use it when avoiding failure is easier than defining the perfect path.
- Occam's Razor: Prefer fewer unsupported assumptions; use it when multiple explanations fit the facts.
- Feedback Loops: Track what reinforces or stabilizes behavior; use feedback to adjust instead of repeating blindly.
- Bottlenecks: Optimize the constraint limiting the whole system; ignore faster parts until the bottleneck moves.
- Margin of Safety: Build buffers for being wrong; use them where unexpected failure would be costly.
- Law of Diminishing Returns: Expect each extra gain to cost more; stop optimizing when another use of effort offers higher returns.
- Multiply by Zero: Find factors whose failure can negate everything else; protect them before optimizing less critical strengths.
- Global and Local Maxima: Don't confuse the best nearby option with the best overall; accept temporary setbacks when escaping a local optimum may unlock a better one.
- Trade-offs: Treat every choice as giving up alternatives; decide by comparing opportunity costs against your real priorities.

Adapted from Felix Dietze, "Mental Models for LLMs" (https://felx.me/posts/mental-models-for-llms/), itself condensed from Farnam Street's mental models collection.
<!-- shared-agents:end -->

<!-- shared-shipping:start trunk=master deploy=no (do not edit; run bin/sync-agents-md) -->
## Shipping rules

These rules apply to any coding agent, human-assisted or autonomous, working in this repository. Keep the rest of this file agent-general. Tool-specific setup (Cursor Cloud `environment.json`, session-start hooks, IDE-only notes) belongs under `.cursor/`, not here.

## Trunk

The integration branch is **`master`**. Everywhere this file says **trunk**, that means `master`.

## Merge

Squash the PR to **one commit**, then **fast-forward** onto trunk. That squash commit **is** HEAD of trunk.

- No merge commits
- Rebase-merge is **not** the path (it keeps N commits)
- GitHub’s “Squash and merge” is the button
- **Do not merge** unless Jonathan explicitly says so for that PR (`gh pr merge --squash` is still a merge)
- Never `gh pr merge --merge`. Do not `--rebase` unless he says so for that PR

The squash SHA differs from the PR head. Treat the **code** as identical. Do not write SHA-dependent tests.

Session start may have rebased your feature branch onto trunk. If the branch was already pushed, push with `git push --force-with-lease`; a plain push will be rejected.

## CI

**This repository has no deploys.** Do not add a deploy workflow, production concurrency group, or post-merge deploy job.

Test on the PR (the code that becomes trunk). Do **not** re-run format/compile/test on push to trunk. Branch protection must **require** the PR checks so untested code cannot merge.

When CI fails on a PR, notify or resume the agent that owns that branch. Do not poll. Do not merge to “fix” CI.

## GitHub settings (human, once per repo)

Settings → General → Pull Requests:

- Allow merge commits: **off**
- Allow squash merging: **on**
- Allow rebase merging: **off**

Settings → Branches → rule on trunk:

- Require linear history: **on**
- Require the PR checks before merge

Bots do not flip admin settings from a shared machine.

## Git hooks

If this repo has `.githooks`, environment setup must set `core.hooksPath=.githooks`. Do **not** `git commit` or `git push --no-verify` unless Jonathan says so. CI is the backstop, not the only gate.

## Incomplete work (owning bot only)

This section is for the bot that owns this repo. Other agents can ignore it.

The owning bot owns open PRs, CI, merge conflicts, and drafts. Check at the weekday 8:56 America/Denver run and whenever a signal arrives. Act without waiting to be nudged. Stay silent if nothing is new.

When trunk moves: rebase remaining **non-parked** feature/`cursor/*` PRs. Skip PRs Jonathan has parked (do not nag, do not rebase).

## Do not

- Put tokens, keys, or secrets in this repo, in docs, or in chat
- Merge, spend, publish, or send external mail unless Jonathan says so
- Enable a live bot or production flag unless he says so
<!-- shared-shipping:end -->

# Working on the pattern language

The TypeScript implementation is the bootstrap reference. Read ROADMAP.md and the
relevant specification before changing language semantics. Future contracts in the
suite are not evidence that their language features are implemented. When a merge
is authorized, it is squash then fast-forward onto trunk (no merge commits); this
agent does not merge unless Jonathan says so for that PR.

Commands are `just` recipes. Run `just check` before claiming done (on a laptop, `direnv exec . just check`). Secrets only via `secrets.sh` in the recipes that need them. Never make direnv exec the only documented way; cloud VMs have no direnv.

This repository has no application secrets. Do not add Bitwarden wiring or invent credentials. Ignore `.env`. Do not source secrets from `setup`, `test`, or `check`.

`just check` is every CI gate, in order: lint, typecheck, build, host tests, source-language tests. Build before host tests because playground checks exercise the generated browser bundle. Checks use `America/Denver`.

| Recipe | Purpose |
|---|---|
| `just setup` | Install git hooks (`core.hooksPath=.githooks`) and locked npm dependencies (`npm ci`). |
| `just run FILE` | Run a `.pattern` program through `src/cli.ts`. Extra CLI flags follow the filename (`just run demo.pattern --parse`). |
| `just watch FILE` | Re-run FILE when it, `default.pattern`, or `src/**/*.ts` change (`entr`). |
| `just repl` | Interactive CLI (`--repl`). |
| `just test [path]` | A `.test` file or directory runs source-language tests; a TypeScript file runs host tests. No path runs host tests plus Dockerfile/devbox alignment and finite recipe smokes. |
| `just test-language` | Source suite (`tests/**/*.test`, excluding inbox). `just test-language --list` lists cases. |
| `just typecheck` | `tsc --noEmit`. |
| `just build` | Generate the browser bundles. |
| `just lint` | ShellCheck on repo shell scripts. |
| `just check` | All of the above, in the order CI requires. |

On a laptop, Devbox plus direnv is the development environment (Node.js 24, just, jq, git, bash, curl, shellcheck, coreutils, entr). Run `direnv allow` once per checkout, then `just`. `init_hook` and `just setup` both set `core.hooksPath=.githooks` (idempotent). Non-interactive laptop shells use `direnv exec . just …`. Cloud VMs have no direnv and run `just` directly from `.cursor/Dockerfile`; cloud `install` also sets `hooksPath`. Do not fetch shared agent files from install or start scripts.

The source suite is tests/**/*.test, grouped by topic. `tests/inbox` is optional:
default host/source runs and pre-push exclude it. Run `just test tests/inbox`
or select an inbox file to opt in. Source runs print each filename. Assertions use
expect subject result expected :: Type, assert, and expect subject error "reason".
Expected results are data, not expressions to execute. `todo test` marks a whole
expected-failure case, including language failures in its shared setup; it runs
and must fail as a unit. A file may contain only one todo test. Todo assertions
still run and must fail individually; an unexpected success requires removing
todo. Legacy assertions must pass until explicitly retired. Do not generate expected values from current outputs.
Pair each legacy assertion with a same-subject todo, or record the unresolved
replacement in design/LEGACY-ASSERTIONS.md. Supported behavior uses ordinary checks.

Use the common pattern compiler/matcher and source schemas. Preserve complete
argument-pack semantics and canonical printing, including spaces after commas.
Keep credentials out of source and browser bundles. CI requires no application secrets.

#!/usr/bin/env bash
# Finite smoke tests for just run / repl / watch. Watch is wrapped in timeout
# so validation cannot hang on entr.
set -euo pipefail
shopt -s inherit_errexit

# Git hooks (pre-commit, pre-push) export GIT_DIR and friends. Inside a linked
# worktree GIT_DIR names the worktree's private gitdir, so the throwaway
# `git init` below would otherwise rewrite the shared .git/config of the real
# repository (core.bare = true). Run every git command against its own repo.
while read -r git_env_var; do
	unset "$git_env_var"
done < <(git rev-parse --local-env-vars)

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

fail() {
	printf 'FAIL: %s\n' "$1" >&2
	exit 1
}

listed="$(just --list)"
grep -q 'run ' <<<"$listed" || fail "just --list missing run"
grep -q 'watch ' <<<"$listed" || fail "just --list missing watch"
grep -q 'repl' <<<"$listed" || fail "just --list missing repl"

grep -q 'git config core.hooksPath .githooks' justfile ||
	fail "just setup must install core.hooksPath"
python3 -c '
import json, sys
hook = json.load(open("devbox.json"))["shell"]["init_hook"]
text = "\n".join(hook)
sys.exit(0 if "git config core.hooksPath .githooks" in text else 1)
' || fail "devbox init_hook must install core.hooksPath"

tmpgit="$(mktemp -d)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmpgit" "$tmp"' EXIT
GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 git init -q "$tmpgit"
cp -R .githooks "$tmpgit/.githooks"
(
	cd "$tmpgit"
	export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
	if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && [ -d .githooks ]; then
		git config core.hooksPath .githooks
	fi
	[[ "$(git config --get core.hooksPath)" == ".githooks" ]]
	if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && [ -d .githooks ]; then
		git config core.hooksPath .githooks
	fi
	[[ "$(git config --get core.hooksPath)" == ".githooks" ]]
) || fail "hook install failed or is not idempotent"

run_out="$(just run demo.pattern)"
grep -q '12 :: Float' <<<"$run_out" ||
	fail "just run demo.pattern unexpected output: $run_out"

parse_out="$(just run demo.pattern --parse)"
grep -q 'def Rectangle' <<<"$parse_out" ||
	fail "just run demo.pattern --parse unexpected output: $parse_out"

cp demo.pattern "$tmp/demo file.pattern"
space_out="$(just run "$tmp/demo file.pattern")"
grep -q '12 :: Float' <<<"$space_out" ||
	fail "just run with a spaced filename failed: $space_out"

cp default.pattern "$tmp/custom grammar.pattern"
grammar_out="$(just run demo.pattern --grammar "$tmp/custom grammar.pattern")"
grep -q '12 :: Float' <<<"$grammar_out" ||
	fail "just run --grammar with a spaced filename failed: $grammar_out"
grep -q '/custom$' <<<"$grammar_out" &&
	fail "just run --grammar split a spaced filename"

list_out="$(just test-language --list)"
grep -q 'bindings/defaults' <<<"$list_out" ||
	fail "just test-language --list did not list cases"
grep -q 'specs/rational-literals-and-text.md#fraction-literals' <<<"$list_out" ||
	fail "just test-language --list did not discover specification tests"
grep -q 'unknown option --' <<<"$list_out" &&
	fail "just test-language --list forwarded an extra --"
grep -q 'Available recipes' <<<"$list_out" &&
	fail "just test-language --list was eaten by just --list"

pipe_out="$(printf 'bindings/defaults\n%0*d\n' 70000 0)"
grep -q 'bindings/defaults' <<<"$pipe_out" ||
	fail "large here-string grep failed"

source_file_out="$(just test tests/examples/patterns.test)"
grep -q 'FILE examples/patterns.test' <<<"$source_file_out" ||
	fail "just test did not name the source file"
grep -q 'PASS examples/patterns#' <<<"$source_file_out" ||
	fail "just test did not run a source .test file"
grep -q '0 tests failed' <<<"$source_file_out" ||
	fail "just test source file reported failures: $source_file_out"

spec_out="$(just test specs/rational-literals-and-text.md)"
grep -q 'PASS specs/rational-literals-and-text.md#fraction-literals' <<<"$spec_out" ||
	fail "just test did not run a Markdown specification"

source_dir_out="$(just test tests/examples)"
grep -q 'PASS examples/patterns#' <<<"$source_dir_out" ||
	fail "just test directory did not include pattern examples"
grep -q 'PASS examples/expressions#' <<<"$source_dir_out" ||
	fail "just test directory did not include expression examples"
grep -q '0 tests failed' <<<"$source_dir_out" ||
	fail "just test source directory reported failures: $source_dir_out"

mkdir -p "$tmp/source suite"
cp tests/examples/patterns.test "$tmp/source suite/patterns.test"
spaced_test_out="$(just test "$tmp/source suite/patterns.test")"
grep -q '0 tests failed' <<<"$spaced_test_out" ||
	fail "just test with a spaced filename failed: $spaced_test_out"
spaced_dir_out="$(just test "$tmp/source suite")"
grep -q '0 tests failed' <<<"$spaced_dir_out" ||
	fail "just test with a spaced directory failed: $spaced_dir_out"

mkdir -p "$tmp/source suite/nested"
printf 'todo test "Future"\n  assert False\nend\n' >"$tmp/source suite/nested/future.test"
broad_out="$(just test "$tmp/source suite")"
grep -q '1 todo tests failed as expected' <<<"$broad_out" ||
	fail "recursive discovery must run nested todo tests: $broad_out"

host_test_out="$(just test test/indent-prefix.test.ts)"
grep -q 'fail 0' <<<"$host_test_out" ||
	fail "just test no longer runs a host TypeScript test: $host_test_out"

printf 'test "Failing"\n  expect 1 is 2 :: Rational\nend\n' >"$tmp/failing.test"
if just test "$tmp/failing.test" >"$tmp/failing.out" 2>&1; then
	fail "just test must fail when a source assertion fails"
fi
grep -q '1 tests failed' "$tmp/failing.out" ||
	fail "just test did not report the failed source assertion"
if just test "$tmp/missing.test" >"$tmp/missing.out" 2>&1; then
	fail "just test must fail for a missing source path"
fi
grep -q 'missing.test' "$tmp/missing.out" ||
	fail "just test did not identify the missing source path"

repl_out="$(printf ':Widget\n\n:quit\n' | just repl)"
grep -q 'Widget :: UpperCamelSymbol' <<<"$repl_out" ||
	fail "just repl unexpected output: $repl_out"
ready_out="$(printf '1\n:quit\n' | just repl)"
grep -q '1 :: Rational' <<<"$ready_out" ||
	fail "just repl did not submit a finished form on its last line: $ready_out"

command -v timeout >/dev/null || fail "timeout is required for watch smoke tests"
command -v entr >/dev/null || fail "entr is required for watch smoke tests"

stop_tree() {
	local pid="$1" child
	for child in $(ps -o pid= --ppid "$pid" 2>/dev/null); do
		stop_tree "$child"
	done
	kill "$pid" 2>/dev/null || true
}

watch_log="$tmp/watch.out"
: >"$watch_log"
set +e
just watch demo.pattern >"$watch_log" 2>&1 &
watch_pid=$!
deadline=$((SECONDS + 8))
while ((SECONDS < deadline)); do
	if grep -q '12 :: Float' "$watch_log" 2>/dev/null; then
		break
	fi
	sleep 0.1
done
stop_tree "$watch_pid"
sleep 0.1
stop_tree "$watch_pid"
kill -9 "$watch_pid" 2>/dev/null || true
wait "$watch_pid" 2>/dev/null
set -e
grep -q '12 :: Float' "$watch_log" ||
	fail "just watch did not run FILE: $(cat "$watch_log")"

printf 'just run/repl/watch smoke tests passed\n'

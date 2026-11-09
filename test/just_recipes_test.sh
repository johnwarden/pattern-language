#!/usr/bin/env bash
# Finite smoke tests for just run / repl / watch. Watch is wrapped in timeout
# so validation cannot hang on entr.
set -euo pipefail
shopt -s inherit_errexit

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

fail() {
	printf 'FAIL: %s\n' "$1" >&2
	exit 1
}

listed="$(just --list)"
printf '%s\n' "$listed" | grep -q 'run ' || fail "just --list missing run"
printf '%s\n' "$listed" | grep -q 'watch ' || fail "just --list missing watch"
printf '%s\n' "$listed" | grep -q 'repl' || fail "just --list missing repl"

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
printf '%s\n' "$run_out" | grep -q '12 :: Float' ||
	fail "just run demo.pattern unexpected output: $run_out"

parse_out="$(just run demo.pattern --parse)"
printf '%s\n' "$parse_out" | grep -q 'def Rectangle' ||
	fail "just run demo.pattern --parse unexpected output: $parse_out"

cp demo.pattern "$tmp/demo file.pattern"
space_out="$(just run "$tmp/demo file.pattern")"
printf '%s\n' "$space_out" | grep -q '12 :: Float' ||
	fail "just run with a spaced filename failed: $space_out"

cp default.pattern "$tmp/custom grammar.pattern"
grammar_out="$(just run demo.pattern --grammar "$tmp/custom grammar.pattern")"
printf '%s\n' "$grammar_out" | grep -q '12 :: Float' ||
	fail "just run --grammar with a spaced filename failed: $grammar_out"
printf '%s\n' "$grammar_out" | grep -q '/custom$' &&
	fail "just run --grammar split a spaced filename"

list_out="$(just test-language --list)"
printf '%s\n' "$list_out" | grep -q 'bindings/defaults' ||
	fail "just test-language --list did not list cases"
printf '%s\n' "$list_out" | grep -q 'unknown option --' &&
	fail "just test-language --list forwarded an extra --"
printf '%s\n' "$list_out" | grep -q 'Available recipes' &&
	fail "just test-language --list was eaten by just --list"

repl_out="$(printf ':Widget\n\n:quit\n' | just repl)"
printf '%s\n' "$repl_out" | grep -q 'Widget :: UpperCamelSymbol' ||
	fail "just repl unexpected output: $repl_out"
ready_out="$(printf '1\n:quit\n' | just repl)"
printf '%s\n' "$ready_out" | grep -q '1 :: Rational' ||
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

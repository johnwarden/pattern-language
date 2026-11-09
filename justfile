set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-load := true

export TZ := "America/Denver"

node := "node --disable-warning=ExperimentalWarning"

# List recipes
default:
    @just --list

# Install git hooks (idempotent) and locked npm dependencies
setup:
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && [ -d .githooks ]; then git config core.hooksPath .githooks; fi
    npm ci

# Run a .pattern program (extra CLI flags follow the filename)
[positional-arguments]
run FILE *args:
    #!/usr/bin/env bash
    set -euo pipefail
    {{ node }} src/cli.ts "$@"

# Re-run FILE when it, default.pattern, or src/**/*.ts change
[positional-arguments]
watch FILE:
    #!/usr/bin/env bash
    set -euo pipefail
    file="$1"
    if [[ ! -e "$file" ]]; then
      printf 'watch: file not found: %s\n' "$file" >&2
      exit 1
    fi
    {
      printf '%s\n' "$file"
      if [[ -f default.pattern ]]; then
        printf '%s\n' default.pattern
      fi
      find src -type f -name '*.ts' -print
    } | entr -n -c just run "$file"

# Interactive CLI
repl:
    {{ node }} src/cli.ts --repl

# Host tests, or a source .test file/directory. Full run includes shell smokes.
[positional-arguments]
test path="":
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -n "${1:-}" ]]; then
      if [[ -d "$1" || "$1" == *.test ]]; then
        {{ node }} src/test-cli.ts "$1"
      else
        {{ node }} --test "$1"
      fi
    else
      align_log="$(mktemp)"
      smoke_log="$(mktemp)"
      trap 'rm -f "$align_log" "$smoke_log"' EXIT
      bash test/cursor_dockerfile_devbox_align_test.sh >"$align_log" 2>&1 &
      align_pid=$!
      bash test/just_recipes_test.sh >"$smoke_log" 2>&1 &
      smoke_pid=$!
      set +e
      npm test
      npm_status=$?
      wait "$align_pid"
      align_status=$?
      wait "$smoke_pid"
      smoke_status=$?
      set -e
      cat "$align_log"
      cat "$smoke_log"
      if ((npm_status != 0 || align_status != 0 || smoke_status != 0)); then
        printf 'just test failed: host %s, dockerfile align %s, recipe smokes %s\n' \
          "$npm_status" "$align_status" "$smoke_status" >&2
        exit 1
      fi
    fi

# Source-language suite (tests/**/*.test)
[positional-arguments]
test-language *args:
    #!/usr/bin/env bash
    set -euo pipefail
    npm run test:language -- "$@"

# Static types
typecheck:
    npm run check

# Generate browser bundles
build:
    npm run build

# ShellCheck on repo shell scripts
lint:
    shellcheck .githooks/pre-commit .githooks/pre-push test/cursor_dockerfile_devbox_align_test.sh test/just_recipes_test.sh

# Every CI gate. Build before host tests so playground checks see the bundle.
# Host tests and the source suite run together after that; their logs print in order.
check:
    #!/usr/bin/env bash
    set -euo pipefail
    just lint
    just typecheck
    just build
    lang_log="$(mktemp)"
    trap 'rm -f "$lang_log"' EXIT
    just test-language >"$lang_log" 2>&1 &
    lang_pid=$!
    set +e
    just test
    test_status=$?
    wait "$lang_pid"
    lang_status=$?
    set -e
    cat "$lang_log"
    if ((test_status != 0 || lang_status != 0)); then
      printf 'just check failed: just test %s, just test-language %s\n' \
        "$test_status" "$lang_status" >&2
      exit 1
    fi

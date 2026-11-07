set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-load := true

export TZ := "America/Denver"

node := "node --disable-warning=ExperimentalWarning"

# List recipes
default:
    @just --list

# Install locked npm dependencies (init_hook does this on direnv allow)
setup:
    npm ci

# Run a .pattern program (extra CLI flags follow the filename)
run FILE *args:
    {{ node }} src/cli.ts {{ args }} {{ quote(FILE) }}

# Re-run FILE when it, default.pattern, or src/**/*.ts change
watch FILE:
    #!/usr/bin/env bash
    set -euo pipefail
    file={{ quote(FILE) }}
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

# Host tests; optional single path. Full run includes shell smokes.
test path="":
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -n {{ quote(path) }} ]]; then
      {{ node }} --test {{ quote(path) }}
    else
      npm test
      bash test/cursor_dockerfile_devbox_align_test.sh
      bash test/just_recipes_test.sh
    fi

# Source-language suite (tests/**/*.test)
test-language *args:
    npm run test:language -- {{ args }}

# Static types
typecheck:
    npm run check

# Generate browser bundles
build:
    npm run build

# ShellCheck on repo shell scripts
lint:
    shellcheck .githooks/pre-commit .githooks/pre-push test/cursor_dockerfile_devbox_align_test.sh test/just_recipes_test.sh

# Every CI gate
check: lint typecheck build test test-language

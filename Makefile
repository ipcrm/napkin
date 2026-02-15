# Version: use git tag if on one, otherwise tag+sha or just sha
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

# Extract semver (x.y.z) from VERSION if it's a clean tag, otherwise 0.0.0
SEMVER := $(shell echo "$(VERSION)" | grep -oE '^v?[0-9]+\.[0-9]+\.[0-9]+$$' | sed 's/^v//' || echo "0.0.0")
ifeq ($(SEMVER),)
  SEMVER := 0.0.0
endif

.PHONY: help dev build check clean lint audit test test-ts test-rust licenses licenses-npm licenses-cargo set-version

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-18s %s\n", $$1, $$2}'

set-version:
	@echo "Setting version: display=$(VERSION) semver=$(SEMVER)"
	@node -e "const f='src-tauri/tauri.conf.json'; const c=JSON.parse(require('fs').readFileSync(f,'utf8')); c.version=process.argv[1]; require('fs').writeFileSync(f,JSON.stringify(c,null,2)+'\n')" "$(SEMVER)"
	@npm version "$(SEMVER)" --no-git-tag-version --allow-same-version >/dev/null 2>&1
	@sed -i.bak 's/^version = ".*"/version = "$(SEMVER)"/' src-tauri/Cargo.toml && rm -f src-tauri/Cargo.toml.bak

dev: set-version ## Start Tauri dev mode (Rust + frontend)
	NAPKIN_VERSION=$(VERSION) npm run tauri dev

build: set-version ## Production Tauri build (.app + .dmg)
	NAPKIN_VERSION=$(VERSION) npm run tauri build

check: ## Run svelte-check TypeScript validation
	npm run check

lint: ## Run cargo clippy with warnings as errors
	cd src-tauri && cargo clippy --all-targets -- -D warnings

audit: ## Run security audits on all dependencies
	npm audit --omit=dev --audit-level=high
	cd src-tauri && cargo audit

test: test-ts test-rust ## Run all tests

test-ts: ## Run TypeScript tests
	npm test

test-rust: ## Run Rust tests
	cd src-tauri && cargo test

clean: ## Clean build artifacts
	rm -rf dist
	cd src-tauri && cargo clean

licenses: licenses-npm licenses-cargo ## Regenerate all third-party license files

licenses-npm: ## Regenerate npm third-party licenses
	npx --registry https://registry.npmjs.org generate-license-file \
		--input package.json \
		--output THIRD_PARTY_LICENSES.txt \
		--overwrite

licenses-cargo: ## Regenerate Cargo third-party licenses
	cd src-tauri && cargo about generate about.hbs -o ../THIRD_PARTY_LICENSES_RUST.txt

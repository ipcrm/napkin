.PHONY: help dev build check clean lint audit licenses licenses-npm licenses-cargo

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-18s %s\n", $$1, $$2}'

dev: ## Start Tauri dev mode (Rust + frontend)
	npm run tauri dev

build: ## Production Tauri build (.app + .dmg)
	npm run tauri build

check: ## Run svelte-check TypeScript validation
	npm run check

lint: ## Run cargo clippy with warnings as errors
	cd src-tauri && cargo clippy --all-targets -- -D warnings

audit: ## Run security audits on all dependencies
	npm audit --omit=dev --audit-level=high
	cd src-tauri && cargo audit

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

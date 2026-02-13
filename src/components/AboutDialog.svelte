<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let visible = false;

  const APP_VERSION = __APP_VERSION__;

  let activeTab: 'about' | 'licenses' = 'about';

  export function close() {
    visible = false;
    activeTab = 'about';
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && visible) {
      close();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  const dependencies = [
    { name: 'Tauri', url: 'https://tauri.app', license: 'MIT / Apache-2.0', description: 'Desktop application framework' },
    { name: 'Svelte', url: 'https://svelte.dev', license: 'MIT', description: 'Frontend framework' },
    { name: 'rough.js', url: 'https://roughjs.com', license: 'MIT', description: 'Hand-drawn style graphics' },
    { name: 'Axum', url: 'https://github.com/tokio-rs/axum', license: 'MIT', description: 'Rust web framework (MCP server)' },
    { name: 'Tokio', url: 'https://tokio.rs', license: 'MIT', description: 'Async runtime for Rust' },
    { name: 'Serde', url: 'https://serde.rs', license: 'MIT / Apache-2.0', description: 'Serialization framework' },
    { name: 'Vite', url: 'https://vitejs.dev', license: 'MIT', description: 'Build tool' },
    { name: 'TypeScript', url: 'https://typescriptlang.org', license: 'Apache-2.0', description: 'Type system for JavaScript' },
  ];
</script>

{#if visible}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="dialog-backdrop" on:click={handleBackdropClick}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="dialog" on:click|stopPropagation>
      <div class="dialog-header">
        <div class="tabs">
          <button
            class="tab"
            class:active={activeTab === 'about'}
            on:click={() => activeTab = 'about'}
          >About</button>
          <button
            class="tab"
            class:active={activeTab === 'licenses'}
            on:click={() => activeTab = 'licenses'}
          >Third-Party Licenses</button>
        </div>
        <button class="close-button" on:click={close} title="Close (ESC)">
          &times;
        </button>
      </div>

      <div class="dialog-content">
        {#if activeTab === 'about'}
          <div class="about-content">
            <div class="app-info">
              <img src="/favicon.svg" alt="Napkin logo" class="about-logo" />
              <h2 class="about-title">Napkin</h2>
              <p class="about-version">Version {APP_VERSION}</p>
            </div>
            <p class="about-description">
              A local-first drawing and diagramming application with a hand-drawn style.
              No cloud, no accounts — your data stays on your machine.
            </p>
            <div class="about-details">
              <div class="detail-row">
                <span class="detail-label">License</span>
                <span class="detail-value">MIT License</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Copyright</span>
                <span class="detail-value">2025 Napkin Contributors</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Source</span>
                <a
                  class="detail-link"
                  href="https://github.com/ipcrm/napkin"
                  target="_blank"
                  rel="noopener noreferrer"
                >github.com/ipcrm/napkin</a>
              </div>
            </div>
            <p class="about-built-with">
              Built with Tauri, Svelte, and rough.js
            </p>
          </div>
        {:else}
          <div class="licenses-content">
            <p class="licenses-intro">
              Napkin is built on the shoulders of these open source projects:
            </p>
            <div class="licenses-list">
              {#each dependencies as dep}
                <div class="license-item">
                  <div class="license-header">
                    <a
                      class="license-name"
                      href={dep.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >{dep.name}</a>
                    <span class="license-badge">{dep.license}</span>
                  </div>
                  <p class="license-description">{dep.description}</p>
                </div>
              {/each}
            </div>
            <p class="licenses-note">
              Full license texts are included in the application bundle.
              See the LICENSE file and THIRD_PARTY_LICENSES files for complete details.
            </p>
          </div>
        {/if}
      </div>

      <div class="dialog-footer">
        <button class="primary-button" on:click={close}>
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .dialog {
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    max-width: 520px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid #ddd;
  }

  .tabs {
    display: flex;
    gap: 4px;
  }

  .tab {
    padding: 6px 14px;
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #666;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tab:hover {
    background: #f5f5f5;
    color: #333;
  }

  .tab.active {
    background: #e8f0fe;
    color: #1a73e8;
    border-color: #c6dafc;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 32px;
    color: #999;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s ease;
    line-height: 1;
  }

  .close-button:hover {
    background-color: #f5f5f5;
    color: #333;
  }

  .dialog-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  /* About tab */
  .about-content {
    text-align: center;
  }

  .app-info {
    margin-bottom: 20px;
  }

  .about-logo {
    width: 64px;
    height: 64px;
    border-radius: 12px;
    margin-bottom: 12px;
  }

  .about-title {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #333;
  }

  .about-version {
    margin: 4px 0 0 0;
    font-size: 14px;
    color: #888;
  }

  .about-description {
    margin: 0 0 24px 0;
    font-size: 14px;
    color: #555;
    line-height: 1.5;
  }

  .about-details {
    text-align: left;
    background: #f9f9f9;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .detail-label {
    font-size: 13px;
    color: #888;
    font-weight: 500;
  }

  .detail-value {
    font-size: 13px;
    color: #333;
  }

  .detail-link {
    font-size: 13px;
    color: #1a73e8;
    text-decoration: none;
  }

  .detail-link:hover {
    text-decoration: underline;
  }

  .about-built-with {
    margin: 0;
    font-size: 12px;
    color: #aaa;
  }

  /* Licenses tab */
  .licenses-intro {
    margin: 0 0 16px 0;
    font-size: 14px;
    color: #555;
  }

  .licenses-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }

  .license-item {
    padding: 12px 16px;
    background: #f9f9f9;
    border-radius: 6px;
    border: 1px solid #e5e5e5;
  }

  .license-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .license-name {
    font-size: 14px;
    font-weight: 600;
    color: #1a73e8;
    text-decoration: none;
  }

  .license-name:hover {
    text-decoration: underline;
  }

  .license-badge {
    font-size: 11px;
    font-weight: 500;
    color: #666;
    background: #e8e8e8;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .license-description {
    margin: 0;
    font-size: 12px;
    color: #888;
  }

  .licenses-note {
    margin: 0;
    font-size: 12px;
    color: #aaa;
    font-style: italic;
  }

  .dialog-footer {
    padding: 16px 24px;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: flex-end;
  }

  .primary-button {
    padding: 10px 24px;
    background-color: #0066ff;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .primary-button:hover {
    background-color: #0052cc;
  }
</style>

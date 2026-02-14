<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { isTauri } from '$lib/storage/tauriFile';
  import { invoke } from '@tauri-apps/api/core';

  export let visible = false;

  const dispatch = createEventDispatcher();

  let apiEnabled = false;
  let apiLoading = false;
  let apiPort: number | null = null;
  let copied = false;
  let errorMessage = '';

  const API_PORT = 21420;

  // Refresh status whenever dialog becomes visible
  $: if (visible && isTauri()) {
    refreshStatus();
  }

  async function refreshStatus() {
    try {
      apiEnabled = await invoke<boolean>('get_api_status');
      apiPort = apiEnabled ? API_PORT : null;
    } catch (e) {
      console.error('Failed to get API status:', e);
    }
  }

  async function toggleApi() {
    if (apiLoading) return;
    if (!isTauri()) {
      errorMessage = 'MCP server is only available in the desktop app.';
      return;
    }
    apiLoading = true;
    errorMessage = '';

    try {
      if (apiEnabled) {
        await invoke('stop_api_server');
        apiEnabled = false;
        apiPort = null;
        localStorage.setItem('napkin_api_enabled', 'false');
      } else {
        const port = await invoke<number>('start_api_server');
        apiEnabled = true;
        apiPort = port;
        localStorage.setItem('napkin_api_enabled', 'true');
      }
    } catch (e: any) {
      const msg = typeof e === 'string' ? e : e?.message || String(e);
      console.error('Failed to toggle MCP server:', msg);
      // If it failed because server is already running, just refresh status
      if (msg.includes('already running')) {
        await refreshStatus();
      } else {
        errorMessage = `Failed to toggle MCP server: ${msg}`;
      }
    } finally {
      apiLoading = false;
    }
  }

  function close() {
    visible = false;
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('dialog-backdrop')) {
      close();
    }
  }

  async function copyMcpConfig() {
    const config = JSON.stringify({
      mcpServers: {
        napkin: {
          url: `http://127.0.0.1:${API_PORT}/mcp`
        }
      }
    }, null, 2);

    try {
      await navigator.clipboard.writeText(config);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = config;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="dialog-backdrop" on:click={handleBackdropClick}>
    <div class="dialog">
      <div class="dialog-header">
        <h2>Settings</h2>
        <button class="close-btn" on:click={close}>&times;</button>
      </div>

      <div class="dialog-body">
        <section class="settings-section">
          <h3>MCP Server</h3>
          <p class="section-description">
            Enable the MCP server to allow AI tools (Claude Desktop, Cursor) to control Napkin programmatically.
          </p>

          <div class="toggle-row">
            <div class="toggle-label">
              <span>Enable MCP Server</span>
              <button
                type="button"
                class="toggle-switch"
                class:active={apiEnabled}
                class:loading={apiLoading}
                on:click={toggleApi}
                disabled={apiLoading}
              >
                <span class="toggle-knob"></span>
              </button>
            </div>
          </div>

          <div class="status-row">
            <span class="status-dot" class:active={apiEnabled}></span>
            <span class="status-text">
              {#if apiLoading}
                {apiEnabled ? 'Stopping...' : 'Starting...'}
              {:else if apiEnabled}
                Running on localhost:{apiPort}
              {:else}
                Stopped
              {/if}
            </span>
          </div>

          {#if errorMessage}
            <div class="error-row">{errorMessage}</div>
          {/if}

          {#if apiEnabled}
            <div class="config-section">
              <h4>MCP Configuration</h4>
              <p class="config-description">
                Add this to your Claude Desktop or MCP client configuration:
              </p>
              <div class="config-block">
                <pre><code>{JSON.stringify({ mcpServers: { napkin: { url: `http://127.0.0.1:${API_PORT}/mcp` } } }, null, 2)}</code></pre>
                <button class="copy-btn" on:click={copyMcpConfig}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

            </div>
          {/if}
        </section>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .dialog {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    width: 480px;
    max-height: 80vh;
    overflow-y: auto;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px 12px;
    border-bottom: 1px solid #eee;
  }

  .dialog-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #333;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 22px;
    color: #999;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    line-height: 1;
  }

  .close-btn:hover {
    background: #f0f0f0;
    color: #333;
  }

  .dialog-body {
    padding: 20px 24px 24px;
  }

  .settings-section h3 {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }

  .section-description {
    margin: 0 0 16px;
    font-size: 13px;
    color: #666;
    line-height: 1.5;
  }

  .toggle-row {
    margin-bottom: 12px;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
    color: #333;
    font-weight: 500;
  }

  .toggle-switch {
    position: relative;
    width: 44px;
    height: 24px;
    background: #ccc;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: background-color 0.2s;
    padding: 0;
  }

  .toggle-switch.active {
    background: #4caf50;
  }

  .toggle-switch.loading {
    opacity: 0.6;
    cursor: wait;
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .toggle-switch.active .toggle-knob {
    transform: translateX(20px);
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ccc;
    flex-shrink: 0;
  }

  .status-dot.active {
    background: #4caf50;
    box-shadow: 0 0 6px rgba(76, 175, 80, 0.4);
  }

  .status-text {
    font-size: 13px;
    color: #666;
  }

  .config-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #eee;
  }

  .config-section h4 {
    margin: 16px 0 4px;
    font-size: 13px;
    font-weight: 600;
    color: #333;
  }

  .config-section h4:first-child {
    margin-top: 0;
  }

  .config-description {
    margin: 0 0 8px;
    font-size: 12px;
    color: #888;
  }

  .config-block {
    position: relative;
    background: #f8f8f8;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
  }

  .config-block pre {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
  }

  .config-block code {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    color: #333;
  }

  .copy-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px;
    color: #555;
    cursor: pointer;
    transition: all 0.15s;
  }

  .copy-btn:hover {
    background: #f0f0f0;
    border-color: #ccc;
  }

  .error-row {
    margin-bottom: 12px;
    padding: 8px 12px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    font-size: 12px;
    color: #dc2626;
    line-height: 1.4;
  }

</style>

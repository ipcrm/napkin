<script lang="ts">
  import type { ToolType } from '$lib/state/canvasStore';
  import ToolIcon from './ToolIcon.svelte';

  export let visible = false;
  export let tools: Array<{ id: ToolType; label: string; shortcut?: string }> = [];
  export let activeTool: ToolType;
  export let onSelectTool: (toolId: ToolType) => void;
  export let position: { top: number; left: number } = { top: 0, left: 0 };
</script>

{#if visible}
  <div class="flyout" style="top: {position.top}px; left: {position.left}px">
    <div class="flyout-grid">
      {#each tools as tool}
        <button
          class="flyout-tool"
          class:active={activeTool === tool.id}
          on:click={() => onSelectTool(tool.id)}
          title="{tool.label}{tool.shortcut ? ` (${tool.shortcut})` : ''}"
        >
          <span class="flyout-icon">
            <ToolIcon tool={tool.id} size={24} />
          </span>
          <span class="flyout-label">{tool.label}</span>
          {#if tool.shortcut}
            <span class="flyout-shortcut">{tool.shortcut}</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .flyout {
    position: fixed;
    background: white;
    border: 1px solid #e2e2e2;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
    padding: 8px;
    z-index: 1000;
    min-width: 200px;
  }

  .flyout-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }

  .flyout-tool {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 12px 8px 8px;
    border: 1.5px solid transparent;
    border-radius: 10px;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 88px;
    color: #555;
    position: relative;
  }

  .flyout-tool:hover {
    background: #f5f5f5;
    color: #333;
  }

  .flyout-tool:active {
    transform: scale(0.97);
  }

  .flyout-tool.active {
    background: #e8f0fe;
    border-color: #1a73e8;
    color: #1a73e8;
  }

  .flyout-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }

  .flyout-label {
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }

  .flyout-shortcut {
    position: absolute;
    top: 4px;
    right: 6px;
    font-size: 9px;
    font-weight: 600;
    color: #bbb;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  }

  .flyout-tool.active .flyout-shortcut {
    color: #7babf7;
  }
</style>

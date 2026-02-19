<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { VersionHistory } from '$lib/storage/schema';

  export let visible = false;
  export let history: VersionHistory;

  const dispatch = createEventDispatcher();

  let selectedIndex: number | null = null;

  $: snapshots = history?.snapshots || [];
  $: reversedSnapshots = [...snapshots].reverse();

  export function close() {
    visible = false;
    selectedIndex = null;
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

  function selectSnapshot(originalIndex: number) {
    selectedIndex = originalIndex;
  }

  function handleRestore() {
    if (selectedIndex !== null) {
      dispatch('restore', { index: selectedIndex });
    }
  }

  function formatRelativeTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
  }

  function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="dialog-backdrop" on:click={handleBackdropClick}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="dialog" on:click|stopPropagation>
      <div class="dialog-header">
        <h2 class="dialog-title">Version History</h2>
        <button class="close-button" on:click={close} title="Close (ESC)">
          &times;
        </button>
      </div>

      <div class="dialog-content">
        {#if reversedSnapshots.length === 0}
          <div class="empty-state">
            <p>No snapshots yet.</p>
            <p class="empty-hint">Snapshots are created automatically as you make changes.</p>
          </div>
        {:else}
          <div class="timeline">
            {#each reversedSnapshots as snapshot, reverseIdx}
              {@const originalIndex = snapshots.length - 1 - reverseIdx}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div
                class="timeline-entry"
                class:selected={selectedIndex === originalIndex}
                class:baseline={!!snapshot.fullState}
                on:click={() => selectSnapshot(originalIndex)}
              >
                <div class="timeline-dot" class:baseline-dot={!!snapshot.fullState}></div>
                <div class="timeline-info">
                  <div class="timeline-time">
                    <span class="relative-time">{formatRelativeTime(snapshot.timestamp)}</span>
                    <span class="absolute-time">{formatTimestamp(snapshot.timestamp)}</span>
                  </div>
                  <div class="timeline-summary">{snapshot.summary}</div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="dialog-footer">
        <span class="snapshot-count">{snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}</span>
        <div class="footer-actions">
          <button class="secondary-button" on:click={close}>
            Cancel
          </button>
          <button
            class="primary-button"
            on:click={handleRestore}
            disabled={selectedIndex === null}
          >
            Restore Selected
          </button>
        </div>
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
    max-width: 480px;
    width: 90%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid #ddd;
  }

  .dialog-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #333;
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
    padding: 16px 24px;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #888;
  }

  .empty-hint {
    font-size: 13px;
    color: #aaa;
    margin-top: 8px;
  }

  .timeline {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .timeline-entry {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.1s ease;
    border: 2px solid transparent;
  }

  .timeline-entry:hover {
    background-color: #f5f5f5;
  }

  .timeline-entry.selected {
    background-color: #e8f0fe;
    border-color: #1a73e8;
  }

  .timeline-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #ccc;
    flex-shrink: 0;
    margin-top: 5px;
  }

  .timeline-dot.baseline-dot {
    background-color: #1a73e8;
  }

  .timeline-info {
    flex: 1;
    min-width: 0;
  }

  .timeline-time {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 2px;
  }

  .relative-time {
    font-size: 13px;
    font-weight: 600;
    color: #333;
  }

  .absolute-time {
    font-size: 11px;
    color: #999;
  }

  .timeline-summary {
    font-size: 12px;
    color: #666;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dialog-footer {
    padding: 16px 24px;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .snapshot-count {
    font-size: 12px;
    color: #999;
  }

  .footer-actions {
    display: flex;
    gap: 8px;
  }

  .secondary-button {
    padding: 8px 16px;
    background-color: #fff;
    color: #444;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .secondary-button:hover {
    background-color: #f5f5f5;
    border-color: #ccc;
  }

  .primary-button {
    padding: 8px 16px;
    background-color: #1a73e8;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .primary-button:hover:not(:disabled) {
    background-color: #1557b0;
  }

  .primary-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

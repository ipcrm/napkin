<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let visible = false;

  /**
   * Close the dialog
   */
  export function close() {
    visible = false;
  }

  /**
   * Handle ESC key to close
   */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && visible) {
      close();
    }
  }

  /**
   * Handle click outside to close
   */
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

  // Detect macOS for OS-specific modifier key labels
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const mod = isMac ? '⌘' : 'Ctrl';

  // Keyboard shortcuts organized by category
  const shortcuts = [
    {
      category: 'General',
      items: [
        { keys: [mod, 'Z'], description: 'Undo' },
        { keys: [mod, 'Shift', 'Z'], description: 'Redo' },
        { keys: [mod, 'S'], description: 'Save document' },
        { keys: [mod, 'N'], description: 'New document' },
        { keys: [mod, 'O'], description: 'Open document' },
        { keys: ['?'], description: 'Show this help dialog' }
      ]
    },
    {
      category: 'Tools',
      items: [
        { keys: ['V'], description: 'Select tool' },
        { keys: ['R'], description: 'Rectangle tool' },
        { keys: ['E'], description: 'Ellipse tool' },
        { keys: ['G'], description: 'Triangle tool' },
        { keys: ['I'], description: 'Diamond tool' },
        { keys: ['X'], description: 'Hexagon tool' },
        { keys: ['P'], description: 'Star tool' },
        { keys: ['C'], description: 'Cloud tool' },
        { keys: ['Y'], description: 'Cylinder tool' },
        { keys: ['L'], description: 'Line tool' },
        { keys: ['A'], description: 'Arrow tool' },
        { keys: ['D'], description: 'Freedraw tool' },
        { keys: ['T'], description: 'Text tool' },
        { keys: ['S'], description: 'Sticky Note tool' },
        { keys: ['H'], description: 'Hand tool (pan)' }
      ]
    },
    {
      category: 'Selection',
      items: [
        { keys: [mod, 'A'], description: 'Select all' },
        { keys: [mod, 'C'], description: 'Copy selection' },
        { keys: [mod, 'V'], description: 'Paste' },
        { keys: [mod, 'D'], description: 'Duplicate selection' },
        { keys: ['Del'], description: 'Delete selection' },
        { keys: ['Backspace'], description: 'Delete selection' },
        { keys: ['Shift', 'Click'], description: 'Add to selection' },
        { keys: ['Drag'], description: 'Box select (drag on empty space)' }
      ]
    },
    {
      category: 'Arrange',
      items: [
        { keys: [mod, ']'], description: 'Bring to front' },
        { keys: [mod, '['], description: 'Send to back' },
        { keys: [mod, 'G'], description: 'Group selection' },
        { keys: [mod, 'Shift', 'G'], description: 'Ungroup selection' }
      ]
    },
    {
      category: 'View',
      items: [
        { keys: [mod, 'Scroll'], description: 'Zoom in/out' },
        { keys: ['Space', 'Drag'], description: 'Pan canvas' },
        { keys: [mod, 'Drag'], description: 'Pan canvas' },
        { keys: [mod, '0'], description: 'Reset zoom' },
        { keys: [mod, "'"], description: 'Toggle grid' },
        { keys: [mod, 'Shift', 'P'], description: 'Presentation mode' }
      ]
    }
  ];
</script>

{#if visible}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="dialog-backdrop" on:click={handleBackdropClick}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="dialog" on:click|stopPropagation>
      <div class="dialog-header">
        <h2 class="dialog-title">Keyboard Shortcuts</h2>
        <button class="close-button" on:click={close} title="Close (ESC)">
          &times;
        </button>
      </div>

      <div class="dialog-content">
        {#each shortcuts as section}
          <div class="shortcuts-section">
            <h3 class="section-title">{section.category}</h3>
            <div class="shortcuts-list">
              {#each section.items as shortcut}
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    {#each shortcut.keys as key, i}
                      {#if i > 0}
                        <span class="key-separator">+</span>
                      {/if}
                      <kbd class="key">{key}</kbd>
                    {/each}
                  </div>
                  <div class="shortcut-description">
                    {shortcut.description}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
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
    max-width: 800px;
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
    font-size: 24px;
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
    padding: 24px;
  }

  .shortcuts-section {
    margin-bottom: 32px;
  }

  .shortcuts-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: #0066ff;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background-color: #f9f9f9;
    border-radius: 6px;
    border: 1px solid #e5e5e5;
  }

  .shortcut-keys {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 180px;
  }

  .key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 10px;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    font-family: monospace;
    font-size: 13px;
    font-weight: 600;
    color: #333;
    min-width: 32px;
    text-align: center;
  }

  .key-separator {
    color: #999;
    font-size: 12px;
    font-weight: 600;
    padding: 0 2px;
  }

  .shortcut-description {
    flex: 1;
    color: #666;
    font-size: 14px;
    text-align: right;
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

  /* Responsive layout for smaller screens */
  @media (max-width: 600px) {
    .dialog {
      width: 95%;
      max-height: 90vh;
    }

    .shortcut-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .shortcut-keys {
      min-width: auto;
    }

    .shortcut-description {
      text-align: left;
    }
  }
</style>

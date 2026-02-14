<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { canvasStore, toggleGrid } from '$lib/state/canvasStore';
  import { tabStore, switchTab } from '$lib/state/tabStore';

  let visible = true;
  let fadeTimeout: ReturnType<typeof setTimeout> | null = null;
  let tabDropdownOpen = false;
  let tabSearchQuery = '';
  let tabDropdownEl: HTMLDivElement;
  let tabSearchInputEl: HTMLInputElement;

  $: hasMultipleTabs = $tabStore.tabs.length > 1;
  $: activeTab = $tabStore.tabs.find(t => t.id === $tabStore.activeTabId);
  $: filteredTabs = $tabStore.tabs.filter(tab =>
    tab.title.toLowerCase().includes(tabSearchQuery.toLowerCase())
  );

  function resetFadeTimer() {
    visible = true;
    if (fadeTimeout) clearTimeout(fadeTimeout);
    fadeTimeout = setTimeout(() => {
      visible = false;
    }, 3000);
  }

  function handleMouseMove() {
    resetFadeTimer();
  }

  function handleToggleGrid() {
    toggleGrid();
  }

  function handleExit() {
    canvasStore.update(s => ({ ...s, presentationMode: false }));
  }

  function toggleTabDropdown() {
    tabDropdownOpen = !tabDropdownOpen;
    tabSearchQuery = '';
    if (tabDropdownOpen) {
      setTimeout(() => {
        if (tabSearchInputEl) tabSearchInputEl.focus();
      }, 0);
    }
  }

  function handleTabSelect(tabId: string) {
    switchTab(tabId);
    canvasStore.update(s => ({ ...s, presentationMode: true }));
    tabDropdownOpen = false;
    tabSearchQuery = '';
  }

  function handleTabDropdownKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      tabDropdownOpen = false;
      tabSearchQuery = '';
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (tabDropdownOpen && tabDropdownEl && !tabDropdownEl.contains(event.target as Node)) {
      tabDropdownOpen = false;
      tabSearchQuery = '';
    }
  }

  onMount(() => {
    resetFadeTimer();
    window.addEventListener('mousemove', handleMouseMove);
  });

  onDestroy(() => {
    if (fadeTimeout) clearTimeout(fadeTimeout);
    window.removeEventListener('mousemove', handleMouseMove);
  });
</script>

<svelte:window on:mousedown={handleClickOutside} />

{#if $canvasStore.presentationMode}
  <div class="presentation-overlay" class:hidden={!visible}>
    <div class="presentation-toolbar">
      <button class="overlay-btn" on:click={handleToggleGrid} title="Toggle grid (G)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
        </svg>
        <span>Grid {$canvasStore.showGrid ? 'On' : 'Off'}</span>
      </button>

      {#if hasMultipleTabs}
        <div class="overlay-divider"></div>
        <div class="tab-dropdown-wrapper" bind:this={tabDropdownEl}>
          <button class="overlay-btn tab-name-btn" on:click={toggleTabDropdown} title="Switch tab">
            <span class="tab-name-text">{activeTab?.title || 'Untitled'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 15 12 9 18 15"></polyline>
            </svg>
          </button>
          {#if tabDropdownOpen}
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="tab-dropdown-panel" on:keydown={handleTabDropdownKeyDown}>
              <input
                class="tab-dropdown-search"
                bind:this={tabSearchInputEl}
                bind:value={tabSearchQuery}
                placeholder="Search tabs..."
              />
              <div class="tab-dropdown-list">
                {#each filteredTabs as tab (tab.id)}
                  <button
                    class="tab-dropdown-item"
                    class:active={tab.id === $tabStore.activeTabId}
                    on:click={() => handleTabSelect(tab.id)}
                  >
                    <span class="tab-dropdown-item-title">
                      {#if tab.isDirty}
                        <span class="dirty-indicator">&#9679;</span>
                      {/if}
                      {tab.title}
                    </span>
                    {#if tab.id === $tabStore.activeTabId}
                      <span class="active-check">&#10003;</span>
                    {/if}
                  </button>
                {:else}
                  <div class="tab-dropdown-empty">No matching tabs</div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <div class="overlay-divider"></div>
      <button class="overlay-btn exit-btn" on:click={handleExit} title="Exit presentation (Esc)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        <span>Exit</span>
      </button>
    </div>
  </div>
{/if}

<style>
  .presentation-overlay {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10001;
    transition: opacity 0.3s ease;
  }

  .presentation-overlay.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .presentation-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background-color: rgba(30, 30, 30, 0.85);
    backdrop-filter: blur(8px);
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .overlay-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #ddd;
    font-size: 13px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    white-space: nowrap;
  }

  .overlay-btn:hover {
    background-color: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .tab-name-btn {
    max-width: 160px;
  }

  .tab-name-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .exit-btn:hover {
    background-color: rgba(255, 80, 80, 0.3);
    color: #ff6b6b;
  }

  .overlay-divider {
    width: 1px;
    height: 20px;
    background-color: rgba(255, 255, 255, 0.2);
    margin: 0 4px;
  }

  .tab-dropdown-wrapper {
    position: relative;
  }

  .tab-dropdown-panel {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    width: 220px;
    background: rgba(40, 40, 40, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    backdrop-filter: blur(8px);
  }

  .tab-dropdown-search {
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.05);
    color: #eee;
  }

  .tab-dropdown-search::placeholder {
    color: #888;
  }

  .tab-dropdown-list {
    max-height: 240px;
    overflow-y: auto;
    padding: 4px;
  }

  .tab-dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 8px;
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: #ccc;
    text-align: left;
    transition: background-color 0.1s ease;
  }

  .tab-dropdown-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .tab-dropdown-item.active {
    background-color: rgba(26, 115, 232, 0.3);
    color: #8ab4f8;
  }

  .tab-dropdown-item-title {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dirty-indicator {
    color: #ff9800;
    font-size: 10px;
    line-height: 1;
  }

  .active-check {
    color: #8ab4f8;
    font-size: 12px;
    flex-shrink: 0;
  }

  .tab-dropdown-empty {
    padding: 12px 8px;
    text-align: center;
    color: #888;
    font-size: 12px;
  }
</style>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { tabStore, createTab, switchTab, closeTab, renameTab } from '$lib/state/tabStore';

  let editingTabId: string | null = null;
  let editValue = '';
  let dropdownOpen = false;
  let searchQuery = '';
  let scrolledFromStart = false;
  let tabsContainerEl: HTMLDivElement;
  let dropdownEl: HTMLDivElement;
  let searchInputEl: HTMLInputElement;

  function checkScroll() {
    if (tabsContainerEl) {
      scrolledFromStart = tabsContainerEl.scrollLeft > 0;
    }
  }

  onMount(() => {
    if (tabsContainerEl) {
      tabsContainerEl.addEventListener('scroll', checkScroll, { passive: true });
    }
  });

  onDestroy(() => {
    if (tabsContainerEl) {
      tabsContainerEl.removeEventListener('scroll', checkScroll);
    }
  });

  function handleTabClick(tabId: string) {
    if (editingTabId) return;
    switchTab(tabId);
  }

  function handleTabDoubleClick(tabId: string, currentTitle: string) {
    editingTabId = tabId;
    editValue = currentTitle;
    setTimeout(() => {
      const input = document.querySelector('.tab-rename-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  function finishRename() {
    if (editingTabId && editValue.trim()) {
      renameTab(editingTabId, editValue.trim());
    }
    editingTabId = null;
    editValue = '';
  }

  function handleRenameKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      finishRename();
    } else if (event.key === 'Escape') {
      editingTabId = null;
      editValue = '';
    }
  }

  function handleCloseTab(event: MouseEvent, tabId: string) {
    event.stopPropagation();
    closeTab(tabId);
  }

  function handleNewTab() {
    createTab();
  }

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
    searchQuery = '';
    if (dropdownOpen) {
      setTimeout(() => {
        if (searchInputEl) searchInputEl.focus();
      }, 0);
    }
  }

  function handleDropdownTabClick(tabId: string) {
    switchTab(tabId);
    dropdownOpen = false;
    searchQuery = '';
  }

  function handleDropdownKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      dropdownOpen = false;
      searchQuery = '';
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (dropdownOpen && dropdownEl && !dropdownEl.contains(event.target as Node)) {
      dropdownOpen = false;
      searchQuery = '';
    }
  }

  $: filteredTabs = $tabStore.tabs.filter(tab =>
    tab.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
</script>

<svelte:window on:mousedown={handleClickOutside} />

<div class="tab-bar">
  <div class="tabs-scroll-area" class:has-scroll-indicator={scrolledFromStart}>
    <div class="tabs-container" bind:this={tabsContainerEl}>
      {#each $tabStore.tabs as tab (tab.id)}
        <button
          class="tab"
          class:active={tab.id === $tabStore.activeTabId}
          on:click={() => handleTabClick(tab.id)}
          on:dblclick={() => handleTabDoubleClick(tab.id, tab.title)}
        >
          {#if editingTabId === tab.id}
            <input
              class="tab-rename-input"
              bind:value={editValue}
              on:blur={finishRename}
              on:keydown={handleRenameKeyDown}
            />
          {:else}
            <span class="tab-title">
              {#if tab.isDirty}
                <span class="dirty-indicator">&#9679;</span>
              {/if}
              {tab.title}
            </span>
          {/if}
          {#if $tabStore.tabs.length > 1}
            <button
              class="tab-close"
              on:click={(e) => handleCloseTab(e, tab.id)}
              title="Close tab"
            >&times;</button>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <button class="new-tab-button" on:click={handleNewTab} title="New tab">
    +
  </button>

  <div class="dropdown-wrapper" bind:this={dropdownEl}>
    <button class="dropdown-trigger" on:click={toggleDropdown} title="Show all tabs">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
    {#if dropdownOpen}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="dropdown-panel" on:keydown={handleDropdownKeyDown}>
        <input
          class="dropdown-search"
          bind:this={searchInputEl}
          bind:value={searchQuery}
          placeholder="Search tabs..."
        />
        <div class="dropdown-list">
          {#each filteredTabs as tab (tab.id)}
            <button
              class="dropdown-item"
              class:active={tab.id === $tabStore.activeTabId}
              on:click={() => handleDropdownTabClick(tab.id)}
            >
              <span class="dropdown-item-title">
                {#if tab.isDirty}
                  <span class="dirty-indicator">&#9679;</span>
                {/if}
                {tab.title}
              </span>
              {#if tab.id === $tabStore.activeTabId}
                <span class="active-indicator">&#10003;</span>
              {/if}
            </button>
          {:else}
            <div class="dropdown-empty">No matching tabs</div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .tab-bar {
    display: flex;
    align-items: center;
    background-color: #f8f8f8;
    border-bottom: 1px solid #ddd;
    padding: 0 4px 0 0;
    height: 36px;
    gap: 0;
    flex-shrink: 0;
  }

  .tabs-scroll-area {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 100%;
  }

  /* Left fade indicator when scrolled */
  .tabs-scroll-area.has-scroll-indicator::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 24px;
    background: linear-gradient(to right, #f8f8f8 30%, transparent);
    z-index: 1;
    pointer-events: none;
  }

  .tabs-container {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 100%;
    overflow-x: auto;
    padding: 0 8px;
    /* Hide scrollbar across browsers */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }

  .tabs-container::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background-color: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    cursor: pointer;
    font-size: 12px;
    color: #666;
    white-space: nowrap;
    max-width: 180px;
    transition: all 0.1s ease;
    height: 100%;
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .tab:hover {
    background-color: #eee;
    color: #444;
  }

  .tab.active {
    background-color: #fff;
    border-color: #ddd;
    color: #1a73e8;
    font-weight: 500;
  }

  .tab-title {
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .dirty-indicator {
    color: #ff9800;
    font-size: 10px;
    line-height: 1;
  }

  .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 14px;
    color: #999;
    line-height: 1;
    flex-shrink: 0;
  }

  .tab-close:hover {
    background-color: #ddd;
    color: #333;
  }

  .tab-rename-input {
    width: 100px;
    padding: 2px 4px;
    border: 1px solid #1a73e8;
    border-radius: 3px;
    font-size: 12px;
    outline: none;
    background: #fff;
  }

  .new-tab-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    color: #888;
    flex-shrink: 0;
    transition: all 0.1s ease;
  }

  .new-tab-button:hover {
    background-color: #eee;
    border-color: #ddd;
    color: #444;
  }

  .dropdown-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .dropdown-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    color: #888;
    transition: all 0.1s ease;
  }

  .dropdown-trigger:hover {
    background-color: #eee;
    border-color: #ddd;
    color: #444;
  }

  .dropdown-panel {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    width: 220px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    overflow: hidden;
  }

  .dropdown-search {
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-bottom: 1px solid #eee;
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
    background: #fafafa;
  }

  .dropdown-search::placeholder {
    color: #aaa;
  }

  .dropdown-list {
    max-height: 240px;
    overflow-y: auto;
    padding: 4px;
  }

  .dropdown-item {
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
    color: #555;
    text-align: left;
    transition: background-color 0.1s ease;
  }

  .dropdown-item:hover {
    background-color: #f0f0f0;
    color: #333;
  }

  .dropdown-item.active {
    background-color: #e8f0fe;
    color: #1a73e8;
    font-weight: 500;
  }

  .dropdown-item-title {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .active-indicator {
    color: #1a73e8;
    font-size: 12px;
    flex-shrink: 0;
  }

  .dropdown-empty {
    padding: 12px 8px;
    text-align: center;
    color: #999;
    font-size: 12px;
  }
</style>

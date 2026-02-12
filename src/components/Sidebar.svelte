<script lang="ts">
  import { canvasStore, selectedShapes, updateShape, updateShapes, updateViewport, toggleGrid } from '$lib/state/canvasStore';
  import { updateStylePreset } from '$lib/state/canvasStore';
  import ColorPicker from './sidebar/ColorPicker.svelte';
  import StrokeWidthSlider from './sidebar/StrokeWidthSlider.svelte';
  import StrokeStyleButtons from './sidebar/StrokeStyleButtons.svelte';
  import RoughnessSlider from './sidebar/RoughnessSlider.svelte';
  import OpacitySlider from './sidebar/OpacitySlider.svelte';
  import AlignmentButtons from './sidebar/AlignmentButtons.svelte';
  import ZOrderButtons from './sidebar/ZOrderButtons.svelte';
  import RecentColorsPalette from './sidebar/RecentColorsPalette.svelte';
  import RoutingModeButtons from './sidebar/RoutingModeButtons.svelte';
  import EndpointSelector from './sidebar/EndpointSelector.svelte';
  import { onMount } from 'svelte';

  // Sidebar collapsed state
  let sidebarCollapsed = false;

  // Section collapsed states
  let collapsedSections: Record<string, boolean> = {};

  onMount(() => {
    // Load collapsed state from localStorage
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') {
      sidebarCollapsed = true;
    }
    // Clear any previously saved section collapsed states - always start expanded
    localStorage.removeItem('napkin_collapsed_sections');
  });

  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
  }

  function toggleSection(name: string) {
    collapsedSections[name] = !collapsedSections[name];
    collapsedSections = collapsedSections; // trigger reactivity
  }

  function isSectionOpen(name: string): boolean {
    return !collapsedSections[name];
  }

  $: shapes = $selectedShapes;
  $: hasSelection = shapes.length > 0;

  // Auto-expand sidebar when a shape is selected
  $: if (hasSelection && sidebarCollapsed) {
    sidebarCollapsed = false;
    localStorage.setItem('sidebarCollapsed', 'false');
  }
  $: isSingleSelection = shapes.length === 1;
  $: isMultiSelection = shapes.length >= 2;
  $: viewport = $canvasStore.viewport;
  $: stylePreset = $canvasStore.stylePreset;
  $: showGrid = $canvasStore.showGrid;
  $: isLineOrArrow = shapes.length > 0 && shapes.every(s => s.type === 'line' || s.type === 'arrow');
  $: isStickyNote = shapes.length === 1 && shapes[0].type === 'sticky';
  $: currentStickyColor = isStickyNote ? (shapes[0] as any).stickyColor : '';
  $: isGeometricShape = shapes.length === 1 && shapes[0].type !== 'text' && shapes[0].type !== 'sticky' && shapes[0].type !== 'line' && shapes[0].type !== 'arrow' && shapes[0].type !== 'freedraw';

  // Get common properties for selected shapes
  $: commonProps = getCommonProperties(shapes);

  import type { StrokeStyle, FillStyle, RoutingMode, EndpointConfig, TextAlign, VerticalAlign, LabelPosition } from '$lib/types';
  import { STICKY_NOTE_COLORS } from '$lib/types';

  const stickyColorEntries = Object.entries(STICKY_NOTE_COLORS) as [string, string][];

  function handleStickyColorChange(color: string) {
    shapes.forEach(shape => {
      updateShape(shape.id, { stickyColor: color, fillColor: color } as any);
    });
  }

  interface CommonProps {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    strokeColor?: string;
    fillColor?: string;
    fillStyle?: FillStyle;
    strokeWidth?: number;
    strokeStyle?: StrokeStyle;
    opacity?: number;
    roughness?: number;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    textAlign?: TextAlign;
    verticalAlign?: VerticalAlign;
    labelPosition?: LabelPosition;
    routingMode?: RoutingMode;
    startEndpoint?: EndpointConfig;
    endEndpoint?: EndpointConfig;
  }

  function getCommonProperties(shapes: any[]): CommonProps {
    if (shapes.length === 0) return {};
    if (shapes.length === 1) {
      const shape = shapes[0];
      const props: CommonProps = {
        x: shape.x,
        y: shape.y,
        width: (shape as any).width,
        height: (shape as any).height,
        strokeColor: shape.strokeColor,
        fillColor: shape.fillColor,
        fillStyle: shape.fillStyle || 'hachure',
        strokeWidth: shape.strokeWidth,
        strokeStyle: shape.strokeStyle || 'solid',
        opacity: shape.opacity,
        roughness: shape.roughness ?? 1,
        text: shape.text || '',
      };

      // Add font properties for any shape with text
      if (shape.text !== undefined || shape.type === 'text') {
        props.fontSize = (shape as any).fontSize || 14;
        props.fontFamily = (shape as any).fontFamily || 'sans-serif';
        props.textAlign = (shape as any).textAlign || 'center';
        props.verticalAlign = (shape as any).verticalAlign || 'middle';
        props.labelPosition = (shape as any).labelPosition || 'inside';
      }

      // Add routing mode and endpoint properties for line/arrow shapes
      if (shape.type === 'line' || shape.type === 'arrow') {
        props.routingMode = (shape as any).routingMode || 'direct';
        props.startEndpoint = (shape as any).startEndpoint || { shape: shape.type === 'arrow' ? 'none' : 'none', size: 1 };
        props.endEndpoint = (shape as any).endEndpoint || { shape: shape.type === 'arrow' ? 'arrow' : 'none', size: 1 };

        // For legacy arrows without endpoint config, derive from arrowhead booleans
        if (shape.type === 'arrow' && !(shape as any).endEndpoint) {
          if ((shape as any).arrowheadEnd) {
            props.endEndpoint = { shape: 'arrow', size: 1 };
          }
          if ((shape as any).arrowheadStart) {
            props.startEndpoint = { shape: 'arrow', size: 1 };
          }
        }
      }

      return props;
    }

    // Multi-select: only show common properties
    const common: CommonProps = {};
    const first = shapes[0];

    if (shapes.every(s => s.strokeColor === first.strokeColor)) {
      common.strokeColor = first.strokeColor;
    }
    if (shapes.every(s => s.fillColor === first.fillColor)) {
      common.fillColor = first.fillColor;
    }
    if (shapes.every(s => (s.fillStyle || 'hachure') === (first.fillStyle || 'hachure'))) {
      common.fillStyle = first.fillStyle || 'hachure';
    }
    if (shapes.every(s => s.strokeWidth === first.strokeWidth)) {
      common.strokeWidth = first.strokeWidth;
    }
    if (shapes.every(s => (s.strokeStyle || 'solid') === (first.strokeStyle || 'solid'))) {
      common.strokeStyle = first.strokeStyle || 'solid';
    }
    if (shapes.every(s => s.opacity === first.opacity)) {
      common.opacity = first.opacity;
    }
    if (shapes.every(s => (s.roughness ?? 1) === (first.roughness ?? 1))) {
      common.roughness = first.roughness ?? 1;
    }
    // Check if all shapes have the same text
    if (shapes.every(s => s.text === first.text)) {
      common.text = first.text;
    }

    // Check if all shapes have the same routing mode (only for line/arrow types)
    const lineArrowShapes = shapes.filter(s => s.type === 'line' || s.type === 'arrow');
    if (lineArrowShapes.length > 0 && lineArrowShapes.length === shapes.length) {
      const firstMode = (lineArrowShapes[0] as any).routingMode || 'direct';
      if (lineArrowShapes.every(s => ((s as any).routingMode || 'direct') === firstMode)) {
        common.routingMode = firstMode;
      }

      // Check endpoint shapes
      const getStartEp = (s: any): EndpointConfig => {
        if (s.startEndpoint) return s.startEndpoint;
        if (s.type === 'arrow' && s.arrowheadStart) return { shape: 'arrow', size: 1 };
        return { shape: 'none', size: 1 };
      };
      const getEndEp = (s: any): EndpointConfig => {
        if (s.endEndpoint) return s.endEndpoint;
        if (s.type === 'arrow' && s.arrowheadEnd) return { shape: 'arrow', size: 1 };
        return { shape: 'none', size: 1 };
      };

      const firstStartEp = getStartEp(lineArrowShapes[0]);
      const firstEndEp = getEndEp(lineArrowShapes[0]);

      if (lineArrowShapes.every(s => getStartEp(s).shape === firstStartEp.shape && getStartEp(s).size === firstStartEp.size)) {
        common.startEndpoint = firstStartEp;
      }
      if (lineArrowShapes.every(s => getEndEp(s).shape === firstEndEp.shape && getEndEp(s).size === firstEndEp.size)) {
        common.endEndpoint = firstEndEp;
      }
    }

    return common;
  }

  // Property update handlers
  function updateProperty(property: string, value: any) {
    shapes.forEach(shape => {
      updateShape(shape.id, { [property]: value });
    });
    // Also update stylePreset so next shape inherits this setting
    const presetProperties = ['strokeColor', 'fillColor', 'fillStyle', 'strokeWidth', 'strokeStyle', 'opacity', 'roughness'];
    if (presetProperties.includes(property)) {
      updateStylePreset({ [property]: value });
    }
  }

  function handleNumberInput(property: string, event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    if (!isNaN(value)) {
      updateProperty(property, value);
    }
  }

  const defaultStyle = {
    strokeColor: '#000000',
    fillColor: 'transparent',
    fillStyle: 'hachure' as const,
    strokeWidth: 2,
    strokeStyle: 'solid' as const,
    opacity: 1,
    roughness: 1,
  };

  function resetToDefaults() {
    shapes.forEach(shape => {
      updateShape(shape.id, {
        strokeColor: defaultStyle.strokeColor,
        fillColor: defaultStyle.fillColor,
        fillStyle: defaultStyle.fillStyle,
        strokeWidth: defaultStyle.strokeWidth,
        strokeStyle: defaultStyle.strokeStyle,
        opacity: defaultStyle.opacity,
        roughness: defaultStyle.roughness,
      });
    });
    updateStylePreset(defaultStyle);
  }

  function handleRoutingModeChange(mode: string) {
    import('$lib/utils/routing').then(({ getDefaultControlPoints }) => {
      shapes.forEach(shape => {
        if (shape.type === 'line' || shape.type === 'arrow') {
          const lineOrArrow = shape as any;
          const controlPoints = getDefaultControlPoints(
            lineOrArrow.x, lineOrArrow.y,
            lineOrArrow.x2, lineOrArrow.y2,
            mode as any
          );
          updateShape(shape.id, { routingMode: mode, controlPoints });
        }
      });
    });
  }

  // Zoom controls
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 10;
  const ZOOM_STEP = 0.1;

  $: zoomPercentage = Math.round(viewport.zoom * 100);

  function zoomIn() {
    const newZoom = Math.min(viewport.zoom + ZOOM_STEP, MAX_ZOOM);
    updateViewport({ zoom: newZoom });
  }

  function zoomOut() {
    const newZoom = Math.max(viewport.zoom - ZOOM_STEP, MIN_ZOOM);
    updateViewport({ zoom: newZoom });
  }

  function resetZoom() {
    updateViewport({ zoom: 1 });
  }

  function handleZoomInput(event: Event) {
    const target = event.target as HTMLInputElement;
    let value = parseInt(target.value, 10);
    if (isNaN(value)) return;
    value = Math.max(MIN_ZOOM * 100, Math.min(value, MAX_ZOOM * 100));
    updateViewport({ zoom: value / 100 });
  }
</script>

<div class="sidebar-container" class:collapsed={sidebarCollapsed}>
  <button class="sidebar-toggle" on:click={toggleSidebar} title={sidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}>
    {sidebarCollapsed ? '◀' : '▶'}
  </button>

  <div class="sidebar" class:collapsed={sidebarCollapsed}>
  {#if hasSelection}
    <!-- PROPERTIES SECTION -->
    <div class="sidebar-section">
      <button class="section-header" on:click={() => toggleSection('properties')}>
        <span class="section-chevron" class:collapsed={collapsedSections['properties']}>▾</span>
        <h3 class="section-title">Properties</h3>
      </button>

      {#if !collapsedSections['properties']}
      <div class="property-group reset-group">
        <button class="reset-button" on:click={resetToDefaults} title="Reset styling to defaults">
          Reset to Defaults
        </button>
      </div>
      {#if isSingleSelection}
        <!-- Position & Size (single selection only) -->
        <div class="property-group">
          <span class="group-label">Position</span>
          <div class="input-row">
            <div class="input-field">
              <span class="input-label">X</span>
              <input
                type="number"
                value={commonProps.x || 0}
                on:input={(e) => handleNumberInput('x', e)}
                class="number-input"
              />
            </div>
            <div class="input-field">
              <span class="input-label">Y</span>
              <input
                type="number"
                value={commonProps.y || 0}
                on:input={(e) => handleNumberInput('y', e)}
                class="number-input"
              />
            </div>
          </div>
        </div>

        {#if commonProps.width !== undefined && commonProps.height !== undefined}
          <div class="property-group">
            <span class="group-label">Size</span>
            <div class="size-row">
              <div class="input-row size-inputs">
                <div class="input-field">
                  <span class="input-label">W</span>
                  <input
                    type="number"
                    value={commonProps.width}
                    on:input={(e) => handleNumberInput('width', e)}
                    class="number-input"
                    min="1"
                  />
                </div>
                <div class="input-field">
                  <span class="input-label">H</span>
                  <input
                    type="number"
                    value={commonProps.height}
                    on:input={(e) => handleNumberInput('height', e)}
                    class="number-input"
                    min="1"
                  />
                </div>
              </div>
              <button
                class="aspect-lock-btn"
                class:locked={shapes[0]?.aspectRatioLocked}
                title={shapes[0]?.aspectRatioLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                on:click={() => updateProperty('aspectRatioLocked', !shapes[0]?.aspectRatioLocked)}
              >
                {#if shapes[0]?.aspectRatioLocked}
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <path d="M3 7V5a5 5 0 0 1 10 0v2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                    <rect x="2" y="7" width="12" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
                    <circle cx="8" cy="11" r="1" fill="currentColor"/>
                  </svg>
                {:else}
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <path d="M11 7V5a3 3 0 0 0-6 0" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                    <rect x="2" y="7" width="12" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
                  </svg>
                {/if}
              </button>
            </div>
          </div>
        {/if}
      {/if}

      <!-- Style Properties -->
      <div class="property-group">
        <ColorPicker
          label="Stroke"
          value={commonProps.strokeColor || '#000000'}
          disabled={commonProps.strokeColor === undefined}
          onColorChange={(color) => updateProperty('strokeColor', color)}
        />
      </div>

      <div class="property-group">
        <ColorPicker
          label="Fill"
          value={commonProps.fillColor || '#ffffff'}
          disabled={commonProps.fillColor === undefined}
          allowTransparent={true}
          onColorChange={(color) => updateProperty('fillColor', color)}
        />
      </div>

      <!-- Fill Style -->
      <div class="property-group">
        <span class="group-label">Fill Style</span>
        <div class="fill-style-row">
          {#each [
            { value: 'hachure', label: 'Hachure' },
            { value: 'solid', label: 'Solid' },
            { value: 'zigzag', label: 'Zigzag' },
            { value: 'cross-hatch', label: 'Cross' },
            { value: 'dots', label: 'Dots' },
          ] as style}
            <button
              class="text-align-btn"
              class:active={commonProps.fillStyle === style.value || (!commonProps.fillStyle && style.value === 'hachure')}
              on:click={() => updateProperty('fillStyle', style.value)}
              title={style.label}
            >
              {#if style.value === 'hachure'}
                <svg width="24" height="18" viewBox="0 0 24 18">
                  <line x1="4" y1="16" x2="16" y2="2" stroke="currentColor" stroke-width="1.5"/>
                  <line x1="8" y1="16" x2="20" y2="2" stroke="currentColor" stroke-width="1.5"/>
                  <line x1="0" y1="16" x2="12" y2="2" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              {:else if style.value === 'solid'}
                <svg width="24" height="18" viewBox="0 0 24 18">
                  <rect x="3" y="3" width="18" height="12" rx="2" fill="currentColor"/>
                </svg>
              {:else if style.value === 'zigzag'}
                <svg width="24" height="18" viewBox="0 0 24 18">
                  <polyline points="2,14 6,4 10,14 14,4 18,14 22,4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                </svg>
              {:else if style.value === 'cross-hatch'}
                <svg width="24" height="18" viewBox="0 0 24 18">
                  <line x1="4" y1="16" x2="16" y2="2" stroke="currentColor" stroke-width="1.5"/>
                  <line x1="8" y1="16" x2="20" y2="2" stroke="currentColor" stroke-width="1.5"/>
                  <line x1="8" y1="2" x2="20" y2="16" stroke="currentColor" stroke-width="1.5"/>
                  <line x1="4" y1="2" x2="16" y2="16" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              {:else if style.value === 'dots'}
                <svg width="24" height="18" viewBox="0 0 24 18">
                  <circle cx="6" cy="5" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                  <circle cx="18" cy="5" r="1.5" fill="currentColor"/>
                  <circle cx="6" cy="10" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="10" r="1.5" fill="currentColor"/>
                  <circle cx="18" cy="10" r="1.5" fill="currentColor"/>
                  <circle cx="6" cy="15" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="15" r="1.5" fill="currentColor"/>
                  <circle cx="18" cy="15" r="1.5" fill="currentColor"/>
                </svg>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <div class="property-group">
        <StrokeWidthSlider
          value={commonProps.strokeWidth || 2}
          disabled={commonProps.strokeWidth === undefined}
          onValueChange={(value) => updateProperty('strokeWidth', value)}
        />
      </div>

      <div class="property-group">
        <StrokeStyleButtons
          value={commonProps.strokeStyle || 'solid'}
          disabled={commonProps.strokeStyle === undefined}
          onStyleChange={(style) => updateProperty('strokeStyle', style)}
        />
      </div>

      <div class="property-group">
        <OpacitySlider
          value={commonProps.opacity ?? 1}
          disabled={commonProps.opacity === undefined}
          onValueChange={(value) => updateProperty('opacity', value)}
        />
      </div>

      <div class="property-group">
        <RoughnessSlider
          value={commonProps.roughness ?? 1}
          disabled={commonProps.roughness === undefined}
          onValueChange={(value) => updateProperty('roughness', value)}
        />
      </div>

      {#if isLineOrArrow}
        <div class="property-group">
          <RoutingModeButtons
            value={commonProps.routingMode || 'direct'}
            onModeChange={(mode) => handleRoutingModeChange(mode)}
          />
        </div>

        <div class="property-group">
          <EndpointSelector
            startEndpoint={commonProps.startEndpoint || { shape: 'none', size: 1 }}
            endEndpoint={commonProps.endEndpoint || { shape: 'none', size: 1 }}
            onStartChange={(config) => {
              shapes.forEach(shape => {
                if (shape.type === 'line' || shape.type === 'arrow') {
                  updateShape(shape.id, {
                    startEndpoint: config,
                    arrowheadStart: config.shape !== 'none',
                  });
                }
              });
            }}
            onEndChange={(config) => {
              shapes.forEach(shape => {
                if (shape.type === 'line' || shape.type === 'arrow') {
                  updateShape(shape.id, {
                    endEndpoint: config,
                    arrowheadEnd: config.shape !== 'none',
                  });
                }
              });
            }}
          />
        </div>
      {/if}

      {/if}
    </div>

    <!-- STICKY NOTE COLOR SECTION -->
    {#if isStickyNote}
      <div class="sidebar-section">
        <button class="section-header" on:click={() => toggleSection('stickyColor')}>
          <span class="section-chevron" class:collapsed={collapsedSections['stickyColor']}>▾</span>
          <h3 class="section-title">Sticky Note Color</h3>
        </button>
        {#if !collapsedSections['stickyColor']}
        <div class="sticky-color-swatches">
          {#each stickyColorEntries as [name, color]}
            <button
              class="sticky-color-swatch"
              class:active={currentStickyColor === color}
              style="background-color: {color};"
              title="{name.charAt(0).toUpperCase() + name.slice(1)}"
              on:click={() => handleStickyColorChange(color)}
            />
          {/each}
        </div>
        {/if}
      </div>
    {/if}

    <!-- ARRANGE SECTION (only if 2+ shapes selected) -->
    {#if isMultiSelection}
      <div class="sidebar-section">
        <button class="section-header" on:click={() => toggleSection('arrange')}>
          <span class="section-chevron" class:collapsed={collapsedSections['arrange']}>▾</span>
          <h3 class="section-title">Arrange</h3>
        </button>

        {#if !collapsedSections['arrange']}
        <div class="property-group">
          <AlignmentButtons
            {shapes}
            onAlign={(updates) => updateShapes(updates)}
          />
        </div>

        <div class="property-group">
          <ZOrderButtons {shapes} />
        </div>
        {/if}
      </div>
    {:else}
      <!-- Z-ORDER for single selection -->
      <div class="sidebar-section">
        <button class="section-header" on:click={() => toggleSection('arrange')}>
          <span class="section-chevron" class:collapsed={collapsedSections['arrange']}>▾</span>
          <h3 class="section-title">Arrange</h3>
        </button>
        {#if !collapsedSections['arrange']}
        <div class="property-group">
          <ZOrderButtons {shapes} />
        </div>
        {/if}
      </div>
    {/if}

    <!-- TEXT SECTION (only if shape has text or is text/sticky shape) -->
    {#if isSingleSelection && (shapes[0].text !== undefined || shapes[0].type === 'text' || shapes[0].type === 'sticky')}
      <div class="sidebar-section">
        <button class="section-header" on:click={() => toggleSection('text')}>
          <span class="section-chevron" class:collapsed={collapsedSections['text']}>▾</span>
          <h3 class="section-title">Text</h3>
        </button>

        {#if !collapsedSections['text']}
        <!-- Text Content -->
        <div class="property-group">
          <span class="group-label">Content</span>
          <textarea
            value={commonProps.text || ''}
            on:input={(e) => updateProperty('text', e.currentTarget.value)}
            placeholder="Enter text..."
            class="text-input"
            rows="3"
          />
        </div>

        <!-- Font Properties (for all text) -->
        <div class="property-group">
          <span class="group-label">Font Size</span>
          <input
            type="number"
            value={commonProps.fontSize || 14}
            on:input={(e) => handleNumberInput('fontSize', e)}
            class="number-input text-number-input"
            min="8"
            max="200"
          />
        </div>

        <div class="property-group">
          <span class="group-label">Font Family</span>
          <select
            value={commonProps.fontFamily || 'sans-serif'}
            on:change={(e) => updateProperty('fontFamily', e.currentTarget.value)}
            class="select-input"
          >
            <option value="Arial, sans-serif">Arial</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Courier New', monospace">Courier</option>
            <option value="'Comic Sans MS', cursive">Comic Sans</option>
            <option value="Verdana, sans-serif">Verdana</option>
          </select>
        </div>

        <!-- Text Alignment -->
        <div class="property-group">
          <div class="text-align-group">
            <span class="group-label">Horizontal Align</span>
            <div class="text-align-row">
              <button
                class="text-align-btn"
                class:active={(commonProps.textAlign || 'center') === 'left'}
                on:click={() => updateProperty('textAlign', 'left')}
                title="Align Left"
              >
                <svg width="18" height="14" viewBox="0 0 18 14">
                  <line x1="1" y1="2" x2="15" y2="2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <line x1="1" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <line x1="1" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
              <button
                class="text-align-btn"
                class:active={(commonProps.textAlign || 'center') === 'center'}
                on:click={() => updateProperty('textAlign', 'center')}
                title="Align Center"
              >
                <svg width="18" height="14" viewBox="0 0 18 14">
                  <line x1="2" y1="2" x2="16" y2="2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <line x1="4" y1="7" x2="14" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <line x1="3" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
              <button
                class="text-align-btn"
                class:active={(commonProps.textAlign || 'center') === 'right'}
                on:click={() => updateProperty('textAlign', 'right')}
                title="Align Right"
              >
                <svg width="18" height="14" viewBox="0 0 18 14">
                  <line x1="3" y1="2" x2="17" y2="2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <line x1="8" y1="7" x2="17" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <line x1="5" y1="12" x2="17" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="property-group">
          <div class="text-align-group">
            <span class="group-label">Vertical Align</span>
            <div class="text-align-row">
              <button
                class="text-align-btn"
                class:active={(commonProps.verticalAlign || 'middle') === 'top'}
                on:click={() => updateProperty('verticalAlign', 'top')}
                title="Align Top"
              >
                <svg width="18" height="16" viewBox="0 0 18 16">
                  <line x1="1" y1="1" x2="17" y2="1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <line x1="4" y1="5" x2="14" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
                  <line x1="5" y1="9" x2="13" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
                </svg>
              </button>
              <button
                class="text-align-btn"
                class:active={(commonProps.verticalAlign || 'middle') === 'middle'}
                on:click={() => updateProperty('verticalAlign', 'middle')}
                title="Align Middle"
              >
                <svg width="18" height="16" viewBox="0 0 18 16">
                  <line x1="4" y1="3" x2="14" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
                  <line x1="1" y1="8" x2="17" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <line x1="4" y1="13" x2="14" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
                </svg>
              </button>
              <button
                class="text-align-btn"
                class:active={(commonProps.verticalAlign || 'middle') === 'bottom'}
                on:click={() => updateProperty('verticalAlign', 'bottom')}
                title="Align Bottom"
              >
                <svg width="18" height="16" viewBox="0 0 18 16">
                  <line x1="5" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
                  <line x1="4" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
                  <line x1="1" y1="15" x2="17" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {#if isGeometricShape}
        <div class="property-group">
          <div class="text-align-group">
            <span class="group-label">Label Position</span>
            <div class="text-align-row">
              <button
                class="text-align-btn"
                class:active={(commonProps.labelPosition || 'inside') === 'inside'}
                on:click={() => updateProperty('labelPosition', 'inside')}
                title="Inside"
              >
                <svg width="18" height="16" viewBox="0 0 18 16">
                  <rect x="1" y="1" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
                  <line x1="5" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
              <button
                class="text-align-btn"
                class:active={(commonProps.labelPosition || 'inside') === 'outside-top'}
                on:click={() => updateProperty('labelPosition', 'outside-top')}
                title="Above"
              >
                <svg width="18" height="16" viewBox="0 0 18 16">
                  <line x1="5" y1="2" x2="13" y2="2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <rect x="1" y="5" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
                </svg>
              </button>
              <button
                class="text-align-btn"
                class:active={(commonProps.labelPosition || 'inside') === 'outside-bottom'}
                on:click={() => updateProperty('labelPosition', 'outside-bottom')}
                title="Below"
              >
                <svg width="18" height="16" viewBox="0 0 18 16">
                  <rect x="1" y="1" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
                  <line x1="5" y1="14" x2="13" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
              <button
                class="text-align-btn"
                class:active={(commonProps.labelPosition || 'inside') === 'outside-left'}
                on:click={() => updateProperty('labelPosition', 'outside-left')}
                title="Left"
              >
                <svg width="18" height="16" viewBox="0 0 18 16">
                  <line x1="1" y1="5" x2="1" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <rect x="4" y="1" width="13" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
                </svg>
              </button>
              <button
                class="text-align-btn"
                class:active={(commonProps.labelPosition || 'inside') === 'outside-right'}
                on:click={() => updateProperty('labelPosition', 'outside-right')}
                title="Right"
              >
                <svg width="18" height="16" viewBox="0 0 18 16">
                  <rect x="1" y="1" width="13" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
                  <line x1="17" y1="5" x2="17" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        {/if}
        {/if}
      </div>
    {/if}

    <!-- COLORS SECTION -->
    <div class="sidebar-section">
      <button class="section-header" on:click={() => toggleSection('colors')}>
        <span class="section-chevron" class:collapsed={collapsedSections['colors']}>▾</span>
        <h3 class="section-title">Colors</h3>
      </button>
      {#if !collapsedSections['colors']}
      <RecentColorsPalette
        onStrokeColor={(color) => updateProperty('strokeColor', color)}
        onFillColor={(color) => updateProperty('fillColor', color)}
        currentStrokeColor={commonProps.strokeColor || '#000000'}
        currentFillColor={commonProps.fillColor || 'transparent'}
      />
      {/if}
    </div>
  {:else}
    <div class="sidebar-section">
      <p class="hint-text">Select a shape to edit its properties.</p>
    </div>
  {/if}

  <!-- VIEW SECTION (always visible) -->
  <div class="sidebar-section">
    <button class="section-header" on:click={() => toggleSection('view')}>
      <span class="section-chevron" class:collapsed={collapsedSections['view']}>▾</span>
      <h3 class="section-title">View</h3>
    </button>
    {#if !collapsedSections['view']}

    <div class="zoom-controls">
      <span class="group-label">Zoom</span>
      <div class="zoom-buttons">
        <button
          class="zoom-button"
          on:click={zoomOut}
          disabled={viewport.zoom <= MIN_ZOOM}
          title="Zoom Out"
        >
          &minus;
        </button>

        <button
          class="zoom-reset"
          on:click={resetZoom}
          title="Reset Zoom (100%)"
        >
          <input
            type="number"
            class="zoom-input"
            value={zoomPercentage}
            on:blur={handleZoomInput}
            on:keydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            min={MIN_ZOOM * 100}
            max={MAX_ZOOM * 100}
          />
          <span class="zoom-percent">%</span>
        </button>

        <button
          class="zoom-button"
          on:click={zoomIn}
          disabled={viewport.zoom >= MAX_ZOOM}
          title="Zoom In"
        >
          +
        </button>
      </div>
    </div>

    <div class="grid-toggle">
      <label class="grid-toggle-label">
        <input
          type="checkbox"
          checked={showGrid}
          on:change={toggleGrid}
          class="grid-checkbox"
        />
        <span class="grid-toggle-text">Show Grid</span>
        <span class="grid-shortcut">{navigator.platform?.toUpperCase().indexOf('MAC') >= 0 ? 'Cmd' : 'Ctrl'}+'</span>
      </label>
    </div>
    {/if}
  </div>
  </div>
</div>

<style>
  .sidebar-container {
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    width: 280px;
    z-index: 5;
    transition: transform 0.3s ease;
    pointer-events: none; /* Let clicks pass through to canvas when container overlays */
  }

  .sidebar-container > :global(*) {
    pointer-events: auto; /* Re-enable for actual sidebar content */
  }

  .sidebar-container.collapsed {
    transform: translateX(280px);
  }

  .sidebar {
    width: 280px;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    background: #fafafa;
    border-left: 1px solid #ddd;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    box-sizing: border-box;
  }

  .sidebar.collapsed {
    opacity: 0;
    pointer-events: none;
  }

  .sidebar-toggle {
    position: absolute;
    left: -40px;
    top: 20px;
    width: 32px;
    height: 32px;
    border-radius: 4px 0 0 4px;
    border: 1px solid #ddd;
    border-right: none;
    background: #fafafa;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: #666;
    transition: all 0.2s ease;
    z-index: 10;
    pointer-events: auto; /* Always clickable */
  }

  .sidebar-toggle:hover {
    background: #f0f0f0;
    color: #333;
  }

  .sidebar-toggle:active {
    background: #e0e0e0;
  }

  .sidebar-section {
    padding-bottom: 16px;
  }

  .sidebar-section:last-child {
    padding-bottom: 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    margin: 0 0 12px 0;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #f0f0f0;
    cursor: pointer;
    user-select: none;
    transition: all 0.15s ease;
  }

  .section-header:hover {
    background: #e8e8e8;
    border-color: #ccc;
  }

  .section-header:hover .section-title {
    color: #222;
  }

  .section-header:hover .section-chevron {
    color: #333;
  }

  .section-header:active {
    background: #e0e0e0;
  }

  .section-chevron {
    font-size: 12px;
    color: #888;
    transition: transform 0.2s ease;
    flex-shrink: 0;
    line-height: 1;
  }

  .section-chevron.collapsed {
    transform: rotate(-90deg);
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: #555;
    margin: 0;
    letter-spacing: 0.5px;
  }

  .property-group {
    margin-bottom: 16px;
  }

  .property-group:last-child {
    margin-bottom: 0;
  }

  .group-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #666;
    margin-bottom: 8px;
  }

  .input-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .input-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-label {
    font-size: 11px;
    font-weight: 500;
    color: #999;
    text-transform: uppercase;
  }

  .number-input {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    background: white;
    transition: all 0.2s ease;
  }

  .number-input:hover {
    border-color: #999;
  }

  .number-input:focus {
    outline: none;
    border-color: #2196f3;
    box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
  }

  .hint-text {
    font-size: 12px;
    color: #888;
    line-height: 1.5;
    margin: 0 0 16px 0;
  }

  .zoom-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .zoom-buttons {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 6px;
  }

  .zoom-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background-color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #333;
    font-size: 18px;
    font-weight: 600;
    line-height: 1;
  }

  .zoom-button:hover:not(:disabled) {
    background-color: #f0f0f0;
    border-color: #999;
  }

  .zoom-button:active:not(:disabled) {
    background-color: #e0e0e0;
  }

  .zoom-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .zoom-reset {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 0 12px;
    height: 36px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background-color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 13px;
    font-weight: 500;
    color: #333;
  }

  .zoom-reset:hover {
    background-color: #f0f0f0;
    border-color: #999;
  }

  .zoom-input {
    width: 50px;
    border: none;
    background: transparent;
    text-align: right;
    font-size: 13px;
    font-weight: 500;
    color: #333;
    padding: 0;
    margin: 0;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  }

  .zoom-input:focus {
    outline: none;
  }

  .zoom-input::-webkit-inner-spin-button,
  .zoom-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .zoom-input[type=number] {
    -moz-appearance: textfield;
  }

  .zoom-percent {
    color: #666;
  }

  .select-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: white;
    color: #222;
    cursor: pointer;
    transition: all 0.2s ease;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23666' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    padding-right: 28px;
  }

  .select-input:hover {
    border-color: #999;
  }

  .select-input:focus {
    outline: none;
    border-color: #2196f3;
    box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
  }

  .text-input {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    font-family: 'SF Mono', Monaco, 'Courier New', monospace;
    resize: vertical;
    min-height: 60px;
    max-height: 200px;
  }

  .text-input:hover {
    border-color: #2196f3;
  }

  .text-input:focus {
    outline: none;
    border-color: #2196f3;
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
  }

  .text-input::placeholder {
    color: #999;
  }

  /* Custom scrollbar */
  .sidebar::-webkit-scrollbar {
    width: 8px;
  }

  .sidebar::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 4px;
  }

  .sidebar::-webkit-scrollbar-thumb:hover {
    background: #ccc;
  }

  .grid-toggle {
    margin-top: 12px;
  }

  .grid-toggle-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: #333;
    user-select: none;
  }

  .grid-checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #2196f3;
  }

  .grid-toggle-text {
    flex: 1;
  }

  .grid-shortcut {
    font-size: 11px;
    color: #999;
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  }

  .sticky-color-swatches {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .sticky-color-swatch {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 2px solid #ddd;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
  }

  .sticky-color-swatch:hover {
    border-color: #999;
    transform: scale(1.1);
  }

  .sticky-color-swatch.active {
    border-color: #1a73e8;
    box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.3);
  }

  /* Text section font size input - enhanced readability */
  .text-number-input {
    font-size: 14px;
    padding: 8px 10px;
    color: #222;
  }

  /* Text alignment button group */
  .text-align-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .text-align-row {
    display: flex;
    gap: 4px;
  }

  .fill-style-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .text-align-btn {
    flex: 1;
    padding: 6px 4px;
    background-color: #fff;
    border: 1px solid #e2e2e2;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .text-align-btn:hover {
    background-color: #f5f5f5;
    border-color: #ccc;
    color: #333;
  }

  .text-align-btn:active {
    background-color: #ebebeb;
  }

  .text-align-btn.active {
    background-color: #e8f0fe;
    color: #1a73e8;
    border-color: #1a73e8;
  }

  .text-align-btn svg {
    display: block;
  }

  .reset-group {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid #eee;
  }

  .reset-button {
    width: 100%;
    padding: 6px 12px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    color: #666;
    transition: all 0.15s ease;
  }

  .reset-button:hover {
    background-color: #f5f5f5;
    border-color: #ccc;
    color: #333;
  }

  .reset-button:active {
    background-color: #ebebeb;
  }

  .size-row {
    display: flex;
    align-items: flex-end;
    gap: 6px;
  }

  .size-inputs {
    flex: 1;
  }

  .aspect-lock-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fff;
    color: #999;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
    flex-shrink: 0;
    margin-bottom: 1px;
  }

  .aspect-lock-btn:hover {
    background: #f5f5f5;
    border-color: #ccc;
    color: #666;
  }

  .aspect-lock-btn.locked {
    background: #e8f0fe;
    border-color: #1a73e8;
    color: #1a73e8;
  }
</style>

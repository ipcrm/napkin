/**
 * Shape library system - predefined shape templates
 */

import type { Shape } from '../types';

/**
 * Shape template in a library
 */
export interface ShapeTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  thumbnail?: string; // Data URL for preview
  createShape: (x: number, y: number) => Shape;
}

/**
 * Shape library
 */
export interface ShapeLibrary {
  id: string;
  name: string;
  description?: string;
  templates: ShapeTemplate[];
}

/**
 * Built-in shape library: Basic shapes
 */
export const BASIC_SHAPES_LIBRARY: ShapeLibrary = {
  id: 'basic',
  name: 'Basic Shapes',
  description: 'Common geometric shapes',
  templates: [
    {
      id: 'rectangle',
      name: 'Rectangle',
      category: 'basic',
      createShape: (x, y) => ({
        id: crypto.randomUUID(),
        type: 'rectangle',
        x,
        y,
        width: 100,
        height: 80,
        strokeColor: '#000000',
        strokeWidth: 2,
        fillColor: '#ffffff',
        opacity: 1
      })
    },
    {
      id: 'square',
      name: 'Square',
      category: 'basic',
      createShape: (x, y) => ({
        id: crypto.randomUUID(),
        type: 'rectangle',
        x,
        y,
        width: 100,
        height: 100,
        strokeColor: '#000000',
        strokeWidth: 2,
        fillColor: '#ffffff',
        opacity: 1
      })
    },
    {
      id: 'circle',
      name: 'Circle',
      category: 'basic',
      createShape: (x, y) => ({
        id: crypto.randomUUID(),
        type: 'ellipse',
        x,
        y,
        width: 100,
        height: 100,
        strokeColor: '#000000',
        strokeWidth: 2,
        fillColor: '#ffffff',
        opacity: 1
      })
    },
    {
      id: 'ellipse',
      name: 'Ellipse',
      category: 'basic',
      createShape: (x, y) => ({
        id: crypto.randomUUID(),
        type: 'ellipse',
        x,
        y,
        width: 120,
        height: 80,
        strokeColor: '#000000',
        strokeWidth: 2,
        fillColor: '#ffffff',
        opacity: 1
      })
    }
  ]
};

/**
 * Built-in shape library: Flowchart shapes
 */
export const FLOWCHART_LIBRARY: ShapeLibrary = {
  id: 'flowchart',
  name: 'Flowchart',
  description: 'Flowchart and diagram shapes',
  templates: [
    {
      id: 'process',
      name: 'Process',
      category: 'flowchart',
      createShape: (x, y) => ({
        id: crypto.randomUUID(),
        type: 'rectangle',
        x,
        y,
        width: 120,
        height: 60,
        strokeColor: '#2196F3',
        strokeWidth: 2,
        fillColor: '#E3F2FD',
        opacity: 1
      })
    },
    {
      id: 'decision',
      name: 'Decision',
      category: 'flowchart',
      description: 'Diamond shape for decisions',
      createShape: (x, y) => ({
        id: crypto.randomUUID(),
        type: 'rectangle',
        x: x + 30,
        y,
        width: 60,
        height: 60,
        strokeColor: '#FF9800',
        strokeWidth: 2,
        fillColor: '#FFF3E0',
        opacity: 1
      })
    },
    {
      id: 'terminator',
      name: 'Terminator',
      category: 'flowchart',
      description: 'Rounded rectangle for start/end',
      createShape: (x, y) => ({
        id: crypto.randomUUID(),
        type: 'ellipse',
        x,
        y,
        width: 120,
        height: 50,
        strokeColor: '#4CAF50',
        strokeWidth: 2,
        fillColor: '#E8F5E9',
        opacity: 1
      })
    },
    {
      id: 'data',
      name: 'Data',
      category: 'flowchart',
      description: 'Parallelogram for input/output',
      createShape: (x, y) => ({
        id: crypto.randomUUID(),
        type: 'rectangle',
        x,
        y,
        width: 120,
        height: 60,
        strokeColor: '#9C27B0',
        strokeWidth: 2,
        fillColor: '#F3E5F5',
        opacity: 1
      })
    }
  ]
};

/**
 * Built-in shape library: UI/UX shapes
 */
export const UI_LIBRARY: ShapeLibrary = {
  id: 'ui',
  name: 'UI Elements',
  description: 'Common UI components',
  templates: [
    {
      id: 'button',
      name: 'Button',
      category: 'ui',
      createShape: (x, y) => ({
        id: crypto.randomUUID(),
        type: 'rectangle',
        x,
        y,
        width: 100,
        height: 36,
        strokeColor: '#2196F3',
        strokeWidth: 2,
        fillColor: '#2196F3',
        opacity: 1
      })
    },
    {
      id: 'input',
      name: 'Input Field',
      category: 'ui',
      createShape: (x, y) => ({
        id: crypto.randomUUID(),
        type: 'rectangle',
        x,
        y,
        width: 200,
        height: 40,
        strokeColor: '#9E9E9E',
        strokeWidth: 1,
        fillColor: '#ffffff',
        opacity: 1
      })
    },
    {
      id: 'checkbox',
      name: 'Checkbox',
      category: 'ui',
      createShape: (x, y) => ({
        id: crypto.randomUUID(),
        type: 'rectangle',
        x,
        y,
        width: 20,
        height: 20,
        strokeColor: '#2196F3',
        strokeWidth: 2,
        fillColor: '#ffffff',
        opacity: 1
      })
    },
    {
      id: 'radio',
      name: 'Radio Button',
      category: 'ui',
      createShape: (x, y) => ({
        id: crypto.randomUUID(),
        type: 'ellipse',
        x,
        y,
        width: 20,
        height: 20,
        strokeColor: '#2196F3',
        strokeWidth: 2,
        fillColor: '#ffffff',
        opacity: 1
      })
    }
  ]
};

/**
 * Get all built-in libraries
 */
export function getBuiltInLibraries(): ShapeLibrary[] {
  return [BASIC_SHAPES_LIBRARY, FLOWCHART_LIBRARY, UI_LIBRARY];
}

/**
 * Get a library by ID
 */
export function getLibraryById(id: string): ShapeLibrary | null {
  const libraries = getBuiltInLibraries();
  return libraries.find(lib => lib.id === id) || null;
}

/**
 * Get a template by ID from any library
 */
export function getTemplateById(templateId: string): ShapeTemplate | null {
  const libraries = getBuiltInLibraries();
  for (const library of libraries) {
    const template = library.templates.find(t => t.id === templateId);
    if (template) return template;
  }
  return null;
}

/**
 * Search templates across all libraries
 */
export function searchTemplates(query: string): ShapeTemplate[] {
  const libraries = getBuiltInLibraries();
  const results: ShapeTemplate[] = [];
  const lowerQuery = query.toLowerCase();

  for (const library of libraries) {
    for (const template of library.templates) {
      if (
        template.name.toLowerCase().includes(lowerQuery) ||
        template.category.toLowerCase().includes(lowerQuery) ||
        template.description?.toLowerCase().includes(lowerQuery)
      ) {
        results.push(template);
      }
    }
  }

  return results;
}

/**
 * Custom library manager for user-created templates
 */
export class CustomLibraryManager {
  private customLibraries: Map<string, ShapeLibrary> = new Map();
  private storageKey = 'napkin_custom_libraries';

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Add a custom library
   */
  addLibrary(library: ShapeLibrary): void {
    this.customLibraries.set(library.id, library);
    this.saveToStorage();
  }

  /**
   * Remove a custom library
   */
  removeLibrary(id: string): void {
    this.customLibraries.delete(id);
    this.saveToStorage();
  }

  /**
   * Get a custom library
   */
  getLibrary(id: string): ShapeLibrary | null {
    return this.customLibraries.get(id) || null;
  }

  /**
   * Get all custom libraries
   */
  getAllLibraries(): ShapeLibrary[] {
    return Array.from(this.customLibraries.values());
  }

  /**
   * Add a template to a custom library
   */
  addTemplate(libraryId: string, template: ShapeTemplate): void {
    const library = this.customLibraries.get(libraryId);
    if (library) {
      library.templates.push(template);
      this.saveToStorage();
    }
  }

  /**
   * Remove a template from a custom library
   */
  removeTemplate(libraryId: string, templateId: string): void {
    const library = this.customLibraries.get(libraryId);
    if (library) {
      library.templates = library.templates.filter(t => t.id !== templateId);
      this.saveToStorage();
    }
  }

  /**
   * Save libraries to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.customLibraries.values());
      // Note: We can't serialize functions, so we need to handle that
      const serializable = data.map(lib => ({
        ...lib,
        templates: lib.templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          thumbnail: t.thumbnail
          // createShape function will need to be reconstructed on load
        }))
      }));
      localStorage.setItem(this.storageKey, JSON.stringify(serializable));
    } catch (error) {
      console.error('Failed to save custom libraries:', error);
    }
  }

  /**
   * Load libraries from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const libraries = JSON.parse(data);
        // Note: Would need to reconstruct createShape functions
        // For now, this is a placeholder
      }
    } catch (error) {
      console.error('Failed to load custom libraries:', error);
    }
  }
}

/**
 * Create a template from an existing shape
 */
export function createTemplateFromShape(
  shape: Shape,
  name: string,
  category: string = 'custom'
): ShapeTemplate {
  return {
    id: crypto.randomUUID(),
    name,
    category,
    createShape: (x, y) => ({
      ...shape,
      id: crypto.randomUUID(),
      x,
      y
    })
  };
}

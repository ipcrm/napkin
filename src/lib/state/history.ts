/**
 * Command pattern implementation for undo/redo functionality
 */

import type { Shape } from '../types';
import {
  addShape,
  removeShape,
  updateShape,
  canvasStore,
} from './canvasStore';

/**
 * Base command interface
 */
export interface Command {
  execute(): void;
  undo(): void;
}

/**
 * Command to add a shape
 */
export class AddShapeCommand implements Command {
  constructor(private shape: Shape) {}

  execute(): void {
    addShape(this.shape);
  }

  undo(): void {
    removeShape(this.shape.id);
  }
}

/**
 * Command to delete a shape
 */
export class DeleteShapeCommand implements Command {
  private shape: Shape;

  constructor(shapeId: string) {
    // Capture the shape data before deletion
    let state: any;
    canvasStore.subscribe((s) => (state = s))();
    this.shape = state.shapes.get(shapeId);
    if (!this.shape) {
      throw new Error(`Shape ${shapeId} not found`);
    }
  }

  execute(): void {
    removeShape(this.shape.id);
  }

  undo(): void {
    addShape(this.shape);
  }
}

/**
 * Command to modify a shape
 */
export class ModifyShapeCommand implements Command {
  private oldShape: Shape;
  private newShape: Shape;

  constructor(shapeId: string, private updates: Partial<Shape>) {
    // Capture the current shape state
    let state: any;
    canvasStore.subscribe((s) => (state = s))();
    const currentShape = state.shapes.get(shapeId);
    if (!currentShape) {
      throw new Error(`Shape ${shapeId} not found`);
    }
    this.oldShape = { ...currentShape };
    this.newShape = { ...currentShape, ...updates, id: shapeId };
  }

  execute(): void {
    updateShape(this.oldShape.id, this.updates);
  }

  undo(): void {
    // Restore all properties from the old shape
    const restoreUpdates: Partial<Shape> = { ...this.oldShape };
    delete restoreUpdates.id; // Don't update the id
    updateShape(this.oldShape.id, restoreUpdates);
  }
}

/**
 * Command to execute multiple commands as a batch
 */
export class BatchCommand implements Command {
  constructor(private commands: Command[]) {}

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}

/**
 * Command to delete multiple shapes
 */
export class DeleteShapesCommand implements Command {
  private shapes: Shape[] = [];

  constructor(shapeIds: string[]) {
    // Capture all shapes before deletion
    let state: any;
    canvasStore.subscribe((s) => (state = s))();
    for (const id of shapeIds) {
      const shape = state.shapes.get(id);
      if (shape) {
        this.shapes.push({ ...shape });
      }
    }
  }

  execute(): void {
    for (const shape of this.shapes) {
      removeShape(shape.id);
    }
  }

  undo(): void {
    for (const shape of this.shapes) {
      addShape(shape);
    }
  }
}

/**
 * History manager for undo/redo functionality
 */
export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxStackSize: number;

  constructor(maxStackSize: number = 100) {
    this.maxStackSize = maxStackSize;
  }

  /**
   * Execute a command and add it to the undo stack
   */
  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);

    // Limit stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }

    // Clear redo stack when new command is executed
    this.redoStack = [];
  }

  /**
   * Undo the last command
   */
  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) {
      return false;
    }

    command.undo();
    this.redoStack.push(command);

    // Limit redo stack size
    if (this.redoStack.length > this.maxStackSize) {
      this.redoStack.shift();
    }

    return true;
  }

  /**
   * Redo the last undone command
   */
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) {
      return false;
    }

    command.execute();
    this.undoStack.push(command);

    // Limit undo stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }

    return true;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Get the number of commands in the undo stack
   */
  getUndoCount(): number {
    return this.undoStack.length;
  }

  /**
   * Get the number of commands in the redo stack
   */
  getRedoCount(): number {
    return this.redoStack.length;
  }
}

/**
 * Command to group shapes
 */
export class GroupShapesCommand implements Command {
  private groupId: string | null = null;
  private shapeIds: string[];

  constructor(shapeIds: string[]) {
    this.shapeIds = [...shapeIds];
  }

  execute(): void {
    // Import dynamically to avoid circular dependency
    const { groupShapes } = require('./canvasStore');
    this.groupId = groupShapes(this.shapeIds);
  }

  undo(): void {
    if (!this.groupId) return;
    const { ungroupShapes } = require('./canvasStore');
    ungroupShapes(this.groupId);
  }
}

/**
 * Command to ungroup shapes
 */
export class UngroupShapesCommand implements Command {
  private groupId: string;
  private shapeIds: string[] = [];

  constructor(groupId: string) {
    this.groupId = groupId;
    // Capture shape IDs before ungrouping
    const { canvasStore } = require('./canvasStore');
    let state: any;
    canvasStore.subscribe((s: any) => (state = s))();
    const group = state.groups.get(groupId);
    if (group) {
      this.shapeIds = [...group.shapeIds];
    }
  }

  execute(): void {
    const { ungroupShapes } = require('./canvasStore');
    ungroupShapes(this.groupId);
  }

  undo(): void {
    const { groupShapes } = require('./canvasStore');
    this.groupId = groupShapes(this.shapeIds);
  }
}

// Create a singleton instance
export const historyManager = new HistoryManager(100);

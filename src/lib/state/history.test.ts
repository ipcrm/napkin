import { HistoryManager } from './history';
import type { Command } from './history';

function mockCommand(): Command & { executed: number; undone: number } {
  return {
    executed: 0,
    undone: 0,
    execute() { this.executed++; },
    undo() { this.undone++; },
  };
}

describe('HistoryManager', () => {
  let history: HistoryManager;

  beforeEach(() => {
    history = new HistoryManager(5);
  });

  it('starts with empty stacks', () => {
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.getUndoCount()).toBe(0);
    expect(history.getRedoCount()).toBe(0);
  });

  it('executes a command and adds it to undo stack', () => {
    const cmd = mockCommand();
    history.execute(cmd);
    expect(cmd.executed).toBe(1);
    expect(history.canUndo()).toBe(true);
    expect(history.getUndoCount()).toBe(1);
  });

  it('undo reverses the last command', () => {
    const cmd = mockCommand();
    history.execute(cmd);
    const result = history.undo();
    expect(result).toBe(true);
    expect(cmd.undone).toBe(1);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
  });

  it('redo re-executes the undone command', () => {
    const cmd = mockCommand();
    history.execute(cmd);
    history.undo();
    const result = history.redo();
    expect(result).toBe(true);
    expect(cmd.executed).toBe(2); // once from execute, once from redo
    expect(history.canRedo()).toBe(false);
    expect(history.canUndo()).toBe(true);
  });

  it('undo returns false when stack is empty', () => {
    expect(history.undo()).toBe(false);
  });

  it('redo returns false when stack is empty', () => {
    expect(history.redo()).toBe(false);
  });

  it('clears redo stack on new command', () => {
    const cmd1 = mockCommand();
    const cmd2 = mockCommand();
    history.execute(cmd1);
    history.undo();
    expect(history.canRedo()).toBe(true);
    history.execute(cmd2);
    expect(history.canRedo()).toBe(false);
  });

  it('respects max stack size', () => {
    for (let i = 0; i < 10; i++) {
      history.execute(mockCommand());
    }
    // maxStackSize is 5, oldest commands should be dropped
    expect(history.getUndoCount()).toBe(5);
  });

  it('clear empties both stacks', () => {
    history.execute(mockCommand());
    history.execute(mockCommand());
    history.undo();
    expect(history.getUndoCount()).toBe(1);
    expect(history.getRedoCount()).toBe(1);
    history.clear();
    expect(history.getUndoCount()).toBe(0);
    expect(history.getRedoCount()).toBe(0);
  });

  it('handles multiple undo/redo in sequence', () => {
    const cmds = [mockCommand(), mockCommand(), mockCommand()];
    cmds.forEach(c => history.execute(c));

    expect(history.getUndoCount()).toBe(3);

    history.undo();
    history.undo();
    expect(history.getUndoCount()).toBe(1);
    expect(history.getRedoCount()).toBe(2);

    history.redo();
    expect(history.getUndoCount()).toBe(2);
    expect(history.getRedoCount()).toBe(1);
  });
});

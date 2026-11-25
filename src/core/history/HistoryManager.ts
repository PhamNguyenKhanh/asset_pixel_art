import type { ICommand } from "@/core/contracts";

export interface HistoryOptions {
  maxEntries?: number;
  maxMemoryBytes?: number;
}

const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_MAX_MEMORY_BYTES = 64 * 1024 * 1024; // 64 MB

export class HistoryManager {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private currentBytes = 0;
  private readonly maxEntries: number;
  private readonly maxMemoryBytes: number;
  private listeners = new Set<() => void>();

  constructor(options: HistoryOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
    this.maxMemoryBytes = Math.max(1024, options.maxMemoryBytes ?? DEFAULT_MAX_MEMORY_BYTES);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  get memoryBytes(): number {
    return this.currentBytes;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Executes a command and pushes it onto the undo stack.
   */
  execute(command: ICommand): void {
    command.execute();
    this.pushExecuted(command);
  }

  /**
   * Pushes an already-applied command (e.g. an interactive brush stroke) onto the undo stack.
   */
  pushExecuted(command: ICommand): void {
    // Discard redo branch and adjust memory budget
    for (const redoCmd of this.redoStack) {
      this.currentBytes -= Math.max(0, redoCmd.byteSize);
    }
    this.redoStack = [];

    this.undoStack.push(command);
    this.currentBytes += Math.max(0, command.byteSize);
    this.enforceLimits();
    this.emit();
  }

  undo(): ICommand | null {
    const command = this.undoStack.pop();
    if (!command) return null;
    command.undo();
    this.redoStack.push(command);
    this.emit();
    return command;
  }

  redo(): ICommand | null {
    const command = this.redoStack.pop();
    if (!command) return null;
    command.execute();
    this.undoStack.push(command);
    this.emit();
    return command;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.currentBytes = 0;
    this.emit();
  }

  private enforceLimits(): void {
    while (
      this.undoStack.length > 1 &&
      (this.undoStack.length > this.maxEntries || this.currentBytes > this.maxMemoryBytes)
    ) {
      const oldest = this.undoStack.shift();
      if (oldest) {
        this.currentBytes -= Math.max(0, oldest.byteSize);
      }
    }
    if (this.currentBytes < 0) {
      this.currentBytes = 0;
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

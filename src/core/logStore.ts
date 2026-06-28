import { EventEmitter } from "node:events";
import type { LogEntry } from "../shared/types.js";

export class LogStore extends EventEmitter {
  private entries: LogEntry[] = [];
  private nextId = 1;

  constructor(private readonly limit = 500) {
    super();
  }

  add(source: LogEntry["source"], stream: LogEntry["stream"], message: string): LogEntry {
    const entry: LogEntry = {
      id: this.nextId++,
      timestamp: new Date().toISOString(),
      source,
      stream,
      message
    };

    this.entries.push(entry);
    if (this.entries.length > this.limit) {
      this.entries.shift();
    }

    this.emit("entry", entry);
    return entry;
  }

  all(): LogEntry[] {
    return [...this.entries];
  }
}


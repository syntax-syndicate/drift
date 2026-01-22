/**
 * EventBus - Decoupled event communication
 * 
 * Single responsibility: Enable pub/sub communication between components.
 */

import * as vscode from 'vscode';

/**
 * Event types for the extension
 */
export type ExtensionEventType =
  | 'connection:changed'
  | 'connection:error'
  | 'patterns:updated'
  | 'violations:updated'
  | 'scan:started'
  | 'scan:completed'
  | 'config:changed'
  | 'workspace:changed';

/**
 * Event payload types
 */
export interface ExtensionEvents {
  'connection:changed': { status: string; previousStatus: string };
  'connection:error': { error: Error; recoverable: boolean };
  'patterns:updated': { total: number; categories: string[] };
  'violations:updated': { total: number; file?: string };
  'scan:started': { files: number };
  'scan:completed': { duration: number; patterns: number; violations: number };
  'config:changed': { section: string; oldValue: unknown; newValue: unknown };
  'workspace:changed': { folders: string[] };
}

/**
 * Event listener type
 */
type EventListener<T> = (data: T) => void;

/**
 * Type-safe event bus for extension-wide communication
 */
export class EventBus implements vscode.Disposable {
  private readonly emitters = new Map<string, vscode.EventEmitter<unknown>>();
  private readonly disposables: vscode.Disposable[] = [];

  /**
   * Subscribe to an event
   */
  on<K extends ExtensionEventType>(
    event: K,
    listener: EventListener<ExtensionEvents[K]>
  ): vscode.Disposable {
    const emitter = this.getOrCreateEmitter(event);
    return emitter.event(listener as EventListener<unknown>);
  }

  /**
   * Subscribe to an event once
   */
  once<K extends ExtensionEventType>(
    event: K,
    listener: EventListener<ExtensionEvents[K]>
  ): vscode.Disposable {
    const disposable = this.on(event, (data) => {
      disposable.dispose();
      listener(data);
    });
    return disposable;
  }

  /**
   * Emit an event
   */
  emit<K extends ExtensionEventType>(event: K, data: ExtensionEvents[K]): void {
    const emitter = this.emitters.get(event);
    if (emitter) {
      emitter.fire(data);
    }
  }

  /**
   * Check if event has listeners
   */
  hasListeners(event: ExtensionEventType): boolean {
    return this.emitters.has(event);
  }

  /**
   * Dispose all emitters
   */
  dispose(): void {
    for (const emitter of this.emitters.values()) {
      emitter.dispose();
    }
    this.emitters.clear();
    
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }

  private getOrCreateEmitter(event: string): vscode.EventEmitter<unknown> {
    let emitter = this.emitters.get(event);
    if (!emitter) {
      emitter = new vscode.EventEmitter<unknown>();
      this.emitters.set(event, emitter);
      this.disposables.push(emitter);
    }
    return emitter;
  }
}

/**
 * Factory function for creating event bus
 */
export function createEventBus(): EventBus {
  return new EventBus();
}

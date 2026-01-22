/**
 * StateManager - Centralized reactive state management
 * 
 * Single responsibility: Manage extension state with subscriptions.
 */

import * as vscode from 'vscode';

import { createInitialState } from './initial-state.js';

import type {
  ExtensionState,
  StateUpdater,
  StateSelector,
  StateSubscriber,
} from '../types/index.js';

/**
 * Persistence key for state
 */
const PERSISTENCE_KEY = 'drift.state';

/**
 * State manager with selector-based subscriptions
 */
export class StateManager implements vscode.Disposable {
  private state: ExtensionState;
  private readonly listeners = new Set<(state: ExtensionState) => void>();
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.state = this.loadState();
  }

  /**
   * Get current state (readonly)
   */
  getState(): Readonly<ExtensionState> {
    return this.state;
  }

  /**
   * Update state with an updater function
   */
  update(updater: StateUpdater): void {
    // Create a shallow copy for the updater
    const draft = this.createDraft();
    updater(draft);
    
    // Apply changes
    this.state = draft;
    this.notifyListeners();
    this.persistState();
  }

  /**
   * Batch multiple updates
   */
  batch(updaters: StateUpdater[]): void {
    const draft = this.createDraft();
    for (const updater of updaters) {
      updater(draft);
    }
    this.state = draft;
    this.notifyListeners();
    this.persistState();
  }

  /**
   * Subscribe to state changes with a selector
   */
  subscribe<T>(
    selector: StateSelector<T>,
    callback: StateSubscriber<T>
  ): vscode.Disposable {
    let previousValue = selector(this.state);

    const listener = (state: ExtensionState): void => {
      const newValue = selector(state);
      if (!this.shallowEqual(previousValue, newValue)) {
        previousValue = newValue;
        callback(newValue);
      }
    };

    this.listeners.add(listener);

    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  /**
   * Subscribe to all state changes
   */
  subscribeAll(callback: (state: ExtensionState) => void): vscode.Disposable {
    this.listeners.add(callback);
    return {
      dispose: () => {
        this.listeners.delete(callback);
      },
    };
  }

  /**
   * Reset state to initial values
   */
  reset(): void {
    this.state = createInitialState();
    this.notifyListeners();
    this.persistState();
  }

  /**
   * Dispose the state manager
   */
  dispose(): void {
    this.listeners.clear();
  }

  private createDraft(): ExtensionState {
    // Deep clone for immutability
    return JSON.parse(JSON.stringify(this.state));
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[Drift] State listener error:', error);
      }
    }
  }

  private loadState(): ExtensionState {
    const initial = createInitialState();
    
    try {
      const persisted = this.context.globalState.get<Partial<ExtensionState>>(PERSISTENCE_KEY);
      if (persisted) {
        // Only restore preferences, not transient state
        return {
          ...initial,
          preferences: {
            ...initial.preferences,
            ...persisted.preferences,
          },
        };
      }
    } catch (error) {
      console.error('[Drift] Failed to load persisted state:', error);
    }

    return initial;
  }

  private persistState(): void {
    // Only persist user preferences
    const toPersist = {
      preferences: this.state.preferences,
    };

    this.context.globalState.update(PERSISTENCE_KEY, toPersist).then(
      () => {},
      (error) => { console.error('[Drift] Failed to persist state:', error); }
    );
  }

  private shallowEqual(a: unknown, b: unknown): boolean {
    if (a === b) {return true;}
    if (typeof a !== typeof b) {return false;}
    if (typeof a !== 'object' || a === null || b === null) {return false;}

    const keysA = Object.keys(a);
    const keysB = Object.keys(b as object);

    if (keysA.length !== keysB.length) {return false;}

    for (const key of keysA) {
      if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Factory function for creating state manager
 */
export function createStateManager(context: vscode.ExtensionContext): StateManager {
  return new StateManager(context);
}

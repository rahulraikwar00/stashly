// utils/debug.ts
// Tiny dev/opt-in logger plus an in-memory event ring so the enrichments flow
// can surface "what actually happened?" feedback to the console and to the UI.
// Events are always recorded (cheap); console output is gated so a release
// build stays quiet unless EXPO_PUBLIC_DEBUG_LOGS=1.

export const DEBUG_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_LOGS === '1';

export type DebugEvent = {
  ts: number;
  tag: string;
  note: string;
};

const MAX_EVENTS = 100;

const events: DebugEvent[] = [];
const listeners = new Set<(event: DebugEvent) => void>();

function record(tag: string, note: string): void {
  events.push({ ts: Date.now(), tag, note });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  for (const listener of listeners) listener({ ts: Date.now(), tag, note });
}

/** Structured event used for user-facing feedback. Always recorded. */
export function pushEvent(tag: string, note: string): void {
  record(tag, note);
}

/** Console logging, gated to dev builds or EXPO_PUBLIC_DEBUG_LOGS=1. */
export function debugLog(tag: string, ...args: unknown[]): void {
  if (!DEBUG_ENABLED) return;
  const note = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  record(tag, note);
  console.log(`[${tag}]`, ...args);
}

/** Last N events, newest first. */
export function getDebugEvents(limit = 20): DebugEvent[] {
  return events.slice(-limit).reverse();
}

/** Subscribe to future events. Returns an unsubscribe function. */
export function subscribeDebug(listener: (event: DebugEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearDebugEvents(): void {
  events.length = 0;
}

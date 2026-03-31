import { useSyncExternalStore } from 'react';

export type ToastVariant = 'success' | 'error';

type ToastRecord = {
  id: string;
  message: string;
  variant: ToastVariant;
};

const listeners = new Set<() => void>();
let toasts: ToastRecord[] = [];

function emit() {
  for (const l of listeners) l();
}

export function toast(
  message: string,
  opts?: { variant?: ToastVariant; durationMs?: number },
) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const variant = opts?.variant ?? 'success';
  const durationMs = opts?.durationMs ?? 2500;
  toasts = [...toasts, { id, message, variant }];
  emit();
  globalThis.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, durationMs);
}

export function useToastState(): ToastRecord[] {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => toasts,
    () => toasts,
  );
}

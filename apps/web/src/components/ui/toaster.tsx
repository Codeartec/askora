import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastState } from '@/components/ui/useToast';

export function Toaster() {
  const toasts = useToastState();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="pointer-events-none fixed right-4 top-4 z-[100] flex max-w-[min(100vw-2rem,20rem)] flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg transition-colors duration-200',
            t.variant === 'success' &&
              'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-50',
            t.variant === 'error' &&
              'border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20',
          )}
        >
          {t.variant === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="min-w-0 flex-1 font-medium leading-snug">{t.message}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}

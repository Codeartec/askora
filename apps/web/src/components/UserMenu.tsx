import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type User = {
  name: string;
  email: string;
  avatarUrl?: string;
};

function initialsFromName(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] || '') : '';
  return (first + last).toUpperCase() || '?';
}

export function UserMenu({
  user,
  onLogout,
}: Readonly<{
  user: User;
  onLogout: () => void;
}>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const initials = useMemo(() => initialsFromName(user.name), [user.name]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    globalThis.addEventListener('keydown', onKeyDown);
    globalThis.addEventListener('pointerdown', onPointerDown);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
      globalThis.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-2 pr-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className={cn(
            'h-8 w-8 rounded-full overflow-hidden grid place-items-center border border-border bg-muted text-xs font-semibold',
          )}
          aria-hidden
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <span className="hidden sm:inline text-sm font-medium max-w-[180px] truncate">{user.name}</span>
        <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
      </Button>

      {open && (
        <div
          role="menu"
          aria-label={t('common.userMenu')}
          className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card text-card-foreground shadow-lg overflow-hidden z-50"
        >
          <div className="px-3 py-3">
            <div className="text-sm font-semibold truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
          <div className="h-px bg-border" />

          <div className="p-1">
            <Link
              to="/settings"
              role="menuitem"
              className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-4 w-4" aria-hidden />
              {t('settings.menu')}
            </Link>
            <button
              type="button"
              className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {t('auth.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


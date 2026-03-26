import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from './ui/button';
import { LanguageToggle } from './LanguageToggle';
import { Plus, LayoutDashboard } from 'lucide-react';
import { UserMenu } from './UserMenu';

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isCreatePool = location.pathname === '/pools/create';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logo.svg"
              alt={t('common.appName')}
              className="h-8 w-8 rounded-lg object-contain"
            />
            <span className="font-bold text-xl">{t('common.appName')}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            {user ? (
              <>
                {!isDashboard && (
                  <Link to="/dashboard">
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      <LayoutDashboard className="h-4 w-4" />
                      {t('dashboard.title')}
                    </Button>
                  </Link>
                )}
                {!isDashboard && !isCreatePool && (
                  <Link to="/pools/create">
                    <Button size="sm" className="gap-1.5">
                      <Plus className="h-4 w-4" />
                      {t('pool.create')}
                    </Button>
                  </Link>
                )}
                <UserMenu user={user} onLogout={handleLogout} />
              </>
            ) : (
              <>
                <Link to="/join">
                  <Button variant="outline" size="sm">{t('pool.join')}</Button>
                </Link>
                <Link to="/login">
                  <Button size="sm">{t('auth.login')}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 pb-10 pt-6 sm:px-6 md:pt-8 md:pb-12">
        <Outlet />
      </main>
    </div>
  );
}

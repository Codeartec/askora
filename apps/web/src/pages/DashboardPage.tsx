import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, UserPlus, MessageSquare, ChevronRight, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { LoaderCat } from '@/components/LoaderCat';

interface Pool {
  id: string;
  code: string;
  title: string;
  genre: string;
  status: string;
  isPublic: boolean;
  createdAt: string;
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [createdPools, setCreatedPools] = useState<Pool[]>([]);
  const [joinedPools, setJoinedPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [poolPendingDelete, setPoolPendingDelete] = useState<Pool | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/pools/my'), api.get('/pools/joined')])
      .then(([createdRes, joinedRes]) => {
        setCreatedPools(createdRes.data || []);
        setJoinedPools(joinedRes.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const statusVariant = (s: string) => {
    if (s === 'active') return 'success' as const;
    if (s === 'closed') return 'secondary' as const;
    return 'outline' as const;
  };

  const formatPoolDateTime = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  const onDeleteDialogOpenChange = (open: boolean) => {
    if (!open) {
      setPoolPendingDelete(null);
      setDeleteError(null);
    }
  };

  const confirmDeletePool = async () => {
    if (!poolPendingDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await api.delete(`/pools/${poolPendingDelete.id}`);
      setCreatedPools((prev) => prev.filter((p) => p.id !== poolPendingDelete.id));
      setPoolPendingDelete(null);
    } catch {
      setDeleteError(t('pool.deletePoolError'));
    } finally {
      setDeleteLoading(false);
    }
  };

  let content: React.ReactNode;
  if (loading) {
    content = <LoaderCat className="py-16" />;
  } else if (createdPools.length === 0 && joinedPools.length === 0) {
    content = (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">{t('pool.noPoolsYet')}</p>
          <div className="flex w-full max-w-sm flex-col gap-2 sm:w-auto sm:max-w-none sm:flex-row">
            <Link to="/join" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full gap-1.5 sm:w-auto">
                <UserPlus className="h-4 w-4" />
                {t('dashboard.joinPool')}
              </Button>
            </Link>
            <Link to="/pools/create" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">{t('dashboard.createFirst')}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  } else {
    const createdIds = new Set(createdPools.map((p) => p.id));
    const dedupedJoinedPools = joinedPools.filter((p) => !createdIds.has(p.id));
    content = (
      <div className="space-y-6">
        {createdPools.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{t('pool.myPools')}</h2>
            <div className="grid gap-4">
              {createdPools.map((pool) => (
                <Card key={pool.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center gap-2 p-4">
                    <Link
                      to={`/pools/${pool.id}`}
                      className="flex flex-1 min-w-0 items-center justify-between gap-3 text-left"
                      aria-label={[
                        pool.title,
                        t(`pool.${pool.status}`),
                        pool.isPublic ? t('pool.public') : t('pool.private'),
                        `${t('pool.created')}: ${formatPoolDateTime(pool.createdAt)}`,
                      ].join(', ')}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="min-w-0 flex-1 truncate text-base font-semibold leading-snug" title={pool.title}>
                            {pool.title}
                          </h3>
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-3 text-xs sm:text-sm text-muted-foreground">
                          <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-mono bg-muted px-2 py-0.5 rounded text-[11px] sm:text-xs">
                              {pool.code}
                            </span>
                            <span className="text-muted-foreground/60" aria-hidden>
                              •
                            </span>
                            <span className="min-w-0 truncate">{t(`pool.genres.${pool.genre}`)}</span>
                            <span className="text-muted-foreground/60" aria-hidden>
                              •
                            </span>
                            <span className="tabular-nums">
                              {t('pool.created')}: {formatPoolDateTime(pool.createdAt)}
                            </span>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                            <Badge variant={statusVariant(pool.status)} className="text-[10px] font-normal">
                              {t(`pool.${pool.status}`)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={[
                                'text-[10px] font-normal',
                                pool.isPublic
                                  ? 'border-sky-300/70 bg-sky-500/10 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300'
                                  : 'border-violet-300/70 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300',
                              ].join(' ')}
                            >
                              {pool.isPublic ? t('pool.public') : t('pool.private')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={t('pool.deletePoolAria', { title: pool.title })}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPoolPendingDelete(pool);
                        setDeleteError(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {dedupedJoinedPools.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{t('pool.join')}</h2>
            <div className="grid gap-4">
              {dedupedJoinedPools.map((pool) => (
                <Link
                  key={pool.id}
                  to={`/pools/${pool.id}/live`}
                  aria-label={[
                    pool.title,
                    t(`pool.${pool.status}`),
                    pool.isPublic ? t('pool.public') : t('pool.private'),
                    `${t('pool.created')}: ${formatPoolDateTime(pool.createdAt)}`,
                  ].join(', ')}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="min-w-0 flex-1 truncate text-base font-semibold leading-snug" title={pool.title}>
                            {pool.title}
                          </h3>
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-3 text-xs sm:text-sm text-muted-foreground">
                          <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-mono bg-muted px-2 py-0.5 rounded text-[11px] sm:text-xs">
                              {pool.code}
                            </span>
                            <span className="text-muted-foreground/60" aria-hidden>
                              •
                            </span>
                            <span className="min-w-0 truncate">{t(`pool.genres.${pool.genre}`)}</span>
                            <span className="text-muted-foreground/60" aria-hidden>
                              •
                            </span>
                            <span className="tabular-nums">
                              {t('pool.created')}: {formatPoolDateTime(pool.createdAt)}
                            </span>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                            <Badge variant={statusVariant(pool.status)} className="text-[10px] font-normal">
                              {t(`pool.${pool.status}`)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={[
                                'text-[10px] font-normal',
                                pool.isPublic
                                  ? 'border-sky-300/70 bg-sky-500/10 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300'
                                  : 'border-violet-300/70 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300',
                              ].join(' ')}
                            >
                              {pool.isPublic ? t('pool.public') : t('pool.private')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">
            {t('dashboard.welcome')}, <span className="text-foreground font-medium">{user?.name}</span>
          </p>
        </div>
        {!loading && (createdPools.length > 0 || joinedPools.length > 0) && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <Link to="/join" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full gap-1.5 sm:w-auto">
                <UserPlus className="h-4 w-4" />
                {t('dashboard.joinPool')}
              </Button>
            </Link>
            <Link to="/pools/create" className="w-full sm:w-auto">
              <Button className="w-full gap-1.5 sm:w-auto">
                <Plus className="h-4 w-4" />
                {t('pool.create')}
              </Button>
            </Link>
          </div>
        )}
      </div>

      {content}

      <Dialog open={poolPendingDelete !== null} onOpenChange={onDeleteDialogOpenChange}>
        <DialogContent
          onPointerDownOutside={(e) => {
            if (deleteLoading) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (deleteLoading) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('pool.deletePoolDialogTitle')}</DialogTitle>
            <DialogDescription>
              {poolPendingDelete
                ? t('pool.deletePoolConfirm', { title: poolPendingDelete.title })
                : null}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleteLoading}
              onClick={() => onDeleteDialogOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteLoading}
              onClick={() => void confirmDeletePool()}
            >
              {deleteLoading ? t('common.loading') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

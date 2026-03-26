import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/api';

export function JoinPoolPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleJoin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.get(`/pools/code/${code.toUpperCase()}`);
      if (data) {
        navigate(`/pools/${data.id}/live`);
      } else {
        setError('Pool not found');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(typeof msg === 'string' && msg.trim() !== '' ? msg : 'Pool not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 md:py-16">
      <header className="mb-8 text-center md:mb-10">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15"
          aria-hidden
        >
          <Ticket className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 text-balance text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {t('pool.join')}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          {t('pool.joinLead')}
        </p>
      </header>

      <Card className="border-border/80 shadow-md ring-1 ring-border/40">
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleJoin} className="space-y-6">
            <div className="space-y-3">
              <label htmlFor="pool-code" className="block text-sm font-medium text-foreground">
                {t('pool.code')}
              </label>
              <Input
                ref={inputRef}
                id="pool-code"
                name="poolCode"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t('pool.enterCode')}
                maxLength={8}
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                aria-invalid={!!error}
                aria-describedby={error ? 'pool-code-error' : undefined}
                className="h-14 text-center text-2xl font-mono tracking-[0.35em] placeholder:tracking-normal placeholder:text-muted-foreground/70 sm:text-3xl sm:tracking-[0.4em]"
                required
              />
            </div>

            {error && (
              <p id="pool-code-error" className="text-center text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
              {loading ? t('common.loading') : t('pool.join')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <nav className="mt-10 flex justify-center border-t border-border/60 pt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {t('common.back')}
        </Link>
      </nav>
    </div>
  );
}

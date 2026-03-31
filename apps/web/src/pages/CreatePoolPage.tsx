import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Eye, Users, Shield, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const GENRES = ['technology', 'politics', 'casual', 'economics', 'biology', 'gaming', 'cinema', 'education', 'science', 'other'];

function FormSection({
  title,
  hint,
  icon: Icon,
  children,
  className,
}: Readonly<{
  title: string;
  hint: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm ring-1 ring-border/40',
        className,
      )}
    >
      <div className="flex gap-3 border-b border-border bg-muted/35 px-4 py-4 sm:px-5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/15"
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="space-y-4 bg-background/50 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
  ariaLabel,
}: Readonly<{
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  ariaLabel: string;
}>) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium leading-snug">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 items-center sm:pt-0.5">
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            onClick={onToggle}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              checked
                ? 'bg-primary'
                : 'border border-border bg-background shadow-sm ring-1 ring-border/70 dark:ring-border',
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-sm ring-1 ring-black/5 transition-transform dark:ring-white/10',
                checked
                  ? 'translate-x-6 bg-white'
                  : 'translate-x-1 bg-muted-foreground/55 dark:bg-muted-foreground/70',
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreatePoolPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    genre: 'technology',
    isPublic: true,
    accessKey: '',
    requireIdentification: false,
    customFilterRules: '',
  });

  const update = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { ...form };
      if (payload.isPublic) {
        delete (payload as { accessKey?: string }).accessKey;
      }
      const { data } = await api.post('/pools', payload);
      navigate(`/pools/${data.id}`);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>{t('pool.create')}</CardTitle>
          <CardDescription className="text-base leading-relaxed">{t('pool.createPageDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormSection icon={FileText} title={t('pool.sectionBasicInfo')} hint={t('pool.sectionBasicInfoHint')}>
              <div className="space-y-2">
                <label htmlFor="pool-title" className="text-sm font-medium">
                  {t('pool.title')}
                </label>
                <p className="text-sm text-muted-foreground">{t('pool.titleHint')}</p>
                <Input
                  id="pool-title"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  required
                  autoComplete="off"
                  placeholder={t('pool.title')}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="pool-description" className="text-sm font-medium">
                  {t('pool.description')}
                </label>
                <p className="text-sm text-muted-foreground">{t('pool.descriptionHint')}</p>
                <Textarea
                  id="pool-description"
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={3}
                  placeholder={t('pool.description')}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="pool-genre" className="text-sm font-medium">
                  {t('pool.genre')}
                </label>
                <p className="text-sm text-muted-foreground">{t('pool.genreHint')}</p>
                <select
                  id="pool-genre"
                  value={form.genre}
                  onChange={(e) => update('genre', e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {t(`pool.genres.${g}`)}
                    </option>
                  ))}
                </select>
              </div>
            </FormSection>

            <FormSection icon={Eye} title={t('pool.sectionVisibility')} hint={t('pool.sectionVisibilityHint')}>
              <ToggleRow
                label={t('pool.privacy')}
                description={
                  form.isPublic ? t('pool.privacyCurrentHintPublic') : t('pool.privacyCurrentHintPrivate')
                }
                checked={form.isPublic}
                onToggle={() => update('isPublic', !form.isPublic)}
                ariaLabel={t('pool.privacy')}
              />
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{t('pool.privacyStateLabel')}</span>
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-medium',
                    form.isPublic ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground',
                  )}
                >
                  {form.isPublic ? t('pool.public') : t('pool.private')}
                </span>
              </p>

              {!form.isPublic && (
                <div className="space-y-2 pt-1">
                  <label htmlFor="pool-access-key" className="text-sm font-medium">
                    {t('pool.accessKey')}
                  </label>
                  <p className="text-sm text-muted-foreground">{t('pool.accessKeyHint')}</p>
                  <Input
                    id="pool-access-key"
                    value={form.accessKey}
                    onChange={(e) => update('accessKey', e.target.value)}
                    placeholder={t('pool.accessKeyPlaceholder')}
                    autoComplete="off"
                  />
                </div>
              )}
            </FormSection>

            <FormSection icon={Users} title={t('pool.sectionParticipants')} hint={t('pool.sectionParticipantsHint')}>
              <ToggleRow
                label={t('pool.requireId')}
                description={t('pool.requireIdHint')}
                checked={form.requireIdentification}
                onToggle={() => update('requireIdentification', !form.requireIdentification)}
                ariaLabel={t('pool.requireId')}
              />
            </FormSection>

            <FormSection icon={Shield} title={t('pool.sectionModeration')} hint={t('pool.customRulesHint')}>
              <div className="space-y-2">
                <label htmlFor="pool-custom-rules" className="text-sm font-medium">
                  {t('pool.customRules')}
                </label>
                <Textarea
                  id="pool-custom-rules"
                  value={form.customFilterRules}
                  onChange={(e) => update('customFilterRules', e.target.value)}
                  placeholder={t('pool.customRulesPlaceholder')}
                  rows={3}
                />
              </div>
            </FormSection>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row">
              <Button type="button" variant="outline" className="sm:w-auto" onClick={() => navigate(-1)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 sm:min-w-48">
                {loading ? t('common.loading') : t('pool.create')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

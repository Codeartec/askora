import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import api from '@/lib/api';

const GENRES = ['technology', 'politics', 'casual', 'economics', 'biology', 'gaming', 'cinema', 'education', 'science', 'other'];

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

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  useEffect(() => {
    setForm((f) => ({ ...f, isPublic: true }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { ...form };
      if (payload.isPublic) {
        delete (payload as any).accessKey;
      }
      const { data } = await api.post('/pools', payload);
      navigate(`/pools/${data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{t('pool.create')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('pool.title')}</label>
              <Input value={form.title} onChange={(e) => update('title', e.target.value)} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('pool.description')}</label>
              <Textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('pool.genre')}</label>
              <select
                value={form.genre}
                onChange={(e) => update('genre', e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>{t(`pool.genres.${g}`)}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">{t('pool.privacy')}</label>
              <button
                type="button"
                role="switch"
                aria-checked={form.isPublic}
                onClick={() => update('isPublic', !form.isPublic)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isPublic ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-muted-foreground">{form.isPublic ? t('pool.public') : t('pool.private')}</span>
            </div>

            {!form.isPublic && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('pool.accessKey')}</label>
                <Input
                  value={form.accessKey}
                  onChange={(e) => update('accessKey', e.target.value)}
                  placeholder="Leave empty for auto-generated key"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">{t('pool.requireId')}</label>
              <button
                type="button"
                role="switch"
                aria-checked={form.requireIdentification}
                onClick={() => update('requireIdentification', !form.requireIdentification)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.requireIdentification ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.requireIdentification ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('pool.customRules')}</label>
              <Textarea
                value={form.customFilterRules}
                onChange={(e) => update('customFilterRules', e.target.value)}
                placeholder={t('pool.customRulesPlaceholder')}
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? t('common.loading') : t('pool.create')}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

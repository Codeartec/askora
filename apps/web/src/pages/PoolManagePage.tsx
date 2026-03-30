import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Copy, Play, Square, Users, MessageSquare, ArrowLeft, Wifi, WifiOff, ShieldAlert, Check, X, Sparkles, ClipboardList, Plus, Send, PanelLeft, Trash2, Eye, EyeOff, ChevronDown, Loader2 } from 'lucide-react';
import { usePool, displayItemKey, type DisplayItem } from '@/hooks/usePool';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { LoaderCat } from '@/components/LoaderCat';

type DraftPoll = {
  id: string;
  questionText: string;
  type: string;
  options: Array<{ id: string; text: string; position: number }>;
};

type CompletedPoll = {
  id: string;
  questionText: string;
  type: string;
  showResultsToParticipants: boolean;
  totalResponses: number;
  closedAt: string;
  options: Array<{ id: string; text: string; position: number; responseCount: number }>;
};

type PollResultOpt = { id: string; text: string; responseCount?: number; _count?: { responses: number } };

function pollTotalResponses(pr: { totalResponses?: number; _count?: { responses: number } }): number {
  if (typeof pr.totalResponses === 'number') return pr.totalResponses;
  return pr._count?.responses ?? 0;
}

function pollOptionCount(opt: PollResultOpt): number {
  return typeof opt.responseCount === 'number' ? opt.responseCount : opt._count?.responses ?? 0;
}

export function PoolManagePage() {
  const { t } = useTranslation();
  const quickPollFormId = useId();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [poolData, setPoolData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAccessKey, setCopiedAccessKey] = useState(false);
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [quickPollText, setQuickPollText] = useState('');
  const [quickPollOptions, setQuickPollOptions] = useState(['', '']);
  const [showPollForm, setShowPollForm] = useState(false);
  const [showQuickResultsToAudience, setShowQuickResultsToAudience] = useState(false);
  const [participantsPanelOpen, setParticipantsPanelOpen] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const [draftPolls, setDraftPolls] = useState<DraftPoll[]>([]);
  const [completedPolls, setCompletedPolls] = useState<CompletedPoll[]>([]);
  const [isMergeHighlightActive, setIsMergeHighlightActive] = useState(false);
  const mergeHighlightTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    api.get(`/pools/${id}`).then(({ data }) => {
      setPoolData(data);
      setLoading(false);
    }).catch(() => navigate('/dashboard'));
  }, [id]);

  const {
    connected,
    pool,
    displayItems,
    flaggedQuestions,
    liveAudienceCount,
    participantRoster,
    voteCounts,
    updateStatus,
    moderateQuestion,
    triggerMerge,
    mergeInProgress,
    createPoll,
    launchPoll,
    closePoll,
    activePoll,
    pollResults,
    pollLibraryRevision,
  } = usePool(poolData?.code || null);

  const fetchDrafts = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get<DraftPoll[]>(`/pools/${id}/polls/drafts`);
      setDraftPolls(Array.isArray(data) ? data : []);
    } catch {
      setDraftPolls([]);
    }
  }, [id]);

  const fetchCompletedPolls = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get<CompletedPoll[]>(`/pools/${id}/polls/completed`);
      setCompletedPolls(Array.isArray(data) ? data : []);
    } catch {
      setCompletedPolls([]);
    }
  }, [id]);

  useEffect(() => {
    if (!id || !connected) return;
    void fetchDrafts();
    void fetchCompletedPolls();
  }, [id, connected, pollLibraryRevision, fetchDrafts, fetchCompletedPolls]);

  const displayPool = pool || poolData;

  const lastMergeLabel = useMemo(() => {
    const ts = pool?.lastQuestionMergeAt ?? poolData?.lastQuestionMergeAt;
    if (!ts) return t('pool.lastMergeNever');
    return t('pool.lastMergeReview', {
      datetime: new Date(ts).toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    });
  }, [pool?.lastQuestionMergeAt, poolData?.lastQuestionMergeAt, t]);
  useEffect(() => {
    return () => {
      if (mergeHighlightTimeoutRef.current !== null) {
        globalThis.clearTimeout(mergeHighlightTimeoutRef.current);
      }
    };
  }, []);

  const startMergeHighlight = useCallback(() => {
    setIsMergeHighlightActive(true);
    if (mergeHighlightTimeoutRef.current !== null) {
      globalThis.clearTimeout(mergeHighlightTimeoutRef.current);
    }
    mergeHighlightTimeoutRef.current = globalThis.setTimeout(() => {
      setIsMergeHighlightActive(false);
    }, 1200);
  }, []);

  const handleAiMergeClick = useCallback(() => {
    startMergeHighlight();
    triggerMerge();
  }, [startMergeHighlight, triggerMerge]);

  useEffect(() => {
    if (!participantsPanelOpen) setParticipantSearch('');
  }, [participantsPanelOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!participantsPanelOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [participantsPanelOpen]);

  const filteredNamedParticipants = useMemo(() => {
    if (!participantRoster) return [];
    const q = participantSearch.trim().toLowerCase();
    const filtered = q
      ? participantRoster.named.filter((n) => n.displayName.toLowerCase().includes(q))
      : participantRoster.named;
    return [...filtered].sort((a, b) => {
      if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [participantRoster, participantSearch]);

  const participantsCardCount =
    participantRoster !== null ? participantRoster.audienceConnected : liveAudienceCount;

  const copyToClipboard = async (text: string) => {
    if (!text) return false;
    try {
      const n = globalThis.navigator;
      if (n?.clipboard?.writeText) {
        await n.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback below
    }
    try {
      const d = globalThis.document;
      const el = d.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.top = '-9999px';
      d.body.appendChild(el);
      el.focus();
      el.select();
      const ok = d.execCommand('copy');
      el.remove();
      return ok;
    } catch {
      return false;
    }
  };

  const copyCode = () => {
    if (!displayPool) return;
    void (async () => {
      const ok = await copyToClipboard(displayPool.code);
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    })();
  };

  const copyAccessKey = () => {
    // WS payload does not always include privacy/accessKey fields, so prefer HTTP payload when available.
    const key =
      typeof poolData?.accessKey === 'string'
        ? poolData.accessKey
        : typeof displayPool?.accessKey === 'string'
          ? displayPool.accessKey
          : '';
    if (!key) return;
    void (async () => {
      const ok = await copyToClipboard(key);
      if (!ok) return;
      setCopiedAccessKey(true);
      setTimeout(() => setCopiedAccessKey(false), 2000);
    })();
  };

  if (loading || !displayPool) return <LoaderCat className="py-16" />;

  const statusVariant = displayPool.status === 'active' ? 'success' as const : displayPool.status === 'closed' ? 'secondary' as const : 'outline' as const;
  const liveChannelOk = displayPool.status === 'active' && connected;
  // WS payload does not always include privacy/accessKey fields, so keep these from the HTTP payload when available.
  const privacyIsPublic =
    typeof poolData?.isPublic === 'boolean'
      ? poolData.isPublic
      : typeof displayPool.isPublic === 'boolean'
        ? displayPool.isPublic
        : true;
  const isPrivatePool = !privacyIsPublic;
  const accessKeyText =
    typeof poolData?.accessKey === 'string'
      ? poolData.accessKey
      : typeof displayPool.accessKey === 'string'
        ? displayPool.accessKey
        : '';
  const customFilterRulesText =
    typeof poolData?.customFilterRules === 'string'
      ? poolData.customFilterRules
      : typeof displayPool?.customFilterRules === 'string'
        ? displayPool.customFilterRules
        : '';
  const requireIdentification =
    typeof poolData?.requireIdentification === 'boolean'
      ? poolData.requireIdentification
      : typeof displayPool?.requireIdentification === 'boolean'
        ? displayPool.requireIdentification
        : false;

  const statusCardClass =
    displayPool.status === 'active'
      ? 'bg-emerald-50/40 border-emerald-200/60 dark:bg-emerald-950/10 dark:border-emerald-900/30'
      : displayPool.status === 'draft'
        ? 'bg-amber-50/40 border-amber-200/60 dark:bg-amber-950/10 dark:border-amber-900/30'
        : 'bg-muted/30 border-border';

  const shareOrigin = globalThis.window?.location?.origin;
  const shareUrl = shareOrigin
    ? `${shareOrigin}/join?code=${encodeURIComponent(displayPool.code)}`
    : '';

  const copyShareLink = () => {
    if (!shareUrl) return;
    void (async () => {
      const ok = await copyToClipboard(shareUrl);
      if (!ok) return;
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    })();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{displayPool.title}</h1>
              <Badge variant={statusVariant}>{t(`pool.${displayPool.status}`)}</Badge>
              {liveChannelOk ? (
                <Wifi className="h-4 w-4 text-green-500" aria-hidden />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" aria-hidden />
              )}
            </div>

            {isPrivatePool && accessKeyText !== '' && (
              <div className="ml-auto flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-2 py-1">
                <span className="text-xs text-muted-foreground">{t('pool.accessKey')}</span>
                <span className="font-mono text-sm font-semibold tracking-widest">
                  {showAccessKey ? accessKeyText : '•'.repeat(Math.max(6, Math.min(accessKeyText.length, 12)))}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAccessKey((v) => !v)}
                  className="h-7 w-7"
                  aria-label={showAccessKey ? t('settings.hidePassword') : t('settings.showPassword')}
                >
                  {showAccessKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={copyAccessKey}
                  className="h-7 w-7"
                  aria-label={t('pool.accessKey')}
                >
                  {copiedAccessKey ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {displayPool.description && (
        <Card className="border-border bg-muted/20">
          <CardContent className="p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{displayPool.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-4">
        <Card className="flex h-full min-h-0 flex-col bg-linear-to-br from-violet-50/80 to-white border-border shadow-md dark:from-violet-950/20 dark:to-card">
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-sm text-muted-foreground">{t('pool.code')}</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-mono font-bold tracking-widest">{displayPool.code}</span>
              <Button variant="ghost" size="icon" onClick={copyCode} className="h-8 w-8">
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copyShareLink}
                disabled={copiedLink}
                className="gap-1.5 h-10 sm:h-9"
              >
                {copiedLink ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedLink ? t('pool.linkCopied') : t('pool.copyLink')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={`flex h-full min-h-0 flex-col ${statusCardClass}`}>
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-sm text-muted-foreground">{t('pool.status')}</p>
            <div className="flex justify-center gap-2">
              {displayPool.status === 'draft' && (
                <Button size="sm" onClick={() => updateStatus('active')} className="gap-1.5">
                  <Play className="h-4 w-4" /> {t('pool.open')}
                </Button>
              )}
              {displayPool.status === 'active' && (
                <Button size="sm" variant="destructive" onClick={() => updateStatus('closed')} className="gap-1.5">
                  <Square className="h-4 w-4" /> {t('pool.close')}
                </Button>
              )}
              {displayPool.status === 'closed' && (
                <Button size="sm" onClick={() => updateStatus('active')} className="gap-1.5">
                  <Play className="h-4 w-4" /> Reopen
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-0 flex-col border-border">
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-sm text-muted-foreground">{t('dashboard.participants')}</p>
            <div className="flex items-center justify-center gap-1">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{participantsCardCount}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 w-full h-10 sm:h-9"
              onClick={() => setParticipantsPanelOpen(true)}
            >
              <PanelLeft className="h-4 w-4" />
              {t('pool.viewConnected')}
            </Button>
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-0 flex-col border-border">
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-sm text-muted-foreground">{t('dashboard.questions')}</p>
            <div className="flex items-center justify-center gap-1">
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{displayItems.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="gap-2">
              <ShieldAlert className="h-4 w-4" />
              {t('pool.viewCustomRules')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                {t('pool.customRules')}
              </DialogTitle>
              <DialogDescription>{t('pool.customRulesDialogDescription')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="inline-flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('pool.requireId')}</span>
                <Badge variant={requireIdentification ? 'success' : 'secondary'}>
                  {requireIdentification ? t('common.yes') : t('common.no')}
                </Badge>
              </div>
              {customFilterRulesText.trim() === '' ? (
                <p className="text-sm text-muted-foreground">{t('pool.customRulesEmpty')}</p>
              ) : (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <pre className="whitespace-pre-wrap wrap-break-word text-sm text-foreground/90">
                    {customFilterRulesText}
                  </pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {flaggedQuestions.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-yellow-600" />
              {t('question.retained')} ({flaggedQuestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {flaggedQuestions.map((q) => (
              <div key={q.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{q.originalText}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {q.participant?.isAnonymous ? t('participant.anonymous') : q.participant?.displayName}
                  </p>
                  {q.moderationReason && (
                    <p className="text-xs text-yellow-700 mt-1">
                      {t('question.reason')}: {q.moderationReason}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => moderateQuestion(q.id, 'approve')} className="h-8 w-8 p-0">
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => moderateQuestion(q.id, 'reject')} className="h-8 w-8 p-0">
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-border border-l-4 border-l-primary/70">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                <ClipboardList className="h-5 w-5 shrink-0" />
                {t('quickPoll.title')}
              </CardTitle>
              <CardDescription>{t('quickPoll.description')}</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPollForm(!showPollForm)}
              className="gap-1.5 shrink-0 self-start sm:self-auto h-10 sm:h-9"
            >
              {showPollForm ? (
                t('common.cancel')
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {t('quickPoll.newPoll')}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {draftPolls.length > 0 && (
          <CardContent className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-muted-foreground">{t('quickPoll.draftsSection')}</p>
            <ul className="space-y-2">
              {draftPolls.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{d.questionText}</p>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {t('quickPoll.optionCountBadge', { count: (d.options ?? []).length })}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(d.options ?? []).map((o) => o.text).join(t('quickPoll.optionPreviewSeparator'))}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button size="sm" className="gap-1.5" onClick={() => launchPoll(d.id)}>
                      <Play className="h-3.5 w-3.5" />
                      {t('quickPoll.launch')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={async () => {
                        try {
                          await api.delete(`/pools/${id}/polls/${d.id}`);
                          await fetchDrafts();
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
        {/* Intentionally hide the "empty drafts" block to reduce vertical noise. */}
        {showPollForm && (
          <CardContent className="space-y-3 border-t border-border pt-4">
            <div className="space-y-2">
              <label htmlFor={`${quickPollFormId}-question`} className="text-sm font-medium">
                {t('quickPoll.questionLabel')}
              </label>
              <Input
                id={`${quickPollFormId}-question`}
                value={quickPollText}
                onChange={(e) => setQuickPollText(e.target.value)}
                placeholder={t('quickPoll.questionPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('quickPoll.optionsLabel')}</p>
              {quickPollOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    id={`${quickPollFormId}-opt-${i}`}
                    value={opt}
                    onChange={(e) => {
                      const n = [...quickPollOptions];
                      n[i] = e.target.value;
                      setQuickPollOptions(n);
                    }}
                    placeholder={t('quickPoll.optionPlaceholder', { n: i + 1 })}
                    className="flex-1"
                    aria-label={t('quickPoll.optionPlaceholder', { n: i + 1 })}
                  />
                  {i === quickPollOptions.length - 1 && quickPollOptions.length < 6 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setQuickPollOptions([...quickPollOptions, ''])}
                      aria-label={t('quickPoll.addOptionAria')}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {quickPollOptions.filter(Boolean).length < 2 && (
              <p className="text-sm text-muted-foreground">{t('quickPoll.minOptionsHint')}</p>
            )}
            <label className="flex cursor-pointer items-start gap-2 text-sm" htmlFor={`${quickPollFormId}-show-results`}>
              <input
                id={`${quickPollFormId}-show-results`}
                type="checkbox"
                checked={showQuickResultsToAudience}
                onChange={(e) => setShowQuickResultsToAudience(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border"
              />
              <span className="text-muted-foreground leading-snug">{t('quickPoll.showResultsToAudience')}</span>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <Button
                type="button"
                variant="outline"
                className="flex-1 gap-1.5 sm:order-1"
                disabled={!quickPollText.trim() || quickPollOptions.filter(Boolean).length < 2}
                onClick={() => {
                  createPoll(
                    quickPollText,
                    'multiple_choice',
                    quickPollOptions.filter(Boolean),
                    showQuickResultsToAudience,
                    true,
                  );
                  setQuickPollText('');
                  setQuickPollOptions(['', '']);
                  setShowQuickResultsToAudience(false);
                  setShowPollForm(false);
                }}
              >
                {t('quickPoll.saveDraft')}
              </Button>
              <Button
                type="button"
                className="flex-1 gap-1.5 sm:order-2"
                disabled={!quickPollText.trim() || quickPollOptions.filter(Boolean).length < 2}
                onClick={() => {
                  createPoll(
                    quickPollText,
                    'multiple_choice',
                    quickPollOptions.filter(Boolean),
                    showQuickResultsToAudience,
                    false,
                  );
                  setQuickPollText('');
                  setQuickPollOptions(['', '']);
                  setShowQuickResultsToAudience(false);
                  setShowPollForm(false);
                }}
              >
                <Send className="h-4 w-4" />
                {t('quickPoll.createAndLaunch')}
              </Button>
            </div>
          </CardContent>
        )}
        {activePoll && (
          <CardContent className="border-t border-border pt-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">{t('quickPoll.pollLive')}</Badge>
                <p className="min-w-0 flex-1 font-medium leading-snug">{activePoll.questionText}</p>
              </div>
              {pollResults &&
                pollResults.id === activePoll.id &&
                Array.isArray(pollResults.options) &&
                pollResults.options.length > 0 && (
                  <ul className="mt-4 space-y-3 text-sm">
                    {pollResults.options.map((opt: PollResultOpt) => {
                      const n = pollOptionCount(opt);
                      const total = pollTotalResponses(pollResults);
                      const pct = total > 0 ? (n / total) * 100 : 0;
                      return (
                        <li key={opt.id} className="space-y-1">
                          <div className="flex justify-between gap-2">
                            <span className="text-foreground/90">{opt.text}</span>
                            <span className="shrink-0 font-medium tabular-nums">{n}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/70 transition-[width]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              {pollResults && pollResults.id === activePoll.id && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t('quickPoll.totalResponses', { count: pollTotalResponses(pollResults) })}
                </p>
              )}
              <Button size="sm" variant="destructive" className="mt-3" onClick={() => closePoll(activePoll.id)}>
                {t('quickPoll.closePoll')}
              </Button>
            </div>
          </CardContent>
        )}
        {!activePoll && pollResults && (
          <CardContent className="border-t border-border pt-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">{t('quickPoll.finalResultsTitle')}</p>
              <p className="mt-2 font-medium leading-snug">{pollResults.questionText}</p>
              {Array.isArray(pollResults.options) && pollResults.options.length > 0 && (
                <ul className="mt-4 space-y-3 text-sm">
                  {pollResults.options.map((opt: PollResultOpt) => {
                    const n = pollOptionCount(opt);
                    const total = pollTotalResponses(pollResults);
                    const pct = total > 0 ? (n / total) * 100 : 0;
                    return (
                      <li key={opt.id} className="space-y-1">
                        <div className="flex justify-between gap-2">
                          <span className="text-foreground/90">{opt.text}</span>
                          <span className="shrink-0 font-medium tabular-nums">{n}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/60 transition-[width]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {t('quickPoll.totalResponses', { count: pollTotalResponses(pollResults) })}
              </p>
            </div>
          </CardContent>
        )}

        {completedPolls.length > 0 && (
          <CardContent className="border-t border-border pt-4">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm [&::-webkit-details-marker]:hidden">
                <span className="font-medium text-muted-foreground">
                  {t('quickPoll.completedSection')}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {completedPolls.length}
                  </Badge>
                  <span className="underline-offset-2 group-open:underline">{t('common.view')}</span>
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
                </span>
              </summary>
              <div className="mt-3">
                <ul className="space-y-2">
                  {completedPolls.map((hp) => {
                    const total = pollTotalResponses(hp);
                    return (
                      <li key={hp.id}>
                        <details className="group rounded-lg border border-border bg-muted/20">
                          <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
                            <span className="min-w-0 flex-1 font-medium leading-snug">{hp.questionText}</span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {t('quickPoll.closedAtLabel', {
                                datetime: new Date(hp.closedAt).toLocaleString(),
                              })}
                            </span>
                          </summary>
                          <div className="border-t border-border px-3 pb-3 pt-2">
                            <p className="text-xs text-muted-foreground">
                              {t('quickPoll.totalResponses', { count: total })}
                            </p>
                            {Array.isArray(hp.options) && hp.options.length > 0 && (
                              <ul className="mt-3 space-y-3 text-sm">
                                {hp.options.map((opt: PollResultOpt) => {
                                  const n = pollOptionCount(opt);
                                  const pct = total > 0 ? (n / total) * 100 : 0;
                                  return (
                                    <li key={opt.id} className="space-y-1">
                                      <div className="flex justify-between gap-2">
                                        <span className="text-foreground/90">{opt.text}</span>
                                        <span className="shrink-0 font-medium tabular-nums">{n}</span>
                                      </div>
                                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                        <div
                                          className="h-full rounded-full bg-primary/50 transition-[width]"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          </CardContent>
        )}
      </Card>

      <Card
        className={[
          'border-border transition-colors duration-700 motion-reduce:transition-none',
          isMergeHighlightActive
            ? 'border-primary/50 bg-primary/3 shadow-[0_0_0_1px_hsl(var(--primary)/0.12)] motion-safe:animate-pulse'
            : '',
        ].join(' ')}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {t('dashboard.questions')} ({displayItems.length})
            </CardTitle>
            <div className="ml-auto flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{lastMergeLabel}</p>
              {displayPool.status === 'active' && displayItems.length >= 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAiMergeClick}
                  disabled={mergeInProgress}
                  aria-busy={mergeInProgress}
                  className="gap-1.5 min-w-30"
                >
                  {mergeInProgress ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  {mergeInProgress ? t('pool.aiMergeRunning') : t('pool.aiMerge')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {displayItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {displayPool.status === 'draft'
                ? 'Open the pool to start receiving questions.'
                : t('question.noQuestions')}
            </p>
          ) : (
            <div className="space-y-2">
              {displayItems.map((item: DisplayItem, i: number) => {
                const key = displayItemKey(item);
                const text = item.kind === 'cluster' ? item.unifiedText : item.originalText;
                const voteCount = voteCounts[key] ?? item.voteCount;
                const authorLabel =
                  item.kind === 'question'
                    ? (item.participant.isAnonymous ? t('participant.anonymous') : item.participant.displayName)
                    : t('question.mergedBadge');
                return (
                  <div key={key} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center min-w-[40px]">
                      <span className="text-xs text-muted-foreground">#{i + 1}</span>
                      <span className="text-lg font-bold text-primary">{voteCount}</span>
                      <span className="text-[10px] text-muted-foreground">votes</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{text}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{authorLabel}</span>
                      </div>
                      {item.kind === 'cluster' && item.sources && item.sources.length > 0 && (
                        <details className="mt-2 group">
                          <summary className="text-xs cursor-pointer list-none flex items-center gap-1.5 rounded-md -mx-1 px-1 py-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <ChevronDown
                              className="h-3.5 w-3.5 shrink-0 opacity-80 transition-transform duration-200 group-open:rotate-180"
                              aria-hidden
                            />
                            <span className="font-medium underline-offset-2 decoration-primary/60 group-open:underline">
                              {t('question.mergedSourcesToggle')}
                            </span>
                          </summary>
                          <ul className="mt-2 space-y-2 border-l-2 border-border pl-3" aria-label={t('question.mergedSources')}>
                            {item.sources.map((s) => (
                              <li key={s.id} className="text-xs">
                                <p className="text-sm text-foreground">{s.originalText}</p>
                                <p className="text-muted-foreground mt-0.5">
                                  {s.participant.isAnonymous ? t('participant.anonymous') : s.participant.displayName}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {typeof document !== 'undefined' &&
        createPortal(
          <>
            <button
              type="button"
              className={[
                'fixed left-0 top-0 z-50 h-dvh w-dvw bg-black/50 transition-opacity duration-300 ease-out',
                participantsPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
              ].join(' ')}
              aria-label={t('common.close')}
              onClick={() => setParticipantsPanelOpen(false)}
              tabIndex={participantsPanelOpen ? 0 : -1}
            />
            <aside
              className={[
                'fixed left-0 top-0 z-50 flex h-dvh w-dvw max-w-sm flex-col border-r border-border bg-background shadow-lg will-change-transform transition-[transform,opacity] duration-300 ease-out',
                participantsPanelOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none',
              ].join(' ')}
              aria-labelledby="connected-participants-title"
              aria-hidden={!participantsPanelOpen}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 id="connected-participants-title" className="text-lg font-semibold">
                  {t('pool.connectedParticipantsTitle')}
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={t('common.close')}
                  onClick={() => setParticipantsPanelOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                {participantRoster ? (
                  <>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">{t('pool.liveCount', { count: participantRoster.audienceConnected })}</p>
                      <p className="text-muted-foreground">
                        {t('pool.anonymousCountLabel', { count: participantRoster.anonymousCount })}
                      </p>
                    </div>
                    <Input
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                      placeholder={t('pool.searchParticipantsPlaceholder')}
                      aria-label={t('pool.searchParticipantsPlaceholder')}
                    />
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
                      {participantRoster.named.length === 0 && (
                        <p className="p-3 text-sm text-muted-foreground">{t('pool.rosterEmptyNamed')}</p>
                      )}
                      {participantRoster.named.length > 0 && filteredNamedParticipants.length === 0 && (
                        <p className="p-3 text-sm text-muted-foreground">{t('pool.rosterNoMatches')}</p>
                      )}
                      {participantRoster.named.length > 0 && filteredNamedParticipants.length > 0 && (
                        <ul className="divide-y divide-border">
                          {filteredNamedParticipants.map((n) => (
                            <li
                              key={n.id}
                              className={[
                                'flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm',
                                n.isHost
                                  ? 'border-l-2 border-l-primary/50 bg-muted/40'
                                  : '',
                              ].join(' ')}
                            >
                              <span className="min-w-0 flex-1 font-medium">{n.displayName}</span>
                              {n.isHost && (
                                <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                                  {t('pool.hostBadge')}
                                </Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('pool.rosterLoading')}</p>
                )}
              </div>
            </aside>
          </>,
          document.body,
        )}
    </div>
  );
}

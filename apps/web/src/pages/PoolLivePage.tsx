import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, Send, Users, Wifi, WifiOff, ClipboardList, LogOut } from 'lucide-react';
import { usePool, displayItemKey } from '@/hooks/usePool';
import api from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/auth.store';

type PollResultOpt = { id: string; text: string; responseCount?: number; _count?: { responses: number } };

function pollTotalResponses(pr: { totalResponses?: number; _count?: { responses: number } }): number {
  if (typeof pr.totalResponses === 'number') return pr.totalResponses;
  return pr._count?.responses ?? 0;
}

function pollOptionCount(opt: PollResultOpt): number {
  return typeof opt.responseCount === 'number' ? opt.responseCount : opt._count?.responses ?? 0;
}

export function PoolLivePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [poolCode, setPoolCode] = useState<string | null>(null);
  const [joinStep, setJoinStep] = useState<'loading' | 'identify' | 'joined'>('loading');
  const [displayName, setDisplayName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [accessKey, setAccessKey] = useState('');
  const [needsKey, setNeedsKey] = useState(false);
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [pollAnswer, setPollAnswer] = useState<string>('');
  const [pollFreeText, setPollFreeText] = useState('');

  const {
    connected,
    pool,
    displayItems,
    voteCounts,
    myVotes,
    liveAudienceCount,
    activePoll,
    pollResults,
    submitQuestion,
    voteDisplayItem,
    respondToPoll,
  } = usePool(poolCode);

  useEffect(() => {
    api
      .get(`/pools/public/${id}`)
      .then(({ data }) => {
        setPoolInfo(data);
        setNeedsKey(data.requiresAccessKey ?? (!data.isPublic && !!data.accessKey));
        setJoinStep('identify');
      })
      .catch(() => navigate('/join'));
  }, [id, navigate]);

  useEffect(() => {
    const name = user?.name?.trim();
    if (!name) return;
    setDisplayName((prev) => (prev.trim() === '' ? name : prev));
  }, [user?.name]);

  const handleJoin = async () => {
    if (!poolInfo) return;
    setError('');
    try {
      const { data } = await api.post(`/pools/${poolInfo.id}/join`, {
        displayName: isAnonymous ? null : displayName,
        isAnonymous,
        accessKey: needsKey ? accessKey : undefined,
      });
      localStorage.setItem('askora_session', data.sessionToken);
      setPoolCode(poolInfo.code);
      setJoinStep('joined');
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.error'));
    }
  };

  const handleLeavePool = () => {
    localStorage.removeItem('askora_session');
    navigate('/dashboard');
  };

  const handleSubmitQuestion = () => {
    if (!questionText.trim()) return;
    setSubmitting(true);
    submitQuestion(questionText.trim());
    setQuestionText('');
    setTimeout(() => setSubmitting(false), 500);
  };

  if (joinStep === 'loading' || !poolInfo) {
    return <p className="text-center py-16">{t('common.loading')}</p>;
  }

  if (joinStep === 'identify') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{poolInfo.title}</CardTitle>
            <CardDescription>{poolInfo.description}</CardDescription>
            <Badge variant="outline" className="mx-auto mt-2">{t(`pool.genres.${poolInfo.genre}`)}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-center">{t('participant.joinAs')}</p>

            {needsKey && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('pool.accessKey')}</label>
                <Input value={accessKey} onChange={(e) => setAccessKey(e.target.value)} />
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setIsAnonymous(true)}
                className={`w-full p-3 rounded-lg border text-left transition-colors cursor-pointer ${isAnonymous ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
              >
                <p className="font-medium">{t('participant.anonymous')}</p>
              </button>
              <button
                type="button"
                onClick={() => setIsAnonymous(false)}
                className={`w-full p-3 rounded-lg border text-left transition-colors cursor-pointer ${isAnonymous ? 'border-border hover:bg-muted' : 'border-primary bg-primary/5'}`}
              >
                <p className="font-medium">{t('participant.withName')}</p>
              </button>
            </div>

            {!isAnonymous && (
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('participant.enterName')} />
            )}

            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button onClick={handleJoin} className="w-full" disabled={!isAnonymous && !displayName}>
              {t('pool.join')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayPool = pool || poolInfo;
  const liveChannelOk = displayPool.status === 'active' && connected;
  const emptyStateMessage =
    displayPool.status === 'closed' ? t('pool.closedParticipantWait') : t('question.noQuestionsParticipant');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{displayPool.title}</h1>
          <p className="text-sm text-muted-foreground">
            by {displayPool.creator?.name || 'Unknown'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="leave"
            size="sm"
            className="gap-1.5"
            onClick={handleLeavePool}
            aria-label={t('pool.leave')}
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            {t('pool.leave')}
          </Button>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {liveAudienceCount}
          </Badge>
          <Badge variant={displayPool.status === 'active' ? 'success' : 'secondary'}>
            {t(`pool.${displayPool.status}`)}
          </Badge>
          {liveChannelOk ? (
            <Wifi className="h-4 w-4 text-green-500" aria-hidden />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" aria-hidden />
          )}
        </div>
      </div>

      {displayPool.status === 'active' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder={t('question.placeholder')}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitQuestion()}
                disabled={submitting}
              />
              <Button onClick={handleSubmitQuestion} disabled={!questionText.trim() || submitting} className="gap-1.5">
                <Send className="h-4 w-4" />
                {t('question.submit')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activePoll && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {t('quickPoll.badgeLabel')}
                </Badge>
                <ClipboardList className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              </div>
              <CardTitle className="text-lg leading-snug">{activePoll.questionText}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activePoll.type === 'multiple_choice' ? (
              <>
                <div
                  role="radiogroup"
                  aria-label={t('quickPoll.title')}
                  className="space-y-2"
                >
                  {activePoll.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={pollAnswer === opt.id}
                      onClick={() => setPollAnswer(opt.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors cursor-pointer ${pollAnswer === opt.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                    >
                      {opt.text}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => {
                    respondToPoll(activePoll.id, pollAnswer);
                    setPollAnswer('');
                  }}
                  disabled={!pollAnswer}
                  className="w-full"
                >
                  {t('quickPoll.submitAnswer')}
                </Button>
              </>
            ) : (
              <>
                <Textarea
                  value={pollFreeText}
                  onChange={(e) => setPollFreeText(e.target.value)}
                  placeholder={t('quickPoll.freeTextPlaceholder')}
                />
                <Button
                  onClick={() => {
                    respondToPoll(activePoll.id, undefined, pollFreeText);
                    setPollFreeText('');
                  }}
                  disabled={!pollFreeText.trim()}
                  className="w-full"
                >
                  {t('quickPoll.submitAnswer')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {!activePoll && pollResults && (
        <Card className="border-muted">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-normal">
                {t('quickPoll.badgeLabel')}
              </Badge>
              <CardTitle className="text-lg">{t('quickPoll.resultsTitle')}</CardTitle>
            </div>
            <CardDescription className="pt-1">{pollResults.questionText}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(pollResults.options ?? []).length > 0 ? (
              <ul className="space-y-3">
                {(pollResults.options ?? []).map((opt: PollResultOpt) => {
                  const n = pollOptionCount(opt);
                  const total = pollTotalResponses(pollResults);
                  const pct = total > 0 ? (n / total) * 100 : 0;
                  return (
                    <li key={opt.id} className="space-y-1">
                      <div className="flex justify-between gap-2">
                        <span className="text-foreground">{opt.text}</span>
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
            ) : (
              <p className="text-muted-foreground">{t('quickPoll.textAnswersHidden')}</p>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              {t('quickPoll.totalResponses', { count: pollTotalResponses(pollResults) })}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {displayItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {emptyStateMessage}
            </CardContent>
          </Card>
        ) : (
          displayItems.map((item) => {
            const key = displayItemKey(item);
            const text = item.kind === 'cluster' ? item.unifiedText : item.originalText;
            let authorLabel: string;
            if (item.kind === 'question') {
              authorLabel = item.participant.isAnonymous ? t('participant.anonymous') : item.participant.displayName;
            } else {
              authorLabel = t('question.mergedBadge');
            }
            return (
              <Card key={key} className="transition-all hover:shadow-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => voteDisplayItem(item)}
                    className={`flex flex-col items-center gap-0.5 min-w-[48px] pt-1 cursor-pointer transition-colors ${myVotes[key] ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                  >
                    <ThumbsUp className={`h-5 w-5 ${myVotes[key] ? 'fill-current' : ''}`} />
                    <span className="text-sm font-semibold">{voteCounts[key] ?? item.voteCount}</span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{text}</p>
                    <p className="text-xs text-muted-foreground mt-1">{authorLabel}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

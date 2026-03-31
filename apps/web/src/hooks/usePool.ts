import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

export type DisplayParticipant = { id: string; displayName: string | null; isAnonymous: boolean };

export type DisplayItem =
  | {
      kind: 'question';
      id: string;
      originalText: string;
      voteCount: number;
      createdAt: string;
      participant: DisplayParticipant;
    }
  | {
      kind: 'cluster';
      clusterId: string;
      unifiedText: string;
      voteCount: number;
      createdAt: string;
      sources?: Array<{ id: string; originalText: string; participant: DisplayParticipant }>;
    };

export interface Question {
  id: string;
  originalText: string;
  status: string;
  moderationStatus: string;
  moderationReason?: string;
  createdAt: string;
  participant: { id: string; displayName: string | null; isAnonymous: boolean };
  cluster?: { id: string; unifiedText: string } | null;
  _count: { votes: number };
}

export interface PoolState {
  id: string;
  code: string;
  title: string;
  description?: string;
  status: string;
  genre: string;
  creator: { id: string; name: string };
  lastQuestionMergeAt?: string | null;
  questionsSinceMerge?: number;
  showResolvedToParticipants?: boolean;
  /** healthy | degraded — from server when host joins */
  aiStatus?: 'healthy' | 'degraded';
  aiDegradedMode?: string | null;
  aiDegradedSince?: string | null;
}

export type AiDegradedMode = 'manual_approval' | 'wait_for_ai';

export interface PollData {
  id: string;
  questionText: string;
  type: string;
  showResultsToParticipants?: boolean;
  options: Array<{ id: string; text: string; position: number }>;
}

interface VoteState {
  [key: string]: number;
}

interface MyVotes {
  [key: string]: boolean;
}

export interface ParticipantRoster {
  connectedTotal: number;
  audienceConnected: number;
  anonymousCount: number;
  named: Array<{ id: string; displayName: string; isHost: boolean }>;
}

export function displayItemKey(item: DisplayItem): string {
  return item.kind === 'cluster' ? `c:${item.clusterId}` : `q:${item.id}`;
}

export interface SimilarityHint {
  scope: 'live' | 'resolved';
  kind: 'cluster' | 'question';
  id: string;
  previewText: string;
}

function voteCountsFromItems(items: DisplayItem[]): VoteState {
  const vc: VoteState = {};
  for (const it of items) {
    vc[displayItemKey(it)] = it.voteCount;
  }
  return vc;
}

export function usePool(poolCode: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [resolvedItems, setResolvedItems] = useState<DisplayItem[]>([]);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Question[]>([]);
  const [liveAudienceCount, setLiveAudienceCount] = useState(0);
  const [voteCounts, setVoteCounts] = useState<VoteState>({});
  const [myVotes, setMyVotes] = useState<MyVotes>({});
  const [activePoll, setActivePoll] = useState<PollData | null>(null);
  const [pollResults, setPollResults] = useState<any>(null);
  const [participantRoster, setParticipantRoster] = useState<ParticipantRoster | null>(null);
  const [pollLibraryRevision, setPollLibraryRevision] = useState(0);
  const [mergeInProgress, setMergeInProgress] = useState(false);
  const [similaritySubmitHint, setSimilaritySubmitHint] = useState<SimilarityHint | null>(null);
  const [pendingHostQuestions, setPendingHostQuestions] = useState<Question[]>([]);
  const [lastQuestionSubmitStatus, setLastQuestionSubmitStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!similaritySubmitHint) return;
    const timer = setTimeout(() => setSimilaritySubmitHint(null), 15000);
    return () => clearTimeout(timer);
  }, [similaritySubmitHint]);

  useEffect(() => {
    if (!poolCode) {
      setParticipantRoster(null);
      setLiveAudienceCount(0);
      setPollLibraryRevision(0);
      setMergeInProgress(false);
      setResolvedItems([]);
      setSimilaritySubmitHint(null);
      setPendingHostQuestions([]);
      setLastQuestionSubmitStatus(null);
      return;
    }

    setMergeInProgress(false);
    setParticipantRoster(null);
    setResolvedItems([]);
    setSimilaritySubmitHint(null);
    setPendingHostQuestions([]);
    setLastQuestionSubmitStatus(null);
    setLiveAudienceCount(0);
    setActivePoll(null);
    setPollResults(null);
    setPollLibraryRevision(0);

    const wsUrl = import.meta.env.VITE_WS_URL || '';
    const token = localStorage.getItem('askora_token');
    const sessionToken = localStorage.getItem('askora_session');

    const socket = io(wsUrl, {
      auth: { token: token || undefined, sessionToken: sessionToken || undefined },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('pool:join', { poolCode });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on(
      'pool:joined',
      (data: {
        pool: PoolState & {
          aiStatus?: 'healthy' | 'degraded';
          aiDegradedMode?: string | null;
          aiDegradedSince?: string | null;
        };
        ai?: {
          status: 'healthy' | 'degraded';
          degradedMode: string | null;
          degradedSince: string | null;
        };
        pendingHostQuestions?: Question[];
        displayItems: DisplayItem[];
        resolvedItems?: DisplayItem[];
        activePoll?: { poll: Omit<PollData, 'options'>; options: PollData['options'] } | null;
      }) => {
        const p = data.pool;
        const ai = data.ai;
        setPool({
          ...p,
          aiStatus: ai?.status ?? p.aiStatus ?? 'healthy',
          aiDegradedMode: ai?.degradedMode ?? p.aiDegradedMode ?? null,
          aiDegradedSince: ai?.degradedSince ?? p.aiDegradedSince ?? null,
        });
        setDisplayItems(data.displayItems);
        setResolvedItems(data.resolvedItems ?? []);
        setVoteCounts(voteCountsFromItems(data.displayItems));
        if (data.activePoll) {
          setActivePoll({ ...data.activePoll.poll, options: data.activePoll.options });
        } else {
          setActivePoll(null);
        }
        setPollResults(null);
        if (Array.isArray(data.pendingHostQuestions)) {
          setPendingHostQuestions(data.pendingHostQuestions);
        } else {
          setPendingHostQuestions([]);
        }
      },
    );

    socket.on('pool:status-changed', (data: { status: string }) => {
      setPool((p) => (p ? { ...p, status: data.status } : p));
    });

    socket.on(
      'ai:status-changed',
      (data: {
        status: 'healthy' | 'degraded';
        degradedMode: string | null;
        degradedSince: string | null;
      }) => {
        setPool((p) =>
          p
            ? {
                ...p,
                aiStatus: data.status,
                aiDegradedMode: data.degradedMode,
                aiDegradedSince: data.degradedSince,
              }
            : p,
        );
      },
    );

    socket.on(
      'question:pending-host-decision',
      (data: { question: Question; moderationStatus: string }) => {
        setPendingHostQuestions((prev) => {
          if (prev.some((q) => q.id === data.question.id)) return prev;
          return [data.question, ...prev];
        });
      },
    );

    socket.on('question:pending-host-resolved', (data: { questionId: string }) => {
      setPendingHostQuestions((prev) => prev.filter((q) => q.id !== data.questionId));
    });

    socket.on('question:new', (data: { displayItem: DisplayItem }) => {
      const item = data.displayItem;
      const key = displayItemKey(item);
      setDisplayItems((prev) => {
        if (prev.some((x) => displayItemKey(x) === key)) return prev;
        return [item, ...prev];
      });
      setVoteCounts((prev) => ({ ...prev, [key]: item.voteCount }));
    });

    socket.on(
      'question:vote-updated',
      (data: {
        targetKind: 'question' | 'cluster';
        targetId: string;
        voteCount: number;
        voted: boolean;
      }) => {
        const key = data.targetKind === 'cluster' ? `c:${data.targetId}` : `q:${data.targetId}`;
        setVoteCounts((prev) => ({ ...prev, [key]: data.voteCount }));
      },
    );

    socket.on(
      'questions:merged-sync',
      (data: {
        displayItems: DisplayItem[];
        resolvedItems?: DisplayItem[];
        pool: {
          lastQuestionMergeAt: string | null;
          questionsSinceMerge: number;
          showResolvedToParticipants?: boolean;
        };
      }) => {
        setDisplayItems(data.displayItems);
        setResolvedItems(data.resolvedItems ?? []);
        setVoteCounts(voteCountsFromItems(data.displayItems));
        setPool((p) =>
          p
            ? {
                ...p,
                lastQuestionMergeAt: data.pool.lastQuestionMergeAt,
                questionsSinceMerge: data.pool.questionsSinceMerge,
                ...(typeof data.pool.showResolvedToParticipants === 'boolean'
                  ? { showResolvedToParticipants: data.pool.showResolvedToParticipants }
                  : {}),
              }
            : p,
        );
        setMergeInProgress(false);
      },
    );

    socket.on('llm:merge-completed', () => {
      setMergeInProgress(false);
    });

    socket.on('error', (data: { message?: string }) => {
      setMergeInProgress(false);
      if (data?.message === 'Unauthorized') {
        const freshToken = localStorage.getItem('askora_token');
        if (freshToken && socket.auth) {
          (socket.auth as Record<string, unknown>).token = freshToken;
          socket.disconnect().connect();
        }
      }
    });

    socket.on('question:flagged', (data: { question: Question; moderationStatus: string; reason: string }) => {
      setFlaggedQuestions((prev) => [data.question, ...prev]);
    });

    socket.on(
      'question:submitted',
      (data: { status: string; similarityHint?: SimilarityHint }) => {
        setLastQuestionSubmitStatus(data.status);
        if (data.status === 'ok' && data.similarityHint) {
          setSimilaritySubmitHint(data.similarityHint);
        }
      },
    );

    socket.on('question:moderated', (data: { questionId: string; action: string }) => {
      setFlaggedQuestions((prev) => prev.filter((q) => q.id !== data.questionId));
      setPendingHostQuestions((prev) => prev.filter((q) => q.id !== data.questionId));
    });

    socket.on('participants:live-count', (data: { audienceConnected: number }) => {
      setLiveAudienceCount(data.audienceConnected);
    });

    socket.on('participants:roster', (data: ParticipantRoster) => {
      setParticipantRoster(data);
    });

    socket.on('poll:launched', (data: { poll: Omit<PollData, 'options'>; options: PollData['options'] }) => {
      setPollLibraryRevision((r) => r + 1);
      setPollResults(null);
      setActivePoll({ ...data.poll, options: data.options });
    });

    socket.on(
      'poll:closed',
      (data: { pollId: string; showResultsToParticipants?: boolean; results: any }) => {
        setPollLibraryRevision((r) => r + 1);
        setActivePoll(null);
        setPollResults(data.results ?? null);
      },
    );

    socket.on('poll:created', () => {
      setPollLibraryRevision((r) => r + 1);
    });

    socket.on('poll:response-received', (data: { pollId: string; results: any }) => {
      setPollResults(data.results);
    });

    return () => {
      socket.off('participants:roster');
      socket.off('participants:live-count');
      socket.disconnect();
      socketRef.current = null;
      setParticipantRoster(null);
    };
  }, [poolCode]);

  const dismissSimilarityHint = useCallback(() => setSimilaritySubmitHint(null), []);

  const dismissLastQuestionSubmitStatus = useCallback(() => setLastQuestionSubmitStatus(null), []);

  const submitQuestion = useCallback((text: string) => {
    setLastQuestionSubmitStatus(null);
    socketRef.current?.emit('question:submit', { text });
  }, []);

  const setAiDegradedMode = useCallback((mode: AiDegradedMode) => {
    socketRef.current?.emit('pool:set-ai-degraded-mode', { mode });
  }, []);

  const voteDisplayItem = useCallback((item: DisplayItem) => {
    const key = displayItemKey(item);
    setMyVotes((prev) => ({ ...prev, [key]: !prev[key] }));
    if (item.kind === 'cluster') {
      socketRef.current?.emit('question:vote', { clusterId: item.clusterId });
    } else {
      socketRef.current?.emit('question:vote', { questionId: item.id });
    }
  }, []);

  const updateStatus = useCallback((status: string) => {
    socketRef.current?.emit('pool:update-status', { status });
  }, []);

  const moderateQuestion = useCallback((questionId: string, action: 'approve' | 'reject') => {
    socketRef.current?.emit('question:moderate', { questionId, action });
  }, []);

  const markDisplayItemAnswered = useCallback((item: DisplayItem) => {
    if (item.kind === 'cluster') {
      socketRef.current?.emit('display-item:mark-answered', { clusterId: item.clusterId });
    } else {
      socketRef.current?.emit('display-item:mark-answered', { questionId: item.id });
    }
  }, []);

  const setShowResolvedToParticipants = useCallback((value: boolean) => {
    socketRef.current?.emit('pool:set-show-resolved', { showResolvedToParticipants: value });
  }, []);

  const triggerMerge = useCallback(() => {
    if (!socketRef.current) return;
    setMergeInProgress(true);
    socketRef.current.emit('llm:trigger-merge', {});
  }, []);

  const createPoll = useCallback(
    (
      questionText: string,
      type: string,
      options?: string[],
      showResultsToParticipants?: boolean,
      asDraft?: boolean,
    ) => {
      socketRef.current?.emit('poll:create', {
        questionText,
        type,
        options,
        showResultsToParticipants,
        asDraft,
      });
    },
    [],
  );

  const launchPoll = useCallback((pollId: string) => {
    socketRef.current?.emit('poll:launch', { pollId });
  }, []);

  const respondToPoll = useCallback((pollId: string, pollOptionId?: string, freeText?: string) => {
    socketRef.current?.emit('poll:respond', { pollId, pollOptionId, freeText });
  }, []);

  const closePoll = useCallback((pollId: string) => {
    socketRef.current?.emit('poll:close', { pollId });
  }, []);

  const sortedDisplayItems = useMemo(() => {
    return [...displayItems].sort((a, b) => {
      const ka = displayItemKey(a);
      const kb = displayItemKey(b);
      const va = voteCounts[ka] ?? a.voteCount;
      const vb = voteCounts[kb] ?? b.voteCount;
      if (vb !== va) return vb - va;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [displayItems, voteCounts]);

  const sortedResolvedItems = useMemo(() => {
    return [...resolvedItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [resolvedItems]);

    return {
    connected,
    pool,
    displayItems: sortedDisplayItems,
    resolvedItems: sortedResolvedItems,
    flaggedQuestions,
    pendingHostQuestions,
    lastQuestionSubmitStatus,
    dismissLastQuestionSubmitStatus,
    liveAudienceCount,
    participantRoster,
    voteCounts,
    myVotes,
    activePoll,
    pollResults,
    pollLibraryRevision,
    mergeInProgress,
    similaritySubmitHint,
    dismissSimilarityHint,
    submitQuestion,
    voteDisplayItem,
    updateStatus,
    moderateQuestion,
    setAiDegradedMode,
    markDisplayItemAnswered,
    setShowResolvedToParticipants,
    triggerMerge,
    createPoll,
    launchPoll,
    respondToPoll,
    closePoll,
  };
}

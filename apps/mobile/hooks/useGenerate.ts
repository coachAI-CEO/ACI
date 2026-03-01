import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { generateDrill } from '../services/drill.service';
import { generateSeries } from '../services/series.service';
import { cancelGeneration, generateSession } from '../services/session.service';
import { useGenerateStore } from '../stores/generate.store';

const PROGRESS_MESSAGES = [
  'Analyzing tactical context...',
  'Building warmup drills...',
  'Creating technical phase...',
  'Adding tactical exercises...',
  'Running quality checks...',
  'Finalizing session...',
];

export function useGenerate() {
  const activeType = useGenerateStore((s) => s.activeType);
  const form = useGenerateStore((s) => s.form);
  const setLatestDrill = useGenerateStore((s) => s.setLatestDrill);
  const setLatestSession = useGenerateStore((s) => s.setLatestSession);
  const setLatestSeries = useGenerateStore((s) => s.setLatestSeries);

  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState(PROGRESS_MESSAGES[0]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      setTimedOut(false);
      const currentGenerationId = `gen_${Date.now()}`;
      setGenerationId(currentGenerationId);
      const progressInterval = setInterval(() => {
        setProgress((current) => {
          const next = Math.min(current + Math.random() * 9, 92);
          const idx = Math.min(Math.floor(next / 16), PROGRESS_MESSAGES.length - 1);
          setProgressMessage(PROGRESS_MESSAGES[idx]);
          return next;
        });
      }, 1200);

      try {
        if (activeType === 'drill') {
          const result = await generateDrill(form);
          setLatestDrill(result?.drill || result);
          return { type: 'drill' as const, result };
        }

        if (activeType === 'series') {
          const result = await generateSeries(form);
          setLatestSeries(result?.series || result);
          return { type: 'series' as const, result };
        }

        const result = await generateSession(form, currentGenerationId);
        setLatestSession(result?.session || result);
        return { type: 'session' as const, result };
      } finally {
        clearInterval(progressInterval);
      }
    },
    onSuccess: (payload) => {
      setProgress(100);
      if (payload.type === 'drill') {
        router.push('/session/drill/result');
        return;
      }
      if (payload.type === 'series') {
        router.push('/series/result');
        return;
      }
      router.push('/session/result');
    },
    onSettled: () => {
      setTimeout(() => {
        setProgress(0);
        setProgressMessage(PROGRESS_MESSAGES[0]);
        setTimedOut(false);
      }, 300);
    },
  });

  useEffect(() => {
    if (!mutation.isPending) {
      return;
    }
    const timeoutId = setTimeout(() => {
      setTimedOut(true);
      setProgressMessage('Generation is taking longer than expected.');
    }, 120_000);
    return () => clearTimeout(timeoutId);
  }, [mutation.isPending]);

  const canGenerate = useMemo(() => {
    return Boolean(form.ageGroup && form.gameModelId && form.playerLevel && form.coachLevel);
  }, [form]);

  const cancel = async () => {
    if (generationId) {
      await cancelGeneration(generationId);
    }
  };

  return {
    generate: mutation.mutateAsync,
    cancel,
    canGenerate,
    isGenerating: mutation.isPending,
    error: mutation.error as { message?: string } | null,
    progress,
    progressMessage,
    timedOut,
  };
}

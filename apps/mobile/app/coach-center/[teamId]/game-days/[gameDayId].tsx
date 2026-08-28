import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../../components/ui/Button';
import { ErrorMessage } from '../../../../components/ui/ErrorMessage';
import { Input } from '../../../../components/ui/Input';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { colors } from '../../../../constants/colors';
import { webPath } from '../../../../constants/web';
import { describeApiError } from '../../../../services/api';
import {
  downloadGameDayPdf,
  listGameDays,
  updateGameDay,
  type GameDayItem,
  type MatchRecapLite,
} from '../../../../services/coach-center.service';
import { sharePdfArrayBuffer } from '../../../../utils/share-pdf';

export default function GameDayDetailScreen() {
  const { teamId, gameDayId } = useLocalSearchParams<{ teamId: string; gameDayId: string }>();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [usScore, setUsScore] = useState('0');
  const [themScore, setThemScore] = useState('0');
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [proudOf, setProudOf] = useState('');

  const query = useQuery({
    queryKey: ['coach-center', 'game-days', teamId],
    queryFn: () => listGameDays(String(teamId)),
    enabled: Boolean(teamId),
  });

  const item = useMemo(
    () => (query.data || []).find((entry: GameDayItem) => entry.id === gameDayId) || null,
    [query.data, gameDayId]
  );

  const recap = item?.recap || null;

  useEffect(() => {
    if (!item) return;
    const next = item.recap;
    if (next) {
      setUsScore(String(next.usScore ?? 0));
      setThemScore(String(next.themScore ?? 0));
      setHeadline(next.headline || '');
      setSummary(next.summary || '');
      setProudOf(next.proudOf || '');
      return;
    }
    setHeadline('');
    setSummary('');
    setProudOf('');
    setUsScore('0');
    setThemScore('0');
  }, [item]);

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (query.error || !item) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ErrorMessage message={describeApiError(query.error, 'Game day not found.')} />
          <Button title="Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const onShareSummary = async () => {
    await Share.share({
      message: [
        `Game day vs ${item.opponent || 'opponent'}`,
        item.matchDate ? new Date(item.matchDate).toLocaleString() : '',
        item.venue || '',
        item.keyFocus || '',
        recap?.headline ? `Recap: ${recap.headline}` : '',
        recap ? `Score ${recap.usScore ?? 0}-${recap.themScore ?? 0}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
  };

  const onSharePdf = async () => {
    setBusy('pdf');
    setError(null);
    try {
      const buffer = await downloadGameDayPdf(String(teamId), String(gameDayId));
      await sharePdfArrayBuffer(buffer, `game-day-${gameDayId}.pdf`);
    } catch (err) {
      setError(describeApiError(err, 'Could not share PDF.'));
    } finally {
      setBusy(null);
    }
  };

  const onSaveRecap = async () => {
    setBusy('recap');
    setError(null);
    setStatus(null);
    try {
      const nextRecap: MatchRecapLite = {
        ...(recap || {}),
        type: 'MATCH_RECAP',
        usScore: Number(usScore) || 0,
        themScore: Number(themScore) || 0,
        headline: headline.trim() || 'Match recap',
        summary: summary.trim(),
        proudOf: proudOf.trim(),
        opponentLabel: item.opponent || recap?.opponentLabel || 'Opponent',
        location: item.venue || recap?.location || '',
      };
      await updateGameDay(String(teamId), String(gameDayId), { recap: nextRecap });
      await queryClient.invalidateQueries({ queryKey: ['coach-center', 'game-days', teamId] });
      setStatus('Recap saved.');
    } catch (err) {
      setError(describeApiError(err, 'Could not save recap.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{item.opponent || 'Game day'}</Text>
        <Text style={styles.subtitle}>
          {new Date(item.matchDate).toLocaleString()}
          {item.kickoffTime ? ` · ${item.kickoffTime}` : ''}
        </Text>
        {item.venue ? <Text style={styles.meta}>{item.venue}</Text> : null}
        {item.competition ? <Text style={styles.meta}>{item.competition}</Text> : null}
        {item.formation ? <Text style={styles.meta}>Formation: {item.formation}</Text> : null}

        {item.keyFocus ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Key focus</Text>
            <Text style={styles.body}>{item.keyFocus}</Text>
          </View>
        ) : null}
        {item.attackingNotes ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Attacking</Text>
            <Text style={styles.body}>{item.attackingNotes}</Text>
          </View>
        ) : null}
        {item.defendingNotes ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Defending</Text>
            <Text style={styles.body}>{item.defendingNotes}</Text>
          </View>
        ) : null}
        {item.setPieces ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Set pieces</Text>
            <Text style={styles.body}>{item.setPieces}</Text>
          </View>
        ) : null}

        {recap?.headline || recap?.summary ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Saved recap</Text>
            <Text style={styles.score}>
              {recap?.usScore ?? 0} – {recap?.themScore ?? 0}
            </Text>
            {recap?.headline ? <Text style={styles.body}>{recap.headline}</Text> : null}
            {recap?.summary ? <Text style={styles.meta}>{recap.summary}</Text> : null}
            {recap?.proudOf ? <Text style={styles.meta}>Proud of: {recap.proudOf}</Text> : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Match recap</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreField}>
              <Input label="Us" value={usScore} onChangeText={setUsScore} keyboardType="default" />
            </View>
            <View style={styles.scoreField}>
              <Input label="Them" value={themScore} onChangeText={setThemScore} keyboardType="default" />
            </View>
          </View>
          <Input label="Headline" value={headline} onChangeText={setHeadline} placeholder="A strong start" />
          <Input label="Summary" value={summary} onChangeText={setSummary} placeholder="What stood out" />
          <Input label="Proud of" value={proudOf} onChangeText={setProudOf} placeholder="Team effort" />
          <Button title="Save recap" onPress={() => void onSaveRecap()} loading={busy === 'recap'} />
        </View>

        {error ? <ErrorMessage message={error} /> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Button title="Share summary" onPress={() => void onShareSummary()} />
        <Button title="Share PDF" onPress={() => void onSharePdf()} loading={busy === 'pdf'} variant="secondary" />
        <Button
          title="Edit pack on web"
          onPress={() => void Linking.openURL(webPath('/coach-center/game-day'))}
          variant="secondary"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  container: { gap: 12, padding: 16, paddingBottom: 28 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.muted },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  body: { color: colors.text, fontSize: 13, lineHeight: 19 },
  score: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  scoreRow: { flexDirection: 'row', gap: 10 },
  scoreField: { flex: 1 },
  status: { color: colors.primary, fontWeight: '600' },
});

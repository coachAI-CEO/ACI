import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../../components/ui/Button';
import { ErrorMessage } from '../../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { colors } from '../../../../constants/colors';
import { webPath } from '../../../../constants/web';
import { describeApiError } from '../../../../services/api';
import { downloadGameDayPdf, listGameDays, type GameDayItem } from '../../../../services/coach-center.service';
import { sharePdfArrayBuffer } from '../../../../utils/share-pdf';

export default function GameDayDetailScreen() {
  const { teamId, gameDayId } = useLocalSearchParams<{ teamId: string; gameDayId: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['coach-center', 'game-days', teamId],
    queryFn: () => listGameDays(String(teamId)),
    enabled: Boolean(teamId),
  });

  const item = useMemo(
    () => (query.data || []).find((entry: GameDayItem) => entry.id === gameDayId) || null,
    [query.data, gameDayId]
  );

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
      ]
        .filter(Boolean)
        .join('\n'),
    });
  };

  const onSharePdf = async () => {
    setBusy(true);
    setError(null);
    try {
      const buffer = await downloadGameDayPdf(String(teamId), String(gameDayId));
      await sharePdfArrayBuffer(buffer, `game-day-${gameDayId}.pdf`);
    } catch (err) {
      setError(describeApiError(err, 'Could not share PDF.'));
    } finally {
      setBusy(false);
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

        {error ? <ErrorMessage message={error} /> : null}

        <Button title="Share summary" onPress={() => void onShareSummary()} />
        <Button title="Share PDF" onPress={() => void onSharePdf()} loading={busy} variant="secondary" />
        <Button
          title="Open on web"
          onPress={() => void Linking.openURL(webPath(`/coach-center/game-day`))}
          variant="secondary"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  container: { gap: 12, padding: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.muted },
  meta: { color: colors.muted, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  body: { color: colors.text, fontSize: 13, lineHeight: 19 },
});

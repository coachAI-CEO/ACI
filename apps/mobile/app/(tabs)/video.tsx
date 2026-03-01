import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Input } from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { deleteVideoAnalysis, listVideoAnalyses, runVideoAnalysis, saveVideoAnalysis } from '../../services/video-analysis.service';
import { useVideoStore } from '../../stores/video.store';

const TEAM_COLORS = ['blue', 'red', 'white', 'black', 'yellow', 'green'] as const;

function Selector({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.selectorWrap}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <View style={styles.selectorRow}>
        {options.map((option) => (
          <Text
            key={`${label}-${option}`}
            onPress={() => onChange(option)}
            style={[styles.selectorChip, value === option ? styles.selectorChipActive : null]}
          >
            {option.replaceAll('_', ' ')}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function VideoTab() {
  const { isOnline } = useNetworkStatus();
  const setLatestAnalysis = useVideoStore((s) => s.setLatestAnalysis);

  const [ageGroup, setAgeGroup] = useState('U14 Boys');
  const [playerLevel, setPlayerLevel] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('INTERMEDIATE');
  const [coachLevel, setCoachLevel] = useState<'GRASSROOTS' | 'USSF_C' | 'USSF_B_PLUS'>('USSF_C');
  const [formationUsed, setFormationUsed] = useState('4-3-3');
  const [gameModelId, setGameModelId] = useState<'COACHAI' | 'POSSESSION' | 'PRESSING' | 'TRANSITION'>('PRESSING');
  const [phase, setPhase] = useState<'ATTACKING' | 'DEFENDING' | 'TRANSITION'>('ATTACKING');
  const [zone, setZone] = useState<'DEFENSIVE_THIRD' | 'MIDDLE_THIRD' | 'ATTACKING_THIRD'>('MIDDLE_THIRD');
  const [focusTeamColor, setFocusTeamColor] = useState<'blue' | 'red' | 'white' | 'black' | 'yellow' | 'green'>('red');
  const [opponentTeamColor, setOpponentTeamColor] = useState<'blue' | 'red' | 'white' | 'black' | 'yellow' | 'green'>('blue');
  const [fileUri, setFileUri] = useState<string>('');
  const [dryRun, setDryRun] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const runRequestIdRef = useRef(0);

  const analysesQuery = useQuery({
    queryKey: ['video', 'vault'],
    queryFn: () => listVideoAnalyses(20),
  });

  const canRun = useMemo(() => {
    if (!isOnline) {
      return false;
    }
    if (dryRun) {
      return true;
    }
    return Boolean(fileUri.trim());
  }, [dryRun, fileUri, isOnline]);

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Media library permission is needed to select a video.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: 90,
    });

    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri);
      setDryRun(false);
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera permission is needed to record a video.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: 90,
    });

    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri);
      setDryRun(false);
    }
  };

  const run = async () => {
    runRequestIdRef.current += 1;
    const requestId = runRequestIdRef.current;
    setError(null);
    setStatus('Analyzing...');
    setIsRunning(true);
    const timeoutId = setTimeout(() => {
      if (runRequestIdRef.current !== requestId) {
        return;
      }
      Alert.alert('Analysis taking longer than usual', 'Keep waiting or cancel?', [
        { text: 'Keep Waiting', style: 'default' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            if (runRequestIdRef.current !== requestId) return;
            runRequestIdRef.current += 1;
            setIsRunning(false);
            setStatus('Analysis cancelled.');
          },
        },
      ]);
    }, 240_000);
    try {
      const payload = await runVideoAnalysis({
        ageGroup,
        playerLevel,
        coachLevel,
        formationUsed,
        gameModelId,
        phase,
        zone,
        focusTeamColor,
        opponentTeamColor,
        fileUri: fileUri || undefined,
        dryRun,
      });

      setLatestAnalysis(payload.analysis || payload, {
        ageGroup,
        playerLevel,
        coachLevel,
        formationUsed,
        gameModelId,
        phase,
        zone,
        focusTeamColor,
        opponentTeamColor,
        sourceFileUri: fileUri || undefined,
        fileUriUsed: payload.fileUriUsed,
      });
      if (runRequestIdRef.current !== requestId) {
        return;
      }
      setStatus(payload.cached ? 'Loaded cached analysis.' : dryRun ? 'Dry run complete.' : 'Analysis complete.');
      router.push('/video/result');
    } catch (err) {
      if (runRequestIdRef.current !== requestId) {
        return;
      }
      setError((err as { message?: string }).message || 'Video analysis failed.');
      setStatus(null);
    } finally {
      clearTimeout(timeoutId);
      if (runRequestIdRef.current === requestId) {
        setIsRunning(false);
      }
    }
  };

  const saveLatest = async () => {
    const current = useVideoStore.getState();
    if (!current.latestAnalysis || !current.latestContext) {
      setError('Run an analysis first before saving.');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await saveVideoAnalysis({
        ageGroup,
        playerLevel,
        coachLevel,
        gameModelId,
        phase,
        zone,
        focusTeamColor,
        opponentTeamColor,
        sourceFileUri: fileUri || undefined,
        fileUriUsed: String((current.latestContext as any)?.fileUriUsed || '' || undefined),
        analysis: current.latestAnalysis,
        context: current.latestContext,
      });
      setStatus('Saved to video vault.');
      analysesQuery.refetch().catch(() => undefined);
    } catch (err) {
      setError((err as { message?: string }).message || 'Could not save analysis.');
    } finally {
      setIsSaving(false);
    }
  };

  const removeAnalysis = async (id: string) => {
    await deleteVideoAnalysis(id);
    analysesQuery.refetch().catch(() => undefined);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Video Analysis</Text>
        <Text style={styles.subtitle}>
          {isOnline
            ? 'Run tactical analysis from match clips and save findings.'
            : 'Video analysis requires an internet connection.'}
        </Text>

        <View style={styles.actionRow}>
          <Button title="Pick Video" onPress={() => void pickFromLibrary()} variant="secondary" />
          <Button title="Record" onPress={() => void pickFromCamera()} variant="secondary" />
        </View>

        <Input label="Video URI (optional for dry run)" value={fileUri} onChangeText={setFileUri} placeholder="file://... or https://..." />

        <View style={styles.actionRow}>
          <Button
            title={dryRun ? 'Dry Run: ON' : 'Dry Run: OFF'}
            onPress={() => setDryRun((v) => !v)}
            variant="secondary"
          />
          <Button title="Save Latest" onPress={() => void saveLatest()} loading={isSaving} variant="secondary" />
        </View>

        <Selector label="Player Level" value={playerLevel} options={['BEGINNER', 'INTERMEDIATE', 'ADVANCED']} onChange={(v) => setPlayerLevel(v as any)} />
        <Selector label="Coach Level" value={coachLevel} options={['GRASSROOTS', 'USSF_C', 'USSF_B_PLUS']} onChange={(v) => setCoachLevel(v as any)} />
        <Selector label="Game Model" value={gameModelId} options={['COACHAI', 'POSSESSION', 'PRESSING', 'TRANSITION']} onChange={(v) => setGameModelId(v as any)} />
        <Selector label="Phase" value={phase} options={['ATTACKING', 'DEFENDING', 'TRANSITION']} onChange={(v) => setPhase(v as any)} />
        <Selector label="Zone" value={zone} options={['DEFENSIVE_THIRD', 'MIDDLE_THIRD', 'ATTACKING_THIRD']} onChange={(v) => setZone(v as any)} />
        <Selector label="Focus Team" value={focusTeamColor} options={TEAM_COLORS} onChange={(v) => setFocusTeamColor(v as any)} />
        <Selector label="Opponent" value={opponentTeamColor} options={TEAM_COLORS} onChange={(v) => setOpponentTeamColor(v as any)} />

        <Input label="Age Group" value={ageGroup} onChangeText={setAgeGroup} placeholder="U14 Boys" />
        <Input label="Formation" value={formationUsed} onChangeText={setFormationUsed} placeholder="4-3-3" />

        {status ? <Text style={styles.status}>{status}</Text> : null}
        {error ? <ErrorMessage message={error} /> : null}

        <Button title="Run Analysis" onPress={() => void run()} loading={isRunning} disabled={!canRun || isRunning} />

        <View style={styles.vaultSection}>
          <Text style={styles.vaultTitle}>Saved Analyses</Text>
          {(analysesQuery.data || []).map((item: any) => (
            <View key={item.id} style={styles.savedRow}>
              <View style={styles.savedMeta}>
                <Text style={styles.savedRef}>{item.refCode || 'VA'}</Text>
                <Text style={styles.savedTitle}>{item.title || 'Video Analysis'}</Text>
              </View>
              <Text style={styles.savedDelete} onPress={() => void removeAnalysis(item.id)}>
                Delete
              </Text>
            </View>
          ))}
          {!analysesQuery.data?.length ? <Text style={styles.empty}>No saved analyses yet.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    gap: 12,
    padding: 14,
    paddingBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorWrap: {
    gap: 6,
  },
  selectorLabel: {
    color: colors.muted,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectorChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.muted,
    fontSize: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  selectorChipActive: {
    borderColor: colors.primary,
    color: colors.primary,
    fontWeight: '700',
  },
  status: {
    color: colors.primary,
    fontWeight: '600',
  },
  vaultSection: {
    gap: 8,
    marginTop: 6,
  },
  vaultTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  savedRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  savedMeta: {
    flex: 1,
    paddingRight: 10,
  },
  savedRef: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  savedTitle: {
    color: colors.text,
    fontSize: 14,
  },
  savedDelete: {
    color: colors.danger,
    fontWeight: '600',
  },
  empty: {
    color: colors.muted,
  },
});

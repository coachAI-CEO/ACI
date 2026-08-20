import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '../../constants/colors';
import { describeApiError } from '../../services/api';
import { getDrillDiagramSvg } from '../../services/diagram-svg.service';

type Props = {
  drillId?: string | null;
  height?: number;
  fallback?: ReactNode;
};

export function StoredDrillDiagram({ drillId, height = 220, fallback }: Props) {
  const query = useQuery({
    queryKey: ['diagram-svg', drillId],
    queryFn: () => getDrillDiagramSvg(String(drillId)),
    enabled: Boolean(drillId),
    retry: 1,
  });

  if (!drillId) {
    return <>{fallback || <Text style={styles.muted}>Diagram unavailable until the drill is saved.</Text>}</>;
  }

  if (query.isLoading) {
    return (
      <View style={[styles.box, { height }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (query.error) {
    return (
      <View style={[styles.box, { height: Math.min(height, 80) }]}>
        <Text style={styles.muted}>{describeApiError(query.error, 'Could not load diagram.')}</Text>
      </View>
    );
  }

  if (query.data?.cooldown) {
    return <Text style={styles.muted}>Cooldown drills do not include a pitch diagram.</Text>;
  }

  if (!query.data?.svg) {
    return <>{fallback || <Text style={styles.muted}>No stored diagram yet.</Text>}</>;
  }

  return (
    <View style={[styles.box, { height }]}>
      <SvgXml xml={query.data.svg} width="100%" height="100%" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    backgroundColor: '#0a0d10',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
  },
});

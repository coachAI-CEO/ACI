import { useQuery } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '../../constants/colors';
import { describeApiError } from '../../services/api';
import { getDrillDiagramSvg } from '../../services/diagram-svg.service';
import { fitSidelineDiagramSvg } from '../../utils/fit-sideline-diagram';

type Props = {
  drillId?: string | null;
  /** Prefer embedded SVG when the parent already has it (session payload). */
  svg?: string | null;
  height?: number;
  fallback?: ReactNode;
};

export function StoredDrillDiagram({ drillId, svg: embeddedSvg, height = 220, fallback }: Props) {
  const query = useQuery({
    queryKey: ['diagram-svg', drillId],
    queryFn: () => getDrillDiagramSvg(String(drillId)),
    enabled: Boolean(drillId) && !embeddedSvg,
    retry: 1,
  });

  const rawSvg = embeddedSvg || query.data?.svg || null;
  const fitted = useMemo(
    () => (rawSvg ? fitSidelineDiagramSvg(rawSvg) : null),
    [rawSvg]
  );

  if (!drillId && !embeddedSvg) {
    return <>{fallback || <Text style={styles.muted}>Diagram unavailable until the drill is saved.</Text>}</>;
  }

  if (!embeddedSvg && query.isLoading) {
    return (
      <View style={[styles.box, { height }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!embeddedSvg && query.error) {
    return (
      <View style={[styles.box, { height: Math.min(height, 80) }]}>
        <Text style={styles.muted}>{describeApiError(query.error, 'Could not load diagram.')}</Text>
      </View>
    );
  }

  if (!embeddedSvg && query.data?.cooldown) {
    return <Text style={styles.muted}>Cooldown drills do not include a pitch diagram.</Text>;
  }

  if (!fitted?.svg) {
    return <>{fallback || <Text style={styles.muted}>No stored diagram yet.</Text>}</>;
  }

  return (
    <View style={[styles.box, { height }]}>
      <View style={styles.zoom}>
        <SvgXml
          key={`${drillId || 'svg'}-${fitted.svg.length}`}
          xml={fitted.svg}
          width="100%"
          height="100%"
        />
      </View>
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
  zoom: {
    flex: 1,
    width: '100%',
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { isCacheStale } from '../../services/offline-cache.service';

type Props = {
  updatedAt: string | null;
};

function formatRelativeTime(value: string | null): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / (60 * 1000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CacheStaleIndicator({ updatedAt }: Props) {
  const stale = isCacheStale(updatedAt);
  return (
    <View style={[styles.wrap, stale ? styles.stale : null]}>
      <Text style={styles.text}>
        {stale
          ? `Cached content may be outdated (updated ${formatRelativeTime(updatedAt)}). Reconnect to refresh.`
          : `Cached content updated ${formatRelativeTime(updatedAt)}.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  stale: {
    borderColor: colors.warning,
  },
  text: {
    color: colors.muted,
    fontSize: 12,
  },
});

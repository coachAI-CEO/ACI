import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { describeApiError } from '../../../services/api';
import {
  getTeamOverview,
  listTeamChat,
  sendTeamChatMessage,
} from '../../../services/coach-center.service';

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CoachCenterChatScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const teamIdStr = String(teamId);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const listRef = useRef<ScrollView>(null);

  const overview = useQuery({
    queryKey: ['coach-center', 'overview', teamIdStr],
    queryFn: () => getTeamOverview(teamIdStr),
    enabled: Boolean(teamIdStr),
    staleTime: 60_000,
  });

  const chatQuery = useQuery({
    queryKey: ['coach-center', 'chat', teamIdStr],
    queryFn: () => listTeamChat(teamIdStr),
    enabled: Boolean(teamIdStr),
    staleTime: 30_000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendTeamChatMessage(teamIdStr, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-center', 'chat', teamIdStr] });
    },
  });

  const messages = chatQuery.data ?? [];
  const team = overview.data?.team;
  const currentTheme = team?.season?.currentWeek?.theme;

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const onSend = () => {
    const content = draft.trim();
    if (!content || sendMutation.isPending) return;
    setDraft('');
    sendMutation.mutate(content);
  };

  const isLoading = chatQuery.isLoading && messages.length === 0;

  // Optimistic preview: while the mutation is in flight, render a "thinking"
  // bubble at the end of the list.
  const showThinking = sendMutation.isPending;

  const headerSubtitle = useMemo(() => {
    if (currentTheme) return `Week theme · ${currentTheme}`;
    return 'Ask about this team';
  }, [currentTheme]);

  if (overview.isLoading || isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (overview.error || !overview.data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ErrorMessage message={describeApiError(overview.error, 'Could not load team.')} />
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>← Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
        style={styles.flex}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.title}>{team?.name || 'Season chat'}</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>

        <ScrollView
          ref={listRef}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={chatQuery.isRefetching} onRefresh={() => void chatQuery.refetch()} tintColor={colors.primary} />}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Ask about this team</Text>
              <Text style={styles.emptyBody}>
                Try: “What should Tuesday and Thursday look like for{team?.name ? ` ${team.name}` : ''}?”
              </Text>
            </View>
          ) : (
            messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <View
                  key={m.id}
                  style={[
                    styles.bubbleRow,
                    isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      isUser ? styles.bubbleUser : styles.bubbleAssistant,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                      ]}
                    >
                      {m.content}
                    </Text>
                    {m.createdAt ? <Text style={styles.bubbleMeta}>{formatTime(m.createdAt)}</Text> : null}
                  </View>
                </View>
              );
            })
          )}

          {showThinking ? (
            <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
              <View style={[styles.bubble, styles.bubbleAssistant, styles.thinkingBubble]}>
                <ActivityIndicator color={colors.muted} size="small" />
                <Text style={styles.thinkingText}>Thinking with this week&apos;s plan…</Text>
              </View>
            </View>
          ) : null}

          {sendMutation.error ? (
            <ErrorMessage
              message={describeApiError(sendMutation.error, 'Could not send message.')}
            />
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Message"
            multiline
            numberOfLines={2}
            placeholder="Ask about this team…"
            placeholderTextColor={colors.muted}
            value={draft}
            onChangeText={setDraft}
            style={styles.input}
            editable={!sendMutation.isPending}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={!draft.trim() || sendMutation.isPending}
            onPress={onSend}
            style={({ pressed }) => [
              styles.sendBtn,
              (!draft.trim() || sendMutation.isPending) ? styles.sendBtnDisabled : null,
              pressed ? styles.sendBtnPressed : null,
            ]}
          >
            <Text style={styles.sendBtnLabel}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  container: { flex: 1, gap: 12, padding: 16 },
  headerBlock: { gap: 2, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { color: colors.muted, fontSize: 13 },

  listContent: { gap: 8, padding: 16, paddingBottom: 24 },

  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },

  bubble: {
    borderRadius: 14,
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderColor: colors.border,
    borderWidth: 1,
  },
  bubbleText: { fontSize: 14, lineHeight: 19 },
  bubbleTextUser: { color: '#022c1d' },
  bubbleTextAssistant: { color: colors.text },
  bubbleMeta: {
    color: '#022c1d',
    fontSize: 10,
    marginTop: 4,
    opacity: 0.6,
  },

  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thinkingText: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },

  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: colors.muted, fontSize: 13 },

  composer: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 14,
    maxHeight: 100,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnPressed: { opacity: 0.7 },
  sendBtnLabel: { color: '#022c1d', fontWeight: '800' },

  link: { color: colors.primary, fontWeight: '700' },
});
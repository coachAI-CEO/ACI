import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { WebDiagramV1 } from '@aci/shared';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { colors } from '../../constants/colors';
import { describeApiError } from '../../services/api';
import {
  sendBoardAiChat,
  type BoardAiHistoryMessage,
  type BoardAiChatResult,
} from '../../services/boards.service';

type Props = {
  visible: boolean;
  boardId: string;
  diagram: WebDiagramV1 | null;
  onClose: () => void;
  /** Called when the user taps "Apply" on a reply that carries an updated diagram. */
  onApplyDiagram: (next: WebDiagramV1, reply: string) => void;
};

type LocalMessage = BoardAiHistoryMessage & { id: string; applied?: boolean };

let localId = 0;
const nextId = () => `m${++localId}-${Date.now().toString(36)}`;

/**
 * Bottom sheet for text-only AI chat on a board. Mirrors the web's
 * `BoardAiSheet` shape — assistant replies can carry `applied: true`
 * (the AI mutated the diagram). Tapping "Apply" pushes the updated
 * diagram back into the editor (or detail screen).
 *
 * The composer sends up to the last 8 messages as `history`. Long
 * transcripts are auto-truncated.
 */
export function BoardAiSheet({ visible, boardId, diagram, onClose, onApplyDiagram }: Props) {
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<LocalMessage[]>([]);
  const [pendingReply, setPendingReply] = useState<BoardAiChatResult | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) {
      // Reset state on close so each session is fresh.
      setDraft('');
      setHistory([]);
      setPendingReply(null);
    }
  }, [visible]);

  const send = useMutation({
    mutationFn: async () => {
      const trimmed = draft.trim();
      if (!trimmed) throw new Error('Empty message');
      return sendBoardAiChat(boardId, {
        message: trimmed,
        diagram: diagram || undefined,
        history: history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      });
    },
    onSuccess: (result) => {
      setPendingReply(result);
      const userMsg: LocalMessage = { id: nextId(), role: 'user', content: draft.trim() };
      const assistantMsg: LocalMessage = {
        id: nextId(),
        role: 'assistant',
        content: result.reply,
        applied: result.applied,
      };
      setHistory((h) => [...h, userMsg, assistantMsg].slice(-8));
      setDraft('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    },
  });

  function applyPending() {
    if (!pendingReply?.applied || !pendingReply.diagram) return;
    onApplyDiagram(pendingReply.diagram, pendingReply.reply);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        style={styles.sheetWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grab} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>AI coach</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={({ pressed }) => [pressed ? { opacity: 0.5 } : null]}
            >
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Ask the AI to draw, adjust, or explain</Text>
                <Text style={styles.emptyBody}>
                  Examples: "show me a 4-2-3-1 from a goal kick", "press trigger at the centre circle", "add 2 runs from the wingers".
                </Text>
              </View>
            ) : (
              history.map((m) => (
                <View key={m.id} style={[styles.bubbleRow, m.role === 'user' ? styles.bubbleRowUser : null]}>
                  <View
                    style={[
                      styles.bubble,
                      m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                    ]}
                  >
                    <Text style={styles.bubbleLabel}>{m.role === 'user' ? 'You' : 'AI'}</Text>
                    <Text style={styles.bubbleBody}>{m.content}</Text>
                    {m.applied ? <Badge label="Applied" tone="default" /> : null}
                  </View>
                </View>
              ))
            )}

            {send.isPending ? (
              <View style={styles.pendingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.pendingText}>Thinking…</Text>
              </View>
            ) : null}

            {send.error ? (
              <Text style={styles.errorText}>{describeApiError(send.error, 'AI request failed.')}</Text>
            ) : null}
          </ScrollView>

          {pendingReply?.applied && pendingReply.diagram ? (
            <View style={styles.applyRow}>
              <Text style={styles.applyText} numberOfLines={2}>
                AI updated the diagram. Apply to your board?
              </Text>
              <Button title="Apply" onPress={applyPending} />
            </View>
          ) : null}

          <View style={styles.composerRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Describe what you want…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
              editable={!send.isPending}
              returnKeyType="send"
              onSubmitEditing={() => send.mutate()}
              blurOnSubmit={false}
            />
            <Button
              title="Send"
              onPress={() => send.mutate()}
              disabled={!draft.trim() || send.isPending}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)', flex: 1 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 8,
    maxHeight: '85%',
    paddingBottom: 16,
    paddingTop: 4,
  },
  grab: {
    alignSelf: 'center',
    backgroundColor: '#374151',
    borderRadius: 999,
    height: 4,
    marginTop: 8,
    width: 36,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  close: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  scrollContent: { gap: 8, padding: 12, paddingBottom: 24 },
  emptyState: { alignItems: 'center', gap: 6, paddingTop: 24, paddingHorizontal: 12 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    maxWidth: '85%',
    padding: 10,
  },
  bubbleUser: { backgroundColor: '#14381f', borderColor: colors.primary },
  bubbleAssistant: {},
  bubbleLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  bubbleBody: { color: colors.text, fontSize: 14, lineHeight: 19 },
  pendingRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  pendingText: { color: colors.muted, fontSize: 13 },
  errorText: { color: '#f87171', fontSize: 13 },
  applyRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginHorizontal: 12,
    padding: 10,
    borderRadius: 10,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  applyText: { color: colors.text, flex: 1, fontSize: 13 },
  composerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
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
});

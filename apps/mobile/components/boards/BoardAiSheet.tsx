import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { webPath } from '../../constants/web';
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

type LocalMessage = BoardAiHistoryMessage & {
  id: string;
  applied?: boolean;
  hasImage?: boolean;
  sessionBridge?: BoardAiChatResult['sessionBridge'];
};

type PendingImage = {
  data: string;
  mimeType: string;
  previewUri: string;
};

const SUGGESTED_PROMPTS = [
  'Show a 4-2-3-1 from a goal kick',
  'Press trigger at the centre circle',
  'Add runs from both wingers',
  'Build-out in the defensive third',
];

let localId = 0;
const nextId = () => `m${++localId}-${Date.now().toString(36)}`;

/**
 * Bottom sheet for AI chat on a board — text + optional photo attach.
 * Assistant replies can carry `applied: true` (diagram mutation) and/or
 * a session-bridge link into Session Builder on web.
 */
export function BoardAiSheet({ visible, boardId, diagram, onClose, onApplyDiagram }: Props) {
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<LocalMessage[]>([]);
  const [pendingReply, setPendingReply] = useState<BoardAiChatResult | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) {
      setDraft('');
      setHistory([]);
      setPendingReply(null);
      setPendingImage(null);
    }
  }, [visible]);

  const send = useMutation({
    mutationFn: async () => {
      const trimmed = draft.trim();
      if (!trimmed && !pendingImage) throw new Error('Empty message');
      const message =
        trimmed ||
        (pendingImage ? 'Recreate this picture on the board.' : '');
      return sendBoardAiChat(boardId, {
        message,
        diagram: diagram || undefined,
        history: history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        ...(pendingImage
          ? {
              image: {
                data: pendingImage.data,
                mimeType: pendingImage.mimeType,
              },
            }
          : {}),
      });
    },
    onSuccess: (result) => {
      setPendingReply(result);
      const userContent =
        draft.trim() ||
        (pendingImage ? 'Recreate this picture on the board.' : '');
      const userMsg: LocalMessage = {
        id: nextId(),
        role: 'user',
        content: userContent,
        hasImage: Boolean(pendingImage),
      };
      const assistantMsg: LocalMessage = {
        id: nextId(),
        role: 'assistant',
        content: result.reply,
        applied: result.applied,
        sessionBridge: result.sessionBridge,
      };
      setHistory((h) => [...h, userMsg, assistantMsg].slice(-8));
      setDraft('');
      setPendingImage(null);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    },
  });

  async function attachPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Photo library access is needed to attach a board photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Could not read photo', 'Try another image from your library.');
      return;
    }
    const mimeType = asset.mimeType || 'image/jpeg';
    setPendingImage({
      data: asset.base64,
      mimeType,
      previewUri: asset.uri,
    });
  }

  function applyPending() {
    if (!pendingReply?.applied || !pendingReply.diagram) return;
    onApplyDiagram(pendingReply.diagram, pendingReply.reply);
    onClose();
  }

  function openSessionBridge(bridge: NonNullable<BoardAiChatResult['sessionBridge']>) {
    const url = bridge.generatorUrl
      ? bridge.generatorUrl.startsWith('http')
        ? bridge.generatorUrl
        : webPath(bridge.generatorUrl)
      : webPath('/generate');
    void Linking.openURL(url);
  }

  const canSend = Boolean(draft.trim() || pendingImage) && !send.isPending;

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
                  Attach a pitch photo, or tap a suggestion to get started.
                </Text>
                <View style={styles.promptChips}>
                  {SUGGESTED_PROMPTS.map((p) => (
                    <Pressable
                      key={p}
                      accessibilityRole="button"
                      accessibilityLabel={p}
                      onPress={() => setDraft(p)}
                      style={({ pressed }) => [styles.promptChip, pressed ? { opacity: 0.7 } : null]}
                    >
                      <Text style={styles.promptChipLabel}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
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
                    {m.hasImage ? <Badge label="Photo attached" tone="muted" /> : null}
                    {m.applied ? <Badge label="Applied" tone="default" /> : null}
                    {m.sessionBridge?.generatorUrl ? (
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel="Open Session Builder"
                        onPress={() => openSessionBridge(m.sessionBridge!)}
                        style={styles.bridgeLink}
                      >
                        <Text style={styles.bridgeLinkText}>Open Session Builder</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            {send.isPending ? (
              <View style={styles.pendingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.pendingText}>
                  {pendingImage || history[history.length - 1]?.hasImage ? 'Reading photo…' : 'Thinking…'}
                </Text>
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

          {pendingReply?.sessionBridge?.generatorUrl && !pendingReply.applied ? (
            <View style={styles.applyRow}>
              <Text style={styles.applyText} numberOfLines={2}>
                Session ideas ready on web.
              </Text>
              <Button
                title="Open"
                onPress={() => openSessionBridge(pendingReply.sessionBridge!)}
                variant="secondary"
              />
            </View>
          ) : null}

          {pendingImage ? (
            <View style={styles.attachPreview}>
              <Image source={{ uri: pendingImage.previewUri }} style={styles.attachThumb} />
              <Text style={styles.attachLabel} numberOfLines={1}>
                Photo ready to send
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                onPress={() => setPendingImage(null)}
              >
                <Text style={styles.attachRemove}>Remove</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.composerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach photo"
              onPress={() => void attachPhoto()}
              disabled={send.isPending}
              style={({ pressed }) => [
                styles.attachBtn,
                pressed ? { opacity: 0.7 } : null,
                send.isPending ? { opacity: 0.4 } : null,
              ]}
            >
              <Text style={styles.attachBtnLabel}>Photo</Text>
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Describe what you want…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
              editable={!send.isPending}
              returnKeyType="send"
              onSubmitEditing={() => {
                if (canSend) send.mutate();
              }}
              blurOnSubmit={false}
            />
            <Button title="Send" onPress={() => send.mutate()} disabled={!canSend} />
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
  emptyState: { alignItems: 'center', gap: 8, paddingTop: 16, paddingHorizontal: 12 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  promptChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  promptChip: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  promptChipLabel: { color: colors.text, fontSize: 12, fontWeight: '600' },
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
  bubbleLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  bubbleBody: { color: colors.text, fontSize: 14, lineHeight: 19 },
  bridgeLink: { marginTop: 4 },
  bridgeLinkText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
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
  attachPreview: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 12,
    paddingVertical: 4,
  },
  attachThumb: { borderRadius: 6, height: 40, width: 40 },
  attachLabel: { color: colors.muted, flex: 1, fontSize: 12 },
  attachRemove: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  composerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  attachBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
  },
  attachBtnLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
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

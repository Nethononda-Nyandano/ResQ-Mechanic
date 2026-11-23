import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Modal } from '@/components/dialogNative';
import Ionicons from '@react-native-vector-icons/ionicons';
import * as ImagePicker from 'expo-image-picker';
import {SafeAreaView} from "react-native-safe-area-context";
import { getActionErrorMessage } from '@/utils/actionErrorMessage';
import {
  ChatMessage,
  getChatMessages,
  markMessagesAsRead,
  sendChatMessage,
  subscribeToChatMessages,
} from '@/utils/chatService';

interface RescueChatModalProps {
  visible: boolean;
  rescueRequestId: string;
  currentUserId: string;
  currentUserRole: 'client' | 'mechanic';
  otherPartyName?: string;
  onClose: () => void;
}

export const RescueChatModal: React.FC<RescueChatModalProps> = ({
  visible,
  rescueRequestId,
  currentUserId,
  currentUserRole,
  otherPartyName = 'Support / Driver',
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible || !rescueRequestId) return;

    let unsub: (() => void) | null = null;
    let isCurrent = true;

    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data, error } = await getChatMessages(rescueRequestId);
        if (!isCurrent) return;
        if (error) {
          setLoadError(getActionErrorMessage(error, 'Could not load messages. Please try again.'));
          return;
        }
        setMessages(data || []);
        void markMessagesAsRead(rescueRequestId, currentUserId);

        unsub = subscribeToChatMessages(rescueRequestId, (newMsg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.sender_id !== currentUserId) {
            void markMessagesAsRead(rescueRequestId, currentUserId);
          }
        });
      } catch (error) {
        if (isCurrent) {
          setLoadError(getActionErrorMessage(error, 'Could not load messages. Please try again.'));
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    void loadData();

    return () => {
      isCurrent = false;
      unsub?.();
    };
  }, [visible, rescueRequestId, currentUserId, loadAttempt]);

  const handleSend = async (imageUri?: string) => {
    if ((!inputMessage.trim() && !imageUri) || sending) return;

    const originalInput = inputMessage;
    const textToSend = inputMessage.trim();
    setSending(true);
    setSendError(null);

    try {
      const { error } = await sendChatMessage({
        rescueRequestId,
        senderId: currentUserId,
        senderRole: currentUserRole,
        message: textToSend || undefined,
        imageUrl: imageUri || undefined,
      });
      if (error) throw error;
      setInputMessage((current) => current === originalInput ? '' : current);
    } catch (error) {
      console.error('Failed to send message:', error);
      setSendError(
        `${getActionErrorMessage(error, 'Could not send this message.')} ${textToSend ? 'Your text is still here; tap send to retry.' : 'Please choose the photo again to retry.'}`,
      );
    } finally {
      setSending(false);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        await handleSend(res.assets[0].uri);
      }
    } catch (e) {
      console.error('Photo picker error:', e);
      setSendError(getActionErrorMessage(e, 'Could not open your photos. Please try again.'));
    }
  };

  if (!visible) return null;

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.sender_id === currentUserId;
    const timeStr = item.created_at
      ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <View style={[styles.messageBubbleContainer, isMe ? styles.myMsgContainer : styles.theirMsgContainer]}>
        <View style={[styles.messageBubble, isMe ? styles.myMsg : styles.theirMsg]}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.messageImage} resizeMode="cover" />
          ) : null}
          {item.message ? (
            <Text style={[styles.messageText, isMe ? styles.myMsgText : styles.theirMsgText]}>
              {item.message}
            </Text>
          ) : null}
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>
              {timeStr}
            </Text>
            {isMe && (
              <Ionicons
                name={item.read_at ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.read_at ? '#38bdf8' : '#cbd5e1'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{otherPartyName}</Text>
              <Text style={styles.headerSubtitle}>Rescue #<Text className={"uppercase font-bold"}>{rescueRequestId.slice(0, 8)}</Text></Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

          {/* Messages */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#059669" />
            </View>
          ) : loadError ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.errorText}>{loadError}</Text>
              <TouchableOpacity
                onPress={() => setLoadAttempt((attempt) => attempt + 1)}
                accessibilityRole="button"
                className="mt-3 rounded-xl bg-emerald-600 px-5 py-3"
              >
                <Text className="font-poppin-semibold text-white">Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}

          {/* Input Footer */}
          {sendError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{sendError}</Text>
            </View>
          ) : null}
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.iconBtn} onPress={handlePickPhoto}>
              <Ionicons name="camera-outline" size={24} color="#64748b" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#94a3b8"
              value={inputMessage}
              onChangeText={setInputMessage}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputMessage.trim() && styles.sendBtnDisabled]}
              onPress={() => handleSend()}
              disabled={!inputMessage.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="send" size={18} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageBubbleContainer: {
    marginVertical: 4,
    width: '100%',
    flexDirection: 'row',
  },
  myMsgContainer: {
    justifyContent: 'flex-end',
  },
  theirMsgContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
  },
  myMsg: {
    backgroundColor: '#059669',
    borderBottomRightRadius: 4,
  },
  theirMsg: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMsgText: {
    color: '#ffffff',
  },
  theirMsgText: {
    color: '#0f172a',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
  },
  myTimeText: {
    color: 'rgba(255,255,255,0.7)',
  },
  theirTimeText: {
    color: '#94a3b8',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    color: '#0f172a',
  },
  sendBtn: {
    backgroundColor: '#059669',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
});

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import { getMessages, sendMessage, getChats } from "../../src/api/chats";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

const AVATAR_COLORS = ["#6366f1", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
function avatarColor(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

function formatMsgTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
  const { id: chatId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatListRef = useRef(null);
  const wsRef = useRef(null);
  const pollRef = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadChatInfo = useCallback(async () => {
    try {
      const chats = await getChats();
      const found = chats.find((c) => String(c.id) === String(chatId));
      if (found) setChatInfo(found);
    } catch {}
  }, [chatId]);

  const loadMessages = useCallback(async () => {
    try {
      const data = await getMessages(chatId);
      setMessages(data || []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  // WebSocket connection
  useEffect(() => {
    const wsUrl = API_URL.replace(/^http/, "ws");
    let ws;
    try {
      ws = new WebSocket(`${wsUrl}/ws/${user?.id}`);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message" && String(data.chat_id) === String(chatId)) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === data.message.id);
              if (exists) return prev;
              return [data.message, ...prev];
            });
          }
        } catch {}
      };
    } catch {}
    return () => {
      ws?.close();
      wsRef.current = null;
    };
  }, [chatId, user?.id]);

  // Poll for new messages every 5s
  useEffect(() => {
    loadChatInfo();
    loadMessages();
    pollRef.current = setInterval(loadMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [loadMessages, loadChatInfo]);

  async function handleSend() {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    setSending(true);
    try {
      const msg = await sendMessage(chatId, text);
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === msg.id);
        if (exists) return prev;
        return [msg, ...prev];
      });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      Alert.alert("Error", detail ? String(detail) : "Could not send message.");
      setInputText(text);
    } finally {
      setSending(false);
    }
  }

  // Determine the "other" participant name and broadcast title for header
  const otherParticipant = chatInfo?.participants?.find((p) => p.id !== user?.id);
  const broadcastTitle = chatInfo?.broadcast_title;

  // Group messages to show username only at start of each sequence
  function shouldShowUsername(index) {
    const msg = messages[index];
    if (msg.sender_id === user?.id) return false;
    const prev = messages[index + 1]; // inverted list so next in array = older
    return !prev || prev.sender_id !== msg.sender_id;
  }

  function renderMessage({ item, index }) {
    const isOwn = item.sender_id === user?.id;
    const showName = shouldShowUsername(index);

    return (
      <View style={[styles.msgWrapper, isOwn ? styles.msgWrapperOwn : styles.msgWrapperOther]}>
        {showName && !isOwn && (
          <Text style={styles.msgSenderName}>@{item.sender_username}</Text>
        )}
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
            {item.content}
          </Text>
        </View>
        <View style={[styles.msgMeta, isOwn ? styles.msgMetaOwn : styles.msgMetaOther]}>
          <Text style={styles.msgTime}>{formatMsgTime(item.created_at)}</Text>
          {isOwn && (
            <Text style={styles.readIndicator}>✓✓</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: "#F7F5F0" }]}>
      {/* Custom header */}
      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color="#F5A623" />
          </TouchableOpacity>

          {otherParticipant ? (
            <View style={[styles.headerAvatar, { backgroundColor: avatarColor(otherParticipant.username) }]}>
              <Text style={styles.headerAvatarText}>
                {otherParticipant.username?.[0]?.toUpperCase()}
              </Text>
            </View>
          ) : null}

          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {broadcastTitle ?? "Broadcast Chat"}
            </Text>
            {otherParticipant && (
              <Text style={styles.headerSubtitle}>with @{otherParticipant.username}</Text>
            )}
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F5A623" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>👋</Text>
            <Text style={styles.emptyText}>Chat unlocked! Say hello</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="arrow-up" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerSafe: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EDE9E3",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 54,
  },
  backBtn: {
    marginRight: 4,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerAvatarText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#1C1C1E" },
  headerSubtitle: { fontSize: 12, color: "#6B7280" },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: "#6B7280" },

  messagesList: { paddingHorizontal: 16, paddingVertical: 12 },

  msgWrapper: {
    marginBottom: 4,
    maxWidth: "75%",
  },
  msgWrapperOwn: { alignSelf: "flex-end", alignItems: "flex-end" },
  msgWrapperOther: { alignSelf: "flex-start", alignItems: "flex-start" },

  msgSenderName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 2,
    marginLeft: 4,
  },

  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "100%",
  },
  bubbleOwn: {
    backgroundColor: "#F5A623",
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextOwn: { color: "#fff" },
  bubbleTextOther: { color: "#1C1C1E" },

  msgMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  msgMetaOwn: { alignSelf: "flex-end" },
  msgMetaOther: { alignSelf: "flex-start" },
  msgTime: { fontSize: 10, color: "#9CA3AF" },
  readIndicator: { fontSize: 10, color: "#9CA3AF" },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EDE9E3",
  },
  input: {
    flex: 1,
    backgroundColor: "#F7F5F0",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    color: "#111827",
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#EDE9E3",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    shadowColor: "#F5A623",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  sendBtnDisabled: { opacity: 0.4 },
});

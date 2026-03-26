import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { getChats } from "../src/api/chats";

const AVATAR_COLORS = ["#6366f1", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
function avatarColor(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = useCallback(async () => {
    try {
      const data = await getChats();
      setChats(data || []);
    } catch {
      setChats([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 30000);
    return () => clearInterval(interval);
  }, [loadChats]);

  function getOtherParticipant(chat) {
    if (!chat.participants) return null;
    return chat.participants.find((p) => p.id !== user?.id) ?? chat.participants[0];
  }

  function renderChat({ item }) {
    const other = getOtherParticipant(item);
    const initial = (other?.username?.[0] ?? "?").toUpperCase();
    const bg = avatarColor(other?.username);
    const hasUnread = item.unread_count > 0;

    return (
      <TouchableOpacity
        style={styles.chatRow}
        activeOpacity={0.75}
        onPress={() => router.push(`/chat/${item.id}`)}
      >
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: bg }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        {/* Content */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.chatRowTop}>
            <Text style={[styles.otherUsername, hasUnread && styles.otherUsernameUnread]}>
              @{other?.username ?? "Unknown"}
            </Text>
            <Text style={styles.timestamp}>{formatTime(item.last_message_at)}</Text>
          </View>
          {item.broadcast_title && (
            <Text style={styles.broadcastTitle} numberOfLines={1}>
              📡 {item.broadcast_title}
            </Text>
          )}
          <View style={styles.chatRowBottom}>
            <Text
              style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
              numberOfLines={1}
            >
              {item.last_message ?? "Chat unlocked! Say hello 👋"}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread_count > 99 ? "99+" : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#F5A623" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top > 0 ? 0 : 8 }]}>
      {chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptySubtitle}>
            Join a broadcast to start chatting
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderChat}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadChats(); }}
              tintColor="#F5A623"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F5F0" },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1C1C1E", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 },

  listContent: { paddingVertical: 8 },

  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 20 },

  chatRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  otherUsername: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  otherUsernameUnread: { fontWeight: "800" },
  timestamp: { fontSize: 11, color: "#9CA3AF" },

  broadcastTitle: {
    fontSize: 11,
    color: "#F5A623",
    fontWeight: "600",
    marginBottom: 2,
  },

  chatRowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lastMessage: {
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },
  lastMessageUnread: { color: "#1C1C1E", fontWeight: "600" },

  unreadBadge: {
    backgroundColor: "#F5A623",
    borderRadius: 99,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  separator: { height: 1, backgroundColor: "#EDE9E3", marginLeft: 78 },
});

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Modal,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import {
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
} from "../../src/api/friends";
import { getStatusFeed } from "../../src/api/status";
import {
  getBroadcastsMap,
  getMyBroadcasts,
  getJoinedBroadcasts,
  requestToJoin,
  deleteBroadcast,
} from "../../src/api/broadcasts";
import { getChats } from "../../src/api/chats";

// Israel center fallback
const DEFAULT_LAT = 31.5;
const DEFAULT_LNG = 35.0;
const DEFAULT_RADIUS = 500000; // 500km to cover all Israel

const BROADCAST_EMOJIS = {
  trip: "🛖",
  food: "🍽️",
  drinks: "🍺",
  hangout: "🛋️",
  sport: "🏃",
  other: "📡",
};

const ACTIVITY_EMOJIS = {
  coffee: "☕",
  drinks: "🍺",
  study: "📚",
  hike: "🥾",
  food: "🍕",
  event: "🎉",
  hangout: "🛋️",
  work: "💼",
  other: "🌀",
};

const SEGMENTS = ["Broadcasts", "Chats", "Friends"];

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function timeLeft(expiresAt) {
  const diff = Math.max(0, new Date(expiresAt) - Date.now());
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h left`;
}

function formatDate(dateStr) {
  if (!dateStr) return "Flexible";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Flexible";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDistance(meters) {
  if (!meters && meters !== 0) return null;
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────

function Avatar({ name, size = 40 }) {
  const letter = name?.[0]?.toUpperCase() ?? "?";
  const colors = ["#6366f1", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return (
    <View style={[sharedStyles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[sharedStyles.avatarText, { fontSize: size * 0.4 }]}>{letter}</Text>
    </View>
  );
}

function StatusPill({ status }) {
  const isLive = status.mode === "live";
  const accent = isLive ? "#38BDF8" : "#6366F1";
  const bg = isLive ? "#EFF6FF" : "#EEF2FF";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 4,
        backgroundColor: bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
        borderWidth: 1, borderColor: accent + "30",
      }}>
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: accent }} />
        <Text style={{ fontSize: 10, fontWeight: "700", color: accent, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {isLive ? "Live" : "Plan"}
        </Text>
      </View>
      <Text style={{ fontSize: 12, color: "#374151", fontWeight: "500" }} numberOfLines={1}>
        {ACTIVITY_EMOJIS[status.activity_type]} {status.message || status.location_name || status.activity_type}
      </Text>
      <Text style={{ fontSize: 11, color: "#9CA3AF" }}>· {timeLeft(status.expires_at)}</Text>
    </View>
  );
}

// ─────────────────────────────────────────
// Broadcast Detail Bottom Sheet Modal
// ─────────────────────────────────────────

function BroadcastDetailModal({ broadcast, visible, onClose, onJoin, joinedIds, pendingIds, myBroadcastIds }) {
  if (!broadcast) return null;

  const emoji = BROADCAST_EMOJIS[broadcast.type] ?? "📡";
  const isOwn = myBroadcastIds.has(broadcast.id);
  const isPending = pendingIds.has(broadcast.id);
  const isJoined = joinedIds.has(broadcast.id);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={broadcastStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={broadcastStyles.sheet} activeOpacity={1} onPress={() => {}}>
          {/* Handle */}
          <View style={broadcastStyles.sheetHandle} />

          <Text style={broadcastStyles.sheetEmoji}>{emoji}</Text>
          <Text style={broadcastStyles.sheetTitle}>{broadcast.title}</Text>
          <Text style={broadcastStyles.sheetCreator}>by {broadcast.creator_username ?? broadcast.creator?.username ?? "unknown"}</Text>

          {broadcast.description ? (
            <Text style={broadcastStyles.sheetDesc}>{broadcast.description}</Text>
          ) : null}

          <View style={broadcastStyles.sheetMeta}>
            {broadcast.location_name ? (
              <View style={broadcastStyles.sheetMetaRow}>
                <Text style={broadcastStyles.sheetMetaIcon}>📍</Text>
                <Text style={broadcastStyles.sheetMetaText}>{broadcast.location_name}</Text>
              </View>
            ) : null}
            <View style={broadcastStyles.sheetMetaRow}>
              <Text style={broadcastStyles.sheetMetaIcon}>📅</Text>
              <Text style={broadcastStyles.sheetMetaText}>{formatDate(broadcast.scheduled_for)}</Text>
            </View>
            {broadcast.max_participants ? (
              <View style={broadcastStyles.sheetMetaRow}>
                <Text style={broadcastStyles.sheetMetaIcon}>👥</Text>
                <Text style={broadcastStyles.sheetMetaText}>Max {broadcast.max_participants} people</Text>
              </View>
            ) : null}
          </View>

          {!isOwn && (
            isJoined ? (
              <View style={[broadcastStyles.statusBadge, { backgroundColor: "#D1FAE5" }]}>
                <Text style={{ color: "#065F46", fontWeight: "700", fontSize: 14 }}>Accepted</Text>
              </View>
            ) : isPending ? (
              <View style={[broadcastStyles.statusBadge, { backgroundColor: "#FEF9C3" }]}>
                <Text style={{ color: "#713F12", fontWeight: "700", fontSize: 14 }}>Request Pending</Text>
              </View>
            ) : (
              <TouchableOpacity style={broadcastStyles.joinBtnLarge} onPress={() => { onJoin(broadcast.id); onClose(); }}>
                <Text style={broadcastStyles.joinBtnLargeText}>Request to Join</Text>
              </TouchableOpacity>
            )
          )}

          <TouchableOpacity style={broadcastStyles.closeBtn} onPress={onClose}>
            <Text style={broadcastStyles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─────────────────────────────────────────
// Broadcasts Segment
// ─────────────────────────────────────────

function BroadcastsSegment() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState([]);
  const [myBroadcasts, setMyBroadcasts] = useState([]);
  const [joinedBroadcasts, setJoinedBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState("nearest"); // "nearest" | "newest"
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [pendingIds, setPendingIds] = useState(new Set());

  const myBroadcastIds = new Set(myBroadcasts.map((b) => b.id));
  const joinedIds = new Set(joinedBroadcasts.map((b) => b.broadcast?.id ?? b.id));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let lat = DEFAULT_LAT;
      let lng = DEFAULT_LNG;
      let radius = DEFAULT_RADIUS;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          radius = 50000; // 50km when we have real location
        }
      } catch {
        // fall back to defaults
      }

      const [mapData, myData, joinedData] = await Promise.all([
        getBroadcastsMap(lat, lng, radius),
        getMyBroadcasts(),
        getJoinedBroadcasts(),
      ]);

      setBroadcasts(Array.isArray(mapData) ? mapData : []);
      setMyBroadcasts(Array.isArray(myData) ? myData : []);
      setJoinedBroadcasts(Array.isArray(joinedData) ? joinedData : []);
    } catch (err) {
      Alert.alert("Error", "Failed to load broadcasts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleJoin(broadcastId) {
    try {
      await requestToJoin(broadcastId);
      setPendingIds((prev) => new Set([...prev, broadcastId]));
    } catch (err) {
      Alert.alert("Error", err.response?.data?.detail ?? "Could not send request.");
    }
  }

  async function handleDelete(broadcastId) {
    Alert.alert("Delete Broadcast", "Are you sure you want to delete this broadcast?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteBroadcast(broadcastId);
            setMyBroadcasts((prev) => prev.filter((b) => b.id !== broadcastId));
            setBroadcasts((prev) => prev.filter((b) => b.id !== broadcastId));
          } catch {
            Alert.alert("Error", "Could not delete broadcast.");
          }
        },
      },
    ]);
  }

  // Exclude my own broadcasts from the nearby list (shown separately below)
  const nearbyBroadcasts = broadcasts.filter((b) => !myBroadcastIds.has(b.id));

  const sortedNearby = [...nearbyBroadcasts].sort((a, b) => {
    if (sortMode === "nearest") {
      return (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity);
    }
    return new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0);
  });

  if (loading) {
    return (
      <View style={sharedStyles.center}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={broadcastStyles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Sort pills */}
        <View style={broadcastStyles.sortRow}>
          <TouchableOpacity
            style={[broadcastStyles.sortPill, sortMode === "nearest" && broadcastStyles.sortPillActive]}
            onPress={() => setSortMode("nearest")}
          >
            <Text style={[broadcastStyles.sortPillText, sortMode === "nearest" && broadcastStyles.sortPillTextActive]}>
              Nearest
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[broadcastStyles.sortPill, sortMode === "newest" && broadcastStyles.sortPillActive]}
            onPress={() => setSortMode("newest")}
          >
            <Text style={[broadcastStyles.sortPillText, sortMode === "newest" && broadcastStyles.sortPillTextActive]}>
              Newest
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nearby broadcasts */}
        {sortedNearby.length === 0 ? (
          <View style={broadcastStyles.emptyState}>
            <Text style={broadcastStyles.emptyIcon}>📡</Text>
            <Text style={broadcastStyles.emptyTitle}>No broadcasts nearby</Text>
            <Text style={broadcastStyles.emptyHint}>Be the first to create one! 📡</Text>
          </View>
        ) : (
          sortedNearby.map((b) => {
            const isPending = pendingIds.has(b.id) || b.my_request_status === "pending";
            const isJoined = joinedIds.has(b.id) || b.my_request_status === "accepted";
            const dist = formatDistance(b.distance_meters);
            const emoji = BROADCAST_EMOJIS[b.type] ?? "📡";

            return (
              <TouchableOpacity
                key={b.id}
                style={broadcastStyles.card}
                onPress={() => { setSelectedBroadcast(b); setSheetVisible(true); }}
                activeOpacity={0.85}
              >
                <View style={broadcastStyles.cardLeft}>
                  <Text style={broadcastStyles.cardEmoji}>{emoji}</Text>
                </View>
                <View style={broadcastStyles.cardBody}>
                  <View style={broadcastStyles.cardTitleRow}>
                    <Text style={broadcastStyles.cardTitle} numberOfLines={1}>{b.title}</Text>
                    {dist && (
                      <View style={broadcastStyles.distBadge}>
                        <Text style={broadcastStyles.distBadgeText}>{dist}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={broadcastStyles.cardCreator}>by {b.creator_username ?? b.creator?.username ?? "unknown"}</Text>
                  {b.location_name ? (
                    <Text style={broadcastStyles.cardMeta} numberOfLines={1}>📍 {b.location_name}</Text>
                  ) : null}
                  <Text style={broadcastStyles.cardDate}>{formatDate(b.scheduled_for)}</Text>
                </View>
                <View style={broadcastStyles.cardAction}>
                  {isJoined ? (
                    <View style={[broadcastStyles.statusTag, { backgroundColor: "#D1FAE5" }]}>
                      <Text style={{ color: "#065F46", fontSize: 11, fontWeight: "700" }}>Accepted</Text>
                    </View>
                  ) : isPending ? (
                    <View style={[broadcastStyles.statusTag, { backgroundColor: "#FEF9C3" }]}>
                      <Text style={{ color: "#713F12", fontSize: 11, fontWeight: "700" }}>Pending</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={broadcastStyles.joinBtn}
                      onPress={() => handleJoin(b.id)}
                    >
                      <Text style={broadcastStyles.joinBtnText}>Join</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* My broadcasts section */}
        {myBroadcasts.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={broadcastStyles.sectionLabel}>My Broadcasts</Text>
            {myBroadcasts.map((b) => {
              const emoji = BROADCAST_EMOJIS[b.type] ?? "📡";
              return (
                <View key={b.id} style={[broadcastStyles.card, { borderLeftWidth: 3, borderLeftColor: "#0EA5E9" }]}>
                  <View style={broadcastStyles.cardLeft}>
                    <Text style={broadcastStyles.cardEmoji}>{emoji}</Text>
                  </View>
                  <View style={broadcastStyles.cardBody}>
                    <Text style={broadcastStyles.cardTitle} numberOfLines={1}>{b.title}</Text>
                    {b.location_name ? (
                      <Text style={broadcastStyles.cardMeta} numberOfLines={1}>📍 {b.location_name}</Text>
                    ) : null}
                    <Text style={broadcastStyles.cardDate}>{formatDate(b.scheduled_for)}</Text>
                  </View>
                  <TouchableOpacity
                    style={broadcastStyles.deleteBtn}
                    onPress={() => handleDelete(b.id)}
                  >
                    <Text style={broadcastStyles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Bottom padding for FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={broadcastStyles.fab}
        onPress={() => router.push("/create-broadcast")}
        activeOpacity={0.85}
      >
        <Text style={broadcastStyles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Detail sheet */}
      <BroadcastDetailModal
        broadcast={selectedBroadcast}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onJoin={handleJoin}
        joinedIds={joinedIds}
        pendingIds={pendingIds}
        myBroadcastIds={myBroadcastIds}
      />
    </View>
  );
}

// ─────────────────────────────────────────
// Chats Segment
// ─────────────────────────────────────────

function ChatsSegment() {
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getChats();
      setChats(Array.isArray(data) ? data : []);
    } catch {
      Alert.alert("Error", "Failed to load chats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={sharedStyles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (chats.length === 0) {
    return (
      <View style={sharedStyles.center}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>💬</Text>
        <Text style={chatStyles.emptyTitle}>No chats yet</Text>
        <Text style={chatStyles.emptyHint}>Join a broadcast to start chatting!</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={chats}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={chatStyles.list}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const username = item.other_user?.username ?? "Unknown";
        const broadcastTitle = item.broadcast?.title ?? "";
        const lastMsg = item.last_message?.content;
        const hasUnread = (item.unread_count ?? 0) > 0;

        return (
          <TouchableOpacity
            style={chatStyles.row}
            onPress={() => router.push(`/chat/${item.id}`)}
            activeOpacity={0.8}
          >
            <View style={{ position: "relative" }}>
              <Avatar name={username} size={46} />
              {hasUnread && <View style={chatStyles.unreadDot} />}
            </View>
            <View style={chatStyles.rowBody}>
              <View style={chatStyles.rowTop}>
                <Text style={chatStyles.userName}>{username}</Text>
                {item.last_message?.created_at && (
                  <Text style={chatStyles.timeText}>
                    {new Date(item.last_message.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                )}
              </View>
              {broadcastTitle ? (
                <Text style={chatStyles.broadcastSub} numberOfLines={1}>
                  Re: {broadcastTitle}
                </Text>
              ) : null}
              <Text style={[chatStyles.lastMsg, hasUnread && chatStyles.lastMsgBold]} numberOfLines={1}>
                {lastMsg ?? "Chat unlocked - say hi! 👋"}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ─────────────────────────────────────────
// Friends Segment (full original content)
// ─────────────────────────────────────────

function FriendsSegment() {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friendStatuses, setFriendStatuses] = useState({});

  const debouncedQuery = useDebounce(searchQuery);

  const loadFriends = useCallback(() => {
    setLoading(true);
    Promise.all([getFriends(), getPendingRequests()])
      .then(([f, p]) => { setFriends(f); setPending(p); })
      .catch(() => Alert.alert("Error", "Failed to load friends."))
      .finally(() => setLoading(false));
    getStatusFeed()
      .then((feed) => {
        const map = {};
        (feed || []).forEach((s) => { map[s.user_id] = s; });
        setFriendStatuses(map);
      })
      .catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { loadFriends(); }, [loadFriends]));

  useEffect(() => {
    if (!debouncedQuery.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    searchUsers(debouncedQuery)
      .then(setSearchResults)
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  }, [debouncedQuery]);

  async function handleSend(userId) {
    try {
      await sendFriendRequest(userId);
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
      Alert.alert("Sent!", "Friend request sent.");
    } catch (err) {
      Alert.alert("Error", err.response?.data?.detail ?? "Could not send request.");
    }
  }

  async function handleAccept(friendshipId) {
    try {
      await acceptFriendRequest(friendshipId);
      const accepted = pending.find((p) => p.id === friendshipId);
      setPending((prev) => prev.filter((p) => p.id !== friendshipId));
      if (accepted) setFriends((prev) => [...prev, { ...accepted, status: "accepted" }]);
    } catch {
      Alert.alert("Error", "Could not accept.");
    }
  }

  async function handleReject(friendshipId) {
    try {
      await rejectFriendRequest(friendshipId);
      setPending((prev) => prev.filter((p) => p.id !== friendshipId));
    } catch {
      Alert.alert("Error", "Could not reject.");
    }
  }

  async function handleRemove(friendshipId) {
    Alert.alert("Remove friend", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          try {
            await removeFriend(friendshipId);
            setFriends((prev) => prev.filter((f) => f.id !== friendshipId));
          } catch {
            Alert.alert("Error", "Could not remove.");
          }
        },
      },
    ]);
  }

  if (loading) {
    return <View style={sharedStyles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <ScrollView contentContainerStyle={friendStyles.scroll} keyboardShouldPersistTaps="handled">

      {/* Search */}
      <View style={friendStyles.section}>
        <Text style={friendStyles.sectionTitle}>Find people</Text>
        <View style={friendStyles.searchRow}>
          <Text style={{ fontSize: 14, color: "#94a3b8" }}>🔍</Text>
          <TextInput
            style={friendStyles.searchInput}
            placeholder="Search by username…"
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            color="#111827"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); }}>
              <Text style={{ fontSize: 14, color: "#94a3b8", padding: 4 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {searchLoading && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
            <ActivityIndicator size="small" color="#6366f1" />
            <Text style={{ fontSize: 13, color: "#94a3b8" }}>Searching…</Text>
          </View>
        )}

        {searchResults.length > 0 && (
          <View style={{ gap: 2 }}>
            {searchResults.map((user) => (
              <View key={user.id} style={friendStyles.userRow}>
                <Avatar name={user.username} />
                <View style={{ flex: 1 }}>
                  <Text style={friendStyles.userName}>{user.username}</Text>
                  <Text style={friendStyles.userSub}>{user.email}</Text>
                </View>
                <TouchableOpacity style={friendStyles.addBtn} onPress={() => handleSend(user.id)}>
                  <Text style={friendStyles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {debouncedQuery.trim().length > 0 && !searchLoading && searchResults.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 16 }}>
            <Text style={{ fontSize: 28, marginBottom: 6 }}>👤</Text>
            <Text style={{ fontSize: 14, color: "#64748b", fontWeight: "500" }}>No users found for "{debouncedQuery}"</Text>
            <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Try searching by username, not email</Text>
          </View>
        )}
      </View>

      {/* Pending requests */}
      {pending.length > 0 && (
        <View style={friendStyles.section}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={friendStyles.sectionTitle}>Requests</Text>
            <View style={friendStyles.countBadge}>
              <Text style={friendStyles.countBadgeText}>{pending.length}</Text>
            </View>
          </View>
          {pending.map((item) => (
            <View key={item.id} style={friendStyles.userRow}>
              <Avatar name={item.user?.username} />
              <View style={{ flex: 1 }}>
                <Text style={friendStyles.userName}>{item.user?.username}</Text>
                <Text style={friendStyles.userSub}>Wants to be friends</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity style={friendStyles.acceptBtn} onPress={() => handleAccept(item.id)}>
                  <Text style={{ color: "#16a34a", fontSize: 14, fontWeight: "700" }}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={friendStyles.rejectBtn} onPress={() => handleReject(item.id)}>
                  <Text style={{ color: "#dc2626", fontSize: 14, fontWeight: "700" }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Active friends */}
      {friends.filter((f) => friendStatuses[f.user?.id]).length > 0 && (
        <View style={[friendStyles.section, { backgroundColor: "#EFF6FF", borderLeftWidth: 3, borderLeftColor: "#38BDF8" }]}>
          <Text style={[friendStyles.sectionTitle, { color: "#2563EB" }]}>
            🟠 Out right now ({friends.filter((f) => friendStatuses[f.user?.id]).length})
          </Text>
          {friends.filter((f) => friendStatuses[f.user?.id]).map((item) => (
            <View key={item.id} style={[friendStyles.userRow, { alignItems: "flex-start" }]}>
              <Avatar name={item.user?.username} />
              <View style={{ flex: 1 }}>
                <Text style={friendStyles.userName}>{item.user?.username}</Text>
                <StatusPill status={friendStatuses[item.user.id]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Friends list */}
      <View style={friendStyles.section}>
        <Text style={friendStyles.sectionTitle}>My friends ({friends.length})</Text>
        {friends.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#64748b" }}>No friends yet</Text>
            <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, textAlign: "center" }}>Search for people above to connect!</Text>
          </View>
        ) : (
          friends.map((item) => (
            <View key={item.id} style={friendStyles.userRow}>
              <Avatar name={item.user?.username} />
              <View style={{ flex: 1 }}>
                <Text style={friendStyles.userName}>{item.user?.username}</Text>
                {friendStatuses[item.user?.id] ? (
                  <StatusPill status={friendStatuses[item.user.id]} />
                ) : (
                  <Text style={friendStyles.userSub}>{item.user?.email}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => handleRemove(item.id)}>
                <Text style={{ fontSize: 12, color: "#ef4444", fontWeight: "500" }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────
// Root Social Hub Screen
// ─────────────────────────────────────────

export default function SocialHubScreen() {
  const navigation = useNavigation();
  const [activeSegment, setActiveSegment] = useState(0);

  useEffect(() => {
    navigation.setOptions({
      title: "Social Hub",
      headerRight: () => null,
    });
  }, [navigation]);

  return (
    <View style={hubStyles.screen}>
      {/* Segment picker */}
      <View style={hubStyles.segmentContainer}>
        <View style={hubStyles.segmentTrack}>
          {SEGMENTS.map((label, i) => {
            const isActive = activeSegment === i;
            return (
              <TouchableOpacity
                key={label}
                style={[hubStyles.segmentPill, isActive && hubStyles.segmentPillActive]}
                onPress={() => setActiveSegment(i)}
                activeOpacity={0.75}
              >
                <Text style={[hubStyles.segmentLabel, isActive && hubStyles.segmentLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeSegment === 0 && <BroadcastsSegment />}
        {activeSegment === 1 && <ChatsSegment />}
        {activeSegment === 2 && <FriendsSegment />}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────

const sharedStyles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  avatar: { justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "700" },
});

const hubStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F0F7FF" },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#F0F7FF",
  },
  segmentTrack: {
    flexDirection: "row",
    backgroundColor: "#DBEAFE",
    borderRadius: 12,
    padding: 4,
    gap: 2,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentPillActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  segmentLabelActive: {
    color: "#1C1C1E",
    fontWeight: "700",
  },
});

const broadcastStyles = StyleSheet.create({
  scroll: { padding: 16, gap: 10 },
  sortRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: "#DBEAFE",
  },
  sortPillActive: { backgroundColor: "#0EA5E9" },
  sortPillText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  sortPillTextActive: { color: "#fff" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardLeft: { width: 40, alignItems: "center" },
  cardEmoji: { fontSize: 28 },
  cardBody: { flex: 1, gap: 2 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  cardCreator: { fontSize: 12, color: "#6B7280" },
  cardMeta: { fontSize: 12, color: "#6B7280" },
  cardDate: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  cardAction: { alignItems: "flex-end", gap: 4 },

  distBadge: {
    backgroundColor: "#DBEAFE",
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  distBadgeText: { fontSize: 11, color: "#6B7280", fontWeight: "600" },

  joinBtn: {
    backgroundColor: "#0EA5E9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  joinBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  statusTag: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  deleteBtn: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteBtnText: { color: "#DC2626", fontSize: 12, fontWeight: "600" },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 2,
  },

  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1C1C1E", marginBottom: 6 },
  emptyHint: { fontSize: 13, color: "#6B7280" },

  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#0EA5E9",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0EA5E9",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabText: { fontSize: 28, color: "#fff", fontWeight: "300", lineHeight: 32 },

  // Modal / bottom sheet
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DBEAFE",
    marginBottom: 20,
  },
  sheetEmoji: { fontSize: 48, marginBottom: 8 },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#1C1C1E", textAlign: "center", marginBottom: 4 },
  sheetCreator: { fontSize: 14, color: "#6B7280", marginBottom: 12 },
  sheetDesc: { fontSize: 14, color: "#374151", textAlign: "center", marginBottom: 16, lineHeight: 20 },
  sheetMeta: { width: "100%", gap: 8, marginBottom: 20 },
  sheetMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sheetMetaIcon: { fontSize: 16 },
  sheetMetaText: { fontSize: 14, color: "#374151" },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 12,
    width: "100%",
    alignItems: "center",
  },
  joinBtnLarge: {
    backgroundColor: "#0EA5E9",
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  joinBtnLargeText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  closeBtn: {
    paddingVertical: 10,
  },
  closeBtnText: { color: "#9CA3AF", fontSize: 14 },
});

const chatStyles = StyleSheet.create({
  list: { padding: 16, gap: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  userName: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  timeText: { fontSize: 11, color: "#9CA3AF" },
  broadcastSub: { fontSize: 12, color: "#0EA5E9", fontWeight: "500", marginTop: 2 },
  lastMsg: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  lastMsgBold: { color: "#1C1C1E", fontWeight: "600" },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "#F0F7FF",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1C1C1E", marginBottom: 6 },
  emptyHint: { fontSize: 13, color: "#6B7280" },
});

const friendStyles = StyleSheet.create({
  scroll: { padding: 16, gap: 12 },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 },
  countBadge: { backgroundColor: "#2563EB", borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  countBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 2,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  userName: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  userSub: { fontSize: 12, color: "#94a3b8", marginTop: 1 },
  addBtn: { backgroundColor: "#2563EB", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  acceptBtn: {
    backgroundColor: "#dcfce7", borderRadius: 8,
    width: 34, height: 34, justifyContent: "center", alignItems: "center",
  },
  rejectBtn: {
    backgroundColor: "#fee2e2", borderRadius: 8,
    width: 34, height: 34, justifyContent: "center", alignItems: "center",
  },
});

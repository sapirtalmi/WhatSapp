import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
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

const ACTIVITY_EMOJIS = { coffee:"☕", drinks:"🍺", study:"📚", hike:"🥾", food:"🍕", event:"🎉", hangout:"🛋️", work:"💼", other:"🌀" };

function timeLeft(expiresAt) {
  const diff = Math.max(0, new Date(expiresAt) - Date.now());
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h left`;
}

function StatusPill({ status }) {
  const isLive = status.mode === "live";
  const accent = isLive ? "#F4743B" : "#7C5CBF";
  const bg = isLive ? "#FFF4EE" : "#F5F0FF";
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

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function Avatar({ name, size = 40 }) {
  const letter = name?.[0]?.toUpperCase() ?? "?";
  const colors = ["#6366f1", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
  const color = colors[name?.charCodeAt(0) % colors.length ?? 0];
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{letter}</Text>
    </View>
  );
}

export default function FriendsScreen() {
  const navigation = useNavigation();
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friendStatuses, setFriendStatuses] = useState({});

  const debouncedQuery = useDebounce(searchQuery);

  function loadFriends() {
    setLoading(true);
    Promise.all([getFriends(), getPendingRequests()])
      .then(([f, p]) => { setFriends(f); setPending(p); })
      .catch(() => Alert.alert("Error", "Failed to load friends."))
      .finally(() => setLoading(false));
    getStatusFeed()
      .then(feed => {
        const map = {};
        (feed || []).forEach(s => { map[s.user_id] = s; });
        setFriendStatuses(map);
      })
      .catch(() => {});
  }

  useEffect(() => { loadFriends(); }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={loadFriends} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
          <Text style={{ fontSize: 22, color: "#4f46e5", fontWeight: "600", marginRight: 4 }}>↻</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

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
    } catch { Alert.alert("Error", "Could not accept."); }
  }

  async function handleReject(friendshipId) {
    try {
      await rejectFriendRequest(friendshipId);
      setPending((prev) => prev.filter((p) => p.id !== friendshipId));
    } catch { Alert.alert("Error", "Could not reject."); }
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
          } catch { Alert.alert("Error", "Could not remove."); }
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#4f46e5" /></View>;
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Search section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Find people</Text>
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username…"
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); }}>
                <Text style={styles.clearBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {searchLoading && (
            <View style={styles.searchStatus}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={styles.searchStatusText}>Searching…</Text>
            </View>
          )}

          {searchResults.length > 0 && (
            <View style={styles.resultsList}>
              {searchResults.map((user) => (
                <View key={user.id} style={styles.userRow}>
                  <Avatar name={user.username} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.username}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                  </View>
                  <TouchableOpacity style={styles.addBtn} onPress={() => handleSend(user.id)}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {debouncedQuery.trim().length > 0 && !searchLoading && searchResults.length === 0 && (
            <View style={styles.emptySearch}>
              <Text style={styles.emptySearchIcon}>👤</Text>
              <Text style={styles.emptySearchText}>No users found for "{debouncedQuery}"</Text>
              <Text style={styles.emptySearchHint}>Try searching by username, not email</Text>
            </View>
          )}
        </View>

        {/* Pending requests */}
        {pending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Requests</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pending.length}</Text>
              </View>
            </View>
            {pending.map((item) => (
              <View key={item.id} style={styles.userRow}>
                <Avatar name={item.user?.username} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.user?.username}</Text>
                  <Text style={styles.userEmail}>Wants to be friends</Text>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.id)}>
                    <Text style={styles.acceptBtnText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
                    <Text style={styles.rejectBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Active friends banner */}
        {friends.filter(f => friendStatuses[f.user?.id]).length > 0 && (
          <View style={[styles.section, { backgroundColor: "#FFF8F5", borderLeftWidth: 3, borderLeftColor: "#F4743B" }]}>
            <Text style={[styles.sectionTitle, { color: "#F4743B" }]}>
              🟠 Out right now ({friends.filter(f => friendStatuses[f.user?.id]).length})
            </Text>
            {friends.filter(f => friendStatuses[f.user?.id]).map(item => (
              <View key={item.id} style={[styles.userRow, { alignItems: "flex-start" }]}>
                <Avatar name={item.user?.username} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.user?.username}</Text>
                  <StatusPill status={friendStatuses[item.user.id]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Friends list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My friends ({friends.length})</Text>
          {friends.length === 0 ? (
            <View style={styles.emptyFriends}>
              <Text style={styles.emptyFriendsIcon}>👥</Text>
              <Text style={styles.emptyFriendsText}>No friends yet</Text>
              <Text style={styles.emptyFriendsHint}>Search for people above to connect!</Text>
            </View>
          ) : (
            friends.map((item) => (
              <View key={item.id} style={styles.userRow}>
                <Avatar name={item.user?.username} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.user?.username}</Text>
                  {friendStatuses[item.user?.id] ? (
                    <StatusPill status={friendStatuses[item.user.id]} />
                  ) : (
                    <Text style={styles.userEmail}>{item.user?.email}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleRemove(item.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

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
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { backgroundColor: "#4f46e5", borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 2,
    gap: 8,
  },
  searchIcon: { fontSize: 14, color: "#94a3b8" },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 10,
  },
  clearBtn: { fontSize: 14, color: "#94a3b8", padding: 4 },

  searchStatus: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  searchStatusText: { fontSize: 13, color: "#94a3b8" },

  resultsList: { gap: 2 },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  avatar: { justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "700" },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  userEmail: { fontSize: 12, color: "#94a3b8", marginTop: 1 },

  addBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  actionRow: { flexDirection: "row", gap: 6 },
  acceptBtn: {
    backgroundColor: "#dcfce7",
    borderRadius: 8,
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptBtnText: { color: "#16a34a", fontSize: 14, fontWeight: "700" },
  rejectBtn: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectBtnText: { color: "#dc2626", fontSize: 14, fontWeight: "700" },

  removeText: { fontSize: 12, color: "#ef4444", fontWeight: "500" },

  emptySearch: { alignItems: "center", paddingVertical: 16 },
  emptySearchIcon: { fontSize: 28, marginBottom: 6 },
  emptySearchText: { fontSize: 14, color: "#64748b", fontWeight: "500" },
  emptySearchHint: { fontSize: 12, color: "#94a3b8", marginTop: 4 },

  emptyFriends: { alignItems: "center", paddingVertical: 20 },
  emptyFriendsIcon: { fontSize: 32, marginBottom: 8 },
  emptyFriendsText: { fontSize: 15, fontWeight: "600", color: "#64748b" },
  emptyFriendsHint: { fontSize: 12, color: "#94a3b8", marginTop: 4, textAlign: "center" },
});

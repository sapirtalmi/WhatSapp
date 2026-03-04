import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SectionList,
} from "react-native";
import {
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
} from "../../src/api/friends";

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function FriendsScreen() {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  const debouncedQuery = useDebounce(searchQuery);

  useEffect(() => {
    Promise.all([getFriends(), getPendingRequests()])
      .then(([f, p]) => { setFriends(f); setPending(p); })
      .catch(() => Alert.alert("Error", "Failed to load friends."))
      .finally(() => setLoading(false));
  }, []);

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
        text: "Remove",
        style: "destructive",
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
    return <View style={styles.center}><ActivityIndicator color="#4f46e5" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <SectionList
        contentContainerStyle={{ padding: 16 }}
        sections={[
          {
            title: "Find people",
            data: [{ key: "search" }],
            renderItem: () => (
              <View style={styles.section}>
                <TextInput
                  style={styles.input}
                  placeholder="Search by username…"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                />
                {searchLoading && <Text style={styles.hint}>Searching…</Text>}
                {searchResults.map((user) => (
                  <View key={user.id} style={styles.row}>
                    <Text style={styles.name}>{user.username}</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={() => handleSend(user.id)}>
                      <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {debouncedQuery && !searchLoading && searchResults.length === 0 && (
                  <Text style={styles.hint}>No users found.</Text>
                )}
              </View>
            ),
          },
          ...(pending.length > 0
            ? [{
                title: `Requests (${pending.length})`,
                data: pending,
                renderItem: ({ item }) => (
                  <View style={[styles.row, styles.section]}>
                    <Text style={styles.name}>{item.user.username}</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.id)}>
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleReject(item.id)}>
                        <Text style={styles.rejectText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ),
              }]
            : []),
          {
            title: `My friends (${friends.length})`,
            data: friends.length ? friends : [{ key: "empty" }],
            renderItem: ({ item }) =>
              item.key === "empty" ? (
                <Text style={styles.hint}>No friends yet — search above!</Text>
              ) : (
                <View style={[styles.row, styles.section]}>
                  <Text style={styles.name}>{item.user.username}</Text>
                  <TouchableOpacity onPress={() => handleRemove(item.id)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ),
          },
        ]}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        keyExtractor={(item, i) => item.id?.toString() ?? item.key ?? String(i)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  hint: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 14, fontWeight: "500", color: "#111827" },
  addBtn: { backgroundColor: "#4f46e5", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  acceptBtn: { backgroundColor: "#16a34a", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 },
  acceptBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  rejectText: { fontSize: 12, color: "#6b7280", paddingVertical: 5 },
  removeText: { fontSize: 12, color: "#ef4444" },
});

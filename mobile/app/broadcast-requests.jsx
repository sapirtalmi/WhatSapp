import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { getMyBroadcasts, getBroadcastRequests, updateRequest } from "../src/api/broadcasts";

const AVATAR_COLORS = ["#6366f1", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
function avatarColor(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

export default function BroadcastRequestsScreen() {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      const myBroadcasts = await getMyBroadcasts();
      const results = [];
      await Promise.all(
        myBroadcasts.map(async (broadcast) => {
          try {
            const requests = await getBroadcastRequests(broadcast.id);
            const pending = requests.filter((r) => r.status === "pending");
            if (pending.length > 0) {
              results.push({ broadcast, requests: pending });
            }
          } catch {}
        })
      );
      setGroups(results);
    } catch (err) {
      Alert.alert("Error", "Could not load requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function handleAction(broadcastId, requestId, status) {
    setProcessingId(requestId);
    try {
      await updateRequest(broadcastId, requestId, status);
      if (status === "accepted") {
        Alert.alert("Chat unlocked!", "You can now chat with this person.", [
          { text: "Go to Chats", onPress: () => router.push("/chats") },
          { text: "Stay here" },
        ]);
      }
      // Remove the request from the list
      setGroups((prev) =>
        prev
          .map((g) => ({
            ...g,
            requests: g.requests.filter((r) => r.id !== requestId),
          }))
          .filter((g) => g.requests.length > 0)
      );
    } catch (err) {
      const detail = err?.response?.data?.detail;
      Alert.alert("Error", detail ? String(detail) : "Could not process request.");
    } finally {
      setProcessingId(null);
    }
  }

  function renderRequest({ item: req, broadcast }) {
    const initial = (req.requester_username?.[0] ?? "?").toUpperCase();
    const bg = avatarColor(req.requester_username);
    const isProcessing = processingId === req.id;
    return (
      <View style={styles.card}>
        {/* Avatar + name */}
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: bg }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>@{req.requester_username}</Text>
            {req.requester_bio ? (
              <Text style={styles.bio} numberOfLines={1}>{req.requester_bio}</Text>
            ) : null}
          </View>
        </View>

        {/* Broadcast label */}
        <View style={styles.broadcastChip}>
          <Ionicons name="radio-outline" size={13} color="#0EA5E9" />
          <Text style={styles.broadcastChipText} numberOfLines={1}>
            Wants to join: {broadcast.title}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.declineBtn, isProcessing && { opacity: 0.5 }]}
            onPress={() => handleAction(broadcast.id, req.id, "declined")}
            disabled={isProcessing}
          >
            <Ionicons name="close-outline" size={16} color="#ef4444" />
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn, isProcessing && { opacity: 0.5 }]}
            onPress={() => handleAction(broadcast.id, req.id, "accepted")}
            disabled={isProcessing}
          >
            {isProcessing
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Ionicons name="checkmark-outline" size={16} color="#fff" />
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  // Flatten into a list of { req, broadcast } for the FlatList
  const flatItems = groups.flatMap((g) =>
    g.requests.map((req) => ({ req, broadcast: g.broadcast }))
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {flatItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptySubtitle}>
            When friends request to join your broadcasts, they'll appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatItems}
          keyExtractor={(item) => String(item.req.id)}
          renderItem={({ item }) => renderRequest({ item: item.req, broadcast: item.broadcast })}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadRequests(); }}
              tintColor="#0EA5E9"
            />
          }
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              {flatItems.length} pending request{flatItems.length !== 1 ? "s" : ""}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0F7FF" },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1C1C1E", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 },

  listHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A09A93",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  username: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  bio: { fontSize: 12, color: "#6B7280", marginTop: 1 },

  broadcastChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#0EA5E930",
  },
  broadcastChipText: { fontSize: 12, color: "#0EA5E9", fontWeight: "600" },

  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  declineBtn: {
    backgroundColor: "#FFF0F0",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  declineBtnText: { fontSize: 14, fontWeight: "600", color: "#ef4444" },
  acceptBtn: {
    backgroundColor: "#2563EB",
  },
  acceptBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});

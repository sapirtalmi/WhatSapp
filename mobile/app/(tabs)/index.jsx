import { useEffect, useState } from "react";
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { getFeed } from "../../src/api/feed";

const PAGE_SIZE = 20;

const TYPE_LABELS = { food: "🍽 Food", travel: "✈️ Travel", shop: "🛍 Shop", hangout: "☕️ Hangout" };

function PlaceCard({ place }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.cardName}>{place.name}</Text>
        {place.type && (
          <Text style={styles.badge}>{TYPE_LABELS[place.type] ?? place.type}</Text>
        )}
      </View>
      {place.address ? <Text style={styles.cardSub}>{place.address}</Text> : null}
      {place.description ? <Text style={styles.cardDesc} numberOfLines={2}>{place.description}</Text> : null}
      <Text style={styles.cardCoords}>
        {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
      </Text>
    </View>
  );
}

export default function FeedScreen() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");

  function load(offset = 0, reset = false) {
    if (offset === 0) setLoading(true);
    return getFeed(PAGE_SIZE, offset)
      .then((data) => {
        setPlaces((prev) => (reset || offset === 0 ? data : [...prev, ...data]));
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch(() => setError("Failed to load feed."))
      .finally(() => { setLoading(false); setRefreshing(false); setLoadingMore(false); });
  }

  useEffect(() => { load(); }, []);

  function onRefresh() {
    setRefreshing(true);
    load(0, true);
  }

  function onEndReached() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    load(places.length);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (places.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Your feed is empty.</Text>
        <Text style={styles.emptyHint}>Add friends or create public collections.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={places}
      keyExtractor={(p) => String(p.id)}
      renderItem={({ item }) => <PlaceCard place={item} />}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        loadingMore ? <ActivityIndicator style={{ margin: 16 }} color="#4f46e5" /> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 10,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardName: { fontSize: 15, fontWeight: "600", color: "#111827", flex: 1 },
  badge: {
    fontSize: 11,
    backgroundColor: "#eef2ff",
    color: "#4f46e5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    overflow: "hidden",
    marginLeft: 8,
  },
  cardSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  cardDesc: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  cardCoords: { fontSize: 10, color: "#d1d5db", marginTop: 6 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { fontSize: 17, fontWeight: "600", color: "#6b7280" },
  emptyHint: { fontSize: 13, color: "#9ca3af", marginTop: 6, textAlign: "center" },
});

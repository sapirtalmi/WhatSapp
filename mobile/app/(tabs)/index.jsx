import { useEffect, useState } from "react";
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getFeed } from "../../src/api/feed";

const PAGE_SIZE = 20;

const TYPE_FILTERS = [
  { value: null, label: "All", color: "#6366f1" },
  { value: "food", label: "🍽 Food", color: "#f97316" },
  { value: "travel", label: "✈️ Travel", color: "#3b82f6" },
  { value: "shop", label: "🛍 Shop", color: "#a855f7" },
  { value: "hangout", label: "☕️ Hangout", color: "#22c55e" },
];

const TYPE_BORDER = {
  food: "#f97316",
  travel: "#3b82f6",
  shop: "#a855f7",
  hangout: "#22c55e",
};

const TYPE_BADGE = {
  food: { bg: "#fff7ed", text: "#c2410c" },
  travel: { bg: "#eff6ff", text: "#1d4ed8" },
  shop: { bg: "#faf5ff", text: "#7e22ce" },
  hangout: { bg: "#f0fdf4", text: "#15803d" },
};

function PlaceCard({ place }) {
  const borderColor = TYPE_BORDER[place.type] ?? "#6366f1";
  const badge = TYPE_BADGE[place.type];
  const typeLabel = TYPE_FILTERS.find((f) => f.value === place.type)?.label;

  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
      <View style={styles.cardRow}>
        <Text style={styles.cardName} numberOfLines={1}>{place.name}</Text>
        {place.type && badge && (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{typeLabel}</Text>
          </View>
        )}
      </View>
      {place.address ? <Text style={styles.cardSub} numberOfLines={1}>{place.address}</Text> : null}
      {place.description ? <Text style={styles.cardDesc} numberOfLines={2}>{place.description}</Text> : null}
      {(place.collection_title || place.owner_username) ? (
        <Text style={styles.cardMeta}>
          {place.collection_title ? `📚 ${place.collection_title}` : ""}
          {place.collection_title && place.owner_username ? "  ·  " : ""}
          {place.owner_username ? `by ${place.owner_username}` : ""}
        </Text>
      ) : null}
    </View>
  );
}

export default function FeedScreen() {
  const navigation = useNavigation();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [activeType, setActiveType] = useState(null);

  function load(offset, type, reset) {
    if (offset === 0 && !refreshing) setLoading(true);
    return getFeed(PAGE_SIZE, offset, type)
      .then((data) => {
        setPlaces((prev) => (reset || offset === 0 ? data : [...prev, ...data]));
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch(() => setError("Failed to load feed."))
      .finally(() => { setLoading(false); setRefreshing(false); setLoadingMore(false); });
  }

  useEffect(() => {
    load(0, activeType, true);
  }, [activeType]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
          <Text style={{ fontSize: 22, color: "#4f46e5", fontWeight: "600", marginRight: 4 }}>↻</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, activeType]);

  function onRefresh() {
    setRefreshing(true);
    load(0, activeType, true);
  }

  function onEndReached() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    load(places.length, activeType, false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Type filter chips */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {TYPE_FILTERS.map((f) => (
            <TouchableOpacity
              key={String(f.value)}
              style={[
                styles.filterChip,
                activeType === f.value && { backgroundColor: f.color, borderColor: f.color },
              ]}
              onPress={() => setActiveType(f.value)}
            >
              <Text style={[styles.filterChipText, activeType === f.value && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={places}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => <PlaceCard place={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>🗺</Text>
            <Text style={styles.emptyText}>Your feed is empty.</Text>
            <Text style={styles.emptyHint}>Add friends or create public collections.</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.moreLoader} color="#4f46e5" /> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  filterBar: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 10,
  },
  filterScroll: { paddingHorizontal: 12, flexDirection: "row", gap: 8 },
  filterChip: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  filterChipText: { fontSize: 12, color: "#64748b", fontWeight: "500" },
  filterChipTextActive: { color: "#fff" },
  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 4,
    marginBottom: 10,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardName: { fontSize: 15, fontWeight: "600", color: "#0f172a", flex: 1 },
  badge: {
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: "600" },
  cardSub: { fontSize: 12, color: "#64748b", marginTop: 3 },
  cardDesc: { fontSize: 12, color: "#94a3b8", marginTop: 4, lineHeight: 17 },
  cardMeta: { fontSize: 10, color: "#6366f1", marginTop: 6 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 17, fontWeight: "600", color: "#64748b" },
  emptyHint: { fontSize: 13, color: "#94a3b8", marginTop: 6, textAlign: "center" },
  errorText: { color: "#ef4444", padding: 12, textAlign: "center" },
  moreLoader: { margin: 16 },
});

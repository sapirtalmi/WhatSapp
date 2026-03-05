import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { getFriends } from "../../src/api/friends";
import { getGlobalPlaces } from "../../src/api/places";

const TYPE_FILTERS = [
  { value: null, label: "All types", color: "#6366f1" },
  { value: "food", label: "🍽 Food", color: "#f97316" },
  { value: "travel", label: "✈️ Travel", color: "#3b82f6" },
  { value: "exercise", label: "🏋 Exercise", color: "#ef4444" },
  { value: "shop", label: "🛍 Shop", color: "#a855f7" },
  { value: "hangout", label: "☕ Hangout", color: "#22c55e" },
];

const TYPE_COLORS = {
  food: "#f97316",
  travel: "#3b82f6",
  exercise: "#ef4444",
  shop: "#a855f7",
  hangout: "#22c55e",
};

const DEFAULT_REGION = {
  latitude: 32.0853,
  longitude: 34.7818,
  latitudeDelta: 20,
  longitudeDelta: 20,
};

function markerColor(type) {
  return TYPE_COLORS[type] ?? "#6366f1";
}

export default function FeedMapScreen() {
  const mapRef = useRef(null);

  const [friends, setFriends] = useState([]);
  const [selectedUser, setSelectedUser] = useState("all"); // "all" | "mine" | friendId(int)
  const [activeType, setActiveType] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load friends once on mount
  useEffect(() => {
    getFriends()
      .then((fs) => setFriends(fs))
      .catch(() => {});
  }, []);

  // Load places whenever filter changes
  const loadPlaces = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (activeType) params.type = activeType;

      if (selectedUser === "mine") {
        params.source = "mine";
        setPlaces(await getGlobalPlaces(params));
      } else if (selectedUser === "all") {
        // Own + all friends merged, deduplicated
        const [mine, friendsPlaces] = await Promise.all([
          getGlobalPlaces({ ...params, source: "mine" }),
          getGlobalPlaces({ ...params, source: "friends" }),
        ]);
        const seen = new Set();
        const merged = [...mine, ...friendsPlaces].filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        setPlaces(merged);
      } else {
        // Specific friend
        params.owner_id = selectedUser;
        setPlaces(await getGlobalPlaces(params));
      }
    } catch {
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [selectedUser, activeType]);

  useEffect(() => {
    loadPlaces();
  }, [loadPlaces]);

  // Fly to first place when data first loads
  useEffect(() => {
    if (places.length > 0 && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: places[0].lat,
          longitude: places[0].lng,
          latitudeDelta: 15,
          longitudeDelta: 15,
        },
        600
      );
    }
  }, [places.length > 0]);

  return (
    <View style={styles.screen}>
      {/* ── Floating filter panel ─────────────────────────────────────── */}
      <View style={styles.filterPanel}>
        {/* Row 1: user filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {/* "All" chip */}
          <TouchableOpacity
            onPress={() => setSelectedUser("all")}
            style={[styles.chip, selectedUser === "all" && styles.chipActiveIndigo]}
          >
            <Text style={[styles.chipText, selectedUser === "all" && styles.chipTextActive]}>
              🌍 All
            </Text>
          </TouchableOpacity>

          {/* "Mine" chip */}
          <TouchableOpacity
            onPress={() => setSelectedUser("mine")}
            style={[styles.chip, selectedUser === "mine" && styles.chipActiveMine]}
          >
            <Text style={[styles.chipText, selectedUser === "mine" && styles.chipTextActive]}>
              👤 Mine
            </Text>
          </TouchableOpacity>

          {/* Friend chips */}
          {friends.map((f) => {
            const isActive = selectedUser === f.user.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setSelectedUser(isActive ? "all" : f.user.id)}
                style={[styles.chip, isActive && styles.chipActiveFriend]}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {f.user.username}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Row 2: type filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {TYPE_FILTERS.map((t) => {
            const isActive = activeType === t.value;
            return (
              <TouchableOpacity
                key={String(t.value)}
                onPress={() => setActiveType(t.value)}
                style={[
                  styles.chip,
                  isActive && { backgroundColor: t.color, borderColor: t.color },
                ]}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Badge: place count + spinner ──────────────────────────────── */}
      <View style={styles.badge}>
        {loading ? (
          <ActivityIndicator size="small" color="#6366f1" />
        ) : (
          <Text style={styles.badgeText}>
            {places.length} place{places.length !== 1 ? "s" : ""}
          </Text>
        )}
      </View>

      {/* ── Map ───────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsCompass
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            pinColor={markerColor(place.type)}
          >
            <Callout tooltip={false}>
              <View style={styles.callout}>
                <Text style={styles.calloutName} numberOfLines={1}>{place.name}</Text>
                {place.address ? (
                  <Text style={styles.calloutSub} numberOfLines={1}>{place.address}</Text>
                ) : null}
                {place.collection_title ? (
                  <Text style={styles.calloutMeta} numberOfLines={1}>
                    📚 {place.collection_title}
                    {place.owner_username ? ` · ${place.owner_username}` : ""}
                  </Text>
                ) : null}
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Filter panel (floating over map)
  filterPanel: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 18,
    marginHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    gap: 6,
    alignItems: "center",
  },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 6, marginHorizontal: 10 },

  chip: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  chipActiveIndigo: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  chipActiveMine:   { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  chipActiveFriend: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  chipText: { fontSize: 12, color: "#475569", fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  // Count badge (bottom-left)
  badge: {
    position: "absolute",
    bottom: 24,
    left: 16,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    minWidth: 64,
    alignItems: "center",
  },
  badgeText: { fontSize: 12, color: "#475569", fontWeight: "600" },

  // Callout
  callout: { maxWidth: 220, padding: 2 },
  calloutName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  calloutSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  calloutMeta: { fontSize: 11, color: "#6366f1", marginTop: 4 },
});

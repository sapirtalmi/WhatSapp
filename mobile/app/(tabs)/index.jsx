import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  TextInput,
  Keyboard,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Alert,
  Animated,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { getFriends } from "../../src/api/friends";
import { getGlobalPlaces, createPlace } from "../../src/api/places";
import { getLocationInfo, getRecommendations, naturalSearch } from "../../src/api/ai";
import { createStatus, getStatusFeed, getMyStatus, updateStatus, rsvpStatus } from "../../src/api/status";
import api from "../../src/api/axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

const MAP_TYPES = [
  { value: "standard",  icon: "🗺",  label: "Map" },
  { value: "satellite", icon: "🛰",  label: "Satellite" },
  { value: "hybrid",    icon: "🌐",  label: "Hybrid" },
];

const TYPE_FILTERS = [
  { value: null,       label: "All",      color: "#2dd4bf" },
  { value: "food",     label: "🍽 Food",  color: "#f97316" },
  { value: "travel",   label: "✈️ Travel",color: "#3b82f6" },
  { value: "exercise", label: "🏋 Gym",   color: "#ef4444" },
  { value: "shop",     label: "🛍 Shop",  color: "#a855f7" },
  { value: "hangout",  label: "☕ Hangout",color: "#22c55e" },
];

const TYPE_COLORS = {
  food: "#f97316", travel: "#3b82f6", exercise: "#ef4444",
  shop: "#a855f7", hangout: "#22c55e",
};

const DEFAULT_REGION = {
  latitude: 32.0853, longitude: 34.7818,
  latitudeDelta: 12, longitudeDelta: 12,
};

const AVATAR_COLORS = ["#2dd4bf","#f97316","#22c55e","#3b82f6","#a855f7","#ec4899"];
function avatarColor(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

function DotMarker({ color }) {
  return (
    <View style={{
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: color,
      borderWidth: 2, borderColor: "#fff",
      shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 3,
      elevation: 3,
    }} />
  );
}

function FilterChip({ label, active, color, onPress, initial, avatarBg }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        active && { backgroundColor: color, borderColor: color },
      ]}
    >
      {initial ? (
        <View style={[styles.chipAvatar, { backgroundColor: active ? "rgba(255,255,255,0.3)" : avatarBg }]}>
          <Text style={styles.chipAvatarText}>{initial}</Text>
        </View>
      ) : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AICard({ icon, title, text }) {
  return (
    <View style={styles.aiCard}>
      <Text style={styles.aiCardTitle}>{icon}  {title}</Text>
      <Text style={styles.aiCardText}>{text}</Text>
    </View>
  );
}

// ── Status helpers ─────────────────────────────────────────────────────────────
const ACTIVITY_ICONS = {
  coffee:  "cafe-outline",
  drinks:  "wine-outline",
  study:   "book-outline",
  hike:    "walk-outline",
  food:    "restaurant-outline",
  event:   "star-outline",
  hangout: "people-outline",
  work:    "briefcase-outline",
  other:   "ellipsis-horizontal-circle-outline",
};

function timeLeft(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return "expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── PulsingMarker ──────────────────────────────────────────────────────────────
function PulsingMarker({ color }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.0, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 1200, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        position: "absolute", width: 28, height: 28, borderRadius: 14,
        backgroundColor: color, opacity, transform: [{ scale }],
      }} />
      <View style={{
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: color, borderWidth: 2.5, borderColor: "#fff",
        shadowColor: color, shadowOpacity: 0.45, shadowRadius: 6, elevation: 5,
      }} />
    </View>
  );
}

// ── PostStatusModal ────────────────────────────────────────────────────────────
function PostStatusModal({ visible, onClose, myStatus, onPosted, pinnedLocation, onPickLocation }) {
  const [mode, setMode] = useState("live");
  const [activityType, setActivityType] = useState("coffee");
  const [message, setMessage] = useState("");
  const [locationName, setLocationName] = useState("");
  const [expiry, setExpiry] = useState("1h");
  const [planDate, setPlanDate] = useState(new Date(Date.now() + 86400000));
  const [visibility, setVisibility] = useState("friends");
  const [posting, setPosting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customExpiryDate, setCustomExpiryDate] = useState(new Date(Date.now() + 7200000)); // 2h default
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null);

  // Pre-fetch GPS when modal opens
  useEffect(() => {
    if (visible) {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((pos) => setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
        .catch(() => {});
    }
  }, [visible]);

  // Sync location name from map pin
  useEffect(() => {
    if (pinnedLocation?.name) setLocationName(pinnedLocation.name);
  }, [pinnedLocation]);

  const effectiveLoc = pinnedLocation ?? gpsLocation;

  const handlePost = async () => {
    if (!effectiveLoc) {
      Alert.alert("Location needed", "Could not get your location. Please allow location access or pick a point on the map.");
      return;
    }
    setPosting(true);
    try {
      const body = {
        mode,
        activity_type: activityType,
        message: message.trim() || null,
        lat: effectiveLoc.lat,
        lng: effectiveLoc.lng,
        location_name: locationName.trim() || null,
        expires_at: mode === "live"
          ? (expiry === "custom" ? customExpiryDate.toISOString() : expiry)
          : planDate.toISOString(),
        visibility,
      };
      await createStatus(body);
      onPosted();
      onClose();
      setMessage("");
      setLocationName("");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join("\n")
        : detail ? String(detail) : (err?.message || "Could not post status. Try again.");
      Alert.alert("Error", msg);
    } finally {
      setPosting(false);
    }
  };

  const activities = [
    ["coffee", "Coffee"], ["drinks", "Drinks"], ["study", "Study"],
    ["hike", "Hike"], ["food", "Food"], ["event", "Event"],
    ["hangout", "Hangout"], ["work", "Work"], ["other", "Other"],
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ flex: 1, backgroundColor: "#F7F5F0" }}>
          {/* Header */}
          <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
            backgroundColor: "#FFFFFF",
            borderBottomWidth: 1, borderBottomColor: "#EDE9E3",
          }}>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: "#6B7280", fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontWeight: "600", fontSize: 17, color: "#1C1C1E" }}>Where are you?</Text>
            <TouchableOpacity onPress={handlePost} disabled={posting}>
              <Text style={{ color: posting ? "#9CA3AF" : "#00A878", fontWeight: "700", fontSize: 16 }}>
                {posting ? "Posting…" : "Post"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            {/* Mode toggle */}
            <View style={{ flexDirection: "row", backgroundColor: "#EDE9E3", borderRadius: 50, padding: 4 }}>
              {[["live", "Live Now", "radio-button-on-outline"], ["plan", "Future Plan", "calendar-outline"]].map(([m, label, icon]) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMode(m)}
                  style={{
                    flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 50,
                    flexDirection: "row", justifyContent: "center", gap: 6,
                    backgroundColor: mode === m ? "#fff" : "transparent",
                    shadowColor: mode === m ? "#000" : "transparent",
                    shadowOpacity: mode === m ? 0.08 : 0, shadowRadius: 6, elevation: mode === m ? 3 : 0,
                  }}
                >
                  <Ionicons name={icon} size={15} color={mode === m ? "#1C1C1E" : "#9CA3AF"} />
                  <Text style={{ fontWeight: "600", color: mode === m ? "#1C1C1E" : "#6B7280" }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Activity type selector */}
            <View>
              <Text style={{ fontWeight: "700", color: "#A09A93", marginBottom: 10, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>ACTIVITY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {activities.map(([type, label]) => {
                    const selected = activityType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setActivityType(type)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 50,
                          backgroundColor: selected ? "#E8F7F2" : "#fff",
                          borderWidth: 1.5, borderColor: selected ? "#00A878" : "#EDE9E3",
                          alignItems: "center", minWidth: 66,
                        }}
                      >
                        <Ionicons
                          name={ACTIVITY_ICONS[type]}
                          size={20}
                          color={selected ? "#00A878" : "#9CA3AF"}
                        />
                        <Text style={{ fontSize: 10, fontWeight: "600", color: selected ? "#00A878" : "#6B7280", marginTop: 4 }}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Message */}
            <View style={{
              backgroundColor: "#fff", borderRadius: 16, padding: 14,
              shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
            }}>
              <TextInput
                placeholder="Say something… (optional)"
                placeholderTextColor="#9CA3AF"
                value={message}
                onChangeText={setMessage}
                maxLength={280}
                multiline
                style={{ color: "#1C1C1E", fontSize: 15, minHeight: 60 }}
              />
            </View>

            {/* Location row */}
            <View style={{
              backgroundColor: "#fff", borderRadius: 16,
              shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
              overflow: "hidden",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", padding: 14 }}>
                <Ionicons name="location-outline" size={18} color="#00A878" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Location name (optional)"
                  placeholderTextColor="#9CA3AF"
                  value={locationName}
                  onChangeText={setLocationName}
                  style={{ flex: 1, color: "#1C1C1E", fontSize: 15 }}
                />
              </View>
              <View style={{ height: 1, backgroundColor: "#F3F0EA", marginHorizontal: 14 }} />
              <TouchableOpacity
                onPress={onPickLocation}
                style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 8 }}
              >
                <Ionicons name="map-outline" size={17} color="#7C5CBF" />
                <Text style={{ fontSize: 14, color: "#7C5CBF", fontWeight: "600" }}>
                  {pinnedLocation ? "Location pinned on map" : "Pin on map"}
                </Text>
                {pinnedLocation && (
                  <View style={{
                    marginLeft: "auto", backgroundColor: "#F0EBF8",
                    borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
                  }}>
                    <Text style={{ fontSize: 11, color: "#7C5CBF", fontWeight: "600" }}>
                      {pinnedLocation.lat.toFixed(4)}, {pinnedLocation.lng.toFixed(4)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Expiry - Live mode */}
            {mode === "live" && (
              <View>
                <Text style={{ fontWeight: "700", color: "#A09A93", marginBottom: 10, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>HOW LONG?</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {[["1h", "1 hr"], ["3h", "3 hrs"], ["tonight", "Tonight"], ["custom", "Custom…"]].map(([val, label]) => {
                    const sel = expiry === val;
                    return (
                      <TouchableOpacity
                        key={val}
                        onPress={() => { setExpiry(val); if (val === "custom") setShowCustomPicker(true); }}
                        style={{
                          flex: 1, minWidth: "22%", paddingVertical: 12, borderRadius: 50, alignItems: "center",
                          backgroundColor: sel ? "#FEF0EA" : "#fff",
                          borderWidth: 1.5, borderColor: sel ? "#F4743B" : "#EDE9E3",
                        }}
                      >
                        <Text style={{ fontWeight: "600", color: sel ? "#F4743B" : "#6B7280", fontSize: 13 }}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {expiry === "custom" && (
                  <>
                    <TouchableOpacity
                      onPress={() => setShowCustomPicker(true)}
                      style={{
                        marginTop: 10, backgroundColor: "#fff", borderRadius: 16, padding: 14,
                        flexDirection: "row", alignItems: "center", gap: 8,
                        shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
                      }}
                    >
                      <Ionicons name="time-outline" size={17} color="#F4743B" />
                      <Text style={{ color: "#1C1C1E", fontSize: 15 }}>
                        Until {customExpiryDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" · "}{customExpiryDate.toLocaleDateString([], { month: "short", day: "numeric" })}
                      </Text>
                    </TouchableOpacity>
                    {showCustomPicker && (
                      <DateTimePicker
                        value={customExpiryDate}
                        mode="datetime"
                        minimumDate={new Date()}
                        onChange={(e, date) => { setShowCustomPicker(false); if (date) setCustomExpiryDate(date); }}
                      />
                    )}
                  </>
                )}
              </View>
            )}

            {/* Date/time picker - Plan mode */}
            {mode === "plan" && (
              <View>
                <Text style={{ fontWeight: "700", color: "#A09A93", marginBottom: 10, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>WHEN?</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={{
                    backgroundColor: "#fff", borderRadius: 16, padding: 14,
                    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
                    flexDirection: "row", alignItems: "center", gap: 8,
                  }}
                >
                  <Ionicons name="calendar-outline" size={17} color="#00A878" />
                  <Text style={{ color: "#1C1C1E", fontSize: 15 }}>
                    {planDate.toLocaleDateString()} at {planDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={planDate}
                    mode="datetime"
                    minimumDate={new Date()}
                    onChange={(e, date) => { setShowDatePicker(false); if (date) setPlanDate(date); }}
                  />
                )}
              </View>
            )}

            {/* Visibility */}
            <View>
              <Text style={{ fontWeight: "700", color: "#A09A93", marginBottom: 10, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>VISIBILITY</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[["friends", "people-outline", "Friends only"], ["public", "earth-outline", "Public"]].map(([v, icon, label]) => {
                  const sel = visibility === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      onPress={() => setVisibility(v)}
                      style={{
                        flex: 1, paddingVertical: 12, borderRadius: 50, alignItems: "center",
                        flexDirection: "row", justifyContent: "center", gap: 6,
                        backgroundColor: sel ? "#F0EBF8" : "#fff",
                        borderWidth: 1.5, borderColor: sel ? "#7C5CBF" : "#EDE9E3",
                      }}
                    >
                      <Ionicons name={icon} size={15} color={sel ? "#7C5CBF" : "#9CA3AF"} />
                      <Text style={{ fontWeight: "600", color: sel ? "#7C5CBF" : "#6B7280", fontSize: 13 }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* End current status button */}
            {myStatus && (
              <TouchableOpacity
                onPress={async () => { await updateStatus(myStatus.id, { is_active: false }); onPosted(); onClose(); }}
                style={{ paddingVertical: 12, borderRadius: 50, alignItems: "center", backgroundColor: "#FFF0EE", flexDirection: "row", justifyContent: "center", gap: 6 }}
              >
                <Ionicons name="stop-circle-outline" size={16} color="#F4743B" />
                <Text style={{ color: "#F4743B", fontWeight: "600" }}>End Current Status</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const { user: currentUser } = useAuth();

  // Location
  const [locationReady, setLocationReady] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // Search
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchPin, setSearchPin] = useState(null);

  // Filters
  const [friends, setFriends] = useState([]);
  const [selectedUser, setSelectedUser] = useState("all");
  const [activeType, setActiveType] = useState(null);

  // Places
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);

  // Selection
  const [selectedPlace, setSelectedPlace] = useState(null);

  // AI location info
  const [locationInfo, setLocationInfo] = useState(null);
  const [locationInfoLoading, setLocationInfoLoading] = useState(false);

  // Natural language search
  const [nlMode, setNlMode] = useState(false);
  const [nlQuery, setNlQuery] = useState("");
  const [nlResults, setNlResults] = useState(null);
  const [nlLoading, setNlLoading] = useState(false);
  const [nlUseMapArea, setNlUseMapArea] = useState(false);
  const currentRegion = useRef(null);

  // Recommendations
  const [recommendations, setRecommendations] = useState(null);
  const [recsLoading, setRecsLoading] = useState(false);

  // Map type
  const [mapType, setMapType] = useState("standard");

  // Swipeable bottom sheet
  const { height: screenH } = useWindowDimensions();
  const PEEK_H = 130;
  const EXPANDED_H = Math.round(screenH * 0.55);
  const MAX_TRANSLATE = EXPANDED_H - PEEK_H;
  const sheetTranslateY = useRef(new Animated.Value(MAX_TRANSLATE)).current;
  const sheetStartY = useRef(MAX_TRANSLATE);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  function snapSheet(expand) {
    Animated.spring(sheetTranslateY, {
      toValue: expand ? 0 : MAX_TRANSLATE,
      useNativeDriver: true,
      tension: 68, friction: 11,
    }).start();
    setSheetExpanded(expand);
  }

  const sheetPan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dy) > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
    onPanResponderGrant: () => {
      sheetTranslateY.stopAnimation((val) => { sheetStartY.current = val; });
    },
    onPanResponderMove: (_, gs) => {
      const next = Math.max(0, Math.min(MAX_TRANSLATE, sheetStartY.current + gs.dy));
      sheetTranslateY.setValue(next);
    },
    onPanResponderRelease: (_, gs) => {
      const cur = sheetStartY.current + gs.dy;
      snapSheet(gs.vy < -0.4 || cur < MAX_TRANSLATE * 0.5);
    },
  })).current;

  // Statuses
  const [statuses, setStatuses] = useState([]);
  const [myStatus, setMyStatus] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [pickingStatusPin, setPickingStatusPin] = useState(false);
  const [pendingStatusPin, setPendingStatusPin] = useState(null);
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [statusRefreshing, setStatusRefreshing] = useState(false);

  // Add place
  const [pendingPin, setPendingPin] = useState(null);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [placeType, setPlaceType] = useState(null);
  const [addPhotos, setAddPhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // ── GPS + collections on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocationReady(true);
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        mapRef.current?.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }, 800);
      }
    })();
    getFriends().then(setFriends).catch(() => {});
    api.get("/collections", { params: { mine_only: true } })
      .then((r) => {
        setCollections(r.data);
        if (r.data.length > 0) setSelectedCollection(r.data[0].id);
      })
      .catch(() => {});
  }, []);

  // ── Load places ───────────────────────────────────────────────────────
  const loadPlaces = useCallback(async () => {
    if (selectedUser === "recs") return;
    setLoading(true);
    setSelectedPlace(null);
    try {
      const params = { limit: 200 };
      if (activeType) params.type = activeType;

      if (selectedUser === "mine") {
        setPlaces(await getGlobalPlaces({ ...params, source: "mine" }));
      } else if (selectedUser === "all") {
        const [mine, friendsPlaces] = await Promise.all([
          getGlobalPlaces({ ...params, source: "mine" }),
          getGlobalPlaces({ ...params, source: "friends" }),
        ]);
        const seen = new Set();
        setPlaces([...mine, ...friendsPlaces].filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        }));
      } else {
        setPlaces(await getGlobalPlaces({ ...params, owner_id: selectedUser }));
      }
    } catch {
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [selectedUser, activeType]);

  useEffect(() => { loadPlaces(); }, [loadPlaces]);

  // ── Status feed ───────────────────────────────────────────────────────
  const loadStatuses = useCallback(async () => {
    try {
      const [feed, my] = await Promise.all([getStatusFeed(), getMyStatus()]);
      setStatuses(feed || []);
      setMyStatus(my || null);
    } catch (err) {
      console.warn("loadStatuses error:", err?.response?.data ?? err?.message ?? err);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
    const interval = setInterval(loadStatuses, 30000);
    return () => clearInterval(interval);
  }, [loadStatuses]);

  const handleRsvp = async (statusId, response) => {
    try {
      await rsvpStatus(statusId, response);
      await loadStatuses();
      setSelectedStatus(prev => prev ? { ...prev, my_rsvp: response } : null);
    } catch {}
  };

  // ── Nominatim search ──────────────────────────────────────────────────
  function handleSearchChange(text) {
    setSearchText(text);
    if (!text.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5`;
        const res = await fetch(url, { headers: { "User-Agent": "WhatSapp/1.0" } });
        const data = await res.json();
        setSearchResults(data);
        setShowResults(data.length > 0);
      } catch {}
      setSearchLoading(false);
    }, 450);
  }

  function selectResult(result) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const label = result.display_name.split(",")[0];
    setSearchPin({ lat, lng, label });
    setSearchText(label);
    setShowResults(false);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion({
      latitude: lat, longitude: lng,
      latitudeDelta: 0.06, longitudeDelta: 0.06,
    }, 700);
    setLocationInfo(null);
    setLocationInfoLoading(true);
    getLocationInfo(label, lat, lng)
      .then(setLocationInfo)
      .catch(() => {})
      .finally(() => setLocationInfoLoading(false));
  }

  function clearSearch() {
    setSearchText("");
    setSearchResults([]);
    setShowResults(false);
    setSearchPin(null);
    setLocationInfo(null);
    setLocationInfoLoading(false);
    setNlMode(false);
    setNlQuery("");
    setNlResults(null);
  }

  async function handleNlSearch() {
    if (!nlQuery.trim()) return;
    Keyboard.dismiss();
    setNlLoading(true);
    setNlResults(null);
    try {
      let bbox = null;
      if (nlUseMapArea && currentRegion.current) {
        const r = currentRegion.current;
        bbox = {
          min_lat: r.latitude - r.latitudeDelta / 2,
          max_lat: r.latitude + r.latitudeDelta / 2,
          min_lng: r.longitude - r.longitudeDelta / 2,
          max_lng: r.longitude + r.longitudeDelta / 2,
        };
      }
      const results = await naturalSearch(nlQuery.trim(), userLocation?.lat ?? null, userLocation?.lng ?? null, bbox);
      setNlResults(results);
    } catch {
      Alert.alert("AI Search", "Could not complete the search. Try again.");
    } finally {
      setNlLoading(false);
    }
  }

  async function handleRecommendations() {
    if (recsLoading) return;
    setRecsLoading(true);
    setRecommendations(null);
    try {
      const data = await getRecommendations();
      setRecommendations(data.recommendations);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || String(err);
      Alert.alert("AI Error", msg);
      setSelectedUser("all");
    } finally {
      setRecsLoading(false);
    }
  }

  // ── Add place ─────────────────────────────────────────────────────────
  async function handleMapPress(e) {
    const { latitude, longitude } = e.nativeEvent.coordinate;

    // Status pin picking mode
    if (pickingStatusPin) {
      setPickingStatusPin(false);
      let name = "";
      try {
        const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
        name = result ? [result.name, result.street, result.city].filter(Boolean).join(", ") || "" : "";
      } catch {}
      setPendingStatusPin({ lat: latitude, lng: longitude, name });
      setShowStatusModal(true);
      return;
    }

    setSelectedPlace(null);
    setShowResults(false);
    Keyboard.dismiss();
    setPendingPin({ latitude, longitude });
    setPlaceName("");
    setPlaceAddress("Getting address…");
    setPlaceType(null);
    setAddPhotos([]);
    setShowAddModal(true);
    try {
      const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
      setPlaceAddress(result ? [result.street, result.city].filter(Boolean).join(", ") || "" : "");
    } catch {
      setPlaceAddress("");
    }
  }

  async function handleAddPlace() {
    if (!placeName.trim() || !selectedCollection) {
      Alert.alert("Required", "Please enter a name and select a collection.");
      return;
    }
    setSaving(true);
    try {
      const newPlace = await createPlace(selectedCollection, {
        name: placeName.trim(),
        address: placeAddress.trim() || null,
        lat: pendingPin.latitude,
        lng: pendingPin.longitude,
        type: placeType || null,
        extra_data: addPhotos.length > 0 ? { photos: addPhotos } : null,
      });
      setPlaces((prev) => [newPlace, ...prev]);
      setShowAddModal(false);
      setPendingPin(null);
    } catch (err) {
      console.error("createPlace error", err?.response?.status, JSON.stringify(err?.response?.data), err?.message);
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join("\n")
        : detail ? String(detail) : (err?.message ?? "Failed to add place.");
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  }

  function cancelAdd() {
    setShowAddModal(false);
    setPendingPin(null);
    setAddPhotos([]);
  }

  async function pickPlacePhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Allow photo library access to add photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingPhotos(true);
    const urls = [];
    for (const asset of result.assets) {
      const fd = new FormData();
      fd.append("file", { uri: asset.uri, name: "photo.jpg", type: "image/jpeg" });
      try {
        const res = await api.post("/uploads/photo", fd, { headers: { "Content-Type": "multipart/form-data" } });
        urls.push(res.data.url);
      } catch { /* skip failed uploads */ }
    }
    setAddPhotos((prev) => [...prev, ...urls]);
    setUploadingPhotos(false);
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  const SEARCH_TOP = insets.top + 10;
  const FILTER_TOP = SEARCH_TOP + 52;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── Map ─────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={locationReady}
        showsCompass={false}
        mapType={mapType}
        onPress={handleMapPress}
        onRegionChangeComplete={(r) => { currentRegion.current = r; }}
      >
        {searchPin && (
          <Marker
            coordinate={{ latitude: searchPin.lat, longitude: searchPin.lng }}
            pinColor="#2dd4bf"
            title={searchPin.label}
          />
        )}
        {pendingPin && (
          <Marker
            coordinate={pendingPin}
            pinColor="#10b981"
          />
        )}
        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            onPress={(e) => {
              e.stopPropagation?.();
              setSelectedPlace(place);
              mapRef.current?.animateToRegion({
                latitude: place.lat, longitude: place.lng,
                latitudeDelta: 0.012, longitudeDelta: 0.012,
              }, 500);
            }}
            tracksViewChanges={false}
          >
            <DotMarker color={TYPE_COLORS[place.type] ?? "#2dd4bf"} />
          </Marker>
        ))}
        {statuses.map((s) => (
          <Marker
            key={`status-${s.id}`}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            onPress={() => setSelectedStatus(s)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <PulsingMarker color={s.mode === "live" ? "#F4743B" : "#7C5CBF"} />
          </Marker>
        ))}
      </MapView>

      {/* ── Search bar ──────────────────────────────────────────────── */}
      <View style={[styles.searchWrapper, { top: SEARCH_TOP }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color="#9ca3af" style={{ marginRight: 7 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search a location..."
            placeholderTextColor="#9ca3af"
            value={searchText}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {searchLoading && <ActivityIndicator size="small" color="#2dd4bf" style={{ marginLeft: 4 }} />}
          {!searchLoading && searchText.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color="#d1d5db" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => { setNlMode((v) => !v); setNlQuery(""); setNlResults(null); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.nlToggleBtn, nlMode && styles.nlToggleBtnActive]}
          >
            <Text style={{ fontSize: 14 }}>✨</Text>
          </TouchableOpacity>
        </View>

        {/* NL search row */}
        {nlMode && (
          <View>
            <View style={styles.nlRow}>
              <TextInput
                style={styles.nlInput}
                placeholder="e.g. cozy coffee shops near me…"
                placeholderTextColor="#9ca3af"
                value={nlQuery}
                onChangeText={setNlQuery}
                returnKeyType="search"
                onSubmitEditing={handleNlSearch}
                autoFocus
              />
              <TouchableOpacity
                onPress={handleNlSearch}
                disabled={nlLoading || !nlQuery.trim()}
                style={[styles.nlSendBtn, (!nlQuery.trim() || nlLoading) && { opacity: 0.4 }]}
              >
                {nlLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="send" size={15} color="#fff" />}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setNlUseMapArea((v) => !v)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                alignSelf: "flex-start", marginTop: 6, marginLeft: 4,
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
                backgroundColor: nlUseMapArea ? "#eef2ff" : "rgba(255,255,255,0.85)",
                borderWidth: 1, borderColor: nlUseMapArea ? "#6366f1" : "#e5e7eb",
              }}
            >
              <Ionicons name="map-outline" size={13} color={nlUseMapArea ? "#6366f1" : "#9ca3af"} />
              <Text style={{ fontSize: 11, fontWeight: "600", color: nlUseMapArea ? "#6366f1" : "#9ca3af" }}>
                Visible area only
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Results dropdown */}
        {showResults && (
          <View style={styles.resultsDropdown}>
            {searchResults.map((r, i) => (
              <TouchableOpacity
                key={r.place_id}
                onPress={() => selectResult(r)}
                style={[
                  styles.resultRow,
                  i < searchResults.length - 1 && styles.resultRowBorder,
                ]}
              >
                <Ionicons name="location-outline" size={14} color="#9ca3af" style={{ marginRight: 8, flexShrink: 0 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {r.display_name.split(",")[0]}
                  </Text>
                  <Text style={styles.resultSub} numberOfLines={1}>
                    {r.display_name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Filter chips row ────────────────────────────────────────── */}
      <View style={[styles.filterRow, { top: FILTER_TOP }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.filterContent}
        >
          <FilterChip
            label="Everyone"
            active={selectedUser === "all"}
            color="#2dd4bf"
            onPress={() => setSelectedUser("all")}
          />
          <FilterChip
            label="My Places"
            active={selectedUser === "mine"}
            color="#34d399"
            onPress={() => setSelectedUser("mine")}
          />
          {friends.map((f) => {
            const isActive = selectedUser === f.user.id;
            return (
              <FilterChip
                key={f.id}
                label={f.user.username}
                active={isActive}
                color="#3b82f6"
                onPress={() => setSelectedUser(isActive ? "all" : f.user.id)}
                initial={f.user.username[0].toUpperCase()}
                avatarBg={avatarColor(f.user.username)}
              />
            );
          })}
          <FilterChip
            label="For you ✨"
            active={selectedUser === "recs"}
            color="#f59e0b"
            onPress={() => {
              if (selectedUser === "recs") {
                setSelectedUser("all");
                setRecommendations(null);
              } else {
                setSelectedUser("recs");
                handleRecommendations();
              }
            }}
          />

          <View style={styles.chipDivider} />

          {TYPE_FILTERS.map((t) => (
            <FilterChip
              key={String(t.value)}
              label={t.label}
              active={activeType === t.value}
              color={t.color}
              onPress={() => setActiveType(t.value)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Map type toggle ─────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.mapTypeBtn, { bottom: 130 }]}
        onPress={() => setMapType((t) => {
          const idx = MAP_TYPES.findIndex((m) => m.value === t);
          return MAP_TYPES[(idx + 1) % MAP_TYPES.length].value;
        })}
      >
        <Text style={styles.mapTypeBtnIcon}>
          {MAP_TYPES.find((m) => m.value === mapType)?.icon}
        </Text>
        <Text style={styles.mapTypeBtnLabel}>
          {MAP_TYPES.find((m) => m.value === mapType)?.label}
        </Text>
      </TouchableOpacity>

      {/* ── Bottom sheet ─────────────────────────────────────────────── */}
      {selectedPlace ? (
        /* ── Expanded: DB place detail ── */
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity
            style={styles.sheetClose}
            onPress={() => setSelectedPlace(null)}
          >
            <Ionicons name="close-circle" size={24} color="#d1d5db" />
          </TouchableOpacity>

          <View style={styles.sheetTypeBadge}>
            <View style={[
              styles.typePill,
              { borderColor: TYPE_COLORS[selectedPlace.type] ?? "#2dd4bf" },
              { backgroundColor: (TYPE_COLORS[selectedPlace.type] ?? "#2dd4bf") + "18" },
            ]}>
              <Text style={[styles.typePillText, { color: TYPE_COLORS[selectedPlace.type] ?? "#2dd4bf" }]}>
                {TYPE_FILTERS.find((t) => t.value === selectedPlace.type)?.label ?? selectedPlace.type ?? "Place"}
              </Text>
            </View>
            {selectedPlace.owner_username && (
              <Text style={styles.sheetOwner}>by {selectedPlace.owner_username}</Text>
            )}
          </View>

          <Text style={styles.sheetName}>{selectedPlace.name}</Text>
          {selectedPlace.address ? (
            <Text style={styles.sheetAddr}>📍 {selectedPlace.address}</Text>
          ) : null}
          {selectedPlace.collection_title ? (
            <Text style={styles.sheetCollection}>📚 {selectedPlace.collection_title}</Text>
          ) : null}
        </View>
      ) : searchPin && (locationInfoLoading || locationInfo) ? (
        /* ── AI location info sheet ── */
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity style={styles.sheetClose} onPress={clearSearch}>
            <Ionicons name="close-circle" size={24} color="#d1d5db" />
          </TouchableOpacity>
          <Text style={styles.sheetName}>{searchPin.label}</Text>
          {locationInfoLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 30 }}>
              <ActivityIndicator color="#2dd4bf" size="large" />
              <Text style={{ color: "#94a3b8", marginTop: 10, fontSize: 13 }}>Getting info…</Text>
            </View>
          ) : locationInfo ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              <Text style={styles.aiDesc}>{locationInfo.description}</Text>
              <AICard icon="🗓" title="Best time to visit" text={locationInfo.best_time} />
              <AICard icon="🎯" title="What to do" text={locationInfo.what_to_do} />
              <AICard icon="💡" title="Tips" text={locationInfo.tips} />
              <View style={{ height: 20 }} />
            </ScrollView>
          ) : null}
        </View>
      ) : (nlLoading || nlResults) ? (
        /* ── NL search results ── */
        <View style={[styles.sheetTall, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity style={styles.sheetClose} onPress={() => { setNlResults(null); setNlMode(false); setNlQuery(""); }}>
            <Ionicons name="close-circle" size={24} color="#d1d5db" />
          </TouchableOpacity>
          <Text style={styles.sheetName}>AI Search</Text>
          {nlLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 30 }}>
              <ActivityIndicator color="#2dd4bf" size="large" />
              <Text style={{ color: "#94a3b8", marginTop: 10, fontSize: 13 }}>Searching…</Text>
            </View>
          ) : nlResults?.length === 0 ? (
            <Text style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", paddingVertical: 20 }}>
              No places found. Try a different query.
            </Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {nlResults.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.nlResultCard}
                  onPress={() => {
                    mapRef.current?.animateToRegion({
                      latitude: p.lat, longitude: p.lng,
                      latitudeDelta: 0.03, longitudeDelta: 0.03,
                    }, 600);
                    setSelectedPlace(p);
                  }}
                >
                  <View style={[styles.nlResultAccent, { backgroundColor: TYPE_COLORS[p.type] ?? "#2dd4bf" }]} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.nlResultName} numberOfLines={1}>{p.name}</Text>
                      {p.type && (
                        <View style={[styles.nlResultBadge, { backgroundColor: (TYPE_COLORS[p.type] ?? "#2dd4bf") + "20" }]}>
                          <Text style={[styles.nlResultBadgeText, { color: TYPE_COLORS[p.type] ?? "#2dd4bf" }]}>
                            {TYPE_FILTERS.find((t) => t.value === p.type)?.label ?? p.type}
                          </Text>
                        </View>
                      )}
                    </View>
                    {p.address && <Text style={styles.nlResultAddr} numberOfLines={1}>📍 {p.address}</Text>}
                    {p.collection_title && <Text style={styles.nlResultColl}>📚 {p.collection_title}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
                </TouchableOpacity>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </View>
      ) : selectedUser === "recs" ? (
        /* ── AI Recommendations ── */
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity style={styles.sheetClose} onPress={() => { setSelectedUser("all"); setRecommendations(null); }}>
            <Ionicons name="close-circle" size={24} color="#d1d5db" />
          </TouchableOpacity>
          <Text style={styles.sheetName}>For You ✨</Text>
          {recsLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 30 }}>
              <ActivityIndicator color="#f59e0b" size="large" />
              <Text style={{ color: "#94a3b8", marginTop: 10, fontSize: 13 }}>Finding places for you…</Text>
            </View>
          ) : recommendations?.length > 0 ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {recommendations.map((r, i) => (
                <View key={i} style={styles.recCard}>
                  <View style={[styles.recAccent, { backgroundColor: TYPE_COLORS[r.type] ?? "#f59e0b" }]} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.recName} numberOfLines={1}>{r.name}</Text>
                      {r.type && (
                        <View style={[styles.nlResultBadge, { backgroundColor: (TYPE_COLORS[r.type] ?? "#f59e0b") + "20" }]}>
                          <Text style={[styles.nlResultBadgeText, { color: TYPE_COLORS[r.type] ?? "#f59e0b" }]}>
                            {TYPE_FILTERS.find((t) => t.value === r.type)?.label ?? r.type}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.recWhy}>{r.why}</Text>
                    {r.address_hint && <Text style={styles.recAddr}>📍 {r.address_hint}</Text>}
                  </View>
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          ) : null}
        </View>
      ) : (
        /* ── Swipeable sheet ── */
        <Animated.View style={[
          styles.sheetFull,
          { height: EXPANDED_H, paddingBottom: insets.bottom + 12, transform: [{ translateY: sheetTranslateY }] },
        ]}>
          {/* Drag handle */}
          <View {...sheetPan.panHandlers} style={{ paddingVertical: 10, alignItems: "center" }}>
            <View style={styles.sheetHandle} />
          </View>

          <View style={styles.peekHeader}>
            <Text style={styles.peekCount}>
              {loading ? "Loading…" : `${places.length} place${places.length !== 1 ? "s" : ""}`}
            </Text>
            {loading && <ActivityIndicator size="small" color="#2dd4bf" />}
            {!loading && places.length > 0 && (
              <TouchableOpacity onPress={() => snapSheet(!sheetExpanded)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={sheetExpanded ? "chevron-down" : "chevron-up"} size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {!loading && places.length > 0 && !sheetExpanded && (
            <FlatList
              horizontal
              data={places.slice(0, 12)}
              keyExtractor={(p) => String(p.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedPlace(item);
                    mapRef.current?.animateToRegion({
                      latitude: item.lat, longitude: item.lng,
                      latitudeDelta: 0.012, longitudeDelta: 0.012,
                    }, 500);
                  }}
                  activeOpacity={0.8}
                  style={styles.placeCard}
                >
                  <View style={[styles.cardAccent, { backgroundColor: TYPE_COLORS[item.type] ?? "#2dd4bf" }]} />
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  {item.address ? (
                    <Text style={styles.cardAddr} numberOfLines={1}>{item.address}</Text>
                  ) : null}
                  {item.owner_username ? (
                    <Text style={styles.cardOwner} numberOfLines={1}>by {item.owner_username}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
            />
          )}

          {!loading && places.length > 0 && sheetExpanded && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
              {places.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    setSelectedPlace(item);
                    snapSheet(false);
                    mapRef.current?.animateToRegion({
                      latitude: item.lat, longitude: item.lng,
                      latitudeDelta: 0.012, longitudeDelta: 0.012,
                    }, 500);
                  }}
                  activeOpacity={0.75}
                  style={styles.listCard}
                >
                  <View style={[styles.cardAccent, { backgroundColor: TYPE_COLORS[item.type] ?? "#2dd4bf" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    {item.address ? <Text style={styles.cardAddr} numberOfLines={1}>{item.address}</Text> : null}
                    {item.owner_username ? <Text style={styles.cardOwner} numberOfLines={1}>by {item.owner_username}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {!loading && places.length === 0 && (
            <Text style={styles.emptyText}>No places yet — tap the map to add one!</Text>
          )}
        </Animated.View>
      )}

      {/* ── Broadcast FAB ────────────────────────────────────────────── */}
      <TouchableOpacity
        style={{
          position: "absolute", bottom: 130, left: 16, zIndex: 25,
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: "#FFFFFF",
          borderWidth: 2, borderColor: myStatus ? "#F4743B" : "#00A878",
          alignItems: "center", justifyContent: "center",
          shadowColor: myStatus ? "#F4743B" : "#00A878", shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
        }}
        onPress={() => setShowStatusModal(true)}
      >
        <Text style={{ fontSize: 22 }}>{myStatus ? "📍" : "✈️"}</Text>
      </TouchableOpacity>

      {/* ── Friends Status FAB ───────────────────────────────────────── */}
      <TouchableOpacity
        style={{
          position: "absolute", bottom: 192, left: 16, zIndex: 25,
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: "#FFFFFF",
          borderWidth: 2, borderColor: statuses.length > 0 ? "#3b82f6" : "#d1d5db",
          alignItems: "center", justifyContent: "center",
          shadowColor: "#3b82f6", shadowOpacity: statuses.length > 0 ? 0.3 : 0.08, shadowRadius: 10, elevation: 8,
        }}
        onPress={async () => {
          setShowFriendsPanel(true);
          setStatusRefreshing(true);
          await loadStatuses();
          setStatusRefreshing(false);
        }}
      >
        <Ionicons name="people" size={22} color={statuses.length > 0 ? "#3b82f6" : "#9ca3af"} />
        {statuses.length > 0 && (
          <View style={{
            position: "absolute", top: -4, right: -4,
            backgroundColor: "#F4743B", borderRadius: 10,
            minWidth: 18, height: 18, alignItems: "center", justifyContent: "center",
            paddingHorizontal: 4, borderWidth: 2, borderColor: "#fff",
          }}>
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{statuses.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Friends Status Panel ─────────────────────────────────────── */}
      <Modal
        visible={showFriendsPanel}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFriendsPanel(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          {/* Backdrop */}
          <TouchableOpacity
            style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" }}
            activeOpacity={1}
            onPress={() => setShowFriendsPanel(false)}
          />
          <View style={{
            backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28,
            maxHeight: "75%", paddingBottom: insets.bottom + 16,
          }}>
            {/* Handle */}
            <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: "center" }}>
              <View style={{ width: 40, height: 4, backgroundColor: "#EDE9E3", borderRadius: 99 }} />
            </View>

            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="people" size={20} color="#3b82f6" />
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#1C1C1E" }}>Who's Out</Text>
                <View style={{ backgroundColor: "#EFF6FF", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#3b82f6" }}>{statuses.length}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity
                  onPress={async () => { setStatusRefreshing(true); await loadStatuses(); setStatusRefreshing(false); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {statusRefreshing
                    ? <ActivityIndicator size="small" color="#3b82f6" />
                    : <Ionicons name="refresh-outline" size={20} color="#3b82f6" />}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowFriendsPanel(false)}>
                  <Ionicons name="close-circle" size={24} color="#d1d5db" />
                </TouchableOpacity>
              </View>
            </View>

            {statusRefreshing ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 12 }}>Loading…</Text>
              </View>
            ) : statuses.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Ionicons name="people-outline" size={48} color="#e5e7eb" />
                <Text style={{ color: "#9ca3af", fontSize: 14, marginTop: 12 }}>No friends are active right now</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                {statuses.map((s) => {
                  const isLive = s.mode === "live";
                  const isMe = s.user_id === currentUser?.id;
                  const color = isLive ? "#F4743B" : "#7C5CBF";
                  return (
                    <TouchableOpacity
                      key={s.id}
                      activeOpacity={0.75}
                      onPress={() => {
                        setShowFriendsPanel(false);
                        setSelectedStatus(s);
                        mapRef.current?.animateToRegion({
                          latitude: s.lat, longitude: s.lng,
                          latitudeDelta: 0.025, longitudeDelta: 0.025,
                        }, 600);
                      }}
                      style={{
                        flexDirection: "row", alignItems: "center",
                        backgroundColor: isMe ? "#FFF8F5" : "#FAFAF9",
                        borderRadius: 16, padding: 12, marginBottom: 8,
                        borderWidth: 1.5, borderColor: isMe ? "#F4743B30" : "#F3F0EB",
                      }}
                    >
                      {/* Avatar */}
                      <View style={{
                        width: 44, height: 44, borderRadius: 22,
                        backgroundColor: color, alignItems: "center", justifyContent: "center",
                        marginRight: 12, flexShrink: 0,
                      }}>
                        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>
                          {s.username?.[0]?.toUpperCase()}
                        </Text>
                      </View>

                      {/* Info */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <Text style={{ fontWeight: "700", fontSize: 15, color: "#1C1C1E" }}>
                            {isMe ? "You" : s.username}
                          </Text>
                          <View style={{
                            backgroundColor: isLive ? "#FFF0EA" : "#F0EBFF",
                            borderRadius: 99, paddingHorizontal: 7, paddingVertical: 1,
                          }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color }}>
                              {isLive ? "LIVE" : "PLAN"}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <Ionicons name={ACTIVITY_ICONS[s.activity_type] ?? "ellipsis-horizontal-circle-outline"} size={13} color={color} />
                          <Text style={{ fontSize: 13, color: "#6B7280" }}>
                            {s.activity_type}
                            {s.message ? ` · "${s.message}"` : ""}
                          </Text>
                        </View>

                        {s.location_name ? (
                          <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }} numberOfLines={1}>
                            📍 {s.location_name}
                          </Text>
                        ) : null}

                        <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                          {isLive ? `⏱ ${timeLeft(s.expires_at)} left` : `📅 ${new Date(s.expires_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                        </Text>
                      </View>

                      <Ionicons name="location-outline" size={18} color="#d1d5db" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Status detail card ───────────────────────────────────────── */}
      {selectedStatus && (
        <View style={{
          position: "absolute", bottom: 100, left: 16, right: 16, zIndex: 25,
          backgroundColor: "#FFFFFF", borderRadius: 24, padding: 16,
          shadowColor: "#8B7355", shadowOpacity: 0.12, shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 }, elevation: 10,
        }}>
          <TouchableOpacity
            onPress={() => setSelectedStatus(null)}
            style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}
          >
            <Text style={{ fontSize: 18, color: "#9CA3AF" }}>✕</Text>
          </TouchableOpacity>

          {/* Avatar + name */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: selectedStatus.mode === "live" ? "#F4743B" : "#7C5CBF",
              alignItems: "center", justifyContent: "center", marginRight: 10,
            }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                {selectedStatus.username?.[0]?.toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={{ fontWeight: "700", color: "#1C1C1E", fontSize: 16 }}>
                {selectedStatus.username}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name={ACTIVITY_ICONS[selectedStatus.activity_type] ?? "ellipsis-horizontal-circle-outline"} size={13} color="#9CA3AF" />
                <Text style={{ color: "#6B7280", fontSize: 13 }}>
                  {selectedStatus.activity_type}
                  {" · "}
                  {selectedStatus.mode === "live"
                    ? `${timeLeft(selectedStatus.expires_at)} left`
                    : new Date(selectedStatus.expires_at).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {selectedStatus.message ? (
            <View style={{
              borderLeftWidth: 3,
              borderLeftColor: selectedStatus.mode === "live" ? "#F4743B" : "#00A878",
              paddingLeft: 10, marginBottom: 8,
            }}>
              <Text style={{ color: "#334155", fontSize: 14, fontStyle: "italic" }}>
                "{selectedStatus.message}"
              </Text>
            </View>
          ) : null}

          {selectedStatus.location_name ? (
            <Text style={{ color: "#00A878", fontSize: 12, marginBottom: 8 }}>
              📍 {selectedStatus.location_name}
            </Text>
          ) : null}

          {/* RSVP buttons for plan mode */}
          {selectedStatus.mode === "plan" && selectedStatus.user_id !== currentUser?.id && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              {[
                ["going", "checkmark-circle-outline", "I'm in"],
                ["maybe", "help-circle-outline", "Maybe"],
                ["no", "close-circle-outline", "Can't"],
              ].map(([r, icon, label]) => {
                const sel = selectedStatus.my_rsvp === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => handleRsvp(selectedStatus.id, r)}
                    style={{
                      flex: 1, paddingVertical: 8, borderRadius: 50, alignItems: "center",
                      flexDirection: "row", justifyContent: "center", gap: 4,
                      backgroundColor: sel ? "#F0EBF8" : "#F7F5F0",
                      borderWidth: 1.5, borderColor: sel ? "#7C5CBF" : "transparent",
                    }}
                  >
                    <Ionicons name={icon} size={14} color={sel ? "#7C5CBF" : "#9CA3AF"} />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: sel ? "#7C5CBF" : "#6B7280" }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* RSVP counts */}
          {selectedStatus.mode === "plan" && (
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="checkmark-circle-outline" size={13} color="#9CA3AF" />
                <Text style={{ color: "#9CA3AF", fontSize: 11 }}>{selectedStatus.rsvp_counts?.going || 0} going</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="help-circle-outline" size={13} color="#9CA3AF" />
                <Text style={{ color: "#9CA3AF", fontSize: 11 }}>{selectedStatus.rsvp_counts?.maybe || 0} maybe</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Status pin picking hint ───────────────────────────────────── */}
      {pickingStatusPin && (
        <View style={{
          position: "absolute", top: FILTER_TOP + 60, left: 20, right: 20, zIndex: 30,
          backgroundColor: "#7C5CBF", borderRadius: 18, padding: 16, alignItems: "center",
          shadowColor: "#7C5CBF", shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
        }}>
          <Ionicons name="location-outline" size={22} color="#fff" style={{ marginBottom: 6 }} />
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Tap the map to pin your location</Text>
          <TouchableOpacity onPress={() => { setPickingStatusPin(false); setShowStatusModal(true); }} style={{ marginTop: 8 }}>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── PostStatusModal ───────────────────────────────────────────── */}
      <PostStatusModal
        visible={showStatusModal}
        onClose={() => { setShowStatusModal(false); setPendingStatusPin(null); }}
        myStatus={myStatus}
        onPosted={() => { loadStatuses(); setPendingStatusPin(null); }}
        pinnedLocation={pendingStatusPin}
        onPickLocation={() => { setShowStatusModal(false); setPickingStatusPin(true); }}
      />

      {/* ── Add place modal ──────────────────────────────────────────── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={cancelAdd}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            style={styles.modal}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add place</Text>
              <TouchableOpacity onPress={cancelAdd}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {pendingPin && (
              <Text style={styles.coordsHint}>
                📍 {pendingPin.latitude.toFixed(5)}, {pendingPin.longitude.toFixed(5)}
              </Text>
            )}

            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Coffee Aroma"
              value={placeName}
              onChangeText={setPlaceName}
            />

            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. 12 Herzl St, Tel Aviv"
              value={placeAddress}
              onChangeText={setPlaceAddress}
            />

            <Text style={styles.fieldLabel}>Collection *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 14 }}
              contentContainerStyle={{ flexDirection: "row", alignItems: "center" }}
            >
              {collections.length === 0 ? (
                <Text style={{ fontSize: 13, color: "#9ca3af" }}>No collections yet — create one first</Text>
              ) : collections.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.collChip, selectedCollection === c.id && styles.collChipActive]}
                  onPress={() => setSelectedCollection(c.id)}
                >
                  <Text style={[styles.collChipText, selectedCollection === c.id && styles.collChipTextActive]}>
                    {c.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {TYPE_FILTERS.filter((t) => t.value !== null).map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.typeChip,
                    placeType === t.value && { borderColor: t.color, backgroundColor: t.color + "20" },
                  ]}
                  onPress={() => setPlaceType(placeType === t.value ? null : t.value)}
                >
                  <Text style={[styles.typeChipText, placeType === t.value && { color: t.color }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Photos</Text>
            {addPhotos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {addPhotos.map((url, i) => (
                    <View key={i} style={{ position: "relative" }}>
                      <Image source={{ uri: API_URL + url }} style={styles.photoThumb} />
                      <TouchableOpacity
                        style={styles.photoRemove}
                        onPress={() => setAddPhotos((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
            <TouchableOpacity
              style={[styles.photoAddBtn, (uploadingPhotos || addPhotos.length >= 5) && { opacity: 0.5 }]}
              onPress={pickPlacePhoto}
              disabled={uploadingPhotos || addPhotos.length >= 5}
            >
              <Text style={styles.photoAddBtnText}>
                {uploadingPhotos ? "Uploading…" : "📷 Add photos"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!placeName.trim() || !selectedCollection || saving) && styles.saveBtnDisabled,
              ]}
              onPress={handleAddPlace}
              disabled={!placeName.trim() || !selectedCollection || saving}
            >
              <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Add place"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const CARD_W = 150;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F5F0" },

  // Search
  searchWrapper: {
    position: "absolute", left: 12, right: 12, zIndex: 30,
  },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    paddingHorizontal: 12, height: 44,
    shadowColor: "#8B7355", shadowOpacity: 0.1, shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
    borderWidth: 1, borderColor: "#EDE9E3",
  },
  searchInput: {
    flex: 1, fontSize: 14, color: "#1C1C1E",
    ...(Platform.OS === "android" ? { paddingVertical: 0 } : {}),
  },
  resultsDropdown: {
    backgroundColor: "#fff", borderRadius: 12, marginTop: 6,
    shadowColor: "#8B7355", shadowOpacity: 0.08, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
    borderWidth: 1, borderColor: "#EDE9E3", overflow: "hidden",
  },
  resultRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 12,
  },
  resultRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F7F5F0" },
  resultTitle: { fontSize: 13, fontWeight: "600", color: "#1C1C1E" },
  resultSub: { fontSize: 11, color: "#6B7280", marginTop: 1 },

  // Filter chips
  filterRow: {
    position: "absolute", left: 0, right: 0, zIndex: 20,
    marginHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    shadowColor: "#8B7355", shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  filterContent: {
    paddingHorizontal: 10, paddingVertical: 6, gap: 6, alignItems: "center",
  },
  chip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "#EDE9E3",
    shadowColor: "#8B7355", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    gap: 5,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: "#1C1C1E" },
  chipTextActive: { color: "#fff" },
  chipAvatar: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  chipAvatarText: { fontSize: 9, fontWeight: "700", color: "#fff" },
  chipDivider: {
    width: 1, height: 22, backgroundColor: "#EDE9E3", marginHorizontal: 4,
  },

  // Bottom sheet – expanded (place selected)
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 10, paddingHorizontal: 20,
    shadowColor: "#8B7355", shadowOpacity: 0.12, shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 }, elevation: 14,
    zIndex: 20,
  },

  // Bottom sheet – tall (NL search results, keyboard-safe)
  sheetTall: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    maxHeight: "65%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 10, paddingHorizontal: 20,
    shadowColor: "#8B7355", shadowOpacity: 0.12, shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 }, elevation: 14,
    zIndex: 20,
  },

  // Bottom sheet – swipeable main sheet
  sheetFull: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20,
    shadowColor: "#8B7355", shadowOpacity: 0.09, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 }, elevation: 8,
    zIndex: 20,
  },

  // Bottom sheet – peek (no selection)
  sheetPeek: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 10,
    shadowColor: "#8B7355", shadowOpacity: 0.09, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 }, elevation: 8,
    zIndex: 20,
  },

  sheetHandle: {
    alignSelf: "center", width: 48, height: 5,
    backgroundColor: "#EDE9E3", borderRadius: 99, marginBottom: 14,
  },
  sheetClose: {
    position: "absolute", top: 14, right: 16, zIndex: 10,
  },
  sheetTypeBadge: {
    flexDirection: "row", alignItems: "center", marginBottom: 10, marginTop: 2,
  },
  typePill: {
    borderWidth: 1, borderRadius: 99,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  typePillText: { fontSize: 12, fontWeight: "600" },
  sheetOwner: { fontSize: 12, color: "#9CA3AF", marginLeft: 8 },
  sheetName: { fontSize: 21, fontWeight: "700", color: "#1C1C1E", marginBottom: 8 },
  sheetAddr: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  sheetCollection: { fontSize: 14, color: "#00A878", marginTop: 6, fontWeight: "600" },

  peekHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 10,
  },
  peekCount: { fontSize: 14, fontWeight: "700", color: "#1C1C1E" },
  cardList: { paddingHorizontal: 12, gap: 10 },
  placeCard: {
    width: CARD_W, backgroundColor: "#FFFFFF",
    borderRadius: 16, padding: 12,
    shadowColor: "#8B7355", shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
    overflow: "hidden",
  },
  listCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, marginBottom: 8,
    shadowColor: "#8B7355", shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
    overflow: "hidden",
  },
  cardAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: 0 },
  cardName: { fontSize: 13, fontWeight: "700", color: "#1C1C1E", marginLeft: 10 },
  cardAddr: { fontSize: 11, color: "#6B7280", marginTop: 2, marginLeft: 10 },
  cardOwner: { fontSize: 11, color: "#9CA3AF", marginTop: 3, marginLeft: 10 },
  emptyText: { fontSize: 13, color: "#9CA3AF", textAlign: "center", paddingHorizontal: 16, paddingBottom: 4 },

  // Add place modal
  modal: { flex: 1, paddingHorizontal: 24, paddingTop: 36, backgroundColor: "#FFFFFF" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#1C1C1E" },
  modalClose: { fontSize: 18, color: "#9CA3AF", padding: 4 },
  coordsHint: {
    fontSize: 12, color: "#6B7280", marginBottom: 14,
    backgroundColor: "#F7F5F0", padding: 8, borderRadius: 8,
  },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#1C1C1E", marginBottom: 8 },
  fieldInput: {
    borderWidth: 1, borderColor: "#EDE9E3", borderRadius: 12,
    padding: 12, marginBottom: 14, fontSize: 14, backgroundColor: "#FAFAF8",
  },
  collChip: {
    borderWidth: 1, borderColor: "#EDE9E3", borderRadius: 99,
    paddingHorizontal: 14, paddingVertical: 6, marginRight: 8, backgroundColor: "#fff",
  },
  collChipActive: { borderColor: "#00A878", backgroundColor: "#F0FAF5" },
  collChipText: { fontSize: 13, color: "#6B7280" },
  collChipTextActive: { color: "#00A878", fontWeight: "600" },
  typeChip: {
    borderWidth: 1, borderColor: "#EDE9E3", borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff",
  },
  typeChipText: { fontSize: 12, color: "#6B7280" },
  saveBtn: {
    backgroundColor: "#00A878", borderRadius: 12,
    padding: 14, alignItems: "center", marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },

  // Map type toggle
  mapTypeBtn: {
    position: "absolute", right: 16, zIndex: 25,
    backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 22,
    paddingHorizontal: 10, paddingVertical: 7,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#8B7355", shadowOpacity: 0.1, shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
    borderWidth: 1, borderColor: "#EDE9E3",
    flexDirection: "row", gap: 4,
  },
  mapTypeBtnIcon: { fontSize: 16 },
  mapTypeBtnLabel: { fontSize: 11, fontWeight: "600", color: "#1C1C1E" },

  // Photos
  photoThumb: { width: 70, height: 70, borderRadius: 10 },
  photoRemove: {
    position: "absolute", top: -5, right: -5,
    backgroundColor: "#F4743B", borderRadius: 99,
    width: 18, height: 18, justifyContent: "center", alignItems: "center",
  },
  photoAddBtn: {
    borderWidth: 1.5, borderColor: "#00A878", borderStyle: "dashed",
    borderRadius: 12, paddingVertical: 10,
    alignItems: "center", marginBottom: 18,
  },
  photoAddBtnText: { fontSize: 13, color: "#00A878", fontWeight: "600" },

  // NL search
  nlToggleBtn: {
    marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1, borderColor: "#EDE9E3",
  },
  nlToggleBtnActive: {
    backgroundColor: "#F0FAF5", borderColor: "#00A878",
  },
  nlRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, marginTop: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    shadowColor: "#8B7355", shadowOpacity: 0.07, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
    borderWidth: 1, borderColor: "#EDE9E3",
  },
  nlInput: {
    flex: 1, fontSize: 13, color: "#1C1C1E",
    ...(Platform.OS === "android" ? { paddingVertical: 4 } : {}),
  },
  nlSendBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#00A878", alignItems: "center", justifyContent: "center",
    marginLeft: 8,
  },

  // NL results
  nlResultCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FAFAF8", borderRadius: 12,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "#EDE9E3",
  },
  nlResultAccent: { width: 4, borderRadius: 2, alignSelf: "stretch", marginRight: 12 },
  nlResultName: { fontSize: 14, fontWeight: "700", color: "#1C1C1E", flex: 1 },
  nlResultAddr: { fontSize: 12, color: "#6B7280", marginTop: 3 },
  nlResultColl: { fontSize: 12, color: "#00A878", marginTop: 3, fontWeight: "600" },
  nlResultBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  nlResultBadgeText: { fontSize: 11, fontWeight: "600" },

  // Recommendations
  recCard: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "#FFFDF6", borderRadius: 12,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "#F5E9C8",
  },
  recAccent: { width: 4, borderRadius: 2, alignSelf: "stretch", marginRight: 12 },
  recName: { fontSize: 14, fontWeight: "700", color: "#1C1C1E", flex: 1 },
  recWhy: { fontSize: 13, color: "#6B7280", marginTop: 4, lineHeight: 18 },
  recAddr: { fontSize: 12, color: "#F4743B", marginTop: 3, fontWeight: "600" },

  // Status strip
  statusStrip: {
    position: "absolute", bottom: 160, left: 0, right: 0, zIndex: 20,
    backgroundColor: "transparent",
  },
  statusStripContent: {
    paddingHorizontal: 12, gap: 8,
  },
  statusBubble: {
    width: 56, alignItems: "center",
  },
  statusBubbleCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  statusBubbleInitial: {
    color: "#fff", fontWeight: "800", fontSize: 15,
  },
  statusBubbleBadge: {
    position: "absolute", top: -2, right: -2,
    width: 14, height: 14, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#fff",
  },
  statusBubbleBadgeText: {
    color: "#fff", fontSize: 7, fontWeight: "800",
  },
  statusBubbleLabel: {
    fontSize: 10, color: "#6B7280", marginTop: 2, fontWeight: "600",
    maxWidth: 56, textAlign: "center",
  },

  // AI location info
  aiDesc: { fontSize: 14, color: "#334155", lineHeight: 21, marginBottom: 14 },
  aiCard: {
    backgroundColor: "#F0FAF5", borderRadius: 12,
    padding: 12, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: "#00A878",
  },
  aiCardTitle: {
    fontSize: 11, fontWeight: "700", color: "#00A878",
    marginBottom: 4, textTransform: "uppercase", letterSpacing: 1.2,
  },
  aiCardText: { fontSize: 13, color: "#334155", lineHeight: 19 },
});

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
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getFriends } from "../../src/api/friends";
import { getGlobalPlaces, createPlace } from "../../src/api/places";
import api from "../../src/api/axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

const MAP_TYPES = [
  { value: "standard",  icon: "🗺",  label: "Map" },
  { value: "satellite", icon: "🛰",  label: "Satellite" },
  { value: "hybrid",    icon: "🌐",  label: "Hybrid" },
];

const TYPE_FILTERS = [
  { value: null,       label: "All",      color: "#6366f1" },
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

const AVATAR_COLORS = ["#6366f1","#f97316","#22c55e","#3b82f6","#a855f7","#ec4899"];
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

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Location
  const [locationReady, setLocationReady] = useState(false);

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

  // Map type
  const [mapType, setMapType] = useState("standard");

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
  }

  function clearSearch() {
    setSearchText("");
    setSearchResults([]);
    setShowResults(false);
    setSearchPin(null);
  }

  // ── Add place ─────────────────────────────────────────────────────────
  async function handleMapPress(e) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
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
    <View style={styles.root}>
      {/* ── Map ─────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={locationReady}
        showsCompass={false}
        mapType={mapType}
        onPress={handleMapPress}
      >
        {searchPin && (
          <Marker
            coordinate={{ latitude: searchPin.lat, longitude: searchPin.lng }}
            pinColor="#6366f1"
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
            onPress={(e) => { e.stopPropagation?.(); setSelectedPlace(place); }}
            tracksViewChanges={false}
          >
            <DotMarker color={TYPE_COLORS[place.type] ?? "#6366f1"} />
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
          {searchLoading && <ActivityIndicator size="small" color="#6366f1" style={{ marginLeft: 4 }} />}
          {!searchLoading && searchText.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color="#d1d5db" />
            </TouchableOpacity>
          )}
        </View>

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
            color="#4f46e5"
            onPress={() => setSelectedUser("all")}
          />
          <FilterChip
            label="My Places"
            active={selectedUser === "mine"}
            color="#0f172a"
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

      {/* ── Bottom sheet ────────────────────────────────────────────── */}
      {selectedPlace ? (
        /* Expanded: place preview */
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity style={styles.sheetClose} onPress={() => setSelectedPlace(null)}>
            <Ionicons name="close-circle" size={22} color="#d1d5db" />
          </TouchableOpacity>

          <View style={styles.sheetTypeBadge}>
            <View style={[
              styles.typePill,
              { borderColor: TYPE_COLORS[selectedPlace.type] ?? "#6366f1" },
              { backgroundColor: (TYPE_COLORS[selectedPlace.type] ?? "#6366f1") + "18" },
            ]}>
              <Text style={[styles.typePillText, { color: TYPE_COLORS[selectedPlace.type] ?? "#6366f1" }]}>
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
      ) : (
        /* Collapsed: count + horizontal cards */
        <View style={[styles.sheetPeek, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.peekHeader}>
            <Text style={styles.peekCount}>
              {loading ? "Loading…" : `${places.length} place${places.length !== 1 ? "s" : ""}`}
            </Text>
            {loading && <ActivityIndicator size="small" color="#6366f1" />}
          </View>

          {!loading && places.length > 0 && (
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
                  <View style={[styles.cardDot, { backgroundColor: TYPE_COLORS[item.type] ?? "#6366f1" }]} />
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

          {!loading && places.length === 0 && (
            <Text style={styles.emptyText}>No places yet — tap the map to add one!</Text>
          )}
        </View>
      )}

      {/* ── Map type toggle ─────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.mapTypeBtn, { bottom: insets.bottom + 220 }]}
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
    </View>
  );
}

const CARD_W = 150;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },

  // Search
  searchWrapper: {
    position: "absolute", left: 12, right: 12, zIndex: 30,
  },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    paddingHorizontal: 12, height: 44,
    shadowColor: "#000", shadowOpacity: 0.13, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
    borderWidth: 1, borderColor: "#e5e7eb",
  },
  searchInput: {
    flex: 1, fontSize: 14, color: "#111827",
    ...(Platform.OS === "android" ? { paddingVertical: 0 } : {}),
  },
  resultsDropdown: {
    backgroundColor: "#fff", borderRadius: 12, marginTop: 6,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
    borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden",
  },
  resultRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 12,
  },
  resultRowBorder: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  resultTitle: { fontSize: 13, fontWeight: "600", color: "#111827" },
  resultSub: { fontSize: 11, color: "#6b7280", marginTop: 1 },

  // Filter chips
  filterRow: {
    position: "absolute", left: 0, right: 0, zIndex: 20,
  },
  filterContent: {
    paddingHorizontal: 12, paddingVertical: 5, gap: 6, alignItems: "center",
  },
  chip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "#e5e7eb",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    gap: 5,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  chipTextActive: { color: "#fff" },
  chipAvatar: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  chipAvatarText: { fontSize: 9, fontWeight: "700", color: "#fff" },
  chipDivider: {
    width: 1, height: 22, backgroundColor: "#e5e7eb", marginHorizontal: 4,
  },

  // Bottom sheet – expanded (place selected)
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 10, paddingHorizontal: 20,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 }, elevation: 10,
    zIndex: 20,
  },
  sheetHandle: {
    alignSelf: "center", width: 40, height: 4,
    backgroundColor: "#e5e7eb", borderRadius: 2, marginBottom: 14,
  },
  sheetClose: {
    position: "absolute", top: 14, right: 16,
  },
  sheetTypeBadge: {
    flexDirection: "row", alignItems: "center", marginBottom: 8,
  },
  typePill: {
    borderWidth: 1, borderRadius: 99,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  typePillText: { fontSize: 12, fontWeight: "600" },
  sheetOwner: { fontSize: 12, color: "#9ca3af", marginLeft: 8 },
  sheetName: { fontSize: 19, fontWeight: "800", color: "#111827", marginBottom: 6 },
  sheetAddr: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  sheetCollection: { fontSize: 13, color: "#6366f1", marginTop: 6, fontWeight: "600" },

  // Bottom sheet – peeking (no selection)
  sheetPeek: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 10,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 }, elevation: 6,
    zIndex: 20,
  },
  peekHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 10,
  },
  peekCount: { fontSize: 14, fontWeight: "700", color: "#111827" },
  cardList: { paddingHorizontal: 12, gap: 10 },
  placeCard: {
    width: CARD_W, backgroundColor: "#f9fafb",
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#e5e7eb",
  },
  cardDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 7 },
  cardName: { fontSize: 13, fontWeight: "700", color: "#111827" },
  cardAddr: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  cardOwner: { fontSize: 11, color: "#9ca3af", marginTop: 3 },
  emptyText: { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingHorizontal: 16, paddingBottom: 4 },

  // Add place modal
  modal: { flex: 1, paddingHorizontal: 24, paddingTop: 36, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  modalClose: { fontSize: 18, color: "#9ca3af", padding: 4 },
  coordsHint: {
    fontSize: 12, color: "#6b7280", marginBottom: 14,
    backgroundColor: "#f3f4f6", padding: 8, borderRadius: 8,
  },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  fieldInput: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10,
    padding: 12, marginBottom: 14, fontSize: 14, backgroundColor: "#fafafa",
  },
  collChip: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 99,
    paddingHorizontal: 14, paddingVertical: 6, marginRight: 8, backgroundColor: "#fff",
  },
  collChipActive: { borderColor: "#4f46e5", backgroundColor: "#eef2ff" },
  collChipText: { fontSize: 13, color: "#374151" },
  collChipTextActive: { color: "#4f46e5", fontWeight: "600" },
  typeChip: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff",
  },
  typeChipText: { fontSize: 12, color: "#374151" },
  saveBtn: {
    backgroundColor: "#4f46e5", borderRadius: 10,
    padding: 14, alignItems: "center", marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },

  // Map type toggle
  mapTypeBtn: {
    position: "absolute", right: 16, zIndex: 25,
    backgroundColor: "#fff", borderRadius: 22,
    paddingHorizontal: 10, paddingVertical: 7,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 5,
    borderWidth: 1, borderColor: "#e5e7eb",
    flexDirection: "row", gap: 4,
  },
  mapTypeBtnIcon: { fontSize: 16 },
  mapTypeBtnLabel: { fontSize: 11, fontWeight: "600", color: "#374151" },

  // Photos
  photoThumb: { width: 70, height: 70, borderRadius: 10 },
  photoRemove: {
    position: "absolute", top: -5, right: -5,
    backgroundColor: "#ef4444", borderRadius: 99,
    width: 18, height: 18, justifyContent: "center", alignItems: "center",
  },
  photoAddBtn: {
    borderWidth: 1.5, borderColor: "#6366f1", borderStyle: "dashed",
    borderRadius: 10, paddingVertical: 10,
    alignItems: "center", marginBottom: 18,
  },
  photoAddBtnText: { fontSize: 13, color: "#6366f1", fontWeight: "600" },
});

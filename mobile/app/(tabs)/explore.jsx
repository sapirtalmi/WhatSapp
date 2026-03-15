import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { getNearbyPlaces, createPlace, getGlobalPlaces } from "../../src/api/places";
import { useAuth } from "../../src/context/AuthContext";
import api from "../../src/api/axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

const PLACE_TYPES = [
  { value: null, label: "All", color: "#6366f1" },
  { value: "food", label: "🍽 Food", color: "#f97316" },
  { value: "travel", label: "✈️ Travel", color: "#3b82f6" },
  { value: "exercise", label: "🏋 Exercise", color: "#ef4444" },
  { value: "shop", label: "🛍 Shop", color: "#a855f7" },
  { value: "hangout", label: "☕️ Hangout", color: "#22c55e" },
];

const TYPE_COLORS = {
  food: "#f97316",
  travel: "#3b82f6",
  exercise: "#ef4444",
  shop: "#a855f7",
  hangout: "#22c55e",
};

const DEFAULT_EXTRA = {
  food:     { photos: [], recommended_dishes: [], best_time_to_visit: "", price_range: null, is_kosher: null, comments: "" },
  travel:   { photos: [], subtype: null, duration_minutes: "", difficulty: null, equipment: [], guide_required: null, trail_length_km: "", comments: "" },
  exercise: { photos: [], subtype: null, price_type: null, price_monthly: "", exercise_types: [], has_showers: null, equipment_provided: null, comments: "" },
  shop:     { photos: [], shop_type: "", price_range: null, comments: "" },
  hangout:  { photos: [], hangout_type: "", price_range: null, best_time_to_visit: "", comments: "" },
};

const PRICE_RANGES = ["₪", "₪₪", "₪₪₪", "₪₪₪₪"];

// ── Pill selector ─────────────────────────────────────────────────────────────

function PillRow({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {options.map((opt) => {
          const v = typeof opt === "string" ? opt : opt.value;
          const label = typeof opt === "string" ? opt : opt.label;
          const active = value === v;
          return (
            <TouchableOpacity
              key={v}
              onPress={() => onChange(active ? null : v)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Tag input ─────────────────────────────────────────────────────────────────

function TagRow({ tags, onChange, placeholder }) {
  const [input, setInput] = useState("");
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {tags.map((tag, i) => (
          <TouchableOpacity key={i} onPress={() => onChange(tags.filter((_, j) => j !== i))} style={styles.tag}>
            <Text style={styles.tagText}>{tag} ×</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          value={input}
          onChangeText={setInput}
          placeholder={placeholder ?? "Add item, tap +"}
          returnKeyType="done"
          onSubmitEditing={() => { const t = input.trim(); if (t) { onChange([...tags, t]); setInput(""); } }}
        />
        <TouchableOpacity
          onPress={() => { const t = input.trim(); if (t) { onChange([...tags, t]); setInput(""); } }}
          style={styles.tagAddBtn}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({ value, onChange }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {[true, false].map((v) => (
        <TouchableOpacity
          key={String(v)}
          onPress={() => onChange(value === v ? null : v)}
          style={[styles.pill, value === v && styles.pillActive]}
        >
          <Text style={[styles.pillText, value === v && styles.pillTextActive]}>{v ? "Yes" : "No"}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const { user } = useAuth();
  const [location, setLocation] = useState(null);
  const [allPlaces, setAllPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState(null);
  const [source, setSource] = useState("nearby"); // "nearby" | "mine" | "all"

  // Add-place state
  const [pendingPin, setPendingPin] = useState(null);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [placeType, setPlaceType] = useState(null);
  const [extraData, setExtraData] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const mapRef = useRef(null);

  useEffect(() => {
    if (source === "nearby") loadNearby();
    else loadGlobal();
  }, [source, activeType]);

  useEffect(() => {
    api.get("/collections", { params: { mine_only: true } }).then((r) => {
      const cols = r.data;
      setCollections(cols);
      if (cols.length > 0) setSelectedCollection(cols[0].id);
    }).catch(() => {});
  }, []);

  async function loadNearby() {
    setLoading(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Location access is needed to find nearby places.");
      setLoading(false);
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = loc.coords;
    setLocation({ latitude, longitude });
    try {
      const data = await getNearbyPlaces(latitude, longitude, 5000, activeType || undefined);
      setAllPlaces(data);
    } catch { /* silent */ } finally { setLoading(false); }
  }

  async function loadGlobal() {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (activeType) params.type = activeType;
      if (source === "mine" && user?.id) params.owner_id = user.id;
      const data = await getGlobalPlaces(params);
      setAllPlaces(data);
      if (data.length > 0 && !location) setLocation({ latitude: data[0].lat, longitude: data[0].lng });
    } catch { /* silent */ } finally { setLoading(false); }
  }

  const visiblePlaces = activeType ? allPlaces.filter((p) => p.type === activeType) : allPlaces;

  async function handleMapPress(e) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPendingPin({ latitude, longitude });
    setPlaceName(""); setPlaceAddress("Getting address…"); setPlaceType(null); setExtraData({});
    setShowAddModal(true);
    try {
      const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (result) {
        const parts = [result.street, result.city].filter(Boolean);
        setPlaceAddress(parts.join(", ") || "");
      } else {
        setPlaceAddress("");
      }
    } catch {
      setPlaceAddress("");
    }
  }

  function handlePlaceTypeChange(newType) {
    if (newType === placeType) { setPlaceType(null); setExtraData({}); }
    else { setPlaceType(newType); setExtraData({ ...(DEFAULT_EXTRA[newType] ?? {}) }); }
  }

  function setExtra(field, value) { setExtraData((prev) => ({ ...prev, [field]: value })); }

  async function handlePickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission required", "Allow photo library access to upload photos."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingPhoto(true);
    const urls = [];
    for (const asset of result.assets) {
      const fd = new FormData();
      const filename = asset.uri.split("/").pop();
      const ext = filename?.split(".").pop() ?? "jpg";
      fd.append("file", { uri: asset.uri, name: filename ?? `photo.${ext}`, type: `image/${ext}` });
      try {
        const res = await api.post("/uploads/photo", fd, { headers: { "Content-Type": "multipart/form-data" } });
        urls.push(res.data.url);
      } catch { Alert.alert("Upload failed", "Could not upload one of the photos."); }
    }
    setExtraData((prev) => ({ ...prev, photos: [...(prev.photos ?? []), ...urls] }));
    setUploadingPhoto(false);
  }

  function removePhoto(url) {
    setExtraData((prev) => ({ ...prev, photos: (prev.photos ?? []).filter((u) => u !== url) }));
  }

  function buildExtraData() {
    if (!placeType) return null;
    const ed = { ...extraData };
    if ("duration_minutes" in ed) ed.duration_minutes = ed.duration_minutes !== "" ? (parseInt(ed.duration_minutes) || null) : null;
    if ("trail_length_km" in ed) ed.trail_length_km = ed.trail_length_km !== "" ? (parseFloat(ed.trail_length_km) || null) : null;
    if ("price_monthly" in ed) ed.price_monthly = ed.price_monthly !== "" ? (parseFloat(ed.price_monthly) || null) : null;
    for (const k of ["best_time_to_visit", "comments", "shop_type", "hangout_type"]) {
      if (k in ed && ed[k] === "") ed[k] = null;
    }
    return ed;
  }

  async function handleAddPlace() {
    if (!placeName.trim() || !selectedCollection) {
      Alert.alert("Required", "Please enter a name and select a collection."); return;
    }
    setSaving(true);
    try {
      const newPlace = await createPlace(selectedCollection, {
        name: placeName.trim(),
        address: placeAddress.trim() || null,
        lat: pendingPin.latitude,
        lng: pendingPin.longitude,
        type: placeType || null,
        extra_data: buildExtraData(),
      });
      setAllPlaces((prev) => [...prev, newPlace]);
      setShowAddModal(false);
      setPendingPin(null);
    } catch (err) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "Failed to add place.";
      Alert.alert("Error", String(msg));
    } finally { setSaving(false); }
  }

  function cancelAdd() { setShowAddModal(false); setPendingPin(null); }

  // ── Extra fields section ──────────────────────────────────────────────────

  function ExtraFields() {
    if (!placeType) return null;
    const photos = extraData.photos ?? [];

    const PhotoSection = (
      <View style={styles.extraGroup}>
        <Text style={styles.extraLabel}>Photos</Text>
        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {photos.map((url, i) => (
                <View key={i} style={{ position: "relative" }}>
                  <Image source={{ uri: `${API_URL}${url}` }} style={styles.photoThumb} />
                  <TouchableOpacity onPress={() => removePhoto(url)} style={styles.photoRemove}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
        <TouchableOpacity
          onPress={handlePickPhoto}
          disabled={uploadingPhoto || photos.length >= 5}
          style={[styles.photoAddBtn, (uploadingPhoto || photos.length >= 5) && { opacity: 0.5 }]}
        >
          <Text style={styles.photoAddBtnText}>{uploadingPhoto ? "Uploading…" : "+ Add photos"}</Text>
        </TouchableOpacity>
      </View>
    );

    const CommentsField = (
      <View style={styles.extraGroup}>
        <Text style={styles.extraLabel}>Comments</Text>
        <TextInput style={[styles.input, styles.textArea]} value={extraData.comments ?? ""} onChangeText={(v) => setExtra("comments", v)} placeholder="Any notes…" multiline />
      </View>
    );

    if (placeType === "food") return (
      <View>
        {PhotoSection}
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Recommended dishes</Text><TagRow tags={extraData.recommended_dishes ?? []} onChange={(v) => setExtra("recommended_dishes", v)} placeholder="e.g. Hummus" /></View>
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Best time to visit</Text><TextInput style={styles.input} value={extraData.best_time_to_visit ?? ""} onChangeText={(v) => setExtra("best_time_to_visit", v)} placeholder="e.g. Saturday brunch" /></View>
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Price range</Text><PillRow options={PRICE_RANGES} value={extraData.price_range} onChange={(v) => setExtra("price_range", v)} /></View>
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Kosher?</Text><ToggleRow value={extraData.is_kosher} onChange={(v) => setExtra("is_kosher", v)} /></View>
        {CommentsField}
      </View>
    );

    if (placeType === "travel") return (
      <View>
        {PhotoSection}
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Subtype</Text><PillRow options={["hike", "viewpoint", "picnic", "beach", "waterfall", "landmark"]} value={extraData.subtype} onChange={(v) => setExtra("subtype", v)} /></View>
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Difficulty</Text><PillRow options={["easy", "moderate", "hard", "extreme"]} value={extraData.difficulty} onChange={(v) => setExtra("difficulty", v)} /></View>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1 }}><Text style={styles.extraLabel}>Duration (min)</Text><TextInput style={[styles.input, { marginBottom: 0 }]} value={extraData.duration_minutes ?? ""} onChangeText={(v) => setExtra("duration_minutes", v)} placeholder="90" keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Text style={styles.extraLabel}>Trail (km)</Text><TextInput style={[styles.input, { marginBottom: 0 }]} value={extraData.trail_length_km ?? ""} onChangeText={(v) => setExtra("trail_length_km", v)} placeholder="5.2" keyboardType="decimal-pad" /></View>
        </View>
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Equipment</Text><TagRow tags={extraData.equipment ?? []} onChange={(v) => setExtra("equipment", v)} placeholder="e.g. hiking boots" /></View>
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Guide required?</Text><ToggleRow value={extraData.guide_required} onChange={(v) => setExtra("guide_required", v)} /></View>
        {CommentsField}
      </View>
    );

    if (placeType === "exercise") return (
      <View>
        {PhotoSection}
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Subtype</Text><PillRow options={["gym", "outdoor", "pool", "yoga_studio", "crossfit", "sports_court", "martial_arts"]} value={extraData.subtype} onChange={(v) => setExtra("subtype", v)} /></View>
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Pricing</Text><PillRow options={["free", "paid", "membership"]} value={extraData.price_type} onChange={(v) => setExtra("price_type", v)} /></View>
        {(extraData.price_type === "paid" || extraData.price_type === "membership") && (
          <View style={styles.extraGroup}><Text style={styles.extraLabel}>Monthly price (₪)</Text><TextInput style={styles.input} value={extraData.price_monthly ?? ""} onChangeText={(v) => setExtra("price_monthly", v)} placeholder="200" keyboardType="decimal-pad" /></View>
        )}
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Exercise types</Text><TagRow tags={extraData.exercise_types ?? []} onChange={(v) => setExtra("exercise_types", v)} placeholder="e.g. yoga" /></View>
        <View style={{ flexDirection: "row", gap: 24, marginBottom: 8 }}>
          <View><Text style={styles.extraLabel}>Showers?</Text><ToggleRow value={extraData.has_showers} onChange={(v) => setExtra("has_showers", v)} /></View>
          <View><Text style={styles.extraLabel}>Equipment?</Text><ToggleRow value={extraData.equipment_provided} onChange={(v) => setExtra("equipment_provided", v)} /></View>
        </View>
        {CommentsField}
      </View>
    );

    if (placeType === "shop") return (
      <View>
        {PhotoSection}
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Shop type</Text><TextInput style={styles.input} value={extraData.shop_type ?? ""} onChangeText={(v) => setExtra("shop_type", v)} placeholder="e.g. clothing, electronics" /></View>
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Price range</Text><PillRow options={PRICE_RANGES} value={extraData.price_range} onChange={(v) => setExtra("price_range", v)} /></View>
        {CommentsField}
      </View>
    );

    if (placeType === "hangout") return (
      <View>
        {PhotoSection}
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Hangout type</Text><TextInput style={styles.input} value={extraData.hangout_type ?? ""} onChangeText={(v) => setExtra("hangout_type", v)} placeholder="e.g. park, rooftop bar" /></View>
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Price range</Text><PillRow options={PRICE_RANGES} value={extraData.price_range} onChange={(v) => setExtra("price_range", v)} /></View>
        <View style={styles.extraGroup}><Text style={styles.extraLabel}>Best time to visit</Text><TextInput style={styles.input} value={extraData.best_time_to_visit ?? ""} onChangeText={(v) => setExtra("best_time_to_visit", v)} placeholder="e.g. Saturday evening" /></View>
        {CommentsField}
      </View>
    );

    return null;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Getting location…</Text>
      </View>
    );
  }

  if (!location && source === "nearby") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Location unavailable.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Type filter bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {PLACE_TYPES.map((t) => (
            <TouchableOpacity
              key={String(t.value)}
              style={[styles.filterChip, activeType === t.value && { backgroundColor: t.color, borderColor: t.color }]}
              onPress={() => setActiveType(t.value)}
            >
              <Text style={[styles.filterChipText, activeType === t.value && styles.filterChipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Source filter bar */}
      <View style={styles.sourceBar}>
        {[{ v: "nearby", label: "📍 Nearby" }, { v: "mine", label: "👤 Mine" }, { v: "all", label: "🌍 All" }].map(({ v, label }) => (
          <TouchableOpacity
            key={v}
            style={[styles.sourceBtn, source === v && styles.sourceBtnActive]}
            onPress={() => setSource(v)}
          >
            <Text style={[styles.sourceBtnText, source === v && styles.sourceBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={
          location
            ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
            : { latitude: 32.0853, longitude: 34.7818, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        }
        showsUserLocation
        onPress={handleMapPress}
      >
        {pendingPin && <Marker coordinate={pendingPin} pinColor="#10b981" />}
        {visiblePlaces.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            pinColor={TYPE_COLORS[place.type] ?? "#4f46e5"}
          >
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{place.name}</Text>
                {place.address ? <Text style={styles.calloutSub}>{place.address}</Text> : null}
                {place.collection_title ? <Text style={styles.calloutColl}>📚 {place.collection_title}</Text> : null}
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Add place modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancelAdd}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add place</Text>
              <TouchableOpacity onPress={cancelAdd}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>

            {pendingPin && (
              <Text style={styles.coordsHint}>
                📍 {pendingPin.latitude.toFixed(5)}, {pendingPin.longitude.toFixed(5)}
              </Text>
            )}

            <Text style={styles.sectionLabel}>Place name *</Text>
            <TextInput style={styles.input} placeholder="e.g. Coffee Aroma" value={placeName} onChangeText={setPlaceName} />
            <Text style={styles.sectionLabel}>Address</Text>
            <TextInput style={styles.input} placeholder="e.g. 12 Herzl St, Tel Aviv" value={placeAddress} onChangeText={setPlaceAddress} />

            <Text style={styles.sectionLabel}>Collection *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={{ flexDirection: "row", alignItems: "center" }}
            >
              {collections.filter((c) => c.owner_id != null).map((c) => (
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

            <Text style={styles.sectionLabel}>Type</Text>
            <View style={styles.typeRow}>
              {PLACE_TYPES.filter((t) => t.value !== null).map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, placeType === t.value && { borderColor: t.color, backgroundColor: t.color + "20" }]}
                  onPress={() => handlePlaceTypeChange(t.value)}
                >
                  <Text style={[styles.typeChipText, placeType === t.value && { color: t.color }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {placeType && (
              <View style={styles.extraSection}>
                <Text style={styles.sectionLabel}>
                  {PLACE_TYPES.find((t) => t.value === placeType)?.label} details
                </Text>
                <ExtraFields />
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleAddPlace}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Add place"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#6b7280" },
  errorText: { color: "#ef4444", fontSize: 15 },
  filterBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    paddingTop: 12, paddingBottom: 8, backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  filterScroll: { paddingHorizontal: 12, flexDirection: "row", gap: 8 },
  filterChip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: "#fff" },
  filterChipText: { fontSize: 12, color: "#6b7280", fontWeight: "500" },
  filterChipTextActive: { color: "#fff" },
  callout: { width: 170, padding: 4 },
  calloutTitle: { fontWeight: "600", fontSize: 13 },
  calloutSub: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  calloutColl: { fontSize: 10, color: "#6366f1", marginTop: 2 },
  modal: { flex: 1, paddingHorizontal: 24, paddingTop: 36, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  modalClose: { fontSize: 18, color: "#9ca3af", padding: 4 },
  coordsHint: { fontSize: 12, color: "#6b7280", marginBottom: 14, backgroundColor: "#f3f4f6", padding: 8, borderRadius: 8 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14, backgroundColor: "#fafafa" },
  textArea: { height: 70, textAlignVertical: "top" },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  chipScroll: { marginBottom: 14 },
  collChip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8, backgroundColor: "#fff" },
  collChipActive: { borderColor: "#4f46e5", backgroundColor: "#eef2ff" },
  collChipText: { fontSize: 13, color: "#374151" },
  collChipTextActive: { color: "#4f46e5", fontWeight: "600" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  typeChip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff" },
  typeChipText: { fontSize: 12, color: "#374151" },
  extraSection: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  extraGroup: { marginBottom: 12 },
  extraLabel: { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 },
  pill: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: "#fff" },
  pillActive: { borderColor: "#4f46e5", backgroundColor: "#eef2ff" },
  pillText: { fontSize: 12, color: "#374151" },
  pillTextActive: { color: "#4f46e5", fontWeight: "600" },
  tag: { backgroundColor: "#eef2ff", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, color: "#4f46e5" },
  tagAddBtn: { backgroundColor: "#4f46e5", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  photoThumb: { width: 64, height: 64, borderRadius: 8 },
  photoRemove: { position: "absolute", top: -4, right: -4, backgroundColor: "#ef4444", borderRadius: 99, width: 16, height: 16, justifyContent: "center", alignItems: "center" },
  photoAddBtn: { borderWidth: 1.5, borderColor: "#4f46e5", borderStyle: "dashed", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  photoAddBtnText: { fontSize: 13, color: "#4f46e5", fontWeight: "600" },
  saveBtn: { backgroundColor: "#4f46e5", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  sourceBar: { position: "absolute", top: 52, left: 0, right: 0, zIndex: 9, flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.92)" },
  sourceBtn: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 5, backgroundColor: "#fff" },
  sourceBtnActive: { borderColor: "#4f46e5", backgroundColor: "#eef2ff" },
  sourceBtnText: { fontSize: 12, color: "#374151", fontWeight: "500" },
  sourceBtnTextActive: { color: "#4f46e5", fontWeight: "600" },
});

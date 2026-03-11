import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { useLocalSearchParams, Stack } from "expo-router";
import { getPlaces, createPlace, deletePlace } from "../../src/api/places";
import { getCollections } from "../../src/api/collections";
import { getTravelGuide, analyzePhoto } from "../../src/api/ai";
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

const TYPE_BADGE = {
  food:     { bg: "#fff7ed", text: "#c2410c" },
  travel:   { bg: "#eff6ff", text: "#1d4ed8" },
  exercise: { bg: "#fef2f2", text: "#b91c1c" },
  shop:     { bg: "#faf5ff", text: "#7e22ce" },
  hangout:  { bg: "#f0fdf4", text: "#15803d" },
};

const DEFAULT_EXTRA = {
  food:     { photos: [], recommended_dishes: [], best_time_to_visit: "", price_range: null, is_kosher: null, comments: "" },
  travel:   { photos: [], subtype: null, duration_minutes: "", difficulty: null, equipment: [], guide_required: null, trail_length_km: "", comments: "" },
  exercise: { photos: [], subtype: null, price_type: null, price_monthly: "", exercise_types: [], has_showers: null, equipment_provided: null, comments: "" },
  shop:     { photos: [], shop_type: "", price_range: null, comments: "" },
  hangout:  { photos: [], hangout_type: "", price_range: null, best_time_to_visit: "", comments: "" },
};

const PRICE_RANGES = ["₪", "₪₪", "₪₪₪", "₪₪₪₪"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMetaSnippet(type, extra) {
  if (!extra) return null;
  const parts = [];
  if (type === "food") {
    if (extra.price_range) parts.push(extra.price_range);
    if (extra.is_kosher === true) parts.push("Kosher ✓");
  } else if (type === "travel") {
    if (extra.difficulty) parts.push(extra.difficulty);
    if (extra.duration_minutes) parts.push(`${extra.duration_minutes} min`);
  } else if (type === "exercise") {
    if (extra.subtype) parts.push(extra.subtype.replace(/_/g, " "));
    if (extra.price_type) parts.push(extra.price_type);
  } else if (type === "shop") {
    if (extra.price_range) parts.push(extra.price_range);
    if (extra.shop_type) parts.push(extra.shop_type);
  } else if (type === "hangout") {
    if (extra.price_range) parts.push(extra.price_range);
    if (extra.hangout_type) parts.push(extra.hangout_type);
  }
  return parts.join(" · ") || null;
}

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
          <TouchableOpacity
            key={i}
            onPress={() => onChange(tags.filter((_, j) => j !== i))}
            style={styles.tag}
          >
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
          onSubmitEditing={() => {
            const t = input.trim();
            if (t) { onChange([...tags, t]); setInput(""); }
          }}
        />
        <TouchableOpacity
          onPress={() => {
            const t = input.trim();
            if (t) { onChange([...tags, t]); setInput(""); }
          }}
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

// ── Photo strip (display) ─────────────────────────────────────────────────────

function PhotoStrip({ photos }) {
  if (!photos?.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {photos.map((url, i) => (
          <Image key={i} source={{ uri: `${API_URL}${url}` }} style={styles.photoThumb} />
        ))}
      </View>
    </ScrollView>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CollectionDetail() {
  const { id } = useLocalSearchParams();
  const collectionId = Number(id);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collectionTitle, setCollectionTitle] = useState("");
  const [view, setView] = useState("list");
  const [activeType, setActiveType] = useState(null);

  // Add place state
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingPin, setPendingPin] = useState(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [type, setType] = useState(null);
  const [extraData, setExtraData] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  // Travel guide
  const [guideVisible, setGuideVisible] = useState(false);
  const [guide, setGuide] = useState(null);
  const [guideLoading, setGuideLoading] = useState(false);

  // AI photo suggestion
  const [aiSuggestion, setAiSuggestion] = useState(null);

  async function handleTravelGuide() {
    setGuide(null);
    setGuideVisible(true);
    setGuideLoading(true);
    try {
      const res = await getTravelGuide(collectionId);
      setGuide(res);
    } catch {
      Alert.alert("AI", "Could not generate travel guide.");
      setGuideVisible(false);
    } finally {
      setGuideLoading(false);
    }
  }

  function loadPlaces(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    getPlaces(collectionId)
      .then(setPlaces)
      .catch(() => Alert.alert("Error", "Failed to load places."))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => {
    getCollections()
      .then((cols) => {
        const col = cols.find((c) => c.id === collectionId);
        if (col) setCollectionTitle(col.title);
      })
      .catch(() => {});
    loadPlaces();
  }, [collectionId]);

  const filteredPlaces = activeType ? places.filter((p) => p.type === activeType) : places;

  function openAddModal(pin = null) {
    setName(""); setAddress(""); setDescription(""); setType(null); setExtraData({}); setAiSuggestion(null);
    if (pin) {
      setLat(String(pin.latitude.toFixed(6)));
      setLng(String(pin.longitude.toFixed(6)));
      setPendingPin(pin);
    } else {
      setLat(""); setLng(""); setPendingPin(null);
    }
    setModalVisible(true);
  }

  function handleTypeChange(newType) {
    if (newType === type) {
      setType(null);
      setExtraData({});
    } else {
      setType(newType);
      setExtraData({ ...(DEFAULT_EXTRA[newType] ?? {}) });
    }
  }

  function setExtra(field, value) {
    setExtraData((prev) => ({ ...prev, [field]: value }));
  }

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
      } catch {
        Alert.alert("Upload failed", "Could not upload one of the photos.");
      }
    }
    setExtraData((prev) => ({ ...prev, photos: [...(prev.photos ?? []), ...urls] }));
    // Analyze first uploaded photo if no type selected yet
    if (urls.length > 0 && !type) {
      try {
        const analysis = await analyzePhoto(urls[0]);
        if (analysis.confidence !== "low") setAiSuggestion(analysis);
      } catch { /* ignore */ }
    }
    setUploadingPhoto(false);
  }

  function removePhoto(url) {
    setExtraData((prev) => ({ ...prev, photos: (prev.photos ?? []).filter((u) => u !== url) }));
  }

  function handleMapPress(e) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    openAddModal({ latitude, longitude });
  }

  function buildExtraData() {
    if (!type) return null;
    const ed = { ...extraData };
    if ("duration_minutes" in ed) ed.duration_minutes = ed.duration_minutes !== "" ? (parseInt(ed.duration_minutes) || null) : null;
    if ("trail_length_km" in ed) ed.trail_length_km = ed.trail_length_km !== "" ? (parseFloat(ed.trail_length_km) || null) : null;
    if ("price_monthly" in ed) ed.price_monthly = ed.price_monthly !== "" ? (parseFloat(ed.price_monthly) || null) : null;
    for (const k of ["best_time_to_visit", "comments", "shop_type", "hangout_type"]) {
      if (k in ed && ed[k] === "") ed[k] = null;
    }
    return ed;
  }

  async function handleAdd() {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!name || isNaN(latNum) || isNaN(lngNum)) {
      Alert.alert("Required", "Name, latitude and longitude are required.");
      return;
    }
    setSaving(true);
    try {
      const p = await createPlace(collectionId, {
        name, address: address || null, description: description || null,
        lat: latNum, lng: lngNum, type: type || null,
        extra_data: buildExtraData(),
      });
      setPlaces((prev) => [p, ...prev]);
      setModalVisible(false);
      setPendingPin(null);
    } catch {
      Alert.alert("Error", "Failed to add place.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(placeId) {
    Alert.alert("Delete place", "Remove this place?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deletePlace(collectionId, placeId);
            setPlaces((prev) => prev.filter((p) => p.id !== placeId));
          } catch { Alert.alert("Error", "Failed to delete."); }
        },
      },
    ]);
  }

  const mapRegion = places.length
    ? {
        latitude: places.reduce((s, p) => s + p.lat, 0) / places.length,
        longitude: places.reduce((s, p) => s + p.lng, 0) / places.length,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      }
    : { latitude: 32.0853, longitude: 34.7818, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#4f46e5" size="large" /></View>;
  }

  // ── Type-specific extra fields in modal ───────────────────────────────────

  function ExtraFields() {
    if (!type) return null;

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
        <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto || photos.length >= 5} style={[styles.photoAddBtn, (uploadingPhoto || photos.length >= 5) && { opacity: 0.5 }]}>
          <Text style={styles.photoAddBtnText}>{uploadingPhoto ? "Uploading…" : "+ Add photos"}</Text>
        </TouchableOpacity>
      </View>
    );

    const CommentsField = (
      <View style={styles.extraGroup}>
        <Text style={styles.extraLabel}>Comments</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={extraData.comments ?? ""}
          onChangeText={(v) => setExtra("comments", v)}
          placeholder="Any notes…"
          placeholderTextColor="#9CA3AF"
          multiline
        />
      </View>
    );

    if (type === "food") return (
      <View>
        {PhotoSection}
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Recommended dishes</Text>
          <TagRow tags={extraData.recommended_dishes ?? []} onChange={(v) => setExtra("recommended_dishes", v)} placeholder="e.g. Hummus" />
        </View>
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Best time to visit</Text>
          <TextInput style={styles.input} value={extraData.best_time_to_visit ?? ""} onChangeText={(v) => setExtra("best_time_to_visit", v)} placeholder="e.g. Saturday brunch" placeholderTextColor="#9CA3AF" />
        </View>
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Price range</Text>
          <PillRow options={PRICE_RANGES} value={extraData.price_range} onChange={(v) => setExtra("price_range", v)} />
        </View>
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Kosher?</Text>
          <ToggleRow value={extraData.is_kosher} onChange={(v) => setExtra("is_kosher", v)} />
        </View>
        {CommentsField}
      </View>
    );

    if (type === "travel") return (
      <View>
        {PhotoSection}
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Subtype</Text>
          <PillRow options={["hike", "viewpoint", "picnic", "beach", "waterfall", "landmark"]} value={extraData.subtype} onChange={(v) => setExtra("subtype", v)} />
        </View>
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Difficulty</Text>
          <PillRow options={["easy", "moderate", "hard", "extreme"]} value={extraData.difficulty} onChange={(v) => setExtra("difficulty", v)} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.extraLabel}>Duration (min)</Text>
            <TextInput style={[styles.input, { marginBottom: 0 }]} value={extraData.duration_minutes ?? ""} onChangeText={(v) => setExtra("duration_minutes", v)} placeholder="90" keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.extraLabel}>Trail (km)</Text>
            <TextInput style={[styles.input, { marginBottom: 0 }]} value={extraData.trail_length_km ?? ""} onChangeText={(v) => setExtra("trail_length_km", v)} placeholder="5.2" keyboardType="decimal-pad" />
          </View>
        </View>
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Equipment</Text>
          <TagRow tags={extraData.equipment ?? []} onChange={(v) => setExtra("equipment", v)} placeholder="e.g. hiking boots" />
        </View>
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Guide required?</Text>
          <ToggleRow value={extraData.guide_required} onChange={(v) => setExtra("guide_required", v)} />
        </View>
        {CommentsField}
      </View>
    );

    if (type === "exercise") return (
      <View>
        {PhotoSection}
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Subtype</Text>
          <PillRow options={["gym", "outdoor", "pool", "yoga_studio", "crossfit", "sports_court", "martial_arts"]} value={extraData.subtype} onChange={(v) => setExtra("subtype", v)} />
        </View>
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Pricing</Text>
          <PillRow options={["free", "paid", "membership"]} value={extraData.price_type} onChange={(v) => setExtra("price_type", v)} />
        </View>
        {(extraData.price_type === "paid" || extraData.price_type === "membership") && (
          <View style={styles.extraGroup}>
            <Text style={styles.extraLabel}>Monthly price (₪)</Text>
            <TextInput style={styles.input} value={extraData.price_monthly ?? ""} onChangeText={(v) => setExtra("price_monthly", v)} placeholder="200" keyboardType="decimal-pad" />
          </View>
        )}
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Exercise types</Text>
          <TagRow tags={extraData.exercise_types ?? []} onChange={(v) => setExtra("exercise_types", v)} placeholder="e.g. yoga" />
        </View>
        <View style={{ flexDirection: "row", gap: 24, marginBottom: 8 }}>
          <View><Text style={styles.extraLabel}>Showers?</Text><ToggleRow value={extraData.has_showers} onChange={(v) => setExtra("has_showers", v)} /></View>
          <View><Text style={styles.extraLabel}>Equipment?</Text><ToggleRow value={extraData.equipment_provided} onChange={(v) => setExtra("equipment_provided", v)} /></View>
        </View>
        {CommentsField}
      </View>
    );

    if (type === "shop") return (
      <View>
        {PhotoSection}
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Shop type</Text>
          <TextInput style={styles.input} value={extraData.shop_type ?? ""} onChangeText={(v) => setExtra("shop_type", v)} placeholder="e.g. clothing, electronics" />
        </View>
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Price range</Text>
          <PillRow options={PRICE_RANGES} value={extraData.price_range} onChange={(v) => setExtra("price_range", v)} />
        </View>
        {CommentsField}
      </View>
    );

    if (type === "hangout") return (
      <View>
        {PhotoSection}
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Hangout type</Text>
          <TextInput style={styles.input} value={extraData.hangout_type ?? ""} onChangeText={(v) => setExtra("hangout_type", v)} placeholder="e.g. park, rooftop bar" />
        </View>
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Price range</Text>
          <PillRow options={PRICE_RANGES} value={extraData.price_range} onChange={(v) => setExtra("price_range", v)} />
        </View>
        <View style={styles.extraGroup}>
          <Text style={styles.extraLabel}>Best time to visit</Text>
          <TextInput style={styles.input} value={extraData.best_time_to_visit ?? ""} onChangeText={(v) => setExtra("best_time_to_visit", v)} placeholder="e.g. Saturday evening" />
        </View>
        {CommentsField}
      </View>
    );

    return null;
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: collectionTitle || "Collection",
          headerRight: () => (
            <TouchableOpacity onPress={() => loadPlaces(true)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
              <Text style={styles.headerRefresh}>↻</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* View toggle + Add button */}
      <View style={styles.header}>
        <View style={styles.toggle}>
          <TouchableOpacity style={[styles.toggleBtn, view === "list" && styles.toggleActive]} onPress={() => setView("list")}>
            <Text style={[styles.toggleText, view === "list" && styles.toggleTextActive]}>☰ List</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, view === "map" && styles.toggleActive]} onPress={() => setView("map")}>
            <Text style={[styles.toggleText, view === "map" && styles.toggleTextActive]}>🗺 Map</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={styles.guideBtn} onPress={handleTravelGuide}>
            <Text style={styles.guideBtnText}>✈️ Guide</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => openAddModal(null)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Type filter chips */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {PLACE_TYPES.map((t) => (
            <TouchableOpacity
              key={String(t.value)}
              style={[styles.filterChip, activeType === t.value && { backgroundColor: t.color, borderColor: t.color }]}
              onPress={() => setActiveType(t.value)}
            >
              <Text style={[styles.filterChipText, activeType === t.value && styles.filterChipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Map view */}
      {view === "map" && (
        <View style={styles.mapContainer}>
          <Text style={styles.mapHint}>Tap the map to add a place</Text>
          <MapView style={StyleSheet.absoluteFill} region={mapRegion} onPress={handleMapPress}>
            {pendingPin && <Marker coordinate={pendingPin} pinColor="#10b981" />}
            {filteredPlaces.map((place) => (
              <Marker key={place.id} coordinate={{ latitude: place.lat, longitude: place.lng }} pinColor={TYPE_COLORS[place.type] ?? "#4f46e5"}>
                <Callout>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>{place.name}</Text>
                    {place.address ? <Text style={styles.calloutSub}>{place.address}</Text> : null}
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
        </View>
      )}

      {/* List view */}
      {view === "list" && (
        <FlatList
          data={filteredPlaces}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPlaces(true)} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📍</Text>
              <Text style={styles.emptyText}>{activeType ? "No places with this type." : "No places yet. Add one!"}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = TYPE_BADGE[item.type];
            const typeLabel = PLACE_TYPES.find((t) => t.value === item.type)?.label;
            const meta = getMetaSnippet(item.type, item.extra_data);
            const photos = item.extra_data?.photos ?? [];
            return (
              <View style={[styles.card, { borderLeftColor: TYPE_COLORS[item.type] ?? "#6366f1" }]}>
                {/* Photo strip */}
                {photos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      {photos.map((url, i) => (
                        <Image key={i} source={{ uri: `${API_URL}${url}` }} style={styles.cardPhoto} />
                      ))}
                    </View>
                  </ScrollView>
                )}
                <View style={styles.cardRow}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  {item.type && badge && (
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{typeLabel}</Text>
                    </View>
                  )}
                </View>
                {item.address ? <Text style={styles.cardSub}>{item.address}</Text> : null}
                {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
                {meta ? <Text style={styles.cardMeta}>{meta}</Text> : null}
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* Travel guide modal */}
      <Modal visible={guideVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setGuideVisible(false); setGuide(null); }}>
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.guideHeader}>
            <Text style={styles.guideTitle} numberOfLines={1}>{guide?.title ?? "✈️ Travel Guide"}</Text>
            <TouchableOpacity onPress={() => { setGuideVisible(false); setGuide(null); }}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          {guideLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#0d9488" size="large" />
              <Text style={{ color: "#94a3b8", marginTop: 12, fontSize: 14 }}>Generating your travel guide…</Text>
            </View>
          ) : guide ? (
            <ScrollView style={styles.guideBody} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.guideText}>{guide.guide}</Text>
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      {/* Add place modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add place</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setPendingPin(null); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {pendingPin && (
              <Text style={styles.coordsHint}>
                📍 {pendingPin.latitude.toFixed(5)}, {pendingPin.longitude.toFixed(5)}
              </Text>
            )}

            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput style={styles.input} placeholder="e.g. Blue Cafe" placeholderTextColor="#9CA3AF" value={name} onChangeText={setName} />
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput style={styles.input} placeholder="e.g. 12 Dizengoff St, Tel Aviv" placeholderTextColor="#9CA3AF" value={address} onChangeText={setAddress} />
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Add notes…" placeholderTextColor="#9CA3AF" value={description} onChangeText={setDescription} multiline />

            <Text style={styles.fieldLabel}>Coordinates *</Text>
            <View style={styles.latlngRow}>
              <TextInput style={[styles.input, styles.halfInput]} placeholder="Latitude" placeholderTextColor="#9CA3AF" value={lat} onChangeText={setLat} keyboardType="decimal-pad" />
              <TextInput style={[styles.input, styles.halfInput]} placeholder="Longitude" placeholderTextColor="#9CA3AF" value={lng} onChangeText={setLng} keyboardType="decimal-pad" />
            </View>

            <Text style={styles.sectionLabel}>Type</Text>
            <View style={styles.typeRow}>
              {PLACE_TYPES.filter((t) => t.value !== null).map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, type === t.value && { borderColor: t.color, backgroundColor: t.color + "20" }]}
                  onPress={() => handleTypeChange(t.value)}
                >
                  <Text style={[styles.typeChipText, type === t.value && { color: t.color }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {aiSuggestion && (
              <View style={styles.aiSuggestChip}>
                <Text style={styles.aiSuggestText}>
                  AI suggests: {TYPE_BADGE[aiSuggestion.type] ? PLACE_TYPES.find((t) => t.value === aiSuggestion.type)?.label : aiSuggestion.type}
                  {aiSuggestion.name_suggestion ? ` · "${aiSuggestion.name_suggestion}"` : ""}
                </Text>
                <TouchableOpacity onPress={() => {
                  handleTypeChange(aiSuggestion.type);
                  if (aiSuggestion.name_suggestion && !name) setName(aiSuggestion.name_suggestion);
                  setAiSuggestion(null);
                }}>
                  <Text style={styles.aiSuggestApply}>Apply →</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAiSuggestion(null)}>
                  <Text style={styles.aiSuggestDismiss}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {type && (
              <View style={styles.extraSection}>
                <Text style={styles.sectionLabel}>{PLACE_TYPES.find((t2) => t2.value === type)?.label} details</Text>
                <ExtraFields />
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleAdd}
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
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  headerRefresh: { fontSize: 22, color: "#4f46e5", fontWeight: "600" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  toggle: { flexDirection: "row", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "#e2e8f0" },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff" },
  toggleActive: { backgroundColor: "#4f46e5" },
  toggleText: { fontSize: 13, color: "#64748b" },
  toggleTextActive: { color: "#fff", fontWeight: "600" },
  addBtn: { backgroundColor: "#4f46e5", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  filterBar: { backgroundColor: "#fff", paddingVertical: 8 },
  filterScroll: { paddingHorizontal: 12, flexDirection: "row", gap: 8 },
  filterChip: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: "#fff" },
  filterChipText: { fontSize: 12, color: "#64748b", fontWeight: "500" },
  filterChipTextActive: { color: "#fff" },
  mapContainer: { flex: 1, position: "relative" },
  mapHint: { position: "absolute", top: 8, left: 0, right: 0, textAlign: "center", fontSize: 11, color: "#6b7280", backgroundColor: "rgba(255,255,255,0.85)", paddingVertical: 4, zIndex: 5 },
  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    borderLeftWidth: 4, marginBottom: 10,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardName: { fontSize: 15, fontWeight: "600", color: "#0f172a", flex: 1 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  cardSub: { fontSize: 12, color: "#64748b", marginTop: 3 },
  cardDesc: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  cardMeta: { fontSize: 11, color: "#4f46e5", marginTop: 4, fontWeight: "500" },
  cardPhoto: { width: 64, height: 64, borderRadius: 8 },
  deleteBtn: { marginTop: 8, alignSelf: "flex-end" },
  deleteBtnText: { fontSize: 12, color: "#ef4444" },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { textAlign: "center", color: "#94a3b8", fontSize: 14 },
  callout: { width: 160, padding: 4 },
  calloutTitle: { fontWeight: "600", fontSize: 13 },
  calloutSub: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  modal: { flex: 1, paddingHorizontal: 24, paddingTop: 36, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  modalClose: { fontSize: 18, color: "#9ca3af", padding: 4 },
  coordsHint: { fontSize: 12, color: "#6b7280", marginBottom: 14, backgroundColor: "#f3f4f6", padding: 8, borderRadius: 8 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 14, backgroundColor: "#fafafa", color: "#111827" },
  textArea: { height: 70, textAlignVertical: "top" },
  latlngRow: { flexDirection: "row", gap: 8 },
  halfInput: { flex: 1 },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5, marginTop: 4 },
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
  saveBtn: { backgroundColor: "#4f46e5", borderRadius: 10, padding: 14, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },

  // Travel guide button
  guideBtn: { backgroundColor: "#0d9488", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  guideBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // Travel guide modal
  guideHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: 36, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  guideTitle: { fontSize: 20, fontWeight: "800", color: "#111827", flex: 1, marginRight: 12 },
  guideBody: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  guideText: { fontSize: 15, color: "#374151", lineHeight: 26 },

  // AI suggestion chip
  aiSuggestChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#f0fdf9", borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: "#2dd4bf", gap: 8 },
  aiSuggestText: { flex: 1, fontSize: 12, color: "#0d9488", fontWeight: "500" },
  aiSuggestApply: { fontSize: 12, color: "#0d9488", fontWeight: "700" },
  aiSuggestDismiss: { fontSize: 13, color: "#9ca3af" },
});

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
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { getNearbyPlaces, createPlace } from "../../src/api/places";
import { getCollections } from "../../src/api/collections";

const PLACE_TYPES = [
  { value: null, label: "All", color: "#6366f1" },
  { value: "food", label: "🍽 Food", color: "#f97316" },
  { value: "travel", label: "✈️ Travel", color: "#3b82f6" },
  { value: "shop", label: "🛍 Shop", color: "#a855f7" },
  { value: "hangout", label: "☕️ Hangout", color: "#22c55e" },
];

const TYPE_COLORS = {
  food: "#f97316",
  travel: "#3b82f6",
  shop: "#a855f7",
  hangout: "#22c55e",
};

export default function ExploreScreen() {
  const [location, setLocation] = useState(null);
  const [allPlaces, setAllPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState(null);

  const [pendingPin, setPendingPin] = useState(null);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [placeType, setPlaceType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const mapRef = useRef(null);

  useEffect(() => {
    (async () => {
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
        const data = await getNearbyPlaces(latitude, longitude, 5000);
        setAllPlaces(data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();

    getCollections().then((cols) => {
      setCollections(cols);
      if (cols.length > 0) setSelectedCollection(cols[0].id);
    }).catch(() => {});
  }, []);

  const visiblePlaces = activeType
    ? allPlaces.filter((p) => p.type === activeType)
    : allPlaces;

  function handleMapPress(e) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPendingPin({ latitude, longitude });
    setPlaceName("");
    setPlaceAddress("");
    setPlaceType(null);
    setShowAddModal(true);
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
      });
      setAllPlaces((prev) => [...prev, newPlace]);
      setShowAddModal(false);
      setPendingPin(null);
    } catch {
      Alert.alert("Error", "Failed to add place.");
    } finally {
      setSaving(false);
    }
  }

  function cancelAdd() {
    setShowAddModal(false);
    setPendingPin(null);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Getting location…</Text>
      </View>
    );
  }

  if (!location) {
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
              style={[
                styles.filterChip,
                activeType === t.value && { backgroundColor: t.color, borderColor: t.color },
              ]}
              onPress={() => setActiveType(t.value)}
            >
              <Text style={[styles.filterChipText, activeType === t.value && styles.filterChipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        onPress={handleMapPress}
      >
        {pendingPin && (
          <Marker coordinate={pendingPin} pinColor="#10b981" />
        )}
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
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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

          <TextInput style={styles.input} placeholder="Place name *" value={placeName} onChangeText={setPlaceName} />
          <TextInput style={styles.input} placeholder="Address (optional)" value={placeAddress} onChangeText={setPlaceAddress} />

          <Text style={styles.sectionLabel}>Collection *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
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
                onPress={() => setPlaceType(placeType === t.value ? null : t.value)}
              >
                <Text style={[styles.typeChipText, placeType === t.value && { color: t.color }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleAddPlace}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Add place"}</Text>
          </TouchableOpacity>
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  filterScroll: { paddingHorizontal: 12, flexDirection: "row", gap: 8 },
  filterChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  filterChipText: { fontSize: 12, color: "#6b7280", fontWeight: "500" },
  filterChipTextActive: { color: "#fff" },
  callout: { width: 170, padding: 4 },
  calloutTitle: { fontWeight: "600", fontSize: 13 },
  calloutSub: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  calloutColl: { fontSize: 10, color: "#6366f1", marginTop: 2 },
  modal: { flex: 1, padding: 24, paddingTop: 36, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  modalClose: { fontSize: 18, color: "#9ca3af", padding: 4 },
  coordsHint: { fontSize: 12, color: "#6b7280", marginBottom: 14, backgroundColor: "#f3f4f6", padding: 8, borderRadius: 8 },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10,
    padding: 12, marginBottom: 12, fontSize: 14, backgroundColor: "#fafafa",
  },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  chipScroll: { marginBottom: 14 },
  collChip: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 99,
    paddingHorizontal: 14, paddingVertical: 6, marginRight: 8, backgroundColor: "#fff",
  },
  collChipActive: { borderColor: "#4f46e5", backgroundColor: "#eef2ff" },
  collChipText: { fontSize: 13, color: "#374151" },
  collChipTextActive: { color: "#4f46e5", fontWeight: "600" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  typeChip: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff",
  },
  typeChipText: { fontSize: 12, color: "#374151" },
  saveBtn: { backgroundColor: "#4f46e5", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});

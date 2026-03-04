import { useEffect, useState, useRef } from "react";
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
  Dimensions,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { useLocalSearchParams, router } from "expo-router";
import { getPlaces, createPlace, deletePlace } from "../../src/api/places";

const PLACE_TYPES = ["food", "travel", "shop", "hangout"];
const TYPE_LABELS = { food: "🍽 Food", travel: "✈️ Travel", shop: "🛍 Shop", hangout: "☕️ Hangout" };

export default function CollectionDetail() {
  const { id } = useLocalSearchParams();
  const collectionId = Number(id);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [type, setType] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPlaces(collectionId)
      .then(setPlaces)
      .catch(() => Alert.alert("Error", "Failed to load places."))
      .finally(() => setLoading(false));
  }, [collectionId]);

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
        name,
        address: address || null,
        description: description || null,
        lat: latNum,
        lng: lngNum,
        type: type || null,
      });
      setPlaces((prev) => [p, ...prev]);
      setModalVisible(false);
      setName(""); setAddress(""); setDescription(""); setLat(""); setLng(""); setType(null);
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
        text: "Delete",
        style: "destructive",
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
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : { latitude: 0, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#4f46e5" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      {/* Toggle */}
      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, view === "list" && styles.toggleActive]}
          onPress={() => setView("list")}
        >
          <Text style={[styles.toggleText, view === "list" && styles.toggleTextActive]}>List</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, view === "map" && styles.toggleActive]}
          onPress={() => setView("map")}
        >
          <Text style={[styles.toggleText, view === "map" && styles.toggleTextActive]}>Map</Text>
        </TouchableOpacity>
      </View>

      {view === "map" ? (
        <MapView style={{ flex: 1 }} region={mapRegion}>
          {places.map((place) => (
            <Marker
              key={place.id}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              pinColor="#4f46e5"
            >
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{place.name}</Text>
                  {place.address ? <Text style={styles.calloutSub}>{place.address}</Text> : null}
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No places yet. Add one!</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardName}>{item.name}</Text>
                {item.type && <Text style={styles.badge}>{TYPE_LABELS[item.type] ?? item.type}</Text>}
              </View>
              {item.address ? <Text style={styles.cardSub}>{item.address}</Text> : null}
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add place modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Add place</Text>
          <TextInput style={styles.input} placeholder="Name *" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Address" value={address} onChangeText={setAddress} />
          <TextInput
            style={[styles.input, { height: 70 }]}
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <View style={styles.latlngRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 6 }]}
              placeholder="Latitude *"
              value={lat}
              onChangeText={setLat}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Longitude *"
              value={lng}
              onChangeText={setLng}
              keyboardType="decimal-pad"
            />
          </View>

          <Text style={styles.typeLabel}>Type</Text>
          <View style={styles.typeRow}>
            {PLACE_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, type === t && styles.typeChipActive]}
                onPress={() => setType(type === t ? null : t)}
              >
                <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
                  {TYPE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleAdd}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Add place"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  toggle: {
    flexDirection: "row",
    margin: 12,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignSelf: "center",
  },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: "#fff" },
  toggleActive: { backgroundColor: "#4f46e5" },
  toggleText: { fontSize: 13, color: "#374151" },
  toggleTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
  deleteBtn: { marginTop: 8, alignSelf: "flex-end" },
  deleteBtnText: { fontSize: 12, color: "#ef4444" },
  emptyText: { textAlign: "center", color: "#9ca3af", marginTop: 40 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4f46e5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 32 },
  callout: { width: 160, padding: 4 },
  calloutTitle: { fontWeight: "600", fontSize: 13 },
  calloutSub: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  modal: { flex: 1, padding: 24, paddingTop: 48, backgroundColor: "#fff" },
  modalTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 20, color: "#111827" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 14,
  },
  latlngRow: { flexDirection: "row" },
  typeLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  typeChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  typeChipActive: { borderColor: "#4f46e5", backgroundColor: "#eef2ff" },
  typeChipText: { fontSize: 12, color: "#374151" },
  typeChipTextActive: { color: "#4f46e5" },
  saveBtn: { backgroundColor: "#4f46e5", borderRadius: 8, padding: 14, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cancelText: { marginTop: 14, textAlign: "center", color: "#6b7280", fontSize: 13 },
});

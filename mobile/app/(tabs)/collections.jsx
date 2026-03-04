import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { getCollections, createCollection, deleteCollection } from "../../src/api/collections";

function CollectionItem({ item, onDelete }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/collection/${item.id}`)}
    >
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.privacy}>{item.is_public ? "Public" : "Private"}</Text>
      </View>
      {item.description ? <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text> : null}
      <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
        <Text style={styles.deleteBtnText}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function CollectionsScreen() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCollections()
      .then(setCollections)
      .catch(() => Alert.alert("Error", "Failed to load collections."))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const c = await createCollection({ title, description: description || null, is_public: isPublic });
      setCollections((prev) => [c, ...prev]);
      setModalVisible(false);
      setTitle("");
      setDescription("");
      setIsPublic(false);
    } catch {
      Alert.alert("Error", "Failed to create collection.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    Alert.alert("Delete collection", "This will remove the collection and all its places.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCollection(id);
            setCollections((prev) => prev.filter((c) => c.id !== id));
          } catch {
            Alert.alert("Error", "Failed to delete.");
          }
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#4f46e5" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <FlatList
        data={collections}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => <CollectionItem item={item} onDelete={handleDelete} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No collections yet. Create one!</Text>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>New collection</Text>
          <TextInput
            style={styles.input}
            placeholder="Title"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="Description (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Public</Text>
            <Switch value={isPublic} onValueChange={setIsPublic} />
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Create"}</Text>
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
  list: { padding: 16, gap: 10 },
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
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  privacy: { fontSize: 11, color: "#6b7280" },
  cardDesc: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  deleteBtn: { marginTop: 8, alignSelf: "flex-end" },
  deleteBtnText: { fontSize: 12, color: "#ef4444" },
  emptyText: { textAlign: "center", color: "#9ca3af", marginTop: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  modal: { flex: 1, padding: 24, paddingTop: 48, backgroundColor: "#fff" },
  modalTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 24, color: "#111827" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  switchLabel: { fontSize: 14, color: "#374151" },
  saveBtn: { backgroundColor: "#4f46e5", borderRadius: 8, padding: 14, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cancelText: { marginTop: 16, textAlign: "center", color: "#6b7280", fontSize: 13 },
});

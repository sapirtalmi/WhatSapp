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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { getCollections, createCollection, deleteCollection } from "../../src/api/collections";

const ACCENT_COLORS = ["#6366f1", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];

function accentFor(id) {
  return ACCENT_COLORS[id % ACCENT_COLORS.length];
}

function CollectionCard({ item, onDelete }) {
  const accent = accentFor(item.id);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/collection/${item.id}`)}
      activeOpacity={0.75}
    >
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.privacyBadge, item.is_public ? styles.publicBadge : styles.privateBadge]}>
            <Text style={[styles.privacyText, item.is_public ? styles.publicText : styles.privateText]}>
              {item.is_public ? "Public" : "Private"}
            </Text>
          </View>
        </View>

        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          {item.place_count != null ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>📍 {item.place_count} place{item.place_count !== 1 ? "s" : ""}</Text>
            </View>
          ) : null}
          <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.deleteBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CollectionsScreen() {
  const navigation = useNavigation();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  function loadCollections() {
    getCollections()
      .then(setCollections)
      .catch(() => Alert.alert("Error", "Failed to load collections."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadCollections(); }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={loadCollections} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
          <Text style={{ fontSize: 22, color: "#4f46e5", fontWeight: "600", marginRight: 4 }}>↻</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const filtered = search.trim()
    ? collections.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase())
      )
    : collections;

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const c = await createCollection({ title: title.trim(), description: description.trim() || null, is_public: isPublic });
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
    return <View style={styles.center}><ActivityIndicator size="large" color="#4f46e5" /></View>;
  }

  return (
    <View style={styles.screen}>
      {/* Search bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search collections…"
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => <CollectionCard item={item} onDelete={handleDelete} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>{search ? "No matches" : "No collections yet"}</Text>
            <Text style={styles.emptyHint}>
              {search ? `No collections match "${search}"` : "Tap + to create your first collection"}
            </Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New collection</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Collection name *"
            placeholderTextColor="#94a3b8"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Description (optional)"
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Make public</Text>
              <Text style={styles.switchHint}>Friends can see and save this collection</Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ true: "#4f46e5" }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!title.trim() || saving) && styles.saveBtnDisabled]}
            onPress={handleCreate}
            disabled={!title.trim() || saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Creating…" : "Create collection"}</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  searchWrapper: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 2,
    gap: 8,
  },
  searchIcon: { fontSize: 14, color: "#94a3b8" },
  searchInput: { flex: 1, fontSize: 14, color: "#0f172a", paddingVertical: 10 },
  clearBtn: { fontSize: 14, color: "#94a3b8", padding: 4 },

  list: { padding: 16, gap: 12, paddingBottom: 100 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    flexDirection: "row",
  },
  cardAccent: { width: 5 },
  cardBody: { flex: 1, padding: 14, gap: 6 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", flex: 1 },
  privacyBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  publicBadge: { backgroundColor: "#dcfce7" },
  privateBadge: { backgroundColor: "#f1f5f9" },
  privacyText: { fontSize: 10, fontWeight: "600" },
  publicText: { color: "#16a34a" },
  privateText: { color: "#64748b" },
  cardDesc: { fontSize: 12, color: "#94a3b8", lineHeight: 17 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  countBadge: { backgroundColor: "#f1f5f9", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  countText: { fontSize: 11, color: "#64748b", fontWeight: "500" },
  deleteBtnText: { fontSize: 12, color: "#ef4444", fontWeight: "500" },

  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#64748b", marginBottom: 6 },
  emptyHint: { fontSize: 13, color: "#94a3b8", textAlign: "center" },

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
    shadowColor: "#4f46e5",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 32, marginTop: -2 },

  modal: { flex: 1, padding: 24, paddingTop: 36, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: "bold", color: "#0f172a" },
  modalClose: { fontSize: 18, color: "#94a3b8", padding: 4 },

  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#fafafa",
  },
  inputMultiline: { height: 80 },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    marginBottom: 20,
  },
  switchLabel: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  switchHint: { fontSize: 12, color: "#94a3b8", marginTop: 2 },

  saveBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

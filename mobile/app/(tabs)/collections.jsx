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
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { getCollections, createCollection, deleteCollection } from "../../src/api/collections";
import { generateCollectionDescription } from "../../src/api/ai";

const COVER_GRADIENTS = [
  ["#a5b4fc", "#c4b5fd"],
  ["#fda4af", "#fdba74"],
  ["#6ee7b7", "#67e8f9"],
  ["#c4b5fd", "#f0abfc"],
  ["#fcd34d", "#fdba74"],
  ["#6ee7b7", "#a5f3fc"],
];

function coverFor(id) {
  return COVER_GRADIENTS[id % COVER_GRADIENTS.length];
}

function CollectionCard({ item, onDelete }) {
  const colors = coverFor(item.id);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/collection/${item.id}`)}
      activeOpacity={0.78}
    >
      {/* Gradient cover */}
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardCover}
      >
        <View style={[styles.privacyBadge, { backgroundColor: "rgba(0,0,0,0.2)", borderColor: "rgba(255,255,255,0.25)" }]}>
          <Text style={[styles.privacyText, { color: "#fff" }]}>
            {item.is_public ? "Public" : "Private"}
          </Text>
        </View>
        {item.place_count != null && (
          <View style={styles.coverCountBadge}>
            <Text style={styles.coverCountText}>📍 {item.place_count}</Text>
          </View>
        )}
      </LinearGradient>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <TouchableOpacity
          onPress={() => onDelete(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ alignSelf: "flex-start", marginTop: 6 }}
        >
          <Text style={styles.deleteBtnText}>Remove</Text>
        </TouchableOpacity>
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
  const [generatingDesc, setGeneratingDesc] = useState(false);

  async function handleGenerateDesc() {
    if (!title.trim()) {
      Alert.alert("Name required", "Enter a collection name first.");
      return;
    }
    setGeneratingDesc(true);
    try {
      const res = await generateCollectionDescription(null, title.trim());
      setDescription(res.description);
    } catch {
      Alert.alert("AI", "Could not generate description. Try again.");
    } finally {
      setGeneratingDesc(false);
    }
  }

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
      {/* Dreamy banner */}
      <LinearGradient
        colors={["#ffecd2", "#fcb69f", "#ff9a9e", "#a18cd1"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.bannerOrb1} />
        <View style={styles.bannerOrb2} />
        <Text style={styles.bannerTitle}>My Collections</Text>
        <Text style={styles.bannerSub}>Your saved places, organised</Text>
      </LinearGradient>

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

      <TouchableOpacity style={styles.fabWrap} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
        <LinearGradient
          colors={["#34d399", "#2dd4bf"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
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
          <TouchableOpacity
            style={[styles.genDescBtn, (!title.trim() || generatingDesc) && { opacity: 0.5 }]}
            onPress={handleGenerateDesc}
            disabled={!title.trim() || generatingDesc}
          >
            {generatingDesc
              ? <ActivityIndicator size="small" color="#0d9488" />
              : <Text style={styles.genDescBtnText}>✨ Generate description</Text>}
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Make public</Text>
              <Text style={styles.switchHint}>Friends can see and save this collection</Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ true: "#2dd4bf" }}
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
  screen: { flex: 1, backgroundColor: "#f5f3ff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  banner: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  bannerOrb1: {
    position: "absolute", width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.18)",
    top: -50, right: -40,
  },
  bannerOrb2: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.14)",
    bottom: -20, left: 20,
  },
  bannerTitle: {
    fontSize: 28, fontWeight: "900", color: "#fff", letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.08)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  bannerSub: {
    fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: "500", marginTop: 2,
  },

  searchWrapper: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ede9fe",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f3ff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 2,
    gap: 8,
  },
  searchIcon: { fontSize: 14, color: "#94a3b8" },
  searchInput: { flex: 1, fontSize: 14, color: "#0f172a", paddingVertical: 10 },
  clearBtn: { fontSize: 14, color: "#94a3b8", padding: 4 },

  list: { padding: 20, gap: 14, paddingBottom: 100 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardCover: {
    height: 90,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 12,
  },
  cardBody: { padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  privacyBadge: {
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  privacyText: { fontSize: 10, fontWeight: "600" },
  coverCountBadge: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignSelf: "flex-end",
  },
  coverCountText: { fontSize: 10, fontWeight: "600", color: "#fff" },
  cardDesc: { fontSize: 12, color: "#94a3b8", lineHeight: 17, marginTop: 4 },
  deleteBtnText: { fontSize: 12, color: "#ef4444", fontWeight: "500" },

  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#64748b", marginBottom: 6 },
  emptyHint: { fontSize: 13, color: "#94a3b8", textAlign: "center" },

  fabWrap: {
    position: "absolute",
    bottom: 100,
    right: 24,
    shadowColor: "#2dd4bf",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    borderRadius: 28,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
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
    backgroundColor: "#0d9488",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  genDescBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#2dd4bf", borderStyle: "dashed",
    borderRadius: 10, paddingVertical: 9, marginBottom: 16,
  },
  genDescBtnText: { fontSize: 13, color: "#0d9488", fontWeight: "600" },
});

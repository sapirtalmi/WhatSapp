import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActionSheetIOS,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../src/context/AuthContext";
import { getMe, updateMe } from "../../src/api/users";
import { getCollections } from "../../src/api/collections";
import api from "../../src/api/axios";
import { getMyStatus, updateStatus } from "../../src/api/status";
import { getMyBroadcasts } from "../../src/api/broadcasts";
import { getChats } from "../../src/api/chats";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
import { getFriends } from "../../src/api/friends";
import { getGlobalPlaces } from "../../src/api/places";

const ACTIVITY_ICONS = {
  coffee: "cafe-outline", drinks: "wine-outline", study: "book-outline",
  hike: "walk-outline", food: "restaurant-outline", event: "star-outline",
  hangout: "people-outline", work: "briefcase-outline",
  other: "ellipsis-horizontal-circle-outline",
};

const PLACE_TYPES = [
  { value: "food", label: "🍽 Food", color: "#f97316" },
  { value: "travel", label: "✈️ Travel", color: "#3b82f6" },
  { value: "exercise", label: "🏋 Exercise", color: "#ef4444" },
  { value: "shop", label: "🛍 Shop", color: "#a855f7" },
  { value: "hangout", label: "☕ Hangout", color: "#22c55e" },
];

const AVATAR_COLORS = ["#6366f1", "#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
function avatarColor(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

const BROADCAST_TYPE_EMOJIS = {
  trip: "🗺️", food: "🍽️", drinks: "🍻", hangout: "🛋️", sport: "⚽", other: "📍",
};

// ── Chip pill ──────────────────────────────────────────────────────────────────
function Chip({ label, color, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: color ?? "#6366f1", borderColor: color ?? "#6366f1" },
      ]}
    >
      <Text style={[styles.chipText, active && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Info row in the About card ─────────────────────────────────────────────────
function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Card wrapper ───────────────────────────────────────────────────────────────
function Card({ title, children, style }) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user: authUser, logout } = useAuth();

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ collections: null, places: null, friends: null });
  const [myStatus, setMyStatus] = useState(null);
  const [myBroadcasts, setMyBroadcasts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [hobbyInput, setHobbyInput] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const p = await getMe();
      setProfile(p);
      setEditData({
        bio: p.bio ?? "",
        age: p.age != null ? String(p.age) : "",
        study: p.study ?? "",
        work: p.work ?? "",
        living: p.living ?? "",
        hobbies: p.hobbies ?? [],
        preferred_types: p.preferred_types ?? [],
      });
    } catch {}
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [cols, friends] = await Promise.all([getCollections(), getFriends()]);
      let places = 0;
      try {
        const ps = await getGlobalPlaces({ source: "mine", limit: 200 });
        places = ps.length;
      } catch {}
      setStats({ collections: cols.length, places, friends: friends.length });
    } catch {}
  }, []);

  useEffect(() => {
    loadProfile();
    loadStats();
    getMyStatus().then(s => setMyStatus(s)).catch(() => {});
    getMyBroadcasts()
      .then(bs => setMyBroadcasts((bs || []).filter(b => b.is_active !== false)))
      .catch(() => {});
    getChats()
      .then(cs => {
        const total = (cs || []).reduce((sum, c) => sum + (c.unread_count ?? 0), 0);
        setUnreadCount(total);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setEditing(true)}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          style={{ marginRight: 4 }}
        >
          <Text style={{ fontSize: 20 }}>✏️</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        bio: editData.bio || null,
        age: editData.age ? parseInt(editData.age) : null,
        study: editData.study || null,
        work: editData.work || null,
        living: editData.living || null,
        hobbies: editData.hobbies.length ? editData.hobbies : null,
        preferred_types: editData.preferred_types.length ? editData.preferred_types : null,
      };
      const updated = await updateMe(payload);
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.detail ?? "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  function togglePreferredType(val) {
    const curr = editData.preferred_types ?? [];
    setEditData((prev) => ({
      ...prev,
      preferred_types: curr.includes(val) ? curr.filter((v) => v !== val) : [...curr, val],
    }));
  }

  function addHobby() {
    const t = hobbyInput.trim();
    if (!t) return;
    setEditData((prev) => ({ ...prev, hobbies: [...(prev.hobbies ?? []), t] }));
    setHobbyInput("");
  }

  function removeHobby(i) {
    setEditData((prev) => ({ ...prev, hobbies: prev.hobbies.filter((_, j) => j !== i) }));
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  async function pickAvatar(useCamera) {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const fd = new FormData();
    fd.append("file", { uri: asset.uri, name: "photo.jpg", type: "image/jpeg" });
    try {
      const res = await api.post("/uploads/photo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const updated = await updateMe({ avatar_url: res.data.url });
      setProfile(updated);
    } catch (err) {
      console.error("pickAvatar error", err?.response?.status, JSON.stringify(err?.response?.data), err?.message);
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join("\n")
        : detail ? String(detail) : (err?.message ?? "Upload failed.");
      Alert.alert("Upload failed", msg);
    }
  }

  function handleAvatarPress() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Take Photo", "Choose from Library"], cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) pickAvatar(true); else if (idx === 2) pickAvatar(false); }
      );
    } else {
      Alert.alert("Update Photo", "", [
        { text: "Take Photo", onPress: () => pickAvatar(true) },
        { text: "Choose from Library", onPress: () => pickAvatar(false) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  const p = profile ?? authUser;
  const color = avatarColor(p?.username);
  const letter = (p?.username?.[0] ?? "?").toUpperCase();
  const displayedTypes = profile?.preferred_types ?? [];
  const displayedHobbies = profile?.hobbies ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f3ff" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero gradient header ─────────────────────────────────────── */}
        <LinearGradient
          colors={["#ffecd2", "#fcb69f", "#ff9a9e", "#a18cd1", "#c084fc"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 16 }]}
        >
          {/* Decorative light orbs */}
          <View style={styles.orb1} />
          <View style={styles.orb2} />
          <View style={styles.orb3} />

          {/* Avatar */}
          <TouchableOpacity style={styles.avatarRing} onPress={handleAvatarPress} activeOpacity={0.85}>
            {profile?.avatar_url ? (
              <Image
                source={{ uri: API_URL + profile.avatar_url }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: color }]}>
                <Text style={styles.avatarLetter}>{letter}</Text>
              </View>
            )}
            <View style={styles.cameraOverlay}>
              <Text style={{ fontSize: 13 }}>📷</Text>
            </View>
          </TouchableOpacity>

          {/* Name */}
          <Text style={styles.heroName}>{p?.username}</Text>

          {/* Living + bio */}
          {(profile?.living || profile?.bio) ? (
            <View style={styles.heroSubRow}>
              {profile?.living ? <Text style={styles.heroSub}>📍 {profile.living}</Text> : null}
              {profile?.living && profile?.bio ? <Text style={styles.heroDot}> · </Text> : null}
              {profile?.bio ? <Text style={styles.heroSub} numberOfLines={2}>{profile.bio}</Text> : null}
            </View>
          ) : null}
        </LinearGradient>

        {/* ── Stats row ───────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statIcon, { backgroundColor: "#eef2ff" }]}>📚</Text>
            <Text style={styles.statValue}>{stats.collections ?? "—"}</Text>
            <Text style={styles.statLabel}>Collections</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statIcon, { backgroundColor: "#f5f3ff" }]}>📍</Text>
            <Text style={styles.statValue}>{stats.places ?? "—"}</Text>
            <Text style={styles.statLabel}>Places</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statIcon, { backgroundColor: "#fdf4ff" }]}>👥</Text>
            <Text style={styles.statValue}>{stats.friends ?? "—"}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
        </View>

        {/* ── Active status banner ─────────────────────────────────────── */}
        {myStatus && (() => {
          const isLive = myStatus.mode === "live";
          const accent = isLive ? "#F4743B" : "#7C5CBF";
          const bg = isLive ? "#FFF8F5" : "#F5F3FF";
          return (
            <View style={{
              marginHorizontal: 16, marginTop: 12,
              backgroundColor: bg, borderRadius: 18,
              padding: 14,
              borderWidth: 1, borderColor: accent + "25",
              borderLeftWidth: 3, borderLeftColor: accent,
              shadowColor: accent, shadowOpacity: 0.08,
              shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: accent + "18",
                  alignItems: "center", justifyContent: "center",
                  marginRight: 12,
                }}>
                  <Ionicons
                    name={ACTIVITY_ICONS[myStatus.activity_type] ?? "ellipsis-horizontal-circle-outline"}
                    size={19} color={accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: accent, textTransform: "uppercase", letterSpacing: 0.7 }}>
                      {isLive ? "Active Now" : "Upcoming Plan"}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, color: "#374151", fontWeight: "500" }} numberOfLines={1}>
                    {myStatus.message || myStatus.activity_type}
                  </Text>
                  {myStatus.location_name ? (
                    <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }} numberOfLines={1}>
                      📍 {myStatus.location_name}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={async () => { await updateStatus(myStatus.id, { is_active: false }); setMyStatus(null); }}
                  style={{
                    marginLeft: 10, paddingHorizontal: 12, paddingVertical: 6,
                    borderRadius: 99, borderWidth: 1, borderColor: accent + "50",
                  }}
                >
                  <Text style={{ color: accent, fontWeight: "600", fontSize: 12 }}>End</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* ── Chats button ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={{
            marginHorizontal: 16, marginTop: 12,
            backgroundColor: "#fff", borderRadius: 16, padding: 14,
            flexDirection: "row", alignItems: "center", gap: 12,
            shadowColor: "#F5A623", shadowOpacity: 0.1, shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 }, elevation: 3,
            borderWidth: 1, borderColor: "#EDE9E330",
          }}
          onPress={() => router.push("/chats")}
          activeOpacity={0.75}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: "#FFF8EC",
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: 20 }}>💬</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1C1C1E" }}>Chats</Text>
            <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>
              Messages from broadcasts
            </Text>
          </View>
          {unreadCount > 0 && (
            <View style={{
              backgroundColor: "#F5A623", borderRadius: 99,
              minWidth: 22, height: 22, alignItems: "center", justifyContent: "center",
              paddingHorizontal: 6,
            }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 20, color: "#EDE9E3" }}>›</Text>
        </TouchableOpacity>

        {/* ── My Broadcasts section ─────────────────────────────────── */}
        {myBroadcasts.length > 0 && (
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            {/* Section header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{
                fontSize: 11, fontWeight: "700", color: "#A09A93",
                textTransform: "uppercase", letterSpacing: 1.2,
              }}>
                📡 My Broadcasts
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/broadcast-requests")}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  backgroundColor: "#FFF8EC", borderRadius: 99,
                  paddingHorizontal: 10, paddingVertical: 5,
                  borderWidth: 1, borderColor: "#F5A62330",
                }}
              >
                <Ionicons name="people-outline" size={13} color="#F5A623" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#F5A623" }}>View Requests</Text>
              </TouchableOpacity>
            </View>

            {/* Horizontal cards */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: 4 }}
            >
              {myBroadcasts.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={{
                    backgroundColor: "#fff", borderRadius: 16,
                    padding: 14, width: 160,
                    shadowColor: "#F5A623", shadowOpacity: 0.1, shadowRadius: 10,
                    shadowOffset: { width: 0, height: 3 }, elevation: 3,
                    borderWidth: 1, borderColor: "#F5A62315",
                  }}
                  activeOpacity={0.8}
                  onPress={() => router.push("/broadcast-requests")}
                >
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>
                    {BROADCAST_TYPE_EMOJIS[b.type] ?? "📡"}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#1C1C1E" }} numberOfLines={2}>
                    {b.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                    {b.participant_count ?? 0} joined
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── About card ──────────────────────────────────────────────── */}
        {(profile?.age || profile?.study || profile?.work || profile?.living) ? (
          <Card title="About" style={{ marginTop: 16, marginHorizontal: 16 }}>
            <InfoRow icon="🎂" label="Age" value={profile?.age ? `${profile.age} years old` : null} />
            <InfoRow icon="🎓" label="Study" value={profile?.study} />
            <InfoRow icon="💼" label="Work" value={profile?.work} />
            <InfoRow icon="📍" label="Lives in" value={profile?.living} />
          </Card>
        ) : null}

        {/* ── Hobbies card ────────────────────────────────────────────── */}
        {displayedHobbies.length > 0 ? (
          <Card title="Hobbies" style={{ marginTop: 12, marginHorizontal: 16 }}>
            <View style={styles.chipWrap}>
              {displayedHobbies.map((h) => (
                <View key={h} style={styles.hobbyPill}>
                  <Text style={styles.hobbyText}>{h}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* ── Preferred types card ─────────────────────────────────────── */}
        {displayedTypes.length > 0 ? (
          <Card title="I love to discover" style={{ marginTop: 12, marginHorizontal: 16 }}>
            <View style={styles.chipWrap}>
              {PLACE_TYPES.filter((t) => displayedTypes.includes(t.value)).map((t) => (
                <View key={t.value} style={[styles.typePill, { backgroundColor: t.color + "20", borderColor: t.color }]}>
                  <Text style={[styles.typePillText, { color: t.color }]}>{t.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* ── My content ──────────────────────────────────────────────── */}
        <Card title="My content" style={{ marginTop: 12, marginHorizontal: 16 }}>
          <TouchableOpacity style={styles.menuRow} onPress={() => router.push("/(tabs)/collections")}>
            <Text style={styles.menuIcon}>📚</Text>
            <Text style={styles.menuLabel}>My collections</Text>
            <Text style={styles.menuChev}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuRow, { borderTopWidth: 1, borderTopColor: "#f1f5f9" }]} onPress={() => router.push("/(tabs)/friends")}>
            <Text style={styles.menuIcon}>👥</Text>
            <Text style={styles.menuLabel}>Friends</Text>
            <Text style={styles.menuChev}>›</Text>
          </TouchableOpacity>
        </Card>

        {/* ── Sign out ────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>WhatSapp · v1.0</Text>
      </ScrollView>

      {/* ── Edit profile modal ──────────────────────────────────────────── */}
      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Sheet header */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={() => setEditing(false)}>
              <Text style={styles.sheetCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[styles.sheetSave, saving && { opacity: 0.5 }]}>
                {saving ? "Saving…" : "Save"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={[styles.fieldInput, { height: 72, textAlignVertical: "top" }]}
              value={editData.bio}
              onChangeText={(v) => setEditData((p) => ({ ...p, bio: v }))}
              placeholder="Tell the world about yourself…"
              multiline
            />

            <Text style={styles.fieldLabel}>Age</Text>
            <TextInput
              style={styles.fieldInput}
              value={editData.age}
              onChangeText={(v) => setEditData((p) => ({ ...p, age: v }))}
              placeholder="e.g. 25"
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Study</Text>
            <TextInput
              style={styles.fieldInput}
              value={editData.study}
              onChangeText={(v) => setEditData((p) => ({ ...p, study: v }))}
              placeholder="e.g. Computer Science, Tel Aviv University"
            />

            <Text style={styles.fieldLabel}>Work</Text>
            <TextInput
              style={styles.fieldInput}
              value={editData.work}
              onChangeText={(v) => setEditData((p) => ({ ...p, work: v }))}
              placeholder="e.g. Software Engineer at Google"
            />

            <Text style={styles.fieldLabel}>Lives in</Text>
            <TextInput
              style={styles.fieldInput}
              value={editData.living}
              onChangeText={(v) => setEditData((p) => ({ ...p, living: v }))}
              placeholder="e.g. Tel Aviv, Israel"
            />

            {/* Hobbies */}
            <Text style={styles.fieldLabel}>Hobbies</Text>
            <View style={styles.chipWrap}>
              {(editData.hobbies ?? []).map((h, i) => (
                <TouchableOpacity key={i} style={styles.hobbyPill} onPress={() => removeHobby(i)}>
                  <Text style={styles.hobbyText}>{h} ×</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <TextInput
                style={[styles.fieldInput, { flex: 1, marginBottom: 0 }]}
                value={hobbyInput}
                onChangeText={setHobbyInput}
                placeholder="Add a hobby…"
                returnKeyType="done"
                onSubmitEditing={addHobby}
              />
              <TouchableOpacity style={styles.addBtn} onPress={addHobby}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Preferred types */}
            <Text style={[styles.fieldLabel, { marginTop: 18 }]}>I love to discover</Text>
            <View style={styles.chipWrap}>
              {PLACE_TYPES.map((t) => {
                const active = (editData.preferred_types ?? []).includes(t.value);
                return (
                  <Chip
                    key={t.value}
                    label={t.label}
                    color={t.color}
                    active={active}
                    onPress={() => togglePreferredType(t.value)}
                  />
                );
              })}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Hero
  hero: {
    alignItems: "center",
    paddingBottom: 32,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  orb1: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.18)",
    top: -60, right: -60,
  },
  orb2: {
    position: "absolute", width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.12)",
    bottom: 10, left: -50,
  },
  orb3: {
    position: "absolute", width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.2)",
    top: 40, left: "40%",
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "rgba(255,255,255,0.35)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: { fontSize: 40, color: "#fff", fontWeight: "800" },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  cameraOverlay: {
    position: "absolute", bottom: 2, right: 2,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 14,
    width: 28, height: 28, justifyContent: "center", alignItems: "center",
  },
  heroName: { fontSize: 30, fontWeight: "900", color: "#fff", marginBottom: 8, letterSpacing: -0.5 },
  heroSubRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 2 },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.85)", textAlign: "center" },
  heroDot: { fontSize: 13, color: "rgba(255,255,255,0.6)" },

  // Stats
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 20,
    paddingVertical: 16,
    shadowColor: "#a78bfa",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  statBox: { flex: 1, alignItems: "center", gap: 2 },
  statIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4, fontSize: 15,
  },
  statValue: { fontSize: 28, fontWeight: "900", color: "#0f172a" },
  statLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  statDivider: { width: 1, backgroundColor: "#f1f5f9", marginVertical: 4 },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#2dd4bf",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    borderLeftWidth: 3,
    borderLeftColor: "#c4b5fd",
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Info rows
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  infoIcon: { fontSize: 18, width: 24, textAlign: "center", marginTop: 1 },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 14, color: "#1e293b", fontWeight: "500", marginTop: 1 },

  // Chips / pills
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  chipText: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  hobbyPill: {
    backgroundColor: "#f1f5f9",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  hobbyText: { fontSize: 12, color: "#475569", fontWeight: "500" },
  typePill: {
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  typePillText: { fontSize: 12, fontWeight: "600" },

  // Menu rows
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    gap: 12,
  },
  menuIcon: { fontSize: 18, width: 24, textAlign: "center" },
  menuLabel: { flex: 1, fontSize: 15, color: "#0f172a", fontWeight: "500" },
  menuChev: { fontSize: 20, color: "#cbd5e1" },

  // Sign out
  signOutBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.04)",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  signOutText: { fontSize: 15, fontWeight: "600", color: "#ef4444" },

  version: { textAlign: "center", fontSize: 11, color: "#cbd5e1", marginTop: 16 },

  // Edit sheet
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fff",
  },
  sheetCancel: { fontSize: 16, color: "#64748b" },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  sheetSave: { fontSize: 16, fontWeight: "700", color: "#0d9488" },
  sheetBody: { flex: 1, backgroundColor: "#f8fafc", paddingHorizontal: 16, paddingTop: 16 },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, marginTop: 14 },
  fieldInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#0f172a",
    marginBottom: 2,
  },
  addBtn: {
    width: 46,
    height: 46,
    backgroundColor: "#0d9488",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});

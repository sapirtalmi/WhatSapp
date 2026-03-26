import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { createBroadcast } from "../src/api/broadcasts";

const BROADCAST_TYPES = [
  { value: "trip",    emoji: "🗺️", label: "Trip" },
  { value: "food",    emoji: "🍽️", label: "Food" },
  { value: "drinks",  emoji: "🍻", label: "Drinks" },
  { value: "hangout", emoji: "🛋️", label: "Hangout" },
  { value: "sport",   emoji: "⚽", label: "Sport" },
  { value: "other",   emoji: "📍", label: "Other" },
];

const VISIBILITY_OPTIONS = [
  { value: "friends",        label: "Friends",            icon: "people-outline" },
  { value: "friends_of_friends", label: "Friends of friends", icon: "people-circle-outline" },
  { value: "public",         label: "Public",             icon: "earth-outline" },
];

const EXPIRY_OPTIONS = [
  { value: "tonight",  label: "Tonight" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "3days",    label: "3 days" },
  { value: "1week",    label: "1 week" },
];

function expiryToISO(value) {
  const now = new Date();
  if (value === "tonight") {
    const d = new Date(now);
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
  }
  if (value === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
  }
  if (value === "3days") {
    return new Date(now.getTime() + 3 * 86400000).toISOString();
  }
  if (value === "1week") {
    return new Date(now.getTime() + 7 * 86400000).toISOString();
  }
  return new Date(now.getTime() + 86400000).toISOString();
}

export default function CreateBroadcastScreen() {
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [selectedType, setSelectedType] = useState("other");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("friends");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [expiry, setExpiry] = useState("tonight");

  // Location
  const [locationName, setLocationName] = useState("");
  const [locationCoords, setLocationCoords] = useState(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const locationSearchTimeout = useRef(null);

  // Date/time
  const [flexibleDate, setFlexibleDate] = useState(true);
  const [scheduledDate, setScheduledDate] = useState(new Date(Date.now() + 86400000));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [posting, setPosting] = useState(false);

  // Nominatim location search
  function handleLocationSearch(text) {
    setLocationSearch(text);
    setLocationName(text);
    if (!text.trim()) {
      setLocationResults([]);
      return;
    }
    clearTimeout(locationSearchTimeout.current);
    locationSearchTimeout.current = setTimeout(async () => {
      setLocationLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5`;
        const res = await fetch(url, { headers: { "User-Agent": "WhatSapp/1.0" } });
        const data = await res.json();
        setLocationResults(data);
      } catch {}
      setLocationLoading(false);
    }, 500);
  }

  function selectLocationResult(result) {
    const name = result.display_name.split(",").slice(0, 2).join(", ");
    setLocationName(name);
    setLocationSearch(name);
    setLocationCoords({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setLocationResults([]);
  }

  async function useCurrentLocation() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Allow location access to use your current location.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      try {
        const [geocoded] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (geocoded) {
          const name = [geocoded.name, geocoded.street, geocoded.city].filter(Boolean).join(", ");
          setLocationName(name);
          setLocationSearch(name);
        }
      } catch {}
    } catch (err) {
      Alert.alert("Error", "Could not get your location.");
    } finally {
      setGpsLoading(false);
    }
  }

  async function handlePost() {
    if (!title.trim()) {
      Alert.alert("Required", "Please enter a title for your broadcast.");
      return;
    }
    setPosting(true);
    try {
      const body = {
        title: title.trim(),
        type: selectedType,
        description: description.trim() || null,
        location_name: locationName.trim() || null,
        lat: locationCoords?.lat ?? null,
        lng: locationCoords?.lng ?? null,
        visibility,
        max_participants: maxParticipants ? parseInt(maxParticipants) : null,
        expires_at: flexibleDate ? expiryToISO(expiry) : scheduledDate.toISOString(),
        scheduled_at: flexibleDate ? null : scheduledDate.toISOString(),
        is_flexible: flexibleDate,
      };
      await createBroadcast(body);
      router.back();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join("\n")
        : detail ? String(detail) : (err?.message ?? "Could not create broadcast. Try again.");
      Alert.alert("Error", msg);
    } finally {
      setPosting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.sectionLabel}>WHAT ARE YOU PLANNING?</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="e.g. Sunset hike at Masada"
          placeholderTextColor="#9CA3AF"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          returnKeyType="done"
        />

        {/* Type selector */}
        <Text style={styles.sectionLabel}>TYPE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typesRow}
        >
          {BROADCAST_TYPES.map((t) => {
            const sel = selectedType === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                onPress={() => setSelectedType(t.value)}
                style={[styles.typePill, sel && styles.typePillActive]}
              >
                <Text style={styles.typePillEmoji}>{t.emoji}</Text>
                <Text style={[styles.typePillLabel, sel && styles.typePillLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Location */}
        <Text style={styles.sectionLabel}>LOCATION</Text>
        <View style={styles.locationBox}>
          <View style={styles.locationRow}>
            <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.locationInput}
              placeholder="Search a place…"
              placeholderTextColor="#9CA3AF"
              value={locationSearch}
              onChangeText={handleLocationSearch}
              returnKeyType="search"
            />
            {locationLoading && <ActivityIndicator size="small" color="#0EA5E9" />}
          </View>
          {locationResults.length > 0 && (
            <View style={styles.locationDropdown}>
              {locationResults.map((r, i) => (
                <TouchableOpacity
                  key={r.place_id}
                  onPress={() => selectLocationResult(r)}
                  style={[styles.locationResultRow, i < locationResults.length - 1 && styles.locationResultBorder]}
                >
                  <Ionicons name="location-outline" size={13} color="#9CA3AF" style={{ marginRight: 8 }} />
                  <Text style={styles.locationResultText} numberOfLines={1}>
                    {r.display_name.split(",").slice(0, 2).join(", ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.locationDivider} />
          <TouchableOpacity
            onPress={useCurrentLocation}
            disabled={gpsLoading}
            style={styles.gpsBtn}
          >
            {gpsLoading
              ? <ActivityIndicator size="small" color="#0EA5E9" />
              : <Ionicons name="navigate-outline" size={16} color="#0EA5E9" />}
            <Text style={styles.gpsBtnText}>Use my current location</Text>
          </TouchableOpacity>
        </View>
        {locationCoords && (
          <View style={styles.locationSelectedChip}>
            <Ionicons name="checkmark-circle" size={14} color="#2563EB" />
            <Text style={styles.locationSelectedText} numberOfLines={1}>
              {locationName || `${locationCoords.lat.toFixed(4)}, ${locationCoords.lng.toFixed(4)}`}
            </Text>
          </View>
        )}

        {/* Date & Time */}
        <Text style={styles.sectionLabel}>WHEN?</Text>
        <View style={styles.pillRow}>
          <TouchableOpacity
            onPress={() => setFlexibleDate(true)}
            style={[styles.halfPill, flexibleDate && styles.halfPillActive]}
          >
            <Text style={[styles.halfPillText, flexibleDate && styles.halfPillTextActive]}>
              Flexible
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFlexibleDate(false)}
            style={[styles.halfPill, !flexibleDate && styles.halfPillActive]}
          >
            <Text style={[styles.halfPillText, !flexibleDate && styles.halfPillTextActive]}>
              Set date &amp; time
            </Text>
          </TouchableOpacity>
        </View>
        {!flexibleDate && (
          <>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={styles.dateRow}
            >
              <Ionicons name="calendar-outline" size={17} color="#0EA5E9" />
              <Text style={styles.dateText}>
                {scheduledDate.toLocaleDateString()} at {scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={scheduledDate}
                mode="datetime"
                minimumDate={new Date()}
                onChange={(e, date) => { setShowDatePicker(false); if (date) setScheduledDate(date); }}
              />
            )}
          </>
        )}

        {/* Description */}
        <Text style={styles.sectionLabel}>DESCRIPTION</Text>
        <TextInput
          style={styles.descInput}
          placeholder="Add details (optional)"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={500}
        />

        {/* Visibility */}
        <Text style={styles.sectionLabel}>VISIBILITY</Text>
        <View style={styles.visibilityRow}>
          {VISIBILITY_OPTIONS.map((v) => {
            const sel = visibility === v.value;
            return (
              <TouchableOpacity
                key={v.value}
                onPress={() => setVisibility(v.value)}
                style={[styles.visPill, sel && styles.visPillActive]}
              >
                <Ionicons name={v.icon} size={14} color={sel ? "#0EA5E9" : "#9CA3AF"} />
                <Text style={[styles.visPillText, sel && styles.visPillTextActive]}>{v.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Max participants */}
        <Text style={styles.sectionLabel}>MAX PEOPLE (OPTIONAL)</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="e.g. 10"
          placeholderTextColor="#9CA3AF"
          value={maxParticipants}
          onChangeText={(v) => setMaxParticipants(v.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          returnKeyType="done"
        />

        {/* Expiry */}
        {flexibleDate && (
          <>
            <Text style={styles.sectionLabel}>OPEN UNTIL</Text>
            <View style={styles.expiryRow}>
              {EXPIRY_OPTIONS.map((e) => {
                const sel = expiry === e.value;
                return (
                  <TouchableOpacity
                    key={e.value}
                    onPress={() => setExpiry(e.value)}
                    style={[styles.expiryPill, sel && styles.expiryPillActive]}
                  >
                    <Text style={[styles.expiryPillText, sel && styles.expiryPillTextActive]}>{e.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Post button */}
        <TouchableOpacity
          style={[styles.postBtn, (!title.trim() || posting) && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={!title.trim() || posting}
        >
          {posting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.postBtnText}>📡 Broadcast It!</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0F7FF" },
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A09A93",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 20,
  },

  titleInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  typesRow: {
    gap: 8,
    paddingRight: 4,
  },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: "#F0F7FF",
    borderWidth: 1.5,
    borderColor: "#DBEAFE",
  },
  typePillActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  typePillEmoji: { fontSize: 16 },
  typePillLabel: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  typePillLabelActive: { color: "#fff" },

  locationBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  locationDropdown: {
    borderTopWidth: 1,
    borderTopColor: "#DBEAFE",
    backgroundColor: "#fff",
  },
  locationResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  locationResultBorder: { borderBottomWidth: 1, borderBottomColor: "#F0F7FF" },
  locationResultText: { fontSize: 13, color: "#1C1C1E", flex: 1 },
  locationDivider: { height: 1, backgroundColor: "#DBEAFE", marginHorizontal: 14 },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  gpsBtnText: { fontSize: 14, color: "#0EA5E9", fontWeight: "600" },
  locationSelectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#DBEAFE",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#2563EB",
  },
  locationSelectedText: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "600",
    maxWidth: 260,
  },

  pillRow: {
    flexDirection: "row",
    backgroundColor: "#DBEAFE",
    borderRadius: 50,
    padding: 4,
    gap: 4,
  },
  halfPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 50,
    backgroundColor: "transparent",
  },
  halfPillActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  halfPillText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  halfPillTextActive: { color: "#1C1C1E" },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dateText: { fontSize: 15, color: "#1C1C1E" },

  descInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: "#111827",
    minHeight: 80,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  visibilityRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  visPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#DBEAFE",
  },
  visPillActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#0EA5E9",
  },
  visPillText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  visPillTextActive: { color: "#0EA5E9" },

  fieldInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: "#111827",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  expiryRow: {
    flexDirection: "row",
    gap: 8,
  },
  expiryPill: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 50,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#DBEAFE",
  },
  expiryPillActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#0EA5E9",
  },
  expiryPillText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  expiryPillTextActive: { color: "#0EA5E9" },

  postBtn: {
    marginTop: 28,
    backgroundColor: "#0EA5E9",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#0EA5E9",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: 0.2 },
});

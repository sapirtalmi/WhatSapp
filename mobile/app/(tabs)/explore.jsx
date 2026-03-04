import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert, Platform } from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { getNearbyPlaces } from "../../src/api/places";

export default function ExploreScreen() {
  const [location, setLocation] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
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
        setPlaces(data);
      } catch {
        // Silent — map still shows current location
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={{ marginTop: 10, color: "#6b7280" }}>Getting location…</Text>
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
    >
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
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ef4444", fontSize: 15 },
  callout: { width: 160, padding: 4 },
  calloutTitle: { fontWeight: "600", fontSize: 13 },
  calloutSub: { fontSize: 11, color: "#6b7280", marginTop: 2 },
});

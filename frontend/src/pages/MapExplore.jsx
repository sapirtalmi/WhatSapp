import { useCallback, useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useAuth } from "../context/AuthContext";
import { getGlobalPlaces } from "../api/places";
import { getFriends } from "../api/friends";
import AddPlaceModal from "../components/AddPlaceModal";

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const PLACE_TYPES = [
  { value: null, label: "All" },
  { value: "food", label: "🍽 Food" },
  { value: "travel", label: "✈️ Travel" },
  { value: "exercise", label: "🏋 Exercise" },
  { value: "shop", label: "🛍 Shop" },
  { value: "hangout", label: "☕️ Hangout" },
];

const OWNER_FILTERS = [
  { v: "all", label: "Everyone" },
  { v: "mine", label: "Mine" },
  { v: "friends", label: "Friends" },
];

const TYPE_COLORS = {
  food: "#f97316",
  travel: "#3b82f6",
  exercise: "#ef4444",
  shop: "#a855f7",
  hangout: "#22c55e",
};

const DEFAULT_CENTER = [32.0853, 34.7818]; // [lat, lng] Tel Aviv

function coloredMarker(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapExplore() {
  const { user } = useAuth();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [addCoords, setAddCoords] = useState(null);

  const loadPlaces = useCallback(async () => {
    setLoading(true);
    try {
      if (ownerFilter === "friends") {
        const friendships = await getFriends();
        // FriendshipWithUserOut.user is already the other person (not the caller)
        const friendIds = friendships.map((f) => f.user.id);
        if (friendIds.length === 0) { setPlaces([]); return; }
        const params = { limit: 200 };
        if (activeType) params.type = activeType;
        const results = await Promise.all(
          friendIds.slice(0, 10).map((fid) => getGlobalPlaces({ ...params, owner_id: fid }))
        );
        const seen = new Set();
        setPlaces(
          results.flat().filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; })
        );
      } else {
        const params = { limit: 200 };
        if (activeType) params.type = activeType;
        if (ownerFilter === "mine" && user?.id) params.owner_id = user.id;
        setPlaces(await getGlobalPlaces(params));
      }
    } catch {
      // silent — map still usable
    } finally {
      setLoading(false);
    }
  }, [activeType, ownerFilter, user?.id]);

  useEffect(() => { loadPlaces(); }, [loadPlaces]);

  function handleMapClick(lat, lng) {
    setSelected(null);
    setAddCoords({ lat, lng });
  }

  return (
    <div className="relative h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden">
      {/* Floating filter bar */}
      <div className="absolute top-3 left-1/2 z-[1000] -translate-x-1/2 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
        <div className="flex flex-wrap gap-1">
          {PLACE_TYPES.map((t) => (
            <button
              key={String(t.value)}
              onClick={() => setActiveType(t.value)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all ${
                activeType === t.value
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-200" />

        <div className="flex gap-1">
          {OWNER_FILTERS.map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setOwnerFilter(v)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all ${
                ownerFilter === v
                  ? "border-slate-700 bg-slate-700 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="h-3.5 w-3.5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        )}
      </div>

      {/* Place count badge */}
      <div className="absolute right-4 top-3 z-[1000] rounded-full border border-gray-200 bg-white/90 px-2.5 py-1 text-xs text-gray-500 shadow">
        {loading ? "…" : `${places.length} place${places.length !== 1 ? "s" : ""}`}
      </div>

      {/* Map */}
      <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ width: "100%", height: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onMapClick={handleMapClick} />

        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={coloredMarker(TYPE_COLORS[place.type] ?? "#4f46e5")}
            eventHandlers={{ click: () => { setSelected(place); setAddCoords(null); } }}
          >
            {selected?.id === place.id && (
              <Popup position={[place.lat, place.lng]} onClose={() => setSelected(null)}>
                <div className="max-w-[220px]">
                  <p className="font-semibold text-gray-900">{place.name}</p>
                  {place.address && (
                    <p className="mt-0.5 text-sm text-gray-500">{place.address}</p>
                  )}
                  {place.description && (
                    <p className="mt-1 text-sm text-gray-400 line-clamp-2">{place.description}</p>
                  )}
                  {place.collection_title && (
                    <a
                      href={`/collections/${place.collection_id}`}
                      className="mt-1.5 block text-xs text-indigo-500 hover:underline"
                    >
                      📚 {place.collection_title}
                      {place.owner_username && ` · by ${place.owner_username}`}
                    </a>
                  )}
                </div>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>

      {/* Hint */}
      <div className="absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-xs text-gray-400 shadow">
        💡 Click anywhere on the map to add a place
      </div>

      {addCoords && (
        <AddPlaceModal
          initialLat={addCoords.lat}
          initialLng={addCoords.lng}
          onClose={() => setAddCoords(null)}
          onAdded={(place) => { setPlaces((prev) => [place, ...prev]); setAddCoords(null); }}
        />
      )}
    </div>
  );
}

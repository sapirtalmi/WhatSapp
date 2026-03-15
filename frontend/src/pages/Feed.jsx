import { useCallback, useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useAuth } from "../context/AuthContext";
import { getFriends } from "../api/friends";
import { getGlobalPlaces } from "../api/places";

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const TYPE_FILTERS = [
  { value: null,       label: "All types", color: "#6366f1" },
  { value: "food",     label: "🍽 Food",   color: "#f97316" },
  { value: "travel",   label: "✈️ Travel", color: "#3b82f6" },
  { value: "exercise", label: "🏋 Exercise",color: "#ef4444" },
  { value: "shop",     label: "🛍 Shop",   color: "#a855f7" },
  { value: "hangout",  label: "☕ Hangout", color: "#22c55e" },
];

const TYPE_COLORS = {
  food: "#f97316", travel: "#3b82f6", exercise: "#ef4444", shop: "#a855f7", hangout: "#22c55e",
};

const DEFAULT_CENTER = [32.0853, 34.7818];

function coloredMarker(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function Feed() {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [selectedUser, setSelectedUser] = useState("all"); // "all" | "mine" | userId(int)
  const [activeType, setActiveType] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  // Load friends once
  useEffect(() => {
    getFriends().then(setFriends).catch(() => {});
  }, []);

  const loadPlaces = useCallback(async () => {
    setLoading(true);
    setSelected(null);
    try {
      const params = { limit: 200 };
      if (activeType) params.type = activeType;

      if (selectedUser === "mine") {
        setPlaces(await getGlobalPlaces({ ...params, source: "mine" }));
      } else if (selectedUser === "all") {
        const [mine, friendsPlaces] = await Promise.all([
          getGlobalPlaces({ ...params, source: "mine" }),
          getGlobalPlaces({ ...params, source: "friends" }),
        ]);
        const seen = new Set();
        setPlaces([...mine, ...friendsPlaces].filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        }));
      } else {
        setPlaces(await getGlobalPlaces({ ...params, owner_id: selectedUser }));
      }
    } catch {
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [selectedUser, activeType]);

  useEffect(() => { loadPlaces(); }, [loadPlaces]);

  return (
    <div className="relative h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden">

      {/* Floating filter bar */}
      <div className="absolute top-3 left-1/2 z-[1000] -translate-x-1/2 w-[calc(100%-24px)] max-w-2xl rounded-2xl border border-gray-200 bg-white/97 px-3 py-2.5 shadow-lg backdrop-blur space-y-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            onClick={() => setSelectedUser("all")}
            className={`rounded-full border px-3 py-0.5 text-xs font-semibold transition-all ${
              selectedUser === "all"
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"
            }`}
          >
            🌍 All
          </button>
          <button
            onClick={() => setSelectedUser("mine")}
            className={`rounded-full border px-3 py-0.5 text-xs font-semibold transition-all ${
              selectedUser === "mine"
                ? "bg-slate-800 border-slate-800 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
            }`}
          >
            👤 Mine
          </button>
          {friends.map((f) => {
            const isActive = selectedUser === f.user.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedUser(isActive ? "all" : f.user.id)}
                className={`rounded-full border px-3 py-0.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"
                }`}
              >
                {f.user.username}
              </button>
            );
          })}

          <span className="h-4 w-px bg-gray-200 mx-0.5" />

          {TYPE_FILTERS.map((t) => {
            const isActive = activeType === t.value;
            return (
              <button
                key={String(t.value)}
                onClick={() => setActiveType(t.value)}
                style={isActive ? { backgroundColor: t.color, borderColor: t.color } : {}}
                className={`rounded-full border px-3 py-0.5 text-xs font-semibold transition-all ${
                  isActive ? "text-white" : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Place count badge */}
      <div className="absolute right-4 top-3 z-[1000] rounded-full border border-gray-200 bg-white/90 px-2.5 py-1 text-xs text-gray-500 shadow">
        {loading
          ? <span className="inline-block h-3 w-3 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin align-middle" />
          : `${places.length} place${places.length !== 1 ? "s" : ""}`
        }
      </div>

      {/* Map */}
      <MapContainer center={DEFAULT_CENTER} zoom={6} style={{ width: "100%", height: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={coloredMarker(TYPE_COLORS[place.type] ?? "#4f46e5")}
            eventHandlers={{ click: () => setSelected(place) }}
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

      {!loading && places.length === 0 && (
        <div className="absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-2xl border border-gray-200 bg-white/95 px-5 py-3 text-center shadow-lg">
          <p className="text-sm font-semibold text-gray-700">No places found</p>
          <p className="text-xs text-gray-400 mt-0.5">Add friends or switch filters to see places</p>
        </div>
      )}
    </div>
  );
}

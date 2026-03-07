import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useAuth } from "../context/AuthContext";
import { getFriends } from "../api/friends";
import { getGlobalPlaces } from "../api/places";
import AddPlaceModal from "../components/AddPlaceModal";

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const TYPE_FILTERS = [
  { value: null,       label: "All",        color: "#6366f1" },
  { value: "food",     label: "🍽 Food",    color: "#f97316" },
  { value: "travel",   label: "✈️ Travel",  color: "#3b82f6" },
  { value: "exercise", label: "🏋 Exercise",color: "#ef4444" },
  { value: "shop",     label: "🛍 Shop",    color: "#a855f7" },
  { value: "hangout",  label: "☕ Hangout", color: "#22c55e" },
];

const TYPE_COLORS = {
  food: "#f97316", travel: "#3b82f6", exercise: "#ef4444",
  shop: "#a855f7", hangout: "#22c55e",
};

const DEFAULT_CENTER = [32.0853, 34.7818];

const AVATAR_COLORS = ["#6366f1","#f97316","#22c55e","#3b82f6","#a855f7","#ec4899"];
function avatarColor(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

function coloredMarker(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function searchPinMarker() {
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;background:#6366f1;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(99,102,241,.5)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// ── Leaflet helpers ────────────────────────────────────────────────────────────

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 14, { animate: true, duration: 0.9 });
  }, [center, map]);
  return null;
}

// ── Search component (Nominatim) ───────────────────────────────────────────────

function SearchBar({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const timeout = useRef(null);
  const wrapperRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    clearTimeout(timeout.current);
    timeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        const data = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {}
      setSearching(false);
    }, 400);
  }

  function pick(r) {
    const label = r.display_name.split(",")[0];
    setQuery(label);
    setOpen(false);
    onSelect({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), label });
  }

  function clear() {
    setQuery("");
    setResults([]);
    setOpen(false);
    onSelect(null);
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-sm">
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-md">
        <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search a location…"
          className="flex-1 text-sm text-gray-800 placeholder-gray-400 bg-transparent outline-none"
        />
        {searching && (
          <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin flex-shrink-0" />
        )}
        {!searching && query && (
          <button onClick={clear} className="text-gray-300 hover:text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 z-[2000] rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                onClick={() => pick(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 border-b border-gray-100 last:border-0"
              >
                <p className="text-sm font-semibold text-gray-800 truncate">{r.display_name.split(",")[0]}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{r.display_name}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Explore() {
  const { user } = useAuth();

  // Map style
  const [satellite, setSatellite] = useState(false);

  // Search / location
  const [flyTo, setFlyTo] = useState(null);
  const [searchPin, setSearchPin] = useState(null);

  // Filters
  const [friends, setFriends] = useState([]);
  const [selectedUser, setSelectedUser] = useState("all");
  const [activeType, setActiveType] = useState(null);

  // Places
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  // Add place
  const [addCoords, setAddCoords] = useState(null);

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

  function handleMapClick(lat, lng) {
    setSelected(null);
    setAddCoords({ lat, lng });
  }

  function handleSearchSelect(result) {
    if (!result) { setSearchPin(null); return; }
    setSearchPin(result);
    setFlyTo([result.lat, result.lng]);
  }

  return (
    <div className="relative h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden">

      {/* ── Top bar (search + filters) ────────────────────────────────── */}
      <div className="absolute top-3 left-1/2 z-[1000] -translate-x-1/2 w-[calc(100%-24px)] max-w-3xl rounded-2xl border border-gray-200 bg-white/97 px-3 py-2.5 shadow-lg backdrop-blur space-y-2">

        {/* Search row */}
        <SearchBar onSelect={handleSearchSelect} />

        {/* Filter chips row */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* User filters */}
          <button
            onClick={() => setSelectedUser("all")}
            className={`rounded-full border px-3 py-0.5 text-xs font-semibold transition-all ${
              selectedUser === "all"
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"
            }`}
          >
            🌍 Everyone
          </button>
          <button
            onClick={() => setSelectedUser("mine")}
            className={`rounded-full border px-3 py-0.5 text-xs font-semibold transition-all ${
              selectedUser === "mine"
                ? "bg-slate-800 border-slate-800 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
            }`}
          >
            👤 My Places
          </button>
          {friends.map((f) => {
            const isActive = selectedUser === f.user.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedUser(isActive ? "all" : f.user.id)}
                style={isActive ? { backgroundColor: avatarColor(f.user.username), borderColor: avatarColor(f.user.username) } : {}}
                className={`rounded-full border px-3 py-0.5 text-xs font-semibold transition-all ${
                  isActive ? "text-white" : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"
                }`}
              >
                {f.user.username[0].toUpperCase()} {f.user.username}
              </button>
            );
          })}

          <span className="h-4 w-px bg-gray-200 mx-0.5" />

          {/* Type filters */}
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

      {/* ── Place count + loading ─────────────────────────────────────── */}
      <div className="absolute right-4 top-3 z-[1000] rounded-full border border-gray-200 bg-white/90 px-2.5 py-1 text-xs text-gray-500 shadow">
        {loading
          ? <span className="inline-block h-3 w-3 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin align-middle" />
          : `${places.length} place${places.length !== 1 ? "s" : ""}`
        }
      </div>

      {/* ── Satellite toggle ─────────────────────────────────────────── */}
      <button
        onClick={() => setSatellite((s) => !s)}
        className="absolute bottom-12 right-4 z-[1000] flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-md hover:bg-gray-50 transition-colors"
      >
        {satellite ? "🗺 Map" : "🛰 Satellite"}
      </button>

      {/* ── Map ──────────────────────────────────────────────────────── */}
      <MapContainer center={DEFAULT_CENTER} zoom={7} style={{ width: "100%", height: "100%" }}>
        {satellite ? (
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        <MapClickHandler onMapClick={handleMapClick} />
        {flyTo && <FlyTo center={flyTo} />}

        {/* Search pin */}
        {searchPin && (
          <Marker
            position={[searchPin.lat, searchPin.lng]}
            icon={searchPinMarker()}
          >
            <Popup>
              <p className="font-semibold text-gray-800 text-sm">{searchPin.label}</p>
            </Popup>
          </Marker>
        )}

        {/* Place markers */}
        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={coloredMarker(TYPE_COLORS[place.type] ?? "#4f46e5")}
            eventHandlers={{ click: () => { setSelected(place); setAddCoords(null); } }}
          >
            {selected?.id === place.id && (
              <Popup position={[place.lat, place.lng]} onClose={() => setSelected(null)}>
                <div className="max-w-[230px]">
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

      {/* ── Add place hint ────────────────────────────────────────────── */}
      <div className="absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-xs text-gray-400 shadow">
        💡 Click anywhere on the map to add a place
      </div>

      {/* ── Add place modal ───────────────────────────────────────────── */}
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

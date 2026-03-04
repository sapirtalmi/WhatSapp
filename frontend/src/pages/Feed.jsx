import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getFeed } from "../api/feed";
import MapView from "../components/MapView";

const PAGE_SIZE = 20;

const TYPE_FILTERS = [
  { value: null, label: "All" },
  { value: "food", label: "🍽 Food" },
  { value: "travel", label: "✈️ Travel" },
  { value: "shop", label: "🛍 Shop" },
  { value: "hangout", label: "☕️ Hangout" },
];

const TYPE_STYLES = {
  food: { badge: "bg-orange-100 text-orange-700", border: "border-l-orange-400" },
  travel: { badge: "bg-blue-100 text-blue-700", border: "border-l-blue-400" },
  shop: { badge: "bg-purple-100 text-purple-700", border: "border-l-purple-400" },
  hangout: { badge: "bg-green-100 text-green-700", border: "border-l-green-400" },
};

function PlaceCard({ place }) {
  const style = TYPE_STYLES[place.type] ?? { badge: "bg-gray-100 text-gray-600", border: "border-l-gray-300" };
  return (
    <div className={`rounded-xl border border-gray-100 bg-white shadow-sm border-l-4 ${style.border} p-4 transition-all duration-150 hover:shadow-md hover:scale-[1.005]`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 leading-snug">{place.name}</p>
        {place.type && (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}>
            {TYPE_FILTERS.find((f) => f.value === place.type)?.label ?? place.type}
          </span>
        )}
      </div>
      {place.address && (
        <p className="mt-1 text-sm text-gray-500">{place.address}</p>
      )}
      {place.description && (
        <p className="mt-1.5 text-sm text-gray-400 line-clamp-2">{place.description}</p>
      )}
      {(place.collection_title || place.owner_username) && (
        <p className="mt-2 text-xs text-indigo-500">
          {place.collection_title && <span>📚 {place.collection_title}</span>}
          {place.collection_title && place.owner_username && <span className="text-gray-300 mx-1">·</span>}
          {place.owner_username && <span>by {place.owner_username}</span>}
        </p>
      )}
    </div>
  );
}

export default function Feed() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [view, setView] = useState("list");
  const [activeType, setActiveType] = useState(null);

  function loadData(offset, type, reset) {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    return getFeed(PAGE_SIZE, offset, type)
      .then((data) => {
        setPlaces((prev) => (reset || offset === 0 ? data : [...prev, ...data]));
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch(() => setError("Failed to load feed."))
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }

  useEffect(() => {
    loadData(0, activeType, true);
  }, [activeType]);

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Feed</h1>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm shadow-sm">
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 transition-colors ${view === "list" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            ☰ List
          </button>
          <button
            onClick={() => setView("map")}
            className={`px-3 py-1.5 transition-colors ${view === "map" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            🗺 Map
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {TYPE_FILTERS.map((f) => (
          <button
            key={String(f.value)}
            onClick={() => { setActiveType(f.value); setError(""); }}
            className={`rounded-full border px-3.5 py-1 text-sm font-medium transition-all ${
              activeType === f.value
                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && places.length === 0 && (
        <div className="mt-20 text-center">
          <p className="text-4xl mb-3">🗺</p>
          <p className="text-lg font-semibold text-gray-600">Your feed is empty</p>
          <p className="mt-1 text-sm text-gray-400">Add friends or create public collections to see places here.</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link to="/friends" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Find friends
            </Link>
            <Link to="/collections" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              My collections
            </Link>
          </div>
        </div>
      )}

      {!loading && places.length > 0 && view === "map" && (
        <MapView places={places} height="520px" />
      )}

      {!loading && places.length > 0 && view === "list" && (
        <>
          <div className="space-y-3">
            {places.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={() => loadData(places.length, activeType, false)}
                disabled={loadingMore}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 shadow-sm"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

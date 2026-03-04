import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getFeed } from "../api/feed";
import MapView from "../components/MapView";

const PAGE_SIZE = 20;

function FeedPlaceCard({ place }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="font-medium text-gray-900">{place.name}</p>
      {place.address && (
        <p className="mt-0.5 text-sm text-gray-500">{place.address}</p>
      )}
      {place.description && (
        <p className="mt-1 text-sm text-gray-400 line-clamp-2">{place.description}</p>
      )}
      <p className="mt-2 text-xs text-gray-300">
        {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
      </p>
    </div>
  );
}

export default function Feed() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [view, setView] = useState("list"); // "list" | "map"

  useEffect(() => {
    getFeed(PAGE_SIZE, 0)
      .then((data) => {
        setPlaces(data);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch(() => setError("Failed to load feed."))
      .finally(() => setLoading(false));
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await getFeed(PAGE_SIZE, places.length);
      setPlaces((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      setError("Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Feed</h1>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              List
            </button>
            <button
              onClick={() => setView("map")}
              className={`px-3 py-1.5 ${view === "map" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              Map
            </button>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        {loading && <p className="text-center text-gray-400">Loading…</p>}

        {!loading && places.length === 0 && (
          <div className="mt-20 text-center text-gray-400">
            <p className="text-lg">Your feed is empty.</p>
            <p className="mt-1 text-sm">
              Add friends or create public collections to see places here.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link to="/friends" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
                Find friends
              </Link>
              <Link to="/collections" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                My collections
              </Link>
            </div>
          </div>
        )}

        {/* Map view */}
        {!loading && places.length > 0 && view === "map" && (
          <MapView places={places} height="500px" />
        )}

        {/* List view */}
        {!loading && places.length > 0 && view === "list" && (
          <>
            <div className="space-y-3">
              {places.map((place) => (
                <FeedPlaceCard key={place.id} place={place} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

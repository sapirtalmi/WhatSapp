import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getCollection, deleteCollection } from "../api/collections";
import { getPlaces } from "../api/places";
import CollectionModal from "../components/CollectionModal";
import PlaceCard from "../components/PlaceCard";
import AddPlaceModal from "../components/AddPlaceModal";
import MapView from "../components/MapView";

const TYPE_FILTERS = [
  { value: null, label: "All" },
  { value: "food", label: "🍽 Food" },
  { value: "travel", label: "✈️ Travel" },
  { value: "exercise", label: "🏋 Exercise" },
  { value: "shop", label: "🛍 Shop" },
  { value: "hangout", label: "☕️ Hangout" },
];

const TYPE_COLORS = {
  food: "#f97316",
  travel: "#3b82f6",
  exercise: "#ef4444",
  shop: "#a855f7",
  hangout: "#22c55e",
};

export default function CollectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [collection, setCollection] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [addPlaceCoords, setAddPlaceCoords] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [view, setView] = useState("list");
  const [activeType, setActiveType] = useState(null);

  useEffect(() => {
    Promise.all([getCollection(id), getPlaces(id)])
      .then(([col, pls]) => {
        setCollection(col);
        setPlaces(pls);
      })
      .catch(() => setError("Collection not found."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!window.confirm("Delete this collection? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteCollection(id);
      navigate("/collections");
    } catch {
      setError("Failed to delete collection.");
      setDeleting(false);
    }
  }

  function handleMapClick(lat, lng) {
    if (!isOwner) return;
    setAddPlaceCoords({ lat, lng });
    setShowAddPlace(true);
  }

  function handlePlaceAdded(place) {
    setPlaces((prev) => [place, ...prev]);
    setShowAddPlace(false);
    setAddPlaceCoords(null);
  }

  const filteredPlaces = activeType
    ? places.filter((p) => p.type === activeType)
    : places;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !collection) {
    return <div className="flex min-h-screen items-center justify-center text-red-500">{error || "Not found."}</div>;
  }

  const isOwner = user?.id === collection.owner_id;

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate("/collections")}
        className="mb-4 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors"
      >
        ← Back to collections
      </button>

      {/* Collection header */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{collection.title}</h1>
            {collection.description && (
              <p className="mt-1.5 text-gray-500">{collection.description}</p>
            )}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  collection.is_public ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {collection.is_public ? "Public" : "Private"}
              </span>
              <span className="text-xs text-gray-400">{places.length} place{places.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {isOwner && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setShowEdit(true)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* View toggle */}
      <div className="mt-5 flex items-center justify-between gap-4">
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

        {isOwner && (
          <button
            onClick={() => { setAddPlaceCoords(null); setShowAddPlace(true); }}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            + Add place
          </button>
        )}
      </div>

      {/* Type filter chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {TYPE_FILTERS.map((f) => (
          <button
            key={String(f.value)}
            onClick={() => setActiveType(f.value)}
            className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-all ${
              activeType === f.value
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Map view */}
      {view === "map" && (
        <div className="mt-4">
          {isOwner && (
            <p className="mb-2 text-xs text-gray-400 text-center">
              💡 Click anywhere on the map to add a place at that location
            </p>
          )}
          <MapView
            places={filteredPlaces}
            height="420px"
            onMapClick={isOwner ? handleMapClick : undefined}
            markerColor={(place) => TYPE_COLORS[place.type] ?? "#4f46e5"}
          />
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          {filteredPlaces.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">📍</p>
              <p className="text-gray-400 text-sm">
                {activeType ? "No places with this type." : isOwner ? "No places yet — add one!" : "No places yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPlaces.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  collectionId={id}
                  isOwner={isOwner}
                  onDeleted={(deletedId) =>
                    setPlaces((prev) => prev.filter((p) => p.id !== deletedId))
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showEdit && (
        <CollectionModal
          collection={collection}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => { setCollection(updated); setShowEdit(false); }}
        />
      )}

      {showAddPlace && (
        <AddPlaceModal
          collectionId={id}
          initialLat={addPlaceCoords?.lat}
          initialLng={addPlaceCoords?.lng}
          onClose={() => { setShowAddPlace(false); setAddPlaceCoords(null); }}
          onAdded={handlePlaceAdded}
        />
      )}
    </div>
  );
}

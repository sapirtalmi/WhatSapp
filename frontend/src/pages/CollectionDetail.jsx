import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getCollection, deleteCollection } from "../api/collections";
import { getPlaces } from "../api/places";
import CollectionModal from "../components/CollectionModal";
import PlaceCard from "../components/PlaceCard";
import AddPlaceModal from "../components/AddPlaceModal";
import MapView from "../components/MapView";

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
  const [deleting, setDeleting] = useState(false);

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

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-400">Loading…</div>;
  }

  if (error || !collection) {
    return <div className="flex min-h-screen items-center justify-center text-red-500">{error || "Not found."}</div>;
  }

  const isOwner = user?.id === collection.owner_id;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate("/collections")}
          className="mb-4 text-sm text-gray-400 hover:text-gray-600"
        >
          ← Back to collections
        </button>

        {/* Collection header */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{collection.title}</h1>
              {collection.description && (
                <p className="mt-1 text-gray-500">{collection.description}</p>
              )}
              <span
                className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  collection.is_public ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {collection.is_public ? "Public" : "Private"}
              </span>
            </div>

            {isOwner && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEdit(true)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        {places.length > 0 && (
          <div className="mt-6">
            <MapView places={places} height="320px" />
          </div>
        )}

        {/* Places section */}
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">
              Places <span className="ml-1 text-sm font-normal text-gray-400">({places.length})</span>
            </h2>
            {isOwner && (
              <button
                onClick={() => setShowAddPlace(true)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                + Add place
              </button>
            )}
          </div>

          {places.length === 0 ? (
            <p className="text-center text-sm text-gray-400">
              No places yet{isOwner ? " — add one!" : "."}
            </p>
          ) : (
            <div className="space-y-3">
              {places.map((place) => (
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
      </div>

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
          onClose={() => setShowAddPlace(false)}
          onAdded={(place) => { setPlaces((prev) => [...prev, place]); setShowAddPlace(false); }}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getCollections } from "../api/collections";
import CollectionModal from "../components/CollectionModal";

function CollectionCard({ collection, currentUserId }) {
  return (
    <Link
      to={`/collections/${collection.id}`}
      className="block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 line-clamp-1">{collection.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            collection.is_public
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {collection.is_public ? "Public" : "Private"}
        </span>
      </div>
      {collection.description && (
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{collection.description}</p>
      )}
      {collection.owner_id !== currentUserId && (
        <p className="mt-2 text-xs text-gray-400">Shared collection</p>
      )}
    </Link>
  );
}

export default function Collections() {
  const { user } = useAuth();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  async function fetchCollections() {
    try {
      setError("");
      const data = await getCollections();
      setCollections(data);
    } catch {
      setError("Failed to load collections.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCollections();
  }, []);

  function handleSaved(newCollection) {
    setCollections((prev) => {
      const exists = prev.find((c) => c.id === newCollection.id);
      return exists
        ? prev.map((c) => (c.id === newCollection.id ? newCollection : c))
        : [newCollection, ...prev];
    });
    setShowModal(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Collections</h1>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + New collection
          </button>
        </div>

        {loading && (
          <p className="text-center text-gray-400">Loading…</p>
        )}

        {error && (
          <p className="text-center text-red-500">{error}</p>
        )}

        {!loading && !error && collections.length === 0 && (
          <div className="mt-20 text-center text-gray-400">
            <p className="text-lg">No collections yet.</p>
            <p className="mt-1 text-sm">Create one to get started!</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <CollectionCard key={c.id} collection={c} currentUserId={user?.id} />
          ))}
        </div>
      </div>

      {showModal && (
        <CollectionModal onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}
    </div>
  );
}

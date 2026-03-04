import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getCollections } from "../api/collections";
import CollectionModal from "../components/CollectionModal";

const ACCENT_COLORS = [
  "from-indigo-500 to-indigo-600",
  "from-violet-500 to-violet-600",
  "from-sky-500 to-sky-600",
  "from-emerald-500 to-emerald-600",
];

const TABS = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "public", label: "Public" },
  { key: "shared", label: "Shared" },
];

function CollectionCard({ collection, currentUserId }) {
  const accent = ACCENT_COLORS[collection.id % ACCENT_COLORS.length];
  const isOwner = collection.owner_id === currentUserId;

  return (
    <Link
      to={`/collections/${collection.id}`}
      className="group block rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm transition-all duration-150 hover:shadow-lg hover:scale-[1.02]"
    >
      {/* Color accent bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${accent}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-indigo-700 transition-colors">
            {collection.title}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              collection.is_public
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {collection.is_public ? "Public" : "Private"}
          </span>
        </div>

        {collection.description && (
          <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">{collection.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
          <span>
            {collection.place_count != null ? `${collection.place_count} place${collection.place_count !== 1 ? "s" : ""}` : ""}
          </span>
          {!isOwner && collection.owner_username && (
            <span className="text-indigo-400">by {collection.owner_username}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Collections() {
  const { user } = useAuth();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    let list = collections;
    if (activeTab === "mine") list = list.filter((c) => c.owner_id === user?.id);
    else if (activeTab === "public") list = list.filter((c) => c.is_public);
    else if (activeTab === "shared") list = list.filter((c) => c.owner_id !== user?.id);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
    }
    return list;
  }, [collections, activeTab, search, user]);

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
    <div className="px-4 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Collections</h1>
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-center text-red-500">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="mt-20 text-center">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-gray-500">
            {search ? "No collections match your search." : "No collections yet."}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <CollectionCard key={c.id} collection={c} currentUserId={user?.id} />
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-2xl text-white shadow-lg hover:bg-indigo-700 transition-all hover:scale-110"
        title="New collection"
      >
        +
      </button>

      {showModal && (
        <CollectionModal onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}
    </div>
  );
}

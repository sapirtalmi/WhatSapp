import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getCollections } from "../api/collections";
import CollectionModal from "../components/CollectionModal";

const COVER_GRADIENTS = [
  "from-indigo-500 via-violet-500 to-purple-600",
  "from-rose-500 via-pink-500 to-orange-400",
  "from-teal-500 via-cyan-500 to-sky-500",
  "from-violet-500 via-fuchsia-500 to-pink-500",
  "from-amber-500 via-orange-400 to-yellow-400",
  "from-emerald-500 via-teal-500 to-cyan-400",
];

const TABS = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "public", label: "Public" },
  { key: "shared", label: "Shared" },
];

function CollectionCard({ collection, currentUserId }) {
  const cover = COVER_GRADIENTS[collection.id % COVER_GRADIENTS.length];
  const isOwner = collection.owner_id === currentUserId;

  return (
    <Link
      to={`/collections/${collection.id}`}
      className="group block rounded-2xl overflow-hidden bg-white shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
    >
      {/* Gradient cover */}
      <div className={`relative h-20 w-full bg-gradient-to-br ${cover}`}>
        {/* Privacy badge */}
        <span className={`absolute top-2.5 right-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${
          collection.is_public
            ? "bg-white/25 text-white border border-white/30"
            : "bg-black/20 text-white/90 border border-white/20"
        }`}>
          {collection.is_public ? "Public" : "Private"}
        </span>
        {/* Place count */}
        {collection.place_count != null && (
          <span className="absolute bottom-2.5 left-3 rounded-full bg-black/20 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white border border-white/20">
            📍 {collection.place_count} place{collection.place_count !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-indigo-700 transition-colors text-[15px]">
          {collection.title}
        </h3>

        {collection.description && (
          <p className="mt-1 text-xs text-gray-400 line-clamp-2 leading-relaxed">{collection.description}</p>
        )}

        {!isOwner && collection.owner_username && (
          <p className="mt-2 text-xs font-medium text-indigo-400">by {collection.owner_username}</p>
        )}
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
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl mb-4"
               style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
            📚
          </div>
          <p className="font-semibold text-gray-600">
            {search ? "No collections match your search." : "No collections yet."}
          </p>
          {!search && <p className="text-sm text-gray-400 mt-1">Tap + to create your first one</p>}
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
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white transition-all hover:scale-110 hover:shadow-2xl"
        style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 8px 24px rgba(99,102,241,0.45)" }}
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

import { useState, useEffect } from "react";
import {
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
} from "../api/friends";

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState("");

  const debouncedQuery = useDebounce(searchQuery);

  // Load friends + pending on mount
  useEffect(() => {
    Promise.all([getFriends(), getPendingRequests()])
      .then(([f, p]) => { setFriends(f); setPending(p); })
      .catch(() => setError("Failed to load friends."))
      .finally(() => setLoading(false));
  }, []);

  // Search users as query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    searchUsers(debouncedQuery)
      .then(setSearchResults)
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  }, [debouncedQuery]);

  async function handleSendRequest(userId) {
    try {
      await sendFriendRequest(userId);
      setSearchResults((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      alert(err.response?.data?.detail ?? "Could not send request.");
    }
  }

  async function handleAccept(friendshipId) {
    try {
      await acceptFriendRequest(friendshipId);
      const accepted = pending.find((p) => p.id === friendshipId);
      setPending((prev) => prev.filter((p) => p.id !== friendshipId));
      if (accepted) setFriends((prev) => [...prev, { ...accepted, status: "accepted" }]);
    } catch {
      alert("Could not accept request.");
    }
  }

  async function handleReject(friendshipId) {
    try {
      await rejectFriendRequest(friendshipId);
      setPending((prev) => prev.filter((p) => p.id !== friendshipId));
    } catch {
      alert("Could not reject request.");
    }
  }

  async function handleRemove(friendshipId) {
    if (!window.confirm("Remove this friend?")) return;
    try {
      await removeFriend(friendshipId);
      setFriends((prev) => prev.filter((f) => f.id !== friendshipId));
    } catch {
      alert("Could not remove friend.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Friends</h1>

        {/* Search */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-700">Find people</h2>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchLoading && <p className="mt-2 text-sm text-gray-400">Searching…</p>}
          {searchResults.length > 0 && (
            <ul className="mt-3 space-y-2">
              {searchResults.map((user) => (
                <li key={user.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">{user.username}</span>
                  <button
                    onClick={() => handleSendRequest(user.id)}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Add friend
                  </button>
                </li>
              ))}
            </ul>
          )}
          {debouncedQuery && !searchLoading && searchResults.length === 0 && (
            <p className="mt-2 text-sm text-gray-400">No users found.</p>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Pending requests */}
        {pending.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-700">
              Friend requests <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{pending.length}</span>
            </h2>
            <ul className="space-y-2">
              {pending.map((req) => (
                <li key={req.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">{req.user.username}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(req.id)}
                      className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Friends list */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-700">
            My friends <span className="ml-1 text-sm font-normal text-gray-400">({friends.length})</span>
          </h2>
          {loading && <p className="text-sm text-gray-400">Loading…</p>}
          {!loading && friends.length === 0 && (
            <p className="text-sm text-gray-400">No friends yet — search for people above!</p>
          )}
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                <span className="text-sm font-medium text-gray-800">{f.user.username}</span>
                <button
                  onClick={() => handleRemove(f.id)}
                  aria-label="Remove friend"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

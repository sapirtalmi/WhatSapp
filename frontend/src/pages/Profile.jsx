import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getMe, updateMe } from "../api/users";
import { getCollections } from "../api/collections";
import { getFriends } from "../api/friends";
import { getGlobalPlaces } from "../api/places";

const PLACE_TYPES = [
  { value: "food",    label: "🍽 Food",     color: "#f97316" },
  { value: "travel",  label: "✈️ Travel",   color: "#3b82f6" },
  { value: "exercise",label: "🏋 Exercise", color: "#ef4444" },
  { value: "shop",    label: "🛍 Shop",     color: "#a855f7" },
  { value: "hangout", label: "☕ Hangout",  color: "#22c55e" },
];

const AVATAR_COLORS = ["#6366f1","#f97316","#22c55e","#3b82f6","#a855f7","#ec4899"];
function avatarColor(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

function StatBox({ value, label }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xl font-extrabold text-white">{value ?? "—"}</span>
      <span className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-200">{label}</span>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
      {title && <p className="mb-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</p>}
      {children}
    </div>
  );
}

// ── Edit modal ──────────────────────────────────────────────────────────────────
function EditModal({ profile, onClose, onSaved }) {
  const [form, setForm] = useState({
    bio: profile?.bio ?? "",
    age: profile?.age != null ? String(profile.age) : "",
    study: profile?.study ?? "",
    work: profile?.work ?? "",
    living: profile?.living ?? "",
    hobbies: profile?.hobbies ?? [],
    preferred_types: profile?.preferred_types ?? [],
  });
  const [hobbyInput, setHobbyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  function addHobby() {
    const t = hobbyInput.trim();
    if (t) { set("hobbies", [...form.hobbies, t]); setHobbyInput(""); }
  }

  function toggleType(val) {
    set("preferred_types", form.preferred_types.includes(val)
      ? form.preferred_types.filter((v) => v !== val)
      : [...form.preferred_types, val]);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        bio: form.bio || null,
        age: form.age ? parseInt(form.age) : null,
        study: form.study || null,
        work: form.work || null,
        living: form.living || null,
        hobbies: form.hobbies.length ? form.hobbies : null,
        preferred_types: form.preferred_types.length ? form.preferred_types : null,
      };
      const updated = await updateMe(payload);
      onSaved(updated);
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">Cancel</button>
          <h2 className="text-base font-bold text-gray-900">Edit Profile</h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}

          {[
            { key: "bio", label: "Bio", placeholder: "Tell the world about yourself…", multiline: true },
            { key: "age", label: "Age", placeholder: "e.g. 25", type: "number" },
            { key: "study", label: "Study", placeholder: "e.g. Computer Science, Tel Aviv University" },
            { key: "work", label: "Work", placeholder: "e.g. Software Engineer at Google" },
            { key: "living", label: "Lives in", placeholder: "e.g. Tel Aviv, Israel" },
          ].map(({ key, label, placeholder, multiline, type }) => (
            <div key={key}>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">{label}</label>
              {multiline ? (
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={placeholder}
                />
              ) : (
                <input
                  type={type ?? "text"}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={placeholder}
                />
              )}
            </div>
          ))}

          {/* Hobbies */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Hobbies</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.hobbies.map((h, i) => (
                <button
                  key={i}
                  onClick={() => set("hobbies", form.hobbies.filter((_, j) => j !== i))}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  {h} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={hobbyInput}
                onChange={(e) => setHobbyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHobby())}
                placeholder="Add a hobby…"
              />
              <button
                onClick={addHobby}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
              >
                +
              </button>
            </div>
          </div>

          {/* Preferred types */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">I love to discover</label>
            <div className="flex flex-wrap gap-2">
              {PLACE_TYPES.map((t) => {
                const active = form.preferred_types.includes(t.value);
                return (
                  <button
                    key={t.value}
                    onClick={() => toggleType(t.value)}
                    style={active ? { backgroundColor: t.color, borderColor: t.color } : {}}
                    className={`rounded-full border px-3.5 py-1 text-xs font-semibold transition-all ${
                      active ? "text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Profile page ────────────────────────────────────────────────────────────────
export default function Profile() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ collections: null, places: null, friends: null });
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await getMe();
      setProfile(p);
    } catch {}
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [cols, friends, places] = await Promise.all([
        getCollections(),
        getFriends(),
        getGlobalPlaces({ source: "mine", limit: 200 }),
      ]);
      setStats({ collections: cols.length, places: places.length, friends: friends.length });
    } catch {}
  }, []);

  useEffect(() => { load(); loadStats(); }, []);

  const p = profile ?? authUser;
  const color = avatarColor(p?.username);
  const letter = (p?.username?.[0] ?? "?").toUpperCase();
  const hobbies = profile?.hobbies ?? [];
  const preferredTypes = profile?.preferred_types ?? [];
  const hasAbout = profile?.age || profile?.study || profile?.work || profile?.living;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Gradient hero ─────────────────────────────────────────────── */}
      <div
        className="relative"
        style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #a855f7 100%)" }}
      >
        <div className="mx-auto max-w-2xl px-6 py-10 text-center">
          {/* Avatar */}
          <div className="inline-flex items-center justify-center rounded-full p-1.5 mb-4"
               style={{ background: "rgba(255,255,255,0.2)" }}>
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full text-white text-4xl font-extrabold shadow-lg"
              style={{ backgroundColor: color }}
            >
              {letter}
            </div>
          </div>

          {/* Name */}
          <h1 className="text-3xl font-extrabold text-white">{p?.username}</h1>

          {/* Living + bio */}
          {(profile?.living || profile?.bio) && (
            <p className="mt-2 text-sm text-indigo-100 max-w-sm mx-auto leading-relaxed">
              {profile?.living && <span>📍 {profile.living}</span>}
              {profile?.living && profile?.bio && <span className="mx-1.5 opacity-50">·</span>}
              {profile?.bio && <span>{profile.bio}</span>}
            </p>
          )}

          {/* Edit button */}
          <button
            onClick={() => setEditing(true)}
            className="mt-4 rounded-full bg-white/20 hover:bg-white/30 border border-white/30 px-4 py-1.5 text-sm font-semibold text-white transition-all backdrop-blur-sm"
          >
            ✏️ Edit Profile
          </button>

          {/* Stats */}
          <div className="mt-8 flex justify-center gap-12 border-t border-white/20 pt-6">
            <StatBox value={stats.collections} label="Collections" />
            <StatBox value={stats.places} label="Places" />
            <StatBox value={stats.friends} label="Friends" />
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {/* About card */}
        {hasAbout && (
          <Card title="About">
            <div className="space-y-3">
              <InfoRow icon="🎂" label="Age" value={profile?.age ? `${profile.age} years old` : null} />
              <InfoRow icon="🎓" label="Study" value={profile?.study} />
              <InfoRow icon="💼" label="Work" value={profile?.work} />
              <InfoRow icon="📍" label="Lives in" value={profile?.living} />
            </div>
          </Card>
        )}

        {/* Hobbies */}
        {hobbies.length > 0 && (
          <Card title="Hobbies">
            <div className="flex flex-wrap gap-2">
              {hobbies.map((h) => (
                <span key={h} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {h}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Preferred types */}
        {preferredTypes.length > 0 && (
          <Card title="I love to discover">
            <div className="flex flex-wrap gap-2">
              {PLACE_TYPES.filter((t) => preferredTypes.includes(t.value)).map((t) => (
                <span
                  key={t.value}
                  className="rounded-full border px-3.5 py-1 text-xs font-semibold"
                  style={{ borderColor: t.color, color: t.color, backgroundColor: t.color + "15" }}
                >
                  {t.label}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* My content */}
        <Card title="My content">
          <div className="divide-y divide-gray-50">
            <Link to="/collections" className="flex items-center gap-3 py-2.5 text-sm font-medium text-gray-800 hover:text-indigo-600 transition-colors">
              <span className="text-lg">📚</span> My collections
              <span className="ml-auto text-gray-300">›</span>
            </Link>
            <Link to="/friends" className="flex items-center gap-3 py-2.5 text-sm font-medium text-gray-800 hover:text-indigo-600 transition-colors">
              <span className="text-lg">👥</span> Friends
              <span className="ml-auto text-gray-300">›</span>
            </Link>
            <Link to="/map" className="flex items-center gap-3 py-2.5 text-sm font-medium text-gray-800 hover:text-indigo-600 transition-colors">
              <span className="text-lg">🗺</span> Explore Map
              <span className="ml-auto text-gray-300">›</span>
            </Link>
          </div>
        </Card>

        {(!hasAbout && hobbies.length === 0 && preferredTypes.length === 0) && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-4xl mb-3">✏️</p>
            <p className="font-semibold text-gray-600">Your profile is empty</p>
            <p className="text-sm mt-1">Click "Edit Profile" to add your info</p>
          </div>
        )}
      </div>

      {editing && (
        <EditModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(updated) => { setProfile(updated); setEditing(false); }}
        />
      )}
    </div>
  );
}

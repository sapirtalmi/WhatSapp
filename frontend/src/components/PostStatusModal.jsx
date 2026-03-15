import { useState } from "react";
import { createStatus, updateStatus } from "../api/status";

const ACTIVITIES = [
  { type: "coffee",  emoji: "☕",  label: "Coffee"  },
  { type: "drinks",  emoji: "🍺",  label: "Drinks"  },
  { type: "study",   emoji: "📚",  label: "Study"   },
  { type: "hike",    emoji: "🥾",  label: "Hike"    },
  { type: "food",    emoji: "🍕",  label: "Food"    },
  { type: "event",   emoji: "🎉",  label: "Event"   },
  { type: "hangout", emoji: "🛋️", label: "Hangout" },
  { type: "work",    emoji: "💼",  label: "Work"    },
  { type: "other",   emoji: "🌀",  label: "Other"   },
];

/**
 * Modal for creating or ending a "Where Am I" status.
 *
 * @param {object}   props
 * @param {boolean}  props.open          - Whether the modal is visible
 * @param {function} props.onClose       - Called when the modal should close
 * @param {object}   [props.myStatus]    - Current active status (if any), used for "End" button
 * @param {function} props.onPosted      - Called after a status is posted or ended
 * @param {object}   [props.userLocation] - { lat, lng } from the map; falls back to Tel Aviv
 */
export default function PostStatusModal({ open, onClose, myStatus, onPosted, userLocation }) {
  const [mode, setMode] = useState("live");
  const [activityType, setActivityType] = useState("coffee");
  const [message, setMessage] = useState("");
  const [locationName, setLocationName] = useState("");
  const [expiry, setExpiry] = useState("1h");
  const [planDate, setPlanDate] = useState("");
  const [visibility, setVisibility] = useState("friends");
  const [posting, setPosting] = useState(false);

  if (!open) return null;

  async function handlePost() {
    setPosting(true);
    try {
      const lat = userLocation?.lat ?? 32.0853;
      const lng = userLocation?.lng ?? 34.7818;
      await createStatus({
        mode,
        activity_type: activityType,
        message: message.trim() || null,
        lat,
        lng,
        location_name: locationName.trim() || null,
        expires_at: mode === "live" ? expiry : new Date(planDate).toISOString(),
        visibility,
      });
      onPosted();
      onClose();
      setMessage("");
      setLocationName("");
    } catch {
      alert("Could not post status. Try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleEndStatus() {
    try {
      await updateStatus(myStatus.id, { is_active: false });
      onPosted();
      onClose();
    } catch {
      alert("Could not end status. Try again.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-slate-500 text-sm">
            Cancel
          </button>
          <h2 className="font-bold text-slate-800 text-lg">Share Where You Are</h2>
          <button
            onClick={handlePost}
            disabled={posting}
            className="text-indigo-600 font-bold text-sm disabled:opacity-40"
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {[["live", "🟢 Live Now"], ["plan", "📅 Future Plan"]].map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m ? "bg-white shadow text-indigo-600" : "text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Activity type */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Activity</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ACTIVITIES.map(({ type, emoji, label }) => (
              <button
                key={type}
                onClick={() => setActivityType(type)}
                className={`flex flex-col items-center px-3 py-2 rounded-2xl border shrink-0 transition-all ${
                  activityType === type
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "border-slate-200 text-slate-600 hover:border-indigo-300"
                }`}
              >
                <span className="text-xl">{emoji}</span>
                <span className="text-xs font-medium mt-1">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <textarea
          placeholder="Say something… (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={280}
          className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-700 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />

        {/* Location name */}
        <div className="flex items-center border border-slate-200 rounded-xl p-3 gap-2">
          <span>📍</span>
          <input
            type="text"
            placeholder="Location name (optional)"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            className="flex-1 text-sm text-slate-700 focus:outline-none"
          />
        </div>

        {/* Expiry - live mode */}
        {mode === "live" && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">How long?</p>
            <div className="flex gap-2">
              {[["1h", "1 hour"], ["3h", "3 hours"], ["tonight", "Tonight"]].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setExpiry(v)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-all ${
                    expiry === v
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-slate-200 text-slate-600 hover:border-emerald-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date picker - plan mode */}
        {mode === "plan" && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">When?</p>
            <input
              type="datetime-local"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        )}

        {/* Visibility */}
        <div className="flex gap-2">
          {[["friends", "👥 Friends only"], ["public", "🌍 Public"]].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-all ${
                visibility === v
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "border-slate-200 text-slate-600 hover:border-indigo-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* End current status */}
        {myStatus && (
          <button
            onClick={handleEndStatus}
            className="w-full py-2 rounded-xl bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100"
          >
            End Current Status
          </button>
        )}
      </div>
    </div>
  );
}

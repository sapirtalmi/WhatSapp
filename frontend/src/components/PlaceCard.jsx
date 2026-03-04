import { useState } from "react";
import { deletePlace } from "../api/places";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const TYPE_CONFIG = {
  food:     { label: "🍽 Food",     bg: "bg-orange-50",  text: "text-orange-700",  border: "border-l-orange-400" },
  travel:   { label: "✈️ Travel",   bg: "bg-blue-50",    text: "text-blue-700",    border: "border-l-blue-400"   },
  exercise: { label: "🏋 Exercise", bg: "bg-red-50",     text: "text-red-700",     border: "border-l-red-400"    },
  shop:     { label: "🛍 Shop",     bg: "bg-purple-50",  text: "text-purple-700",  border: "border-l-purple-400" },
  hangout:  { label: "☕️ Hangout", bg: "bg-green-50",   text: "text-green-700",   border: "border-l-green-400"  },
};

function getMetaSnippet(type, extra) {
  if (!extra) return null;
  const parts = [];
  if (type === "food") {
    if (extra.price_range) parts.push(extra.price_range);
    if (extra.is_kosher === true) parts.push("Kosher ✓");
    if (extra.recommended_dishes?.length) parts.push(`🍴 ${extra.recommended_dishes.slice(0, 2).join(", ")}`);
  } else if (type === "travel") {
    if (extra.difficulty) parts.push(extra.difficulty);
    if (extra.duration_minutes) parts.push(`${extra.duration_minutes} min`);
    if (extra.trail_length_km) parts.push(`${extra.trail_length_km} km`);
  } else if (type === "exercise") {
    if (extra.subtype) parts.push(extra.subtype.replace(/_/g, " "));
    if (extra.price_type) parts.push(extra.price_type);
    if (extra.price_monthly) parts.push(`₪${extra.price_monthly}/mo`);
  } else if (type === "shop") {
    if (extra.price_range) parts.push(extra.price_range);
    if (extra.shop_type) parts.push(extra.shop_type);
  } else if (type === "hangout") {
    if (extra.price_range) parts.push(extra.price_range);
    if (extra.hangout_type) parts.push(extra.hangout_type);
    if (extra.best_time_to_visit) parts.push(extra.best_time_to_visit);
  }
  return parts.length ? parts.join(" · ") : null;
}

function ExtraDetails({ type, extra }) {
  if (!extra) return null;
  const rows = [];
  const add = (label, value) => {
    if (value != null && value !== "" && !(Array.isArray(value) && !value.length)) {
      rows.push({ label, value: Array.isArray(value) ? value.join(", ") : String(value) });
    }
  };

  if (type === "food") {
    add("Best time", extra.best_time_to_visit);
    add("Kosher", extra.is_kosher != null ? (extra.is_kosher ? "Yes" : "No") : null);
    add("Dishes", extra.recommended_dishes);
    add("Comments", extra.comments);
  } else if (type === "travel") {
    add("Subtype", extra.subtype);
    add("Duration", extra.duration_minutes ? `${extra.duration_minutes} min` : null);
    add("Trail length", extra.trail_length_km ? `${extra.trail_length_km} km` : null);
    add("Equipment", extra.equipment);
    add("Guide required", extra.guide_required != null ? (extra.guide_required ? "Yes" : "No") : null);
    add("Comments", extra.comments);
  } else if (type === "exercise") {
    add("Subtype", extra.subtype?.replace(/_/g, " "));
    add("Pricing", extra.price_type);
    add("Monthly price", extra.price_monthly ? `₪${extra.price_monthly}` : null);
    add("Exercise types", extra.exercise_types);
    add("Showers", extra.has_showers != null ? (extra.has_showers ? "Yes" : "No") : null);
    add("Equipment provided", extra.equipment_provided != null ? (extra.equipment_provided ? "Yes" : "No") : null);
    add("Comments", extra.comments);
  } else if (type === "shop") {
    add("Shop type", extra.shop_type);
    add("Price range", extra.price_range);
    add("Comments", extra.comments);
  } else if (type === "hangout") {
    add("Hangout type", extra.hangout_type);
    add("Best time", extra.best_time_to_visit);
    add("Comments", extra.comments);
  }

  if (!rows.length) return null;
  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-1">
      {rows.map(({ label, value }) => (
        <p key={label} className="text-xs text-gray-600">
          <span className="font-medium text-gray-700">{label}:</span> {value}
        </p>
      ))}
    </div>
  );
}

export default function PlaceCard({ place, collectionId, isOwner, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const photos = place.extra_data?.photos ?? [];
  const typeConfig = place.type ? TYPE_CONFIG[place.type] : null;
  const metaSnippet = getMetaSnippet(place.type, place.extra_data);
  const hasDetails = place.extra_data && Object.entries(place.extra_data).some(([k, v]) =>
    k !== "photos" && v != null && v !== "" && !(Array.isArray(v) && !v.length)
  );

  async function handleDelete() {
    if (!window.confirm(`Delete "${place.name}"?`)) return;
    setDeleting(true);
    try {
      await deletePlace(collectionId, place.id);
      onDeleted(place.id);
    } catch {
      alert("Failed to delete place.");
      setDeleting(false);
    }
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden${typeConfig ? ` border-l-4 ${typeConfig.border}` : ""}`}>
      {/* Photo strip */}
      {photos.length > 0 && (
        <div className="flex gap-0.5 h-24 overflow-hidden">
          {photos.slice(0, 3).map((url, i) => (
            <div key={url} className="relative flex-1 overflow-hidden">
              <img src={`${API_URL}${url}`} alt="" className="h-full w-full object-cover" />
              {i === 2 && photos.length > 3 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm font-bold">
                  +{photos.length - 3}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-gray-900 truncate">{place.name}</p>
              {typeConfig && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeConfig.bg} ${typeConfig.text}`}>
                  {typeConfig.label}
                </span>
              )}
            </div>
            {place.address && <p className="mt-0.5 text-sm text-gray-500 truncate">{place.address}</p>}
            {place.description && <p className="mt-1 text-sm text-gray-400 line-clamp-2">{place.description}</p>}
            {metaSnippet && <p className="mt-1.5 text-xs font-medium text-gray-500">{metaSnippet}</p>}
          </div>

          {isOwner && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete place"
              className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
            >
              ✕
            </button>
          )}
        </div>

        {hasDetails && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-xs text-indigo-600 hover:underline"
          >
            {expanded ? "Show less" : "Show details"}
          </button>
        )}
        {expanded && <ExtraDetails type={place.type} extra={place.extra_data} />}

        <p className="mt-1 text-xs text-gray-300">{place.lat.toFixed(5)}, {place.lng.toFixed(5)}</p>
      </div>
    </div>
  );
}

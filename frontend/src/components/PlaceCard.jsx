import { useState } from "react";
import { deletePlace } from "../api/places";

export default function PlaceCard({ place, collectionId, isOwner, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

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
    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{place.name}</p>
        {place.address && (
          <p className="mt-0.5 text-sm text-gray-500 truncate">{place.address}</p>
        )}
        {place.description && (
          <p className="mt-1 text-sm text-gray-400 line-clamp-2">{place.description}</p>
        )}
        <p className="mt-1 text-xs text-gray-300">
          {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
        </p>
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
  );
}

import { useRef, useState } from "react";
import api from "../api/axios";
import { createPlace } from "../api/places";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const PLACE_TYPES = [
  { value: "food", label: "🍽 Food", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "travel", label: "✈️ Travel", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "exercise", label: "🏋 Exercise", color: "bg-red-100 text-red-700 border-red-300" },
  { value: "shop", label: "🛍 Shop", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "hangout", label: "☕️ Hangout", color: "bg-green-100 text-green-700 border-green-300" },
];

const PRICE_RANGES = ["₪", "₪₪", "₪₪₪", "₪₪₪₪"];

const DEFAULT_EXTRA = {
  food: { photos: [], recommended_dishes: [], best_time_to_visit: "", price_range: null, is_kosher: null, comments: "" },
  travel: { photos: [], subtype: null, duration_minutes: "", difficulty: null, equipment: [], guide_required: null, trail_length_km: "", comments: "" },
  exercise: { photos: [], subtype: null, price_type: null, price_monthly: "", exercise_types: [], has_showers: null, equipment_provided: null, comments: "" },
  shop: { photos: [], shop_type: "", price_range: null, comments: "" },
  hangout: { photos: [], hangout_type: "", price_range: null, best_time_to_visit: "", comments: "" },
};

// ── Reusable field helpers ────────────────────────────────────────────────────

function PillSelector({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const v = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(value === v ? null : v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              value === v
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function PriceRangeField({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {PRICE_RANGES.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(value === p ? null : p)}
          className={`rounded-lg border px-3 py-1 text-xs font-medium transition-all ${
            value === p
              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function ToggleField({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(value === v ? null : v)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
            value === v
              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
          }`}
        >
          {v ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function TagInputField({ tags, onChange, placeholder }) {
  const [input, setInput] = useState("");
  function add() {
    const t = input.trim();
    if (!t) return;
    onChange([...tags, t]);
    setInput("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {tags.map((tag, i) => (
          <span key={i} className="flex items-center gap-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="ml-0.5 leading-none text-indigo-400 hover:text-indigo-700">×</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        placeholder={placeholder ?? "Type and press Enter"}
        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );
}

function PhotosField({ photos, onAdd, onRemove, uploading }) {
  const ref = useRef();
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {photos.map((url) => (
          <div key={url} className="relative h-16 w-16 shrink-0">
            <img src={`${API_URL}${url}`} alt="" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
            <button
              type="button"
              onClick={() => onRemove(url)}
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-xs leading-none"
            >×</button>
          </div>
        ))}
        {photos.length < 5 && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={uploading}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xl text-gray-400 hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-50"
          >
            {uploading ? "…" : "+"}
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={onAdd} />
    </div>
  );
}

// ── Type-specific sections ────────────────────────────────────────────────────

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelCls = "block text-xs font-medium text-gray-600 mb-1";

function FoodSection({ data, onChange, photoProps }) {
  const s = (f, v) => onChange({ ...data, [f]: v });
  return (
    <div className="space-y-3">
      <div><label className={labelCls}>Photos</label><PhotosField {...photoProps} /></div>
      <div><label className={labelCls}>Recommended dishes</label><TagInputField tags={data.recommended_dishes} onChange={(v) => s("recommended_dishes", v)} placeholder="e.g. Hummus — Enter to add" /></div>
      <div><label className={labelCls}>Best time to visit</label><input value={data.best_time_to_visit} onChange={(e) => s("best_time_to_visit", e.target.value)} placeholder="e.g. Saturday brunch" className={inputCls} /></div>
      <div><label className={labelCls}>Price range</label><PriceRangeField value={data.price_range} onChange={(v) => s("price_range", v)} /></div>
      <div><label className={labelCls}>Kosher?</label><ToggleField value={data.is_kosher} onChange={(v) => s("is_kosher", v)} /></div>
      <div><label className={labelCls}>Comments</label><textarea value={data.comments} onChange={(e) => s("comments", e.target.value)} rows={2} placeholder="Any notes…" className={inputCls} /></div>
    </div>
  );
}

function TravelSection({ data, onChange, photoProps }) {
  const s = (f, v) => onChange({ ...data, [f]: v });
  return (
    <div className="space-y-3">
      <div><label className={labelCls}>Photos</label><PhotosField {...photoProps} /></div>
      <div><label className={labelCls}>Subtype</label><PillSelector options={["hike", "viewpoint", "picnic", "beach", "waterfall", "landmark"]} value={data.subtype} onChange={(v) => s("subtype", v)} /></div>
      <div className="flex gap-3">
        <div className="flex-1"><label className={labelCls}>Duration (min)</label><input type="number" min="0" value={data.duration_minutes} onChange={(e) => s("duration_minutes", e.target.value)} placeholder="90" className={inputCls} /></div>
        <div className="flex-1"><label className={labelCls}>Trail length (km)</label><input type="number" min="0" step="0.1" value={data.trail_length_km} onChange={(e) => s("trail_length_km", e.target.value)} placeholder="5.2" className={inputCls} /></div>
      </div>
      <div><label className={labelCls}>Difficulty</label><PillSelector options={["easy", "moderate", "hard", "extreme"]} value={data.difficulty} onChange={(v) => s("difficulty", v)} /></div>
      <div><label className={labelCls}>Equipment</label><TagInputField tags={data.equipment} onChange={(v) => s("equipment", v)} placeholder="e.g. hiking boots — Enter to add" /></div>
      <div><label className={labelCls}>Guide required?</label><ToggleField value={data.guide_required} onChange={(v) => s("guide_required", v)} /></div>
      <div><label className={labelCls}>Comments</label><textarea value={data.comments} onChange={(e) => s("comments", e.target.value)} rows={2} placeholder="Any notes…" className={inputCls} /></div>
    </div>
  );
}

function ExerciseSection({ data, onChange, photoProps }) {
  const s = (f, v) => onChange({ ...data, [f]: v });
  return (
    <div className="space-y-3">
      <div><label className={labelCls}>Photos</label><PhotosField {...photoProps} /></div>
      <div><label className={labelCls}>Subtype</label><PillSelector options={["gym", "outdoor", "pool", "yoga_studio", "crossfit", "sports_court", "martial_arts"]} value={data.subtype} onChange={(v) => s("subtype", v)} /></div>
      <div><label className={labelCls}>Pricing</label><PillSelector options={["free", "paid", "membership"]} value={data.price_type} onChange={(v) => s("price_type", v)} /></div>
      {(data.price_type === "paid" || data.price_type === "membership") && (
        <div><label className={labelCls}>Monthly price (₪)</label><input type="number" min="0" value={data.price_monthly} onChange={(e) => s("price_monthly", e.target.value)} placeholder="200" className={inputCls} /></div>
      )}
      <div><label className={labelCls}>Exercise types</label><TagInputField tags={data.exercise_types} onChange={(v) => s("exercise_types", v)} placeholder="e.g. yoga — Enter to add" /></div>
      <div className="flex gap-6">
        <div><label className={labelCls}>Showers?</label><ToggleField value={data.has_showers} onChange={(v) => s("has_showers", v)} /></div>
        <div><label className={labelCls}>Equipment provided?</label><ToggleField value={data.equipment_provided} onChange={(v) => s("equipment_provided", v)} /></div>
      </div>
      <div><label className={labelCls}>Comments</label><textarea value={data.comments} onChange={(e) => s("comments", e.target.value)} rows={2} placeholder="Any notes…" className={inputCls} /></div>
    </div>
  );
}

function ShopSection({ data, onChange, photoProps }) {
  const s = (f, v) => onChange({ ...data, [f]: v });
  return (
    <div className="space-y-3">
      <div><label className={labelCls}>Photos</label><PhotosField {...photoProps} /></div>
      <div><label className={labelCls}>Shop type</label><input value={data.shop_type} onChange={(e) => s("shop_type", e.target.value)} placeholder="e.g. clothing, electronics" className={inputCls} /></div>
      <div><label className={labelCls}>Price range</label><PriceRangeField value={data.price_range} onChange={(v) => s("price_range", v)} /></div>
      <div><label className={labelCls}>Comments</label><textarea value={data.comments} onChange={(e) => s("comments", e.target.value)} rows={2} placeholder="Any notes…" className={inputCls} /></div>
    </div>
  );
}

function HangoutSection({ data, onChange, photoProps }) {
  const s = (f, v) => onChange({ ...data, [f]: v });
  return (
    <div className="space-y-3">
      <div><label className={labelCls}>Photos</label><PhotosField {...photoProps} /></div>
      <div><label className={labelCls}>Hangout type</label><input value={data.hangout_type} onChange={(e) => s("hangout_type", e.target.value)} placeholder="e.g. park, rooftop bar" className={inputCls} /></div>
      <div><label className={labelCls}>Price range</label><PriceRangeField value={data.price_range} onChange={(v) => s("price_range", v)} /></div>
      <div><label className={labelCls}>Best time to visit</label><input value={data.best_time_to_visit} onChange={(e) => s("best_time_to_visit", e.target.value)} placeholder="e.g. Saturday evening" className={inputCls} /></div>
      <div><label className={labelCls}>Comments</label><textarea value={data.comments} onChange={(e) => s("comments", e.target.value)} rows={2} placeholder="Any notes…" className={inputCls} /></div>
    </div>
  );
}

const TYPE_SECTION = { food: FoodSection, travel: TravelSection, exercise: ExerciseSection, shop: ShopSection, hangout: HangoutSection };

// ── Main component ────────────────────────────────────────────────────────────

export default function AddPlaceModal({ collectionId, onClose, onAdded, initialLat, initialLng }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    address: "",
    lat: initialLat != null ? String(initialLat.toFixed(6)) : "",
    lng: initialLng != null ? String(initialLng.toFixed(6)) : "",
    google_place_id: "",
  });
  const [type, setType] = useState(null);
  const [extraData, setExtraData] = useState({});
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleTypeChange(newType) {
    if (newType === type) {
      setType(null);
      setExtraData({});
    } else {
      setType(newType);
      setExtraData({ ...(DEFAULT_EXTRA[newType] ?? {}) });
    }
  }

  async function handlePhotoAdd(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingPhotos(true);
    const urls = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await api.post("/uploads/photo", fd);
        urls.push(res.data.url);
      } catch {
        setError("Failed to upload a photo.");
      }
    }
    setExtraData((prev) => ({ ...prev, photos: [...(prev.photos ?? []), ...urls] }));
    setUploadingPhotos(false);
    e.target.value = "";
  }

  function handlePhotoRemove(url) {
    setExtraData((prev) => ({ ...prev, photos: (prev.photos ?? []).filter((u) => u !== url) }));
  }

  function buildExtraData() {
    if (!type) return null;
    const ed = { ...extraData };
    if ("duration_minutes" in ed) ed.duration_minutes = ed.duration_minutes !== "" ? (parseInt(ed.duration_minutes) || null) : null;
    if ("trail_length_km" in ed) ed.trail_length_km = ed.trail_length_km !== "" ? (parseFloat(ed.trail_length_km) || null) : null;
    if ("price_monthly" in ed) ed.price_monthly = ed.price_monthly !== "" ? (parseFloat(ed.price_monthly) || null) : null;
    for (const k of ["best_time_to_visit", "comments", "shop_type", "hangout_type"]) {
      if (k in ed && ed[k] === "") ed[k] = null;
    }
    return ed;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const place = await createPlace(collectionId, {
        name: form.name,
        description: form.description || null,
        address: form.address || null,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        google_place_id: form.google_place_id || null,
        type: type || null,
        extra_data: buildExtraData(),
      });
      onAdded(place);
    } catch (err) {
      setError(err.response?.data?.detail ?? "Failed to add place.");
    } finally {
      setLoading(false);
    }
  }

  const TypeSection = type ? TYPE_SECTION[type] : null;
  const photoProps = { photos: extraData.photos ?? [], onAdd: handlePhotoAdd, onRemove: handlePhotoRemove, uploading: uploadingPhotos };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex w-full max-w-md max-h-[90vh] flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Add a place</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 pb-6 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input
              name="name" value={form.name} onChange={handleChange} required
              placeholder="e.g. Cafe Dizengoff"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <input
              name="address" value={form.address} onChange={handleChange}
              placeholder="e.g. 50 Dizengoff St, Tel Aviv"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Latitude *</label>
              <input
                name="lat" value={form.lat} onChange={handleChange}
                type="number" step="any" required min="-90" max="90"
                placeholder="32.0853"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Longitude *</label>
              <input
                name="lng" value={form.lng} onChange={handleChange}
                type="number" step="any" required min="-180" max="180"
                placeholder="34.7818"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {PLACE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTypeChange(t.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    type === t.value ? t.color : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              name="description" value={form.description} onChange={handleChange} rows={2}
              placeholder="Optional notes about this place…"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {TypeSection && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-700">
                {PLACE_TYPES.find((t) => t.value === type)?.label} details
              </p>
              <TypeSection data={extraData} onChange={setExtraData} photoProps={photoProps} />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {loading ? "Adding…" : "Add place"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

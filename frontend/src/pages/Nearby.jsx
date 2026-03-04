import { useState } from "react";
import { getNearbyPlaces } from "../api/places";
import MapView from "../components/MapView";

export default function Nearby() {
  const [places, setPlaces] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [radius, setRadius] = useState(2000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    setError("");
    setLoading(true);
    try {
      const position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      const { latitude: lat, longitude: lng } = position.coords;
      setUserLocation({ lat, lng });
      const results = await getNearbyPlaces(lat, lng, radius);
      setPlaces(results);
      setSearched(true);
    } catch (err) {
      if (err.code === 1) {
        setError("Location access denied. Please allow location in your browser.");
      } else {
        setError("Failed to fetch nearby places.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Nearby Places</h1>

        {/* Controls */}
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700">Radius</label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value={500}>500 m</option>
              <option value={1000}>1 km</option>
              <option value={2000}>2 km</option>
              <option value={5000}>5 km</option>
              <option value={10000}>10 km</option>
            </select>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Locating…" : "Find near me"}
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        {/* Map */}
        {searched && (
          <>
            <MapView places={places} center={userLocation} height="400px" />

            <div className="mt-4 text-sm text-gray-500">
              {places.length === 0
                ? "No public places found within this radius."
                : `${places.length} place${places.length !== 1 ? "s" : ""} found`}
            </div>

            {/* Place list */}
            {places.length > 0 && (
              <div className="mt-4 space-y-3">
                {places.map((place) => (
                  <div key={place.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="font-medium text-gray-900">{place.name}</p>
                    {place.address && <p className="mt-0.5 text-sm text-gray-500">{place.address}</p>}
                    {place.description && <p className="mt-1 text-sm text-gray-400">{place.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!searched && !loading && (
          <div className="mt-20 text-center text-gray-400">
            <p className="text-lg">Discover places around you</p>
            <p className="mt-1 text-sm">Hit "Find near me" to search public collections nearby.</p>
          </div>
        )}
      </div>
    </div>
  );
}

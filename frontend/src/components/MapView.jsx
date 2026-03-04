import { useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";

const MAP_LIBRARIES = ["places"];
const MAP_STYLE = { width: "100%", height: "100%" };
const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 }; // Tel Aviv

const TYPE_COLORS = {
  food: "#f97316",
  travel: "#3b82f6",
  shop: "#a855f7",
  hangout: "#22c55e",
};

function getMarkerIcon(color) {
  return {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#fff",
    strokeWeight: 1.5,
    scale: 1.6,
    anchor: { x: 12, y: 22 },
  };
}

/**
 * MapView — renders a Google Map with markers for each place.
 *
 * Props:
 *   places        — array of PlaceOut objects
 *   center        — optional { lat, lng }
 *   height        — CSS height string, default "400px"
 *   onMarkerClick — optional callback(place)
 *   onMapClick    — optional callback(lat, lng) when map background is clicked
 *   markerColor   — optional function(place) => hex color string
 */
export default function MapView({
  places = [],
  center,
  height = "400px",
  onMarkerClick,
  onMapClick,
  markerColor,
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "",
    libraries: MAP_LIBRARIES,
  });

  const [selected, setSelected] = useState(null);

  const onLoad = useCallback(() => {}, []);
  const onUnmount = useCallback(() => {}, []);

  function handleMarkerClick(place) {
    setSelected(place);
    onMarkerClick?.(place);
  }

  function handleMapClick(e) {
    if (!onMapClick) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    onMapClick(lat, lng);
  }

  function getColor(place) {
    if (markerColor) return markerColor(place);
    return TYPE_COLORS[place.type] ?? "#4f46e5";
  }

  const mapCenter =
    center ??
    (places.length > 0 ? { lat: places[0].lat, lng: places[0].lng } : DEFAULT_CENTER);

  if (loadError) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-red-50 text-sm text-red-500"
        style={{ height }}
      >
        Failed to load Google Maps. Check your API key.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400"
        style={{ height }}
      >
        Loading map…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl shadow-md" style={{ height }}>
      <GoogleMap
        mapContainerStyle={MAP_STYLE}
        center={mapCenter}
        zoom={places.length > 0 ? 13 : 12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          cursor: onMapClick ? "crosshair" : undefined,
        }}
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            position={{ lat: place.lat, lng: place.lng }}
            title={place.name}
            icon={getMarkerIcon(getColor(place))}
            onClick={() => handleMarkerClick(place)}
          />
        ))}

        {selected && (
          <InfoWindow
            position={{ lat: selected.lat, lng: selected.lng }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="max-w-xs p-1">
              <p className="font-semibold text-gray-900">{selected.name}</p>
              {selected.address && (
                <p className="mt-0.5 text-sm text-gray-500">{selected.address}</p>
              )}
              {selected.description && (
                <p className="mt-1 text-sm text-gray-400">{selected.description}</p>
              )}
              {selected.collection_title && (
                <p className="mt-1 text-xs text-indigo-500">📚 {selected.collection_title}</p>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

import { useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";

const MAP_LIBRARIES = ["places"];

const MAP_STYLE = { width: "100%", height: "100%" };

const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 }; // Tel Aviv

/**
 * MapView — renders a Google Map with markers for each place.
 *
 * Props:
 *   places      — array of PlaceOut objects ({ id, name, address, lat, lng, ... })
 *   center      — optional { lat, lng } to override default center
 *   height      — CSS height string, default "400px"
 *   onMarkerClick — optional callback(place) when a marker is clicked
 */
export default function MapView({ places = [], center, height = "400px", onMarkerClick }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "",
    libraries: MAP_LIBRARIES,
  });

  const [selected, setSelected] = useState(null);
  const [map, setMap] = useState(null);

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  function handleMarkerClick(place) {
    setSelected(place);
    onMarkerClick?.(place);
  }

  // Compute map center: explicit prop > first place > default
  const mapCenter =
    center ??
    (places.length > 0 ? { lat: places[0].lat, lng: places[0].lng } : DEFAULT_CENTER);

  if (loadError) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-red-50 text-sm text-red-500" style={{ height }}>
        Failed to load Google Maps. Check your API key.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400" style={{ height }}>
        Loading map…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl" style={{ height }}>
      <GoogleMap
        mapContainerStyle={MAP_STYLE}
        center={mapCenter}
        zoom={places.length > 0 ? 13 : 12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            position={{ lat: place.lat, lng: place.lng }}
            title={place.name}
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
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

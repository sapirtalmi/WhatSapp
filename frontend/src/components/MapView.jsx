import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix Leaflet's broken default icon paths when bundled with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 };

const TYPE_COLORS = {
  food: "#f97316",
  travel: "#3b82f6",
  shop: "#a855f7",
  hangout: "#22c55e",
  exercise: "#ef4444",
};

function coloredMarker(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function CenterUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], map.getZoom(), { animate: true, duration: 0.8 });
    }
  }, [center, map]);
  return null;
}

/**
 * MapView — renders a Leaflet/OpenStreetMap map with markers for each place.
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
  function getColor(place) {
    if (markerColor) return markerColor(place);
    return TYPE_COLORS[place.type] ?? "#4f46e5";
  }

  const initialCenter =
    center ??
    (places.length > 0 ? { lat: places[0].lat, lng: places[0].lng } : DEFAULT_CENTER);

  return (
    <div className="overflow-hidden rounded-xl shadow-md" style={{ height }}>
      <MapContainer
        center={[initialCenter.lat, initialCenter.lng]}
        zoom={places.length > 0 ? 13 : 12}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {center && <CenterUpdater center={center} />}
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={coloredMarker(getColor(place))}
            eventHandlers={{ click: () => onMarkerClick?.(place) }}
          >
            <Popup>
              <div className="max-w-xs">
                <p className="font-semibold text-gray-900">{place.name}</p>
                {place.address && (
                  <p className="mt-0.5 text-sm text-gray-500">{place.address}</p>
                )}
                {place.description && (
                  <p className="mt-1 text-sm text-gray-400">{place.description}</p>
                )}
                {place.collection_title && (
                  <a
                    href={`/collections/${place.collection_id}`}
                    className="mt-1 block text-xs text-indigo-500 hover:underline"
                  >
                    📚 {place.collection_title}
                    {place.owner_username && ` · by ${place.owner_username}`}
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

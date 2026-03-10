# Frontend Dev Agent Memory

## Project Structure
- Frontend at `/Users/Sapir/WhatSapp/WhatSapp/frontend/src/`
- API clients: `src/api/` — one file per domain (axios.js, collections.js, friends.js, places.js, users.js, status.js)
- Components: `src/components/` — AddPlaceModal, CollectionModal, MapView, PlaceCard, ProtectedRoute, PostStatusModal
- Pages: `src/pages/` — Explore, Profile, Collections

## Map: react-leaflet (NOT @react-google-maps/api)
- Uses react-leaflet + OpenStreetMap, NOT Google Maps
- `L` from `"leaflet"` is already imported in Explore.jsx — use `L.divIcon` for custom markers
- Always fix default icon at module level: `delete L.Icon.Default.prototype._getIconUrl` then `L.Icon.Default.mergeOptions(...)`
- Custom CSS for map markers (animations etc.) — inject via `document.createElement("style")` in a `useEffect` with cleanup

## Explore.jsx Patterns
- Full-screen map page: `h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden`
- Overlay UI uses `absolute` + `z-[1000]` (map is in normal flow, overlays above)
- Status info card uses `fixed bottom-8 left-1/2 -translate-x-1/2 z-[999]` (below modals at z-1000)
- Status markers rendered as `<Marker>` inside `<MapContainer>` with no `<Popup>` — click handler sets `selectedStatus` state, card is rendered outside the map as a fixed overlay

## Modal Pattern (PostStatusModal / AddPlaceModal)
- Backdrop: `fixed inset-0 z-[1000] flex items-end justify-center bg-black/40`; click closes
- Sheet: `bg-white rounded-t-3xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto`; stopPropagation
- Header row: Cancel (left, plain text) | Title (center, bold) | Post/Save (right, colored bold)

## Status Feature (added 2026-03-10)
- API: `src/api/status.js` — createStatus, getStatusFeed, getMyStatus, updateStatus, deleteStatus, rsvpStatus
- PostStatusModal: bottom-sheet modal, mode (live/plan), activity type pills, message, location name, expiry, visibility
- Explore: polls `getStatusFeed()` + `getMyStatus()` every 30s; live = green pulsing marker, plan = violet pulsing marker; click shows fixed info card with RSVP for plan statuses
- Profile: loads `getMyStatus()` on mount; shows colored banner with "End" button if active status exists

## Polling Pattern
```js
const load = useCallback(async () => { ... }, [deps]);
useEffect(() => {
  load();
  const id = setInterval(load, 30000);
  return () => clearInterval(id);
}, [load]);
```

## API Conventions
- All API functions: `api.METHOD(url, ...).then(r => r.data)`
- Use the axios instance from `"../api/axios"` — never raw fetch or new axios
- No hardcoded URLs; backend base URL comes from the axios instance config

## Tailwind Conventions
- Indigo-600 = primary action color
- Emerald-500 = live/active states
- Violet-500 = planned/future states
- Slate-* = text in overlays/modals
- `z-[1000]` for overlays over map, `z-[999]` for info cards, `z-[2000]` for dropdowns above overlays

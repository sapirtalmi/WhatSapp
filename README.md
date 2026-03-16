# WhatSapp

### *Your world, mapped. Collect spots, share vibes, explore together.*

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![Expo SDK](https://img.shields.io/badge/Expo_SDK-54-000020?logo=expo&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

WhatSapp is a cross-platform social map application where users build curated collections of places, share them with friends, and broadcast their real-time location and activity. The backend is deployed on GCP Cloud Run with a PostGIS-powered PostgreSQL database, the mobile app runs on iOS and Android via Expo, and the web app runs in any browser.

---

## Features

- **Map Collections** — Create, edit, and share curated collections of places with titles, descriptions, and privacy controls
- **Rich Place Metadata** — Tag places by category (food, travel, shop, hangout, exercise) with type-specific fields: price range, dietary flags, dish tags, trail difficulty, and photo galleries
- **Interactive Maps** — Color-coded category markers on both mobile (react-native-maps) and web (Leaflet)
- **PostGIS Geospatial Queries** — Nearby radius search and bounding-box filtering powered by PostGIS
- **Social Feed** — Personalized feed of your own + friends' public places, paginated and filterable by type
- **Friends System** — Send, accept, reject, and block friend requests; browse friends' public collections
- **"Where Am I" Social Status** — Broadcast your current activity (live mode) or announce a future plan to friends; pulsing animated markers appear on the map in real time
- **RSVP to Plans** — Friends can respond Going / Maybe / No to future plan statuses
- **Save Collections** — Bookmark any public collection to revisit later
- **Photo Uploads** — Attach JPEG, PNG, WebP, or GIF images (max 5 MB) to any place
- **AI-Powered Features** (Google Gemini Flash)
  - Location info cards — description, best time to visit, tips
  - Auto-generated collection descriptions
  - Natural language place search with visible-area filter
  - Photo analysis to suggest place type and name
  - Personalized place recommendations based on your history
  - Full AI travel guide generation for any collection
- **JWT Authentication** — Register, login, 30-day token expiry with auto-logout on 401
- **Cross-Platform** — iOS + Android (Expo) and web (React + Vite) sharing the same REST API
- **Cloud Deployed** — Backend on GCP Cloud Run, database on GCP Cloud SQL (PostgreSQL 15 + PostGIS)

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Mobile | React Native + Expo SDK 54 + Expo Router 3 | iOS & Android app |
| Web | React 18 + Vite + React Router v6 + Tailwind CSS | Browser app |
| Maps (Web) | Leaflet | Interactive map with custom markers |
| Maps (Mobile) | react-native-maps | Native map component |
| Backend | FastAPI + Uvicorn | REST API server |
| ORM | SQLAlchemy 2 + Alembic | Database models & migrations |
| Database | PostgreSQL 15 + PostGIS 3.3 | Relational + geospatial data |
| Geospatial | GeoAlchemy2 + Shapely | PostGIS column types and geometry ops |
| Auth | python-jose + passlib + bcrypt | JWT tokens & password hashing |
| AI | Google Gemini Flash (`google-genai`) | Generative AI features |
| HTTP Client | Axios (with JWT interceptor) | Web & mobile API calls |
| Cloud | GCP Cloud Run + Cloud SQL + Artifact Registry | Production hosting |

---

## Project Structure

```
WhatSapp/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── models/             # SQLAlchemy models (User, Place, Collection, Status, etc.)
│   │   ├── routers/            # API route handlers — one file per domain
│   │   ├── auth/               # JWT security helpers
│   │   ├── config.py           # Pydantic settings (reads .env)
│   │   └── database.py         # SQLAlchemy engine + get_db() dependency
│   ├── alembic/                # Database migration scripts
│   ├── uploads/                # Uploaded photos served as static files
│   ├── main.py                 # FastAPI app entry point, CORS, router registration
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Container definition for Cloud Run
│   └── cloudbuild.yaml         # GCP Cloud Build config
│
├── frontend/                   # React web app
│   ├── src/
│   │   ├── api/                # Axios clients — one file per domain
│   │   ├── components/         # Reusable UI (modals, cards, map, status)
│   │   ├── context/            # AuthContext (JWT + user state)
│   │   └── pages/              # Route-level page components
│   └── index.html
│
├── mobile/                     # Expo React Native app
│   ├── app/
│   │   ├── (tabs)/             # Tab screens: Map, Explore, Collections, Friends, Profile
│   │   ├── collection/[id].jsx # Collection detail + place management
│   │   ├── login.jsx
│   │   └── register.jsx
│   ├── src/
│   │   ├── api/                # Axios clients (mirrors frontend/src/api/)
│   │   └── context/            # AuthContext
│   └── .env                    # EXPO_PUBLIC_API_URL
│
└── docker-compose.yml          # Local PostGIS database (development)
```

---

## Getting Started

### Prerequisites

- **Python 3.12+**
- **Node.js 20+**
- **PostgreSQL 15 with PostGIS** — via [Postgres.app](https://postgresapp.com) (macOS) or Docker
- **Expo Go** app installed on your phone

### 1. Clone the repo

```bash
git clone https://github.com/sapirtalmi/WhatSapp.git
cd WhatSapp
```

### 2. Start the database

**Option A — Postgres.app (macOS):**
```bash
psql -c "CREATE DATABASE whatsapp;"
psql -d whatsapp -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

**Option B — Docker:**
```bash
docker-compose up -d
```

### 3. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env           # fill in your values (see table below)

alembic upgrade head

uvicorn main:app --reload --host 0.0.0.0
```

API available at `http://localhost:8000` — interactive docs at `/docs`.

### 4. Mobile setup

```bash
cd mobile
npm install

# Find your local IP:  ipconfig getifaddr en0  (macOS)
echo "EXPO_PUBLIC_API_URL=http://<your-local-ip>:8000" > .env

npx expo start --lan --clear
```

Scan the QR code with **Expo Go** on your phone.

### 5. Web setup

```bash
cd frontend
npm install
cp .env.example .env           # set VITE_API_URL and VITE_GOOGLE_MAPS_API_KEY
npm run dev
```

Web app at `http://localhost:5173`.

---

### Environment Variables

**`backend/.env`**

| Variable | Example | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/whatsapp` | PostgreSQL connection string |
| `SECRET_KEY` | `any-long-random-string` | Secret used to sign JWTs |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `43200` | Token lifetime (43200 = 30 days) |
| `GEMINI_API_KEY` | `AIza...` | Google Gemini API key — get one at [aistudio.google.com](https://aistudio.google.com) |

**`mobile/.env`**

| Variable | Example | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://192.168.1.10:8000` | Backend base URL (use cloud URL in production) |

**`frontend/.env`**

| Variable | Example | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend base URL |
| `VITE_GOOGLE_MAPS_API_KEY` | `AIza...` | Google Maps JavaScript API key |

---

## API Documentation

### Auth — `/auth`

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and receive a JWT access token |

### Users — `/users`

| Method | Path | Description |
|---|---|---|
| GET | `/users/me` | Get the current user's profile |
| PATCH | `/users/me` | Update profile (avatar, bio, age, hobbies, work, etc.) |
| GET | `/users/search?q=` | Search users by username (excludes existing friends) |
| GET | `/users/{id}/profile` | Get a user's public profile and collections |

### Collections — `/collections`

| Method | Path | Description |
|---|---|---|
| POST | `/collections` | Create a new collection |
| GET | `/collections` | List collections (own + public, with search & sort) |
| GET | `/collections/{id}` | Get a single collection |
| PATCH | `/collections/{id}` | Update a collection (owner only) |
| DELETE | `/collections/{id}` | Delete a collection (owner only) |
| POST | `/collections/{id}/save` | Save another user's collection |
| DELETE | `/collections/{id}/save` | Unsave a collection |
| GET | `/collections/saved` | List all saved collections |

### Places

| Method | Path | Description |
|---|---|---|
| POST | `/collections/{id}/places` | Add a place to a collection |
| GET | `/collections/{id}/places` | List all places in a collection |
| PATCH | `/collections/{id}/places/{pid}` | Update a place |
| DELETE | `/collections/{id}/places/{pid}` | Delete a place |
| GET | `/places` | Global search (keyword, type, owner, source filters) |
| GET | `/places/nearby` | Places within a radius of a lat/lng coordinate |
| GET | `/places/bbox` | Places within a lat/lng bounding box |

### Friends — `/friends`

| Method | Path | Description |
|---|---|---|
| POST | `/friends/request/{id}` | Send a friend request |
| PUT | `/friends/{id}/accept` | Accept an incoming request |
| PUT | `/friends/{id}/reject` | Reject and delete an incoming request |
| PUT | `/friends/{id}/block` | Block a user |
| DELETE | `/friends/{id}` | Remove a friend |
| GET | `/friends` | List all accepted friends |
| GET | `/friends/pending` | List incoming pending requests |

### Feed — `/feed`

| Method | Path | Description |
|---|---|---|
| GET | `/feed` | Paginated feed of own + friends' public places |

### Social Status — `/status`

| Method | Path | Description |
|---|---|---|
| POST | `/status` | Create or replace your active status (live or plan mode) |
| GET | `/status/feed` | All visible statuses (own + friends' + public) |
| GET | `/status/my` | Your own active status, or null |
| PATCH | `/status/{id}` | Deactivate or update a status |
| DELETE | `/status/{id}` | Delete a status |
| POST | `/status/{id}/rsvp` | RSVP to a plan — going / maybe / no |
| GET | `/status/{id}/rsvp` | List all RSVPs for a status |

### Uploads — `/uploads`

| Method | Path | Description |
|---|---|---|
| POST | `/uploads/photo` | Upload a photo (JPEG/PNG/WebP/GIF, max 5 MB) |

### AI — `/ai`

| Method | Path | Description |
|---|---|---|
| POST | `/ai/location-info` | Description, best time, and tips for a location |
| POST | `/ai/collection-description` | Auto-generate a collection description |
| POST | `/ai/natural-search` | Search places using natural language + optional map bbox |
| POST | `/ai/analyze-photo` | Analyze an uploaded photo — suggests type and name |
| POST | `/ai/recommendations` | Personalized place recommendations from your history |
| POST | `/ai/travel-guide` | Generate a full travel guide for a collection |

---

## Screenshots


---

## Deployment

### Backend — GCP Cloud Run

The backend is containerized and deployed to GCP Cloud Run backed by a Cloud SQL managed PostgreSQL + PostGIS instance.

**Rebuild and redeploy after code changes:**

```bash
source ~/google-cloud-sdk/path.zsh.inc
cd backend

# Build image remotely via Cloud Build (no local Docker needed)
gcloud builds submit --config=cloudbuild.yaml --project=<PROJECT_ID> .

# Deploy new revision to Cloud Run
gcloud run deploy whatsapp-api \
  --image=us-central1-docker.pkg.dev/<PROJECT_ID>/whatsapp-backend/api:latest \
  --region=us-central1 \
  --project=<PROJECT_ID>
```

**Live API:** `https://whatsapp-api-20550374195.us-central1.run.app`

### Mobile — Expo EAS Build

```bash
npm install -g eas-cli
eas login
eas build --platform all
```

Update `mobile/.env` to point `EXPO_PUBLIC_API_URL` at the Cloud Run URL before building.

### Web — Vercel / Netlify

```bash
cd frontend
npm run build
# Deploy the dist/ folder to Vercel, Netlify, or any static host
```

---

## Author

**Sapir Talmi**
GitHub: [github.com/sapirtalmi](https://github.com/sapirtalmi)

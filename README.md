# WhatSapp

A social map platform where users can create and share curated map collections — restaurants, hidden gems, travel routes, and more.

## Project Structure

```
WhatSapp/
├── frontend/       # React + Vite + Tailwind CSS
├── backend/        # Python FastAPI + PostgreSQL/PostGIS
└── docker-compose.yml
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose

### 1. Start the database

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # fill in your values
alembic upgrade head

uvicorn main:app --reload
```

API docs available at `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install

cp .env.example .env.local      # fill in your values
npm run dev
```

App available at `http://localhost:5173`.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6, Tailwind CSS, Axios |
| Backend | FastAPI, SQLAlchemy, Alembic, python-jose, passlib |
| Database | PostgreSQL 15 + PostGIS |
| Maps | Google Maps JavaScript API |

## Core Models

- **User** – accounts & authentication
- **MapCollection** – a named, shareable collection of places
- **Place** – a geolocated point of interest (PostGIS geometry)
- **Friendship** – follower/friend graph between users

import { useState } from "react";
import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Collections from "./pages/Collections";
import CollectionDetail from "./pages/CollectionDetail";
import Nearby from "./pages/Nearby";
import Friends from "./pages/Friends";
import Explore from "./pages/Explore";
import Profile from "./pages/Profile";

const NAV = [
  { to: "/explore", label: "Explore", icon: "🧭" },
  { to: "/collections", label: "Collections", icon: "📚" },
  { to: "/nearby", label: "Nearby", icon: "📍" },
  { to: "/friends", label: "Friends", icon: "👥" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <>
      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col text-white transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
                 style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
              🗺
            </div>
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
              WhatSapp
            </span>
          </div>
          <div className="mt-3 h-px w-full" style={{ background: "linear-gradient(90deg, transparent, #6366f1, transparent)" }} />
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all border-l-2 ${
                  isActive
                    ? "bg-white/10 border-indigo-400 text-white backdrop-blur-sm"
                    : "border-transparent text-slate-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 px-4 py-4">
          <NavLink
            to="/profile"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white/5 transition-all group"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-indigo-500/40"
                 style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
              {user?.username?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate text-white">{user?.username}</p>
              <p className="text-[10px] text-slate-400 group-hover:text-indigo-300 transition-colors">View profile</p>
            </div>
          </NavLink>
          <button
            onClick={handleLogout}
            className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-white/10 hover:text-white transition-all"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile top bar */}
      <header className="fixed top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 py-3 md:hidden"
              style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}>
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          ☰
        </button>
        <span className="font-extrabold text-white tracking-tight">WhatSapp</span>
      </header>

      {/* Main content — offset for sidebar on desktop, top bar on mobile */}
      <main className="pt-14 md:pt-0 md:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to="/explore" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/explore"
        element={
          <ProtectedRoute>
            <Layout><Explore /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/collections"
        element={
          <ProtectedRoute>
            <Layout><Collections /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/collections/:id"
        element={
          <ProtectedRoute>
            <Layout><CollectionDetail /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/nearby"
        element={
          <ProtectedRoute>
            <Layout><Nearby /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/friends"
        element={
          <ProtectedRoute>
            <Layout><Friends /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout><Profile /></Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/explore" replace />} />
    </Routes>
  );
}

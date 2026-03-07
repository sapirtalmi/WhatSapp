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
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900 text-white transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-700">
          <span className="text-xl">🗺</span>
          <span className="text-lg font-bold tracking-tight">WhatSapp</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-700 px-4 py-4">
          <NavLink
            to="/profile"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-800 transition-colors group"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold text-white">
              {user?.username?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate text-white">{user?.username}</p>
              <p className="text-[10px] text-slate-400">View profile</p>
            </div>
          </NavLink>
          <button
            onClick={handleLogout}
            className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
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
      <header className="fixed top-0 left-0 right-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
        >
          ☰
        </button>
        <span className="font-bold text-slate-800">WhatSapp</span>
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

import { Routes, Route, Navigate, Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Collections from "./pages/Collections";
import CollectionDetail from "./pages/CollectionDetail";
import Nearby from "./pages/Nearby";
import Friends from "./pages/Friends";
import Feed from "./pages/Feed";

function Home() {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
      <h1 className="text-4xl font-bold text-gray-800">WhatSapp</h1>
      <p className="text-gray-500">Welcome, {user?.username}!</p>
      <Link to="/feed" className="w-48 rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-700">
        Feed
      </Link>
      <Link to="/collections" className="w-48 rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700">
        My Collections
      </Link>
      <Link to="/nearby" className="w-48 rounded-lg bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-green-700">
        Nearby Places
      </Link>
      <Link to="/friends" className="w-48 rounded-lg bg-purple-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-purple-700">
        Friends
      </Link>
      <button onClick={logout} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100">
        Sign out
      </button>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
      <Route path="/collections" element={<ProtectedRoute><Collections /></ProtectedRoute>} />
      <Route path="/collections/:id" element={<ProtectedRoute><CollectionDetail /></ProtectedRoute>} />
      <Route path="/nearby" element={<ProtectedRoute><Nearby /></ProtectedRoute>} />
      <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

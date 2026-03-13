import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <Router>
      <Toaster position="top-right" reverseOrder={false} />
      <div className="min-h-screen bg-[#05070a]">
        <Routes>
          <Route
            path="/login"
            element={
              isLoggedIn ?
                <Navigate to="/citizen-dashboard" />
              : <Login onLoginSuccess={() => setIsLoggedIn(true)} />
            }
          />
          <Route
            path="/citizen-dashboard"
            element={
              isLoggedIn ?
                <Dashboard onLogout={() => setIsLoggedIn(false)} />
              : <Navigate to="/login" />
            }
          />
          <Route
            path="/"
            element={
              <Navigate to={isLoggedIn ? "/citizen-dashboard" : "/login"} />
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

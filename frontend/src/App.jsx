import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Home from "./components/Home";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Assistant from "./components/Assistant";
import { auth } from "./api";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(auth.isLoggedIn());

  return (
    <Router>
      <Toaster position="top-right" reverseOrder={false} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/login"
          element={
            isLoggedIn ? <Navigate to="/dashboard" />
              : <Login onLoginSuccess={() => setIsLoggedIn(true)} />
          }
        />
        <Route
          path="/dashboard"
          element={isLoggedIn ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {/* Global help chatbot + voice agent, available on every page */}
      <Assistant />
    </Router>
  );
}

export default App;

import { useState, useEffect, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Home from "./components/Home";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Assistant from "./components/Assistant";
import { LanguageProvider } from "./lib/i18n";
import { auth } from "./api";

import SchemeWizard from "./components/SchemeWizard";
import GuestResults from "./components/GuestResults";
import SchemeBrowser from "./components/SchemeBrowser";
import SchemeDetails from "./components/SchemeDetails";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(auth.isLoggedIn());

  // Re-check auth whenever localStorage changes (handles logout from GovHeader)
  useEffect(() => {
    const sync = () => setIsLoggedIn(auth.isLoggedIn());
    window.addEventListener("storage", sync);
    // Also poll on focus in case logout happened in the same tab
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const handleLogout = useCallback(() => {
    auth.clear();
    setIsLoggedIn(false);
  }, []);

  return (
    <LanguageProvider>
    <Router>
      <Toaster position="top-right" reverseOrder={false} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/schemes" element={<SchemeBrowser />} />
        <Route path="/schemes/:id" element={<SchemeDetails />} />
        <Route path="/find" element={<SchemeWizard />} />
        <Route path="/results" element={<GuestResults />} />
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
    </LanguageProvider>
  );
}

export default App;

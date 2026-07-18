import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogIn, LogOut, LayoutDashboard } from "lucide-react";
import GovTopBar from "./GovTopBar";
import HaqqLogo from "./HaqqLogo";
import { auth } from "../api";

export default function GovHeader() {
  const nav = useNavigate();
  const loc = useLocation();
  const loggedIn = auth.isLoggedIn();
  const user = auth.user();

  const logout = () => { auth.clear(); nav("/"); };

  const navItems = [
    { label: "Home", to: "/" },
    { label: "Schemes", to: loggedIn ? "/dashboard" : "/login" },
    { label: "How it works", to: "/#how" },
    { label: "About", to: "/#about" },
  ];

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      <GovTopBar />
      <div className="bg-white border-b border-[var(--border)]">
        <div className="container-gov flex items-center justify-between py-3">
          <Link to="/"><HaqqLogo /></Link>
          <div className="flex items-center gap-3">
            {loggedIn ? (
              <>
                <Link to="/dashboard" className="btn btn-outline hidden sm:inline-flex">
                  <LayoutDashboard size={16} /> Dashboard
                </Link>
                <span className="text-sm text-[var(--muted)] hidden md:inline">
                  {user?.name || user?.mobile_number || "Citizen"}
                </span>
                <button onClick={logout} className="btn btn-primary">
                  <LogOut size={16} /> Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary">
                <LogIn size={16} /> Citizen Login
              </Link>
            )}
          </div>
        </div>
      </div>
      {/* Nav bar */}
      <nav className="bg-[var(--gov-navy)] text-white">
        <div className="container-gov flex items-center gap-1 overflow-x-auto">
          {navItems.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              className={`px-4 py-2.5 text-sm font-medium hover:bg-white/10 whitespace-nowrap ${
                loc.pathname === n.to ? "bg-white/15" : ""
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

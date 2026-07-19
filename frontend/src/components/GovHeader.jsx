import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogIn, LogOut, LayoutDashboard, Menu, X } from "lucide-react";
import GovTopBar from "./GovTopBar";
import HaqqLogo from "./HaqqLogo";
import IndianFlag from "./gov/IndianFlag";
import { auth } from "../api";

export default function GovHeader() {
  const nav = useNavigate();
  const loc = useLocation();
  const loggedIn = auth.isLoggedIn();
  const [open, setOpen] = useState(false);

  const logout = () => {
    auth.clear();
    // Notify App.jsx in the same tab (storage event only fires cross-tab)
    window.dispatchEvent(new Event("storage"));
    nav("/");
  };

  const navItems = [
    { label: "Home", to: "/" },
    { label: "Browse Schemes", to: "/schemes" },
    { label: "How it works", to: "/#how" },
    { label: "About", to: "/#about" },
  ];
  const isActive = (to) => (to === "/" ? loc.pathname === "/" : loc.pathname === to);

  return (
    <header className="sticky top-0 z-40">
      <div className="tricolor" />
      <GovTopBar />

      {/* Main navbar — brand left · nav center · actions right */}
      <div className="bg-white/85 backdrop-blur-md border-b border-[var(--line)] shadow-sm transition-all">
        <div className="wrap flex items-center justify-between gap-4 py-3.5">
          {/* Left: brand */}
          <Link to="/" className="shrink-0 group hover:opacity-90 transition-opacity">
            <HaqqLogo size={40} />
          </Link>

          {/* Center: primary navigation (desktop) */}
          <nav className="hidden md:flex items-center gap-8 scroll-x overflow-x-auto">
            {navItems.map((n) => (
              <Link key={n.label} to={n.to} className={`navlink py-1.5 ${isActive(n.to) ? "active" : ""}`}>
                {n.label}
              </Link>
            ))}
          </nav>

          {/* Right: flag + auth */}
          <div className="flex items-center gap-4">
            <div className="hidden lg:block">
              <IndianFlag width={36} />
            </div>
            <div className="w-px h-6 bg-[var(--line)] hidden sm:block mx-1" />
            {loggedIn ? (
              <div className="hidden sm:flex items-center gap-3">
                <Link to="/dashboard" className="btn btn-outline btn-sm">
                  <LayoutDashboard size={16} /> Dashboard
                </Link>
                <button onClick={logout} className="btn btn-ghost btn-sm text-[var(--muted)] hover:text-[var(--err)]">
                  <LogOut size={16} /> Logout
                </button>
              </div>
            ) : (
              <Link to="/login" className="hidden sm:inline-flex btn btn-primary btn-sm px-5">
                <LogIn size={16} /> Citizen Login
              </Link>
            )}
            <button
              className="md:hidden btn btn-ghost btn-sm !px-2"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden glass border-b border-[var(--line)] shadow-lg absolute w-full left-0">
          <div className="wrap py-4 flex flex-col gap-1">
            {navItems.map((n) => (
              <Link
                key={n.label} to={n.to} onClick={() => setOpen(false)}
                className={`py-3 px-4 rounded-lg text-sm font-semibold transition-colors ${
                  isActive(n.to) ? "bg-[var(--surface-2)] text-[var(--navy)]" : "text-[var(--body)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-4 pt-4 border-t border-[var(--line)] flex flex-col gap-3 px-2">
              {loggedIn ? (
                <>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="btn btn-outline btn-sm w-full">
                    <LayoutDashboard size={16} /> Dashboard
                  </Link>
                  <button onClick={() => { setOpen(false); logout(); }} className="btn btn-ghost btn-sm w-full text-[var(--err)]">
                    <LogOut size={16} /> Logout
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={() => setOpen(false)} className="btn btn-primary btn-sm w-full py-2.5">
                  <LogIn size={16} /> Citizen Login
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

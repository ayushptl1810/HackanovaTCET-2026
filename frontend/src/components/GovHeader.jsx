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

  const logout = () => { auth.clear(); nav("/"); };

  const navItems = [
    { label: "Home", to: "/" },
    { label: "Schemes", to: loggedIn ? "/dashboard" : "/login" },
    { label: "How it works", to: "/#how" },
    { label: "About", to: "/#about" },
  ];
  const isActive = (to) => (to === "/" ? loc.pathname === "/" : loc.pathname === to);

  return (
    <header className="sticky top-0 z-40">
      <div className="tricolor" />
      <GovTopBar />

      {/* Main navbar — brand left · nav center · actions right */}
      <div className="bg-white/95 backdrop-blur border-b border-[var(--line)]">
        <div className="wrap flex items-center justify-between gap-4 py-3">
          {/* Left: brand */}
          <Link to="/" className="shrink-0">
            <HaqqLogo size={40} />
          </Link>

          {/* Center: primary navigation (desktop) */}
          <nav className="hidden md:flex items-center gap-7 scroll-x overflow-x-auto">
            {navItems.map((n) => (
              <Link key={n.label} to={n.to} className={`navlink !py-2 ${isActive(n.to) ? "active" : ""}`}>
                {n.label}
              </Link>
            ))}
          </nav>

          {/* Right: flag + auth */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:block">
              <IndianFlag width={40} />
            </div>
            {loggedIn ? (
              <div className="hidden sm:flex items-center gap-2.5">
                <Link to="/dashboard" className="btn btn-outline btn-sm">
                  <LayoutDashboard size={15} /> Dashboard
                </Link>
                <button onClick={logout} className="btn btn-primary btn-sm">
                  <LogOut size={15} /> Logout
                </button>
              </div>
            ) : (
              <Link to="/login" className="hidden sm:inline-flex btn btn-primary btn-sm">
                <LogIn size={15} /> Citizen Login
              </Link>
            )}
            <button
              className="md:hidden btn btn-ghost btn-sm !px-2"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-b border-[var(--line)] shadow-[var(--shadow)]">
          <div className="wrap py-2 flex flex-col">
            {navItems.map((n) => (
              <Link
                key={n.label} to={n.to} onClick={() => setOpen(false)}
                className={`py-2.5 text-sm font-semibold border-b border-[var(--line)] last:border-0 ${
                  isActive(n.to) ? "text-[var(--navy)]" : "text-[var(--body)]"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <div className="py-3 flex gap-2">
              {loggedIn ? (
                <>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="btn btn-outline btn-sm flex-1">
                    <LayoutDashboard size={15} /> Dashboard
                  </Link>
                  <button onClick={() => { setOpen(false); logout(); }} className="btn btn-primary btn-sm flex-1">
                    <LogOut size={15} /> Logout
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={() => setOpen(false)} className="btn btn-primary btn-sm w-full">
                  <LogIn size={15} /> Citizen Login
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Camera, Home, Image, BookOpen, Menu, X, Frame } from "lucide-react";

export default function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/", label: "Beranda", icon: Home },
    { to: "/camera", label: "Kamera", icon: Camera },
    { to: "/photostrip", label: "Bingkai & Stiker", icon: Frame },
    { to: "/gallery", label: "Galeri", icon: Image },
    { to: "/education", label: "Behind the Filter", icon: BookOpen },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-gray-900 tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white">
            <Camera size={18} />
          </div>
          <span>PCKV Booth</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                isActive(to)
                  ? "text-rose-600 border-b-2 border-rose-600 pb-0.5"
                  : "text-gray-600 hover:text-rose-600"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-200 px-4 py-3 flex flex-col gap-3">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 py-1.5 text-sm font-medium ${
                isActive(to) ? "text-rose-600 font-bold" : "text-gray-700"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

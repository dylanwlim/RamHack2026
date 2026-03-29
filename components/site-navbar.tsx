"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { motionEase, motionTiming } from "@/lib/motion";
import { SiteBrand } from "@/components/site-brand";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Overview", href: "/" },
  { label: "Pharmacy Finder", href: "/patient" },
  { label: "Medication Lookup", href: "/prescriber" },
  { label: "Methodology", href: "/methodology" },
  { label: "Contact", href: "/contact" },
];

export function SiteNavbar() {
  const pathname = usePathname();
  const { profile, signOut, status } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const isSignedIn = status === "authenticated";
  const userInitials = (profile?.displayName || "PP")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() || "")
    .join("");

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <nav
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        isScrolled ? "bg-white/95 shadow-sm backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="site-shell">
        <div className="flex h-20 items-center justify-between">
          <SiteBrand />

          <div className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => {
              const isHomeAnchor = item.href.startsWith("/#");
              const isRouteItem = isHomeAnchor
                ? pathname === "/"
                : item.href === pathname || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link-underline"
                  data-active={isRouteItem}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="hidden items-center gap-1 md:flex">
            {isSignedIn ? (
              <>
                <Link
                  href="/profile"
                  className="flat-chip border border-slate-200 bg-white/90 px-3 py-2 hover:border-[#156d95]/25 hover:text-[#156d95]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#156d95]/10 text-xs font-semibold text-[#156d95]">
                    {userInitials}
                  </span>
                  Profile
                </Link>
                <Link href="/settings" className="template-button-secondary text-sm">
                  Settings
                </Link>
                <button
                  type="button"
                  className="rounded-full px-4 py-3 text-sm text-slate-600 transition-colors hover:text-slate-950"
                  onClick={() => void signOut()}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-link-underline">
                  Login
                </Link>
                <Link href="/register" className="nav-link-underline">
                  Register
                </Link>
              </>
            )}
            <Link href="/patient" className="template-button-primary ml-1">
              Start Search
            </Link>
          </div>

          <button
            type="button"
            className="rounded-full p-2 text-slate-700 md:hidden"
            aria-label="Toggle navigation"
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: motionTiming.base, ease: motionEase.standard }}
            className="border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden"
          >
            <div className="site-shell flex flex-col gap-2 py-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-3 text-lg font-normal text-slate-700 transition-colors duration-200 hover:text-[#156d95]"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {isSignedIn ? (
                <>
                  <Link
                    href="/profile"
                    className="px-3 py-3 text-lg font-normal text-slate-700 transition-colors duration-200 hover:text-[#156d95]"
                    onClick={() => setIsOpen(false)}
                  >
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    className="px-3 py-3 text-lg font-normal text-slate-700 transition-colors duration-200 hover:text-[#156d95]"
                    onClick={() => setIsOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    type="button"
                    className="px-3 py-3 text-left text-lg font-normal text-slate-700 transition-colors duration-200 hover:text-[#156d95]"
                    onClick={() => {
                      setIsOpen(false);
                      void signOut();
                    }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3 py-3 text-lg font-normal text-slate-700 transition-colors duration-200 hover:text-[#156d95]"
                    onClick={() => setIsOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="px-3 py-3 text-lg font-normal text-slate-700 transition-colors duration-200 hover:text-[#156d95]"
                    onClick={() => setIsOpen(false)}
                  >
                    Register
                  </Link>
                </>
              )}
              <Link
                href="/patient"
                className="template-button-primary mt-2"
                onClick={() => setIsOpen(false)}
              >
                Start Search
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { motionEase, motionTiming } from "@/lib/motion";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Story", href: "/#story" },
  { label: "Patient", href: "/patient" },
  { label: "Prescriber", href: "/prescriber" },
  { label: "Methodology", href: "/methodology" },
];

export function SiteNavbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
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
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-slate-900 transition-colors duration-200 hover:text-[#156d95]"
          >
            PharmaPath
          </Link>

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

          <div className="hidden md:block">
            <Link
              href="/patient"
              className="template-button-primary shadow-sm hover:shadow-md"
            >
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

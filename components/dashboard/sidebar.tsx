"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Home, LogOut, Menu, X } from "lucide-react";
import { signOut } from "@/app/dashboard/actions";

type SidebarProfile = {
  full_name: string | null;
  email: string | null;
  role: "admin" | "alumno";
};

export function DashboardSidebar({ profile }: { profile: SidebarProfile | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = profile?.role === "admin";

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (profile?.email?.[0] ?? "?").toUpperCase();

  const navItems = [
    { href: "/dashboard", label: isAdmin ? "Overview" : "Dashboard", icon: Home, exact: true },
  ];

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const SidebarContent = () => (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-[var(--outline-variant)] px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] shadow-[0_4px_14px_rgba(81,76,189,0.32)]">
          <GraduationCap size={19} strokeWidth={1.5} className="text-white" />
        </div>
        <span className="font-display text-xl font-bold tracking-tight text-[var(--on-surface)]">GlossaAI</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--outline)]">
          {isAdmin ? "Management" : "Learning"}
        </p>
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(item.href, item.exact)
                    ? "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]"
                    : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
                }`}
              >
                <item.icon size={17} strokeWidth={1.5} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-[var(--outline-variant)] p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-xs font-bold text-[var(--on-primary-fixed-variant)]">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--on-surface)]">
              {profile?.full_name ?? profile?.email ?? "User"}
            </p>
            <p className="text-xs text-[var(--on-surface-variant)]">{isAdmin ? "Admin" : "Student"}</p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
          >
            <LogOut size={17} strokeWidth={1.5} />
            Sign out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)]">
            <GraduationCap size={15} strokeWidth={1.5} className="text-white" />
          </div>
          <span className="font-display text-lg font-bold text-[var(--on-surface)]">GlossaAI</span>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)]"
          aria-label="Toggle menu"
        >
          {open ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar – mobile: off-canvas; desktop: static */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:h-screen lg:sticky lg:top-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, GraduationCap, Home, LogOut, Menu, Users, X } from "lucide-react";
import { signOut } from "@/app/dashboard/actions";

type SidebarProfile = {
  full_name: string | null;
  email: string | null;
  role: "admin" | "alumno" | "superadmin";
};

export function DashboardSidebar({
  profile,
  courses = []
}: {
  profile: SidebarProfile | null;
  courses?: Array<{ id: string; title: string }>;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = profile?.role === "admin";
  const isSuperAdmin = profile?.role === "superadmin";

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
    ...(isAdmin ? [{ href: "/dashboard/employees", label: "Employees", icon: Users, exact: true }] : []),
  ];

  const roleLabel = isSuperAdmin ? "Superadmin" : isAdmin ? "Admin" : "Student";

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  /* ── Expanded desktop content ── */
  const ExpandedContent = () => (
    <>
      <div className="flex h-16 items-center justify-between border-b border-[var(--outline-variant)] px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] shadow-[0_4px_14px_rgba(81,76,189,0.32)]">
            <GraduationCap size={19} strokeWidth={1.5} className="text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-[var(--on-surface)]">GlossaAI</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="hidden h-7 w-7 items-center justify-center rounded-lg text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)] lg:flex"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
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
                onClick={() => setMobileOpen(false)}
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

        {isSuperAdmin && courses.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--outline)]">
              Courses
            </p>
            <ul className="space-y-0.5">
              {courses.map((course) => {
                const href = `/dashboard/courses/${course.id}`;
                return (
                  <li key={course.id}>
                    <Link
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        pathname.startsWith(href)
                          ? "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]"
                          : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
                      }`}
                    >
                      <BookOpen size={17} strokeWidth={1.5} className="shrink-0" />
                      <span className="truncate">{course.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
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
            <p className="text-xs text-[var(--on-surface-variant)]">{roleLabel}</p>
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

  /* ── Collapsed desktop content ── */
  const CollapsedContent = () => (
    <>
      <div className="flex h-16 items-center justify-center border-b border-[var(--outline-variant)]">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] shadow-[0_4px_14px_rgba(81,76,189,0.32)]">
          <GraduationCap size={19} strokeWidth={1.5} className="text-white" />
        </div>
      </div>

      <div className="flex justify-center px-2 py-3">
        <button
          onClick={() => setCollapsed(false)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)]"
          aria-label="Expand sidebar"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1">
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                title={item.label}
                className={`flex items-center justify-center rounded-lg p-2.5 transition-colors ${
                  isActive(item.href, item.exact)
                    ? "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]"
                    : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
                }`}
              >
                <item.icon size={17} strokeWidth={1.5} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-[var(--outline-variant)] p-2">
        <div className="flex justify-center py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-xs font-bold text-[var(--on-primary-fixed-variant)]">
            {initials}
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            title="Sign out"
            className="flex w-full items-center justify-center rounded-lg p-2.5 text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
          >
            <LogOut size={17} strokeWidth={1.5} />
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
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)]"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar – mobile: off-canvas; desktop: static + collapsible */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] transition-all duration-300 ease-in-out lg:static lg:h-screen lg:translate-x-0 lg:sticky lg:top-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-16" : "w-64"}`}
      >
        {/* Desktop: show collapsed or expanded content */}
        <div className="hidden h-full flex-col lg:flex">
          {collapsed ? <CollapsedContent /> : <ExpandedContent />}
        </div>
        {/* Mobile: always expanded content */}
        <div className="flex h-full flex-col lg:hidden">
          <ExpandedContent />
        </div>
      </aside>
    </>
  );
}

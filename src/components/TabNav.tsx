"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconTruck, IconLayers } from "@/components/icons";

const TABS = [
  { href: "/transferencias", label: "Transferências", icon: IconTruck },
  { href: "/estoque", label: "Estoque", icon: IconLayers },
];

export default function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-[var(--border)] glass sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 flex items-center gap-1">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                active
                  ? "border-[var(--accent)] text-[var(--text)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

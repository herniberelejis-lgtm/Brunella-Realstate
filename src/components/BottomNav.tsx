"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon } from "./icons/HomeIcon";
import { UsersIcon } from "./icons/UsersIcon";
import { KeyIcon } from "./icons/KeyIcon";
import { BuildingIcon } from "./icons/BuildingIcon";

const ITEMS = [
  { href: "/", label: "Inicio", icon: HomeIcon, exact: true },
  { href: "/contactos?tipo=Comprador", label: "Clientes", icon: UsersIcon, matchPrefix: "/contactos" },
  { href: "/contactos?tipo=Propietario", label: "Propietarios", icon: KeyIcon, matchPrefix: "/contactos" },
  { href: "/propiedades", label: "Propiedades", icon: BuildingIcon, matchPrefix: "/propiedades" },
];

export function BottomNav() {
  const pathname = usePathname();

  // The public client intake form is reached by leads from Instagram/Facebook ads — it must
  // not expose Brunella's internal CRM navigation (contactos/propiedades) to them.
  if (pathname.startsWith("/formulario")) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
    >
      <ul className="mx-auto flex max-w-2xl">
        {ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === "/"
            : pathname.startsWith(item.matchPrefix ?? item.href);
          const Icon = item.icon;
          return (
            <li key={item.label} className="flex-1">
              <Link
                href={item.href}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "text-indigo-600" : "text-slate-500 hover:text-slate-700"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-6 w-6" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

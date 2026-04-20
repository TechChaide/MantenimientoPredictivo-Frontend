"use client";
import React from "react";
import { useDashboardData } from "@/app/dashboard/DashboardDataContext";
import { useEffect } from "react";
import { environment } from "@/environments/environments.prod";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar-new";
import { menuService } from "@/services/menu.service";
import { usePathname } from "next/navigation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import * as LucideIcons from "lucide-react";
import { ChevronsUpDown } from "lucide-react";
import { Toast } from "@radix-ui/react-toast";
import router, { useRouter } from "next/navigation";

function toRecursiveItems(nodes: MenuNode[]): any[] {
  return nodes.map((n) => {
    // Normalize path: if backend returned an absolute URL, extract its pathname
    let normalizedPath = n.path;
    try {
      if (typeof normalizedPath === 'string' && /^(https?:)?\/\//.test(normalizedPath)) {
        const u = new URL(normalizedPath, typeof window !== 'undefined' ? window.location.origin : undefined);
        normalizedPath = u.pathname + (u.search || '') + (u.hash || '');
      }
    } catch (err) {
      // ignore malformed URLs and keep original path
    }
    // Buscar el icono por nombre en LucideIcons
    const IconComp =
      (LucideIcons as Record<string, any>)[n.icono] ||
      (LucideIcons as Record<string, any>)["Shield"];
    const hasChildren = !!(n.children && n.children.length);
    const isRoot = n.path === ".";
    const isBranch = n.path === "|";
    // Los elementos raíz y branch también pueden ser navegables si tienen un path válido
    // Solo excluir de navegación si el path está vacío o es undefined
    const isNavigable =
      !!normalizedPath && normalizedPath !== "" && normalizedPath !== "." && normalizedPath !== "|";
    const children = hasChildren ? toRecursiveItems(n.children!) : undefined;

    return {
      label: n.nombre,
      icon: IconComp,
      path: isNavigable ? normalizedPath : undefined,
      children,
      // Incluir información adicional para debugging
      codigo_menu: n.codigo_menu,
      originalPath: n.path,
      isRoot,
      isBranch,
    };
  });
}

const RecursiveMenu = ({
  items,
  level = 0,
}: {
  items: any[];
  level?: number;
}) => {
  const { isCollapsed } = useSidebar();
  const pathname = usePathname();

  if (items.length === 0) return null;
  return (
    <div
      className="w-full"
      style={{ paddingLeft: level > 0 && !isCollapsed ? "1rem" : "0" }}
    >
      {items.map((item, index) => (
        <Collapsible
          key={index}
          className={isCollapsed ? "w-full flex justify-center" : "w-full"}
          defaultOpen
        >
          {item.children ? (
            <>
              <CollapsibleTrigger
                className={
                  isCollapsed
                    ? "w-10 h-10 flex items-center justify-center rounded-md hover:bg-primary-foreground/10"
                    : "w-full"
                }
                title={isCollapsed ? item.label : undefined}
              >
                <div
                  className={
                    isCollapsed
                      ? "flex items-center justify-center"
                      : "flex items-center justify-between w-full p-2 rounded-md hover:bg-primary/80"
                  }
                >
                  <div
                    className={
                      isCollapsed
                        ? "flex items-center"
                        : "flex items-center gap-2"
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                  {!isCollapsed && <ChevronsUpDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              {!isCollapsed && (
                <CollapsibleContent>
                  <RecursiveMenu items={item.children} level={level + 1} />
                </CollapsibleContent>
              )}
            </>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton
                // href={environment.basePath + (item.path || "#")}
                href={(item.path || "#")}

                active={item.path && pathname?.startsWith(item.path)}
                className={
                  isCollapsed
                    ? "h-10 w-10 justify-center"
                    : "justify-start pl-4 h-9"
                }
                title={isCollapsed ? item.label : undefined}
              >
                {item.icon && (
                  <item.icon
                    className={isCollapsed ? "h-5 w-5" : "h-4 w-4 mr-2"}
                  />
                )}
                {!isCollapsed && item.label}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </Collapsible>
      ))}
    </div>
  );
};

type MenuNode = {
  codigo_menu: number;
  codigo_padre: number | null;
  nombre: string;
  icono: string;
  path: string;
  estado: string;
  codigo_aplicacion: string;
  children?: MenuNode[];
};

function filterActive(nodes: MenuNode[]): MenuNode[] {
  // Filtra los nodos activos (por ejemplo, estado === 'A')
  return nodes
    .filter((node) => node.estado === "A")
    .map((node) => ({
      ...node,
      children: node.children ? filterActive(node.children) : undefined,
    }));
}

function combineMenus(menus: MenuNode[]): MenuNode[] {
  if (!menus || menus.length === 0) return [];

  const menuMap = new Map<number, MenuNode>();

  menus.forEach((menu) => {
    if (!menu || !menu.codigo_menu) {
      return;
    }

    const existingMenu = menuMap.get(menu.codigo_menu);

    if (existingMenu) {
      // Si el menú ya existe, combinar los children
      const existingChildren = existingMenu.children || [];
      const newChildren = menu.children || [];

      // Combinar children recursivamente
      const allChildren = [...existingChildren, ...newChildren];
      const combinedChildren =
        allChildren.length > 0 ? combineMenus(allChildren) : undefined;

      // Actualizar el menú existente con los children combinados
      menuMap.set(menu.codigo_menu, {
        ...existingMenu,
        children:
          combinedChildren && combinedChildren.length > 0
            ? combinedChildren
            : undefined,
      });
    } else {
      // Si es un menú nuevo, agregarlo al mapa
      menuMap.set(menu.codigo_menu, {
        ...menu,
        children:
          menu.children && menu.children.length > 0
            ? combineMenus(menu.children)
            : undefined,
      });
    }
  });

  return Array.from(menuMap.values());
}

export function DynamicSidebarMenu() {
  const router = useRouter();
  let menuLoading = true;
  let menuItems: any[] = [];
  let menuError: string | null = null;

  try {
    const ctx = useDashboardData();
    menuLoading = ctx.menuLoading;
    menuItems = ctx.menuItems ? toRecursiveItems(ctx.menuItems as any) : [];
    menuError = ctx.menuError;
  } catch (err) {
    // If context isn't available, fall back to local loading (no-op here)
    // but avoid throwing — show an error UI instructing to wrap layout with provider
    menuLoading = false;
    menuItems = [];
    menuError = "Menu provider not available";
    console.warn("DynamicSidebarMenu: DashboardDataProvider not found. Wrap layout with DashboardDataProvider.");
  }

  useEffect(() => {
    if (!menuLoading && menuItems.length === 0 && !menuError) {
      router.push("/");
    }
  }, [menuLoading, menuItems, menuError, router]);

  return (
    <SidebarMenu>
      {menuLoading && (
        <div className="text-xs text-white/70 px-2 py-1">Cargando menú...</div>
      )}
      {!menuLoading && menuError && (
        <div className="text-xs text-red-200 px-2 py-1">{menuError}</div>
      )}
      {!menuLoading && !menuError && menuItems.length > 0 && (
        <RecursiveMenu items={menuItems} />
      )}
      {!menuLoading && !menuError && menuItems.length === 0 && (
        <div className="text-xs text-white/60 px-2 py-1">
          Sin opciones de menú
        </div>
      )}
    </SidebarMenu>
  );
}

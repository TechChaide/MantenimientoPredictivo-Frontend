"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, PanelLeft, Menu } from "lucide-react";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4", className)} {...props} />
));
SidebarFooter.displayName = "SidebarFooter";

type SidebarContextValue = {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [openMobile, setOpenMobile] = React.useState(false);
  const isMobile = useIsMobile();

  const toggleCollapse = React.useCallback(() => {
    setIsCollapsed((v) => !v);
  }, []);

  React.useEffect(() => {
    if (!isMobile && openMobile) setOpenMobile(false);
  }, [isMobile, openMobile]);

  const value = React.useMemo<SidebarContextValue>(
    () => ({ isCollapsed, toggleCollapse, isMobile, openMobile, setOpenMobile }),
    [isCollapsed, toggleCollapse, isMobile, openMobile]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { isCollapsed, toggleCollapse, isMobile, openMobile, setOpenMobile } = useSidebar();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Render different markup for mobile (Sheet) and desktop (sticky sidebar).
  return (
    <>
      {isMobile ? (
        <>
          <Sheet open={openMobile} onOpenChange={setOpenMobile}>
            <SheetContent
              className={cn("w-[18rem] bg-primary p-0 text-primary-foreground border-none")}
              side="left"
            >
              <SheetTitle className="sr-only">Menú lateral</SheetTitle>
              <div ref={ref} className={cn("flex flex-col h-full", className)} {...props}>
                <div className="flex items-center justify-between p-4">
                  <div className="sr-only">Menu</div>
                  <Button variant="ghost" size="icon" onClick={() => setOpenMobile(false)}>
                    <ChevronLeft className="h-4 w-4 rotate-180" />
                    <span className="sr-only">Cerrar</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-auto">{children}</div>
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <>
          <div
            ref={ref}
            className={cn(
              "relative bg-primary text-primary-foreground transition-all duration-300 ease-in-out flex flex-col h-screen sticky top-0",
              isCollapsed ? "w-16" : "w-80",
              className
            )}
            {...props}
          >
            {children}
          </div>

          {/* Desktop portal toggle to avoid clipping (keeps previous behavior) */}
          {mounted
            ? createPortal(
                <div
                  style={{
                    left: isCollapsed ? "calc(4rem - 1rem)" : "calc(20rem - 1rem)",
                    bottom: "calc(88px - 5vh)",
                  }}
                  className="fixed z-[9999]"
                >
                  <Button
                    variant="secondary"
                    size="icon"
                    className="rounded-full h-8 w-8 bg-card text-card-foreground hover:bg-card/80 shadow-lg"
                    onClick={toggleCollapse}
                  >
                    <ChevronLeft
                      className={cn(
                        "h-8 w-4 transition-transform",
                        isCollapsed && "rotate-180"
                      )}
                    />
                  </Button>
                </div>,
                document.body
              )
            : null}
        </>
      )}
    </>
  );
});
Sidebar.displayName = "Sidebar";

export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { isCollapsed } = useSidebar();
  return (
    <div
      ref={ref}
      className={cn(
        "p-4 transition-all duration-300 flex flex-col items-center",
        isCollapsed && "p-2",
        className
      )}
      {...props}
    />
  );
});
SidebarHeader.displayName = "SidebarHeader";

export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto", className)}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

export const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => {
  const { isCollapsed } = useSidebar();
  return (
    <ul
      ref={ref}
      className={cn(
        "space-y-2 p-2",
        isCollapsed && "flex flex-col items-center",
        className
      )}
      {...props}
    />
  );
});
SidebarMenu.displayName = "SidebarMenu";

export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("w-full", className)} {...props} />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

export const SidebarMenuButton = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    active?: boolean;
  }
>(({ className, children, active = false, href, onClick, ...props }, ref) => {
  const { isCollapsed, isMobile, setOpenMobile } = useSidebar();
  const childrenArray = React.Children.toArray(children);
  const icon = childrenArray[0];
  const label = childrenArray[1];

  const classNames = cn(
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-primary-foreground/10 text-green-300 hover:text-green-200 hover:bg-primary-foreground/15"
      : "text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground",
    isCollapsed && "justify-center",
    className
  );

  const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    onClick?.(e);
    if (isMobile) setOpenMobile(false);
  };

  const isExternal = typeof href === "string" && /^(https?:)?\/\//.test(href);

  if (isExternal) {
    return (
      <a ref={ref} className={classNames} href={href} onClick={handleClick} {...props}>
        {icon}
        {!isCollapsed && label}
      </a>
    );
  }

  // Internal link: use Next.js Link for client-side navigation
  return (
    <Link href={href || "#"} className={classNames} onClick={handleClick} {...(props as any)}>
      {icon}
      {!isCollapsed && label}
    </Link>
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

export const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, ...props }, ref) => {
  const { toggleCollapse } = useSidebar();

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", className)}
      onClick={toggleCollapse}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

export const SidebarMobileTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, ...props }, ref) => {
  const { setOpenMobile } = useSidebar();

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      aria-label="Abrir menú de navegación"
      className={cn("md:hidden h-11 w-11", className)}
      onClick={() => setOpenMobile(true)}
      {...props}
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">Abrir menú de navegación</span>
    </Button>
  );
});
SidebarMobileTrigger.displayName = "SidebarMobileTrigger";

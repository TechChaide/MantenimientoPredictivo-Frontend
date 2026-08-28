// import type {Metadata} from 'next';
// import './globals.css';
// import { Toaster } from "@/components/ui/toaster"

// export const metadata: Metadata = {
//   title: 'Módulo de Mantenimiento Predictivo',
//   description: 'Módulo de Mantenimiento Predictivo para la gestión eficiente de activos industriales.',
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="es" suppressHydrationWarning>
//       <head>
//         <link rel="preconnect" href="https://fonts.googleapis.com" />
//         <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
//         <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
//       </head>
//       <body className="font-body antialiased">
//         {children}
//         <Toaster />
//       </body>
//     </html>
//   );
// }
import type { Metadata } from "next";
import React from "react";
import Image from "next/image";
import { SidebarFooter } from "@/components/ui/sidebar-new";
import Link from "next/link";
import { MainSidebar } from "@/components/main-sidebar";
import { MainHeader } from "@/components/main-header";
import { DynamicSidebarMenu } from "@/components/dynamic-sidebar-menu";
import { DashboardUserInfo } from '@/components/dashboard-user-info';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarMobileTrigger,
} from "@/components/ui/sidebar-new";
import { SidebarLogo } from "@/components/sidebar-logo";
import { DashboardDataProvider } from "./DashboardDataContext";

export const metadata: Metadata = {
  title: "Gestión Inteligente de Certificados de Calidad",
  description: "Gestión Inteligente de Certificados de Calidad de Alambre",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <DashboardDataProvider>
      <SidebarProvider>
        <div className="h-screen flex w-full overflow-hidden">
          <Sidebar>
            <SidebarHeader>
              <SidebarLogo />
            </SidebarHeader>
            <SidebarContent>
              <DynamicSidebarMenu />
            </SidebarContent>
             <SidebarFooter className="p-4" >
               <DashboardUserInfo />
             </SidebarFooter>
          </Sidebar>
          <div className="flex-1 flex flex-col overflow-hidden p-0">
            <header className="md:hidden flex items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur-sm shrink-0">
              <SidebarMobileTrigger />
              <SidebarLogo compact />
            </header>
            {/* <MainHeader /> */}
            <main className="flex-1 p-0 sm:p-0 lg:p-2 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </DashboardDataProvider>
  );
}

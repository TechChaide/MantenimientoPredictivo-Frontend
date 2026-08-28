"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useSidebar } from '@/components/ui/sidebar-new';

export function SidebarLogo({ compact = false }: { compact?: boolean }) {
  const { isCollapsed } = useSidebar();
  return (
    <Link href="/dashboard" className={compact ? "flex items-center gap-3 cursor-pointer group" : "flex items-center gap-3 px-2 py-4 cursor-pointer group"}>
      <div className="flex-shrink-0">
        {compact || isCollapsed ? (
          <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH}/img/chaide.svg`} alt="Chaide" width={32} height={32} />
        ) : (
          <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH}/img/logo_chaide.svg`} alt="Certificados Calidad" width={180} height={128} />
        )}
      </div>
      {/* {!isCollapsed && (
        <span className="font-semibold text-lg whitespace-nowrap">Certificados Calidad</span>
      )} */}
    </Link>
  );
}

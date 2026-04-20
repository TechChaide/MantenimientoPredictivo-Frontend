'use client';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function MainHeader() {
  return (
    <header className="flex h-14 lg:h-[60px] items-center gap-4 border-b bg-background px-6">
      <div className="flex items-center md:hidden">
        <SidebarTrigger className="md:hidden mr-2" />
      </div>
      <div className="w-full flex-1">
        <form>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar..."
              className="w-full bg-muted pl-8 md:w-[200px] lg:w-[320px]"
            />
          </div>
        </form>
      </div>
    </header>
  );
}

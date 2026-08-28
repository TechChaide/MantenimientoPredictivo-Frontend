
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DashboardHeaderProps {
  title?: string;
  children?: React.ReactNode;
  onRefresh?: () => void;
  showRefreshButton?: boolean;
}

export function DashboardHeader({ title, children, onRefresh, showRefreshButton = false }: DashboardHeaderProps) {

  return (
    <header className="flex flex-col md:flex-row md:h-14 shrink-0 md:items-center gap-2 md:gap-4 border-b bg-background/95 px-4 py-2 md:py-0 backdrop-blur-sm lg:h-[60px] lg:px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold md:text-2xl">{title}</h1>
      </div>
      <div className="flex-1 hidden md:block" />
      <div className="flex flex-wrap items-center gap-2 md:gap-4">
        {children}
        {showRefreshButton && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onRefresh} className="h-8 w-8">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Actualizar datos</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </header>
  );
}

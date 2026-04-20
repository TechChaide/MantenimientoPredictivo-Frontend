"use client";

import * as React from "react";
import { format, subMonths, subYears, differenceInDays, subDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime } from 'date-fns-tz';
import { Calendar as CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  initialDate?: DateRange;
}

const formatInTimeZone = (date: Date, formatString: string, timeZone: string) => {
  const zonedDate = toZonedTime(date, timeZone);
  return format(zonedDate, formatString, { locale: es });
}

export function DateRangePicker({ className, initialDate }: DateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [date, setDate] = React.useState<DateRange | undefined>(initialDate);
  const [isClient, setIsClient] = React.useState(false);
  const [timeZone, setTimeZone] = React.useState('UTC');
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const updateTimeoutRef = React.useRef<NodeJS.Timeout>();

  const sinceStartDate = new Date('2025-04-10T00:00:00Z');

  React.useEffect(() => {
      setDate(initialDate);
  }, [initialDate]);
  
  React.useEffect(() => {
    setIsClient(true);
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    // Cleanup del timeout al desmontar
    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, []);

  const updateURL = React.useCallback((range: DateRange | undefined) => {
    // Debounce: espera 300ms antes de actualizar URL
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    
    updateTimeoutRef.current = setTimeout(() => {
      const newParams = new URLSearchParams();
      
      if (range?.from) {
        newParams.set("from", format(range.from, "yyyy-MM-dd"));
        
        const toDate = range.to || range.from;
        const today = new Date();

        if (toDate && isSameDay(toDate, today)) {
            newParams.set("to", today.toISOString()); 
        } else if (toDate) {
            newParams.set("to", format(toDate, "yyyy-MM-dd"));
        }
      }
      
      router.push(`${pathname}?${newParams.toString()}`);
    }, 300);
  }, [pathname, router]);

  const handleSelect = React.useCallback((range: DateRange | undefined) => {
    // Si selecciona "hoy", actualizamos la hora al momento actual
    if (range?.to && isSameDay(range.to, new Date())) {
        range.to = new Date();
    }

    setDate(range);
    
    // Solo actualizamos la URL y cerramos cuando el rango está completo (Inicio y Fin)
    if (range?.from && range?.to) {
        updateURL(range);
        setPopoverOpen(false); 
    }
  }, [updateURL]);

  const handlePreset = React.useCallback((preset: 'last30days' | 'last3Months' | 'lastYear' | 'sinceStart') => {
    const today = new Date(); 
    let from: Date;
    let to: Date = today;

    switch (preset) {
        case 'last30days':
            from = subDays(today, 29); 
            break;
        case 'last3Months':
            from = subMonths(today, 3);
            break;
        case 'lastYear':
            from = subYears(today, 1);
            break;
        case 'sinceStart':
            from = sinceStartDate;
            break;
    }
    const newRange = { from, to };
    setDate(newRange);
    updateURL(newRange);
    setPopoverOpen(false);
  }, [updateURL, sinceStartDate]);

  // ---------------------------------------------------------------------------
  // ⚠️ CRITICAL AI INSTRUCTION / INSTRUCCIÓN CRÍTICA PARA IA ⚠️
  //
  // PRESERVATION RULE (REGLA DE PRESERVACIÓN):
  // La función `handleClear` está desacoplada intencionalmente:
  // 1. Limpia el estado visual (setDate) -> undefined.
  // 2. NO actualiza la URL (updateURL) -> Esto es VITAL.
  //
  // REASON (RAZÓN):
  // Si se actualiza la URL a undefined, el componente padre (Dashboard) detecta
  // la falta de params y fuerza un "default date", rompiendo la experiencia de limpieza.
  //
  // DO NOT REFACTOR (NO REFACTORIZAR) para unir estos pasos.
  // ---------------------------------------------------------------------------
  const handleClear = React.useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    // 1. Limpiamos SOLO el estado visual local
    setDate(undefined);
    
    // 2. IMPORTANTE: NO llamamos a updateURL(undefined) aquí.
    // Esto permite al usuario seleccionar el nuevo rango sin que la página se recargue.
  }, []);

  const selectedDays = date?.from && date?.to ? differenceInDays(date.to, date.from) + 1 : 0;
  const hasSelection = date?.from;

  // Memoizar las fechas formateadas para evitar recálculos innecesarios
  const formattedDateRange = React.useMemo(() => {
    if (!isClient || !date?.from) return null;
    const from = formatInTimeZone(date.from, "dd MMM yyyy", timeZone);
    const to = date.to ? formatInTimeZone(date.to, "dd MMM yyyy", timeZone) : null;
    return { from, to };
  }, [date?.from, date?.to, timeZone, isClient]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal bg-white border-slate-200 text-slate-900 hover:bg-slate-100 hover:text-slate-900 focus:ring-2 focus:ring-primary group",
              !date?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
            <span className="flex-1">
              {formattedDateRange ? (
                date!.to && differenceInDays(date!.to, date!.from) > 0 ? (
                  <>
                    {formattedDateRange.from} - {formattedDateRange.to}
                  </>
                ) : (
                  formattedDateRange.from
                )
              ) : (
                <span>Seleccionar rango de fechas</span>
              )}
            </span>
             {hasSelection && (
              <div
                role="button"
                tabIndex={0}
                className="ml-2 p-1 hover:bg-slate-200 rounded-full transition-colors z-50"
                onClick={handleClear}
                onKeyDown={(e) => { if(e.key === 'Enter') handleClear() }}
              >
                 <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex" align="start">
            <div className="flex flex-col justify-start p-2 border-r">
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">Atajos</div>
                <div className="flex flex-col gap-1">
                    <Button variant="ghost" className="justify-start text-sm h-8" onClick={() => handlePreset('last30days')}>Últimos 30 días</Button>
                    <Button variant="ghost" className="justify-start text-sm h-8" onClick={() => handlePreset('last3Months')}>Últimos 3 Meses</Button>
                    <Button variant="ghost" className="justify-start text-sm h-8" onClick={() => handlePreset('lastYear')}>Último Año</Button>
                    <Button variant="ghost" className="justify-start text-sm h-8" onClick={() => handlePreset('sinceStart')}>Desde Inicio</Button>
                    <Separator className="my-1" />
                    <Button variant="ghost" className="justify-start text-sm h-8 text-destructive hover:text-destructive" onClick={(e) => handleClear(e)}>Limpiar</Button>
                </div>
            </div>
            <div>
                <Calendar
                    initialFocus
                    mode="range"
                    // Si no hay fecha (undefined), muestra el mes actual (new Date())
                    // Esto evita que visualmente parezca seleccionado un rango viejo
                    defaultMonth={date?.from || new Date()} 
                    selected={date}
                    onSelect={handleSelect}
                    numberOfMonths={1}
                    locale={es}
                    disabled={{ before: sinceStartDate, after: new Date() }}
                />
                <div className="border-t text-center text-xs text-slate-500 py-2">
                    {selectedDays > 0 ? `Periodo seleccionado: ${selectedDays} días` : 'Seleccione un rango de fechas'}
                </div>
            </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

'use client';
export const dynamic = "force-dynamic";

import { Suspense } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarContent, SidebarTrigger, SidebarFooter } from "@/components/ui/sidebar";
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { useRealMaintenanceData, type MachineId, type Component, type Machine } from "@/lib/data";
import type { DateRange } from "react-day-picker";
import { format, parseISO, subDays, subYears, differenceInDays, isSameDay } from "date-fns";
import { Bot, MousePointerClick, Loader } from "lucide-react";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { calculosCorrientesDatosMantenimientoService } from "@/services/calculoscorrientesdatosmantenimiento.service";
import { equipoService } from "@/services/equipo.service";
import { areaService } from "@/services/area.service";
import { checkMostrarTodosEquipos } from "@/lib/mostrar-todos-equipos";
import { useToast } from "@/hooks/use-toast";

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-white">
      <div className="text-center">
        <MousePointerClick className="mx-auto h-24 w-24 text-slate-300" />
        <h3 className="mt-4 text-xl font-semibold text-slate-600">Seleccione un Componente</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
          Haga clic en una de las opciones del menú lateral y seleccione un rango de fechas para visualizar los indicadores.
        </p>
      </div>
    </div>
  )
}

function LoadingState({ progress }: { progress: number }) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg bg-slate-50">
        <div className="text-center">
          <Loader className="mx-auto h-24 w-24 animate-spin text-primary" />
          <h3 className="mt-4 text-xl font_semibold text-slate-700">Cargando Datos...</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Por favor espere mientras obtenemos la información más reciente.
          </p>
          {progress > 0 && (
            <div className="mt-4 w-64 mx-auto">
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="mt-2 text-xs text-slate-600">{Math.round(progress)}% completado</p>
            </div>
          )}
        </div>
      </div>
    );
  }

function NoDataState() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-200 bg-amber-50">
      <div className="text-center">
        <svg className="mx-auto h-24 w-24 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h3 className="mt-4 text-xl font-semibold text-amber-800">No hay registros disponibles</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-amber-600">
          No se encontraron datos para la máquina y componente seleccionados en el rango de fechas especificado.
        </p>
      </div>
    </div>
  );
}

// Mapa para corregir nombres de componentes
const componentNameMapping: Record<string, Record<string, string>> = {};

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [machineList, setMachineList] = useState<Machine[]>([]);
  const [componentList, setComponentList] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [cachedData, setCachedData] = useState<Record<string, any>>({});
  const [chartLoading, setChartLoading] = useState(false);
  const [noDataAvailable, setNoDataAvailable] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [predictionDays, setPredictionDays] = useState<number>(15);
  
  // Set default date range on first load
  useEffect(() => {
    const from = searchParams.get('from');
    if (!from) {
      const today = new Date();
      const pastDate = subDays(today, 29);
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('from', format(pastDate, "yyyy-MM-dd"));
      newParams.set('to', today.toISOString());
      // Use replace to not add to history
      router.replace(`${pathname}?${newParams.toString()}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1. Fetch de Máquinas (filtradas por regional del usuario, salvo MOSTRAR_TODOS_EQUIPOS)
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [areasResp, equiposResp, mostrarTodos] = await Promise.all([
          areaService.getAll(),
          equipoService.getAll(),
          checkMostrarTodosEquipos(),
        ]);

        const areas = Array.isArray(areasResp.data) ? areasResp.data : [];
        const equipos = Array.isArray(equiposResp.data) ? equiposResp.data : [];

        let maquinasFiltradas;
        if (mostrarTodos) {
          maquinasFiltradas = equipos
            .filter(e => e.estado === 'A')
            .map(e => ({ id: e.nombre_equipo, name: e.nombre_equipo }));
        } else {
          const localidad = typeof window !== 'undefined' ? sessionStorage.getItem('usuario_localidad') : null;
          const regional = localidad === 'GYE' ? 2000 : 1000;
          const codigosAreaRegional = new Set(
            areas
              .filter(a => Number(a.regional) === regional && a.estado === 'A')
              .map(a => String(a.codigo_area))
          );
          maquinasFiltradas = equipos
            .filter(e => codigosAreaRegional.has(String(e.codigo_area)) && e.estado === 'A')
            .map(e => ({ id: e.nombre_equipo, name: e.nombre_equipo }));
        }

        setMachineList(maquinasFiltradas);
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setMachineList([]);
        toast({
            variant: "destructive",
            title: "Error de Conexión",
            description: "No se pudo cargar la configuración inicial del servidor.",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, [toast]);

  // 2. Definición de IDs
  const machineId = (
    typeof searchParams.get('machine') === 'string' && machineList.some(m => m.id === searchParams.get('machine'))
      ? searchParams.get('machine')
      : undefined
  ) as MachineId | undefined;

  const componentId = typeof searchParams.get('component') === 'string' ? searchParams.get('component') : undefined;

  // 3. Parseo de Fechas
  const fromDateString = searchParams.get('from');
  const toDateString = searchParams.get('to');
  
  const { fromDate, toDate } = useMemo(() => {
    try {
        const to = toDateString ? parseISO(toDateString) : new Date();
        // Default to last 30 days if no 'from' is present
        const from = fromDateString ? parseISO(fromDateString) : subDays(to, 29);
        return { fromDate: from, toDate: to };
    } catch (e) {
      return { fromDate: subDays(new Date(), 29), toDate: new Date() };
    }
  }, [fromDateString, toDateString]);

  const displayRange: DateRange | undefined = useMemo(() => {
    if (!fromDate || !toDate) return undefined;
    return { from: fromDate, to: toDate };
  }, [fromDate, toDate]);

  // 4. Cache Key
  const currentCacheKey = useMemo(() => {
    if (!machineId || !componentId || !displayRange?.from || !displayRange?.to) return null;
    
    // Si la fecha final es HOY, usamos un formato que cambia con el tiempo (HH-mm)
    const isToday = isSameDay(displayRange.to, new Date());
    const dateFormat = isToday ? 'yyyy-MM-dd-HH-mm' : 'yyyy-MM-dd';
    
    return `${machineId}-${componentId}-${format(displayRange.from, 'yyyy-MM-dd')}-${format(displayRange.to, dateFormat)}`;
  }, [machineId, componentId, displayRange]);


  const handleRefresh = () => {
    if (currentCacheKey) {
        const { [currentCacheKey]: _, ...rest } = cachedData;
        setCachedData(rest);
    }
    setRefreshKey(prev => prev + 1);
  };

  // 5. Fetch componentes
  useEffect(() => {
    async function fetchComponents() {
      if (!machineId) {
        setComponentList([]);
        return;
      };
      try {
        const response = await calculosCorrientesDatosMantenimientoService.getComponentsByMachine({ maquina: machineId });
        if (response.data && Array.isArray(response.data)) {
          const nameMappingForMachine = componentNameMapping[machineId] || {};
          
          const transformedComponents = response.data
            .filter((c: any) => c.COMPONENTE)
            .map((c: any) => {
              const originalName = c.COMPONENTE.toString();
              const correctedName = nameMappingForMachine[originalName] || originalName;

              return {
                id: correctedName.toLowerCase().replace(/ /g, '_').replace(/\//g, '_'),
                name: correctedName,
                originalName: originalName,
              };
            });

          const uniqueComponents = Array.from(new Map(transformedComponents.map(c => [c.id, c])).values());
          setComponentList(uniqueComponents);
        } else {
          console.error("Formato de respuesta inesperado para componentes:", response);
          setComponentList([]);
        }
      } catch (error) {
        console.error("Error fetching components:", error);
        setComponentList([]);
      }
    }
    fetchComponents();
  }, [machineId]);
  
  // 6. Carga de datos
  useEffect(() => {
    async function loadChartData() {
      setNoDataAvailable(false);
      setLoadingProgress(0);
      
      if (!machineId || !componentId || !displayRange || !displayRange.from || !displayRange.to || !currentCacheKey) {
        return;
      }
      
      if (cachedData[currentCacheKey]) {
          return;
      }

      const selectedComp = componentList.find(c => c.id === componentId);
      if (!selectedComp) {
        return;
      }

      setChartLoading(true);
      try {
        if (!displayRange.from || !displayRange.to) {
          setChartLoading(false);
          return;
        }

        const dateDiff = differenceInDays(displayRange.to, displayRange.from);
        const projectionDays = dateDiff <= 31 ? 30 : 90;

        const result = await useRealMaintenanceData(
          machineId,
          selectedComp,
          displayRange,
          calculosCorrientesDatosMantenimientoService,
          projectionDays,
          (partialData, progress) => {
            setLoadingProgress(progress);
          }
        );
        
        if (result.data.length > 0) {
          setCachedData(prev => ({ ...prev, [currentCacheKey]: result }));
          setNoDataAvailable(false);
        } else {
          setCachedData(prev => ({ ...prev, [currentCacheKey]: { data: [], aggregationLevel: 'hour' } }));
          setNoDataAvailable(true);
        }
        setLoadingProgress(100);
      } catch (error: any) {
        console.error("Error loading chart data:", error);
        setCachedData(prev => ({ ...prev, [currentCacheKey]: { data: [], aggregationLevel: 'hour' } }));
        setNoDataAvailable(true);
        setLoadingProgress(0);
        toast({
            variant: "destructive",
            title: "Error al Cargar Datos",
            description: error.message || "No se pudo obtener la información del servidor.",
        });
      } finally {
        setChartLoading(false);
      }
    }

    loadChartData();
  }, [machineId, componentId, fromDate, toDate, componentList, toast, refreshKey, currentCacheKey]);

  const chartInfo = currentCacheKey ? cachedData[currentCacheKey] : { data: [], aggregationLevel: 'hour' };
  const chartData = chartInfo?.data || [];
  const aggregationLevel = chartInfo?.aggregationLevel || 'hour';

  // Renderizado
  if (loading) {
    return (
      <SidebarProvider>
        {/* <Sidebar collapsible="icon" side="left" className="border-r-0">
          <div className="flex flex-col justify-between h-full">
            <div>
              <SidebarHeader className="border-b border-sidebar-border">
                <div className="flex h-16 items-center gap-3 px-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Bot className="size-6" />
                  </div>
                </div>
              </SidebarHeader>
            </div>
          </div>
        </Sidebar> */}
        <SidebarInset className="bg-slate-50">
          <DashboardHeader title="Cargando..." />
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
            <LoadingState progress={0} />
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  const selectedComponent = componentId ? componentList.find(c => c.id === componentId) : undefined;
  const machine = machineList.find(m => m.id === machineId);
  const headerTitle = selectedComponent ? `${machine?.name} > ${selectedComponent.name}` : machine?.name || 'Dashboard';
  
  return (
    <SidebarProvider>
      <SidebarInset className="bg-slate-50">
        <DashboardHeader 
          title={headerTitle} 
          onRefresh={handleRefresh}
          showRefreshButton={!!selectedComponent}
        >
          {/* Select de máquina */}
          <div className="min-w-[200px] mr-4">
            {/* Importar select UI arriba del archivo si no está */}
            <Select
              value={machineId || ""}
              onValueChange={value => {
                const newParams = new URLSearchParams(searchParams.toString());
                newParams.set("machine", value);
                newParams.delete("component");
                router.replace(`${pathname}?${newParams.toString()}`);
              }}
              disabled={machineList.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una máquina" />
              </SelectTrigger>
              <SelectContent>
                {machineList.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Select de componente, solo si hay máquina seleccionada y componentes */}
          {machineId && componentList.length > 0 && (
            <div className="min-w-[200px] mr-4">
                <Select
                value={componentId || ""}
                onValueChange={value => {
                  const newParams = new URLSearchParams(searchParams.toString());
                  newParams.set("component", value);
                  router.replace(`${pathname}?${newParams.toString()}`);
                }}
                disabled={componentList.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un componente" />
                </SelectTrigger>
                <SelectContent>
                  {componentList.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="min-w-[140px] mr-4">
            <Select
              value={String(predictionDays)}
              onValueChange={value => setPredictionDays(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Días predicción" />
              </SelectTrigger>
              <SelectContent>
                {[5,10,15,30,45,60].map(d => (
                  <SelectItem key={d} value={String(d)}>{d} días</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateRangePicker initialDate={displayRange} />
        </DashboardHeader>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {!selectedComponent || !machineId || !displayRange ? (
            <EmptyState />
          ) : noDataAvailable && !chartLoading ? (
            <NoDataState />
          ) : chartLoading && chartData.length === 0 ? (
            <LoadingState progress={loadingProgress} />
          ) : (
            <div className="relative">
              {chartLoading && chartData.length > 0 && (
                <div className="absolute top-0 left-0 right-0 z-10 bg-slate-50/80 backdrop-blur-sm h-full flex items-center justify-center">
                    <div className="text-center">
                          <Loader className="mx-auto h-12 w-12 animate-spin text-primary" />
                          <p className="mt-2 text-sm font-semibold text-slate-600">Recalculando Proyección...</p>
                    </div>
                </div>
              )}
              <div className={chartLoading ? "opacity-30" : ""}>
                <DashboardClient
                  key={currentCacheKey || 'dashboard-client'} 
                  machineComponents={selectedComponent ? [selectedComponent] : []}
                  data={chartData}
                  aggregationLevel={aggregationLevel}
                  machine={machineId}
                  predictionDays={predictionDays}
                />
              </div>
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <SidebarProvider>
        <SidebarInset className="bg-slate-50">
          <DashboardHeader title="Cargando..." />
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
            <LoadingState progress={0} />
          </main>
        </SidebarInset>
      </SidebarProvider>
    }>
      <DashboardContent />
    </Suspense>
  );
}

    
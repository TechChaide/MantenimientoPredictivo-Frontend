
'use client';
export const dynamic = "force-dynamic";

import { Suspense } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarContent, SidebarTrigger, SidebarFooter } from "@/components/ui/sidebar";
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { useRealMaintenanceData, aggregateDataByDateTime, type MachineId, type Component, type Machine } from "@/lib/data";
import type { DateRange } from "react-day-picker";
import { format, parseISO, subDays, subYears, differenceInDays, isSameDay } from "date-fns";
import { Bot, MousePointerClick, Loader, ChevronLeft } from "lucide-react";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { calculosCorrientesDatosMantenimientoService } from "@/services/calculoscorrientesdatosmantenimiento.service";
import { equipoService } from "@/services/equipo.service";
import { areaService } from "@/services/area.service";
import { componenteService } from "@/services/componente.service";
import { checkMostrarTodosEquipos } from "@/lib/mostrar-todos-equipos";
import { useToast } from "@/hooks/use-toast";
import type { Area, Equipo, Componente } from "@/types/interfaces";

// Normaliza nombres para poder cruzar el "COMPONENTE" que devuelve el endpoint
// de analítica (texto libre) contra `nombre_componente` del maestro de componentes.
const normalizeCompName = (s: string) => (s || "").toString().trim().toLowerCase();

type DashboardStep = 1 | 2 | 3 | 4 | 5 | 6;

const DASHBOARD_STEPS: { number: DashboardStep; title: string }[] = [
  { number: 1, title: "Área" },
  { number: 2, title: "Máquina" },
  { number: 3, title: "Componente" },
  { number: 4, title: "Días de Predicción" },
  { number: 5, title: "Calendario" },
  { number: 6, title: "Gráfica" },
];

const PREDICTION_DAYS_OPTIONS = [5, 10, 15, 30, 45, 60];

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
  const [areas, setAreas] = useState<Area[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [componentes, setComponentes] = useState<Componente[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<DashboardStep>(1);
  const [stepperInitialized, setStepperInitialized] = useState(false);
  const [componentList, setComponentList] = useState<Component[]>([]);
  const [componentsLoading, setComponentsLoading] = useState(false);
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

  // 1. Fetch de Áreas y Equipos (filtrados por regional del usuario, salvo MOSTRAR_TODOS_EQUIPOS)
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [areasResp, equiposResp, componentesResp, mostrarTodos] = await Promise.all([
          areaService.getAll(),
          equipoService.getAll(),
          componenteService.getAll(),
          checkMostrarTodosEquipos(),
        ]);

        const allAreas = Array.isArray(areasResp.data) ? areasResp.data : [];
        const allEquipos = Array.isArray(equiposResp.data) ? equiposResp.data : [];
        const allComponentes = Array.isArray(componentesResp.data) ? componentesResp.data : [];

        let equiposFiltrados: Equipo[];
        let areasFiltradas: Area[];
        if (mostrarTodos) {
          equiposFiltrados = allEquipos.filter(e => e.estado === 'A');
          areasFiltradas = allAreas.filter(a => a.estado === 'A');
        } else {
          const localidad = typeof window !== 'undefined' ? sessionStorage.getItem('usuario_localidad') : null;
          const regional = localidad === 'GYE' ? 2000 : 1000;
          const codigosAreaRegional = new Set(
            allAreas
              .filter(a => Number(a.regional) === regional && a.estado === 'A')
              .map(a => String(a.codigo_area))
          );
          equiposFiltrados = allEquipos.filter(e => codigosAreaRegional.has(String(e.codigo_area)) && e.estado === 'A');
          areasFiltradas = allAreas.filter(a => codigosAreaRegional.has(String(a.codigo_area)));
        }

        // Solo máquinas que realmente tengan componentes con datos analíticos
        // (si la máquina no está siendo medida por sensores, no debe aparecer
        // para elegir en este wizard — confirmado con mantenimiento) Y que además
        // tengan al menos un componente que NO admita registro manual (los
        // componentes de registro manual no se miden por sensor, así que no
        // corresponden a este dashboard predictivo).
        const equiposConDatos = await Promise.all(
          equiposFiltrados.map(async (e) => {
            try {
              const resp = await calculosCorrientesDatosMantenimientoService.getComponentsByMachine({ maquina: e.nombre_equipo });
              const nombresConDatos: string[] = Array.isArray(resp?.data)
                ? resp.data.filter((c: any) => c.COMPONENTE).map((c: any) => normalizeCompName(c.COMPONENTE.toString()))
                : [];
              if (nombresConDatos.length === 0) return null;

              const componentesDelEquipo = allComponentes.filter(c => c.codigo_equipo === e.codigo_equipo);
              const tieneComponenteSensor = nombresConDatos.some(nombreDatos => {
                const match = componentesDelEquipo.find(c => normalizeCompName(c.nombre_componente) === nombreDatos);
                // Si no hay un registro correspondiente en el maestro de componentes,
                // se asume que sí es de sensor (no hay forma de confirmar que es manual).
                return !match || match.admite_registros_manuales !== true;
              });
              return tieneComponenteSensor ? e : null;
            } catch {
              return null;
            }
          })
        );
        equiposFiltrados = equiposConDatos.filter((e): e is Equipo => e !== null);

        // Solo áreas que efectivamente tengan al menos un equipo disponible (con datos)
        areasFiltradas = areasFiltradas.filter(a => equiposFiltrados.some(e => String(e.codigo_area) === String(a.codigo_area)));

        setEquipos(equiposFiltrados);
        setAreas(areasFiltradas);
        setComponentes(allComponentes);
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setEquipos([]);
        setAreas([]);
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

  // 2. Definición de IDs (machineId se valida contra TODOS los equipos disponibles,
  // no solo los del área elegida, para poder saltar el wizard si ya viene en la URL)
  const machineId = (
    typeof searchParams.get('machine') === 'string' && equipos.some(e => e.nombre_equipo === searchParams.get('machine'))
      ? searchParams.get('machine')
      : undefined
  ) as MachineId | undefined;

  const componentId = typeof searchParams.get('component') === 'string' ? searchParams.get('component') : undefined;

  // Lista de máquinas del área seleccionada (para el Paso 2)
  const machineList: Machine[] = useMemo(
    () => equipos.filter(e => String(e.codigo_area) === selectedArea).map(e => ({ id: e.nombre_equipo, name: e.nombre_equipo })),
    [equipos, selectedArea]
  );

  // Si ya hay una máquina válida en la URL, deducir a qué área pertenece (para poder saltar el wizard)
  useEffect(() => {
    if (machineId && !selectedArea) {
      const eq = equipos.find(e => e.nombre_equipo === machineId);
      if (eq) setSelectedArea(String(eq.codigo_area));
    }
  }, [machineId, equipos, selectedArea]);

  // Decide si hay que mostrar el wizard o saltar directo al dashboard (URL ya con machine+component válidos)
  useEffect(() => {
    if (stepperInitialized || loading) return;
    if (!machineId) { setStepperInitialized(true); return; }
    if (componentsLoading) return;
    if (componentId && componentList.some(c => c.id === componentId)) {
      setCurrentStep(6);
    }
    setStepperInitialized(true);
  }, [stepperInitialized, loading, machineId, componentId, componentsLoading, componentList]);

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
      setComponentsLoading(true);
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

          // Excluir componentes que admiten registro manual: no se miden por
          // sensor, así que no corresponden a este dashboard predictivo.
          const equipoActual = equipos.find(e => e.nombre_equipo === machineId);
          const componentesDelEquipo = equipoActual ? componentes.filter(c => c.codigo_equipo === equipoActual.codigo_equipo) : [];
          const soloSensores = transformedComponents.filter(c => {
            const match = componentesDelEquipo.find(cc => normalizeCompName(cc.nombre_componente) === normalizeCompName(c.originalName));
            return !match || match.admite_registros_manuales !== true;
          });

          const uniqueComponents = Array.from(new Map(soloSensores.map(c => [c.id, c])).values());
          setComponentList(uniqueComponents);
        } else {
          console.error("Formato de respuesta inesperado para componentes:", response);
          setComponentList([]);
        }
      } catch (error) {
        console.error("Error fetching components:", error);
        setComponentList([]);
      } finally {
        setComponentsLoading(false);
      }
    }
    fetchComponents();
  }, [machineId, equipos, componentes]);
  
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
            // Se va pintando el gráfico a medida que llegan las páginas de la
            // API (en vez de esperar a que terminen todas). Los datos reales
            // aparecen de a poco; la tendencia/proyección se agrega recién al
            // final, cuando ya se tienen todas las páginas.
            if (partialData.length > 0) {
              setCachedData(prev => ({
                ...prev,
                [currentCacheKey]: { data: aggregateDataByDateTime(partialData), aggregationLevel: 'hour' },
              }));
            }
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
  // Buscar la máquina directamente en `equipos` (no en `machineList`, que ya viene filtrada por área)
  // para que el título no dependa del timing de `selectedArea`.
  const machine = machineId ? { id: machineId, name: machineId } as Machine : undefined;
  const areaSeleccionadaNombre = areas.find(a => String(a.codigo_area) === selectedArea)?.nombre_area;
  const headerTitle = selectedComponent ? `${machine?.name} > ${selectedComponent.name}` : machine?.name || 'Dashboard';

  return (
    <SidebarProvider>
      <SidebarInset className="bg-slate-50">
        {currentStep === 6 ? (
          <DashboardHeader title={headerTitle} onRefresh={handleRefresh} showRefreshButton={!!selectedComponent} />
        ) : (
          <DashboardHeader title="Configura tu vista" />
        )}
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
            {/* Barra de pasos */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {DASHBOARD_STEPS.map((step, idx) => (
                    <div key={step.number} className="flex items-center shrink-0">
                      <button
                        type="button"
                        disabled={step.number >= currentStep}
                        onClick={() => { if (step.number < currentStep) setCurrentStep(step.number); }}
                        className={`flex items-center gap-2 ${step.number < currentStep ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                            currentStep === step.number
                              ? 'bg-blue-600 text-white'
                              : currentStep > step.number
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {currentStep > step.number ? '✓' : step.number}
                        </span>
                        <span
                          className={`text-sm font-medium whitespace-nowrap ${
                            currentStep === step.number ? 'text-blue-700' : currentStep > step.number ? 'text-gray-700' : 'text-gray-400'
                          }`}
                        >
                          {step.title}
                        </span>
                      </button>
                      {idx < DASHBOARD_STEPS.length - 1 && (
                        <div className={`h-0.5 w-8 sm:w-12 mx-2 shrink-0 ${currentStep > step.number ? 'bg-blue-400' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Paso 1: Área */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Selecciona un Área</h2>
                  <p className="text-sm text-gray-500 mt-1">Elegí el área para continuar</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {areas.map(a => (
                    <button
                      key={a.codigo_area}
                      onClick={() => { setSelectedArea(String(a.codigo_area)); setCurrentStep(2); }}
                      className={`p-6 rounded-2xl border-2 text-left transition-all hover:border-blue-400 hover:shadow-lg ${
                        selectedArea === String(a.codigo_area) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <p className="font-bold text-gray-800">{a.nombre_area}</p>
                    </button>
                  ))}
                  {areas.length === 0 && <p className="text-gray-500 col-span-full">No hay áreas disponibles.</p>}
                </div>
              </div>
            )}

            {/* Paso 2: Máquina */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Selecciona una Máquina</h2>
                    <p className="text-sm text-gray-500 mt-1">Máquinas de {areaSeleccionadaNombre}</p>
                  </div>
                  <button onClick={() => setCurrentStep(1)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors shrink-0">
                    <ChevronLeft className="w-4 h-4" /> Atrás
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {machineList.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        // Se lee window.location.search (siempre al día) en vez del searchParams
                        // de React, que puede quedar un paso atrás si el usuario avanza rápido
                        // entre pasos y todavía no se propagó la navegación anterior.
                        const newParams = new URLSearchParams(window.location.search);
                        newParams.set("machine", m.id);
                        newParams.delete("component");
                        router.replace(`${pathname}?${newParams.toString()}`);
                        setCurrentStep(3);
                      }}
                      className={`p-6 rounded-2xl border-2 text-left transition-all hover:border-blue-400 hover:shadow-lg ${
                        machineId === m.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <p className="font-bold text-gray-800">{m.name}</p>
                    </button>
                  ))}
                  {machineList.length === 0 && <p className="text-gray-500 col-span-full">No hay máquinas disponibles en esta área.</p>}
                </div>
              </div>
            )}

            {/* Paso 3: Componente */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Selecciona un Componente</h2>
                    <p className="text-sm text-gray-500 mt-1">Componentes de {machineId}</p>
                  </div>
                  <button onClick={() => setCurrentStep(2)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors shrink-0">
                    <ChevronLeft className="w-4 h-4" /> Atrás
                  </button>
                </div>
                {componentsLoading ? (
                  <p className="text-gray-500">Cargando componentes...</p>
                ) : componentList.length === 0 ? (
                  <p className="text-gray-500">No hay componentes disponibles para esta máquina.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {componentList.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          const newParams = new URLSearchParams(window.location.search);
                          newParams.set("component", c.id);
                          router.replace(`${pathname}?${newParams.toString()}`);
                          setCurrentStep(4);
                        }}
                        className={`p-6 rounded-2xl border-2 text-left transition-all hover:border-blue-400 hover:shadow-lg ${
                          componentId === c.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <p className="font-bold text-gray-800">{c.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Paso 4: Días de Predicción */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Días de Predicción</h2>
                    <p className="text-sm text-gray-500 mt-1 max-w-xl">
                      Cuántos días hacia adelante se proyecta la tendencia de falla, según el comportamiento histórico reciente del componente.
                    </p>
                  </div>
                  <button onClick={() => setCurrentStep(3)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors shrink-0">
                    <ChevronLeft className="w-4 h-4" /> Atrás
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {PREDICTION_DAYS_OPTIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => { setPredictionDays(d); setCurrentStep(5); }}
                      className={`px-5 py-2.5 rounded-full border-2 font-semibold text-sm transition-all ${
                        predictionDays === d ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                      }`}
                    >
                      {d} días
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Paso 5: Calendario */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Rango de Fechas</h2>
                    <p className="text-sm text-gray-500 mt-1">Elegí el período de datos que querés analizar (por defecto, los últimos 30 días).</p>
                  </div>
                  <button onClick={() => setCurrentStep(4)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors shrink-0">
                    <ChevronLeft className="w-4 h-4" /> Atrás
                  </button>
                </div>
                <DateRangePicker initialDate={displayRange} />
                <div>
                  <Button onClick={() => setCurrentStep(6)}>Ver Dashboard</Button>
                </div>
              </div>
            )}

            {/* Paso 6: Gráfica */}
            {currentStep === 6 && (
              <>
                <div>
                  <button onClick={() => setCurrentStep(5)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Atrás
                  </button>
                </div>
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
              </>
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

    
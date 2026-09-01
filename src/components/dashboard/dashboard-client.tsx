

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { serviciosIAService } from "@/services/serviciosIA.service";
import { useToast } from "@/hooks/use-toast";
import { MetricChart } from "./metric-chart";
import { PredictionChart } from "./prediction-chart";
import { ChartDataPoint, Component } from "@/lib/data";
import React from "react";
import { StatusIndicator, getComponentStatus, ComponentStatus } from "./status-indicator";
import { AnalysisModal } from "./analysis-modal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Loader } from "lucide-react";
import { environment } from "@/environments/environments.prod";

interface DashboardClientProps {
  machineComponents: Component[];
  data: ChartDataPoint[];
  aggregationLevel: 'minute' | 'hour' | 'month';
  machine?: string;
  predictionDays?: number;
}

export function DashboardClient({ machineComponents, data, aggregationLevel, machine, predictionDays = 30 }: DashboardClientProps) {
  const [modalStatus, setModalStatus] = React.useState<ComponentStatus | null>(null);
  const [activeTab, setActiveTab] = React.useState<string>('general');
  const [prophetMap, setProphetMap] = React.useState<Record<string, ChartDataPoint[]>>({});
  const [montecarloMap, setMontecarloMap] = React.useState<Record<string, ChartDataPoint[]>>({});
  const [prophetTrainedAtMap, setProphetTrainedAtMap] = React.useState<Record<string, string | null>>({});
  const [montecarloTrainedAtMap, setMontecarloTrainedAtMap] = React.useState<Record<string, string | null>>({});
  const [loadingMap, setLoadingMap] = React.useState<Record<string, { prophet?: boolean; montecarlo?: boolean }>>({});
  const { toast } = useToast();

  const handleStatusClick = (status: ComponentStatus) => {
    setModalStatus(status);
  };

  const closeModal = () => {
    setModalStatus(null);
  };

  // Listen to global event to close the classification panel if other components request it
  React.useEffect(() => {
    const handler = () => {
      // if Analysis modal or others rely on this, close them; for now close status modal
      setModalStatus(null);
    };
    window.addEventListener('close-classification-panel', handler as EventListener);
    return () => window.removeEventListener('close-classification-panel', handler as EventListener);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    async function fetchForAll() {
      if (activeTab !== 'predictive') return;
      if (!machine || !machineComponents || machineComponents.length === 0) return;

      for (const component of machineComponents) {
        const compName = (component as any).originalName || component.name;
        try {
          const prophetResp = await serviciosIAService.prediccionesProphet(String(machine), compName, Number(predictionDays || 30), 'prophet');
          if (!mounted) return;
          const prophetResults = (prophetResp?.resultados?.[0]?.predicciones || []).map((p: any) => ({
            date: `${p.fecha}T${p.hora.length === 5 ? p.hora + ':00' : p.hora}`,
            isProjection: true,
            componentId: component.name,
            proyeccion_corriente_tendencia: Number(p.prediccion),
            proyeccion_corriente_pesimista: Number(p.limite_inferior_95 ?? p.limite_inferior),
            proyeccion_corriente_optimista: Number(p.limite_superior_95 ?? p.limite_superior),
          }));
          setProphetMap(prev => ({ ...prev, [component.id]: prophetResults }));
          setProphetTrainedAtMap(prev => ({ ...prev, [component.id]: (prophetResp as any)?.entrenado_en ?? null }));
        } catch (err) {
          console.error('Error fetching prophet for', component, err);
          toast({ title: 'Error', description: 'No se pudieron obtener predicciones Prophet.' });
        }

        try {
          const monteResp = await serviciosIAService.prediccionesMonteCarlo(String(machine), compName, Number(predictionDays || 30), 'montecarlo');
          if (!mounted) return;
          const monteResults = (monteResp?.resultados?.[0]?.predicciones || []).map((p: any) => ({
            date: `${p.fecha}T${p.hora.length === 5 ? p.hora + ':00' : p.hora}`,
            isProjection: true,
            componentId: component.name,
            proyeccion_corriente_tendencia: Number(p.prediccion),
            proyeccion_corriente_pesimista: Number(p.limite_inferior_95 ?? p.limite_inferior),
            proyeccion_corriente_optimista: Number(p.limite_superior_95 ?? p.limite_superior),
          }));
          setMontecarloMap(prev => ({ ...prev, [component.id]: monteResults }));
          setMontecarloTrainedAtMap(prev => ({ ...prev, [component.id]: (monteResp as any)?.entrenado_en ?? null }));
        } catch (err) {
          console.error('Error fetching montecarlo for', component, err);
          toast({ title: 'Error', description: 'No se pudieron obtener predicciones Montecarlo.' });
        }
      }
    }

    fetchForAll();
    return () => { mounted = false; };
  }, [activeTab, machineComponents, machine, predictionDays]);

  // Gráfica combinatoria: promedio punto a punto entre Prophet y Montecarlo.
  // Se empareja por timestamp exacto (misma fecha+hora que ya devuelve cada
  // motor para el mismo horizonte de predicción) para conservar la misma
  // densidad de puntos que las gráficas individuales — si se agrupara solo
  // por día se perdería granularidad y el segmento de predicción quedaría
  // comprimido en el eje X (categórico) respecto a Prophet/Montecarlo.
  const combinedMap = React.useMemo(() => {
    const promedio = (a?: number | null, b?: number | null) => {
      const vals = [a, b].filter((v): v is number => v != null && !isNaN(v));
      if (vals.length === 0) return null;
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    };

    const result: Record<string, ChartDataPoint[]> = {};
    const componentIds = new Set([...Object.keys(prophetMap), ...Object.keys(montecarloMap)]);

    componentIds.forEach((id) => {
      const porTimestamp = new Map<string, { prophet?: any; monte?: any }>();
      (prophetMap[id] || []).forEach((p: any) => {
        porTimestamp.set(p.date, { ...(porTimestamp.get(p.date) || {}), prophet: p });
      });
      (montecarloMap[id] || []).forEach((p: any) => {
        porTimestamp.set(p.date, { ...(porTimestamp.get(p.date) || {}), monte: p });
      });

      result[id] = Array.from(porTimestamp.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, { prophet, monte }]) => ({
          date: fecha,
          isProjection: true,
          componentId: prophet?.componentId || monte?.componentId,
          proyeccion_corriente_tendencia: promedio(prophet?.proyeccion_corriente_tendencia, monte?.proyeccion_corriente_tendencia),
          proyeccion_corriente_pesimista: promedio(prophet?.proyeccion_corriente_pesimista, monte?.proyeccion_corriente_pesimista),
          proyeccion_corriente_optimista: promedio(prophet?.proyeccion_corriente_optimista, monte?.proyeccion_corriente_optimista),
        })) as unknown as ChartDataPoint[];
    });

    return result;
  }, [prophetMap, montecarloMap]);

  return (
    <div className="space-y-8">
      {machineComponents.map((component) => {
        const componentData = data; // Data is already filtered by component in page.tsx
        const statusInfo = getComponentStatus(componentData, component.name);
        return (
          <div key={component.id} className="w-full space-y-4">
             <div className="flex items-center gap-3 text-lg font-semibold text-slate-800 -mb-2">
                <div onClick={() => handleStatusClick(statusInfo)} className="cursor-pointer flex items-center gap-3">
                  <StatusIndicator status={statusInfo.status} message={statusInfo.message} />
                </div>
              </div>
            <Card id={`component-${component.id}`} className="w-full rounded-xl shadow-sm">
              <CardHeader>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800 cursor-default">
                        Corriente
                        <Info className="size-4 text-slate-400" />
                      </CardTitle>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Esfuerzo real del motor. Detecta sobrecargas o atascos.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs defaultValue="general" onValueChange={(v) => setActiveTab(String(v))}>
                  <TabsList>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="predictive">Análisis Predictivo (Prophet + Montecarlo)</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general">
                    <MetricChart
                      data={data}
                      aggregationLevel={aggregationLevel}
                      valueKey="Corriente Promedio Suavizado"
                      referenceKey="Referencia Corriente Promedio Suavizado"
                      limitKey="Corriente Máxima"
                      limitLabel="Corriente Max"
                      predictionKey="proyeccion_corriente_tendencia"
                      predictionPesimisticKey="proyeccion_corriente_pesimista"
                      predictionOptimisticKey="proyeccion_corriente_optimista"
                      yAxisLabel="Amperios"
                      componentId={component.name}
                      machine={machine}
                      metric="current"
                    />
                  </TabsContent>

                  <TabsContent value="predictive">
                    <div className="space-y-8">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h2 className="text-base font-semibold text-slate-800">Prophet</h2>
                          {prophetTrainedAtMap[component.id] && (
                            <span className="text-xs text-slate-400">
                              · Modelo entrenado el {new Date(prophetTrainedAtMap[component.id] as string).toLocaleString('es-ES')}
                            </span>
                          )}
                        </div>
                        {!prophetMap[component.id] ? (
                          <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-white">
                            <div className="text-center">
                              <img src={`${environment.basePath}/img/Chaide.svg`} alt="Chaide" className="mx-auto h-14 w-14 mb-3 animate-pulse" />
                              <Loader className="mx-auto h-8 w-8 animate-spin text-primary" />
                              <p className="mt-2 text-sm text-slate-600">Cargando Predicciones Prophet...</p>
                            </div>
                          </div>
                        ) : (
                          <PredictionChart
                            key={`pred-prophet-${component.id}`}
                            historicalData={data}
                            predictionData={prophetMap[component.id] || []}
                            historicalKey="Corriente Promedio Suavizado"
                            title={`prophet-${component.id}`}
                            yAxisLabel="Amperios"
                            accentColor="#dc2626"
                          />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h2 className="text-base font-semibold text-slate-800">Montecarlo</h2>
                          {montecarloTrainedAtMap[component.id] && (
                            <span className="text-xs text-slate-400">
                              · Modelo entrenado el {new Date(montecarloTrainedAtMap[component.id] as string).toLocaleString('es-ES')}
                            </span>
                          )}
                        </div>
                        {!montecarloMap[component.id] ? (
                          <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-white">
                            <div className="text-center">
                              <img src={`${environment.basePath}/img/Chaide.svg`} alt="Chaide" className="mx-auto h-14 w-14 mb-3 animate-pulse" />
                              <Loader className="mx-auto h-8 w-8 animate-spin text-primary" />
                              <p className="mt-2 text-sm text-slate-600">Cargando Predicciones Montecarlo...</p>
                            </div>
                          </div>
                        ) : (
                          <PredictionChart
                            key={`pred-montecarlo-${component.id}`}
                            historicalData={data}
                            predictionData={montecarloMap[component.id] || []}
                            historicalKey="Corriente Promedio Suavizado"
                            title={`montecarlo-${component.id}`}
                            yAxisLabel="Amperios"
                            accentColor="#dc2626"
                          />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h2 className="text-base font-semibold text-slate-800">Combinado (Promedio Prophet + Montecarlo)</h2>
                          {(prophetTrainedAtMap[component.id] || montecarloTrainedAtMap[component.id]) && (
                            <span className="text-xs text-slate-400">
                              · Prophet: {prophetTrainedAtMap[component.id] ? new Date(prophetTrainedAtMap[component.id] as string).toLocaleString('es-ES') : '—'}
                              {' · '}Montecarlo: {montecarloTrainedAtMap[component.id] ? new Date(montecarloTrainedAtMap[component.id] as string).toLocaleString('es-ES') : '—'}
                            </span>
                          )}
                        </div>
                        {(!prophetMap[component.id] || !montecarloMap[component.id]) ? (
                          <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-white">
                            <div className="text-center">
                              <img src={`${environment.basePath}/img/Chaide.svg`} alt="Chaide" className="mx-auto h-14 w-14 mb-3 animate-pulse" />
                              <Loader className="mx-auto h-8 w-8 animate-spin text-primary" />
                              <p className="mt-2 text-sm text-slate-600">Cargando Predicción Combinada...</p>
                            </div>
                          </div>
                        ) : (
                          <PredictionChart
                            key={`pred-combinado-${component.id}`}
                            historicalData={data}
                            predictionData={combinedMap[component.id] || []}
                            historicalKey="Corriente Promedio Suavizado"
                            title={`combinado-${component.id}`}
                            yAxisLabel="Amperios"
                            accentColor="#7c3aed"
                          />
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )
      })}
      
      <AnalysisModal
        isOpen={!!modalStatus}
        onClose={closeModal}
        statusInfo={modalStatus}
      />
    </div>
  );
}

    
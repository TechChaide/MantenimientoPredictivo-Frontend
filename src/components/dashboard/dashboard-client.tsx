

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
        } catch (err) {
          console.error('Error fetching montecarlo for', component, err);
          toast({ title: 'Error', description: 'No se pudieron obtener predicciones Montecarlo.' });
        }
      }
    }

    fetchForAll();
    return () => { mounted = false; };
  }, [activeTab, machineComponents, machine, predictionDays]);

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
                        <h2 className="text-base font-semibold text-slate-800 mb-3">Prophet</h2>
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
                        <h2 className="text-base font-semibold text-slate-800 mb-3">Montecarlo</h2>
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
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            <Card id={`component-${component.id}-unbalance`} className="w-full rounded-xl shadow-sm">
              <CardHeader>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800 cursor-default">
                        Desbalance
                        <Info className="size-4 text-slate-400" />
                      </CardTitle>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Mide la diferencia de voltaje/corriente entre las líneas de alimentación.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardHeader>
              <CardContent className="p-6">
                <MetricChart
                  data={data}
                  aggregationLevel={aggregationLevel}
                  valueKey="Desbalance Suavizado"
                  referenceKey="Referencia Desbalance Suavizado"
                  limitKey="Umbral Desbalance"
                  limitLabel="Umbral Max"
                  predictionKey="proyeccion_desbalance_tendencia"
                  predictionPesimisticKey="proyeccion_desbalance_pesimista"
                  predictionOptimisticKey="proyeccion_desbalance_optimista"
                  yAxisLabel="%"
                  componentId={component.name}
                  machine={machine}
                  metric="unbalance"
                />
              </CardContent>
            </Card>

            <Card id={`component-${component.id}-load_factor`} className="w-full rounded-xl shadow-sm">
              <CardHeader>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800 cursor-default">
                        Factor de Carga
                        <Info className="size-4 text-slate-400" />
                      </CardTitle>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Porcentaje de capacidad utilizada. Indica si el motor es eficiente.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardHeader>
              <CardContent className="p-6">
                <MetricChart
                  data={data}
                  aggregationLevel={aggregationLevel}
                  valueKey="Factor De Carga Suavizado"
                  referenceKey="Referencia Factor De Carga Suavizado"
                  limitKey="Umbral Factor Carga"
                  limitLabel="Umbral Max"
                  predictionKey="proyeccion_factor_carga_tendencia"
                  predictionPesimisticKey="proyeccion_factor_carga_pesimista"
                  predictionOptimisticKey="proyeccion_factor_carga_optimista"
                  yAxisLabel="Factor"
                  componentId={component.name}
                  machine={machine}
                  metric="load_factor"
                />
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

    
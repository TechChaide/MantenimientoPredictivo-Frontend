'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { AlertCircle, Activity, CheckCircle, ChevronLeft, Thermometer, Waves, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { areaService } from '@/services/area.service';
import { equipoService } from '@/services/equipo.service';
import { componenteService } from '@/services/componente.service';
import { registrosService } from '@/services/registros.service';
import { detallesService } from '@/services/detalles.service';
import { checkMostrarTodosEquipos } from '@/lib/mostrar-todos-equipos';
import type { Area, Equipo, Componente, Registros, Detalles } from '@/types/interfaces';

// ── Helpers ───────────────────────────────────────────────────────────────────

const numeroALetra = (n: number) => String.fromCharCode(64 + n);

interface TrendLineData { x: number; y: number; }
interface RegressionResult { m: number; b: number; trendData: TrendLineData[]; r2: number; }

const calcRegression = (pts: { x: number; y: number }[]): RegressionResult => {
  if (pts.length < 2) return { m: 0, b: 0, trendData: [], r2: 0 };
  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p.x, 0);
  const sy = pts.reduce((s, p) => s + p.y, 0);
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sx2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const m = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  const b = (sy - m * sx) / n;
  const minX = Math.min(...pts.map(p => p.x));
  const maxX = Math.max(...pts.map(p => p.x));
  const trendData: TrendLineData[] = [{ x: minX, y: m * minX + b }, { x: maxX, y: m * maxX + b }];
  const meanY = sy / n;
  const ssRes = pts.reduce((s, p) => s + Math.pow(p.y - (m * p.x + b), 2), 0);
  const ssTot = pts.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0);
  return { m, b, trendData, r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot };
};

const interpretarR2 = (r2: number) => {
  if (r2 >= 0.85) return { color: 'text-green-700', bg: 'bg-green-100 border-green-300', icono: '✅', titulo: 'Tendencia muy clara', mensaje: 'Los registros siguen un patrón muy consistente. La línea de tendencia es confiable para anticipar el comportamiento futuro de la máquina.' };
  if (r2 >= 0.60) return { color: 'text-blue-700', bg: 'bg-blue-100 border-blue-300', icono: '📈', titulo: 'Tendencia moderada', mensaje: 'Existe una tendencia visible aunque con cierta variación. Continúa tomando mediciones para confirmar el comportamiento.' };
  if (r2 >= 0.30) return { color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-300', icono: '⚠️', titulo: 'Tendencia débil', mensaje: 'Los valores varían bastante y la tendencia no es clara. Pueden haber factores externos afectando las mediciones.' };
  return { color: 'text-red-700', bg: 'bg-red-100 border-red-300', icono: '🔴', titulo: 'Sin tendencia definida', mensaje: 'No se reconoce un patrón. Puede indicar mediciones irregulares, condiciones muy variables o pocos datos. La línea de tendencia no es útil aquí.' };
};

// ── Data model ────────────────────────────────────────────────────────────────

type ChartPoint = { x: number; y: number; fechaHora: string };

type ChartSeries = {
  orientacion: string;   // "Vertical" | "Horizontal" | "Axial" | "" (temperatura)
  unidades: string;
  data: ChartPoint[];
};

type MedicionGroup = {
  medicion: number;
  tipo: 'vibracion' | 'temperatura';
  charts: ChartSeries[];
};

type ChartFilter = '' | 'temperatura' | 'vibracion';

type Dashboard2Step = 1 | 2 | 3 | 4 | 5;

const DASHBOARD2_STEPS: { number: Dashboard2Step; title: string }[] = [
  { number: 1, title: 'Área' },
  { number: 2, title: 'Equipo' },
  { number: 3, title: 'Componente' },
  { number: 4, title: 'Tipo de Gráfica' },
  { number: 5, title: 'Punto de Medición' },
];

const ORI_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; accent: string }> = {
  Vertical:   { label: 'Vertical',   color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   accent: '#3b82f6' },
  Horizontal: { label: 'Horizontal', color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  accent: '#22c55e' },
  Axial:      { label: 'Axial',      color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', accent: '#a855f7' },
};

const isVibracionOrientacion = (orientacion: string): boolean => {
  const ori = (orientacion || '').trim().toLowerCase();
  return ori === 'vertical' || ori === 'horizontal' || ori === 'axial';
};

function buildGroups(registros: Registros[], detalles: Detalles[]): MedicionGroup[] {
  if (!registros.length || !detalles.length) return [];

  const regMap = new Map<number, Registros>();
  registros.forEach(r => regMap.set(Number(r.codigo_registro), r));

  // medicion → orientacion → unidades → points
  const tree = new Map<number, Map<string, Map<string, ChartPoint[]>>>();

  detalles.forEach(d => {
    const reg = regMap.get(d.codigo_registro);
    if (!reg) return;
    const ms = new Date(d.fecha_medicion || reg.fecha_inicio_evento).getTime();
    const fechaHora = new Date(ms).toLocaleString('es-ES');
    const med = reg.medicion;

    if (!tree.has(med)) tree.set(med, new Map());
    const oriMap = tree.get(med)!;
    if (!oriMap.has(d.orientacion)) oriMap.set(d.orientacion, new Map());
    const unidMap = oriMap.get(d.orientacion)!;
    if (!unidMap.has(d.unidades)) unidMap.set(d.unidades, []);
    unidMap.get(d.unidades)!.push({ x: ms, y: d.valor, fechaHora });
  });

  const result: MedicionGroup[] = [];
  tree.forEach((oriMap, medicion) => {
    const charts: ChartSeries[] = [];
    oriMap.forEach((unidMap, orientacion) => {
      unidMap.forEach((data, unidades) => {
        charts.push({ orientacion, unidades, data: [...data].sort((a, b) => a.x - b.x) });
      });
    });
    const tipo: 'vibracion' | 'temperatura' = charts.some(c => isVibracionOrientacion(c.orientacion)) ? 'vibracion' : 'temperatura';
    result.push({ medicion, tipo, charts });
  });

  return result.sort((a, b) => a.medicion - b.medicion);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard2() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [componentes, setComponentes] = useState<Componente[]>([]);
  const [allComponentes, setAllComponentes] = useState<Componente[]>([]);

  const [selectedArea, setSelectedArea] = useState('');
  const [selectedEquipo, setSelectedEquipo] = useState('');
  const [selectedComponente, setSelectedComponente] = useState('');
  const [currentStep, setCurrentStep] = useState<Dashboard2Step>(1);

  const [registros, setRegistros] = useState<Registros[]>([]);
  const [detalles, setDetalles] = useState<Detalles[]>([]);
  const [medicionGroups, setMedicionGroups] = useState<MedicionGroup[]>([]);
  const [selectedLetra, setSelectedLetra] = useState<string | null>(null);
  const [chartFilter, setChartFilter] = useState<ChartFilter>('');

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load areas
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const [areasRes, equiposRes, componentesRes, mostrarTodos] = await Promise.all([
          areaService.getAll(), equipoService.getAll(), componenteService.getAll(), checkMostrarTodosEquipos(),
        ]);
        const allEquipos = equiposRes.data ?? [];
        const allComponentesData = componentesRes.data ?? [];
        let allAreas = areasRes.data ?? [];
        if (!mostrarTodos) {
          const loc = typeof window !== 'undefined' ? sessionStorage.getItem('usuario_localidad') : null;
          const regional = loc === 'GYE' ? 2000 : 1000;
          allAreas = allAreas.filter(a => Number(a.regional) === regional && a.estado === 'A');
        }
        setAllComponentes(allComponentesData);
        // Un área/equipo se ofrece solo si tiene AL MENOS UN componente que
        // admite registro manual (el flag es por componente, no por equipo)
        const equiposConComponenteManual = new Set(
          allEquipos
            .filter(e => allComponentesData.some(c => c.codigo_equipo === e.codigo_equipo && c.admite_registros_manuales === true))
            .map(e => e.codigo_area)
        );
        setAreas(allAreas.filter(a => equiposConComponenteManual.has(a.codigo_area)));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar áreas');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Load equipos: solo los que tienen al menos un componente que admite registro manual
  useEffect(() => {
    if (!selectedArea) { setEquipos([]); setSelectedEquipo(''); return; }
    equipoService.getAll()
      .then(res => {
        const equiposDelArea = (res.data ?? []).filter(e => e.codigo_area === selectedArea);
        setEquipos(equiposDelArea.filter(e => allComponentes.some(c => c.codigo_equipo === e.codigo_equipo && c.admite_registros_manuales === true)));
        setSelectedEquipo('');
      })
      .catch(() => setEquipos([]));
  }, [selectedArea, allComponentes]);

  // Componentes del equipo seleccionado: solo los que admiten registro manual
  useEffect(() => {
    if (!selectedEquipo) { setComponentes([]); setSelectedComponente(''); return; }
    setComponentes(allComponentes.filter(c => c.codigo_equipo === selectedEquipo && c.admite_registros_manuales === true));
    setSelectedComponente('');
  }, [selectedEquipo, allComponentes]);

  // Load registros + detalles
  useEffect(() => {
    if (!selectedComponente) {
      setRegistros([]); setDetalles([]); setMedicionGroups([]); setSelectedLetra(null); setChartFilter(''); return;
    }
    setChartFilter('');
    (async () => {
      try {
        setIsLoadingData(true);
        const [regRes, detRes] = await Promise.all([
          registrosService.getAll(1, 10000),
          detallesService.getAll(1, 100000),
        ]);
        const filtReg = (regRes.data ?? []).filter(r => r.codigo_componente === selectedComponente);
        const codigos = new Set(filtReg.map(r => Number(r.codigo_registro)));
        const filtDet = (detRes.data ?? []).filter(d => codigos.has(d.codigo_registro));
        setRegistros(filtReg);
        setDetalles(filtDet);
        setMedicionGroups(buildGroups(filtReg, filtDet));
        setSelectedLetra(null);
      } catch (e) {
        console.error('Error loading data:', e);
        setRegistros([]); setDetalles([]); setMedicionGroups([]);
      } finally {
        setIsLoadingData(false);
      }
    })();
  }, [selectedComponente]);

  // ── Chart renderer ────────────────────────────────────────────────────────

  const renderChartContent = (series: ChartSeries, accent: string, keyPrefix: string) => {
    if (!series.data.length) return null;
    const reg = calcRegression(series.data);
    const trend = reg.trendData.map(p => ({ x: p.x, y: parseFloat(p.y.toFixed(3)) }));
    const vals = series.data.map(d => d.y);
    const min = Math.min(...vals), max = Math.max(...vals);
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const r2i = interpretarR2(reg.r2);

    return (
      <div key={keyPrefix} className="space-y-3">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[['Mínimo', min], ['Máximo', max], ['Promedio', avg]].map(([label, val]) => (
            <div key={String(label)} className="rounded-lg p-3 text-center" style={{ backgroundColor: `${accent}18` }}>
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-lg font-bold text-gray-800">{Number(val).toFixed(2)}</p>
              <p className="text-xs text-gray-400">{series.unidades}</p>
            </div>
          ))}
        </div>
        {/* R² */}
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border cursor-help ${r2i.bg} ${r2i.color}`}>
                  {r2i.icono} R² = {(reg.r2 * 100).toFixed(1)}% · {r2i.titulo}
                  <HelpCircle className="w-3 h-3 opacity-60" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-sm p-3">
                <p className="font-bold mb-1">{r2i.icono} {r2i.titulo}</p>
                <p className="text-gray-300 leading-snug">{r2i.mensaje}</p>
                <p className="text-gray-400 text-xs pt-1">R² mide qué tan bien la línea roja describe el comportamiento (0% = nada, 100% = perfecto).</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-xs text-gray-400">{series.data.length} punto{series.data.length !== 1 ? 's' : ''}</span>
        </div>
        {/* Scatter + trend */}
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart margin={{ top: 10, right: 20, bottom: 60, left: 20 }} data={series.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="x" type="number" domain={['dataMin', 'dataMax']}
              tickFormatter={ts => new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
              angle={-40} textAnchor="end" height={75}
            />
            <YAxis label={{ value: series.unidades, angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
            <RechartsTooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg text-sm">
                    <p className="text-xs text-gray-400 mb-1">{payload[0].payload.fechaHora}</p>
                    <p className="font-bold" style={{ color: accent }}>{payload[0].payload.y?.toFixed(3)} {series.unidades}</p>
                  </div>
                ) : null
              }
            />
            <Legend verticalAlign="top" />
            <Scatter dataKey="y" data={series.data} fill={accent} fillOpacity={0.8} name={series.unidades} />
            {trend.length >= 2 && (
              <Line dataKey="y" data={trend} stroke="#ef4444" strokeWidth={2.5} strokeDasharray="6 3" name="Tendencia" isAnimationActive={false} dot={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const filteredGroups = (chartFilter === '' ? [] : medicionGroups)
    .map((group) => {
      const filteredCharts = chartFilter === 'vibracion'
        ? group.charts.filter((c) => isVibracionOrientacion(c.orientacion))
        : group.charts.filter((c) => !isVibracionOrientacion(c.orientacion));

      if (!filteredCharts.length) return null;

      return {
        ...group,
        tipo: chartFilter as 'vibracion' | 'temperatura',
        charts: filteredCharts,
      } as MedicionGroup;
    })
    .filter((g): g is MedicionGroup => g !== null);

  // Disponibilidad real de tipos de gráfica para el componente seleccionado
  const hayTemperatura = medicionGroups.some((g) => g.charts.some((c) => !isVibracionOrientacion(c.orientacion)));
  const hayVibracion = medicionGroups.some((g) => g.charts.some((c) => isVibracionOrientacion(c.orientacion)));

  useEffect(() => {
    if (!selectedLetra) return;
    const existsInFilter = filteredGroups.some((g) => numeroALetra(g.medicion) === selectedLetra);
    if (!existsInFilter) setSelectedLetra(null);
  }, [selectedLetra, filteredGroups]);

  const selectedGroup = selectedLetra
    ? filteredGroups.find((g) => numeroALetra(g.medicion) === selectedLetra) ?? null
    : null;

  const selectedGroupTempCharts = selectedGroup?.charts.filter((c) => !isVibracionOrientacion(c.orientacion)) ?? [];
  const selectedGroupVibCharts = selectedGroup?.charts.filter((c) => isVibracionOrientacion(c.orientacion)) ?? [];

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-8 p-6 md:p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard 2</h1>
        <p className="text-gray-600 mt-2">Análisis de tendencias por componente</p>
      </div>

      {/* Stepper */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {DASHBOARD2_STEPS.map((step, idx) => (
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
                {idx < DASHBOARD2_STEPS.length - 1 && (
                  <div className={`h-0.5 w-8 sm:w-12 mx-2 shrink-0 ${currentStep > step.number ? 'bg-blue-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
          {(selectedArea || selectedEquipo || selectedComponente || chartFilter) && (
            <p className="text-xs text-gray-500 mt-3 truncate">
              {areas.find(a => a.codigo_area === selectedArea)?.nombre_area}
              {selectedEquipo && ` › ${equipos.find(e => e.codigo_equipo === selectedEquipo)?.nombre_equipo ?? ''}`}
              {selectedComponente && ` › ${componentes.find(c => c.codigo_componente === selectedComponente)?.nombre_componente ?? ''}`}
              {chartFilter && ` › ${chartFilter === 'temperatura' ? 'Temperatura' : 'Vibración'}`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Alerts generales */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">Error: {error}</AlertDescription>
        </Alert>
      )}
      {(isLoading || isLoadingData) && (
        <Alert><Activity className="h-4 w-4" /><AlertDescription>Cargando datos...</AlertDescription></Alert>
      )}
      {!isLoading && !isLoadingData && currentStep === 5 && filteredGroups.length > 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {registros.length} registro(s) · {detalles.length} detalle(s) cargados · {filteredGroups.length} punto(s) visible(s)
          </AlertDescription>
        </Alert>
      )}
      {!isLoading && !isLoadingData && currentStep === 5 && chartFilter !== '' && medicionGroups.length > 0 && filteredGroups.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">No hay gráficas para el filtro seleccionado.</AlertDescription>
        </Alert>
      )}

      {/* Paso 1: Área */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Selecciona un Área</h2>
            <p className="text-sm text-gray-500 mt-1">Elegí el área para continuar</p>
          </div>
          {!isLoading && areas.length === 0 ? (
            <Alert><AlertCircle className="h-4 w-4 text-yellow-600" /><AlertDescription className="text-yellow-800">No hay áreas disponibles.</AlertDescription></Alert>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {areas.map(a => (
                <button
                  key={a.codigo_area}
                  onClick={() => { setSelectedArea(a.codigo_area); setCurrentStep(2); }}
                  className={`p-6 rounded-2xl border-2 text-left transition-all hover:border-blue-400 hover:shadow-lg ${
                    selectedArea === a.codigo_area ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className="font-bold text-gray-800">{a.nombre_area}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Paso 2: Equipo */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Selecciona un Equipo</h2>
              <p className="text-sm text-gray-500 mt-1">Equipos de {areas.find(a => a.codigo_area === selectedArea)?.nombre_area}</p>
            </div>
            <button onClick={() => setCurrentStep(1)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors shrink-0">
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>
          </div>
          {equipos.length === 0 ? (
            <Alert><AlertCircle className="h-4 w-4 text-yellow-600" /><AlertDescription className="text-yellow-800">No hay equipos que admitan registros manuales en esta área.</AlertDescription></Alert>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {equipos.map(e => (
                <button
                  key={e.codigo_equipo}
                  onClick={() => { setSelectedEquipo(e.codigo_equipo); setCurrentStep(3); }}
                  className={`p-6 rounded-2xl border-2 text-left transition-all hover:border-blue-400 hover:shadow-lg ${
                    selectedEquipo === e.codigo_equipo ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className="font-bold text-gray-800">{e.nombre_equipo}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Paso 3: Componente */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Selecciona un Componente</h2>
              <p className="text-sm text-gray-500 mt-1">Componentes de {equipos.find(e => e.codigo_equipo === selectedEquipo)?.nombre_equipo}</p>
            </div>
            <button onClick={() => setCurrentStep(2)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors shrink-0">
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>
          </div>
          {componentes.length === 0 ? (
            <Alert><AlertCircle className="h-4 w-4 text-yellow-600" /><AlertDescription className="text-yellow-800">Este equipo no tiene componentes disponibles.</AlertDescription></Alert>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {componentes.map(c => (
                <button
                  key={c.codigo_componente}
                  onClick={() => { setSelectedComponente(c.codigo_componente); setCurrentStep(4); }}
                  className={`p-6 rounded-2xl border-2 text-left transition-all hover:border-blue-400 hover:shadow-lg ${
                    selectedComponente === c.codigo_componente ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className="font-bold text-gray-800">{c.nombre_componente}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Paso 4: Tipo de Gráfica — solo se ofrecen los tipos con datos reales */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Selecciona el Tipo de Gráfica</h2>
              <p className="text-sm text-gray-500 mt-1">Solo se muestran los tipos con datos registrados para este componente</p>
            </div>
            <button onClick={() => setCurrentStep(3)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors shrink-0">
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>
          </div>
          {isLoadingData ? (
            <Alert><Activity className="h-4 w-4" /><AlertDescription>Cargando datos del componente...</AlertDescription></Alert>
          ) : medicionGroups.length === 0 ? (
            <Alert><AlertCircle className="h-4 w-4 text-yellow-600" /><AlertDescription className="text-yellow-800">No hay datos registrados para este componente.</AlertDescription></Alert>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              {hayTemperatura && (
                <button
                  onClick={() => { setChartFilter('temperatura'); setCurrentStep(5); }}
                  className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-all group"
                >
                  <div className="w-16 h-16 rounded-full bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center transition-colors">
                    <Thermometer className="h-8 w-8 text-orange-500" />
                  </div>
                  <p className="font-bold text-gray-900 text-lg">Temperatura</p>
                </button>
              )}
              {hayVibracion && (
                <button
                  onClick={() => { setChartFilter('vibracion'); setCurrentStep(5); }}
                  className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <div className="w-16 h-16 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                    <Waves className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="font-bold text-gray-900 text-lg">Vibración</p>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Paso 5: Punto de Medición + gráficas */}
      {currentStep === 5 && (
      <>
      {/* ── Navegación por Puntos de Medición ──────────────────────────────── */}
      {filteredGroups.length > 0 && !selectedLetra && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Puntos de Medición</h2>
              <p className="text-sm text-gray-500 mt-1">Selecciona un punto para ver sus gráficas de tendencia</p>
            </div>
            <button onClick={() => setCurrentStep(4)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors shrink-0">
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredGroups.map(group => {
              const letra = numeroALetra(group.medicion);
              const accent = group.tipo === 'vibracion' ? '#3b82f6' : '#f97316';
              const totalPuntos = group.charts.reduce((s, c) => s + c.data.length, 0);
              const orientaciones = [...new Set(group.charts.map(c => c.orientacion).filter(Boolean))];

              return (
                <button
                  key={`nav-${group.medicion}`}
                  onClick={() => setSelectedLetra(letra)}
                  className="group flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer"
                >
                  <div
                    className="flex items-center justify-center w-16 h-16 rounded-full text-white text-3xl font-extrabold shadow-md"
                    style={{ background: `linear-gradient(135deg, ${accent}bb, ${accent})` }}
                  >
                    {letra}
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gray-800">Medición {letra}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {totalPuntos} punto{totalPuntos !== 1 ? 's' : ''} · {group.charts.length} gráfica{group.charts.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {group.tipo === 'vibracion' ? (
                      <>
                        <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                          <Waves className="w-3 h-3" /> Vibración
                        </span>
                        {orientaciones.map(ori => (
                          <span key={ori} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{ori[0]}</span>
                        ))}
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                        <Thermometer className="w-3 h-3" /> Temperatura
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Gráficas de la medición seleccionada ───────────────────────────── */}
      {filteredGroups.length > 0 && selectedGroup && (
          <div className="space-y-6">
            {/* Barra de navegación */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setSelectedLetra(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Volver
              </button>

              {filteredGroups.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Ir a:</span>
                  {filteredGroups.map(g => {
                    const l = numeroALetra(g.medicion);
                    return (
                      <button
                        key={l}
                        onClick={() => setSelectedLetra(l)}
                        className={`w-9 h-9 rounded-full font-bold text-sm transition-all ${l === selectedLetra ? 'bg-blue-600 text-white shadow-md scale-110' : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700'}`}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white font-extrabold text-lg">
                  {selectedLetra}
                </div>
                <span className="text-lg font-bold text-gray-800">Medición {selectedLetra}</span>
                <Badge
                  variant="outline"
                  className={selectedGroupVibCharts.length > 0 ? 'border-blue-300 text-blue-700' : 'border-orange-300 text-orange-700'}
                >
                  {selectedGroupVibCharts.length > 0
                    ? <><Waves className="w-3 h-3 mr-1 inline" />Vibración</>
                    : <><Thermometer className="w-3 h-3 mr-1 inline" />Temperatura</>
                  }
                </Badge>
              </div>
            </div>

            {/* ── Temperatura ──────────────────────────────────────────────── */}
            {selectedGroupTempCharts.length > 0 && (
              <div className="space-y-4">
                {selectedGroupTempCharts.map(series => (
                  <Card key={`temp-${series.unidades}`} className="border-l-4 border-l-orange-400">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500 text-white">
                          <Thermometer className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{series.unidades}</CardTitle>
                          <CardDescription>{series.data.length} registro{series.data.length !== 1 ? 's' : ''}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {renderChartContent(series, '#f97316', `temp-${series.unidades}`)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* ── Vibración — agrupado por orientación ─────────────────────── */}
            {selectedGroupVibCharts.length > 0 && (() => {
              const byOri = new Map<string, ChartSeries[]>();
              selectedGroupVibCharts.forEach(s => {
                if (!byOri.has(s.orientacion)) byOri.set(s.orientacion, []);
                byOri.get(s.orientacion)!.push(s);
              });
              const oriOrder = ['Vertical', 'Horizontal', 'Axial'];
              const sortedOris = [...byOri.keys()].sort((a, b) => {
                const ia = oriOrder.indexOf(a), ib = oriOrder.indexOf(b);
                return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
              });

              return (
                <div className="space-y-8">
                  {sortedOris.map(ori => {
                    const cfg = ORI_CONFIG[ori] ?? { label: ori, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', accent: '#6b7280' };
                    const seriesList = byOri.get(ori)!;

                    return (
                      <div key={ori} className="space-y-3">
                        {/* Orientación header */}
                        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                          <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-xs text-gray-400">—</span>
                          <span className="text-xs text-gray-500">{seriesList.length} gráfica{seriesList.length !== 1 ? 's' : ''}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">{seriesList.reduce((s, c) => s + c.data.length, 0)} puntos totales</span>
                        </div>

                        {/* Gráficas para esta orientación, apiladas a ancho completo (igual que Temperatura) */}
                        <div className="space-y-4">
                          {seriesList.map((series, idx) => (
                            <Card key={`${ori}-${series.unidades}-${idx}`} className="border-l-4" style={{ borderLeftColor: cfg.accent }}>
                              <CardHeader className="pb-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold shrink-0"
                                    style={{ backgroundColor: cfg.accent }}
                                  >
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <CardTitle className="text-sm">{series.unidades}</CardTitle>
                                    <CardDescription className="text-xs">
                                      Valor {idx + 1} · {cfg.label} · {series.data.length} inspección{series.data.length !== 1 ? 'es' : ''}
                                    </CardDescription>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent>
                                {renderChartContent(series, cfg.accent, `${ori}-${series.unidades}-${idx}`)}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
      )}
      </>
      )}
    </div>
  );
}

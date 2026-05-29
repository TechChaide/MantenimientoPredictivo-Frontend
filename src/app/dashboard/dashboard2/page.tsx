'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
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

type ChartFilter = '' | 'all' | 'temperatura' | 'vibracion';

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

  const [selectedArea, setSelectedArea] = useState('');
  const [selectedEquipo, setSelectedEquipo] = useState('');
  const [selectedComponente, setSelectedComponente] = useState('');

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
        const [areasRes, equiposRes, mostrarTodos] = await Promise.all([
          areaService.getAll(), equipoService.getAll(), checkMostrarTodosEquipos(),
        ]);
        const allEquipos = equiposRes.data ?? [];
        let allAreas = areasRes.data ?? [];
        if (!mostrarTodos) {
          const loc = typeof window !== 'undefined' ? sessionStorage.getItem('usuario_localidad') : null;
          const regional = loc === 'GYE' ? 2000 : 1000;
          allAreas = allAreas.filter(a => Number(a.regional) === regional && a.estado === 'A');
        }
        setAreas(allAreas.filter(a => allEquipos.some(e => e.codigo_area === a.codigo_area && e.admite_registros_manuales)));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar áreas');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Load equipos
  useEffect(() => {
    if (!selectedArea) { setEquipos([]); setSelectedEquipo(''); return; }
    equipoService.getAll()
      .then(res => { setEquipos((res.data ?? []).filter(e => e.codigo_area === selectedArea && e.admite_registros_manuales)); setSelectedEquipo(''); })
      .catch(() => setEquipos([]));
  }, [selectedArea]);

  // Load componentes
  useEffect(() => {
    if (!selectedEquipo) { setComponentes([]); setSelectedComponente(''); return; }
    componenteService.getAll()
      .then(res => { setComponentes((res.data ?? []).filter(c => c.codigo_equipo === selectedEquipo)); setSelectedComponente(''); })
      .catch(() => setComponentes([]));
  }, [selectedEquipo]);

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
        <div className="grid grid-cols-3 gap-3">
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
      const filteredCharts = chartFilter === 'all'
        ? group.charts
        : chartFilter === 'vibracion'
          ? group.charts.filter((c) => isVibracionOrientacion(c.orientacion))
          : group.charts.filter((c) => !isVibracionOrientacion(c.orientacion));

      if (!filteredCharts.length) return null;

      const hasVibracion = filteredCharts.some((c) => isVibracionOrientacion(c.orientacion));
      const nextTipo: 'vibracion' | 'temperatura' = hasVibracion ? 'vibracion' : 'temperatura';

      return {
        ...group,
        tipo: nextTipo,
        charts: filteredCharts,
      } as MedicionGroup;
    })
    .filter((g): g is MedicionGroup => g !== null);

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

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Selecciona área, equipo y componente para visualizar sus mediciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Área */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Área</label>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger><SelectValue placeholder="Selecciona un área" /></SelectTrigger>
                <SelectContent>
                  {areas.map(a => <SelectItem key={a.codigo_area} value={a.codigo_area}>{a.nombre_area}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Equipo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Equipo</label>
              <Select value={selectedEquipo} onValueChange={setSelectedEquipo} disabled={!selectedArea}>
                <SelectTrigger><SelectValue placeholder={selectedArea ? 'Selecciona un equipo' : 'Primero selecciona un área'} /></SelectTrigger>
                <SelectContent>
                  {equipos.map(e => <SelectItem key={e.codigo_equipo} value={e.codigo_equipo}>{e.nombre_equipo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Componente */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Componente</label>
              <Select value={selectedComponente} onValueChange={setSelectedComponente} disabled={!selectedEquipo}>
                <SelectTrigger><SelectValue placeholder={selectedEquipo ? 'Selecciona un componente' : 'Primero selecciona un equipo'} /></SelectTrigger>
                <SelectContent>
                  {componentes.map(c => <SelectItem key={c.codigo_componente} value={c.codigo_componente}>{c.nombre_componente}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de gráfica */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de gráficas</label>
              <Select
                value={chartFilter || undefined}
                onValueChange={(value) => setChartFilter(value as ChartFilter)}
                disabled={!selectedComponente}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="temperatura">Solo Temperatura</SelectItem>
                  <SelectItem value="vibracion">Solo Vibración</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">Error: {error}</AlertDescription>
        </Alert>
      )}
      {(isLoading || isLoadingData) && (
        <Alert><Activity className="h-4 w-4" /><AlertDescription>Cargando datos...</AlertDescription></Alert>
      )}
      {!isLoading && !isLoadingData && selectedComponente && chartFilter !== '' && medicionGroups.length > 0 && filteredGroups.length > 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {registros.length} registro(s) · {detalles.length} detalle(s) cargados · {filteredGroups.length} punto(s) visible(s)
          </AlertDescription>
        </Alert>
      )}
      {!isLoading && !isLoadingData && selectedComponente && medicionGroups.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">No hay datos para el componente seleccionado.</AlertDescription>
        </Alert>
      )}
      {!isLoading && !isLoadingData && selectedComponente && chartFilter === '' && medicionGroups.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">Selecciona un valor en "Tipo de gráficas" para visualizar resultados.</AlertDescription>
        </Alert>
      )}
      {!isLoading && !isLoadingData && selectedComponente && chartFilter !== '' && medicionGroups.length > 0 && filteredGroups.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">No hay gráficas para el filtro seleccionado.</AlertDescription>
        </Alert>
      )}

      {/* ── Navegación por Puntos de Medición ──────────────────────────────── */}
      {filteredGroups.length > 0 && !selectedLetra && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Puntos de Medición</h2>
            <p className="text-sm text-gray-500 mt-1">Selecciona un punto para ver sus gráficas de tendencia</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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

                        {/* Grid de gráficas para esta orientación */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
    </div>
  );
}

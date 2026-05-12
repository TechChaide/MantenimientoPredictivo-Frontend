'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, ComposedChart } from 'recharts';
import { AlertCircle, TrendingUp, Activity, CheckCircle, ChevronLeft, Thermometer, Waves, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { areaService } from '@/services/area.service';
import { equipoService } from '@/services/equipo.service';
import { componenteService } from '@/services/componente.service';
import { registrosService } from '@/services/registros.service';
import { checkMostrarTodosEquipos } from '@/lib/mostrar-todos-equipos';
import type { Area, Equipo, Componente, Registros } from '@/types/interfaces';



// Convierte número de medición a letra: 1->A, 2->B, etc.
const numeroALetra = (numero: number): string =>
  String.fromCharCode(64 + numero);

// Determina si una unidad es de temperatura o vibración
const getTipoUnidad = (unidad: string): { tipo: string; color: string } => {
  if (unidad === "°C" || unidad === "°F") {
    return { tipo: "Temperatura", color: "bg-orange-100 text-orange-800 border-orange-300" };
  }
  return { tipo: "Vibración", color: "bg-blue-100 text-blue-800 border-blue-300" };
};

// Funciones auxiliares
interface DataPoint {
  fecha: string;
  valores: number[];
  promedio?: number;
  x?: number;
}

interface TrendLineData {
  x: number;
  y: number;
}

interface RegressionResult {
  m: number;
  b: number;
  trendData: TrendLineData[];
  r2: number;
}

// Calcular regresión lineal simple con R²
const calculateLinearRegression = (points: { x: number; y: number }[]): RegressionResult => {
  if (points.length < 2) {
    return { m: 0, b: 0, trendData: [], r2: 0 };
  }

  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);

  const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const b = (sumY - m * sumX) / n;

  // Generar puntos de la línea de tendencia
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));

  const trendData: TrendLineData[] = [
    { x: minX, y: m * minX + b },
    { x: maxX, y: m * maxX + b },
  ];

  // Calcular R²
  const meanY = sumY / n;
  const ssRes = points.reduce((sum, p) => {
    const yPred = m * p.x + b;
    return sum + Math.pow(p.y - yPred, 2);
  }, 0);
  const ssTot = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { m, b, trendData, r2 };
};

/** Devuelve color, ícono y mensaje amigable según el valor de R² */
const interpretarR2 = (r2: number): { color: string; bg: string; icono: string; titulo: string; mensaje: string } => {
  if (r2 >= 0.85) return {
    color: "text-green-700", bg: "bg-green-100 border-green-300",
    icono: "✅",
    titulo: "Tendencia muy clara",
    mensaje: "Los registros siguen un patrón muy consistente. La línea de tendencia es confiable y puedes usarla para anticipar cómo se comportará la máquina en el futuro."
  };
  if (r2 >= 0.60) return {
    color: "text-blue-700", bg: "bg-blue-100 border-blue-300",
    icono: "📈",
    titulo: "Tendencia moderada",
    mensaje: "Existe una tendencia visible, aunque los valores tienen cierta variación. Es recomendable seguir tomando mediciones para confirmar el comportamiento."
  };
  if (r2 >= 0.30) return {
    color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-300",
    icono: "⚠️",
    titulo: "Tendencia débil",
    mensaje: "Los registros varian bastante y la tendencia no es clara. Puede haber factores externos afectando las mediciones. Se recomienda revisar la frecuencia y condiciones de toma de datos."
  };
  return {
    color: "text-red-700", bg: "bg-red-100 border-red-300",
    icono: "🔴",
    titulo: "Sin tendencia definida",
    mensaje: "Los registros no muestran un patrón reconocible. Esto puede indicar mediciones irregulares, condiciones muy variables o pocos datos. La línea de tendencia no es útil en este caso."
  };
};

// Agrupar registros por unidad (magnitud)
const groupByUnit = (registros: Registros[]): { [key: string]: Registros[] } => {
  const grouped: { [key: string]: Registros[] } = {};

  registros.forEach((registro) => {
    if (!grouped[registro.unidades]) {
      grouped[registro.unidades] = [];
    }
    grouped[registro.unidades].push(registro);
  });

  return grouped;
};

// Agrupar registros por medicion y sus unidades
const groupByMeasurementWithUnits = (
  registros: Registros[]
): { medicion: number; unidades: string[]; registrosPorUnidad: { [key: string]: Registros[] } }[] => {
  const groupedByMeasurement: {
    [key: number]: {
      medicion: number;
      registrosPorUnidad: { [key: string]: Registros[] };
    };
  } = {};

  registros.forEach((registro) => {
    const medicion = registro.medicion;
    
    if (!groupedByMeasurement[medicion]) {
      groupedByMeasurement[medicion] = {
        medicion,
        registrosPorUnidad: {},
      };
    }

    const unidad = registro.unidades;
    if (!groupedByMeasurement[medicion].registrosPorUnidad[unidad]) {
      groupedByMeasurement[medicion].registrosPorUnidad[unidad] = [];
    }

    groupedByMeasurement[medicion].registrosPorUnidad[unidad].push(registro);
  });

  // Convertir a array y obtener unidades únicas por medición
  return Object.values(groupedByMeasurement)
    .map((group) => ({
      medicion: group.medicion,
      unidades: Object.keys(group.registrosPorUnidad).sort(),
      registrosPorUnidad: group.registrosPorUnidad,
    }))
    .sort((a, b) => a.medicion - b.medicion);
};

export default function Dashboard2() {
  const [dateRange, setDateRange] = useState({ from: new Date(2024, 0, 1), to: new Date() });
  
  // Estados para áreas, equipos y componentes
  const [areas, setAreas] = useState<Area[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [componentes, setComponentes] = useState<Componente[]>([]);
  
  // Estados de selección
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedEquipo, setSelectedEquipo] = useState<string>('');
  const [selectedComponente, setSelectedComponente] = useState<string>('');
  
  // Estados para registros y mediciones
  const [registros, setRegistros] = useState<Registros[]>([]);
  const [measurementGroups, setMeasurementGroups] = useState<
    { medicion: number; unidades: string[]; registrosPorUnidad: { [key: string]: Registros[] } }[]
  >([]);
  // Letra de medición activa (null = mostrar panel de navegación)
  const [selectedLetra, setSelectedLetra] = useState<string | null>(null);
  
  // Estado de carga
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRegistros, setIsLoadingRegistros] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar áreas al inicio
  useEffect(() => {
    const loadAreas = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Cargar todas las áreas, equipos y verificar permiso global
        const [areasResponse, equiposResponse, mostrarTodos] = await Promise.all([
          areaService.getAll(),
          equipoService.getAll(),
          checkMostrarTodosEquipos(),
        ]);

        const allEquipos = equiposResponse.data || [];
        let allAreas = areasResponse.data || [];

        // Filtro regional para usuarios sin permiso global
        if (!mostrarTodos) {
          const localidad = typeof window !== 'undefined' ? sessionStorage.getItem('usuario_localidad') : null;
          const regional = localidad === 'GYE' ? 2000 : 1000;
          allAreas = allAreas.filter(a => Number(a.regional) === regional && a.estado === 'A');
        }

        // Filtrar áreas que tengan al menos un equipo con admite_registros_manuales === true
        const areasWithManualRegisters = allAreas.filter((area) =>
          allEquipos.some(
            (equipo) =>
              equipo.codigo_area === area.codigo_area &&
              equipo.admite_registros_manuales === true
          )
        );

        setAreas(areasWithManualRegisters);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar áreas');
        console.error('Error loading areas:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAreas();
  }, []);

  // Cargar equipos cuando selectedArea cambie
  useEffect(() => {
    const loadEquipos = async () => {
      if (!selectedArea) {
        setEquipos([]);
        setSelectedEquipo('');
        return;
      }

      try {
        const response = await equipoService.getAll();
        const filteredEquipos = (response.data || []).filter(
          (equipo) =>
            equipo.codigo_area === selectedArea &&
            equipo.admite_registros_manuales === true
        );
        setEquipos(filteredEquipos);
        setSelectedEquipo('');
      } catch (err) {
        console.error('Error loading equipos:', err);
        setEquipos([]);
      }
    };

    loadEquipos();
  }, [selectedArea]);

  // Cargar componentes cuando selectedEquipo cambie
  useEffect(() => {
    const loadComponentes = async () => {
      if (!selectedEquipo) {
        setComponentes([]);
        setSelectedComponente('');
        return;
      }

      try {
        const response = await componenteService.getAll();
        const filteredComponentes = (response.data || []).filter(
          (componente) => componente.codigo_equipo === selectedEquipo
        );
        setComponentes(filteredComponentes);
        setSelectedComponente('');
      } catch (err) {
        console.error('Error loading componentes:', err);
        setComponentes([]);
      }
    };

    loadComponentes();
  }, [selectedEquipo]);

  // Cargar registros cuando selectedComponente cambie
  useEffect(() => {
    const loadRegistros = async () => {
      if (!selectedComponente) {
        setRegistros([]);
        setMeasurementGroups([]);
        setSelectedLetra(null);
        return;
      }

      try {
        setIsLoadingRegistros(true);
        const response = await registrosService.getAll(1, 10000);
        
        // Filtrar por componente
        const filteredRegistros = (response.data || []).filter(
          (registro) => registro.codigo_componente === selectedComponente
        );

        setRegistros(filteredRegistros);

        // Agrupar por medicion y sus unidades
        const groups = groupByMeasurementWithUnits(filteredRegistros);
        setMeasurementGroups(groups);
      } catch (err) {
        console.error('Error loading registros:', err);
        setRegistros([]);
        setMeasurementGroups([]);
      } finally {
        setIsLoadingRegistros(false);
      }
    };

    loadRegistros();
  }, [selectedComponente]);

  return (
    <div className="w-full space-y-8 p-6 md:p-8">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard 2</h1>
        <p className="text-gray-600 mt-2">Bienvenido al panel de control alternativo</p>
      </div>

      {/* Selectores de Área, Equipo y Componente */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Selecciona un área, equipo y componente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Selector de Área */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Área</label>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un área" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((area) => (
                    <SelectItem key={area.codigo_area} value={area.codigo_area}>
                      {area.nombre_area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selector de Equipo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Equipo</label>
              <Select 
                value={selectedEquipo} 
                onValueChange={setSelectedEquipo}
                disabled={!selectedArea}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedArea ? "Selecciona un equipo" : "Primero selecciona un área"} />
                </SelectTrigger>
                <SelectContent>
                  {equipos.map((equipo) => (
                    <SelectItem key={equipo.codigo_equipo} value={equipo.codigo_equipo}>
                      {equipo.nombre_equipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selector de Componente */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Componente</label>
              <Select 
                value={selectedComponente} 
                onValueChange={setSelectedComponente}
                disabled={!selectedEquipo}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedEquipo ? "Selecciona un componente" : "Primero selecciona un equipo"} />
                </SelectTrigger>
                <SelectContent>
                  {componentes.map((componente) => (
                    <SelectItem key={componente.codigo_componente} value={componente.codigo_componente}>
                      {componente.nombre_componente}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas de carga y estado */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Error: {error}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            Cargando datos...
          </AlertDescription>
        </Alert>
      )}

      {isLoadingRegistros && (
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            Cargando registros del componente...
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && selectedComponente && registros.length > 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Se encontraron {registros.length} registros para el componente seleccionado.
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && selectedComponente && registros.length === 0 && !isLoadingRegistros && (
        <Alert>
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            No hay registros para el componente seleccionado.
          </AlertDescription>
        </Alert>
      )}

      {/* ── NAVEGACIÓN POR MEDICIÓN ─────────────────────────────── */}
      {measurementGroups.length > 0 && !selectedLetra && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Puntos de Medición</h2>
            <p className="text-sm text-gray-500 mt-1">Selecciona un punto para ver sus gráficas</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {measurementGroups.map((group) => {
              const letra = numeroALetra(group.medicion);
              const totalRegistros = group.unidades.reduce(
                (sum, u) => sum + (group.registrosPorUnidad[u]?.length ?? 0), 0
              );
              const tiposPresentes = [...new Set(group.unidades.map((u) => getTipoUnidad(u).tipo))];
              const tieneTemp = tiposPresentes.includes("Temperatura");
              const tieneVib = tiposPresentes.includes("Vibración");

              return (
                <button
                  key={`nav-${group.medicion}`}
                  onClick={() => setSelectedLetra(letra)}
                  className="group relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer text-left"
                >
                  {/* Círculo con letra */}
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white text-3xl font-extrabold shadow-md group-hover:from-blue-600 group-hover:to-blue-800 transition-all">
                    {letra}
                  </div>

                  {/* Nombre y conteo */}
                  <div className="text-center">
                    <p className="font-bold text-gray-800 text-base">Medición {letra}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{totalRegistros} registro{totalRegistros !== 1 ? 's' : ''}</p>
                  </div>

                  {/* Badges de tipo */}
                  <div className="flex flex-wrap justify-center gap-1">
                    {tieneTemp && (
                      <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                        <Thermometer className="w-3 h-3" /> Temp
                      </span>
                    )}
                    {tieneVib && (
                      <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                        <Waves className="w-3 h-3" /> Vibración
                      </span>
                    )}
                  </div>

                  {/* Cantidad de gráficas */}
                  <p className="text-xs text-gray-400">{group.unidades.length} gráfica{group.unidades.length !== 1 ? 's' : ''}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── VISTA DE GRÁFICAS DE LA LETRA SELECCIONADA ─────────── */}
      {measurementGroups.length > 0 && selectedLetra && (() => {
        const group = measurementGroups.find((g) => numeroALetra(g.medicion) === selectedLetra);
        if (!group) return null;

        return (
          <div className="space-y-6">
            {/* Barra superior de navegación */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedLetra(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Volver a puntos de medición
              </button>

              {/* Selector de letra si hay varias */}
              {measurementGroups.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Ir a:</span>
                  <div className="flex gap-1">
                    {measurementGroups.map((g) => {
                      const l = numeroALetra(g.medicion);
                      return (
                        <button
                          key={l}
                          onClick={() => setSelectedLetra(l)}
                          className={`w-9 h-9 rounded-full font-bold text-sm transition-all ${
                            l === selectedLetra
                              ? 'bg-blue-600 text-white shadow-md scale-110'
                              : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700'
                          }`}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Título */}
              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white font-extrabold text-lg">
                  {selectedLetra}
                </div>
                <span className="text-lg font-bold text-gray-800">Medición {selectedLetra}</span>
                <span className="text-sm text-gray-400">— {group.unidades.length} gráfica{group.unidades.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Gráficas de esta letra */}
            {group.unidades.map((unidad) => {
              const letra = selectedLetra;
              const { tipo, color } = getTipoUnidad(unidad);
              const registrosParaGrafica = group.registrosPorUnidad[unidad] || [];
              if (registrosParaGrafica.length === 0) return null;

              const sortedRegistros = [...registrosParaGrafica].sort(
                (a, b) => new Date(a.fecha_inicio_evento).getTime() - new Date(b.fecha_inicio_evento).getTime()
              );

              const scatterData = sortedRegistros.map((registro) => ({
                x: new Date(registro.fecha_inicio_evento).getTime(),
                y: registro.valor,
                fechaHora: new Date(registro.fecha_inicio_evento).toLocaleString('es-ES'),
              }));

              const regression = calculateLinearRegression(scatterData.map((d) => ({ x: d.x, y: d.y })));
              const trendData = regression.trendData.map((point) => ({
                x: point.x,
                y: parseFloat(point.y.toFixed(2)),
              }));

              const valores = sortedRegistros.map((r) => r.valor);
              const valorMin = Math.min(...valores);
              const valorMax = Math.max(...valores);
              const valorPromedio = valores.reduce((sum, v) => sum + v, 0) / valores.length;
              const accentColor = tipo === "Temperatura" ? "#f97316" : "#3b82f6";

              return (
                <Card key={`chart-${selectedLetra}-${unidad}`} className="border-l-4" style={{ borderLeftColor: accentColor }}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-lg" style={{ backgroundColor: accentColor }}>
                        {tipo === "Temperatura" ? <Thermometer className="w-5 h-5" /> : <Waves className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{unidad}</CardTitle>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>{tipo}</span>
                        </div>
                          <div className="flex items-center gap-2 mt-1">
                            <CardDescription>{sortedRegistros.length} registros</CardDescription>
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {(() => {
                                    const { color: rColor, bg: rBg, icono, titulo } = interpretarR2(regression.r2);
                                    return (
                                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border cursor-help ${rBg} ${rColor}`}>
                                        {icono} R² = {(regression.r2 * 100).toFixed(1)}% &middot; {titulo}
                                        <HelpCircle className="w-3 h-3 opacity-60" />
                                      </span>
                                    );
                                  })()}
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs text-sm p-3">
                                  {(() => {
                                    const { icono, titulo, mensaje } = interpretarR2(regression.r2);
                                    return (
                                      <div className="space-y-1">
                                        <p className="font-bold">{icono} {titulo}</p>
                                        <p className="text-gray-300 leading-snug">{mensaje}</p>
                                        <p className="text-gray-400 text-xs pt-1">R² mide qué tan bien la línea roja describe el comportamiento de tus mediciones (0% = nada, 100% = perfecto).</p>
                                      </div>
                                    );
                                  })()}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Estadísticas rápidas */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg p-3 text-center" style={{ backgroundColor: `${accentColor}18` }}>
                          <p className="text-xs text-gray-500 mb-1">Mínimo</p>
                          <p className="text-lg font-bold text-gray-800">{valorMin.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">{unidad}</p>
                        </div>
                        <div className="rounded-lg p-3 text-center" style={{ backgroundColor: `${accentColor}18` }}>
                          <p className="text-xs text-gray-500 mb-1">Máximo</p>
                          <p className="text-lg font-bold text-gray-800">{valorMax.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">{unidad}</p>
                        </div>
                        <div className="rounded-lg p-3 text-center" style={{ backgroundColor: `${accentColor}18` }}>
                          <p className="text-xs text-gray-500 mb-1">Promedio</p>
                          <p className="text-lg font-bold text-gray-800">{valorPromedio.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">{unidad}</p>
                        </div>
                      </div>

                      {/* Gráfica */}
                      <ResponsiveContainer width="100%" height={360}>
                        <ComposedChart margin={{ top: 20, right: 20, bottom: 60, left: 20 }} data={scatterData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="x"
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(ts) => new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            label={{ value: 'Fecha', position: 'insideBottom', offset: -20 }}
                          />
                          <YAxis label={{ value: unidad, angle: -90, position: 'insideLeft' }} />
                          <RechartsTooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length > 0) {
                                return (
                                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                    <p className="text-xs text-gray-400 mb-1">{payload[0].payload.fechaHora}</p>
                                    <p className="text-sm font-bold" style={{ color: accentColor }}>
                                      {payload[0].payload.y?.toFixed(3)} {unidad}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend verticalAlign="top" />
                          <Scatter dataKey="y" data={scatterData} fill={accentColor} fillOpacity={0.75} name={`Medición ${letra}`} />
                          {trendData.length >= 2 && (
                            <Line
                              dataKey="y"
                              data={trendData}
                              stroke="#ef4444"
                              strokeWidth={2.5}
                              strokeDasharray="6 3"
                              name="Tendencia"
                              isAnimationActive={false}
                              dot={false}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })()}


    </div>
  );
}

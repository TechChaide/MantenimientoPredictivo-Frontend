"use client";

import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
  ReferenceDot,
  Brush,
  ReferenceArea,
} from "recharts";
import { ChartDataPoint } from "@/lib/data";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { tipoEventoService } from "@/services/tipoEvento.service";
import { categoriaEventoService } from "@/services/categoriaEvento.service";
import { historialService } from "@/services/historial.service";
import { calculosCorrientesDatosMantenimientoService } from "@/services/calculoscorrientesdatosmantenimiento.service";
import { componenteService } from "@/services/componente.service";
import { equipoService } from "@/services/equipo.service";
import { limitesService } from "@/services/limites.service";
import { useToast } from "@/hooks/use-toast";
import type { TipoEvento, CategoriaEvento } from "@/types/interfaces";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModernWheelPicker } from "../modern-wheel-picker";
const LabelingMenu = ({
  position,
  onSelect,
  onClose,
  tipos,
  getCategoriesForTipo,
  saving,
}: {
  position: { x: number; y: number };
  onSelect: (
    categoryTipoId: string,
    failure: { id: string; name: string },
  ) => void;
  onClose: () => void;
  tipos: TipoEvento[];
  getCategoriesForTipo: (tipoId: string) => Promise<CategoriaEvento[]>;
  saving?: boolean;
}) => {
  const [activeTipo, setActiveTipo] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [menuStyle, setMenuStyle] = useState({
    top: position.y,
    left: position.x,
    opacity: 0,
    maxHeight: 400,
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useLayoutEffect(() => {
    if (menuRef.current) {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      let newLeft = position.x;
      let newTop = position.y;
      const spaceBelow = screenHeight - position.y - 20;
      const spaceAbove = position.y - 20;
      const idealHeight = 380;
      let calculatedMaxHeight = idealHeight;
      if (spaceBelow < idealHeight) {
        if (spaceAbove > spaceBelow) {
          newTop = position.y - Math.min(idealHeight, spaceAbove);
          calculatedMaxHeight = Math.min(idealHeight, spaceAbove);
        } else {
          calculatedMaxHeight = spaceBelow;
        }
      }
      if (position.x + 320 > screenWidth) {
        newLeft = position.x - 300;
      }
      setMenuStyle({
        top: newTop,
        left: newLeft,
        opacity: 1,
        maxHeight: calculatedMaxHeight,
      });
    }
  }, [position]);

  useEffect(() => {
    // when a tipo is activated, load categories for it
    let mounted = true;
    async function load() {
      if (!activeTipo) return;
      setLoadingItems(true);
      try {
        const cats = await getCategoriesForTipo(activeTipo);
        if (!mounted) return;
        setItems(
          cats.map((c) => ({
            id: String(c.codigo_categoria_evento),
            name: c.descripcion,
          })),
        );
      } catch (e) {
        setItems([]);
      } finally {
        if (mounted) setLoadingItems(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [activeTipo, getCategoriesForTipo]);

  if (!position || (!position.x && position.x !== 0)) return null;

  const handleConfirm = () => {
    if (activeTipo && selectedItem) {
      onSelect(activeTipo, { id: selectedItem.id, name: selectedItem.name });
    }
  };

  return (
    <div
      ref={menuRef}
      style={{
        top: menuStyle.top,
        left: menuStyle.left,
        height: menuStyle.maxHeight,
        opacity: menuStyle.opacity,
      }}
      className="fixed z-[9999] w-[min(300px,calc(100vw-2rem))] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-opacity duration-150 font-sans"
    >
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center h-12 flex-shrink-0">
        {activeTipo ? (
          <button
            onClick={() => {
              setActiveTipo(null);
              setSelectedItem(null);
            }}
            className="flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft size={16} className="mr-1" /> Atrás
          </button>
        ) : (
          <h3 className="font-semibold text-sm text-slate-800">
            Clasificar Falla
          </h3>
        )}
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-red-500 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 bg-white p-2">
        {!activeTipo && (
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-medium px-2 py-2">
              Seleccione el tipo de evento:
            </p>
            {tipos.map((t) => (
              <button
                key={t.codigo_tipo_evento}
                onClick={() => setActiveTipo(String(t.codigo_tipo_evento))}
                className="w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-700">
                    {t.nombre_evento}
                  </span>
                </div>
                <ChevronRight
                  size={16}
                  className="text-slate-300 group-hover:text-slate-500"
                />
              </button>
            ))}
          </div>
        )}

        {activeTipo && (
          <div>
            <div className="px-3 py-2 bg-slate-50 rounded-md mb-2 border border-slate-100 flex items-center gap-2 sticky top-0 z-10">
              <span className="text-xs font-bold text-slate-700">
                Categorias
              </span>
            </div>
            <div className="space-y-1 pb-2">
              {loadingItems && (
                <div className="p-3 text-sm text-gray-500">
                  Cargando categorias...
                </div>
              )}
              {!loadingItems && items.length === 0 && (
                <div className="p-3 text-sm text-gray-500">Sin categorias</div>
              )}
              {!loadingItems &&
                items.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`w-full text-left px-3 py-2.5 text-xs rounded-md transition-all duration-200 border flex items-center gap-2 ${isSelected ? "bg-blue-50 border-blue-500 text-blue-700 font-medium shadow-sm" : "bg-white border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${isSelected ? "border-blue-500 bg-blue-500" : "border-slate-300"}`}
                      >
                        {isSelected && (
                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        )}
                      </div>
                      <span className="truncate whitespace-normal leading-tight">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {activeTipo && (
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2 flex-shrink-0 z-20">
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!selectedItem || !!saving}
            className={`text-xs h-9 w-full transition-all shadow-sm ${selectedItem && !saving ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
          >
            {saving
              ? "Guardando..."
              : selectedItem
                ? "Guardar Clasificación"
                : "Seleccione una opción"}
          </Button>
        </div>
      )}
    </div>
  );
};

const SIGMA_LINE_CONFIG = [
  {
    key: "neg5",
    label: "-5σ",
    multiplier: -5,
    color: "#8b5cf6",
    dash: "5 5",
    width: 1,
    description: "Zona fuera de control extremo (5 sigmas debajo de la media).",
  },
  {
    key: "neg3",
    label: "-3σ",
    multiplier: -3,
    color: "#ec4899",
    dash: "5 5",
    width: 1.5,
    description: "Alarma crítica negativa (3 sigmas debajo de la media).",
  },
  {
    key: "neg2",
    label: "-2σ",
    multiplier: -2,
    color: "#f97316",
    dash: "3 3",
    width: 1.5,
    description: "Zona de advertencia negativa (95% de los datos).",
  },
  {
    key: "neg1",
    label: "-1σ",
    multiplier: -1,
    color: "#22c55e",
    dash: "2 4",
    width: 2,
    description: "Rango normal negativo (68% de los datos).",
  },
  {
    key: "mean",
    label: "x̄",
    multiplier: 0,
    color: "#0f172a",
    dash: undefined,
    width: 2.5,
    description: "Valor medio real de la serie medida.",
  },
  {
    key: "pos1",
    label: "+1σ",
    multiplier: 1,
    color: "#22c55e",
    dash: "2 4",
    width: 2,
    description: "Rango normal positivo (68% de los datos).",
  },
  {
    key: "pos2",
    label: "+2σ",
    multiplier: 2,
    color: "#f97316",
    dash: "3 3",
    width: 1.5,
    description: "Zona de advertencia positiva (95% de los datos).",
  },
  {
    key: "pos3",
    label: "+3σ",
    multiplier: 3,
    color: "#ec4899",
    dash: "5 5",
    width: 1.5,
    description: "Alarma crítica positiva (3 sigmas por encima de la media).",
  },
  {
    key: "pos5",
    label: "+5σ",
    multiplier: 5,
    color: "#8b5cf6",
    dash: "5 5",
    width: 1,
    description:
      "Zona fuera de control extremo (5 sigmas por encima de la media).",
  },
];

// --- 3. DEFINICIÓN DE PROPS Y HELPERS DEL GRÁFICO ---

interface MetricChartProps {
  data: ChartDataPoint[];
  valueKey: keyof ChartDataPoint;
  referenceKey?: keyof ChartDataPoint;
  limitKey: keyof ChartDataPoint;
  limitLabel: string;
  predictionKey: keyof ChartDataPoint;
  predictionPesimisticKey: keyof ChartDataPoint;
  predictionOptimisticKey: keyof ChartDataPoint;
  referencePredictionKey?: keyof ChartDataPoint;
  yAxisLabel: string;
  componentId: string;
  machine?: string;
  metric: "current" | "unbalance" | "load_factor";
  chartHeight?: string;
  aggregationLevel?: "minute" | "hour" | "month";
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  meanLine?: { label: string; value: number; color: string } | null;
}

// CustomTooltip will be defined inside the MetricChart component so it can
// access the modal state setters (`setRawStart`, `setRawEnd`, `setRawModalOpen`).

const sigmaLegendTooltips = SIGMA_LINE_CONFIG.reduce<Record<string, string>>(
  (acc, config) => {
    acc[config.label] = config.description;
    return acc;
  },
  {},
);

const legendTooltips: Record<string, string> = {
  ...sigmaLegendTooltips,
  "Promedio Diario": "Valor real medido.",
  Referencia: "Línea base de operación normal.",
  "Corriente Max": "Límite máximo operativo seguro.",
  "Umbral Max": "Límite máximo operativo seguro.",
  "Desv. Estándar": "Desviación Estándar de la Corriente para el período.",
  "±1σ":
    "Banda de una desviación estándar alrededor de la media (68% de los datos).",
  "±2σ":
    "Banda de dos desviaciones estándar alrededor de la media (95% de los datos).",
  "Proyección Tendencia":
    "Estimación futura basada en una regresión lineal de los datos históricos.",
  "Proyección Pesimista": "Escenario de degradación acelerada.",
  "Proyección Optimista": "Escenario de degradación lenta.",
};

const renderLegendText = (value: string, entry: any) => {
  const tooltipText = legendTooltips[value];
  if (tooltipText) {
    return (
      <span
        className="cursor-help border-b border-dashed border-slate-400"
        title={tooltipText}
      >
        {value}
      </span>
    );
  }
  return value;
};

// --- 4. COMPONENTE PRINCIPAL (CHART) ---

export function MetricChart({
  data,
  valueKey,
  referenceKey,
  limitKey,
  limitLabel,
  predictionKey,
  predictionPesimisticKey,
  predictionOptimisticKey,
  referencePredictionKey,
  componentId,
  machine,
  metric,
  yAxisLabel,
  chartHeight = metric === "current" ? "h-[320px] md:h-[600px]" : "h-[260px] md:h-[400px]",
}: MetricChartProps) {
  const isMobile = useIsMobile();
  const [labelingMenu, setLabelingMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);
  const [expandedChart, setExpandedChart] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [tiposEventos, setTiposEventos] = useState<TipoEvento[]>([]);
  const [tiposLoading, setTiposLoading] = useState(false);
  const [categoriasMapLocal, setCategoriasMapLocal] = useState<
    Record<string, CategoriaEvento[]>
  >({});
  const [categoriasLoadingLocal, setCategoriasLoadingLocal] = useState<
    Record<string, boolean>
  >({});
  const [savingLabel, setSavingLabel] = useState(false);
  // Unified modal with tabs
  const [unifiedModalOpen, setUnifiedModalOpen] = useState(false);
  const [unifiedModalTab, setUnifiedModalTab] = useState<"classify" | "raw">(
    "raw",
  );
  const [selectedTipoModal, setSelectedTipoModal] = useState<string | null>(
    null,
  );
  const [rawStart, setRawStart] = useState<string | null>(null);
  const [rawEnd, setRawEnd] = useState<string | null>(null);
  const [rawCenterHour, setRawCenterHour] = useState<Date | null>(null);
  const [windowMinutes, setWindowMinutes] = useState<number>(30); // Ventana de ±X minutos
  const [rawLoading, setRawLoading] = useState(false);
  const [rawTotal, setRawTotal] = useState<number | null>(null);
  const [rawEventsData, setRawEventsData] = useState<any[]>([]);
  const [sigmaLimit, setSigmaLimit] = useState<number | null>(null);
  const [zonas, setZonas] = useState<{
    seguraInf: number | null;
    seguraSup: number | null;
    alertaInf: number | null;
    alertaSup: number | null;
    criticaInf: number | null;
    criticaSup: number | null;
  }>({
    seguraInf: null,
    seguraSup: null,
    alertaInf: null,
    alertaSup: null,
    criticaInf: null,
    criticaSup: null,
  });
  const [outlierEvents, setOutlierEvents] = useState<
    Array<{
      id: string;
      data: any;
      selected: boolean;
      categoriaId: string | null;
    }>
  >([]);
  const [savingBulk, setSavingBulk] = useState(false);
  const [allCategorias, setAllCategorias] = useState<CategoriaEvento[]>([]);
  const [brushRange, setBrushRange] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);
  // Confirmed brush highlight (set after 3s debounce)
  const [confirmedBrushRange, setConfirmedBrushRange] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  // Single global classification for the whole batch of selected outliers
  const [globalCategoriaId, setGlobalCategoriaId] = useState<string | null>(null);
  const outlierTableRef = useRef<HTMLDivElement>(null);
  const brushTimeoutRef = useRef<any>(null);
  const { toast } = useToast();

  const closeLabelingMenu = React.useCallback(() => {
    setLabelingMenu(null);
    setSelectedPoint(null);
  }, []);

  // Cargar sigma_limite del componente y todas las categorías
  React.useEffect(() => {
    const loadLimitAndCategorias = async () => {
      try {
        // Traer límites del componente usando la relación: nombre_componente -> codigo_componente -> limites
        if (componentId && metric === "current") {
          console.log(
            "📥 Buscando sigma_limite para componente (nombre):",
            componentId,
          );

          // Paso 1: Buscar el codigo_componente en la tabla componentes por nombre
          const componentesResp = await componenteService.getAll();
          const componentes = Array.isArray(componentesResp.data)
            ? componentesResp.data
            : [];

          // Normalizar para comparación
          const normalize = (s: any) =>
            (s || "")
              .toString()
              .toLowerCase()
              .replace(/[\s_\-]+/g, " ")
              .trim();
          const nombreBuscado = normalize(componentId);

          let componenteEncontrado = componentes.find(
            (c: any) => normalize(c.nombre_componente) === nombreBuscado,
          );
          if (!componenteEncontrado) {
            // Búsqueda parcial
            componenteEncontrado = componentes.find(
              (c: any) =>
                normalize(c.nombre_componente).includes(nombreBuscado) ||
                nombreBuscado.includes(normalize(c.nombre_componente)),
            );
          }

          console.log("🔍 Componente encontrado:", componenteEncontrado);

          if (componenteEncontrado && componenteEncontrado.codigo_componente) {
            const codigoComponente = componenteEncontrado.codigo_componente;
            console.log(
              "📦 Buscando límites para codigo_componente:",
              codigoComponente,
            );

            // Paso 2: Buscar en la tabla limites usando el codigo_componente
            const limitsResp = await limitesService.getAll();
            const limites = Array.isArray(limitsResp.data)
              ? limitsResp.data
              : [];

            // `any`: zona_segura/alerta/critica no existen en el modelo real de `limites`
            // (ver modelo/Logical Model - Maquinas Mantenimiento.jpg), quedan undefined siempre.
            const limiteEncontrado: any = limites.find(
              (l: any) =>
                String(l.codigo_componente) === String(codigoComponente),
            );

            console.log("📋 Límite encontrado:", limiteEncontrado);

            if (
              limiteEncontrado &&
              limiteEncontrado.sigma_limite !== undefined
            ) {
              const sigmaValue = Number(limiteEncontrado.sigma_limite) || null;
              console.log("✅ Sigma Limite cargado:", sigmaValue);
              setSigmaLimit(sigmaValue);
              
              // Cargar las zonas si existen
              console.log("📊 Datos crudos de límite:", {
                zona_segura_inf: limiteEncontrado.zona_segura_inf,
                zona_segura_sup: limiteEncontrado.zona_segura_sup,
                zona_alerta_inf: limiteEncontrado.zona_alerta_inf,
                zona_alerta_sup: limiteEncontrado.zona_alerta_sup,
                zona_critica_inf: limiteEncontrado.zona_critica_inf,
                zona_critica_sup: limiteEncontrado.zona_critica_sup,
              });
              
              const zonasCalculadas = {
                seguraInf: limiteEncontrado.zona_segura_inf ? Number(limiteEncontrado.zona_segura_inf) : null,
                seguraSup: limiteEncontrado.zona_segura_sup ? Number(limiteEncontrado.zona_segura_sup) : null,
                alertaInf: limiteEncontrado.zona_alerta_inf ? Number(limiteEncontrado.zona_alerta_inf) : null,
                alertaSup: limiteEncontrado.zona_alerta_sup ? Number(limiteEncontrado.zona_alerta_sup) : null,
                criticaInf: limiteEncontrado.zona_critica_inf ? Number(limiteEncontrado.zona_critica_inf) : null,
                criticaSup: limiteEncontrado.zona_critica_sup ? Number(limiteEncontrado.zona_critica_sup) : null,
              };
              
              console.log("✅ Zonas calculadas:", zonasCalculadas);
              setZonas(zonasCalculadas);
              
              // Verificar si hay al menos una zona seteada
              const tieneZonas = Object.values(zonasCalculadas).some(v => v !== null);
              if (!tieneZonas) {
                console.warn("⚠️ No se encontraron zonas seteadas en los límites");
              }
            } else {
              console.warn(
                "⚠️ No se encontró sigma_limite para codigo_componente:",
                codigoComponente,
              );
            }
          } else {
            console.warn(
              "⚠️ No se encontró componente con nombre:",
              componentId,
            );
          }
        } else {
          console.log(
            "⏭️  Saltando carga de sigma (metric no es current o falta componentId):",
            { componentId, metric },
          );
        }

        // Traer todas las categorías de evento
        const categsResp = await categoriaEventoService.getAll();
        if (categsResp.data && Array.isArray(categsResp.data)) {
          setAllCategorias(categsResp.data);
        }
      } catch (err) {
        console.warn("Error loading sigma_limit or categories:", err);
      }
    };

    loadLimitAndCategorias();
  }, [componentId, metric]);

  // Listen for global requests to close the classification panel (from other components)
  React.useEffect(() => {
    const handler = () => {
      closeLabelingMenu();
    };
    if (
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function"
    ) {
      window.addEventListener(
        "close-classification-panel",
        handler as EventListener,
      );
    }
    return () => {
      if (
        typeof window !== "undefined" &&
        typeof window.removeEventListener === "function"
      ) {
        window.removeEventListener(
          "close-classification-panel",
          handler as EventListener,
        );
      }
    };
  }, [closeLabelingMenu]);

  // Calcular sortedData primero (necesario para mean)
  const sortedData = React.useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    return sorted;
  }, [data]);

  // Calcular la media de los datos reales (no proyectados)
  const mean = React.useMemo(() => {
    const realData = sortedData.filter((p) => !p.isProjection);
    const values = realData
      .map((p) => Number(p[valueKey]))
      .filter((v) => !isNaN(v));

    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [sortedData, valueKey]);

  // Simply map all raw events directly (no sigma filtering)
  React.useEffect(() => {
    if (!rawEventsData.length) {
      setOutlierEvents([]);
      return;
    }

    const allEvents = rawEventsData.map((event: any, idx: number) => ({
      id: `event-${idx}`,
      data: event,
      selected: false,
      categoriaId: null,
    }));

    console.log("📋 Todos los eventos cargados:", {
      totalEventos: allEvents.length,
      primerEvento: allEvents[0]?.data || "N/A",
    });

    setOutlierEvents(allEvents);
  }, [rawEventsData]);

  // Scoped CustomTooltip so it can open the raw-events modal
  const CustomTooltip = ({
    active,
    payload,
    label,
    meanLine,
  }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      let formattedLabel = label;
      if (typeof label === "string") {
        try {
          formattedLabel = format(parseISO(label), "dd MMM HH:mm", {
            locale: es,
          });
        } catch {}
      }

      const relevantPayload = payload.filter(
        (p: any) =>
          p.value !== null &&
          p.value !== undefined &&
          p.dataKey !== "Desv_PromedioSuavizado",
      );
      const supplementalEntries = meanLine ? [meanLine] : [];

      // Obtener referencia si existe
      const referencePayload = payload.find(
        (p: any) => p.dataKey === referenceKey,
      );

      const handleOpenRawFromTooltip = () => {
        try {
          const point = payload[0]?.payload;
          const baseDateOrig = point?.date ? new Date(point.date) : new Date();
          const baseDate = new Date(baseDateOrig);
          baseDate.setMinutes(0, 0, 0);
          const toInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
          setRawCenterHour(baseDate);
          const startTime = new Date(
            baseDate.getTime() - windowMinutes * 60 * 1000,
          );
          const endTime = new Date(
            baseDate.getTime() + windowMinutes * 60 * 1000,
          );
          setRawStart(toInput(startTime));
          setRawEnd(toInput(endTime));
          setRawEventsData([]);
          setRawTotal(null);
          closeLabelingMenu();
          try {
            if (
              typeof window !== "undefined" &&
              typeof window.dispatchEvent === "function"
            ) {
              window.dispatchEvent(
                new CustomEvent("close-classification-panel"),
              );
            }
          } catch (e) {}
          setUnifiedModalTab("raw");
          setUnifiedModalOpen(true);
        } catch (e) {
          /* ignore */
        }
      };

      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="font-bold">{formattedLabel}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleOpenRawFromTooltip}
            >
              Ver eventos sin suavizado
            </Button>
          </div>
          {relevantPayload.map((p: any) => (
            <p key={p.name} style={{ color: p.color }} className="text-sm">
              {`${p.name}: ${p.value?.toFixed(2)}`}
            </p>
          ))}
          {referencePayload && referencePayload.value !== null && (
            <p
              style={{ color: referencePayload.color }}
              className="text-sm font-semibold"
            >
              {`📍 Referencia: ${referencePayload.value?.toFixed(2)}`}
            </p>
          )}
          {supplementalEntries.map((entry) => (
            <p
              key={entry.label}
              style={{ color: entry.color }}
              className="text-sm"
            >
              {`${entry.label}: ${entry.value.toFixed(2)} A`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleSaveLabel = async (
    category: string,
    failure: { id: string; name: string },
  ) => {
    if (!selectedPoint || !selectedPoint.payload) return;
    setSavingLabel(true);
    try {
      const payloadDate = selectedPoint.payload.date;

      // Try to get combo value (component display value) from the payload
      const comboValue =
        selectedPoint.payload.Componente ||
        selectedPoint.payload.componente ||
        selectedPoint.payload.Component ||
        selectedPoint.payload.component ||
        selectedPoint.payload.nombre_componente ||
        undefined;

      // Resolve codigo_componente using a simpler flow:
      // 1) get all equipos and match by machine name to obtain codigo_equipo
      // 2) get all componentes and match by codigo_equipo and component name
      let codigoComponenteResolved: string = String(componentId);
      try {
        const normalize = (s: any) =>
          (s || "")
            .toString()
            .toLowerCase()
            .replace(/[\s_\-]+/g, " ")
            .trim();

        // 1) fetch equipos and resolve codigo_equipo by machine name
        const equiposResp = await equipoService.getAll();
        const equipos = Array.isArray(equiposResp.data) ? equiposResp.data : [];
        const machineName =
          selectedPoint.payload.Maquina ||
          selectedPoint.payload.maquina ||
          selectedPoint.payload.MAQUINA ||
          selectedPoint.payload.MaquinaName ||
          selectedPoint.payload.machine ||
          machine ||
          undefined;
        const machineNameNorm = normalize(machineName);

        let equipoFound = equipos.find(
          (e: any) => normalize(e.nombre_equipo) === machineNameNorm,
        );
        if (!equipoFound && machineNameNorm) {
          equipoFound = equipos.find(
            (e: any) =>
              normalize(e.nombre_equipo).includes(machineNameNorm) ||
              machineNameNorm.includes(normalize(e.nombre_equipo)),
          );
        }
        const codigoEquipo = equipoFound
          ? String(equipoFound.codigo_equipo)
          : undefined;

        // 2) fetch componentes and match by codigo_equipo + nombre_componente (use the current componentId value as name)
        const compsResp = await componenteService.getAll();
        const comps = Array.isArray(compsResp.data) ? compsResp.data : [];

        // console.log("Comps", comps)

        let componentFound = comps.find(
          (c: any) =>
            c.nombre_componente === codigoComponenteResolved &&
            (!codigoEquipo || String(c.codigo_equipo) === codigoEquipo),
        );

        if (!componentFound) {
          toast({
            title: "Advertencia",
            description:
              "No se pudo resolver el componente para guardar el historial. No se creará ningún registro.",
            variant: "warning",
          });
          return;
        }

        codigoComponenteResolved = componentFound.codigo_componente;

        console.log(
          "***************************************************************************************",
        );
        console.log("Resolved codigo_componente usando equipos/componentes:", {
          selectedMachine: machineName,
          equipoFound,
          componentFound,
          codigoComponenteResolved,
        });
        console.log(
          "***************************************************************************************",
        );
      } catch (err) {
        console.warn(
          "No se pudo resolver codigo_componente usando equipos/componentes",
          err,
        );
      }

      // Prepare request window — using the point date as both start and end
      const resolvedMaquinaForSave =
        machine && String(machine).trim() !== ""
          ? String(machine)
          : selectedPoint.payload?.Maquina &&
              String(selectedPoint.payload.Maquina).trim() !== ""
            ? String(selectedPoint.payload.Maquina)
            : selectedPoint.payload?.maquina &&
                String(selectedPoint.payload.maquina).trim() !== ""
              ? String(selectedPoint.payload.maquina)
              : sortedData && sortedData[0] && (sortedData[0] as any).Maquina
                ? String((sortedData[0] as any).Maquina)
                : sortedData && sortedData[0] && (sortedData[0] as any).maquina
                  ? String((sortedData[0] as any).maquina)
                  : "";
      const resolvedComponenteForSave =
        componentId && String(componentId).trim() !== ""
          ? String(componentId)
          : comboValue
            ? String(comboValue)
            : "";

      // request parameters prepared (not sent directly)

      // Build a compact params object with the requested fields
      const regCurrent =
        selectedPoint.value !== undefined ? Number(selectedPoint.value) : null;
      const regDesbalance = selectedPoint.payload
        ? selectedPoint.payload["Desbalance Suavizado"] !== undefined
          ? Number(selectedPoint.payload["Desbalance Suavizado"])
          : null
        : null;
      const regFactorCarga = selectedPoint.payload
        ? selectedPoint.payload["Factor De Carga Suavizado"] !== undefined
          ? Number(selectedPoint.payload["Factor De Carga Suavizado"])
          : null
        : null;

      const paramsSimple = {
        x_hat: mean ?? null,
        reg_current: isNaN(regCurrent!) ? null : regCurrent,
        reg_desbalance: isNaN(regDesbalance!) ? null : regDesbalance,
        reg_factor_carga: isNaN(regFactorCarga!) ? null : regFactorCarga,
        fecha_punto: payloadDate
          ? format(new Date(payloadDate), "yyyy-MM-dd HH:mm:ss")
          : null,
      };

      const historialPayload = {
        codigo_historial: 0,
        codigo_componente: codigoComponenteResolved,
        codigo_categoria_evento: String(failure.id),
        // Format fecha_evento in SQL-friendly format: YYYY-MM-DD HH:mm:ss
        fecha_evento: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        descripcion: failure.name,
        params: JSON.stringify(paramsSimple),
        estado: "A",
      } as any;

      // Persist the historial via service
      try {
        const saveResp = await historialService.save(historialPayload);
        //console.log('Historial guardado:', saveResp);
        toast({
          title: "Evento registrado",
          description: "Historial guardado correctamente",
          variant: "success",
        });
      } catch (err) {
        console.error("Error guardando historial (save):", err);
        toast({
          title: "Error",
          description: "No se pudo guardar el historial",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error construyendo historial:", error);
    } finally {
      setSavingLabel(false);
      closeLabelingMenu();
    }
  };

  const handleChartClick = (state: any, event: any) => {
    if (metric !== "current") return;
    if (labelingMenu) {
      closeLabelingMenu();
      return;
    }
    if (state && state.activePayload && state.activePayload.length > 0) {
      const mainData =
        state.activePayload.find((p: any) => p.dataKey === valueKey) ||
        state.activePayload[0];
      if (!mainData) return;
      const e = event || state.event;
      if (e) {
        setSelectedPoint(mainData);
        const payloadDate = mainData.payload?.date
          ? new Date(mainData.payload.date)
          : new Date();
        const baseDate = new Date(payloadDate);
        baseDate.setMinutes(0, 0, 0);
        setRawCenterHour(baseDate);
        const toInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
        const windowMs = windowMinutes * 60 * 1000;
        setRawStart(toInput(new Date(payloadDate.getTime() - windowMs)));
        setRawEnd(toInput(new Date(payloadDate.getTime() + windowMs)));
        setUnifiedModalTab("raw");
        setUnifiedModalOpen(true);
        if (tiposEventos.length === 0 && !tiposLoading) {
          (async () => {
            setTiposLoading(true);
            try {
              const resp = await tipoEventoService.getAll();
              const data = Array.isArray(resp.data) ? resp.data : [];
              setTiposEventos(data);
            } catch (err) {
              console.error("Error loading tipos de evento", err);
            } finally {
              setTiposLoading(false);
            }
          })();
        }
      }
    }
  };

  const getCategoriesForTipo = async (tipoId: string) => {
    const id = String(tipoId);
    if (categoriasMapLocal[id]) return categoriasMapLocal[id];
    setCategoriasLoadingLocal((prev) => ({ ...prev, [id]: true }));
    try {
      const resp = await categoriaEventoService.getAll();
      const data = Array.isArray(resp.data) ? resp.data : [];
      const filtered = data.filter((c) => String(c.codigo_tipo_evento) === id);
      setCategoriasMapLocal((prev) => ({ ...prev, [id]: filtered }));
      return filtered;
    } catch (e) {
      console.error("Error cargando categorias desde backend", e);
      return [];
    } finally {
      setCategoriasLoadingLocal((prev) => ({ ...prev, [id]: false }));
    }
  };

  const tickFormatter = (str: string) => {
    try {
      return format(parseISO(str), "dd MMM HH:mm", { locale: es });
    } catch {
      return str;
    }
  };

  // Obtener sigma del backend
  const sigma = React.useMemo(() => {
    // Guarda de cordura: si Desv_PromedioSuavizado viene corrupto/en otra escala
    // (visto en vivo: dispara el eje Y a cientos de miles de millones mientras
    // los datos reales están en un rango normal de amperios), se descarta en
    // vez de romper el gráfico.
    const limiteSigma = Math.max(Math.abs(mean ?? 0), 1) * 20;
    for (let point of sortedData) {
      const val = Number(point["Desv_PromedioSuavizado"]);
      if (!isNaN(val) && val > 0 && val <= limiteSigma) {
        // console.log('✅ Sigma encontrado desde API:', { sigma: val, metric, mean });
        return val;
      }
    }
    console.warn(
      "⚠️ No se encontró Desv_PromedioSuavizado en los datos del componente.",
      {
        componentId,
        availableKeys: Object.keys(sortedData[0] || {}),
      },
    );
    return 0;
  }, [sortedData, metric, mean, componentId]);

  const sigmaLines = React.useMemo(() => {
    if (metric !== "current" || mean === null || sigma <= 0) return [];
    return SIGMA_LINE_CONFIG.map((config) => {
      const value = mean + config.multiplier * sigma;
      return {
        ...config,
        value,
        labelWithValue: `${config.label} (${value.toFixed(2)} A)`,
      };
    });
  }, [metric, mean, sigma]);

  const meanSigmaLine = React.useMemo(() => {
    return sigmaLines.find((line) => line.multiplier === 0) ?? null;
  }, [sigmaLines]);

  const selectedPointDetails = React.useMemo(() => {
    if (!selectedPoint?.payload) return null;
    const value = Number(selectedPoint.value);
    if (isNaN(value)) return null;
    const rawDate = selectedPoint.payload.date;
    let formattedDate = rawDate;
    if (typeof rawDate === "string") {
      try {
        formattedDate = format(parseISO(rawDate), "dd MMM yyyy HH:mm", {
          locale: es,
        });
      } catch {}
    }
    return {
      value,
      formattedDate,
    };
  }, [selectedPoint]);

  // Normalize raw events into a consistent shape for plotting: { date, L1, L2, L3, avg }
  const plottedRaw = React.useMemo(() => {
    try {
      const arr = (rawEventsData || []).map((r: any) => {
        const dateVal =
          r.FECHA ?? r.Fecha ?? r.fecha ?? r.date ?? r.DATE ?? r.FECHA;
        let dateStr = "";
        try {
          dateStr = new Date(dateVal).toISOString();
        } catch {
          dateStr = String(dateVal || "");
        }
        const toNumber = (v: any) => {
          const n = Number(v);
          return Number.isFinite(n) ? n : NaN;
        };
        const l1 = toNumber(
          r.CORRIENTE_L1 ??
            r.CORRIENTE_LA ??
            r.corriente_l1 ??
            r.L1 ??
            r.l1 ??
            null,
        );
        const l2 = toNumber(
          r.CORRIENTE_L2 ??
            r.CORRIENTE_LB ??
            r.corriente_l2 ??
            r.L2 ??
            r.l2 ??
            null,
        );
        const l3 = toNumber(
          r.CORRIENTE_L3 ??
            r.CORRIENTE_LC ??
            r.corriente_l3 ??
            r.L3 ??
            r.l3 ??
            null,
        );
        const values = [l1, l2, l3].filter((v) => !isNaN(v));
        const avg = values.length
          ? values.reduce((a, b) => a + b, 0) / values.length
          : NaN;
        return {
          date: dateStr,
          L1: isNaN(l1) ? null : l1,
          L2: isNaN(l2) ? null : l2,
          L3: isNaN(l3) ? null : l3,
          avg: isNaN(avg) ? null : Number(avg.toFixed(6)),
        };
      });
      return arr.sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
    } catch (e) {
      return [];
    }
  }, [rawEventsData]);

  // Precompute array of {index, timestamp} for ALL outlier events (handles duplicates correctly)
  // Compute red dots to render on raw chart for selected outlier events
  const selectedOutlierDots = React.useMemo(() => {
    if (!outlierEvents.length || !plottedRaw.length) return [];

    return outlierEvents
      .filter((o) => o.selected)
      .map((outlier) => {
        const event = outlier.data;
        const dateVal =
          event.FECHA ?? event.Fecha ?? event.fecha ?? event.date ?? event.DATE;
        let dateStr = "";
        try {
          dateStr = new Date(dateVal).toISOString();
        } catch {
          dateStr = String(dateVal || "");
        }

        const match = plottedRaw.find((p: any) => p.date === dateStr);
        if (match && match.avg !== null) {
          return { date: match.date, value: match.avg };
        }
        return null;
      })
      .filter(Boolean) as Array<{ date: string; value: number }>;
  }, [outlierEvents, plottedRaw]);

  // Handle click on raw data chart point → toggle matching outlier selection
  const handleRawChartClick = React.useCallback((state: any) => {
    if (!state?.activePayload?.length) return;
    const clickedPayload = state.activePayload[0]?.payload;
    if (!clickedPayload?.date) return;

    const clickedDate = clickedPayload.date;

    setOutlierEvents((prev) => {
      const matchIdx = prev.findIndex((o) => {
        const event = o.data;
        const dateVal =
          event.FECHA ?? event.Fecha ?? event.fecha ?? event.date ?? event.DATE;
        try {
          return new Date(dateVal).toISOString() === clickedDate;
        } catch {
          return false;
        }
      });

      if (matchIdx >= 0) {
        return prev.map((o, i) =>
          i === matchIdx ? { ...o, selected: !o.selected } : o,
        );
      }
      return prev;
    });

    // Scroll outlier table into view
    setTimeout(() => {
      outlierTableRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 100);
  }, []);

  // Handle brush range change → select all events within the date range (debounced 3s)
  const handleBrushChange = React.useCallback(
    (range: any) => {
      if (
        !range ||
        range.startIndex === undefined ||
        range.endIndex === undefined
      )
        return;
      setBrushRange(range);

      // Immediately clear the previous confirmed highlight
      setConfirmedBrushRange(null);

      // Only auto-select when brush is narrowed (not at full range)
      const isFullRange =
        plottedRaw.length <= 1 ||
        (range.startIndex === 0 && range.endIndex >= plottedRaw.length - 1);
      if (isFullRange) {
        // Deselect all events when brush is reset to full range
        setOutlierEvents((prev) =>
          prev.map((o) => ({ ...o, selected: false })),
        );
        return;
      }

      if (brushTimeoutRef.current) clearTimeout(brushTimeoutRef.current);

      // Capture indices from this specific brush event
      const capturedStartIndex = range.startIndex;
      const capturedEndIndex = range.endIndex;

      brushTimeoutRef.current = setTimeout(() => {
        if (!plottedRaw.length) return;

        const startDate = plottedRaw[capturedStartIndex]?.date;
        const endDate = plottedRaw[capturedEndIndex]?.date;

        if (!startDate || !endDate) return;

        // Convert boundary dates to timestamps for precise comparison
        const startTs = new Date(startDate).getTime();
        const endTs = new Date(endDate).getTime();

        if (isNaN(startTs) || isNaN(endTs) || startTs > endTs) return;

        // Confirm the brush range for the red ReferenceArea highlight
        setConfirmedBrushRange({ startDate, endDate });

        // Select ALL events that fall within [startTs, endTs]
        setOutlierEvents((prev) =>
          prev.map((o) => {
            const event = o.data;
            const dateVal =
              event.FECHA ?? event.Fecha ?? event.fecha ?? event.date ?? event.DATE;
            try {
              const ts = new Date(dateVal).getTime();
              return {
                ...o,
                selected: ts >= startTs && ts <= endTs,
              };
            } catch {
              return { ...o, selected: false };
            }
          }),
        );

        // Scroll to event table after selection
        setTimeout(() => {
          outlierTableRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 200);
      }, 3000);
    },
    [plottedRaw],
  );

  // Compute real-time count of selected events for visual feedback
  const brushSelectionCount = React.useMemo(() => {
    return outlierEvents.filter((o) => o.selected).length;
  }, [outlierEvents]);
  React.useEffect(() => {
    return () => {
      if (brushTimeoutRef.current) clearTimeout(brushTimeoutRef.current);
    };
  }, []);

  return (
    <>
      <div className="space-y-4">
        <div className={`${chartHeight} w-full relative group`}>
          {/* Botón para expandir */}
          <button
            onClick={() => setExpandedChart(true)}
            className="absolute top-2 right-2 z-10 bg-white rounded-lg shadow-md p-2 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Expandir gráfico"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6v4m12-4h4v4M6 18h4v-4m6 4h4v-4"
              />
            </svg>
          </button>

          {labelingMenu && selectedPointDetails && !unifiedModalOpen && (
            <div className="absolute left-4 top-4 z-20 bg-white/95 border border-slate-200 rounded-lg shadow-lg px-4 py-3 space-y-1 text-xs text-slate-600">
              <p className="uppercase tracking-wide text-[10px] text-slate-500 font-semibold">
                Punto seleccionado
              </p>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500">&nbsp;</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    try {
                      const payloadDate = selectedPoint.payload?.date
                        ? new Date(selectedPoint.payload.date)
                        : new Date();
                      const baseDate = new Date(payloadDate);
                      baseDate.setMinutes(0, 0, 0);
                      const windowMs = windowMinutes * 60 * 1000;
                      const toInput = (d: Date) =>
                        format(d, "yyyy-MM-dd'T'HH:mm");
                      setRawCenterHour(baseDate);
                      setRawStart(
                        toInput(new Date(payloadDate.getTime() - windowMs)),
                      );
                      setRawEnd(
                        toInput(new Date(payloadDate.getTime() + windowMs)),
                      );
                    } catch (e) {
                      setRawStart(null);
                      setRawEnd(null);
                      setRawCenterHour(null);
                    }
                    setRawEventsData([]);
                    setRawTotal(null);
                    closeLabelingMenu();
                    try {
                      if (
                        typeof window !== "undefined" &&
                        typeof window.dispatchEvent === "function"
                      ) {
                        window.dispatchEvent(
                          new CustomEvent("close-classification-panel"),
                        );
                      }
                    } catch (e) {}
                    setUnifiedModalTab("raw");
                    setUnifiedModalOpen(true);
                  }}
                >
                  Ver eventos sin suavizado
                </Button>
              </div>
              <p className="text-lg font-bold text-slate-900">
                {selectedPointDetails.value.toFixed(2)} A
              </p>
              <p className="text-[11px] text-slate-500">
                {selectedPointDetails.formattedDate}
              </p>
              {meanSigmaLine && (
                <p className="text-[11px] text-slate-600">
                  Med (0σ):{" "}
                  <span className="font-semibold text-slate-900">
                    {meanSigmaLine.value.toFixed(2)} A
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Unified Modal with Tabs */}
          {unifiedModalOpen && selectedPoint && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => {
                  setUnifiedModalOpen(false);
                  setSelectedTipoModal(null);
                }}
              />
              <div className="relative bg-white rounded-lg shadow-xl w-[85vw] h-[75vh] max-w-none p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-4 pb-2 border-b">
                  <h3 className="text-lg font-semibold">
                    {unifiedModalTab === "classify"
                      ? "Clasificar Falla"
                      : "Eventos sin suavizado"}
                  </h3>
                  <div className="flex items-center gap-2">
                    {/* <button
                      onClick={() => setUnifiedModalTab("classify")}
                      className={`px-4 py-2 rounded font-medium text-sm transition ${
                        unifiedModalTab === "classify"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      Clasificación
                    </button> */}
                    <button
                      onClick={() => setUnifiedModalTab("raw")}
                      className={`px-4 py-2 rounded font-medium text-sm transition ${
                        unifiedModalTab === "raw"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      Data cruda
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setUnifiedModalOpen(false);
                        setSelectedTipoModal(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Tab: Classify */}
                {unifiedModalTab === "classify" && (
                  <div
                    className="overflow-y-auto"
                    style={{ maxHeight: "calc(75vh - 120px)" }}
                  >
                    {tiposLoading ? (
                      <div className="text-sm text-slate-500">
                        Cargando tipos...
                      </div>
                    ) : !selectedTipoModal ? (
                      <div>
                        <p className="text-xs text-slate-500 mb-3">
                          Seleccione el tipo de evento:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {tiposEventos.map((t: TipoEvento) => (
                            <button
                              key={t.codigo_tipo_evento}
                              onClick={() => {
                                setSelectedTipoModal(
                                  String(t.codigo_tipo_evento),
                                );
                                getCategoriesForTipo(
                                  String(t.codigo_tipo_evento),
                                );
                              }}
                              className="w-full text-left p-3 rounded border border-slate-300 hover:bg-blue-50 hover:border-blue-400 transition bg-white"
                            >
                              <span className="font-medium text-slate-700">
                                {t.nombre_evento}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <button
                            onClick={() => setSelectedTipoModal(null)}
                            className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition"
                          >
                            ← Atrás
                          </button>
                          <p className="text-sm font-semibold text-slate-700">
                            Categorías:
                          </p>
                        </div>
                        {categoriasLoadingLocal[selectedTipoModal] ? (
                          <div className="text-sm text-slate-500">
                            Cargando categorías...
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(categoriasMapLocal[selectedTipoModal] || []).map(
                              (c: CategoriaEvento) => (
                                <button
                                  key={c.codigo_categoria_evento}
                                  onClick={() =>
                                    handleSaveLabel(
                                      String(c.codigo_categoria_evento),
                                      {
                                        id: String(c.codigo_categoria_evento),
                                        name: c.descripcion,
                                      },
                                    )
                                  }
                                  className="w-full text-left p-3 rounded border border-slate-300 hover:bg-green-50 hover:border-green-400 transition bg-white text-sm"
                                >
                                  <span className="font-medium text-slate-700">
                                    {c.descripcion}
                                  </span>
                                </button>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Raw Data */}
                {unifiedModalTab === "raw" && (
                  <div
                    className="overflow-y-auto"
                    style={{ maxHeight: "calc(75vh - 120px)" }}
                  >
                    {/* Fecha de referencia del punto seleccionado */}
                    {/* {rawCenterHour && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-700 font-medium mb-1">Fecha de Referencia (Centro):</p>
                      <p className="text-sm font-semibold text-amber-900 font-mono">
                        {format(rawCenterHour, "dd MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                  )} */}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-slate-500">
                          Fecha inicio (máx -2h)
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full border rounded px-2 py-1 text-xs"
                          value={rawStart ?? ""}
                          onChange={(e) => setRawStart(e.target.value)}
                          max={
                            selectedPoint?.payload?.date
                              ? format(
                                  new Date(selectedPoint.payload.date),
                                  "yyyy-MM-dd'T'HH:mm",
                                )
                              : undefined
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">
                          Fecha fin (máx +2h)
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full border rounded px-2 py-1 text-xs"
                          value={rawEnd ?? ""}
                          onChange={(e) => setRawEnd(e.target.value)}
                          min={
                            selectedPoint?.payload?.date
                              ? format(
                                  new Date(selectedPoint.payload.date),
                                  "yyyy-MM-dd'T'HH:mm",
                                )
                              : undefined
                          }
                        />
                      </div>
                    </div>




                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="w-full mb-4 py-5 px-2 bg-white rounded-xl border border-gray-100">
                        <ModernWheelPicker
                          label="Ventana de Análisis"
                          suffix="min"
                          value={String(windowMinutes)}
                          onValueChange={(val: string) =>
                            setWindowMinutes(Number(val))
                          }
                          options={Array.from({ length: 116 }, (_, i) => ({
                            value: String(i + 5),
                            label: String(i + 5),
                          }))}
                        />
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              try {
                                const payloadDate = selectedPoint?.payload?.date
                                  ? new Date(selectedPoint.payload.date)
                                  : new Date();
                                const windowMs = windowMinutes * 60 * 1000;
                                const toInput = (d: Date) =>
                                  format(d, "yyyy-MM-dd'T'HH:mm");
                                setRawStart(
                                  toInput(
                                    new Date(payloadDate.getTime() - windowMs),
                                  ),
                                );
                                setRawEnd(
                                  toInput(
                                    new Date(payloadDate.getTime() + windowMs),
                                  ),
                                );
                              } catch (e) {
                                setRawStart(null);
                                setRawEnd(null);
                              }
                            }}
                            className="text-xs"
                          >
                            Aplicar ±{windowMinutes}min
                          </Button>
                        </div>
                      </div>

                      <div className="mb-4 p-3 bg-white border border-gray-100 rounded-lg">
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">
                          Referencias
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-gray-400 font-medium">
                              Componente:
                            </p>
                            <p className="text-gray-500">
                              {componentId || "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-medium">
                              Valor Actual:
                            </p>
                            <p className="text-gray-500 font-mono">
                              {selectedPoint?.payload?.[valueKey]?.toFixed(2) ||
                                "N/A"}{" "}
                              A
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-medium">
                            Referencia:
                            </p>
                            <p className="text-gray-500 font-mono">
                              {referenceKey &&
                              selectedPoint?.payload?.[referenceKey]
                                ? selectedPoint.payload[referenceKey].toFixed(2)
                                : "N/A"}{" "}
                              A
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-medium">
                              Media (x̄):
                            </p>
                            <p className="text-gray-500 font-mono">
                              {mean !== null ? mean.toFixed(2) : "N/A"} A
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-medium">
                              Sigma Límite (±σ):
                            </p>
                            <p className="text-gray-500 font-mono">
                              {sigmaLimit !== null
                                ? sigmaLimit.toFixed(2)
                                : "No configurado"}{" "}
                              A
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-medium">
                              Rango Permitido:
                            </p>
                            {mean !== null && sigmaLimit ? (
                              <p className="text-gray-500 font-mono">
                                [{(mean - sigmaLimit).toFixed(2)},{" "}
                                {(mean + sigmaLimit).toFixed(2)}] A
                              </p>
                            ) : (
                              <p className="text-gray-400">N/A</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>




                    <div className="flex items-center gap-2 mb-3">
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!selectedPoint) return;
                          if (!rawStart || !rawEnd) {
                            toast({
                              title: "Rango incompleto",
                              description: "Seleccione inicio y fin",
                              variant: "destructive",
                            });
                            return;
                          }
                          // validate within ±2h of event
                          try {
                            const evt = selectedPoint.payload?.date
                              ? new Date(selectedPoint.payload.date)
                              : new Date();
                            const start = new Date(rawStart);
                            const end = new Date(rawEnd);
                            const windowMs = windowMinutes * 60 * 1000;
                            const minAllowed = new Date(
                              evt.getTime() - windowMs,
                            );
                            const maxAllowed = new Date(
                              evt.getTime() + windowMs,
                            );
                            if (
                              start < minAllowed ||
                              start > evt ||
                              end < evt ||
                              end > maxAllowed ||
                              start >= end
                            ) {
                              toast({
                                title: "Rango inválido",
                                description: `El rango debe estar dentro de ±${windowMinutes} minutos alrededor del evento y start < end`,
                                variant: "destructive",
                              });
                              return;
                            }
                            setRawLoading(true);
                            // build params — prefer explicit componentId and try multiple fallbacks for machine
                            const comboValue =
                              selectedPoint.payload?.Componente ||
                              selectedPoint.payload?.componente ||
                              selectedPoint.payload?.Component ||
                              selectedPoint.payload?.component ||
                              selectedPoint.payload?.nombre_componente ||
                              undefined;
                            const resolvedComponente =
                              componentId && String(componentId).trim() !== ""
                                ? String(componentId)
                                : comboValue
                                  ? String(comboValue)
                                  : "";
                            const resolvedMaquina =
                              machine && String(machine).trim() !== ""
                                ? String(machine)
                                : selectedPoint.payload?.Maquina &&
                                    String(
                                      selectedPoint.payload.Maquina,
                                    ).trim() !== ""
                                  ? String(selectedPoint.payload.Maquina)
                                  : selectedPoint.payload?.maquina &&
                                      String(
                                        selectedPoint.payload.maquina,
                                      ).trim() !== ""
                                    ? String(selectedPoint.payload.maquina)
                                    : sortedData &&
                                        sortedData[0] &&
                                        (sortedData[0] as any).Maquina
                                      ? String((sortedData[0] as any).Maquina)
                                      : sortedData &&
                                          sortedData[0] &&
                                          (sortedData[0] as any).maquina
                                        ? String((sortedData[0] as any).maquina)
                                        : "";

                            const paramsTotal = {
                              Maquina: resolvedMaquina,
                              Componente: resolvedComponente,
                              FechaInicio: format(start, "yyyy-MM-dd HH:mm:ss"),
                              FechaFin: format(end, "yyyy-MM-dd HH:mm:ss"),
                            };
                            // get total
                            const totalResp =
                              await calculosCorrientesDatosMantenimientoService.getTotalDataCrudaPorFechaComponenteEquipo(
                                paramsTotal as any,
                              );
                            const total =
                              Array.isArray((totalResp as any).data) &&
                              (totalResp as any).data[0] &&
                              (totalResp as any).data[0].Total
                                ? Number((totalResp as any).data[0].Total)
                                : Number((totalResp as any).total || 0);
                            setRawTotal(total);
                            const perPage = 500;
                            const pages = Math.max(
                              1,
                              Math.ceil((total || 0) / perPage),
                            );
                            const acc: any[] = [];
                            for (let page = 1; page <= pages; page++) {
                              const resp =
                                await calculosCorrientesDatosMantenimientoService.getTodosRegistrosDataCruda(
                                  {
                                    Maquina: paramsTotal.Maquina,
                                    Componente: paramsTotal.Componente,
                                    FechaInicio: paramsTotal.FechaInicio,
                                    FechaFin: paramsTotal.FechaFin,
                                    page,
                                    limit: perPage,
                                  },
                                );
                              const pageData = Array.isArray((resp as any).data)
                                ? (resp as any).data
                                : [];
                              acc.push(...pageData);
                            }
                            console.log("📊 Datos crudos cargados:", {
                              total: acc.length,
                              primerRegistro: acc[0],
                              ultimoRegistro: acc[acc.length - 1],
                            });
                            setRawEventsData(acc);
                            setConfirmedBrushRange(null);
                            setGlobalCategoriaId(null);
                            setBrushRange(null);
                          } catch (err) {
                            console.error(
                              "Error cargando eventos sin suavizado",
                              err,
                            );
                            toast({
                              title: "Error",
                              description:
                                "No se pudo recuperar eventos crudos",
                              variant: "destructive",
                            });
                          } finally {
                            setRawLoading(false);
                          }
                        }}
                      >
                        Buscar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRawEventsData([]);
                          setRawTotal(null);
                          setConfirmedBrushRange(null);
                          setGlobalCategoriaId(null);
                          setBrushRange(null);
                          setUnifiedModalOpen(false);
                        }}
                      >
                        Cerrar
                      </Button>
                      <div className="ml-auto text-xs text-slate-500">
                        {rawLoading
                          ? "Cargando..."
                          : rawTotal !== null
                            ? `Total: ${rawTotal}`
                            : ""}
                      </div>
                    </div>

                    <div className="h-80">
                      {!rawLoading && rawEventsData.length === 0 && (
                        <div className="text-sm text-slate-500">
                          No hay datos cargados.
                        </div>
                      )}
                      {!rawLoading && rawEventsData.length > 0 && (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={plottedRaw}
                            margin={{ top: 5, right: isMobile ? 20 : 140, left: 0, bottom: 30 }}
                            onClick={handleRawChartClick}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(v) => {
                                try {
                                  return format(
                                    parseISO(String(v)),
                                    "dd MMM HH:mm",
                                    { locale: es },
                                  );
                                } catch {
                                  return String(v);
                                }
                              }}
                            />
                            <YAxis tickFormatter={(v) => Number(v).toFixed(2)} />
                            <RechartsTooltip
                              formatter={(value: any) =>
                                value === null || value === undefined
                                  ? ["-", ""]
                                  : [`${Number(value).toFixed(2)} A`, ""]
                              }
                              labelFormatter={(label) => {
                                try {
                                  return format(
                                    parseISO(String(label)),
                                    "dd MMM yyyy HH:mm:ss",
                                    { locale: es },
                                  );
                                } catch {
                                  return String(label);
                                }
                              }}
                            />
                            <Legend formatter={renderLegendText} />
                            <Line
                              type="monotone"
                              dataKey="L1"
                              name="Corriente L1"
                              stroke="#9CA3AF"
                              strokeWidth={1.5}
                              dot={false}
                              connectNulls={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="L2"
                              name="Corriente L2"
                              stroke="#B7C0C7"
                              strokeWidth={1.5}
                              dot={false}
                              connectNulls={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="L3"
                              name="Corriente L3"
                              stroke="#D1D5DB"
                              strokeWidth={1.5}
                              dot={false}
                              connectNulls={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="avg"
                              name="Promedio (L1,L2,L3)"
                              stroke="#0055b8"
                              strokeWidth={2.5}
                              dot={false}
                              connectNulls={false}
                            />

                            {sigmaLines.length > 0 &&
                              sigmaLines.map((line) => (
                                <Line
                                  key={`sigma-raw-${line.key}`}
                                  type="monotone"
                                  dataKey={() => null}
                                  name={line.label}
                                  stroke={line.color}
                                  strokeDasharray={line.dash}
                                  strokeWidth={line.width}
                                  isAnimationActive={false}
                                />
                              ))}

                            {sigmaLines.length > 0 &&
                              sigmaLines.map((line) => (
                                <ReferenceLine
                                  key={`sigma-ref-raw-${line.key}`}
                                  y={line.value}
                                  stroke={line.color}
                                  strokeDasharray={line.dash}
                                  strokeWidth={line.width}
                                  label={{
                                    value: line.labelWithValue,
                                    position: "right",
                                    fill: line.color,
                                    fontSize: 11,
                                    fontWeight:
                                      line.multiplier === 0 ? "bold" : "normal",
                                    textAnchor: "start",
                                    dx: 6,
                                  }}
                                />
                              ))}

                            {/* Red dots marking selected outlier events */}
                            {selectedOutlierDots.map((dot, i) => (
                              <ReferenceDot
                                key={`outlier-dot-${i}`}
                                x={dot.date}
                                y={dot.value}
                                r={7}
                                fill="#ef4444"
                                stroke="#dc2626"
                                strokeWidth={2}
                              />
                            ))}

                            {/* Red ReferenceArea highlighting the confirmed brush selection */}
                            {confirmedBrushRange && (
                              <ReferenceArea
                                x1={confirmedBrushRange.startDate}
                                x2={confirmedBrushRange.endDate}
                                fill="#ef4444"
                                fillOpacity={0.12}
                                stroke="#dc2626"
                                strokeWidth={1.5}
                                strokeDasharray="4 2"
                              />
                            )}

                            {/* Brush selector - drag to select a range and auto-mark outliers */}
                            <Brush
                              dataKey="date"
                              height={25}
                              stroke="#3b82f6"
                              fill="#eff6ff"
                              tickFormatter={(v: string) => {
                                try {
                                  return format(parseISO(String(v)), "HH:mm", {
                                    locale: es,
                                  });
                                } catch {
                                  return "";
                                }
                              }}
                              onChange={handleBrushChange}
                              travellerWidth={8}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Tabla de eventos fuera de rango */}
                    <div className="mt-6 border-t pt-4" ref={outlierTableRef}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-sm">
                            Registros en el Intervalo: {outlierEvents.filter((o) => o.selected).length}{" "}
                            de {outlierEvents.length} total
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Seleccionados del intervalo de tiempo del deslizador
                          </p>
                          <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded-full bg-red-500 border-2 border-red-700 flex-shrink-0"></span>
                            Arrastra el selector inferior para seleccionar un rango de tiempo
                            {brushSelectionCount > 0 && (
                              <span className="ml-2 inline-block px-2 py-0.5 bg-blue-200 text-blue-700 text-xs rounded-full font-semibold">
                                {brushSelectionCount} registros seleccionados
                              </span>
                            )}
                          </p>
                        </div>
                        {outlierEvents.length > 0 && (
                          <Button
                            size="sm"
                            onClick={async () => {
                              const selectedOutliers = outlierEvents.filter(
                                (o) => o.selected,
                              );
                              if (selectedOutliers.length === 0 || !globalCategoriaId) {
                                toast({
                                  title: "Sin selección",
                                  description:
                                    "Seleccione al menos un evento y asigne una categoría global",
                                  variant: "destructive",
                                });
                                return;
                              }

                              setSavingBulk(true);
                              let successCount = 0;
                              let errorCount = 0;

                              try {
                                // Resolve codigo_componente once for all events
                                let codigoComponenteResolved: string = String(componentId);
                                try {
                                  const normalize = (s: any) =>
                                    (s || "").toString().toLowerCase().replace(/[\s_\-]+/g, " ").trim();
                                  const equiposResp = await equipoService.getAll();
                                  const equipos = Array.isArray(equiposResp.data) ? equiposResp.data : [];
                                  const machineName = machine || "";
                                  const machineNameNorm = normalize(machineName);
                                  let equipoFound = equipos.find((e: any) => normalize(e.nombre_equipo) === machineNameNorm);
                                  if (!equipoFound && machineNameNorm) {
                                    equipoFound = equipos.find((e: any) =>
                                      normalize(e.nombre_equipo).includes(machineNameNorm) ||
                                      machineNameNorm.includes(normalize(e.nombre_equipo)),
                                    );
                                  }
                                  const codigoEquipo = equipoFound ? String(equipoFound.codigo_equipo) : undefined;
                                  const compsResp = await componenteService.getAll();
                                  const comps = Array.isArray(compsResp.data) ? compsResp.data : [];
                                  let componentFound = comps.find(
                                    (c: any) => c.nombre_componente === codigoComponenteResolved &&
                                      (!codigoEquipo || String(c.codigo_equipo) === codigoEquipo),
                                  );
                                  if (componentFound) {
                                    codigoComponenteResolved = componentFound.codigo_componente;
                                  }
                                } catch (err) {
                                  console.warn("Error resolviendo componente:", err);
                                }

                                const categoriaDesc = allCategorias.find(
                                  (c) => String(c.codigo_categoria_evento) === globalCategoriaId,
                                )?.descripcion || "Evento detectado";

                                for (const outlier of selectedOutliers) {
                                  try {
                                    const event = outlier.data;
                                    const payloadDate =
                                      event.FECHA ||
                                      event.fecha ||
                                      event.DATE ||
                                      event.date ||
                                      new Date().toISOString();

                                    const toNumber = (v: any) => {
                                      const n = Number(v);
                                      return Number.isFinite(n) ? n : null;
                                    };
                                    const l1 = toNumber(
                                      event.CORRIENTE_L1 ??
                                        event.CORRIENTE_LA ??
                                        event.corriente_l1 ??
                                        event.L1 ??
                                        event.l1 ??
                                        null,
                                    );
                                    const l2 = toNumber(
                                      event.CORRIENTE_L2 ??
                                        event.CORRIENTE_LB ??
                                        event.corriente_l2 ??
                                        event.L2 ??
                                        event.l2 ??
                                        null,
                                    );
                                    const l3 = toNumber(
                                      event.CORRIENTE_L3 ??
                                        event.CORRIENTE_LC ??
                                        event.corriente_l3 ??
                                        event.L3 ??
                                        event.l3 ??
                                        null,
                                    );
                                    const values = [l1, l2, l3].filter(
                                      (v) => v !== null,
                                    );
                                    const avg = values.length
                                      ? values.reduce((a, b) => a + b, 0) /
                                        values.length
                                      : null;

                                    const paramsSimple = {
                                      x_hat: mean ?? null,
                                      reg_current: avg,
                                      reg_desbalance: null,
                                      reg_factor_carga: null,
                                      fecha_punto: payloadDate
                                        ? format(
                                            new Date(payloadDate),
                                            "yyyy-MM-dd HH:mm:ss",
                                          )
                                        : null,
                                    };
                                    const historialPayload = {
                                      codigo_historial: 0,
                                      codigo_componente:
                                        codigoComponenteResolved,
                                      codigo_categoria_evento: String(
                                        globalCategoriaId,
                                      ),
                                      fecha_evento: format(
                                        new Date(),
                                        "yyyy-MM-dd HH:mm:ss",
                                      ),
                                      descripcion: categoriaDesc,
                                      params: JSON.stringify(paramsSimple),
                                      estado: "A",
                                    } as any;

                                    await historialService.save(
                                      historialPayload,
                                    );
                                    successCount++;
                                  } catch (err) {
                                    console.error(
                                      "Error guardando evento individual:",
                                      err,
                                    );
                                    errorCount++;
                                  }
                                }

                                toast({
                                  title: "Guardado completado",
                                  description: `${successCount} evento(s) guardado(s)${errorCount > 0 ? `, ${errorCount} error(es)` : ""}`,
                                  variant:
                                    successCount > 0
                                      ? "success"
                                      : "destructive",
                                });

                                // Limpiar tabla después de guardar
                                setOutlierEvents([]);
                                setRawEventsData([]);
                                setConfirmedBrushRange(null);
                                setGlobalCategoriaId(null);
                                setBrushRange(null);
                              } finally {
                                setSavingBulk(false);
                              }
                            }}
                            disabled={
                              !outlierEvents.some((o) => o.selected) ||
                              !globalCategoriaId ||
                              savingBulk
                            }
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {savingBulk
                              ? "Guardando..."
                              : `Guardar ${outlierEvents.filter((o) => o.selected).length} evento(s)`}
                          </Button>
                        )}
                      </div>

                      {/* Selection controls */}
                      {outlierEvents.length > 0 && (
                        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                          <span className="inline-block w-3 h-3 rounded-full bg-red-500 border-2 border-red-700 flex-shrink-0"></span>
                          <p className="text-xs text-blue-700 flex-1">
                            Los puntos seleccionados se marcan en rojo en la
                            gráfica. Arrastra el selector del gráfico para
                            seleccionar un rango.
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2"
                              onClick={() =>
                                setOutlierEvents((prev) =>
                                  prev.map((o) => ({ ...o, selected: true })),
                                )
                              }
                            >
                              ✓ Todo
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2"
                              onClick={() =>
                                setOutlierEvents((prev) =>
                                  prev.map((o) => ({ ...o, selected: false })),
                                )
                              }
                            >
                              ✗ Nada
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Clasificación global única para todos los puntos seleccionados */}
                      {outlierEvents.length > 0 && outlierEvents.some((o) => o.selected) && (
                        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-amber-800 whitespace-nowrap">
                              Clasificación para {outlierEvents.filter((o) => o.selected).length} evento(s) seleccionado(s):
                            </span>
                            <Select
                              value={globalCategoriaId || ""}
                              onValueChange={(value) => setGlobalCategoriaId(value)}
                            >
                              <SelectTrigger className="w-64 h-9 bg-white">
                                <SelectValue placeholder="Seleccionar categoría" />
                              </SelectTrigger>
                              <SelectContent>
                                {allCategorias.map((cat) => (
                                  <SelectItem
                                    key={cat.codigo_categoria_evento}
                                    value={String(cat.codigo_categoria_evento)}
                                  >
                                    {cat.descripcion}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {globalCategoriaId && (
                              <span className="text-xs text-green-700 font-medium">✓ Se creará 1 registro de historial por cada punto seleccionado</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tabla de eventos */}
                      {outlierEvents.length > 0 && (
                        <div className="overflow-x-auto border rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100 border-b">
                              <tr>
                                <th className="px-3 py-2 text-left w-8">
                                  Sel.
                                </th>
                                <th className="px-3 py-2 text-left">
                                  Fecha/Hora
                                </th>
                                <th className="px-3 py-2 text-right">L1 (A)</th>
                                <th className="px-3 py-2 text-right">L2 (A)</th>
                                <th className="px-3 py-2 text-right">L3 (A)</th>
                                <th className="px-3 py-2 text-right">
                                  Media (A)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {outlierEvents.map((outlier, idx) => {
                                const event = outlier.data;
                                const toNumber = (v: any) => {
                                  const n = Number(v);
                                  return Number.isFinite(n) ? n : NaN;
                                };
                                const l1 = toNumber(
                                  event.CORRIENTE_L1 ??
                                    event.CORRIENTE_LA ??
                                    event.corriente_l1 ??
                                    event.L1 ??
                                    event.l1 ??
                                    null,
                                );
                                const l2 = toNumber(
                                  event.CORRIENTE_L2 ??
                                    event.CORRIENTE_LB ??
                                    event.corriente_l2 ??
                                    event.L2 ??
                                    event.l2 ??
                                    null,
                                );
                                const l3 = toNumber(
                                  event.CORRIENTE_L3 ??
                                    event.CORRIENTE_LC ??
                                    event.corriente_l3 ??
                                    event.L3 ??
                                    event.l3 ??
                                    null,
                                );
                                const values = [l1, l2, l3].filter(
                                  (v) => !isNaN(v),
                                );
                                const avg = values.length
                                  ? values.reduce((a, b) => a + b, 0) /
                                    values.length
                                  : NaN;
                                const fecha =
                                  event.FECHA ||
                                  event.fecha ||
                                  event.DATE ||
                                  event.date ||
                                  "";
                                let formattedFecha = fecha;
                                try {
                                  formattedFecha = format(
                                    parseISO(String(fecha)),
                                    "dd MMM HH:mm:ss",
                                    { locale: es },
                                  );
                                } catch {}

                                return (
                                  <tr
                                    key={outlier.id}
                                    className={`cursor-pointer transition-colors ${
                                      outlier.selected
                                        ? "bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500"
                                        : idx % 2 === 0
                                          ? "bg-white hover:bg-slate-100"
                                          : "bg-slate-50 hover:bg-slate-100"
                                    }`}
                                    onClick={() => {
                                      setOutlierEvents((prev) =>
                                        prev.map((o) =>
                                          o.id === outlier.id
                                            ? { ...o, selected: !o.selected }
                                            : o,
                                        ),
                                      );
                                    }}
                                  >
                                    <td
                                      className="px-3 py-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Checkbox
                                        checked={outlier.selected}
                                        onCheckedChange={(checked) => {
                                          setOutlierEvents((prev) =>
                                            prev.map((o) =>
                                              o.id === outlier.id
                                                ? { ...o, selected: !!checked }
                                                : o,
                                            ),
                                          );
                                        }}
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-600">
                                      {formattedFecha}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-xs">
                                      {isNaN(l1) ? "-" : l1.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-xs">
                                      {isNaN(l2) ? "-" : l2.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-xs">
                                      {isNaN(l3) ? "-" : l3.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-semibold">
                                      {isNaN(avg) ? "-" : avg.toFixed(2)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <ResponsiveContainer>
            <ComposedChart
              data={sortedData}
              margin={{ top: 5, right: isMobile ? 20 : 140, left: 20, bottom: 5 }}
              onClick={handleChartClick}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={tickFormatter}
                tick={{ fill: "#64748b" }}
                stroke="#e2e8f0"
                interval="preserveStartEnd"
                minTickGap={80}
              />
              <YAxis
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  offset: -10,
                  fill: "#64748b",
                }}
                tick={{ fill: "#64748b" }}
                tickFormatter={(v) => Number(v).toFixed(2)}
                stroke="#e2e8f0"
                domain={["dataMin - 1", "auto"]}
                allowDataOverflow={true}
              />

              <RechartsTooltip
                content={
                  <CustomTooltip
                    meanLine={
                      meanSigmaLine
                        ? {
                            label: meanSigmaLine.label,
                            value: meanSigmaLine.value,
                            color: meanSigmaLine.color,
                          }
                        : null
                    }
                  />
                }
                cursor={{ stroke: "#0ea5e9", strokeWidth: 2 }}
                wrapperStyle={{ pointerEvents: "none" }}
              />

              <Legend formatter={renderLegendText} />

              <defs>
                <linearGradient
                  id={`color${metric}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                </linearGradient>
              </defs>

              <Area
                type="monotone"
                dataKey={(point) =>
                  point.isProjection ? null : point[valueKey]
                }
                name="Promedio Diario"
                stroke="#0284c7"
                fillOpacity={1}
                fill={`url(#color${metric})`}
                strokeWidth={2}
                activeDot={{
                  r: 6,
                  className: metric === "current" ? "cursor-pointer" : "",
                  strokeWidth: 0,
                }}
                dot={false}
                connectNulls={false}
              />

              {referenceKey && (
                <Line
                  type="monotone"
                  dataKey={referenceKey as string}
                  name="Referencia"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              )}
              <Line
                type="monotone"
                dataKey={limitKey as string}
                name={limitLabel}
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
                connectNulls={true}
                isAnimationActive={false}
              />

              {sigmaLines.length > 0 &&
                sigmaLines.map((line) => (
                  <Line
                    key={`sigma-legend-${line.key}`}
                    type="monotone"
                    dataKey={() => null}
                    name={line.label}
                    stroke={line.color}
                    strokeDasharray={line.dash}
                    strokeWidth={line.width}
                    isAnimationActive={false}
                  />
                ))}

              {sigmaLines.length > 0 &&
                sigmaLines.map((line) => (
                  <ReferenceLine
                    key={`sigma-${line.key}`}
                    y={line.value}
                    stroke={line.color}
                    strokeDasharray={line.dash}
                    strokeWidth={line.width}
                    label={{
                      value: line.labelWithValue,
                      position: "right",
                      fill: line.color,
                      fontSize: 12,
                      fontWeight: line.multiplier === 0 ? "bold" : "normal",
                      textAnchor: "start",
                      dx: 6,
                    }}
                  />
                ))}

              {/* Bandas de zonas de registros manuales */}
              {zonas.seguraInf !== null && zonas.seguraSup !== null && (
                <ReferenceArea
                  y1={zonas.seguraInf}
                  y2={zonas.seguraSup}
                  fill="#22c55e"
                  fillOpacity={0.08}
                  stroke="#22c55e"
                  strokeOpacity={0.3}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: "Zona Segura",
                    position: "right",
                    fill: "#22c55e",
                    fontSize: 11,
                  }}
                />
              )}

              {zonas.alertaInf !== null && zonas.alertaSup !== null && (
                <ReferenceArea
                  y1={zonas.alertaInf}
                  y2={zonas.alertaSup}
                  fill="#f59e0b"
                  fillOpacity={0.08}
                  stroke="#f59e0b"
                  strokeOpacity={0.3}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: "Zona Alerta",
                    position: "right",
                    fill: "#f59e0b",
                    fontSize: 11,
                  }}
                />
              )}

              {zonas.criticaInf !== null && zonas.criticaSup !== null && (
                <ReferenceArea
                  y1={zonas.criticaInf}
                  y2={zonas.criticaSup}
                  fill="#ef4444"
                  fillOpacity={0.08}
                  stroke="#ef4444"
                  strokeOpacity={0.3}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: "Zona Crítica",
                    position: "right",
                    fill: "#ef4444",
                    fontSize: 11,
                  }}
                />
              )}

              <Line
                type="monotone"
                dataKey={predictionKey.toString()}
                name="Proyección Tendencia"
                stroke="#9333ea"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey={predictionPesimisticKey.toString()}
                name="Proyección Pesimista"
                stroke="#f97316"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey={predictionOptimisticKey.toString()}
                name="Proyección Optimista"
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />

              {selectedPoint && selectedPoint.payload && (
                <ReferenceDot
                  x={selectedPoint.payload.date}
                  y={selectedPoint.payload[valueKey]}
                  r={6}
                  fill="#ef4444"
                  stroke="#dc2626"
                  strokeWidth={2}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          {labelingMenu && selectedPoint && (
            <LabelingMenu
              position={labelingMenu}
              onSelect={handleSaveLabel}
              onClose={closeLabelingMenu}
              tipos={tiposEventos}
              getCategoriesForTipo={getCategoriesForTipo}
              saving={savingLabel}
            />
          )}
        </div>

        {/* Modal Flotante */}
        {expandedChart && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full h-[90vh] max-w-6xl flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-bold">
                  Vista Expandida - {yAxisLabel}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.2))}
                  >
                    Alejar
                  </Button>
                  <span className="text-sm font-medium w-12 text-center">
                    {(zoomLevel * 100).toFixed(0)}%
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.2))}
                  >
                    Acercar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setExpandedChart(false);
                      setZoomLevel(1);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Chart Container */}
              <div className="flex-1 overflow-auto p-4">
                <div
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: "top left",
                    width: `${100 / zoomLevel}%`,
                  }}
                >
                  <div className="h-screen w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={sortedData}
                        margin={{ top: 5, right: isMobile ? 20 : 140, left: 20, bottom: 5 }}
                        onClick={handleChartClick}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={tickFormatter}
                          tick={{ fill: "#64748b" }}
                          stroke="#e2e8f0"
                          interval="preserveStartEnd"
                          minTickGap={80}
                        />
                        <YAxis
                          label={{
                            value: yAxisLabel,
                            angle: -90,
                            position: "insideLeft",
                            offset: -10,
                            fill: "#64748b",
                          }}
                          tick={{ fill: "#64748b" }}
                          tickFormatter={(v) => Number(v).toFixed(2)}
                          stroke="#e2e8f0"
                          domain={["dataMin - 1", "auto"]}
                          allowDataOverflow={true}
                        />

                        <RechartsTooltip
                          content={
                            <CustomTooltip
                              meanLine={
                                meanSigmaLine
                                  ? {
                                      label: meanSigmaLine.label,
                                      value: meanSigmaLine.value,
                                      color: meanSigmaLine.color,
                                    }
                                  : null
                              }
                            />
                          }
                          cursor={{ stroke: "#0ea5e9", strokeWidth: 2 }}
                          wrapperStyle={{ pointerEvents: "none" }}
                        />

                        <Legend formatter={renderLegendText} />

                        <defs>
                          <linearGradient
                            id={`color${metric}-expanded`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#0284c7"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#0284c7"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>

                        <Area
                          type="monotone"
                          dataKey={(point) =>
                            point.isProjection ? null : point[valueKey]
                          }
                          name="Promedio Diario"
                          stroke="#0284c7"
                          fillOpacity={1}
                          fill={`url(#color${metric}-expanded)`}
                          strokeWidth={2}
                          activeDot={{
                            r: 6,
                            className:
                              metric === "current" ? "cursor-pointer" : "",
                            strokeWidth: 0,
                          }}
                          dot={false}
                          connectNulls={false}
                        />

                        {referenceKey && (
                          <Line
                            type="monotone"
                            dataKey={referenceKey as string}
                            name="Referencia"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={true}
                            isAnimationActive={false}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey={limitKey as string}
                          name={limitLabel}
                          stroke="#dc2626"
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                          isAnimationActive={false}
                        />

                        {sigmaLines.length > 0 &&
                          sigmaLines.map((line) => (
                            <Line
                              key={`sigma-legend-expanded-${line.key}`}
                              type="monotone"
                              dataKey={() => null}
                              name={line.label}
                              stroke={line.color}
                              strokeDasharray={line.dash}
                              strokeWidth={line.width}
                              isAnimationActive={false}
                            />
                          ))}

                        {sigmaLines.length > 0 &&
                          sigmaLines.map((line) => (
                            <ReferenceLine
                              key={`sigma-expanded-${line.key}`}
                              y={line.value}
                              stroke={line.color}
                              strokeDasharray={line.dash}
                              strokeWidth={line.width}
                              label={{
                                value: line.labelWithValue,
                                position: "right",
                                fill: line.color,
                                fontSize: 12,
                                fontWeight:
                                  line.multiplier === 0 ? "bold" : "normal",
                                textAnchor: "start",
                                dx: 6,
                              }}
                            />
                          ))}

                        <Line
                          type="monotone"
                          dataKey={predictionKey.toString()}
                          name="Proyección Tendencia"
                          stroke="#9333ea"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey={predictionPesimisticKey.toString()}
                          name="Proyección Pesimista"
                          stroke="#f97316"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey={predictionOptimisticKey.toString()}
                          name="Proyección Optimista"
                          stroke="#22c55e"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          connectNulls={false}
                          isAnimationActive={false}
                        />

                        {selectedPoint && selectedPoint.payload && (
                          <ReferenceDot
                            x={selectedPoint.payload.date}
                            y={selectedPoint.payload[valueKey]}
                            r={6}
                            fill="#ef4444"
                            stroke="#dc2626"
                            strokeWidth={2}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

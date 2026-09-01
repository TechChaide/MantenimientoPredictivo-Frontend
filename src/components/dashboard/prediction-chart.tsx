"use client";

import React, { useMemo } from "react";
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
} from "recharts";

export interface PredictionDataPoint {
  date: string;
  isProjection: boolean;
  componentId: string;
  historico?: number | null;
  prediccion?: number | null;
  limite_inferior?: number | null;
  limite_superior?: number | null;
}

interface PredictionChartProps {
  historicalData: any[];
  predictionData: any[];
  historicalKey: string;
  title: string;
  yAxisLabel?: string;
  height?: number;
  accentColor?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  let formattedLabel = label;
  try {
    formattedLabel = format(parseISO(label), "dd MMM yyyy HH:mm", { locale: es });
  } catch {}

  return (
    <div className="rounded-lg border bg-white p-3 shadow-md text-xs">
      <p className="font-semibold text-slate-700 mb-1">{formattedLabel}</p>
      {Array.from(new Map(payload.filter((e: any) => e.value != null).map((e: any) => [e.dataKey, e])).values()).map((entry: any) => {
        const nameMap: Record<string, string> = {
          historico: "Histórico",
          prediccion: "Mejor Estimación",
          limite_superior: "Límite Superior (95%)",
          limite_inferior: "Límite Inferior (95%)",
        };
        return (
          <p key={entry.dataKey} style={{ color: entry.color || entry.stroke }} className="text-xs">
            {nameMap[entry.dataKey] || entry.dataKey}: <strong>{entry.value?.toFixed(2)}</strong>
          </p>
        );
      })}
    </div>
  );
};

const SIGMA_LINE_CONFIG = [
  { key: "neg3", label: "-3σ", multiplier: -3, color: "#ec4899", dash: "5 5", width: 1.5 },
  { key: "neg2", label: "-2σ", multiplier: -2, color: "#f97316", dash: "3 3", width: 1.5 },
  { key: "neg1", label: "-1σ", multiplier: -1, color: "#22c55e", dash: "2 4", width: 1.5 },
  { key: "mean", label: "x̄",  multiplier: 0,  color: "#0f172a", dash: undefined, width: 2.5 },
  { key: "pos1", label: "+1σ", multiplier: 1,  color: "#22c55e", dash: "2 4", width: 1.5 },
  { key: "pos2", label: "+2σ", multiplier: 2,  color: "#f97316", dash: "3 3", width: 1.5 },
  { key: "pos3", label: "+3σ", multiplier: 3,  color: "#ec4899", dash: "5 5", width: 1.5 },
];

export function PredictionChart({
  historicalData,
  predictionData,
  historicalKey,
  title,
  yAxisLabel = "Amperios",
  height = 400,
  accentColor = "#dc2626",
}: PredictionChartProps) {
  const chartData = useMemo(() => {
    const toTs = (d: string) => new Date(d).getTime();

    // Build historical points (only real, non-projection data) and sort by date
    const histPoints = historicalData
      .filter((d) => !d.isProjection)
      .map((d) => ({
        date: d.date,
        ts: toTs(d.date),
        historico: d[historicalKey] != null ? Number(d[historicalKey]) : null,
        prediccion: null as number | null,
        limite_inferior: null as number | null,
        limite_superior: null as number | null,
      }))
      .sort((a, b) => a.ts - b.ts);

    // Build prediction points — include ALL from the API, sorted by date
    const predPoints = predictionData
      .map((d) => ({
        date: d.date,
        ts: toTs(d.date),
        historico: null as number | null,
        prediccion: d.proyeccion_corriente_tendencia != null ? Number(d.proyeccion_corriente_tendencia) : null,
        limite_inferior: d.proyeccion_corriente_pesimista != null ? Number(d.proyeccion_corriente_pesimista) : null,
        limite_superior: d.proyeccion_corriente_optimista != null ? Number(d.proyeccion_corriente_optimista) : null,
      }))
      .sort((a, b) => a.ts - b.ts);

    // ALWAYS: historical data first (left side), then predictions (right side)
    // Do NOT mix them by global timestamp
    return [...histPoints, ...predPoints];
  }, [historicalData, predictionData, historicalKey]);

  // Find the boundary date between historical and prediction
  const boundaryDate = useMemo(() => {
    const realPoints = historicalData.filter((d) => !d.isProjection);
    if (realPoints.length === 0) return null;
    // Sort by timestamp and return the date string of the last real point
    const sorted = [...realPoints].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sorted[sorted.length - 1].date;
  }, [historicalData]);

  // Compute mean and standard deviation from historical data for sigma lines
  const { mean, sigma } = useMemo(() => {
    const realData = historicalData.filter((d) => !d.isProjection);
    const values = realData
      .map((d) => Number(d[historicalKey]))
      .filter((v) => !isNaN(v) && v > 0);
    if (values.length === 0) return { mean: null, sigma: 0 };

    const m = values.reduce((a, b) => a + b, 0) / values.length;
    // El rango real de los datos históricos sirve para detectar un sigma del
    // backend fuera de escala (ej. Desv_PromedioSuavizado corrupto/en otras
    // unidades) — visto en vivo: dispara el eje Y a cientos de miles de
    // millones mientras el histórico real está entre 2 y 4. Si el sigma es
    // desproporcionado respecto al propio rango de los datos, se descarta y
    // se recalcula manualmente en vez de romper la escala del gráfico.
    const rangoHistorico = Math.max(...values) - Math.min(...values) || m || 1;

    // Try to get sigma from backend data first (Desv_PromedioSuavizado)
    for (const point of realData) {
      const val = Number(point["Desv_PromedioSuavizado"]);
      if (!isNaN(val) && val > 0 && val <= rangoHistorico * 20) {
        return { mean: m, sigma: val };
      }
    }

    // Fallback: calculate sigma manually
    const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1 || 1);
    return { mean: m, sigma: Math.sqrt(variance) };
  }, [historicalData, historicalKey]);

  const sigmaLines = useMemo(() => {
    if (mean === null || sigma <= 0) return [];
    return SIGMA_LINE_CONFIG.map((config) => ({
      ...config,
      value: mean + config.multiplier * sigma,
    }));
  }, [mean, sigma]);

  // Sin domain explícito, Recharts usa [0, auto] — si los datos reales están lejos
  // de 0 (ej. entre 1.9 y 3.8), se desperdicia todo ese espacio de abajo. Se arma
  // el dominio a partir de los valores realmente graficados (histórico, predicción,
  // bandas de confianza y líneas de sigma) con un margen, para aprovechar el alto
  // disponible sin cortar ninguna línea.
  const yDomain = useMemo((): [number, number] | undefined => {
    const valores: number[] = [];
    chartData.forEach((d) => {
      [d.historico, d.prediccion, d.limite_inferior, d.limite_superior].forEach((v) => {
        if (v != null && Number.isFinite(v)) valores.push(v);
      });
    });
    sigmaLines.forEach((l) => valores.push(l.value));
    if (valores.length === 0) return undefined;
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const margen = (max - min) * 0.1 || Math.max(Math.abs(max), 1) * 0.1;
    return [min - margen, max + margen];
  }, [chartData, sigmaLines]);

  const formatXAxis = (value: string) => {
    try {
      return format(parseISO(value), "dd MMM HH:mm", { locale: es });
    } catch {
      return value;
    }
  };

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        Sin datos disponibles
      </div>
    );
  }

  return (
    <div style={{ height }} className="overflow-x-auto overflow-y-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
          <defs>
            <linearGradient id={`confidenceBand-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.08} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            tick={{ fontSize: 10, fill: "#64748b" }}
            interval="preserveStartEnd"
            minTickGap={60}
          />

          <YAxis
            domain={yDomain ?? [0, "auto"]}
            tickFormatter={(v) => Number(v).toFixed(2)}
            tick={{ fontSize: 10, fill: "#64748b" }}
            label={{ value: yAxisLabel, angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#94a3b8" } }}
          />

          <RechartsTooltip content={<CustomTooltip />} />

          {/* Confidence band - upper bound area (solo relleno visual, no es una serie propia) */}
          <Area
            type="monotone"
            dataKey="limite_superior"
            stroke="none"
            fill={`url(#confidenceBand-${title})`}
            fillOpacity={1}
            connectNulls={false}
            isAnimationActive={false}
            legendType="none"
          />

          {/* Confidence band - lower bound (clips the area; tampoco es una serie propia) */}
          <Area
            type="monotone"
            dataKey="limite_inferior"
            stroke="none"
            fill="#ffffff"
            fillOpacity={1}
            connectNulls={false}
            isAnimationActive={false}
            legendType="none"
          />

          {/* Lower bound line — esta es la única que representa "Límite Inferior" en la leyenda */}
          <Line
            type="monotone"
            dataKey="limite_inferior"
            name="limite_inferior"
            stroke="#f59e0b"
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* Upper bound line — esta es la única que representa "Límite Superior" en la leyenda */}
          <Line
            type="monotone"
            dataKey="limite_superior"
            name="limite_superior"
            stroke="#f59e0b"
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* Historical data line */}
          <Line
            type="monotone"
            dataKey="historico"
            stroke="#475569"
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            name="Histórico"
          />

          {/* Prediction line (bold red) */}
          <Line
            type="monotone"
            dataKey="prediccion"
            stroke={accentColor}
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            name="Mejor Estimación (Promedio)"
          />

          {/* Vertical dashed line at boundary */}
          {boundaryDate && (
            <ReferenceLine
              x={boundaryDate}
              stroke="#3b82f6"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{ value: "Hoy", position: "top", fill: "#3b82f6", fontSize: 11 }}
            />
          )}

          {/* Sigma reference lines */}
          {sigmaLines.map((line) => (
            <ReferenceLine
              key={line.key}
              y={line.value}
              stroke={line.color}
              strokeDasharray={line.dash}
              strokeWidth={line.width}
              label={{
                value: `${line.label} (${line.value.toFixed(2)})`,
                position: "right",
                fill: line.color,
                fontSize: 9,
              }}
            />
          ))}

          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => {
              // Mismos nombres que usa el Tooltip para esta gráfica, así no hay
              // dos términos distintos ("Zona de Riesgo" vs "Límite") para lo mismo.
              const labels: Record<string, string> = {
                historico: "Histórico",
                prediccion: "Mejor Estimación (Promedio)",
                limite_superior: "Límite Superior (95%)",
                limite_inferior: "Límite Inferior (95%)",
              };
              return labels[value] || value;
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

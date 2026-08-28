
import { format, formatISO, parseISO, addDays, isSameDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

export type Machine = { id: string; name: string };
export type MachineId = string;
export type Component = { id: string; name: string; originalName: string };

export type ChartDataPoint = {
  date: string; // "YYYY-MM-DD HH:mm"
  isProjection: boolean;
  componentId: string;
  
  "Corriente Promedio Suavizado"?: number | null;
  "Referencia Corriente Promedio Suavizado"?: number | null;
  "Corriente Máxima"?: number | null;
  
  "Desbalance Suavizado"?: number | null;
  "Referencia Desbalance Suavizado"?: number | null;
  "Umbral Desbalance"?: number | null;
  
  "Factor De Carga Suavizado"?: number | null;
  "Referencia Factor De Carga Suavizado"?: number | null;
  "Umbral Factor Carga"?: number | null;

  "proyeccion_corriente_tendencia"?: number | null;
  "proyeccion_corriente_pesimista"?: number | null;
  "proyeccion_corriente_optimista"?: number | null;
  
  "proyeccion_referencia_corriente_tendencia"?: number | null;
  
  "proyeccion_desbalance_tendencia"?: number | null;
  "proyeccion_desbalance_pesimista"?: number | null;
  "proyeccion_desbalance_optimista"?: number | null;

  "proyeccion_factor_carga_tendencia"?: number | null;
  "proyeccion_factor_carga_pesimista"?: number | null;
  "proyeccion_factor_carga_optimista"?: number | null;

  "Sigma1_Sup"?: number | null;
  "Sigma1_Inf"?: number | null;
  "Sigma2_Sup"?: number | null;
  "Sigma2_Inf"?: number | null;
  "Desv_PromedioSuavizado"?: number | null;

  [key: string]: any; 
};

// Raw record from the API before aggregation
export type RawDataRecord = {
    date: string;
    isProjection: boolean;
    componentId: string;
    
    'Corriente Promedio Suavizado'?: number | null;
    'Referencia Corriente Promedio Suavizado'?: number | null;
    'Corriente Máxima'?: number | null;
    
    'Desbalance Suavizado'?: number | null;
    'Referencia Desbalance Suavizado'?: number | null;
    'Umbral Desbalance'?: number | null;
    
    'Factor De Carga Suavizado'?: number | null;
    'Referencia Factor De Carga Suavizado'?: number | null;
    'Umbral Factor Carga'?: number | null;
  };

// --- RED DE SEGURIDAD: VALORES MANUALES ---
function getManualCurrentLimit(componentName: string, machineId: string): number | null {
    const name = componentName.toLowerCase();
    
    // T8
    if (name.includes('cuchilla t8')) return 5.50;
    if (name.includes('traslacion t8')) return 3.35;

    // LOOPER
    if (name.includes('banda looper')) return 14.60;
    if (name.includes('cuchilla looper')) return 8.20;

    // LAADER / LOADER
    if (name.includes('laader') || name.includes('loader')) return 51.70;

    // Contexto Maquinas
    const isPuente = machineId.toLowerCase().includes('puente') || name.includes('puente');
    const isMesa = machineId.toLowerCase().includes('mesa') || name.includes('mesa');

    if (name.includes('elevacion derecha')) {
        if (isPuente) return 14.00;
        return 26.50; 
    }
    
    if (name.includes('elevacion izquierdo') || name.includes('elevacion izquierda')) {
        return 14.00; 
    }

    if (name.includes('traslacion der/izq') || name.includes('traslacion')) {
        if (isPuente) return 5.00;
        if (isMesa) return 3.25;
    }
    
    if (name.includes('motor elevacion') && isMesa) return 26.50;

    return null;
}

/**
 * Función auxiliar para obtener la desviación estándar.
 */
async function getStandardDeviation(
  calculosService: any,
  params: {
    Maquina: string;
    Componente: string;
    FechaInicio: string;
    FechaFin: string;
  }
): Promise<number> {
  try {
    const response = await calculosService.getDeviationsByMachineAndComponents(params);
    if (response?.data?.[0]?.Desv_PromedioSuavizado !== undefined) {
      const val = Number(response.data[0].Desv_PromedioSuavizado);
      return isNaN(val) ? 0 : val;
    }
  } catch (error) {
    console.error("Error fetching standard deviation:", error);
  }
  return 0;
}

export function aggregateDataByDateTime(rawData: RawDataRecord[]): ChartDataPoint[] {
    if (!rawData || rawData.length === 0) {
        return [];
    }

    const groupedByHour = rawData.reduce((acc, record) => {
        if (!record.date) return acc;
        const hourKey = format(parseISO(record.date), 'yyyy-MM-dd HH');
        if (!acc[hourKey]) {
            acc[hourKey] = { records: [], componentId: record.componentId };
        }
        acc[hourKey].records.push(record);
        return acc;
    }, {} as Record<string, { records: RawDataRecord[], componentId: string }>);

    const safeNumber = (value: any): number | null => {
        const num = Number(value);
        return isNaN(num) || value === null ? null : num;
    };
    
    const aggregatedResult = Object.entries(groupedByHour).map(([hourKey, group]) => {
        const hourMetrics = {
            current: { sum: 0, count: 0 },
            refCurrent: { sum: 0, count: 0 },
            unbalance: { sum: 0, count: 0 },
            refUnbalance: { sum: 0, count: 0 },
            load_factor: { sum: 0, count: 0 },
            refLoadFactor: { sum: 0, count: 0 },
        };
        
        const findFirstValidLimit = (key: keyof RawDataRecord, fallbackKey?: keyof RawDataRecord): number | null => {
            for (const record of group.records) {
                let value = safeNumber(record[key]);
                if (typeof value === 'number' && !isNaN(value) && value > 0) {
                    return value;
                }
                if (fallbackKey) {
                    value = safeNumber(record[fallbackKey]);
                    if (typeof value === 'number' && !isNaN(value) && value > 0) {
                        return value;
                    }
                }
            }
            return null;
        };

        const currentLimit = findFirstValidLimit("Corriente Máxima");
        const unbalanceLimit = findFirstValidLimit("Umbral Desbalance", "Referencia_Umbral_Desbalance");
        const loadFactorLimit = findFirstValidLimit("Umbral Factor Carga", "Referencia_Umbral_FactorCarga");

        for (const record of group.records) {
            const current = safeNumber(record["Corriente Promedio Suavizado"]);
            if (current !== null) { hourMetrics.current.sum += current; hourMetrics.current.count++; }
            const refCurrent = safeNumber(record["Referencia Corriente Promedio Suavizado"]);
            if (refCurrent !== null) { hourMetrics.refCurrent.sum += refCurrent; hourMetrics.refCurrent.count++; }
            const unbalance = safeNumber(record["Desbalance Suavizado"]);
            if (unbalance !== null) { hourMetrics.unbalance.sum += unbalance; hourMetrics.unbalance.count++; }
            const refUnbalance = safeNumber(record["Referencia Desbalance Suavizado"]);
            if (refUnbalance !== null) { hourMetrics.refUnbalance.sum += refUnbalance; hourMetrics.refUnbalance.count++; }
            const loadFactor = safeNumber(record["Factor De Carga Suavizado"]);
            if (loadFactor !== null) { hourMetrics.load_factor.sum += loadFactor; hourMetrics.load_factor.count++; }
            const refLoadFactor = safeNumber(record["Referencia Factor De Carga Suavizado"]);
            if (refLoadFactor !== null) { hourMetrics.refLoadFactor.sum += refLoadFactor; hourMetrics.refLoadFactor.count++; }
        }
        
        const newPoint: ChartDataPoint = {
            date: format(parseISO(hourKey), "yyyy-MM-dd'T'HH:mm:ss"), 
            componentId: group.componentId,
            isProjection: false,
            "Corriente Promedio Suavizado": hourMetrics.current.count > 0 ? hourMetrics.current.sum / hourMetrics.current.count : null,
            "Referencia Corriente Promedio Suavizado": hourMetrics.refCurrent.count > 0 ? hourMetrics.refCurrent.sum / hourMetrics.refCurrent.count : null,
            "Corriente Máxima": currentLimit,
            "Desbalance Suavizado": hourMetrics.unbalance.count > 0 ? hourMetrics.unbalance.sum / hourMetrics.unbalance.count : null,
            "Referencia Desbalance Suavizado": hourMetrics.refUnbalance.count > 0 ? hourMetrics.refUnbalance.sum / hourMetrics.refUnbalance.count : null,
            "Umbral Desbalance": unbalanceLimit,
            "Factor De Carga Suavizado": hourMetrics.load_factor.count > 0 ? hourMetrics.load_factor.sum / hourMetrics.load_factor.count : null,
            "Referencia Factor De Carga Suavizado": hourMetrics.refLoadFactor.count > 0 ? hourMetrics.refLoadFactor.sum / hourMetrics.refLoadFactor.count : null,
            "Umbral Factor Carga": loadFactorLimit,
            "Desv_PromedioSuavizado": null
        };
        return newPoint;
    });

    return aggregatedResult.sort((a, b) => a.date.localeCompare(b.date));
}
  
export function calculateLinearRegressionAndProject(
  data: ChartDataPoint[],
  valueKey: keyof ChartDataPoint,
  daysToProject: number = 90
): { [key: string]: (number | null)[] } {
    const cleanData = data.map((p, i) => ({
      x: i,
      y: p[valueKey] as number,
    })).filter(p => p.y !== null && !isNaN(p.y) && p.y > 0);

    if (cleanData.length < 5) {
      return { trend: [], pessimistic: [], optimistic: [] };
    }

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = cleanData.length;

    for (const point of cleanData) {
      sumX += point.x;
      sumY += point.y;
      sumXY += point.x * point.y;
      sumXX += point.x * point.x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    if (isNaN(slope) || isNaN(intercept)) {
      return { trend: [], pessimistic: [], optimistic: [] };
    }
    
    const residuals = cleanData.map(p => p.y - (slope * p.x + intercept));
    const meanResidual = residuals.reduce((sum, r) => sum + r, 0) / residuals.length;
    const squaredErrors = residuals.map(r => (r - meanResidual) ** 2);
    const variance = squaredErrors.reduce((sum, e) => sum + e, 0) / (squaredErrors.length > 1 ? squaredErrors.length - 1 : 1);
    const stdDev = Math.sqrt(variance);
    const noiseFactor = stdDev / 2;

    const lastPointX = cleanData[n - 1].x;
    const trend: (number | null)[] = [];
    const pessimistic: (number | null)[] = [];
    const optimistic: (number | null)[] = [];
    
    const pessimisticFactor = 1.5; 
    const optimisticFactor = 0.5;

    for (let i = 1; i <= daysToProject; i++) {
        const x = lastPointX + i;
        
        const noise = (Math.random() - 0.5) * 2 * noiseFactor;
        const nonNegativeSlope = Math.max(0, slope);

        const trendValue = nonNegativeSlope * x + intercept + noise;
        const pessimisticValue = (nonNegativeSlope * pessimisticFactor) * x + intercept + noise;
        const optimisticValue = (nonNegativeSlope * optimisticFactor) * x + intercept + noise;

        trend.push(trendValue > 0 ? trendValue : 0);
        pessimistic.push(pessimisticValue > 0 ? pessimisticValue : 0);
        optimistic.push(optimisticValue > 0 ? optimisticValue : 0);
    }

    return { trend, pessimistic, optimistic };
}

const recordToDataPoint = (component: Component, aggregation: 'daily' | 'monthly' = 'daily') => (record: any): RawDataRecord | null => {
    const safeNumber = (value: any): number | null => {
        const num = Number(value);
        return isNaN(num) || value === null ? null : num;
    };
    const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

    const year = safeNumber(record.Año);
    const month = safeNumber(record.MES_REFERENCIA) ?? safeNumber(record.Mes);
    const day = safeNumber(record.Dia);

    if (!isValidNumber(year) || !isValidNumber(month) || !isValidNumber(day)) {
        return null;
    }

    let fechaDate: Date;
    if (aggregation === 'monthly') {
        fechaDate = new Date(year, month - 1, 15);
    } else {
        const hour = safeNumber(record.Hora) || 0;
        const minute = safeNumber(record.Minuto) || 0;
        const second = safeNumber(record.Segundo) || 0;
        fechaDate = new Date(year, month - 1, day, hour, minute, second);
    }

    if (isNaN(fechaDate.getTime())) {
        return null;
    }

    const umbralDesbalance = safeNumber(record.Umbral_Desbalance) ?? safeNumber(record.Referencia_Umbral_Desbalance);
    const umbralFactorCarga = safeNumber(record.Umbral_Factor_Carga) ?? safeNumber(record.Referencia_Umbral_FactorCarga);
  
    return {
        date: formatISO(fechaDate),
        isProjection: false,
        componentId: component.id,
        'Corriente Promedio Suavizado': safeNumber(record.CorrientePromedioSuavizado),
        'Referencia Corriente Promedio Suavizado': safeNumber(record.Referencia_CorrientePromedioSuavizado),
        'Corriente Máxima': safeNumber(record.Corriente_Max),
        'Desbalance Suavizado': safeNumber(record.DesbalanceSuavizado),
        'Referencia Desbalance Suavizado': safeNumber(record.Referencia_DesbalanceSuavizado),
        'Umbral Desbalance': umbralDesbalance,
        'Factor De Carga Suavizado': safeNumber(record.FactorDeCargaSuavizado),
        'Referencia Factor De Carga Suavizado': safeNumber(record.Referencia_FactorDeCargaSuavizado),
        'Umbral Factor Carga': umbralFactorCarga,
    };
};

export async function useRealMaintenanceData(
    machineId: MachineId,
    component: Component,
    dateRange: DateRange | undefined,
    calculosService: any,
    daysToProject: number = 90,
    onProgressUpdate?: (data: RawDataRecord[], progress: number) => void
  ): Promise<{ data: ChartDataPoint[], aggregationLevel: 'hour' | 'month' }> {
    
    if (!dateRange || !dateRange.from || !dateRange.to) {
      return { data: [], aggregationLevel: 'hour' };
    }

    const toDate = isSameDay(dateRange.to, new Date()) ? new Date() : endOfDay(dateRange.to);
    const fromDate = dateRange.from;
  
    const startDate = format(fromDate, 'yyyy-MM-dd HH:mm:ss');
    const endDate = format(toDate, 'yyyy-MM-dd HH:mm:ss');

    // Se decidió (con el analista de TI) no usar un endpoint de agregación
    // mensual del lado del backend: en vez de eso, para rangos largos se
    // sigue trayendo la data paginada de siempre, pero renderizando el
    // gráfico progresivamente a medida que llegan las páginas (ver el
    // callback `onProgressUpdate` más abajo).
    const aggregationLevel: 'hour' | 'month' = 'hour';

    let allData: RawDataRecord[] = [];

    try {
      const { total } = await calculosService.getTotalByMaquinaAndComponente(machineId, component.originalName, startDate, endDate);
      const limit = 1000;
      const totalPages = Math.ceil(total / limit);

      for (let page = 1; page <= totalPages; page++) {
        const response = await calculosService.getDataByMachineComponentAndDates({
          maquina: machineId,
          componente: component.originalName,
          fecha_inicio: startDate,
          fecha_fin: endDate,
          page,
          limit,
        });
        const parsedData = response.data?.map(recordToDataPoint(component, 'daily')).filter(Boolean) as RawDataRecord[] || [];
        allData.push(...parsedData);
        onProgressUpdate?.(allData, (page / totalPages) * 100);
      }
    } catch (error) {
        console.error("Error fetching data from API:", error);
        throw error;
    }

    const sigma = await getStandardDeviation(calculosService, {
      Maquina: machineId,
      Componente: component.originalName,
      FechaInicio: startDate,
      FechaFin: endDate,
    });

    // Siempre 'hour': ver nota más arriba sobre el endpoint de agregación mensual.
    const aggregatedData = aggregateDataByDateTime(allData);

    aggregatedData.forEach(point => {
        point['Desv_PromedioSuavizado'] = Number(sigma) || 0;
        const baseValue = point['Corriente Promedio Suavizado'];

        if (typeof baseValue === 'number' && sigma > 0) {
            point['Sigma1_Sup'] = baseValue + (1 * sigma);
            point['Sigma1_Inf'] = baseValue - (1 * sigma);
            point['Sigma2_Sup'] = baseValue + (2 * sigma);
            point['Sigma2_Inf'] = baseValue - (2 * sigma);
        }

        if (point['Corriente Máxima'] === null) {
            point['Corriente Máxima'] = getManualCurrentLimit(component.name, machineId);
        }
    });
  
    if (aggregatedData.length > 0) {
        const lastDate = parseISO(aggregatedData[aggregatedData.length - 1].date);
        const lastRealPoint = aggregatedData[aggregatedData.length-1];
        
        const projectionKeys = {
            current: { value: 'Corriente Promedio Suavizado', trend: 'proyeccion_corriente_tendencia', pessimistic: 'proyeccion_corriente_pesimista', optimistic: 'proyeccion_corriente_optimista' },
            unbalance: { value: 'Desbalance Suavizado', trend: 'proyeccion_desbalance_tendencia', pessimistic: 'proyeccion_desbalance_pesimista', optimistic: 'proyeccion_desbalance_optimista' },
            load_factor: { value: 'Factor De Carga Suavizado', trend: 'proyeccion_factor_carga_tendencia', pessimistic: 'proyeccion_factor_carga_pesimista', optimistic: 'proyeccion_factor_carga_optimista' },
        };
  
        const projections: { [key: string]: { [key: string]: (number | null)[] } } = {};
        Object.keys(projectionKeys).forEach(key => {
            const config = projectionKeys[key as keyof typeof projectionKeys];
            projections[key] = calculateLinearRegressionAndProject(aggregatedData, config.value as keyof ChartDataPoint, daysToProject);
        });
  
        for (let i = 0; i < daysToProject; i++) {
          const nextDate = addDays(lastDate, i + 1);
          const projectionPoint: ChartDataPoint = {
            date: format(nextDate, 'yyyy-MM-dd'),
            isProjection: true,
            componentId: component.id,
          };
  
          Object.keys(projectionKeys).forEach(key => {
              const config = projectionKeys[key as keyof typeof projectionKeys];
              if (projections[key].trend) projectionPoint[config.trend as keyof ChartDataPoint] = projections[key].trend[i];
              if (config.pessimistic && projections[key].pessimistic) projectionPoint[config.pessimistic as keyof ChartDataPoint] = projections[key].pessimistic[i];
              if (config.optimistic && projections[key].optimistic) projectionPoint[config.optimistic as keyof ChartDataPoint] = projections[key].optimistic[i];
          });
  
          projectionPoint['Corriente Máxima'] = lastRealPoint['Corriente Máxima'];
          projectionPoint['Umbral Desbalance'] = lastRealPoint['Umbral Desbalance'];
          projectionPoint['Umbral Factor Carga'] = lastRealPoint['Umbral Factor Carga'];

          projectionPoint['Referencia Corriente Promedio Suavizado'] = lastRealPoint['Referencia Corriente Promedio Suavizado'];
          projectionPoint['Referencia Desbalance Suavizado'] = lastRealPoint['Referencia Desbalance Suavizado'];
          projectionPoint['Referencia Factor De Carga Suavizado'] = lastRealPoint['Referencia Factor De Carga Suavizado'];
          
          projectionPoint['Desv_PromedioSuavizado'] = sigma;
          const projectedBaseValue = projectionPoint['proyeccion_corriente_tendencia'];

          if (typeof projectedBaseValue === 'number' && sigma > 0) {
            projectionPoint['Sigma1_Sup'] = projectedBaseValue + (1 * sigma);
            projectionPoint['Sigma1_Inf'] = projectedBaseValue - (1 * sigma);
            projectionPoint['Sigma2_Sup'] = projectedBaseValue + (2 * sigma);
            projectionPoint['Sigma2_Inf'] = projectedBaseValue - (2 * sigma);
          }

          aggregatedData.push(projectionPoint);
        }
    }
  
    return { data: aggregatedData, aggregationLevel };
  }

export function calculateEMA(values: number[], alpha: number = 0.3): number[] {
  if (values.length === 0) return [];
  
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(alpha * values[i] + (1 - alpha) * ema[i - 1]);
  }
  return ema;
}

    
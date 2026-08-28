"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from 'date-fns/locale';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { calculosCorrientesDatosMantenimientoService } from "@/services/calculoscorrientesdatosmantenimiento.service";

export default function EventFlowModal({ open, onClose, entry, mode, machineName, componenteName }: { open: boolean; onClose: () => void; entry: any; mode?: 'flow' | 'trace'; machineName?: string; componenteName?: string }) {
  const { toast } = useToast();
  const [rawStart, setRawStart] = useState<string | null>(null);
  const [rawEnd, setRawEnd] = useState<string | null>(null);
  const [rawCenterHour, setRawCenterHour] = useState<Date | null>(null);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawTotal, setRawTotal] = useState<number | null>(null);
  const [rawEventsData, setRawEventsData] = useState<any[]>([]);
  const [noInterval, setNoInterval] = useState(false);

  useEffect(() => {
    if (!entry) return;
    // parse params and try to obtain fecha_punto
    let paramsObj: any = {};
    try { paramsObj = typeof entry?.params === 'string' ? JSON.parse(entry.params) : (entry?.params || {}); } catch { paramsObj = entry?.params || {}; }

    const fechaPuntoRaw = paramsObj?.fecha_punto || paramsObj?.fecha_punto_string || null;
    if (fechaPuntoRaw) {
      try {
        // normalize whitespace to T for ISO parsing if needed
        const s = String(fechaPuntoRaw).trim().replace(' ', 'T');
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
          d.setMinutes(0, 0, 0);
          setRawCenterHour(d);
          const toInput = (dt: Date) => format(dt, "yyyy-MM-dd'T'HH:mm");
          setRawStart(toInput(d));
          setRawEnd(toInput(new Date(d.getTime() + 2 * 60 * 60 * 1000)));
          setNoInterval(false);
          return;
        }
      } catch (e) { /* ignore and fallback */ }
    }

    // fallback: use entry fecha if fecha_punto not present
    const evtDate = entry?.fecha_evento || entry?.fecha || entry?.date || null;
    if (evtDate) {
      try {
        const d = new Date(evtDate);
        d.setMinutes(0, 0, 0);
        setRawCenterHour(d);
        const toInput = (dt: Date) => format(dt, "yyyy-MM-dd'T'HH:mm");
        setRawStart(toInput(d));
        setRawEnd(toInput(new Date(d.getTime() + 2 * 60 * 60 * 1000)));
        setNoInterval(false);
        return;
      } catch (e) { /* ignore */ }
    }

    // If we reach here, no usable date found -> show warning and hide interval
    setRawCenterHour(null);
    setRawStart(null);
    setRawEnd(null);
    setNoInterval(true);
    try { toast({ title: 'Fecha no encontrada', description: 'No se encontró fecha_punto en params; no se mostrará intervalo de registros', variant: 'warning' }); } catch (e) { }
  }, [entry, toast]);

  // auto-trigger fetch if opened in trace mode
  useEffect(() => {
    if (mode === 'trace' && open && !noInterval) {
      (async () => {
        // small delay to allow inputs to mount
        await new Promise(r => setTimeout(r, 50));
        handleFetchRaw();
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, open, noInterval]);

  const handleFetchRaw = async () => {
    if (!entry) return;
    if (!rawStart || !rawEnd) { toast({ title: 'Rango incompleto', description: 'Seleccione inicio y fin', variant: 'destructive' }); return; }
    try {
      // Determine center date: prefer params.fecha_punto if present, otherwise fall back to event date fields
      let paramsObjLocal: any = {};
      try { paramsObjLocal = typeof entry?.params === 'string' ? JSON.parse(entry.params) : (entry?.params || {}); } catch { paramsObjLocal = entry?.params || {}; }
      const fechaPuntoRaw = paramsObjLocal?.fecha_punto || paramsObjLocal?.fecha_punto_string || null;
      const centerRaw = fechaPuntoRaw ?? entry?.fecha_evento ?? entry?.fecha ?? entry?.date ?? new Date();
      // normalize possible space-separated datetime to ISO-like string for Date parsing
      const normalize = (s: any) => { try { return String(s).trim().replace(' ', 'T'); } catch { return s; } };
      const centerDate = new Date(normalize(centerRaw));
      const start = new Date(rawStart);
      const end = new Date(rawEnd);
      const minAllowed = new Date(centerDate.getTime() - 2 * 60 * 60 * 1000);
      const maxAllowed = new Date(centerDate.getTime() + 2 * 60 * 60 * 1000);
      // Require the selected interval to contain the center point and be within ±2 hours
      if (start < minAllowed || start > centerDate || end < centerDate || end > maxAllowed || start >= end) {
        toast({ title: 'Rango inválido', description: 'El rango debe estar dentro de ±2 horas alrededor del punto central y start < end', variant: 'destructive' });
        return;
      }
      setRawLoading(true);

      // Prefer values passed from parent (names from comboboxes). Fall back to entry fields.
      const resolvedComponente = componenteName && String(componenteName).trim() !== '' ? String(componenteName) : (entry?.Componente || entry?.componente || entry?.codigo_componente || '');
      const resolvedMaquina = machineName && String(machineName).trim() !== '' ? String(machineName) : (entry?.Maquina || entry?.maquina || '');

      const paramsTotal = {
        Maquina: resolvedMaquina,
        Componente: resolvedComponente,
        FechaInicio: format(start, "yyyy-MM-dd HH:mm:ss"),
        FechaFin: format(end, "yyyy-MM-dd HH:mm:ss"),
      } as any;

      const totalResp = await calculosCorrientesDatosMantenimientoService.getTotalDataCrudaPorFechaComponenteEquipo(paramsTotal);
      const total = Array.isArray((totalResp as any).data) && (totalResp as any).data[0] && (totalResp as any).data[0].Total ? Number((totalResp as any).data[0].Total) : Number((totalResp as any).total || 0);
      setRawTotal(total);
      const perPage = 500;
      const pages = Math.max(1, Math.ceil((total || 0) / perPage));
      const acc: any[] = [];
      for (let page = 1; page <= pages; page++) {
        const resp = await calculosCorrientesDatosMantenimientoService.getTodosRegistrosDataCruda({ Maquina: paramsTotal.Maquina, Componente: paramsTotal.Componente, FechaInicio: paramsTotal.FechaInicio, FechaFin: paramsTotal.FechaFin, page, limit: perPage });
        const pageData = Array.isArray((resp as any).data) ? (resp as any).data : [];
        acc.push(...pageData);
      }
      setRawEventsData(acc);
    } catch (err) {
      console.error('Error cargando eventos sin suavizado', err);
      toast({ title: 'Error', description: 'No se pudo recuperar eventos crudos', variant: 'destructive' });
    } finally {
      setRawLoading(false);
    }
  };

  const plottedRaw = useMemo(() => {
    try {
      const arr = (rawEventsData || []).map((r: any) => {
        const dateVal = r.FECHA ?? r.Fecha ?? r.fecha ?? r.date ?? r.DATE ?? r.FECHA;
        let dateStr = '';
        try { dateStr = new Date(dateVal).toISOString(); } catch { dateStr = String(dateVal || ''); }
        const toNumber = (v: any) => {
          const n = Number(v);
          return Number.isFinite(n) ? n : NaN;
        };
        const l1 = toNumber(r.CORRIENTE_L1 ?? r.CORRIENTE_LA ?? r.corriente_l1 ?? r.L1 ?? r.l1 ?? null);
        const l2 = toNumber(r.CORRIENTE_L2 ?? r.CORRIENTE_LB ?? r.corriente_l2 ?? r.L2 ?? r.l2 ?? null);
        const l3 = toNumber(r.CORRIENTE_L3 ?? r.CORRIENTE_LC ?? r.corriente_l3 ?? r.L3 ?? r.l3 ?? null);
        const values = [l1, l2, l3].filter(v => !isNaN(v));
        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
        return {
          date: dateStr,
          L1: isNaN(l1) ? null : l1,
          L2: isNaN(l2) ? null : l2,
          L3: isNaN(l3) ? null : l3,
          avg: isNaN(avg) ? null : Number(avg.toFixed(6)),
        };
      });
      return arr.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (e) {
      return [];
    }
  }, [rawEventsData]);

  if (!open) return null;

  let paramsObj = {};
  try { paramsObj = typeof entry?.params === 'string' ? JSON.parse(entry.params) : (entry?.params || {}); } catch { paramsObj = entry?.params || {}; }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl p-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Flujo de Registros</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs text-slate-500">Fecha</div>
            <div className="font-medium">{entry?.fecha_evento ? String(new Date(entry.fecha_evento)) : (entry?.fecha ? String(new Date(entry.fecha)) : '—')}</div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Categoría</div>
            <div className="font-medium">{entry?.codigo_categoria_evento ?? entry?.categoria ?? '—'}</div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Descripción</div>
            <div className="font-medium">{entry?.descripcion ?? entry?.descripcion_evento ?? '—'}</div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Parámetros</div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(paramsObj || {}).length === 0 ? (
                <div className="text-sm text-slate-500">No hay parámetros</div>
              ) : (
                Object.entries(paramsObj).map(([k, v]) => (
                  <div key={k} className="bg-gray-50 border rounded p-2 text-sm">
                    <div className="text-xs text-slate-500">{k}</div>
                    <div className="font-medium">{typeof v === 'number' ? v.toFixed ? v.toFixed(3) : String(v) : String(v)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Raw data controls and chart */}
          <div className="pt-4 border-t">
            {noInterval ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                <strong>Advertencia:</strong> No se encontró una fecha asociada al punto (params.fecha_punto). No se mostrará un intervalo de registros.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-slate-500">Fecha inicio (máx -2h)</label>
                    <input
                      type="datetime-local"
                      className="w-full border rounded px-2 py-1 text-xs"
                      value={rawStart ?? ''}
                      onChange={(e) => setRawStart(e.target.value)}
                      max={entry?.fecha_evento ? format(new Date(entry.fecha_evento), "yyyy-MM-dd'T'HH:mm") : undefined}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Fecha fin (máx +2h)</label>
                    <input
                      type="datetime-local"
                      className="w-full border rounded px-2 py-1 text-xs"
                      value={rawEnd ?? ''}
                      onChange={(e) => setRawEnd(e.target.value)}
                      min={entry?.fecha_evento ? format(new Date(entry.fecha_evento), "yyyy-MM-dd'T'HH:mm") : undefined}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Button size="sm" onClick={handleFetchRaw}>Buscar</Button>
                  <Button size="sm" variant="outline" onClick={() => { setRawEventsData([]); setRawTotal(null); }}>Limpiar</Button>
                  <div className="ml-auto text-xs text-slate-500">{rawLoading ? 'Cargando...' : (rawTotal !== null ? `Total: ${rawTotal}` : '')}</div>
                </div>

                <div className="h-64">
                  {!rawLoading && rawEventsData.length === 0 && <div className="text-sm text-slate-500">No hay datos cargados.</div>}
                  {!rawLoading && rawEventsData.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={plottedRaw} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={(v) => { try { return format(parseISO(String(v)), 'dd MMM HH:mm', { locale: es }); } catch { return String(v); } }} />
                        <YAxis />
                        <RechartsTooltip formatter={(value: any) => (value === null || value === undefined) ? ['-', ''] : [`${Number(value).toFixed(3)} A`, ''] } labelFormatter={(label) => { try { return format(parseISO(String(label)), 'dd MMM yyyy HH:mm:ss', { locale: es }); } catch { return String(label); } }} />
                        <Legend />
                        <Line type="monotone" dataKey="L1" name="Corriente L1" stroke="#9CA3AF" strokeWidth={1.5} dot={false} connectNulls={false} />
                        <Line type="monotone" dataKey="L2" name="Corriente L2" stroke="#B7C0C7" strokeWidth={1.5} dot={false} connectNulls={false} />
                        <Line type="monotone" dataKey="L3" name="Corriente L3" stroke="#D1D5DB" strokeWidth={1.5} dot={false} connectNulls={false} />
                        <Line type="monotone" dataKey="avg" name="Promedio (L1,L2,L3)" stroke="#0055b8" strokeWidth={2.5} dot={false} connectNulls={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

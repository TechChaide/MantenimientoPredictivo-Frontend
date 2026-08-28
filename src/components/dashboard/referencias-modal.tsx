"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, CalendarRange } from "lucide-react";
import { referenciaService } from "@/services/referencia.service";
import type { Referencia } from "@/types/interfaces";

const formatFechaCorta = (value: unknown): string => {
  if (!value) return '—';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  componenteId: string;
  componenteNombre?: string;
}

export default function ReferenciasModal({ isOpen, onClose, componenteId, componenteNombre }: Props) {
  const [items, setItems] = useState<Referencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"new" | "edit">("new");
  const [form, setForm] = useState<Partial<Referencia>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const resp = await referenciaService.getAll();
      const data = Array.isArray(resp.data) ? resp.data : [];
      setItems(data.filter(r => String(r.codigo_componente) === String(componenteId)));
    } catch (e: any) {
      setError(e?.message || "Error cargando referencias");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (isOpen) {
      load();
      startNew();
    } else {
      setItems([]);
      setFormMode("new");
      setForm({});
      setError(null);
    }
  }, [isOpen, componenteId]);

  const startNew = () => {
    setFormMode("new");
    setForm({ codigo_referencia: "0", codigo_componente: componenteId, fecha_inicio_referencia: "", fecha_fin_referencia: "", estado: "A" });
  };

  const startEdit = (r: Referencia) => {
    setFormMode("edit");
    setForm({ ...r });
  };

  const onChange = (field: keyof Referencia, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const canSave = () => !!form.codigo_componente && !!form.fecha_inicio_referencia && !!form.fecha_fin_referencia && !!form.estado;

  const duracionDias = (() => {
    if (!form.fecha_inicio_referencia || !form.fecha_fin_referencia) return null;
    const inicio = new Date(form.fecha_inicio_referencia as string);
    const fin = new Date(form.fecha_fin_referencia as string);
    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return null;
    const dias = Math.round((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    return dias;
  })();

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSave()) return;
    setSaving(true); setError(null);
    try {
      const payload: Referencia = {
        codigo_referencia: formMode === "edit" ? String(form.codigo_referencia ?? "") : "0",
        codigo_componente: String(form.codigo_componente ?? componenteId),
        fecha_inicio_referencia: form.fecha_inicio_referencia as any,
        fecha_fin_referencia: form.fecha_fin_referencia as any,
        estado: (form.estado || "A").toString(),
      };
      const resp = await referenciaService.save(payload);
      toast({ title: "Referencia guardada", variant: "success" });
      await load();
      setFormMode("new");
      setForm({});
    } catch (e: any) {
      setError(e?.message || "Error guardando referencia");
      toast({ title: "Error al guardar", description: e?.message || "Fallo desconocido", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar referencia?")) return;
    setDeletingId(id);
    try {
      await referenciaService.delete(id);
      toast({ title: "Referencia eliminada", variant: "success" });
      await load();
    } catch (e: any) {
      setError(e?.message || "Error eliminando referencia");
      toast({ title: "Error al eliminar", description: e?.message || "Fallo desconocido", variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-none w-[95vw] sm:w-[80vw]">
        <DialogHeader>
          <DialogTitle>Referencias - {String(componenteNombre ?? componenteId)}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 pt-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/2">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Listado</h4>
                <div>
                  <Button size="sm" onClick={startNew} className="bg-blue-500 text-white">Nuevo</Button>
                </div>
              </div>
              <div className="overflow-y-auto max-h-64 border rounded bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="text-left px-3 py-2">Código</th>
                      <th className="text-left px-3 py-2">Inicio</th>
                      <th className="text-left px-3 py-2">Fin</th>
                      <th className="px-3 py-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500">Cargando...</td></tr>}
                    {!loading && items.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">Sin referencias</td></tr>}
                    {!loading && items.map(it => (
                      <tr key={it.codigo_referencia} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono">{it.codigo_referencia}</td>
                        <td className="px-3 py-2">{formatFechaCorta(it.fecha_inicio_referencia)}</td>
                        <td className="px-3 py-2">{formatFechaCorta(it.fecha_fin_referencia)}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => startEdit(it)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700" title="Eliminar" onClick={() => handleDelete(it.codigo_referencia)} disabled={deletingId === it.codigo_referencia}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="w-full md:w-1/2">
              <form onSubmit={handleSave} className="bg-white p-4 rounded border space-y-3">
                {formMode === 'edit' && (
                  <div>
                    <Label htmlFor="codigo_referencia">Código</Label>
                    <Input id="codigo_referencia" value={String(form.codigo_referencia ?? "")} disabled className="mt-1" />
                  </div>
                )}

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-blue-700">
                    <CalendarRange className="h-4 w-4" />
                    <span className="text-sm font-semibold">Período de referencia</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="fecha_inicio_referencia" className="text-xs">Inicio *</Label>
                      <Input id="fecha_inicio_referencia" type="date" value={String(form.fecha_inicio_referencia ?? "")} onChange={e => onChange('fecha_inicio_referencia', e.target.value)} required className="mt-1 bg-white" />
                    </div>
                    <div>
                      <Label htmlFor="fecha_fin_referencia" className="text-xs">Fin *</Label>
                      <Input id="fecha_fin_referencia" type="date" value={String(form.fecha_fin_referencia ?? "")} onChange={e => onChange('fecha_fin_referencia', e.target.value)} required className="mt-1 bg-white" />
                    </div>
                  </div>
                  {duracionDias !== null && (
                    <p className="text-xs text-blue-700">
                      {duracionDias >= 0
                        ? `Duración: ${duracionDias} día${duracionDias !== 1 ? 's' : ''}`
                        : 'La fecha de fin debe ser posterior a la de inicio'}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="estado">Estado *</Label>
                  <select id="estado" className="w-full rounded-md border px-3 py-2 text-sm bg-white mt-1" value={String(form.estado ?? 'A')} onChange={e => onChange('estado', e.target.value)}>
                    <option value="A">Activo</option>
                    <option value="I">Inactivo</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className={formMode === 'edit' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} disabled={!canSave() || saving}>{formMode === 'edit' ? 'Actualizar' : 'Guardar'}</Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => { startNew(); }}>Cancelar</Button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Zap, Scale, Gauge, Pencil, Trash2, Info } from "lucide-react";
import { limitesService } from "@/services/limites.service";
import { sanitizeDecimalInput } from "@/lib/utils";
import type { Limites } from "@/types/interfaces";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  componenteId: string;
}

interface PropsWithName extends Props {
  componenteNombre?: string;
}

export default function LimitesModal({ isOpen, onClose, componenteId, componenteNombre }: PropsWithName) {
  const [items, setItems] = useState<Limites[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"new" | "edit">("new");
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const resp = await limitesService.getAll();
      const data = Array.isArray(resp.data) ? resp.data : [];
      setItems(data.filter(r => String(r.codigo_componente) === String(componenteId)));
    } catch (e: any) {
      setError(e?.message || "Error cargando límites");
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
    setForm({ codigo_limite: "0", codigo_componente: componenteId, corriente_limite_sup: "0", corriente_limite_inf: "0", desbalance_limite_sup: "0", desbalance_limite_inf: "0", sigma_limite: "0", factor_carga_limite_sup: "0", factor_carga_limite_inf: "0", estado: "A" });
  };

  const startEdit = (r: Limites) => {
    setFormMode("edit");
    // Store numeric fields as strings while editing so the user can type decimals
    setForm({
      ...r,
      corriente_limite_sup: String((r as any).corriente_limite_sup ?? ""),
      corriente_limite_inf: String((r as any).corriente_limite_inf ?? ""),
      desbalance_limite_sup: String((r as any).desbalance_limite_sup ?? ""),
      desbalance_limite_inf: String((r as any).desbalance_limite_inf ?? ""),
      sigma_limite: String((r as any).sigma_limite ?? ""),
      factor_carga_limite_sup: String((r as any).factor_carga_limite_sup ?? ""),
      factor_carga_limite_inf: String((r as any).factor_carga_limite_inf ?? ""),
    });
  };

  const onChange = (field: keyof Limites, value: any) => setForm((prev: any) => ({ ...prev, [field]: value }));

  const canSave = () =>
    Number.isFinite(Number(form.corriente_limite_sup)) &&
    Number.isFinite(Number(form.corriente_limite_inf)) &&
    Number.isFinite(Number(form.desbalance_limite_sup)) &&
    Number.isFinite(Number(form.desbalance_limite_inf)) &&
    Number.isFinite(Number(form.sigma_limite)) &&
    Number.isFinite(Number(form.factor_carga_limite_sup)) &&
    Number.isFinite(Number(form.factor_carga_limite_inf)) &&
    !!form.estado;

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSave()) return;
    setSaving(true); setError(null);
    try {
      const payload: Limites = {
        codigo_limite: formMode === "edit" ? String(form.codigo_limite ?? "") : "0",
        codigo_componente: String(form.codigo_componente ?? componenteId),
        corriente_limite_sup: Number(form.corriente_limite_sup ?? 0),
        corriente_limite_inf: Number(form.corriente_limite_inf ?? 0),
        desbalance_limite_sup: Number(form.desbalance_limite_sup ?? 0),
        desbalance_limite_inf: Number(form.desbalance_limite_inf ?? 0),
        sigma_limite: Number(form.sigma_limite ?? 0),
        factor_carga_limite_sup: Number(form.factor_carga_limite_sup ?? 0),
        factor_carga_limite_inf: Number(form.factor_carga_limite_inf ?? 0),
        estado: (form.estado || "A").toString(),
      };
      const resp = await limitesService.save(payload);
      toast({ title: "Límite guardado", variant: "success" });
      await load();
      setFormMode("new");
      setForm({});
    } catch (e: any) {
      setError(e?.message || "Error guardando límite");
      toast({ title: "Error al guardar", description: e?.message || "Fallo desconocido", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar límite?")) return;
    setDeletingId(id);
    try {
      await limitesService.delete(id);
      toast({ title: "Límite eliminado", variant: "success" });
      await load();
    } catch (e: any) {
      setError(e?.message || "Error eliminando límite");
      toast({ title: "Error al eliminar", description: e?.message || "Fallo desconocido", variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-none w-[95vw] sm:w-[80vw]">
          <DialogHeader>
            <DialogTitle>Límites - {String(componenteNombre ?? componenteId)}</DialogTitle>
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
                      <th className="text-left px-3 py-2">Corriente (sup/inf)</th>
                      <th className="text-left px-3 py-2">Desbalance (sup/inf)</th>
                      <th className="text-left px-3 py-2">Sigma</th>
                      <th className="px-3 py-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">Cargando...</td></tr>}
                    {!loading && items.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">Sin límites</td></tr>}
                    {!loading && items.map(it => (
                      <tr key={it.codigo_limite} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono">{it.codigo_limite}</td>
                        <td className="px-3 py-2">{String(it.corriente_limite_sup ?? '')}/{String(it.corriente_limite_inf ?? '')}</td>
                        <td className="px-3 py-2">{String(it.desbalance_limite_sup ?? '')}/{String(it.desbalance_limite_inf ?? '')}</td>
                        <td className="px-3 py-2">{String(it.sigma_limite ?? '')}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => startEdit(it)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700" title="Eliminar" onClick={() => handleDelete(it.codigo_limite)} disabled={deletingId === it.codigo_limite}>
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
                    <Label htmlFor="codigo_limite">Código</Label>
                    <Input id="codigo_limite" value={String(form.codigo_limite ?? "")} disabled className="mt-1" />
                  </div>
                )}

                {/* Corriente */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Zap className="h-4 w-4" />
                    <span className="text-sm font-semibold">Corriente</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="corriente_limite_sup" className="text-xs">Superior (A)</Label>
                      <Input id="corriente_limite_sup" type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={String(form.corriente_limite_sup ?? '')} onChange={e => onChange('corriente_limite_sup', sanitizeDecimalInput(e.target.value))} className="mt-1 bg-white" />
                    </div>
                    <div>
                      <Label htmlFor="corriente_limite_inf" className="text-xs">Inferior (A)</Label>
                      <Input id="corriente_limite_inf" type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={String(form.corriente_limite_inf ?? '')} onChange={e => onChange('corriente_limite_inf', sanitizeDecimalInput(e.target.value))} className="mt-1 bg-white" />
                    </div>
                  </div>
                </div>

                {/* Desbalance */}
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-orange-700">
                    <Scale className="h-4 w-4" />
                    <span className="text-sm font-semibold">Desbalance</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="desbalance_limite_sup" className="text-xs">Superior (%)</Label>
                      <Input id="desbalance_limite_sup" type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={String(form.desbalance_limite_sup ?? '')} onChange={e => onChange('desbalance_limite_sup', sanitizeDecimalInput(e.target.value))} className="mt-1 bg-white" />
                    </div>
                    <div>
                      <Label htmlFor="desbalance_limite_inf" className="text-xs">Inferior (%)</Label>
                      <Input id="desbalance_limite_inf" type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={String(form.desbalance_limite_inf ?? '')} onChange={e => onChange('desbalance_limite_inf', sanitizeDecimalInput(e.target.value))} className="mt-1 bg-white" />
                    </div>
                  </div>
                </div>

                {/* Factor de carga */}
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-purple-700">
                    <Gauge className="h-4 w-4" />
                    <span className="text-sm font-semibold">Factor de Carga</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="factor_carga_limite_sup" className="text-xs">Superior (%)</Label>
                      <Input id="factor_carga_limite_sup" type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={String(form.factor_carga_limite_sup ?? '')} onChange={e => onChange('factor_carga_limite_sup', sanitizeDecimalInput(e.target.value))} className="mt-1 bg-white" />
                    </div>
                    <div>
                      <Label htmlFor="factor_carga_limite_inf" className="text-xs">Inferior (%)</Label>
                      <Input id="factor_carga_limite_inf" type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={String(form.factor_carga_limite_inf ?? '')} onChange={e => onChange('factor_carga_limite_inf', sanitizeDecimalInput(e.target.value))} className="mt-1 bg-white" />
                    </div>
                  </div>
                </div>

                {/* Sigma */}
                <div>
                  <Label htmlFor="sigma_limite">Sigma límite</Label>
                  <Input id="sigma_limite" type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={String(form.sigma_limite ?? '')} onChange={e => onChange('sigma_limite', sanitizeDecimalInput(e.target.value))} className="mt-1" />
                  <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Se usa junto con las Zonas (ver "Límites Manual") para dibujar las bandas de color del gráfico.
                  </p>
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

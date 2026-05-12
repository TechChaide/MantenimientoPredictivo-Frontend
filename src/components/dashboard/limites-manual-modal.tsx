"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { limitesService } from "@/services/limites.service";
import type { Limites } from "@/types/interfaces";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  componenteId: string;
  componenteNombre?: string;
}

export default function LimitesManualModal({ isOpen, onClose, componenteId, componenteNombre }: Props) {
  const [items, setItems] = useState<Limites[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"new" | "edit">("new");
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await limitesService.getAll();
      const data = Array.isArray(resp.data) ? resp.data : [];
      setItems(data.filter(r => String(r.codigo_componente) === String(componenteId)));
    } catch (e: any) {
      setError(e?.message || "Error cargando límites");
    } finally {
      setLoading(false);
    }
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
    setForm({
      codigo_limite: "0",
      codigo_componente: componenteId,
      zona_segura_inf: "0",
      zona_segura_sup: "0",
      zona_alerta_inf: "0",
      zona_alerta_sup: "0",
      zona_critica_inf: "0",
      zona_critica_sup: "0",
      sigma_limite: "0",
      corriente_limite_sup: "0",
      corriente_limite_inf: "0",
      desbalance_limite_sup: "0",
      desbalance_limite_inf: "0",
      factor_carga_limite_sup: "0",
      factor_carga_limite_inf: "0",
      estado: "A",
    });
  };

  const startEdit = (r: Limites) => {
    setFormMode("edit");
    setForm({
      ...r,
      zona_segura_inf: String((r as any).zona_segura_inf ?? "0"),
      zona_segura_sup: String((r as any).zona_segura_sup ?? "0"),
      zona_alerta_inf: String((r as any).zona_alerta_inf ?? "0"),
      zona_alerta_sup: String((r as any).zona_alerta_sup ?? "0"),
      zona_critica_inf: String((r as any).zona_critica_inf ?? "0"),
      zona_critica_sup: String((r as any).zona_critica_sup ?? "0"),
      sigma_limite: String((r as any).sigma_limite ?? "0"),
      corriente_limite_sup: String((r as any).corriente_limite_sup ?? "0"),
      corriente_limite_inf: String((r as any).corriente_limite_inf ?? "0"),
      desbalance_limite_sup: String((r as any).desbalance_limite_sup ?? "0"),
      desbalance_limite_inf: String((r as any).desbalance_limite_inf ?? "0"),
      factor_carga_limite_sup: String((r as any).factor_carga_limite_sup ?? "0"),
      factor_carga_limite_inf: String((r as any).factor_carga_limite_inf ?? "0"),
    });
  };

  const onChange = (field: keyof Limites, value: any) =>
    setForm((prev: any) => ({ ...prev, [field]: value }));

  const canSave = () =>
    Number.isFinite(Number(form.zona_segura_inf)) &&
    Number.isFinite(Number(form.zona_segura_sup)) &&
    Number.isFinite(Number(form.zona_alerta_inf)) &&
    Number.isFinite(Number(form.zona_alerta_sup)) &&
    Number.isFinite(Number(form.zona_critica_inf)) &&
    Number.isFinite(Number(form.zona_critica_sup)) &&
    Number.isFinite(Number(form.sigma_limite)) &&
    !!form.estado;

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSave()) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Limites = {
        codigo_limite: formMode === "edit" ? String(form.codigo_limite ?? "") : "0",
        codigo_componente: String(form.codigo_componente ?? componenteId),
        zona_segura_inf: Number(form.zona_segura_inf ?? 0),
        zona_segura_sup: Number(form.zona_segura_sup ?? 0),
        zona_alerta_inf: Number(form.zona_alerta_inf ?? 0),
        zona_alerta_sup: Number(form.zona_alerta_sup ?? 0),
        zona_critica_inf: Number(form.zona_critica_inf ?? 0),
        zona_critica_sup: Number(form.zona_critica_sup ?? 0),
        sigma_limite: Number(form.sigma_limite ?? 0),
        corriente_limite_sup: Number(form.corriente_limite_sup ?? 0),
        corriente_limite_inf: Number(form.corriente_limite_inf ?? 0),
        desbalance_limite_sup: Number(form.desbalance_limite_sup ?? 0),
        desbalance_limite_inf: Number(form.desbalance_limite_inf ?? 0),
        factor_carga_limite_sup: Number(form.factor_carga_limite_sup ?? 0),
        factor_carga_limite_inf: Number(form.factor_carga_limite_inf ?? 0),
        estado: form.estado,
      };

      await limitesService.save(payload);
      toast({ title: "Éxito", description: formMode === "new" ? "Límite creado." : "Límite actualizado." });
      load();
      startNew();
    } catch (e: any) {
      setError(e?.message || "Error guardando límite");
      toast({ title: "Error", description: e?.message || "Error guardando límite", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este límite?")) return;
    setDeletingId(id);
    try {
      await limitesService.delete(id);
      toast({ title: "Éxito", description: "Límite eliminado." });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Error eliminando límite", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Límites (Zonas) - {componenteNombre}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Listado de límites existentes */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Listado</h3>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2">Código</th>
                    <th className="text-left px-3 py-2">Zona Segura</th>
                    <th className="text-left px-3 py-2">Zona Alerta</th>
                    <th className="text-left px-3 py-2">Zona Crítica</th>
                    <th className="text-center px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-center text-gray-500">
                        Cargando...
                      </td>
                    </tr>
                  )}
                  {!loading && items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-center text-gray-400">
                        Sin límites
                      </td>
                    </tr>
                  )}
                  {items.map((item) => (
                    <tr key={item.codigo_limite} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono">{item.codigo_limite}</td>
                      <td className="px-3 py-2">
                        {item.zona_segura_inf} - {item.zona_segura_sup}
                      </td>
                      <td className="px-3 py-2">
                        {item.zona_alerta_inf} - {item.zona_alerta_sup}
                      </td>
                      <td className="px-3 py-2">
                        {item.zona_critica_inf} - {item.zona_critica_sup}
                      </td>
                      <td className="px-3 py-2 text-center space-x-1">
                        <button
                          onClick={() => startEdit(item)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(item.codigo_limite)}
                          disabled={deletingId === item.codigo_limite}
                          className="text-red-600 hover:underline text-xs disabled:opacity-50"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Formulario */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="text-sm font-semibold">{formMode === "new" ? "Nuevo Límite" : "Editar Límite"}</h3>

            {/* Zona Segura */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="zona_segura_inf">Límite Inf. Zona Segura</Label>
                <Input
                  id="zona_segura_inf"
                  type="number"
                  step="0.01"
                  value={form.zona_segura_inf || ""}
                  onChange={(e) => onChange("zona_segura_inf" as any, e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="zona_segura_sup">Límite Sup. Zona Segura</Label>
                <Input
                  id="zona_segura_sup"
                  type="number"
                  step="0.01"
                  value={form.zona_segura_sup || ""}
                  onChange={(e) => onChange("zona_segura_sup" as any, e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Zona Alerta */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="zona_alerta_inf">Límite Inf. Zona de Alerta</Label>
                <Input
                  id="zona_alerta_inf"
                  type="number"
                  step="0.01"
                  value={form.zona_alerta_inf || ""}
                  onChange={(e) => onChange("zona_alerta_inf" as any, e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="zona_alerta_sup">Límite Sup. Zona de Alerta</Label>
                <Input
                  id="zona_alerta_sup"
                  type="number"
                  step="0.01"
                  value={form.zona_alerta_sup || ""}
                  onChange={(e) => onChange("zona_alerta_sup" as any, e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Zona Crítica */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="zona_critica_inf">Límite Inf. Zona Crítica</Label>
                <Input
                  id="zona_critica_inf"
                  type="number"
                  step="0.01"
                  value={form.zona_critica_inf || ""}
                  onChange={(e) => onChange("zona_critica_inf" as any, e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="zona_critica_sup">Límite Sup. Zona Crítica</Label>
                <Input
                  id="zona_critica_sup"
                  type="number"
                  step="0.01"
                  value={form.zona_critica_sup || ""}
                  onChange={(e) => onChange("zona_critica_sup" as any, e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Sigma Límite */}
            <div>
              <Label htmlFor="sigma_limite">Sigma Límite</Label>
              <Input
                id="sigma_limite"
                type="number"
                step="0.01"
                value={form.sigma_limite || ""}
                onChange={(e) => onChange("sigma_limite" as any, e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Estado */}
            <div>
              <Label htmlFor="estado">Estado *</Label>
              <select
                id="estado"
                value={form.estado || "A"}
                onChange={(e) => onChange("estado" as any, e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="A">Activo</option>
                <option value="I">Inactivo</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave() || saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

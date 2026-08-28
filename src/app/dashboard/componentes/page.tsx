"use client";

import { useEffect, useMemo, useState } from "react";
import ReferenciasModal from "@/components/dashboard/referencias-modal";
import LimitesModal from "@/components/dashboard/limites-modal";
import LimitesManualModal from "@/components/dashboard/limites-manual-modal";
import { componenteService } from "@/services/componente.service";
import { equipoService } from "@/services/equipo.service";
import { areaService } from "@/services/area.service";
import type { Componente, Equipo, Area } from "@/types/interfaces";
import { useRegionalScope, filterAreasByRegional } from "@/hooks/use-regional-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2, Plus, Save, RefreshCw, Trash2, X, Flag, EllipsisVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

type FormState = {
  mode: "new" | "edit";
  data: Partial<Componente>;
};

const emptyComponente: Componente = {
  codigo_componente: 0 as any, // 0 para inserción
  codigo_equipo: "",
  nombre_componente: "",
  admite_registros_manuales: false,
  estado: "A",
};

export default function ComponentePage() {
  const [items, setItems] = useState<Componente[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const { regional, mostrarTodos } = useRegionalScope();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<FormState>({ mode: "new", data: emptyComponente });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const { toast }:
    { toast: (args: { title: string; description?: string; variant?: "default" | "destructive" | "success" | "warning" }) => void } = useToast();

  const [showReferenciasModal, setShowReferenciasModal] = useState(false);
  const [showLimitesModal, setShowLimitesModal] = useState(false);
  const [showLimitesManualModal, setShowLimitesManualModal] = useState(false);
  const [modalComponenteId, setModalComponenteId] = useState<string | null>(null);
  const [modalComponenteName, setModalComponenteName] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const resp = await componenteService.getAll();
      const data = Array.isArray(resp.data) ? resp.data : [];
      setItems(data);
      if (data.length === 0) {
        setShowForm(true);
      }
    } catch (e: any) {
      setError(e?.message || "Error cargando componentes");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const loadEquipos = async () => {
      try {
        const resp = await equipoService.getAll();
        setEquipos(Array.isArray(resp.data) ? resp.data : []);
      } catch (e: any) {
        console.error("Error cargando equipos", e);
      }
    };
    const loadAreas = async () => {
      try {
        const resp = await areaService.getAll();
        setAreas(Array.isArray(resp.data) ? resp.data : []);
      } catch (e: any) {
        console.error("Error cargando áreas", e);
      }
    };
    loadEquipos();
    loadAreas();
  }, []);

  const equiposEnRegional = useMemo(() => {
    if (mostrarTodos) return equipos;
    const areasEnRegional = filterAreasByRegional(areas, regional, mostrarTodos);
    const codigosAreaRegional = new Set(areasEnRegional.map(a => String(a.codigo_area)));
    return equipos.filter(e => codigosAreaRegional.has(String(e.codigo_area)));
  }, [equipos, areas, regional, mostrarTodos]);

  const itemsEnRegional = useMemo(() => {
    if (mostrarTodos) return items;
    const codigosEquipoRegional = new Set(equiposEnRegional.map(e => String(e.codigo_equipo)));
    return items.filter(it => codigosEquipoRegional.has(String(it.codigo_equipo)));
  }, [items, equiposEnRegional, mostrarTodos]);

  const filtered = useMemo(() => {
    if (!filter) return itemsEnRegional;
    const f = filter.toLowerCase();
    return itemsEnRegional.filter(it =>
      String(it.codigo_componente ?? '').toLowerCase().includes(f) ||
      String(it.codigo_equipo ?? '').toLowerCase().includes(f) ||
      String(it.nombre_componente ?? '').toLowerCase().includes(f) ||
      String(it.estado ?? '').toLowerCase().includes(f)
    );
  }, [itemsEnRegional, filter]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const startNew = () => setForm({ mode: "new", data: { ...emptyComponente } });
  const startEdit = (c: Componente) => setForm({ mode: "edit", data: { ...c } });
  const cancelEdit = () => startNew();

  const onChangeField = (field: keyof Componente, value: string | boolean) => {
    setForm(prev => ({ ...prev, data: { ...prev.data, [field]: value } }));
  };

  const canSave = () => !!form.data.nombre_componente && form.data.estado && form.data.codigo_equipo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave()) return;
    setSaving(true); setError(null);
    try {
      const payload: Componente = {
        codigo_componente: form.mode === "edit" ? String(form.data.codigo_componente ?? "") : "0",
        codigo_equipo: String(form.data.codigo_equipo ?? "").trim(),
        nombre_componente: String(form.data.nombre_componente ?? "").trim(),
        // NOTA: el backend todavía no tiene una columna propia para esto en
        // `componente` (hoy solo existe en `equipo`) — se envía igual para
        // que empiece a guardarse en cuanto esa columna exista.
        admite_registros_manuales: form.data.admite_registros_manuales ?? false,
        estado: String(form.data.estado ?? "A").trim(),
      };
      const respSaved = await componenteService.save(payload);
      const saved = respSaved.data;
      setItems(prev => {
        const exists = prev.some(it => it.codigo_componente === saved.codigo_componente);
        if (exists) return prev.map(it => it.codigo_componente === saved.codigo_componente ? saved : it);
        return [saved, ...prev];
      });
      startNew();
      setShowForm(false);
      toast({ title: "Componente guardado", description: `Componente ${saved.nombre_componente} (${saved.codigo_componente}) guardado.`, variant: "success" });
    } catch (e: any) {
      setError(e?.message || "Error guardando componente");
      toast({ title: "Error al guardar", description: e?.message || "Fallo desconocido", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (codigo: string) => {
    if (!confirm("¿Eliminar componente?")) return;
    setDeletingId(codigo); setError(null);
    try {
      await componenteService.delete(codigo);
      await load();
      if (form.mode === "edit" && form.data.codigo_componente === codigo) startNew();
      toast({ title: "Componente eliminado", description: `Se eliminó el componente ${codigo}.`, variant: "success" });
    } catch (e: any) {
      setError(e?.message || "Error eliminando componente");
      toast({ title: "Error al eliminar", description: e?.message || "Fallo desconocido", variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base md:text-lg">Componentes</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Recargar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowForm(prev => !prev)}
                disabled={saving}
              >
                {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                {showForm ? "Cerrar" : "Nuevo"}
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <Input
              placeholder="Filtrar (código, equipo, nombre, estado)"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-white/70"
            />
          </div>
        </CardHeader>
        <CardContent>
          {showForm ? (
            <>
              {/* Formulario de creación/edición */}
              <form onSubmit={handleSubmit} className="mb-6 bg-white p-4 rounded-lg border max-w-md">
                <div className="mb-2">
                  <Label htmlFor="codigo_componente">Código</Label>
                  <Input id="codigo_componente" value={form.data.codigo_componente ?? ''} disabled className="mt-1" />
                </div>
                <div className="mb-2">
                  <Label htmlFor="codigo_equipo">Equipo *</Label>
                  <Select
                    value={String(form.data.codigo_equipo) || ''}
                    onValueChange={value => onChangeField('codigo_equipo', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un equipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {equiposEnRegional.map(equipo => (
                        <SelectItem key={equipo.codigo_equipo} value={String(equipo.codigo_equipo)}>
                          {equipo.nombre_equipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mb-2">
                  <Label htmlFor="nombre_componente">Nombre *</Label>
                  <Input id="nombre_componente" value={form.data.nombre_componente || ''} onChange={e => onChangeField('nombre_componente', e.target.value)} required className="mt-1" />
                </div>
                <div className="mb-2">
                  <Label htmlFor="estado">Estado *</Label>
                  <select id="estado" className="w-full rounded-md border px-3 py-2 text-sm bg-white mt-1" value={form.data.estado || 'A'} onChange={e => onChangeField('estado', e.target.value)}>
                    <option value="A">Activo</option>
                    <option value="I">Inactivo</option>
                  </select>
                </div>
                <div className="mb-2 flex items-center justify-between">
                  <Label htmlFor="admite_registros_manuales">Admite Registros Manuales</Label>
                  <Switch
                    id="admite_registros_manuales"
                    checked={form.data.admite_registros_manuales ?? false}
                    onCheckedChange={(checked) => onChangeField('admite_registros_manuales', checked)}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className={form.mode === 'edit' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} disabled={!canSave() || saving}>
                    {form.mode === 'edit' ? 'Actualizar' : 'Guardar'}
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => { setShowForm(false); cancelEdit(); }} className="flex items-center gap-1">
                    <X className="h-4 w-4" /> Cancelar
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              {/* Tabla de componentes */}
              <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="text-left px-3 py-2 w-32">Código</th>
                  <th className="text-left px-3 py-2">Equipo</th>
                  <th className="text-left px-3 py-2">Nombre</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-left px-3 py-2">Registro Manual</th>
                  <th className="px-3 py-2 text-center w-32">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">Cargando...</td></tr>
                )}
                {!loading && paginatedItems.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Sin resultados</td></tr>
                )}
                {!loading && paginatedItems.map((comp) => (
                  <tr
                    key={comp.codigo_componente}
                    className="transition-colors bg-white hover:bg-gray-100"
                  >
                    <td className="px-3 py-2 font-mono text-xs align-middle">{comp.codigo_componente}</td>
                    <td className="px-3 py-2 align-middle">{equipos.find(e => e.codigo_equipo === comp.codigo_equipo)?.nombre_equipo || comp.codigo_equipo}</td>
                    <td className="px-3 py-2 align-middle">{comp.nombre_componente}</td>
                    <td className="px-3 py-2 align-middle">
                      <span className="inline-block rounded-full bg-green-600 text-white px-3 py-0.5 text-xs font-semibold">
                        Activo
                      </span>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <span
                        className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${
                          comp.admite_registros_manuales ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {comp.admite_registros_manuales ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-center align-middle">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <EllipsisVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { startEdit(comp); setShowForm(true); }}>
                            ✏️ Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setModalComponenteId(String(comp.codigo_componente)); setModalComponenteName(comp.nombre_componente); setShowReferenciasModal(true); }}>
                            📎 Referencias
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setModalComponenteId(String(comp.codigo_componente));
                            setModalComponenteName(comp.nombre_componente);
                            if (comp.admite_registros_manuales) {
                              setShowLimitesManualModal(true);
                            } else {
                              setShowLimitesModal(true);
                            }
                          }}>
                            📏 Límites
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(comp.codigo_componente)}
                            disabled={deletingId === comp.codigo_componente}
                            className="text-red-600"
                          >
                            🗑️ Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
              </div>

              {/* Controles de paginación tipo referencia */}
              <div className="flex items-center gap-4 mt-4">
                <label htmlFor="itemsPerPage" className="mr-2 text-sm">Items per page:</label>
                <select
                  id="itemsPerPage"
                  value={itemsPerPage}
                  onChange={e => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border rounded px-2 py-1 text-sm"
                  style={{ minWidth: 56 }}
                >
                  {[5, 10, 20].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-700">
                  {filtered.length === 0
                    ? '0'
                    : `${(currentPage - 1) * itemsPerPage + 1} - ${Math.min(currentPage * itemsPerPage, filtered.length)} of ${filtered.length}`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className={`px-2 py-1 rounded ${currentPage === 1 ? 'text-gray-400' : 'hover:bg-gray-200'}`}
                    aria-label="Primera página"
                  >&#171;</button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`px-2 py-1 rounded ${currentPage === 1 ? 'text-gray-400' : 'hover:bg-gray-200'}`}
                    aria-label="Página anterior"
                  >&#60;</button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className={`px-2 py-1 rounded ${currentPage === totalPages || totalPages === 0 ? 'text-gray-400' : 'hover:bg-gray-200'}`}
                    aria-label="Página siguiente"
                  >&#62;</button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className={`px-2 py-1 rounded ${currentPage === totalPages || totalPages === 0 ? 'text-gray-400' : 'hover:bg-gray-200'}`}
                    aria-label="Última página"
                  >&#187;</button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {modalComponenteId && (
        <>
          <ReferenciasModal isOpen={showReferenciasModal} onClose={() => setShowReferenciasModal(false)} componenteId={modalComponenteId} componenteNombre={modalComponenteName ?? undefined} />
          <LimitesModal isOpen={showLimitesModal} onClose={() => setShowLimitesModal(false)} componenteId={modalComponenteId} componenteNombre={modalComponenteName ?? undefined} />
          <LimitesManualModal isOpen={showLimitesManualModal} onClose={() => setShowLimitesManualModal(false)} componenteId={modalComponenteId} componenteNombre={modalComponenteName ?? undefined} />
        </>
      )}

      {error && (
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

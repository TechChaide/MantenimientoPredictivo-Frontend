"use client";

import { useEffect, useMemo, useState, useRef, Fragment } from "react";
import { tipoEventoService } from "@/services/tipoEvento.service";
import { categoriaEventoService } from "@/services/categoriaEvento.service";
import type { TipoEvento, CategoriaEvento } from "@/types/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2, Plus, Save, RefreshCw, Trash2, X, Flag, EllipsisVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

type FormState = {
  mode: "new" | "edit";
  data: Partial<TipoEvento> & { codigo_tipo_evento?: string | number };
};

const emptyTipoEvento: TipoEvento = {
  codigo_tipo_evento: 0 as any, // 0 para inserción
  nombre_evento: "",
  estado: "A",
};

export default function TipoEventoPage() {
  const [items, setItems] = useState<TipoEvento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<FormState>({ mode: "new", data: emptyTipoEvento });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [categoriesMap, setCategoriesMap] = useState<Record<string, CategoriaEvento[]>>({});
  const [categoriesLoadingMap, setCategoriesLoadingMap] = useState<Record<string, boolean>>({});
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<TipoEvento | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [newCategoryEstado, setNewCategoryEstado] = useState("A");
  const [savingCategory, setSavingCategory] = useState(false);
  const loadingRef = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const { toast }:
    { toast: (args: { title: string; description?: string; variant?: "default" | "destructive" | "success" | "warning" }) => void } = useToast();

  const load = async () => {
    if (loadingRef.current) return; // prevent concurrent loads
    loadingRef.current = true;
    setLoading(true); setError(null);
    try {
      const resp = await tipoEventoService.getAll();
      const data = Array.isArray(resp.data) ? resp.data : [];
      setItems(data);
      if (data.length === 0) {
        setShowForm(true);
      }
    } catch (e: any) {
      const errorMsg = e?.message || "Error cargando tipos de evento";
      console.error("❌ Error en load():", errorMsg, e);
      setError(errorMsg);
    } finally { 
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!filter) return items;
    const f = filter.toLowerCase();
    return items.filter(it =>
      String(it.codigo_tipo_evento ?? '').toLowerCase().includes(f) ||
      String(it.nombre_evento ?? '').toLowerCase().includes(f) ||
      String(it.estado ?? '').toLowerCase().includes(f)
    );
  }, [items, filter]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const startNew = () => setForm({ mode: "new", data: { ...emptyTipoEvento } });
  const startEdit = (c: TipoEvento) => setForm({ mode: "edit", data: { ...c } });
  const cancelEdit = () => startNew();

  const loadCategories = async (tipo: TipoEvento) => {
    const id = String(tipo.codigo_tipo_evento);
    setSelectedTipo(tipo);
    setCategoriesLoadingMap(prev => ({ ...prev, [id]: true }));
    try {
      const resp = await categoriaEventoService.getAll();
      const data = Array.isArray(resp.data) ? resp.data : [];
      const filtered = data.filter(c => String(c.codigo_tipo_evento) === id);
      setCategoriesMap(prev => ({ ...prev, [id]: filtered }));
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Error cargando categorias';
      console.error('❌ Error en loadCategories():', msg, e);
      toast({ title: 'Error al cargar categorias', description: msg, variant: 'destructive' });
    } finally {
      setCategoriesLoadingMap(prev => ({ ...prev, [id]: false }));
    }
  };

  const toggleExpand = (tipo: TipoEvento) => {
    const id = String(tipo.codigo_tipo_evento);
    setExpandedIds(prev => {
      const exists = prev.includes(id);
      if (exists) {
        return prev.filter(x => x !== id);
      }
      // expand: load categories for this tipo then add id
      loadCategories(tipo).catch(() => {});
      return [...prev, id];
    });
  };

  const closeCategoriesModal = () => {
    setShowCategoriesModal(false);
    if (selectedTipo) {
      const id = String(selectedTipo.codigo_tipo_evento);
      setCategoriesMap(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
    setSelectedTipo(null);
    setNewCategoryDesc('');
    setNewCategoryEstado('A');
  };

  const handleAddCategory = async () => {
    if (!selectedTipo) return;
    if (!newCategoryDesc) return toast({ title: 'Descripción requerida', variant: 'warning' });
    setSavingCategory(true);
    try {
      const payload: CategoriaEvento = {
        codigo_categoria_evento: '0',
        codigo_tipo_evento: String(selectedTipo.codigo_tipo_evento),
        descripcion: newCategoryDesc.trim(),
        estado: newCategoryEstado || 'A',
      };
      const resp = await categoriaEventoService.save(payload);
      const saved = resp.data;
      const id = String(selectedTipo.codigo_tipo_evento);
      setCategoriesMap(prev => ({ ...prev, [id]: [saved, ...(prev[id] || [])] }));
      setNewCategoryDesc(''); setNewCategoryEstado('A');
      toast({ title: 'Categoria agregada', description: `Categoria ${saved.descripcion} creada.`, variant: 'success' });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Error guardando categoria';
      console.error('❌ Error en handleAddCategory():', msg, e);
      toast({ title: 'Error al agregar categoria', description: msg, variant: 'destructive' });
    } finally {
      setSavingCategory(false);
    }
  };

  const onChangeField = (field: keyof TipoEvento, value: string) => {
    setForm(prev => ({ ...prev, data: { ...prev.data, [field]: value } }));
  };

  const canSave = () => !!form.data.nombre_evento && form.data.estado;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave()) return;
    setSaving(true); setError(null);
    try {
      const payload: TipoEvento = {
        codigo_tipo_evento: form.mode === "edit" ? String(form.data.codigo_tipo_evento ?? "") : "0",
        nombre_evento: (form.data.nombre_evento || "").trim(),
        estado: (form.data.estado || "A").trim(),
      };
      const respSaved = await tipoEventoService.save(payload);
      const saved = respSaved.data;
      setItems(prev => {
        const exists = prev.some(it => it.codigo_tipo_evento === saved.codigo_tipo_evento);
        if (exists) return prev.map(it => it.codigo_tipo_evento === saved.codigo_tipo_evento ? saved : it);
        return [saved, ...prev];
      });
      startNew();
      setShowForm(false);
      toast({ title: "Tipo de evento guardado", description: `Tipo de evento ${saved.nombre_evento} (${saved.codigo_tipo_evento}) guardado.`, variant: "success" });
    } catch (e: any) {
      setError(e?.message || "Error guardando tipo de evento");
      toast({ title: "Error al guardar", description: e?.message || "Fallo desconocido", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (codigo: string) => {
    if (!confirm("¿Eliminar tipo de evento?")) return;
    setDeletingId(codigo); setError(null);
    try {
      await tipoEventoService.delete(codigo);
      await load();
      if (form.mode === "edit" && form.data.codigo_tipo_evento === codigo) startNew();
      toast({ title: "Tipo de evento eliminado", description: `Se eliminó el tipo de evento ${codigo}.`, variant: "success" });
    } catch (e: any) {
      setError(e?.message || "Error eliminando tipo de evento");
      toast({ title: "Error al eliminar", description: e?.message || "Fallo desconocido", variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base md:text-lg">Tipos de Evento</CardTitle>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowForm(prev => !prev)}
              disabled={saving}
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              {showForm ? "Cerrar" : "Nuevo"}
            </Button>
          </div>
          <div className="mt-3">
            <Input
              placeholder="Filtrar (código, nombre, estado)"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-white border rounded-md px-3 py-2"
            />
          </div>
        </CardHeader>
        <CardContent>
          {showForm ? (
            <>
              {/* Formulario de creación/edición */}
              <form onSubmit={handleSubmit} className="mb-6 bg-white p-4 rounded-lg border max-w-md">
                <div className="mb-2">
                  <Label htmlFor="codigo_tipo_evento">Código</Label>
                  <Input id="codigo_tipo_evento" value={form.data.codigo_tipo_evento ?? ''} disabled className="mt-1" />
                </div>
                <div className="mb-2">
                  <Label htmlFor="nombre_evento">Nombre *</Label>
                  <Input id="nombre_evento" value={form.data.nombre_evento || ''} onChange={e => onChangeField('nombre_evento', e.target.value)} required className="mt-1" />
                </div>
                <div className="mb-2">
                  <Label htmlFor="estado">Estado *</Label>
                  <select id="estado" className="w-full rounded-md border px-3 py-2 text-sm bg-white mt-1" value={form.data.estado || 'A'} onChange={e => onChangeField('estado', e.target.value)}>
                    <option value="A">Activo</option>
                    <option value="I">Inactivo</option>
                  </select>
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
              {/* Tabla de tipos de evento */}
              <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2 w-32">Código</th>
                    <th className="text-left px-3 py-2">Nombre</th>
                    <th className="text-left px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-center w-32">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Cargando...</td></tr>
                  )}
                  {!loading && paginatedItems.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Sin resultados</td></tr>
                  )}
                  {!loading && paginatedItems.map(tipo => {
                    const id = String(tipo.codigo_tipo_evento);
                    const isExpanded = expandedIds.includes(id);
                    const cats = categoriesMap[id] || [];
                    const loadingCats = !!categoriesLoadingMap[id];
                    return (
                      <Fragment key={id}>
                        <tr className="transition-colors bg-white hover:bg-gray-100">
                          <td className="px-3 py-2 font-mono text-xs align-middle">{tipo.codigo_tipo_evento}</td>
                          <td onClick={() => toggleExpand(tipo)} className="px-3 py-2 align-middle cursor-pointer hover:underline">{tipo.nombre_evento}</td>
                          <td className="px-3 py-2 align-middle">
                            <span className="inline-block rounded-full bg-green-600 text-white px-3 py-0.5 text-xs font-semibold">
                              Activo
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
                                <DropdownMenuItem onClick={() => { setSelectedTipo(tipo); setShowCategoriesModal(true); }}>
                                  ➕ Agregar Categoria
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { startEdit(tipo); setShowForm(true); }}>
                                  ✏️ Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(tipo.codigo_tipo_evento)}
                                  disabled={deletingId === tipo.codigo_tipo_evento}
                                  className="text-red-600"
                                >
                                  🗑️ Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={id + '-exp'} className="bg-gray-50">
                            <td colSpan={4} className="p-3">
                              <div className="text-sm">
                                {loadingCats && <div className="text-gray-500">Cargando categorias...</div>}
                                {!loadingCats && cats.length === 0 && <div className="text-gray-500">Sin categorias para este tipo</div>}
                                {!loadingCats && cats.length > 0 && (
                                  <div className="grid grid-cols-1 gap-2">
                                    {cats.map(cat => (
                                      <div key={cat.codigo_categoria_evento} className="p-2 bg-white border rounded flex items-center justify-between">
                                        <div>
                                          <div className="font-medium">{cat.descripcion}</div>
                                          <div className="text-xs text-gray-500">Estado: {cat.estado}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>

              {/* Controles de paginación */}
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

      {showCategoriesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Categorias para: {selectedTipo?.nombre_evento}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={closeCategoriesModal}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="mb-3">
                    <Label>Agregar Categoria</Label>
                    <div className="flex flex-col sm:flex-row gap-2 mt-2">
                      <Input value={newCategoryDesc} onChange={e => setNewCategoryDesc(e.target.value)} placeholder="Descripción" />
                      <select value={newCategoryEstado} onChange={e => setNewCategoryEstado(e.target.value)} className="border rounded px-2 w-full sm:w-auto">
                        <option value="A">Activo</option>
                        <option value="I">Inactivo</option>
                      </select>
                      <Button onClick={handleAddCategory} disabled={savingCategory} className="bg-blue-500 text-white">{savingCategory ? 'Guardando...' : 'Agregar'}</Button>
                    </div>
                  </div>

                  {/* El modal se usa solo para agregar nuevas categorias. El listado se muestra en el expansion panel. */}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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

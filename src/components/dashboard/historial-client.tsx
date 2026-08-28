"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EllipsisVertical, Footprints, AudioWaveform } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import EventFlowModal from "@/app/dashboard/historial/components/event-flow-modal";
import { useToast } from "@/hooks/use-toast";
import { equipoService } from "@/services/equipo.service";
import { componenteService } from "@/services/componente.service";
import { areaService } from "@/services/area.service";
import { historialService } from "@/services/historial.service";
import { categoriaEventoService } from "@/services/categoriaEvento.service";
import type { Equipo, Componente, Historial, CategoriaEvento } from "@/types/interfaces";
import { useRegionalScope, filterAreasByRegional } from "@/hooks/use-regional-scope";

type HistorialResponse = Omit<Historial, 'descripcion_evento'> & {
  descripcion_evento?: string;
  descripcion?: string;
  params?: any;
};

export function HistorialClient() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [componentes, setComponentes] = useState<Componente[]>([]);
  const [historial, setHistorial] = useState<HistorialResponse[]>([]);
  const [totalHistorial, setTotalHistorial] = useState<number>(0);

  const [selectedEquipo, setSelectedEquipo] = useState<string>("");
  const [selectedComponente, setSelectedComponente] = useState<string>("");
  
  const [loading, setLoading] = useState(false);
  const [loadingEquipos, setLoadingEquipos] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoriasMap, setCategoriasMap] = useState<Record<string, string>>({});

  const [eventFlowOpen, setEventFlowOpen] = useState(false);
  const [selectedHistorialEntry, setSelectedHistorialEntry] = useState<HistorialResponse | null>(null);
  const [modalMode, setModalMode] = useState<'flow' | 'trace'>('flow');
  const { toast } = useToast();
  const { regional, mostrarTodos, loading: loadingRegionalScope } = useRegionalScope();

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Cargar equipos (filtrados por la regional del usuario) al montar el componente
  useEffect(() => {
    if (loadingRegionalScope) return;

    const fetchEquipos = async () => {
      try {
        setLoadingEquipos(true);
        const [equiposResp, areasResp] = await Promise.all([
          equipoService.getAll(),
          areaService.getAll(),
        ]);
        const todosEquipos = equiposResp.data || [];
        const todasAreas = areasResp.data || [];
        if (mostrarTodos) {
          setEquipos(todosEquipos);
        } else {
          const areasEnRegional = filterAreasByRegional(todasAreas, regional, mostrarTodos);
          const codigosAreaRegional = new Set(areasEnRegional.map(a => String(a.codigo_area)));
          setEquipos(todosEquipos.filter(e => codigosAreaRegional.has(String(e.codigo_area))));
        }
        setError(null);
      } catch (err) {
        setError("Error al cargar equipos");
        console.error(err);
      } finally {
        setLoadingEquipos(false);
      }
    };

    fetchEquipos();
  }, [loadingRegionalScope, mostrarTodos, regional]);

  // Cargar componentes cuando se selecciona un equipo
  useEffect(() => {
    if (!selectedEquipo) {
      setComponentes([]);
      setSelectedComponente("");
      setHistorial([]);
      setTotalHistorial(0);
      return;
    }

    const fetchComponentes = async () => {
      try {
        const response = await componenteService.getAll();
        const filtered = (response.data || []).filter(
          (c) => c.codigo_equipo === selectedEquipo
        );
        setComponentes(filtered);
        setSelectedComponente("");
        setHistorial([]);
        setTotalHistorial(0);
        setCurrentPage(1);
        setError(null);
      } catch (err) {
        setError("Error al cargar componentes");
        console.error(err);
      }
    };

    fetchComponentes();
  }, [selectedEquipo]);

  // Cargar categorias (mapa codigo -> descripcion)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await categoriaEventoService.getAll();
        const data = Array.isArray(resp.data) ? resp.data : [];
        const map: Record<string, string> = {};
        data.forEach((c: CategoriaEvento) => { map[String(c.codigo_categoria_evento)] = c.descripcion; });
        if (mounted) setCategoriasMap(map);
      } catch (err) {
        console.error('Error cargando categorias de evento', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Cargar historial cuando se selecciona un componente
  useEffect(() => {
    if (!selectedEquipo || !selectedComponente) return;

    const fetchHistorial = async () => {
      try {
        setLoading(true);

        // Obtener nombres para las llamadas a los servicios
        const equipoName = selectedEquipoObj?.nombre_equipo || "";
        const componenteName = selectedComponenteObj?.nombre_componente || "";

        // Obtener total de historiales
        const totalResponse = await historialService.getTotalHistorialByComponenteYMaquina(
          equipoName,
          componenteName
        );
        const total = Array.isArray(totalResponse.data) && totalResponse.data[0] 
          ? totalResponse.data[0].TotalRegistros || 0
          : totalResponse.data?.total || 0;
        setTotalHistorial(total);

        // Calcular número de llamadas necesarias (1000 registros por llamada)
        const itemsPerCall = 1000;
        const numCalls = Math.ceil(total / itemsPerCall);
        
        // Acumular todos los registros de todas las llamadas
        const allHistorial: HistorialResponse[] = [];
        
        for (let page = 1; page <= numCalls; page++) {
          const response = await historialService.getHistorialByComponenteCodigoYMAquina(
            equipoName,
            componenteName,
            page,
            itemsPerCall
          );
          
          // Convertir la respuesta de objeto indexado a array si es necesario
          let historialData: HistorialResponse[] = [];
          if (Array.isArray(response.data)) {
            historialData = response.data;
          } else if (typeof response.data === "object" && response.data !== null) {
            historialData = Object.values(response.data);
          }
          
          allHistorial.push(...historialData);
        }
        
        setHistorial(allHistorial);
        setCurrentPage(1);
        setError(null);
      } catch (err) {
        setError("Error al cargar el historial");
        console.error(err);
        setHistorial([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistorial();
  }, [selectedEquipo, selectedComponente]);

  const selectedEquipoObj = equipos.find((e) => e.codigo_equipo === selectedEquipo);
  const selectedComponenteObj = componentes.find(
    (c) => c.codigo_componente === selectedComponente
  );

  // Paginación local
  const totalPages = Math.ceil(totalHistorial / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedHistorial = historial.slice(startIndex, endIndex);

  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  const handlePreviousPage = () => {
    if (hasPrevPage) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (hasNextPage) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Equipo</label>
              <Select value={selectedEquipo} onValueChange={setSelectedEquipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar equipo..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingEquipos ? (
                    <SelectItem value="loading" disabled>
                      Cargando equipos...
                    </SelectItem>
                  ) : equipos.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      No hay equipos disponibles
                    </SelectItem>
                  ) : (
                    equipos.map((equipo) => (
                      <SelectItem key={equipo.codigo_equipo} value={equipo.codigo_equipo}>
                        {equipo.nombre_equipo}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Componente</label>
              <Select
                value={selectedComponente}
                onValueChange={setSelectedComponente}
                disabled={!selectedEquipo}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar componente..." />
                </SelectTrigger>
                <SelectContent>
                  {componentes.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      {selectedEquipo
                        ? "No hay componentes para este equipo"
                        : "Selecciona un equipo primero"}
                    </SelectItem>
                  ) : (
                    componentes.map((componente) => (
                      <SelectItem
                        key={componente.codigo_componente}
                        value={componente.codigo_componente}
                      >
                        {componente.nombre_componente}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedEquipo && selectedComponente && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Historial de Eventos
              {selectedEquipoObj && selectedComponenteObj && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  - {selectedEquipoObj.nombre_equipo} / {selectedComponenteObj.nombre_componente}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Cargando historial...
              </div>
            ) : historial.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay eventos registrados para esta combinación
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Detalle Técnico</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedHistorial.map((h, index) => {
                        let paramsObj = {};
                        try {
                          paramsObj = typeof h.params === 'string' ? JSON.parse(h.params) : h.params;
                        } catch (e) {
                          paramsObj = {};
                        }

                        return (
                          <TableRow key={index}>
                            <TableCell>
                              {typeof h.fecha_evento === "string"
                                ? new Date(h.fecha_evento).toLocaleString()
                                : h.fecha_evento.toLocaleString()}
                            </TableCell>
                            <TableCell>{categoriasMap[String(h.codigo_categoria_evento)] ?? h.codigo_categoria_evento}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {h.descripcion || h.descripcion_evento}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2 max-w-xs">
                                {Object.entries(paramsObj).length > 0 ? (
                                  Object.entries(paramsObj).map(([key, value]) => (
                                    <button
                                      key={key}
                                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                        key === 'reg_current'
                                          ? 'bg-red-100 text-red-800 hover:bg-red-200'
                                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                      }`}
                                      title={`${key}: ${String(value)}`}
                                    >
                                      {key}: {typeof value === 'number' ? value.toFixed(2) : String(value)}
                                    </button>
                                  ))
                                ) : (
                                  <span className="text-gray-500 text-xs">N/A</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  h.estado === "A"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {h.estado === "A" ? "Activo" : "Inactivo"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                  >
                                    <EllipsisVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                      <DropdownMenuItem className="cursor-pointer" onClick={() => { toast({ title: 'Información', description: 'Funcionalidad de trazado en fase de desarrollo.', variant: 'default' }); }}>
                                        <Footprints className="h-4 w-4 mr-2" />
                                        <span>Trazar evento</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="cursor-pointer" onClick={() => { setSelectedHistorialEntry(h); setModalMode('flow'); setEventFlowOpen(true); }}>
                                        <AudioWaveform className="h-4 w-4 mr-2" />
                                        <span>Ver flujo de registros</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginación */}
                {totalHistorial > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t gap-4">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-gray-600">Elementos por página:</label>
                      <Select value={String(pageSize)} onValueChange={(val) => {
                        setPageSize(Number(val));
                        setCurrentPage(1);
                      }}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="text-sm text-gray-600">
                      Página {currentPage} de {totalPages} (Total: {totalHistorial} eventos)
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={!hasPrevPage}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={!hasNextPage}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
        {selectedHistorialEntry && (
          <EventFlowModal
            open={eventFlowOpen}
            onClose={() => setEventFlowOpen(false)}
            entry={selectedHistorialEntry}
            mode={modalMode}
            machineName={selectedEquipoObj?.nombre_equipo ?? ''}
            componenteName={selectedComponenteObj?.nombre_componente ?? ''}
          />
        )}
    </div>
  );
}

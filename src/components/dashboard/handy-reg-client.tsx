"use client";

import { useEffect, useState } from "react";
import { registrosService } from "@/services/registros.service";
import { equipoService } from "@/services/equipo.service";
import { componenteService } from "@/services/componente.service";
import { areaService } from "@/services/area.service";
import { serviciosService } from "@/services/servicios.service";
import { checkMostrarTodosEquipos } from "@/lib/mostrar-todos-equipos";
import type { Registros, Equipo, Componente, Area, TareasSismac } from "@/types/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2, Save, Plus, Trash2, ChevronRight, ChevronLeft, Search, Play, Square, CheckCircle, ChevronsLeft, ChevronsRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Función helper para convertir fecha a zona horaria de Ecuador (UTC-5)

// Función para convertir número a letra (1->A, 2->B, etc.)
const numeroALetra = (numero: number): string => {
  return String.fromCharCode(64 + numero); // 64 + 1 = 65 (A)
};

/**
 * Normaliza el texto libre que ingresa el técnico a la unidad estándar.
 * Temperatura → °C o °F  |  Vibración → mm/s RMS, in/s RMS, mm pk-pk, in pk-pk, g RMS, Hz
 */
export function normalizarUnidad(input: string): string {
  const raw = input.trim().toLowerCase().replace(/\s+/g, " ");

  // ── Temperatura ──────────────────────────────────────────────
  if (/^[°]?c$|celsius|centigrado|centigrade|temp.*c|grado/.test(raw)) return "°C";
  if (/^[°]?f$|fahrenheit|temp.*f/.test(raw)) return "°F";

  // ── Vibración Hz ─────────────────────────────────────────────
  if (/hz|hertz|frecuen/.test(raw)) return "Hz";

  // ── Vibración g RMS ──────────────────────────────────────────
  if (/^g\s?rms$|^grms$|^g$/.test(raw)) return "g RMS";

  // ── Vibración mm/s RMS ───────────────────────────────────────
  if (/mm\s?\/\s?s/.test(raw)) {
    if (/pk|pico|peak/.test(raw)) return "mm pk-pk";
    return "mm/s RMS";
  }

  // ── Vibración in/s RMS ───────────────────────────────────────
  if (/in\s?\/\s?s|inch\s?\/\s?s/.test(raw)) {
    if (/pk|pico|peak/.test(raw)) return "in pk-pk";
    return "in/s RMS";
  }

  // ── Vibración mm pk-pk ───────────────────────────────────────
  if (/mm.*pk|mm.*pico|mm.*peak/.test(raw)) return "mm pk-pk";

  // ── Vibración in pk-pk ───────────────────────────────────────
  if (/in.*pk|in.*pico|in.*peak/.test(raw)) return "in pk-pk";

  // ── Vibración genérica ───────────────────────────────────────
  if (/vibra|acele|rms/.test(raw)) return "mm/s RMS";

  // Sin coincidencia: devolver el valor tal cual (en mayúsculas)
  return input.trim();
}

type Medicion = {
  id: string;
  numero: number;
  valor: string | number;
  unidades: string;
};

type StepperStep = 1 | 2;

export function HandyRegClient() {
  const [currentStep, setCurrentStep] = useState<StepperStep>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos cargados del API
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [componentes, setComponentes] = useState<Componente[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tareasSismac, setTareasSismac] = useState<TareasSismac[]>([]);
  const [loadingTareas, setLoadingTareas] = useState(false);
  const [mostrarTodosEquipos, setMostrarTodosEquipos] = useState(false);

  // Selecciones del usuario
  const [selectedEquipo, setSelectedEquipo] = useState<string | null>(null);
  const [selectedComponente, setSelectedComponente] = useState<string | null>(null);
  const [selectedTarea, setSelectedTarea] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Función para generar clave única de tarea (ID_COMP + TIPO_MTO + TIPO_TAREA + ID_TAREA)
  const getTareaKey = (tarea: TareasSismac): string => {
    return `${tarea.ID_COMP}|${tarea.TIPO_MTO}|${tarea.TIPO_TAREA}|${tarea.ID_TAREA}`;
  };

  // Tabla de mediciones
  const [mediciones, setMediciones] = useState<Medicion[]>([
    { id: "1", numero: 1, valor: "", unidades: "" },
  ]);
  const [fechaEvento, setFechaEvento] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [fechaFinEvento, setFechaFinEvento] = useState<string>("");
  const [ot, setOt] = useState<string>("");
  const [estado, setEstado] = useState("A");

  // Estados para control de trabajo
  const [trabajoIniciado, setTrabajoIniciado] = useState(false);
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0);

  // Estados para modal de confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [registrosToConfirm, setRegistrosToConfirm] = useState<Registros[]>([]);

  // Estados para vista de registros
  const [registrosHistorico, setRegistrosHistorico] = useState<Registros[]>([]);
  const [showFormulario, setShowFormulario] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5); // Número de grupos por página

  const { toast } = useToast();

  // Función para agrupar registros por OT y calcular tiempo utilizado
  const obtenerRegistrosAgrupados = () => {
    const agrupados: { [key: string]: Registros[] } = {};
    
    // Agrupar por OT
    registrosHistorico.forEach((registro: Registros) => {
      const ot = registro.OT || "Sin OT";
      if (!agrupados[ot]) {
        agrupados[ot] = [];
      }
      agrupados[ot].push(registro);
    });

    // Convertir a array de grupos
    return Object.entries(agrupados).map(([ot, registros]) => {
      const primerRegistro = registros[0];
      
      // Calcular tiempo utilizado
      let tiempoUtilizado = "N/A";
      if (primerRegistro.fecha_inicio_evento && primerRegistro.fecha_fin_evento) {
        const inicio = new Date(typeof primerRegistro.fecha_inicio_evento === 'string' 
          ? primerRegistro.fecha_inicio_evento 
          : primerRegistro.fecha_inicio_evento);
        const fin = new Date(typeof primerRegistro.fecha_fin_evento === 'string' 
          ? primerRegistro.fecha_fin_evento 
          : primerRegistro.fecha_fin_evento);
        
        const diferenciaMilisegundos = fin.getTime() - inicio.getTime();
        const segundos = Math.floor(diferenciaMilisegundos / 1000);
        const minutos = Math.floor(segundos / 60);
        const horas = Math.floor(minutos / 60);
        const minutosRestantes = minutos % 60;
        
        tiempoUtilizado = `${horas}h ${minutosRestantes}m`;
      }
      
      return {
        ot,
        registros,
        primerRegistro,
        tiempoUtilizado,
      };
    });
  };

  // Timer para trabajo en progreso
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (trabajoIniciado) {
      interval = setInterval(() => {
        setTiempoTranscurrido((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [trabajoIniciado]);

  // Cargar equipos, componentes, areas y registros históricos
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [equiposRes, componentesRes, areasRes, mostrarTodos] = await Promise.all([
          equipoService.getAll(),
          componenteService.getAll(),
          areaService.getAll(),
          checkMostrarTodosEquipos(),
        ]);
        setEquipos(equiposRes.data || []);
        setComponentes(componentesRes.data || []);
        setAreas(areasRes.data || []);
        setMostrarTodosEquipos(mostrarTodos);

        // Consulta exploratoria: 10,000 registros
        const pageSize = 10000;
        let allRegistros: Registros[] = [];
        let page = 1;
        let totalRegistros = 0;

        // Primera consulta exploratoria
        const firstPageRes = await registrosService.getAll(page, pageSize);
        allRegistros = [...firstPageRes.data || []];
        totalRegistros = firstPageRes.total || 0;

        // Si hay más registros, traer el resto
        if (totalRegistros > pageSize) {
          const totalPages = Math.ceil(totalRegistros / pageSize);
          for (let p = 2; p <= totalPages; p++) {
            const pageRes = await registrosService.getAll(p, pageSize);
            allRegistros = [...allRegistros, ...(pageRes.data || [])];
          }
        }

        setRegistrosHistorico(allRegistros);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al cargar datos";
        setError(msg);
        toast({ title: "Error", description: msg, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [toast]);

  // Función para obtener registros agrupados y paginados
  const obtenerRegistrosPaginados = () => {
    const todosLosGrupos = obtenerRegistrosAgrupados();
    const totalPages = Math.ceil(todosLosGrupos.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const gruposPaginados = todosLosGrupos.slice(startIndex, endIndex);
    
    return {
      grupos: gruposPaginados,
      totalGrupos: todosLosGrupos.length,
      totalPages,
      currentPage,
    };
  };

  // Filtrar componentes por equipo seleccionado
  const componentesFiltrados = selectedEquipo
    ? componentes.filter((c) => c.codigo_equipo === selectedEquipo)
    : [];

  // Regional del usuario en sesión (UIO -> 1000, GYE -> 2000)
  const localidadUsuario = typeof window !== 'undefined' ? sessionStorage.getItem('usuario_localidad') : null;
  const regionalUsuario = localidadUsuario === 'GYE' ? 2000 : 1000;

  // Códigos de área que pertenecen a la regional del usuario
  const codigosAreaRegional = new Set(
    areas
      .filter(a => Number(a.regional) === regionalUsuario && a.estado === 'A')
      .map(a => String(a.codigo_area))
  );

  // Filtrar equipos que admiten registros manuales Y pertenecen a la regional del usuario
  // (si mostrarTodosEquipos, se omite el filtro regional)
  const equiposFiltrados = equipos.filter(
    (e) => e.admite_registros_manuales === true &&
      (mostrarTodosEquipos || codigosAreaRegional.has(String(e.codigo_area)))
  );

  // Helper: etiqueta de regional a partir del área
  const getRegionalLabel = (area: Area | null | undefined): string => {
    if (!area) return '';
    if (Number(area.regional) === 1000) return 'Quito';
    if (Number(area.regional) === 2000) return 'Guayaquil';
    return String(area.regional);
  };

  // Obtener el nombre del equipo seleccionado
  const equipoSeleccionado = equipos.find((e) => e.codigo_equipo === selectedEquipo);
  const componenteSeleccionado = componentes.find(
    (c) => c.codigo_componente === selectedComponente
  );

  // Obtener el área del equipo seleccionado
  const areaSeleccionada = equipoSeleccionado
    ? areas.find((a) => a.codigo_area === equipoSeleccionado.codigo_area)
    : null;

  // Cargar tareas programadas cuando se selecciona un área
  useEffect(() => {
    if (!areaSeleccionada?.nombre_area) {
      setTareasSismac([]);
      return;
    }

    const loadTareas = async () => {
      try {
        setLoadingTareas(true);
        
        // Calcular fechas: hoy y hoy + 2 días
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        const fechaFin = new Date();
        fechaFin.setDate(fechaFin.getDate() + 2);
        fechaFin.setHours(23, 59, 59, 999);

        const resultado = await serviciosService.getTareasSismacProgramadasPorAreaEIntervaloFechas(
          areaSeleccionada.nombre_area,
          hoy,
          fechaFin
        );

        setTareasSismac(resultado.data || []);
      } catch (err) {
        console.error("Error al cargar tareas:", err);
        setTareasSismac([]);
      } finally {
        setLoadingTareas(false);
      }
    };

    loadTareas();
  }, [areaSeleccionada]);

  // Filtrar tareas según el término de búsqueda
  const tareasFiltradas = tareasSismac.filter((tarea) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      tarea.TAREA.toLowerCase().includes(searchLower) ||
      tarea.MAQUINA.toLowerCase().includes(searchLower) ||
      tarea.COMPONENTE.toLowerCase().includes(searchLower) ||
      tarea.TIPO_MTO.toLowerCase().includes(searchLower) ||
      (tarea.TECNICO && tarea.TECNICO.toLowerCase().includes(searchLower))
    );
  });

  // Propiedades del componente seleccionado (para determinar unidades típicas - opcional)
  const handleAddMedicion = () => {
    const newId = String(Math.max(...mediciones.map((m) => parseInt(m.id)), 0) + 1);
    const newMedicion: Medicion = {
      id: newId,
      numero: mediciones.length + 1,
      valor: "",
      unidades: mediciones[0]?.unidades || "",
    };
    setMediciones([...mediciones, newMedicion]);
  };

  const handleRemoveMedicion = (id: string) => {
    if (mediciones.length === 1) {
      toast({
        title: "Información",
        description: "Debe mantener al menos una medición",
        variant: "default",
      });
      return;
    }
    // Filtrar la medición eliminada
    const nuevasMediciones = mediciones.filter((m) => m.id !== id);
    
    // Re-numerar todas las mediciones
    const renumeradas = nuevasMediciones.map((m, idx) => ({
      ...m,
      numero: idx + 1,
    }));
    
    setMediciones(renumeradas);
  };

  const handleMedicionChange = (
    id: string,
    field: keyof Medicion,
    value: string | number
  ) => {
    let sanitized: string | number = value;
    if (field === "unidades") {
      sanitized = String(value).toUpperCase().replace(/[^A-Z]/g, "");
    } else if (field === "numero") {
      sanitized = parseInt(String(value)) || 0;
    }
    setMediciones(
      mediciones.map((m) =>
        m.id === id ? { ...m, [field]: sanitized } : m
      )
    );
  };

  const handleNextStep = () => {
    if (!selectedEquipo) {
      setError("Debes seleccionar una máquina");
      return;
    }
    if (!selectedComponente) {
      setError("Debes seleccionar un componente");
      return;
    }
    setError(null);
    setCurrentStep(2);
  };

  const handlePrevStep = () => {
    setCurrentStep(1);
    setError(null);
    setSelectedTarea(null);
    setSearchTerm("");
    setOt("");
  };

  const handleIniciarTrabajo = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const fechaInicio = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    setFechaEvento(fechaInicio);
    setTrabajoIniciado(true);
    setTiempoTranscurrido(0);
  };

  const handleFinalizarTrabajo = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const fechaFin = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    setFechaFinEvento(fechaFin);
    setTrabajoIniciado(false);

    // Validar que una tarea esté seleccionada
    if (!selectedTarea) {
      setError("Debes seleccionar una tarea programada");
      return;
    }

    // Validar mediciones
    for (const med of mediciones) {
      const valorNumerico = parseFloat(String(med.valor));
      if (!med.valor || valorNumerico === 0 || isNaN(valorNumerico)) {
        setError(`Medición ${med.numero}: El valor es requerido y debe ser mayor que 0`);
        return;
      }
      if (!med.unidades.trim()) {
        setError(`Medición ${med.numero}: Las unidades son requeridas`);
        return;
      }
    }

    // Preparar registros y mostrar modal
    const registros = prepareRegistrosToSave();
    setRegistrosToConfirm(registros);
    setShowConfirmModal(true);
  };

  const formatearTiempo = (segundos: number) => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(segs).padStart(2, "0")}`;
  };

  // Función auxiliar para preparar registros sin guardarlos
  const prepareRegistrosToSave = (): Registros[] => {
    const registrosToSave = mediciones.map(
      (med): Registros => {
        let fechaInicioISO = "2026-01-01T00:00:00";
        if (fechaEvento) {
          const fecha = new Date(fechaEvento);
          fecha.setHours(fecha.getHours() - 5);
          fechaInicioISO = fecha.toISOString().split('.')[0] + ".000";
        } else {
          const ahora = new Date();
          ahora.setHours(ahora.getHours() - 5);
          fechaInicioISO = ahora.toISOString().split('.')[0] + ".000";
        }

        let fechaFinISO = "2026-01-01T00:00:00";
        if (fechaFinEvento) {
          const fechaFin = new Date(fechaFinEvento);
          fechaFin.setHours(fechaFin.getHours() - 5);
          fechaFinISO = fechaFin.toISOString().split('.')[0] + ".000";
        } else {
          // Si no hay fecha fin, usar la fecha actual
          const ahora = new Date();
          ahora.setHours(ahora.getHours() - 5);
          fechaFinISO = ahora.toISOString().split('.')[0] + ".000";
        }
        
        const ahora = new Date();
        ahora.setHours(ahora.getHours() - 5);
        const fechaCreacionISO = ahora.toISOString().split('.')[0] + ".000";
        
        return {
          codigo_registro: "0",
          codigo_componente: selectedComponente!,
          OT: ot,
          medicion: med.numero,
          valor: parseFloat(String(med.valor)),
          unidades: normalizarUnidad(med.unidades),
          fecha_inicio_evento: fechaInicioISO,
          fecha_fin_evento: fechaFinISO,
          usuario_creacion: sessionStorage.getItem('usuario_codigo') || sessionStorage.getItem('usuario_nombre') || "No Definido",
          fecha_creacion: fechaCreacionISO,
          estado: estado,
        };
      }
    );
    return registrosToSave;
  };

  const handleConfirmSave = async () => {
    try {
      setSaving(true);
      
      // Enviar todos los registros
      for (const registro of registrosToConfirm) {
        await registrosService.save(registro);
      }

      toast({
        title: "Éxito",
        description: `${registrosToConfirm.length} registro(s) guardado(s) correctamente`,
        variant: "success",
      });

      // Actualizar historial
      setRegistrosHistorico([...registrosHistorico, ...registrosToConfirm]);

      // Reset
      setShowConfirmModal(false);
      setRegistrosToConfirm([]);
      setCurrentStep(1);
      setSelectedEquipo(null);
      setSelectedComponente(null);
      setSelectedTarea(null);
      setSearchTerm("");
      setMediciones([{ id: "1", numero: 1, valor: "", unidades: "" }]);
      setFechaEvento(new Date().toISOString().slice(0, 16));
      setFechaFinEvento("");
      setOt("");
      setEstado("A");
      setTrabajoIniciado(false);
      setTiempoTranscurrido(0);
      setShowFormulario(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al guardar";
      setError(errorMessage);
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    // Validar que una tarea esté seleccionada
    if (!selectedTarea) {
      setError("Debes seleccionar una tarea programada");
      return;
    }

    // Validar mediciones
    for (const med of mediciones) {
      const valorNumerico = parseFloat(String(med.valor));
      if (!med.valor || valorNumerico === 0 || isNaN(valorNumerico)) {
        setError(`Medición ${med.numero}: El valor es requerido y debe ser mayor que 0`);
        return;
      }
      if (!med.unidades.trim()) {
        setError(`Medición ${med.numero}: Las unidades son requeridas`);
        return;
      }
    }

    try {
      setSaving(true);

      // Preparar registros usando la función auxiliar
      const registrosToSave = prepareRegistrosToSave();

      // Enviar todos los registros
      for (const registro of registrosToSave) {
        await registrosService.save(registro);
      }

      toast({
        title: "Éxito",
        description: `${registrosToSave.length} registro(s) guardado(s) correctamente`,
        variant: "success",
      });

      // Actualizar historial
      setRegistrosHistorico([...registrosHistorico, ...registrosToSave]);

      // Reset
      setCurrentStep(1);
      setSelectedEquipo(null);
      setSelectedComponente(null);
      setSelectedTarea(null);
      setSearchTerm("");
      setMediciones([{ id: "1", numero: 1, valor: "", unidades: "" }]);
      setFechaEvento(new Date().toISOString().slice(0, 16));
      setFechaFinEvento("");
      setOt("");
      setEstado("A");
      setTrabajoIniciado(false);
      setTiempoTranscurrido(0);
      setShowFormulario(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al guardar";
      setError(errorMessage);
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  const steps = [
    {
      number: 1,
      title: "Máquina y Componente",
      description: "Selecciona máquina",
    },
    {
      number: 2,
      title: "Mediciones",
      description: "Registra mediciones",
    },
  ];

  // Vista de Historial de Registros
  if (registrosHistorico.length > 0 && !showFormulario) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historial de Registros</CardTitle>
                <p className="text-sm text-gray-600 mt-2">Total: {registrosHistorico.length} registro(s) | Agrupado por OT: {obtenerRegistrosAgrupados().length} grupo(s)</p>
              </div>
              <Button onClick={() => setShowFormulario(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Registro
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">OT</th>
                      <th className="px-4 py-3 text-left font-medium">Equipo</th>
                      <th className="px-4 py-3 text-left font-medium">Componente</th>
                      <th className="px-4 py-3 text-left font-medium">Mediciones</th>
                      <th className="px-4 py-3 text-left font-medium">Fecha Inicio</th>
                      <th className="px-4 py-3 text-left font-medium">Fecha Fin</th>
                      <th className="px-4 py-3 text-left font-medium">Tiempo Utilizado</th>
                      <th className="px-4 py-3 text-left font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {obtenerRegistrosPaginados().grupos.map((grupo, idx) => {
                      // Obtener datos del componente
                      const componente = componentes.find(c => c.codigo_componente === grupo.primerRegistro.codigo_componente);
                      // Obtener datos del equipo a través del componente
                      const equipo = equipos.find(e => e.codigo_equipo === componente?.codigo_equipo);
                      
                      return (
                        <tr key={idx} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-blue-600">{grupo.ot}</td>
                          <td className="px-4 py-3">{equipo?.nombre_equipo || "N/A"}</td>
                          <td className="px-4 py-3">{componente?.nombre_componente || grupo.primerRegistro.codigo_componente}</td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              {grupo.registros.map((reg, regIdx) => (
                                <div key={regIdx} className="text-xs bg-blue-50 px-2 py-1 rounded">
                                  {reg.valor} {reg.unidades}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">{typeof grupo.primerRegistro.fecha_inicio_evento === 'string' ? grupo.primerRegistro.fecha_inicio_evento : new Date(grupo.primerRegistro.fecha_inicio_evento).toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs">{typeof grupo.primerRegistro.fecha_fin_evento === 'string' ? grupo.primerRegistro.fecha_fin_evento : new Date(grupo.primerRegistro.fecha_fin_evento).toLocaleString()}</td>
                          <td className="px-4 py-3 font-medium text-green-600">{grupo.tiempoUtilizado}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              grupo.primerRegistro.estado === "A"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}>
                              {grupo.primerRegistro.estado === "A" ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Controles de Paginación */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Items per page:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={(val) => {
                    setItemsPerPage(parseInt(val));
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger className="w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="15">15</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-sm text-gray-600">
                  {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, obtenerRegistrosPaginados().totalGrupos)} of {obtenerRegistrosPaginados().totalGrupos}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1 || loading}
                    title="Primera página"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || loading}
                    title="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, obtenerRegistrosPaginados().totalPages))}
                    disabled={currentPage === obtenerRegistrosPaginados().totalPages || loading || obtenerRegistrosPaginados().totalPages === 0}
                    title="Siguiente página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(obtenerRegistrosPaginados().totalPages)}
                    disabled={currentPage === obtenerRegistrosPaginados().totalPages || loading || obtenerRegistrosPaginados().totalPages === 0}
                    title="Última página"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // PASO 1: Seleccionar Equipo y Componente (o mostrar formulario si no hay registros)
  if (currentStep === 1) {
    return (
      <div className="flex gap-0 min-h-screen">
        {/* Stepper Lateral */}
        <div className="sticky top-0 h-screen w-80 bg-white border-r border-gray-200 p-8 flex flex-col">
          <h2 className="text-2xl font-bold mb-8">Registrar Evento</h2>
          
          <div className="flex-1">
            {steps.map((step, idx) => (
              <div key={step.number} className="flex flex-col">
                {/* Círculo del paso */}
                <div className="flex items-start gap-4">
                  {/* Círculo numerado */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                        currentStep >= step.number
                          ? "bg-blue-500 text-white"
                          : "bg-gray-300 text-gray-600"
                      }`}
                    >
                      {step.number}
                    </div>
                    {/* Línea conectora */}
                    {idx < steps.length - 1 && (
                      <div
                        className={`w-1 h-16 mt-2 ${
                          currentStep > step.number
                            ? "bg-blue-500"
                            : "bg-gray-300"
                        }`}
                      />
                    )}
                  </div>

                  {/* Información del paso */}
                  <div className="pt-2">
                    <p
                      className={`font-semibold text-sm ${
                        currentStep === step.number
                          ? "text-blue-600"
                          : currentStep > step.number
                          ? "text-gray-600"
                          : "text-gray-400"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 bg-gray-50 p-8 overflow-auto">
          <div className="w-full">
            <Card>
              <CardHeader>
                <CardTitle>Selecciona Máquina y Componente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Selección de Máquinas */}
                <div>
                  <Label className="text-base font-semibold mb-3 block">
                    Selecciona una Máquina
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {equiposFiltrados.length === 0 ? (
                      <p className="text-gray-500 col-span-full">
                        No hay máquinas disponibles para registros manuales
                      </p>
                    ) : (
                      equiposFiltrados.map((equipo) => (
                        <Card
                          key={equipo.codigo_equipo}
                          className={`cursor-pointer transition-all ${
                            selectedEquipo === equipo.codigo_equipo
                              ? "ring-2 ring-blue-500 bg-blue-50"
                              : "hover:shadow-md"
                          }`}
                          onClick={() => {
                            setSelectedEquipo(equipo.codigo_equipo);
                            setSelectedComponente(null);
                          }}
                        >
                          <CardContent className="pt-6">
                            <p className="font-medium text-sm">{equipo.nombre_equipo}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {equipo.codigo_equipo}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  equipo.estado === "A"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {equipo.estado === "A" ? "Activo" : "Inactivo"}
                              </span>
                              {(() => {
                                const area = areas.find(a => String(a.codigo_area) === String(equipo.codigo_area));
                                const label = getRegionalLabel(area);
                                return label ? (
                                  <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                    {label}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                {/* Selección de Componentes */}
                {selectedEquipo && (
                  <div>
                    <Label className="text-base font-semibold mb-3 block">
                      Selecciona un Componente
                    </Label>
                    {componentesFiltrados.length === 0 ? (
                      <Alert>
                        <AlertDescription>
                          No hay componentes disponibles para esta máquina
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {componentesFiltrados.map((componente) => (
                          <Card
                            key={componente.codigo_componente}
                            className={`cursor-pointer transition-all ${
                              selectedComponente === componente.codigo_componente
                                ? "ring-2 ring-green-500 bg-green-50"
                                : "hover:shadow-md"
                            }`}
                            onClick={() =>
                              setSelectedComponente(componente.codigo_componente)
                            }
                          >
                            <CardContent className="pt-6">
                              <p className="font-medium text-sm">
                                {componente.nombre_componente}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {componente.codigo_componente}
                              </p>
                              <div className="mt-3">
                                <span
                                  className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                    componente.estado === "A"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  {componente.estado === "A" ? "Activo" : "Inactivo"}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Resumen de selección */}
                {selectedEquipo && selectedComponente && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-6 space-y-2">
                      <p className="text-sm font-medium">
                        Regional: <span className="text-blue-700">{getRegionalLabel(areaSeleccionada)}</span>
                      </p>
                      <p className="text-sm font-medium">
                        Área: <span className="text-blue-700">{areaSeleccionada?.nombre_area}</span>
                      </p>
                      <p className="text-sm font-medium">
                        Máquina: <span className="text-blue-700">{equipoSeleccionado?.nombre_equipo}</span>
                      </p>
                      <p className="text-sm font-medium">
                        Componente: <span className="text-blue-700">{componenteSeleccionado?.nombre_componente}</span>
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Botones de navegación */}
                <div className="flex justify-between gap-3 pt-4">
                  <div className="flex gap-2">
                    {registrosHistorico.length > 0 && showFormulario && (
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowFormulario(false);
                        }}
                        className="border-gray-300"
                        type="button"
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Volver al Historial
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedEquipo(null);
                        setSelectedComponente(null);
                        setError(null);
                      }}
                    >
                      Limpiar
                    </Button>
                  </div>
                  <Button
                    onClick={handleNextStep}
                    disabled={!selectedEquipo || !selectedComponente}
                  >
                    Siguiente <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // PASO 2: Tabla de Mediciones
  return (
    <div className="flex gap-0 min-h-screen">
      {/* Stepper Lateral */}
      <div className="sticky top-0 h-screen w-80 bg-white border-r border-gray-200 p-8 flex flex-col">
        <h2 className="text-2xl font-bold mb-8">Registrar Evento</h2>
        
        <div className="flex-1">
          {steps.map((step, idx) => (
            <div key={step.number} className="flex flex-col">
              {/* Círculo del paso */}
              <div className="flex items-start gap-4">
                {/* Círculo numerado */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                      currentStep >= step.number
                        ? "bg-blue-500 text-white"
                        : "bg-gray-300 text-gray-600"
                    }`}
                  >
                    {step.number}
                  </div>
                  {/* Línea conectora */}
                  {idx < steps.length - 1 && (
                    <div
                      className={`w-1 h-16 mt-2 ${
                        currentStep > step.number
                          ? "bg-blue-500"
                          : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>

                {/* Información del paso */}
                <div className="pt-2">
                  <p
                    className={`font-semibold text-sm ${
                      currentStep === step.number
                        ? "text-blue-600"
                        : currentStep > step.number
                        ? "text-gray-600"
                        : "text-gray-400"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 bg-gray-50 p-8 overflow-auto">
        <div className="w-full">
          <Card>
            <CardHeader>
              <CardTitle>Registra Mediciones</CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Área: <span className="font-medium">{areaSeleccionada?.nombre_area}</span> | Máquina:{" "}
                <span className="font-medium">{equipoSeleccionado?.nombre_equipo}</span> | Componente:{" "}
                <span className="font-medium">{componenteSeleccionado?.nombre_componente}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Tabla de mediciones */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Mediciones</Label>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Medición</th>
                        <th className="px-4 py-3 text-left font-medium">Valor</th>
                        <th className="px-4 py-3 text-left font-medium">Unidades</th>
                        <th className="px-4 py-3 text-left font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mediciones.map((medicion, idx) => (
                        <tr key={medicion.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 text-center font-bold text-lg text-blue-600">
                            {numeroALetra(medicion.numero)}
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Requerido"
                              value={medicion.valor}
                              onChange={(e) =>
                                handleMedicionChange(medicion.id, "valor", e.target.value)
                              }
                              className="w-full"
                              disabled={saving || !trabajoIniciado}
                              required
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <Input
                                type="text"
                                placeholder="Ej: C, F, mm/s, g..."
                                value={medicion.unidades}
                                onChange={(e) =>
                                  handleMedicionChange(medicion.id, "unidades", e.target.value)
                                }
                                className="w-full"
                                disabled={saving || !trabajoIniciado}
                                required
                              />
                              {medicion.unidades.trim() && (
                                <p className="text-xs text-blue-600 font-medium">
                                  → {normalizarUnidad(medicion.unidades)}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 flex items-center gap-2">
                            {idx === mediciones.length - 1 ? (
                              <Button
                                size="sm"
                                onClick={handleAddMedicion}
                                disabled={saving || !trabajoIniciado}
                                style={{ backgroundColor: "#0055b6" }}
                                className="text-white hover:opacity-90"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMedicion(medicion.id)}
                                disabled={mediciones.length === 1 || saving || !trabajoIniciado}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Campos de Control */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ot">OT</Label>
                  <Input
                    id="ot"
                    type="text"
                    placeholder="Número de OT"
                    value={ot}
                    onChange={(e) => setOt(e.target.value)}
                    disabled={saving || trabajoIniciado}
                  />
                </div>

                {(trabajoIniciado || fechaFinEvento) && (
                  <div className="space-y-2">
                    <Label htmlFor="fecha_inicio">Fecha Inicio</Label>
                    <Input
                      id="fecha_inicio"
                      type="datetime-local"
                      value={fechaEvento}
                      onChange={(e) => setFechaEvento(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                )}

                {fechaFinEvento && (
                  <div className="space-y-2">
                    <Label htmlFor="fecha_fin">Fecha Fin</Label>
                    <Input
                      id="fecha_fin"
                      type="datetime-local"
                      value={fechaFinEvento}
                      onChange={(e) => setFechaFinEvento(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Select value={estado} onValueChange={setEstado} disabled={saving || trabajoIniciado}>
                    <SelectTrigger id="estado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Activo</SelectItem>
                      <SelectItem value="I">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tareas Programadas */}
              <div className="space-y-3 w-full">
                <Label className="text-base font-semibold">Tareas Programadas</Label>
                {loadingTareas ? (
                  <Card className="p-6 flex items-center justify-center w-full">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400 mr-2" />
                    <span className="text-gray-600">Cargando tareas...</span>
                  </Card>
                ) : tareasSismac.length === 0 ? (
                  <Card className="p-6 w-full">
                    <p className="text-gray-500 text-center">No hay tareas programadas</p>
                  </Card>
                ) : (
                  <div className="space-y-3 w-full">
                    {/* Búsqueda */}
                    <div className="relative w-full">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar por tarea, máquina, componente, tipo o técnico..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                        disabled={saving || !trabajoIniciado}
                      />
                    </div>

                    {/* Radio Group de Tareas */}
                    {tareasFiltradas.length === 0 ? (
                      <Card className="p-6 w-full">
                        <p className="text-gray-500 text-center">No hay tareas que coincidan con la búsqueda</p>
                      </Card>
                    ) : (
                      <RadioGroup 
                        value={selectedTarea || ""} 
                        onValueChange={(val) => {
                          setSelectedTarea(val);
                          const [compKey] = val.split('__'); // Extrae la parte antes de __
                          const tareaSeleccionada = tareasFiltradas.find(t => getTareaKey(t) === compKey);
                          if (tareaSeleccionada) {
                            setOt(tareaSeleccionada.OT_ULT.toString());
                          }
                        }}
                      >
                        <div className="space-y-2 max-h-96 overflow-y-auto w-full">
                          {tareasFiltradas.map((tarea, idx) => {
                            const tareaKey = getTareaKey(tarea);
                            const uniqueKey = `${tareaKey}__${idx}`;
                            return (
                              <Card
                                key={uniqueKey}
                                className={`p-4 cursor-pointer transition-all w-full ${
                                  !trabajoIniciado ? "pointer-events-none opacity-50" : ""
                                } ${
                                  selectedTarea?.startsWith(tareaKey)
                                    ? "ring-2 ring-blue-500 bg-blue-50 border-blue-200"
                                    : "bg-blue-50 border-blue-200 hover:shadow-md"
                                }`}
                                onClick={() => {
                                  setSelectedTarea(uniqueKey);
                                  setOt(tarea.OT_ULT.toString());
                                }}
                              >
                                <div className="flex gap-3">
                                  <RadioGroupItem value={uniqueKey} id={`tarea-${idx}`} className="mt-1" />
                                  <div className="flex-1">
                                    <label htmlFor={`tarea-${idx}`} className="cursor-pointer">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div>
                                          <p className="font-semibold text-blue-900">{tarea.TAREA}</p>
                                          <p className="text-gray-600">Máquina: {tarea.MAQUINA}</p>
                                        </div>
                                        <div>
                                          <p className="text-gray-600">Componente: {tarea.COMPONENTE}</p>
                                          <p className="text-gray-600">Frecuencia: {tarea.FRECUENCIA} días</p>
                                        </div>
                                        <div>
                                          <p className="text-gray-600">Tipo: {tarea.TIPO_MTO}</p>
                                          <p className="text-gray-600">Programada: {new Date(tarea.FECHA_PRO).toLocaleDateString()}</p>
                                        </div>
                                        <div>
                                          <p className="text-gray-600">Técnico: {tarea.TECNICO || "No asignado"}</p>
                                          <p className="text-gray-600">Tiempo est.: {tarea.TIEMPO} min</p>
                                        </div>
                                      </div>
                                    </label>
                                  </div>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      </RadioGroup>
                    )}
                  </div>
                )}
              </div>

              {/* Botones de navegación */}
              <div className="flex justify-between gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePrevStep();
                  }} 
                  disabled={saving || trabajoIniciado}
                  type="button"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Atrás
                </Button>
                {false && (
                  <Button onClick={handleSubmit} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Mediciones
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Botón Flotante para Iniciar/Finalizar Trabajo */}
          <div className="fixed bottom-8 right-8">
            {trabajoIniciado ? (
              <Button
                onClick={handleFinalizarTrabajo}
                className="rounded-full h-16 w-16 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white shadow-lg"
                title="Finalizar trabajo"
              >
                <div className="flex flex-col items-center justify-center">
                  <Square className="h-6 w-6" />
                  <span className="text-xs font-bold mt-1">{formatearTiempo(tiempoTranscurrido)}</span>
                </div>
              </Button>
            ) : (
              <Button
                onClick={handleIniciarTrabajo}
                className="rounded-full h-16 w-16 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white shadow-lg"
                title="Iniciar trabajo"
              >
                <Play className="h-6 w-6" />
              </Button>
            )}
          </div>

          {/* Modal de Confirmación de Guardado */}
          <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Confirmar Guardado
                </DialogTitle>
                <DialogDescription>
                  Se guardarán los siguientes registros
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded">
                  <div>
                    <p className="font-semibold text-gray-700">Máquina</p>
                    <p className="text-gray-600">{equipoSeleccionado?.nombre_equipo}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Componente</p>
                    <p className="text-gray-600">{componenteSeleccionado?.nombre_componente}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Número de OT</p>
                    <p className="text-gray-600">{ot || "No asignado"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Total de Mediciones</p>
                    <p className="text-gray-600">{registrosToConfirm.length}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Fecha Inicio</p>
                    <p className="text-gray-600">{fechaEvento}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Fecha Fin</p>
                    <p className="text-gray-600">{fechaFinEvento}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-gray-700">Mediciones a Crear:</p>
                  {registrosToConfirm.map((registro, idx) => (
                    <div key={idx} className="border rounded p-3 bg-blue-50">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-gray-600">Medición #{registro.medicion}</p>
                        </div>
                        <div>
                          <p className="font-semibold">{registro.valor} {registro.unidades}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            registro.estado === "A"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {registro.estado === "A" ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmSave}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Confirmar y Guardar
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

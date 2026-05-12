import { configuracionService } from "@/services/configuracion.service";

/**
 * Verifica si el usuario actual está en la configuración MOSTRAR_TODOS_EQUIPOS.
 * Los valores del config están separados por '&'.
 * Si el usuario está en la lista, debe ver todos los equipos sin filtro regional.
 */
export async function checkMostrarTodosEquipos(): Promise<boolean> {
  try {
    const usuarioCodigo =
      typeof window !== "undefined"
        ? sessionStorage.getItem("usuario_codigo")
        : null;

    if (!usuarioCodigo) return false;

    const resp = await configuracionService.getAll();
    const configs = Array.isArray(resp?.data) ? resp.data : [];
    const config = configs.find((c) => c.nombre_configuracion === "MOSTRAR_TODOS_EQUIPOS");
    const valor = config?.valor_configuracion || "";
    const codigos = valor
      .split("&")
      .map((c) => c.trim())
      .filter(Boolean);

    return codigos.includes(usuarioCodigo);
  } catch (e) {
    console.error("checkMostrarTodosEquipos error:", e);
    return false;
  }
}


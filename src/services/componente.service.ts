import type { Componente } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiURL}/api/componente`;

// `admite_registros_manuales` es un valor propio del componente, pero el
// backend todavía no tiene una columna dedicada en `componente` (solo existe
// en `equipo`). Mientras tanto, se prioriza un valor plano si el backend
// llega a devolverlo, y si no, se usa el de `equipo` como respaldo.
function withAdmiteRegistrosManuales(c: any): Componente {
  return {
    ...c,
    admite_registros_manuales: c?.admite_registros_manuales ?? c?.equipo?.admite_registros_manuales ?? undefined,
  };
}

export const componenteService = {
  async getAll(): Promise<BodyListResponse<Componente>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch componentes');
    }
    const body = await response.json();
    return { ...body, data: Array.isArray(body?.data) ? body.data.map(withAdmiteRegistrosManuales) : body?.data };
  },

  async getById(id: number | string): Promise<BodyResponse<Componente>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch componente with id ${id}`);
    }
    const body = await response.json();
    return { ...body, data: body?.data ? withAdmiteRegistrosManuales(body.data) : body?.data };
  },

  async save(data: Componente): Promise<BodyResponse<Componente>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save componente');
    }
    const body = await response.json();
    // Si el backend todavía no persiste `admite_registros_manuales` en el
    // componente, se conserva el valor que el usuario acaba de elegir para
    // que la tabla no lo "olvide" apenas se guarda.
    return {
      ...body,
      data: body?.data
        ? withAdmiteRegistrosManuales({ ...body.data, admite_registros_manuales: body.data.admite_registros_manuales ?? data.admite_registros_manuales })
        : body?.data,
    };
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete componente with id ${id}`);
    }
  },
};

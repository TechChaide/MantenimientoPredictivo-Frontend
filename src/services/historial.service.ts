import type { Historial } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiURL}/api/historial`;

export const historialService = {
  async getAll(): Promise<BodyListResponse<Historial>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch historiales');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Historial>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch historial with id ${id}`);
    }
    return response.json();
  },

  async save(data: Historial): Promise<BodyResponse<Historial>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save historial');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete historial with id ${id}`);
    }
  },


  async getTotalHistorialByComponenteYMaquina(Maquina: string, Componente: string): Promise<BodyResponse<any>> {
    const response = await fetch(API_URL + '/TotalHistorial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maquina: Maquina, componente: Componente }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save historial');
    }
    return response.json();
  },

  async getHistorialByComponenteCodigoYMAquina(Maquina: string, Componente: string, pagina: number, limite: number): Promise<BodyListResponse<Historial>> {
    const response = await fetch(API_URL + '/HistorialByComponenteMaquina', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maquina: Maquina, componente: Componente , page: pagina, limit: limite }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save historial');
    }
    return response.json();  },

};

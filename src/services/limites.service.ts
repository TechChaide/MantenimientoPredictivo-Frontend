import type { Limites } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiURL}/api/limites`;

export const limitesService = {
  async getAll(): Promise<BodyListResponse<Limites>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch limites');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Limites>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch limite with id ${id}`);
    }
    return response.json();
  },

  async getByComponentId(params: { codigo_componente: string }): Promise<BodyListResponse<Limites>> {
    const queryParams = new URLSearchParams();
    queryParams.append('codigo_componente', params.codigo_componente);
    const response = await fetch(`${API_URL}?${queryParams.toString()}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch limites for component ${params.codigo_componente}`);
    }
    return response.json();
  },

  async save(data: Limites): Promise<BodyResponse<Limites>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save limite');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete limite with id ${id}`);
    }
  },
};

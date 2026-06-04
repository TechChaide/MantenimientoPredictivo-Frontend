import type { Detalles } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiURL}/api/detalles`;

export const detallesService = {
  async getAll(page: number = 1, pageSize: number = 10000): Promise<BodyListResponse<Detalles>> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());

    const response = await fetch(`${API_URL}?${params.toString()}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch detalles');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Detalles>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch detalle with id ${id}`);
    }
    return response.json();
  },

  async save(data: Detalles): Promise<BodyResponse<Detalles>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save detalle');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete detalle with id ${id}`);
    }
  },

  async getByRegistro(codigoRegistro: string | number): Promise<BodyListResponse<Detalles>> {
    const params = new URLSearchParams();
    params.append('codigo_registro', codigoRegistro.toString());

    const response = await fetch(`${API_URL}?${params.toString()}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch detalles for registro ${codigoRegistro}`);
    }
    return response.json();
  },
};

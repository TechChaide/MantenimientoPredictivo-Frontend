import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiURL}/api/configuracion`;

export const configuracionService = {
  async getAll(): Promise<{ data: { codigo_configuracion: number; nombre_configuracion: string; valor_configuracion: string }[] }> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch configuraciones');
    }
    return response.json();
  },

  async getByNombre(nombre: string): Promise<{ data: { codigo_configuracion: number; nombre_configuracion: string; valor_configuracion: string } | null }> {
    const response = await fetch(`${API_URL}/${nombre}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch configuracion ${nombre}`);
    }
    return response.json();
  },
};

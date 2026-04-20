import type { Limites, TareasSismac } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiURL}/api/servicios`;

export const serviciosService = {

  async getTareasSismacProgramadasPorAreaEIntervaloFechas(Area: string, FechaInicio: Date, FechaFin: Date): Promise<BodyResponse<TareasSismac[]>> {
    const response = await fetch(API_URL + '/sismacSchedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Area: Area, FechaInicio: FechaInicio, FechaFin: FechaFin }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save limite');
    }
    return response.json();
  },


};

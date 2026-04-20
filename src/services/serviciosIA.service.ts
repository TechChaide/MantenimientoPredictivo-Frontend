import type { Limites } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiURL}/api/serviciosAI`;

export const serviciosIAService = {

  async prediccionesProphet(maquina: string, componente: string, dias_prediccion: number, motor : 'prophet'): Promise<BodyResponse<Limites>> {
    const response = await fetch(API_URL + '/predicciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maquina: maquina, componente: componente, dias_prediccion: dias_prediccion, motor: motor }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save limite');
    }
    return response.json();
  },

  async prediccionesMonteCarlo(maquina: string, componente: string, dias_prediccion: number, motor : 'montecarlo'): Promise<BodyResponse<Limites>> {
    const response = await fetch(API_URL + '/predicciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maquina: maquina, componente: componente, dias_prediccion: dias_prediccion, motor: motor }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save limite');
    }
    return response.json();
  },


};

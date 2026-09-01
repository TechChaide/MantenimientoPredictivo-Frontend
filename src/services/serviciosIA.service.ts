import type { Limites } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiURL}/api/serviciosAI`;

// La API de predicciones acepta como máximo 90 días (antes 365); pedir más
// devuelve 422. Se limita acá para no depender de que cada llamador lo recuerde.
const DIAS_PREDICCION_MAX = 90;

export const serviciosIAService = {

  async prediccionesProphet(maquina: string, componente: string, dias_prediccion: number, motor : 'prophet'): Promise<BodyResponse<Limites>> {
    const response = await fetch(API_URL + '/predicciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maquina: maquina, componente: componente, dias_prediccion: Math.min(dias_prediccion, DIAS_PREDICCION_MAX), motor: motor }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save limite');
    }
    // La respuesta también trae `entrenado_en` (ISO 8601 | null): fecha de
    // entrenamiento del modelo servido. BodyResponse permite leerlo sin tipar de más.
    return response.json();
  },

  async prediccionesMonteCarlo(maquina: string, componente: string, dias_prediccion: number, motor : 'montecarlo'): Promise<BodyResponse<Limites>> {
    const response = await fetch(API_URL + '/predicciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maquina: maquina, componente: componente, dias_prediccion: Math.min(dias_prediccion, DIAS_PREDICCION_MAX), motor: motor }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save limite');
    }
    return response.json();
  },


};

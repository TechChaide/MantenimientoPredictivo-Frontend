

import { environment } from "@/environments/environments.prod";
import type { BodyListResponse } from "@/types/body-list-response";
import { BodyResponse } from "@/types/body-response";

// --- CONFIGURACIÓN CENTRAL DE LA API ---
// URL base del servidor de la API. Todas las peticiones se dirigirán aquí.
const API_URL = `${environment.apiURL}/api/CalculosCorrientesDatosMantenimiento`;
// Token de autorización fijo que se envía en cada petición para autenticar la aplicación.
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImludGVsaWdlbnRpYSIsImlhdCI6MTcyMTM0NjQzMiwiZXhwIjoxNzMyODgyNDMyfQ.5Z5aQj1fG4f4i-rL8p3g4n-X_VwE-b-T9tC2a1iH3xY";

// --- INTERFACES DE PARÁMETROS PARA LAS FUNCIONES ---
// Definen qué datos necesita cada función para hacer su llamada a la API.

interface GetDataByMaquinaParams {
  maquina: string;
  page?: number;
  limit?: number;
}

interface GetDataByDateRangeParams {
  maquina: string;
  fecha_inicio: string;
  fecha_fin: string;
  page?: number;
  limit?: number;
}

interface GetDataByDateRangeParamsAndComponent {
  maquina: string;
  componente: string;
  fecha_inicio: string;
  fecha_fin: string;
  page?: number;
  limit?: number;
}

interface GetComponentsByMachineParams {
  maquina: string;
  page?: number;
  limit?: number;
}

interface GetDeviationsyMachineParams {
  Maquina: string;
  Componente: string;
  FechaInicio: string;
  FechaFin: string;
}

interface GetAllParams {
  page?: number;
  limit?: number;
}

interface GetDataCrudaByDateRangeParamsAndComponent {
  Maquina: string;
  Componente: string;
  FechaInicio: string;
  FechaFin: string;
  page?: number;
  limit?: number;
}

/**
 * Objeto que centraliza todas las funciones para interactuar con la API de mantenimiento.
 * Cada función corresponde a un endpoint específico de la API.
 */
export const calculosCorrientesDatosMantenimientoService = {

  /**
   * Obtiene el número total de registros para una máquina específica.
   * Usado para calcular la paginación.
   * @param maquina - El nombre de la máquina.
   * @returns Una promesa que resuelve al número total de registros.
   */
  async getTotalByMaquina(maquina: string): Promise<{ total: number }> {
    const response = await fetch(API_URL + '/totalByMaquina', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ maquina }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Obtiene el número total de registros para una combinación de máquina, componente y rango de fechas.
   * Esencial para la paginación de los datos de los gráficos.
   * @param maquina - El nombre de la máquina.
   * @param componente - El nombre del componente.
   * @param fecha_inicio - Fecha de inicio del rango (formato YYYY-MM-DD).
   * @param fecha_fin - Fecha de fin del rango (formato YYYY-MM-DD).
   * @returns Una promesa que resuelve al número total de registros.
   */
  async getTotalByMaquinaAndComponente(maquina: string, componente: string, fecha_inicio: string, fecha_fin: string): Promise<{ total: number }> {
    const response = await fetch(API_URL + '/totalByMaquinaAndComponente', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ maquina, componente, fecha_inicio, fecha_fin }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Obtiene datos paginados para una máquina específica.
   * @param params - Parámetros de la consulta, incluyendo la máquina y la paginación.
   * @returns Una lista paginada de registros.
   */
  async getDataByMaquina(params: GetDataByMaquinaParams): Promise<BodyListResponse<any>> {
    const requestBody = {
      maquina: params.maquina,
      page: params.page || 1,
      limit: params.limit || 100,
    };

    const response = await fetch(API_URL + '/dataByMaquina', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Obtiene datos paginados para una máquina dentro de un rango de fechas.
   * @param params - Parámetros incluyendo máquina, fechas y paginación.
   * @returns Una lista paginada de registros.
   */
  async getDataByMachineAndDates(params: GetDataByDateRangeParams): Promise<BodyListResponse<any>> {
    const requestBody = {
      maquina: params.maquina,
      fecha_inicio: params.fecha_inicio,
      fecha_fin: params.fecha_fin,
      page: params.page || 1,
      limit: params.limit || 100,
    };

    const response = await fetch(API_URL + '/dataByMachineAndDates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },


  /**
   * FUNCIÓN PRINCIPAL: Obtiene los datos detallados y paginados para los gráficos.
   * Se usa para rangos de fechas de hasta 1 año.
   * @param params - Parámetros incluyendo máquina, componente, fechas y paginación.
   * @returns Una lista paginada de registros detallados.
   */
  async getDataByMachineComponentAndDates(params: GetDataByDateRangeParamsAndComponent): Promise<BodyListResponse<any>> {
    const requestBody = {
      maquina: params.maquina,
      componente: params.componente,
      fecha_inicio: params.fecha_inicio,
      fecha_fin: params.fecha_fin,
      page: params.page || 1,
      limit: params.limit || 1000,
    };

    const response = await fetch(API_URL + '/machineComponentDates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Obtiene la lista de todas las máquinas disponibles para el menú de selección.
   * @param params - Parámetros opcionales de paginación.
   * @returns Una lista de máquinas.
   */
  async getMachines(params?: GetAllParams): Promise<BodyListResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await fetch(API_URL + '/machines?' + queryParams.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Obtiene los componentes asociados a una máquina específica para el submenú.
   * @param params - Parámetros que incluyen el nombre de la máquina.
   * @returns Una lista de componentes para la máquina dada.
   */
  async getComponentsByMachine(params: GetComponentsByMachineParams): Promise<BodyListResponse<any>> {
    const requestBody = {
      maquina: params.maquina,
      page: params.page || 1,
      limit: params.limit || 100,
    };

    const response = await fetch(API_URL + '/componentsByMachine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },




  async getDeviationsByMachineAndComponents(params: GetDeviationsyMachineParams): Promise<BodyListResponse<any>> {
    const requestBody = {
      Maquina: params.Maquina,
      Componente: params.Componente,
      FechaInicio: params.FechaInicio,
      FechaFin: params.FechaFin,
    };

    const response = await fetch(API_URL + '/getDeviations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },




    async getTodosRegistrosDataCruda(params: GetDataCrudaByDateRangeParamsAndComponent): Promise<BodyListResponse<any>> {
    const requestBody = {
      Maquina: params.Maquina,
      Componente: params.Componente,
      FechaInicio: params.FechaInicio,
      FechaFin: params.FechaFin,
      page: params.page || 1,
      limit: params.limit || 1000,
    };

    const response = await fetch(API_URL + '/dataRawByMachineComponentAndDates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

    async getTotalDataCrudaPorFechaComponenteEquipo(params: GetDeviationsyMachineParams): Promise<BodyListResponse<any>> {
    const requestBody = {
      Maquina: params.Maquina,
      Componente: params.Componente,
      FechaInicio: params.FechaInicio,
      FechaFin: params.FechaFin,
    };

    const response = await fetch(API_URL + '/totalDataRawByMachineComponentAndDates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido en el servidor' }));
      throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },
};

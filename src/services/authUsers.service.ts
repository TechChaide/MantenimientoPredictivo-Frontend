"use client";

import { environment } from "@/environments/environments.prod";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = environment.apiUsuariosURL;

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const error = new Error("An error occurred while fetching the data.");
    // Attach extra info to the error object.
    try {
      const errorInfo = await res.json();
      (error as any).info = errorInfo;
    } catch (e) {
      (error as any).info = { message: res.statusText };
    }
    (error as any).status = res.status;
    throw error;
  }
  return res.json();
}

export const authUsersService = {
  getAuthUser: (usuario: string, foto: Blob): Promise<any> => {
    const formData = new FormData();
    formData.append("codigo", usuario);
    formData.append("foto", foto, "foto.jpg");
    return fetcher<BodyListResponse<any>>(
      API_URL+"/validate_face",
      {
        method: "POST",
        body: formData,
      }
    );
  },
};

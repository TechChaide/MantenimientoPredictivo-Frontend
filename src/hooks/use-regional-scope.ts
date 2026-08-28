"use client";

import { useEffect, useState } from "react";
import { checkMostrarTodosEquipos } from "@/lib/mostrar-todos-equipos";
import type { Area } from "@/types/interfaces";

export function getRegionalFromLocalidad(localidad?: string | null): number {
  return localidad === "GYE" ? 2000 : 1000;
}

export function useRegionalScope() {
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [loading, setLoading] = useState(true);

  const localidad = typeof window !== "undefined" ? sessionStorage.getItem("usuario_localidad") : null;
  const regional = getRegionalFromLocalidad(localidad);

  useEffect(() => {
    let active = true;
    checkMostrarTodosEquipos().then((valor) => {
      if (active) {
        setMostrarTodos(valor);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return { regional, mostrarTodos, loading };
}

export function filterAreasByRegional(areas: Area[], regional: number, mostrarTodos: boolean): Area[] {
  if (mostrarTodos) return areas.filter((a) => a.estado === "A");
  return areas.filter((a) => Number(a.regional) === regional && a.estado === "A");
}

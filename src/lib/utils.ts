import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Deja solo dígitos y un separador decimal (coma o punto, normalizado a punto).
// Usar junto con <Input type="text" inputMode="decimal"> para campos netamente numéricos.
export function sanitizeDecimalInput(value: string): string {
  let v = value.replace(/[^0-9.,]/g, "").replace(",", ".");
  const parts = v.split(".");
  if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  return v;
}

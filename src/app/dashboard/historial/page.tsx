import { PageHeader } from "@/components/page-header";
import { HistorialClient } from "@/components/dashboard/historial-client";

export const metadata = {
  title: "Historial de Eventos | Dashboard",
  description: "Visualiza el historial de eventos de los componentes de tus equipos",
};

export default function HistorialPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Historial de Eventos"
        description="Consulta el historial de eventos de los componentes de tus equipos"
      />
      <HistorialClient />
    </div>
  );
}

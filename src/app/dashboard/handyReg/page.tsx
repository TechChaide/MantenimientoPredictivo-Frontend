import { PageHeader } from "@/components/page-header";
import { HandyRegClient } from "@/components/dashboard/handy-reg-client";

export const metadata = {
  title: "Registro de Eventos | Dashboard",
  description: "Registra nuevos eventos de mantenimiento de componentes",
};

export default function HandyRegPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro de Eventos"
        description="Registra nuevos eventos de medición y mantenimiento de componentes"
      />
      <HandyRegClient />
    </div>
  );
}

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

interface PageHeaderProps {
  title: string;
  description: string;
  backHref?: string;
  showBack?: boolean;
}

export function PageHeader({
  title,
  description,
  backHref = '/',
  showBack = true,
}: PageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-4">
        {/* {showBack && (
          <Button variant="outline" size="icon" asChild>
            <Link href={backHref}>
              <ArrowLeft className="w-5 h-5" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
        )} */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </header>
  );
}

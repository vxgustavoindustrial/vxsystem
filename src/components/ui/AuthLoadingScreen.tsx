
import { Hexagon } from "lucide-react";

export function AuthLoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-[9999]">
      <div className="relative flex items-center justify-center mb-6">
        {/* Camada de pulsaÃ§Ã£o externa */}
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 duration-1000 scale-150" />
        
        {/* Logo centralizado com rotaÃ§Ã£o sutil */}
        <div className="relative bg-card p-4 rounded-2xl shadow-xl dark:shadow-primary/5 border border-border">
          <Hexagon className="h-12 w-12 text-primary animate-pulse" />
        </div>
      </div>
      
      <div className="flex flex-col items-center space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground italic">VX INDUSTRIAL</h1>
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Sincronizando sistemas...</p>
      </div>
      
      {/* RodapÃ© sutil indicando infraestrutura segura */}
      <div className="absolute bottom-8 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
        Infraestrutura de Marketing Segura
      </div>
    </div>
  );
}


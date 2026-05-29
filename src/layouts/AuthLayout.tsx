
import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Efeitos de fundo decorativos */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full filter blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] bg-primary/8 rounded-full filter blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full filter blur-[150px]" />
      </div>

      {/* Grid pattern sutil */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Card central */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl shadow-2xl shadow-black/20 p-8 md:p-10">
          <Outlet />
        </div>

        {/* Rodapé sutil */}
        <p className="text-center text-[11px] text-muted-foreground/50 mt-6 font-medium tracking-wide">
          © {new Date().getFullYear()} VX Industrial — Plataforma de Onboarding
        </p>
      </div>
    </div>
  );
}

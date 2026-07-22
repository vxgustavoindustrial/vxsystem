import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { Loader2, Eye, EyeOff } from 'lucide-react';

import { toast } from 'sonner';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

const loginSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres" })
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Limpar qualquer lock/sessão travada ao montar a página de login
  useEffect(() => {
    try {
      // Limpar locks do GoTrue que podem ter ficado órfãos
      const lockKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('lock:sb-') || key.includes('-auth-token-code-verifier')
      );
      if (lockKeys.length > 0) {
        console.warn(`[Login] Removendo ${lockKeys.length} lock(s) travados:`, lockKeys);
        lockKeys.forEach(key => localStorage.removeItem(key));
      }
      
      // Forçar limpeza de tema se existir (evita conflito de cor invisível)
      if (localStorage.getItem('theme')) {
        localStorage.removeItem('theme');
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.error('[Login] Falha ao limpar locks:', e);
    }
  }, []);

  // Se o usuário já está autenticado (veio aqui por engano), redirecionar
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      if (!state.isLoading && state.user && state.profile) {
        const role = state.profile.role;
        if (role === 'admin' || role === 'member') {
          navigate('/admin', { replace: true });
        } else if (role === 'client') {
          navigate('/client', { replace: true });
        }
      }
    });
    
    // Verificação instantânea
    const state = useAuthStore.getState();
    if (!state.isLoading && state.user && state.profile) {
      const role = state.profile.role;
      if (role === 'admin' || role === 'member') {
        navigate('/admin', { replace: true });
      } else if (role === 'client') {
        navigate('/client', { replace: true });
      }
    }
    
    return unsub;
  }, [navigate]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormValues) => {
    console.log('[Login] Iniciando login:', data.email);
    setLoading(true);
    
    try {
      const { error, data: authData } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });

      if (error) {
        console.error('[Login] Erro Auth:', error.message);
        const errorMsg = error.message.includes('Invalid login credentials')
          ? 'Email ou senha incorretos.'
          : `Erro de autenticação: ${error.message}`;
        toast.error(errorMsg);
        setLoading(false);
        return;
      }

      console.log('[Login] Auth OK, buscando perfil...', authData.user?.id);

      if (authData.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();
          
        if (profileError) {
          console.error('[Login] Erro ao buscar perfil:', profileError);
          toast.error('Erro ao carregar perfil de usuário.');
          setLoading(false);
          return;
        }
        
        if (profile) {
          if (!profile.is_active) {
            toast.error('Sua conta está inativa. Entre em contato com o administrador.');
            await supabase.auth.signOut();
            useAuthStore.getState().clear();
            setLoading(false);
            return;
          }

          if (profile.client_id) {
            const { data: clientData } = await supabase
              .from('clients')
              .select('*')
              .eq('id', profile.client_id)
              .maybeSingle();
            
            if (clientData) {
              profile.client = clientData;
            }
          }
          // Pré-popular o store ANTES de navegar.
          // Isso garante que o ProtectedRoute não rejeite e
          // que o onAuthStateChange no App.tsx encontre o profile já setado.
          const store = useAuthStore.getState();
          store.setUser(authData.user);
          store.setProfile(profile);
          store.finishLoading();
          
          console.log('[Login] Perfil carregado. Role:', profile.role, '- Redirecionando...');
          
          if (profile.role === 'admin' || profile.role === 'member') {
            navigate('/admin', { replace: true });
          } else {
            navigate('/client', { replace: true });
          }
        } else {
          console.warn('[Login] Nenhum perfil encontrado para:', authData.user.id);
          toast.error('Nenhum perfil encontrado para este usuário.');
          await supabase.auth.signOut();
          useAuthStore.getState().clear();
        }
      }
    } catch (err) {
      console.error('[Login] Erro inesperado:', err);
      toast.error('Ocorreu um erro inesperado ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Logo / Branding */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mx-auto">
          <span className="text-2xl font-black bg-gradient-to-br from-primary to-amber-500 bg-clip-text text-transparent">
            VX
          </span>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Acessar Plataforma
          </h1>
          <p className="text-sm text-muted-foreground">
            Insira suas credenciais para entrar no painel
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Email
          </Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="seu@email.com" 
            className="h-11 rounded-xl bg-muted/50 border-border/80 focus-visible:ring-primary/40"
            {...register('email')} 
          />
          {errors.email && <p className="text-xs text-destructive font-medium">{errors.email.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Senha
          </Label>
          <div className="relative">
            <Input 
              id="password" 
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="h-11 rounded-xl bg-muted/50 border-border/80 focus-visible:ring-primary/40 pr-10"
              {...register('password')} 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive font-medium">{errors.password.message}</p>}
        </div>
        
        <Button 
          className="w-full h-11 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] transition-all duration-200" 
          type="submit" 
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Entrando...
            </span>
          ) : (
            'Entrar'
          )}
        </Button>
      </form>
    </div>
  );
}

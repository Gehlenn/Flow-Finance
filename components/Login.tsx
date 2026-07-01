import React, { useState } from 'react';
import { Mail, ArrowRight, Lock, AlertCircle, FlaskConical, UserPlus, ChevronLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import Logo from './Logo';
import { 
  auth, 
  googleProvider, 
  isFirebaseConfigured,
  signInWithPopup,
} from '../services/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  AuthProvider,
} from 'firebase/auth';
import { VISUAL_MOTION, VISUAL_SURFACES } from '../src/app/visualSystem';

interface LoginProps {
  onLogin: (email: string) => void;
  onDevelopmentLogin?: (credentials: { email: string; password: string }) => Promise<void>;
}

type AuthView = 'login' | 'signup' | 'recover' | 'success';

const IS_DEV = import.meta.env.DEV;
const ALLOW_INSECURE_LOCAL_LOGIN = import.meta.env.VITE_AUTH_ALLOW_INSECURE_LOCAL_LOGIN === 'true';

const Login: React.FC<LoginProps> = ({ onLogin, onDevelopmentLogin }) => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState<{code: string, message: string} | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const getFirebaseErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/configuration-not-found': return 'Autenticacao Firebase indisponivel neste ambiente. Configure as variaveis do frontend para habilitar login real.';
      case 'auth/email-already-in-use': return 'Este e-mail já está sendo utilizado.';
      case 'auth/weak-password': return 'A senha deve ter pelo menos 6 caracteres.';
      case 'auth/invalid-email': return 'O e-mail informado não é válido.';
      case 'auth/user-not-found': return 'Usuário não localizado.';
      case 'auth/wrong-password': return 'Senha incorreta. Tente novamente.';
      default: return 'Ocorreu um erro inesperado. Verifique os dados.';
    }
  };

  const getAuthDiagnostic = (code: string) => {
    switch (code) {
      case 'auth/configuration-not-found':
        return {
          title: 'Diagnóstico de autenticação',
          message: 'O login real depende das variáveis do Firebase no frontend ou do login local de desenvolvimento.',
          suggestion: 'Verifique VITE_FIREBASE_* no frontend ou habilite VITE_AUTH_ALLOW_INSECURE_LOCAL_LOGIN no ambiente local.',
        };
      case 'auth/local-login-failed':
        return {
          title: 'Diagnóstico de sessão local',
          message: 'O backend local rejeitou a autenticação insegura de desenvolvimento.',
          suggestion: 'Confirme se o backend está ativo, se a sessão dev foi carregada e se o login local está liberado.',
        };
      case 'auth/unauthorized-domain':
        return {
          title: 'Diagnóstico de domínio',
          message: 'O domínio atual não está autorizado no Firebase.',
          suggestion: 'Adicione o domínio na lista de Authorized Domains do projeto Firebase.',
        };
      default:
        return null;
    }
  };

  const getErrorCode = (error: unknown, fallback: string): string => {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: unknown }).code;
      if (typeof code === 'string' && code) {
        return code;
      }
    }
    return fallback;
  };

  const handleSocialLogin = async (provider: AuthProvider) => {
    if (!isFirebaseConfigured) {
      setError({ code: 'auth/configuration-not-found', message: getFirebaseErrorMessage('auth/configuration-not-found') });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user.email) {
        onLogin(result.user.email);
      }
    } catch (error: unknown) {
      setIsLoading(false);
      const code = getErrorCode(error, 'auth/social-login-failed');
      if (code === 'auth/unauthorized-domain' || !window.location.hostname) {
        setError({
          code: 'auth/unauthorized-domain',
          message: `Dominio nao autorizado no Firebase: ${window.location.hostname}. Adicione em Authentication > Settings > Authorized domains.`,
        });
      } else {
        setError({ code, message: getFirebaseErrorMessage(code) });
      }
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (!isFirebaseConfigured) {
      if (IS_DEV && ALLOW_INSECURE_LOCAL_LOGIN && onDevelopmentLogin) {
        setIsLoading(true);
        setError(null);
        try {
          await onDevelopmentLogin({ email, password });
          onLogin(email);
          return;
        } catch (error: unknown) {
          setIsLoading(false);
          const code = getErrorCode(error, 'auth/local-login-failed');
          setError({
            code,
            message: String(
              error && typeof error === 'object' && 'message' in error
                ? (error as { message?: unknown }).message
                : 'Falha ao autenticar no backend local.'
            ),
          });
          return;
        }
      }

      setError({ code: 'auth/configuration-not-found', message: getFirebaseErrorMessage('auth/configuration-not-found') });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin(email);
    } catch (error: unknown) {
      setIsLoading(false);
      const code = getErrorCode(error, 'auth/sign-in-failed');
      setError({ code, message: getFirebaseErrorMessage(code) });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;
    if (!isFirebaseConfigured) {
      setError({ code: 'auth/configuration-not-found', message: getFirebaseErrorMessage('auth/configuration-not-found') });
      return;
    }
    if (password.length < 6) {
      setError({ code: 'local/short-password', message: "A senha precisa de no mínimo 6 caracteres." });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      onLogin(email);
    } catch (error: unknown) {
      setIsLoading(false);
      const code = getErrorCode(error, 'auth/signup-failed');
      setError({ code, message: getFirebaseErrorMessage(code) });
    }
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!isFirebaseConfigured) {
      setError({ code: 'auth/configuration-not-found', message: getFirebaseErrorMessage('auth/configuration-not-found') });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage("Link enviado com sucesso!");
      setView('success');
    } catch (error: unknown) {
      setIsLoading(false);
      const code = getErrorCode(error, 'auth/reset-failed');
      setError({ code, message: getFirebaseErrorMessage(code) });
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#020617] flex flex-col items-center justify-between px-4 py-5 overflow-x-hidden transition-colors duration-500 relative text-slate-900 dark:text-white">

      <div className={`w-full max-w-[380px] flex flex-col flex-1 justify-between transition-all duration-700 relative z-10 ${isAnimating ? 'opacity-0 scale-95 blur-md' : 'opacity-100'}`}>
        
        <div className={VISUAL_MOTION.entrance}>
          <div className={`mx-auto flex w-full max-w-[340px] flex-col items-start ${VISUAL_SURFACES.workspace} px-5 py-5`}>
            <div className="mb-4 flex items-center gap-3">
              <div className="scale-[0.9] overflow-visible">
                <Logo size="sm" showText={false} />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Flow Finance</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace financeiro</p>
              </div>
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Revisao de caixa da semana
              </h1>
              <p className="max-w-[300px] text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                Acesse saldo confirmado, previsto e recebiveis antes de decidir pagamentos, cobrancas e prioridades.
              </p>
              <div className="grid w-full grid-cols-3 gap-2 pt-1">
                {['Caixa real', 'Previsto', 'Recebiveis'].map(item => (
                  <span key={item} className={`${VISUAL_SURFACES.interactiveCard} px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300`}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={`my-4 ${VISUAL_SURFACES.workspace} px-5 py-5`}>
          
          {error?.code === 'auth/unauthorized-domain' ? (
            <div className="animate-in slide-in-from-top-4 duration-500 space-y-3">
              <div className={`${VISUAL_SURFACES.section} p-4 space-y-2 text-center`}>
                <FlaskConical size={24} className="mx-auto text-slate-500" />
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-tight">
                  OAuth restrito. Use a demonstração segura para explorar o Flow.
                </p>
                <button 
                  onClick={() => {
                    setIsAnimating(true);
                    setTimeout(() => onLogin('teste@flow.com'), 400);
                  }}
                  className={`w-full rounded-xl bg-slate-900 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white ${VISUAL_MOTION.action} dark:bg-slate-100 dark:text-slate-900`}
                >
                  <ShieldCheck size={14} className="mr-2 inline" /> Iniciar Modo Demo
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div role="alert" aria-live="polite" className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-rose-500 animate-in shake">
                  <AlertCircle size={13} className="shrink-0" />
                  <p className="text-xs font-medium">{error.message}</p>
                </div>
              )}
              {error && getAuthDiagnostic(error.code) && (
                <div className={`${VISUAL_SURFACES.alert} p-4`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em]">{getAuthDiagnostic(error.code)?.title}</p>
                  <p className="mt-1 text-xs font-medium leading-relaxed">{getAuthDiagnostic(error.code)?.message}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] opacity-90">
                    Próximo passo: {getAuthDiagnostic(error.code)?.suggestion}
                  </p>
                </div>
              )}

              {view === 'login' && (
                <>
                  <form onSubmit={handleEmailLogin} className="space-y-3">
                    <div className="space-y-2">
                      <div className="relative group">
                        <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors ${focusedField === 'email' ? 'text-slate-500' : ''}`} size={15} />
                        <input 
                          type="email" required value={email}
                          onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                          onChange={(e) => setEmail(e.target.value)}
                          aria-label="E-mail de acesso"
                          placeholder="E-mail"
                          data-testid="email"
                          className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-11 py-3.5 text-sm font-medium outline-none placeholder:text-slate-400 focus:border-slate-400/40 focus:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:focus:bg-slate-800 ${VISUAL_MOTION.state}`}
                        />
                      </div>
                      <div className="relative group">
                        <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors ${focusedField === 'password' ? 'text-slate-500' : ''}`} size={15} />
                        <input 
                          type="password" required value={password}
                          onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                          onChange={(e) => setPassword(e.target.value)}
                          aria-label="Senha de acesso"
                          placeholder="Senha"
                          data-testid="password"
                          className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-11 py-3.5 text-sm font-medium outline-none placeholder:text-slate-400 focus:border-slate-400/40 focus:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:focus:bg-slate-800 ${VISUAL_MOTION.state}`}
                        />
                      </div>
                      <button type="button" onClick={() => setView('recover')} className="block w-full px-1 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Esqueci a senha</button>
                    </div>
                  <button type="submit" disabled={isLoading} data-testid="login-button" className={`w-full rounded-xl bg-slate-900 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 ${VISUAL_MOTION.action}`}>
                    {isLoading ? 'Autenticando...' : 'Acessar Conta'} <ArrowRight size={14} className="inline ml-1" />
                  </button>
                </form>
                  
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                    <span className="text-[8px] font-semibold text-slate-300 dark:text-slate-600 uppercase tracking-[0.12em]">OU</span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                  </div>

                  <button onClick={() => handleSocialLogin(googleProvider)} className={`flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${VISUAL_MOTION.action}`}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" /> Entrar com Google
                  </button>

                  <button onClick={() => setView('signup')} className="w-full pt-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 group">
                    Novo por aqui? <span className="text-slate-600 group-hover:underline dark:text-slate-300">Cadastre-se</span>
                  </button>
                </>
              )}

              {view === 'signup' && (
                <form onSubmit={handleSignup} className="space-y-3 animate-in slide-in-from-right-4 duration-500">
                  <button type="button" onClick={() => setView('login')} className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400"><ChevronLeft size={14} /> Voltar</button>
                  <div className="space-y-2">
                    <input type="text" required aria-label="Nome completo" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-medium outline-none placeholder:text-slate-400 focus:border-slate-400/40 focus:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:focus:bg-slate-800 ${VISUAL_MOTION.state}`} />
                    <input type="email" required aria-label="E-mail para cadastro" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-medium outline-none placeholder:text-slate-400 focus:border-slate-400/40 focus:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:focus:bg-slate-800 ${VISUAL_MOTION.state}`} />
                    <input type="password" required aria-label="Senha para cadastro" placeholder="Senha (min 6 car.)" value={password} onChange={e => setPassword(e.target.value)} className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-medium outline-none placeholder:text-slate-400 focus:border-slate-400/40 focus:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:focus:bg-slate-800 ${VISUAL_MOTION.state}`} />
                  </div>
                  <button type="submit" disabled={isLoading} className={`w-full rounded-xl bg-slate-900 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white dark:bg-slate-100 dark:text-slate-900 ${VISUAL_MOTION.action}`}>
                    Criar meu Acesso <UserPlus size={16} className="ml-2 inline" />
                  </button>
                </form>
              )}

              {view === 'recover' && (
                <form onSubmit={handleRecoverPassword} className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                  <button type="button" onClick={() => setView('login')} className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400"><ChevronLeft size={14} /> Voltar</button>
                  <div className="space-y-3">
                    <p className="px-2 text-center text-[11px] font-medium leading-relaxed text-slate-500">Enviaremos um link de recuperação para o e-mail cadastrado.</p>
                    <input type="email" required aria-label="E-mail para recuperar senha" placeholder="E-mail cadastrado" value={email} onChange={e => setEmail(e.target.value)} className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium outline-none placeholder:text-slate-400 focus:border-slate-400/40 focus:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:focus:bg-slate-800 ${VISUAL_MOTION.state}`} />
                  </div>
                  <button type="submit" className={`w-full rounded-xl bg-slate-900 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white dark:bg-slate-100 dark:text-slate-900 ${VISUAL_MOTION.action}`}>Recuperar Senha</button>
                </form>
              )}

              {view === 'success' && (
                <div className="text-center space-y-4 py-2 animate-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-emerald-500/20">
                    <CheckCircle2 size={36} />
                  </div>
                  <p className="px-2 text-[11px] font-medium leading-relaxed text-slate-600 dark:text-slate-300">{successMessage}</p>
                  <button onClick={() => setView('login')} className={`w-full rounded-xl bg-slate-900 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white ${VISUAL_MOTION.action}`}>Voltar ao Login</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-col items-center gap-2">
          <button 
            onClick={() => {
              setIsAnimating(true);
              setTimeout(() => onLogin('teste@flow.com'), 400);
            }}
            className={`flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 ${VISUAL_MOTION.action}`}
          >
            <ShieldCheck size={13} /> Sessão protegida
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Acesso ao painel de caixa do workspace</p>
        </div>
      </div>
    </div>
  );
};

export default Login;







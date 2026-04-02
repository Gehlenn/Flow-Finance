import React, { useEffect, useState } from 'react';
import {
  User, LogOut, Moon, Sliders, Sun, Edit2,
  ChevronRight, Phone, BrainCircuit, X, Loader2, Send,
  Link2, CheckCircle2, AlertCircle, Copyright, Scale, ShieldCheck,
} from 'lucide-react';
import NamePromptModal from './NamePromptModal';
import LegalModal from './LegalModal';
import { GoogleGenAI } from '@google/genai';
import { auth, googleProvider, appleProvider, linkWithPopup } from '../services/firebase';
import type { AuthProvider } from 'firebase/auth';
import {
  ensureActiveWorkspace,
  getCurrentWorkspaceIdentity,
  listUserWorkspaces,
  setActiveWorkspaceId,
  type WorkspaceRole,
  type WorkspaceSummary,
} from '../src/services/workspaceSession';
import { getWorkspaceBillingOverview } from '../src/services/firestoreBillingStore';
import {
  canManageWorkspaceBilling,
  canManageWorkspaceMembers,
  canViewWorkspaceAudit,
} from '../src/security/workspacePermissions';

interface SettingsProps {
  userName: string | null;
  userEmail: string | null;
  theme: 'light' | 'dark';
  activeWorkspaceName?: string | null;
  activeTenantName?: string | null;
  activeWorkspaceRole?: WorkspaceRole | null;
  onUpdateProfile: (name: string) => void;
  onLogout: () => void;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onOpenWorkspaceAdmin?: () => void;
}

const Settings: React.FC<SettingsProps> = ({
  userName,
  userEmail,
  theme,
  activeWorkspaceName,
  activeTenantName,
  activeWorkspaceRole,
  onUpdateProfile,
  onLogout,
  onThemeChange,
  onOpenWorkspaceAdmin,
}) => {
  const [showNameModal, setShowNameModal] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'privacy_terms' | 'copyright' | null>(null);
  const [showAiSupport, setShowAiSupport] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [supportQuery, setSupportQuery] = useState('');
  const [supportResponse, setSupportResponse] = useState('');
  const [isGeneratingSupport, setIsGeneratingSupport] = useState(false);
  const [isAnimatingTheme, setIsAnimatingTheme] = useState(false);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<'free' | 'pro'>('free');
  const [planName, setPlanName] = useState('Free');
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false);
  const [monthlyUsageSummary, setMonthlyUsageSummary] = useState('0 transactions · 0 AI · 0 bank connections');

  useEffect(() => {
    void loadBillingOverview();
  }, []);

  const handleThemeChange = (nextTheme: 'light' | 'dark') => {
    setIsAnimatingTheme(true);
    onThemeChange(nextTheme);
    setTimeout(() => setIsAnimatingTheme(false), 700);
  };

  const loadBillingOverview = async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const identity = getCurrentWorkspaceIdentity();
      let availableWorkspaces = await listUserWorkspaces();
      const workspace = await ensureActiveWorkspace(identity);
      if (availableWorkspaces.length === 0) {
        availableWorkspaces = [workspace];
      }

      const overview = await getWorkspaceBillingOverview({
        tenantId: workspace.tenantId,
        workspaceId: workspace.workspaceId,
      });

      setActiveWorkspace(workspace);
      setWorkspaces(availableWorkspaces);
      setCurrentPlan(overview.currentPlan);
      setPlanName(overview.currentPlan === 'pro' ? 'Pro' : 'Free');
      setMonthlyUsageSummary(
        `${overview.currentMonthUsage.transactions} transactions · ` +
        `${overview.currentMonthUsage.aiQueries} AI · ` +
        `${overview.currentMonthUsage.bankConnections} bank connections`,
      );
    } catch (error) {
      console.error(error);
      setBillingError('Could not load your workspace plan right now.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleWorkspaceChange = async (workspaceId: string) => {
    const nextWorkspace = workspaces.find((workspace) => workspace.workspaceId === workspaceId);
    if (!nextWorkspace || nextWorkspace.workspaceId === activeWorkspace?.workspaceId) {
      return;
    }

    setWorkspaceSwitching(true);
    setActiveWorkspaceId(nextWorkspace.workspaceId);
    setActiveWorkspace(nextWorkspace);

    try {
      await loadBillingOverview();
    } finally {
      setWorkspaceSwitching(false);
    }
  };

  const handleAiSupport = async () => {
    if (!supportQuery.trim()) return;
    setIsGeneratingSupport(true);
    setSupportResponse('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: supportQuery,
        config: {
          systemInstruction: 'You are the Flow support assistant. Help with financial workflows, investments, and product usage. Keep it concise and friendly.',
        },
      });
      setSupportResponse(response.text || 'I could not process your question right now.');
    } catch {
      setSupportResponse('AI support is temporarily unavailable.');
    } finally {
      setIsGeneratingSupport(false);
    }
  };

  const handleLinkAccount = async (provider: AuthProvider) => {
    if (!auth.currentUser) return;
    setIsLinking(true);
    setLinkFeedback(null);
    try {
      await linkWithPopup(auth.currentUser, provider);
      setLinkFeedback({ type: 'success', msg: 'Account linked.' });
    } catch (err: unknown) {
      console.error('Error while linking account', err);
      const error = err as { code?: string };
      if (error.code === 'auth/credential-already-in-use') {
        setLinkFeedback({ type: 'error', msg: 'This credential is already linked elsewhere.' });
      } else {
        setLinkFeedback({ type: 'error', msg: 'Could not link this provider.' });
      }
    } finally {
      setIsLinking(false);
      setTimeout(() => setLinkFeedback(null), 3000);
    }
  };

  const canOpenWorkspaceAdmin =
    canManageWorkspaceMembers(activeWorkspaceRole || activeWorkspace?.role)
    || canManageWorkspaceBilling(activeWorkspaceRole || activeWorkspace?.role)
    || canViewWorkspaceAudit(activeWorkspaceRole || activeWorkspace?.role);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] p-6 rounded-[2rem] flex justify-between items-center shadow-lg shadow-indigo-500/20 shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">Settings</h2>
          <p className="text-[8px] font-black text-white/70 uppercase tracking-widest mt-1.5">Profile and workspace</p>
        </div>
        <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white relative z-10">
          <Sliders size={22} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm space-y-8">
        <div className="flex items-center gap-5 border-b border-slate-50 dark:border-slate-700 pb-8">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-[2rem] flex items-center justify-center text-indigo-500 shadow-inner">
            <User size={36} />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-slate-800 dark:text-white text-xl tracking-tight leading-none mb-1">{userName || 'Flow User'}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{userEmail}</p>
            <button onClick={() => setShowNameModal(true)} className="flex items-center gap-1.5 mt-2 text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-600 transition-colors">
              <Edit2 size={12} /> Edit name
            </button>
          </div>
        </div>

        <div className="space-y-4 border-t border-slate-50 dark:border-slate-700 pt-6">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Workspace summary</h4>
            <span className={`text-[9px] font-black uppercase tracking-widest ${currentPlan === 'pro' ? 'text-emerald-500' : 'text-indigo-500'}`}>
              {currentPlan.toUpperCase()} · {activeWorkspaceRole || activeWorkspace?.role || 'member'}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active workspace</label>
            <select
              value={activeWorkspace?.workspaceId || ''}
              onChange={(event) => void handleWorkspaceChange(event.target.value)}
              disabled={billingLoading || workspaceSwitching || workspaces.length <= 1}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-100 outline-none disabled:opacity-60"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.workspaceId} value={workspace.workspaceId}>
                  {workspace.name} · {workspace.plan.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 space-y-2">
            {billingLoading ? (
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading workspace...</p>
            ) : (
              <>
                <p className="text-sm font-black text-slate-800 dark:text-white">Plan: {planName}</p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-widest">Tenant: {activeTenantName || activeWorkspace?.tenantName || 'Active tenant'}</p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-widest">Workspace: {activeWorkspaceName || activeWorkspace?.name || 'Active workspace'}</p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-widest">Role: {activeWorkspaceRole || activeWorkspace?.role || 'member'}</p>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Current month: {monthlyUsageSummary}</p>
              </>
            )}
            {billingError && <p className="text-[10px] font-bold text-rose-500">{billingError}</p>}
          </div>

          {canOpenWorkspaceAdmin && (
            <div className="p-4 rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 space-y-3">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-400" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Workspace Admin</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Manage billing, members and audit in a dedicated screen.</p>
                </div>
              </div>
              <button
                onClick={() => onOpenWorkspaceAdmin?.()}
                className="w-full p-4 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                Open workspace admin
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <Link2 size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Social access</h4>
            </div>
            {linkFeedback && (
              <div className={`flex items-center gap-1.5 animate-in slide-in-from-right-2 ${linkFeedback.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {linkFeedback.type === 'success' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                <span className="text-[8px] font-black uppercase tracking-widest">{linkFeedback.msg}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => void handleLinkAccount(googleProvider)}
              disabled={isLinking}
              className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex flex-col items-center gap-2 border-2 border-transparent hover:border-indigo-500/20 transition-all active:scale-95 group disabled:opacity-50"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Link Google</span>
            </button>
            <button
              onClick={() => void handleLinkAccount(appleProvider)}
              disabled={isLinking}
              className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex flex-col items-center gap-2 border-2 border-transparent hover:border-indigo-500/20 transition-all active:scale-95 group disabled:opacity-50"
            >
              <svg className="w-5 h-5 fill-current text-slate-700 dark:text-white group-hover:scale-110 transition-transform" viewBox="0 0 384 512"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 21.8-88.5 21.8-11.4 0-51.1-20.8-82.9-20.1-41.9.3-81.2 26.1-102.3 65.1-41.1 75.9-10.3 188.7 30.2 247.3 20.1 28.5 44 54.8 75.1 53.9 29.9-1 41.3-19.1 77.6-19.1 36.3 0 46.7 19.1 78.2 18.5 31.9-.5 52.8-23.5 72.8-52.1 23-33.1 32.5-65.1 33-66.7-.6-.2-64.1-24.6-64.4-97.3zM281.3 83.1c31.4-38.1 25.1-73.3 23.5-83.1-27.1 1.1-59.3 18.6-77.9 40.2-16.1 18.5-30.5 52.2-25.7 82.9 30.8 2.4 59.4-11.2 80.1-30z"/></svg>
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Link Apple</span>
            </button>
          </div>
          <p className="text-[8px] text-center font-bold text-slate-400 uppercase tracking-widest px-2">Link a provider for faster sign-in on the next session.</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <Moon size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Theme</h4>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handleThemeChange('light')} className={`flex-1 py-5 rounded-3xl flex flex-col items-center gap-2 border-2 transition-all ${theme === 'light' ? 'bg-indigo-50/50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-lg' : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400 hover:border-slate-200'}`}>
              <Sun size={24} className={`transition-all duration-700 ${theme === 'light' && isAnimatingTheme ? 'rotate-[360deg] scale-110' : ''}`} />
              <span className="text-[9px] font-black uppercase tracking-widest">Light</span>
            </button>
            <button onClick={() => handleThemeChange('dark')} className={`flex-1 py-5 rounded-3xl flex flex-col items-center gap-2 border-2 transition-all ${theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-xl shadow-indigo-900/10' : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400 hover:border-slate-200'}`}>
              <Moon size={24} className={`transition-all duration-700 ${theme === 'dark' && isAnimatingTheme ? '-rotate-12 scale-110' : ''}`} />
              <span className="text-[9px] font-black uppercase tracking-widest">Dark</span>
            </button>
          </div>
        </div>

        <button onClick={onLogout} className="w-full py-5 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-3xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all border border-rose-100 dark:border-rose-500/20">
          <LogOut size={18} /> Sign out
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
        <h4 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest border-b border-slate-50 dark:border-slate-700 pb-2">Support</h4>
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => setShowAiSupport(true)}
            className="w-full p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center gap-4 group hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all text-left"
          >
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg"><BrainCircuit size={20} /></div>
            <div className="flex-1">
              <h5 className="text-[10px] font-black text-slate-800 dark:text-white uppercase">AI guide</h5>
              <p className="text-[9px] text-slate-400 font-medium">Ask for product help or finance workflows</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
          <a
            href="https://wa.me/5551995730813?text=Hello!%20I%20need%20help%20with%20Flow%20Finance."
            target="_blank"
            rel="noopener noreferrer"
            className="w-full p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center gap-4 group hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all text-left"
          >
            <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg"><Phone size={20} /></div>
            <div className="flex-1">
              <h5 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Human support</h5>
              <p className="text-[9px] text-slate-400 font-medium">Talk to the team on WhatsApp</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </a>

          <button
            onClick={() => setLegalModalType('privacy_terms')}
            className="w-full p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center gap-4 group hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left"
          >
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl flex items-center justify-center shadow-lg"><Scale size={20} /></div>
            <div className="flex-1">
              <h5 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Terms and privacy</h5>
              <p className="text-[9px] text-slate-400 font-medium">Review usage and data protection policies</p>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
        </div>
      </div>

      <div className="flex justify-center pt-8 pb-4">
        <button
          onClick={() => setLegalModalType('copyright')}
          className="group flex flex-col items-center gap-2 opacity-50 hover:opacity-100 transition-opacity"
        >
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <Copyright size={12} className="text-slate-500 dark:text-slate-400" />
            <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-indigo-500 transition-colors">Flow Finance 2026</span>
          </div>
          <p className="text-[8px] font-medium text-slate-400">All rights reserved</p>
        </button>
      </div>

      {legalModalType && (
        <LegalModal
          type={legalModalType}
          onClose={() => setLegalModalType(null)}
        />
      )}

      {showAiSupport && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg max-h-[85vh] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><BrainCircuit size={16} /></div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">AI support</h3>
              </div>
              <button onClick={() => { setShowAiSupport(false); setSupportResponse(''); setSupportQuery(''); }} className="p-2 text-slate-400"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {!supportResponse && !isGeneratingSupport && (
                <div className="text-center py-10 space-y-4">
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest">What do you need help with?</p>
                  <div className="grid grid-cols-1 gap-2 px-4">
                    {['Cash flow help', 'How should I invest my balance?', 'How do exports work?'].map((question) => (
                      <button key={question} onClick={() => { setSupportQuery(question); void handleAiSupport(); }} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-indigo-50 transition-all text-left border border-transparent hover:border-indigo-100">{question}</button>
                    ))}
                  </div>
                </div>
              )}
              {isGeneratingSupport && (
                <div className="py-20 flex flex-col items-center gap-4 text-center">
                  <Loader2 size={32} className="animate-spin text-indigo-600" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 animate-pulse">Thinking...</p>
                </div>
              )}
              {supportResponse && (
                <div className="bg-indigo-50 dark:bg-indigo-500/10 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-500/20 animate-in slide-in-from-bottom-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed">{supportResponse}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex gap-2">
              <input
                type="text"
                value={supportQuery}
                onChange={(event) => setSupportQuery(event.target.value)}
                onKeyPress={(event) => event.key === 'Enter' && void handleAiSupport()}
                placeholder="Ask your question here..."
                className="flex-1 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-bold text-sm text-slate-700 dark:text-white"
              />
              <button onClick={() => void handleAiSupport()} className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg active:scale-95 transition-all"><Send size={20} /></button>
            </div>
          </div>
        </div>
      )}

      {showNameModal && (
        <NamePromptModal
          onSave={(newName) => { onUpdateProfile(newName); setShowNameModal(false); }}
        />
      )}
    </div>
  );
};

export default Settings;

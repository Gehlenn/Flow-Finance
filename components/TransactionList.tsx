
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { detectMerchantCategory } from '../src/ai/categoryLearning';
import { saveMerchantCategoryLearning } from '../src/engines/finance/categorization/aiCategorizerFallback';
import { Transaction, TransactionType, Category } from '../types';
import { formatCurrency } from '../utils/helpers';
import { expandTransactionsWithRecurring } from '../src/finance/recurringService';
import { calculateSignedBalance } from '../src/engines/finance/analyticsEngine';
import { compareMoney } from '../src/security/moneyMath';
import { getWorkspaceScopedStorageKey } from '../src/utils/workspaceStorage';
import { logWarn } from '../src/utils/logger';
import { 
  Trash2, Search, Share2, Edit2, Filter, RotateCcw, History, X, 
  ShoppingBag, GraduationCap, Briefcase, TrendingUp, Download, 
  Mail, Info, CheckSquare, Square, FileText, Wallet, MessageCircle,
  AlertTriangle, Check, ArrowUp, ArrowDown, RefreshCw
} from 'lucide-react';

interface TransactionListProps {
  activeWorkspaceId?: string | null;
  activeWorkspaceName?: string | null;
  userId?: string | null;
  transactions: Transaction[];
  hideValues: boolean;
  canEdit?: boolean;
  onDelete: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onUpdate: (updated: Transaction) => void;
}

type SortKey = 'date' | 'amount' | 'category' | 'description';
type SortDirection = 'asc' | 'desc';
export type TransactionFinancialState = 'confirmed' | 'pending' | 'overdue';
type TransactionFinancialStateFilter = TransactionFinancialState | 'Todas';

const normalizeStateLabel = (state: unknown): TransactionFinancialState | null => {
  if (typeof state !== 'string') {
    return null;
  }

  const normalized = state.toLowerCase();
  if (normalized === 'confirmed' || normalized === 'confirmado') {
    return 'confirmed';
  }
  if (normalized === 'pending' || normalized === 'pendente') {
    return 'pending';
  }
  if (normalized === 'overdue' || normalized === 'vencido') {
    return 'overdue';
  }

  return null;
};

export const classifyTransactionFinancialState = (
  transaction: Transaction,
  referenceDate: Date = new Date(),
): TransactionFinancialState => {
  const metadata = transaction as unknown as Record<string, unknown>;
  const explicitState = normalizeStateLabel(metadata.status);
  if (explicitState) {
    return explicitState;
  }

  const transactionDate = new Date(transaction.date).getTime();
  const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
  const endOfToday = startOfToday + (24 * 60 * 60 * 1000) - 1;

  if (transactionDate > endOfToday) {
    return 'pending';
  }

  if (transaction.generated && transactionDate < startOfToday) {
    return 'overdue';
  }

  return 'confirmed';
};

const formatFinancialStateLabel = (state: TransactionFinancialState): string => {
  if (state === 'pending') {
    return 'Pendente';
  }
  if (state === 'overdue') {
    return 'Vencido';
  }
  return 'Confirmado';
};

// Static class maps for Tailwind static analysis - prevents CSS purging
const TRANSACTION_LIST_CLASSES = {
  filterButtonActive: 'bg-indigo-600 text-white border-indigo-500',
  filterButtonInactive: 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700',
  categoryFilterActive: 'bg-indigo-600 text-white shadow-md',
  categoryFilterInactive: 'bg-slate-50 dark:bg-slate-900 text-slate-400',
  categoryBadgeIncome: 'bg-emerald-50 text-emerald-500',
  categoryBadgeExpense: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500',
  rowSelected: 'bg-indigo-50/50 dark:bg-indigo-500/10',
  rowUnselected: '',
  rowOverdue: 'bg-rose-50/40 dark:bg-rose-900/10',
  checkboxSelected: 'text-indigo-600',
  checkboxUnselected: 'text-slate-200 dark:text-slate-700',
  amountIncome: 'text-emerald-600',
  amountExpense: 'text-rose-600',
  typeIncomeBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  typeExpenseBadge: 'bg-rose-50 text-rose-700 border-rose-200',
  stateConfirmed: 'bg-slate-100 text-slate-600 border-slate-200',
  statePending: 'bg-amber-50 text-amber-700 border-amber-200',
  stateOverdue: 'bg-rose-100 text-rose-700 border-rose-200',
  shareTypeActive: 'bg-indigo-600 text-white border-indigo-600 shadow-md',
  shareTypeInactive: 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-transparent',
  primaryAction: 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900',
  neutralShareTile: 'bg-slate-50 dark:bg-slate-900 rounded-2xl flex flex-col items-center gap-2 hover:scale-105 transition-all',
  neutralInfoBadge: 'bg-slate-50 dark:bg-slate-900/30 text-slate-500 rounded-2xl',
};

const TRANSACTION_CATEGORY_FILTERS: Array<Category | 'Todas'> = ['Todas', ...Object.values(Category)];
const PANEL_SURFACE = 'rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-800';
const MODAL_SURFACE = 'rounded-3xl bg-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.28)] dark:bg-slate-800';
const TRANSACTION_TOOLBAR_SURFACE = 'rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.22)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/60';
const TRANSACTION_TOOLBAR_BUTTON = 'inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';
const TRANSACTION_TOOLBAR_INPUT = 'h-11 w-full rounded-xl border border-slate-200/80 bg-transparent pl-11 pr-4 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 dark:border-slate-700 dark:text-white';
const TRANSACTION_BULK_SURFACE = 'fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 z-[150] w-[min(96vw,34rem)] -translate-x-1/2 rounded-2xl border border-slate-800/90 bg-slate-950/95 px-2.5 py-2 text-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.65)] backdrop-blur-md transition-all animate-in slide-in-from-bottom-4 md:bottom-20 md:w-[min(94vw,52rem)] md:px-3 md:py-2.5';
const TRANSACTION_BULK_BUTTON = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors hover:bg-white/10 md:h-9 md:px-3';

// Cache global para persistir entre remontagens
const listCache = {
  paramsKey: '',
  transactionsRef: null as Transaction[] | null,
  data: [] as Transaction[]
};

const readStoredString = (key: string, defaultValue = ''): string => {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : defaultValue;
  } catch {
    return raw;
  }
};

const readStoredBoolean = (key: string, defaultValue = false): boolean => {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'boolean' ? parsed : defaultValue;
  } catch {
    return raw === 'true';
  }
};

const readStoredSortConfig = (key: string): { key: SortKey; direction: SortDirection } => {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return { key: 'date', direction: 'desc' };
  }

  try {
    const parsed = JSON.parse(raw) as { key?: SortKey; direction?: SortDirection };
    if (parsed.key && parsed.direction) {
      return { key: parsed.key, direction: parsed.direction };
    }
  } catch {
    // Ignore malformed persisted values and fall back to defaults.
  }

  return { key: 'date', direction: 'desc' };
};

const TransactionList: React.FC<TransactionListProps> = ({ activeWorkspaceId, activeWorkspaceName, userId, transactions, hideValues, canEdit = true, onDelete, onDeleteMultiple, onUpdate }) => {
  const storageKeys = useMemo(() => ({
    searchQuery: getWorkspaceScopedStorageKey('flow_searchQuery', activeWorkspaceId),
    showFilters: getWorkspaceScopedStorageKey('flow_showFilters', activeWorkspaceId),
    categoryFilter: getWorkspaceScopedStorageKey('flow_categoryFilter', activeWorkspaceId),
    dateStart: getWorkspaceScopedStorageKey('flow_dateStart', activeWorkspaceId),
    dateEnd: getWorkspaceScopedStorageKey('flow_dateEnd', activeWorkspaceId),
    sortConfig: getWorkspaceScopedStorageKey('flow_sortConfig', activeWorkspaceId),
  }), [activeWorkspaceId]);

  const [searchQuery, setSearchQuery] = useState(() => readStoredString(storageKeys.searchQuery, ''));
  const [showFilters, setShowFilters] = useState(() => readStoredBoolean(storageKeys.showFilters, false));
  const [categoryFilter, setCategoryFilter] = useState<Category | 'Todas'>(() => readStoredString(storageKeys.categoryFilter, 'Todas') as Category | 'Todas');
  const [stateFilter, setStateFilter] = useState<TransactionFinancialStateFilter>('Todas');
  const [dateStart, setDateStart] = useState(() => readStoredString(storageKeys.dateStart, ''));
  const [dateEnd, setDateEnd] = useState(() => readStoredString(storageKeys.dateEnd, ''));
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>(() => readStoredSortConfig(storageKeys.sortConfig));
  
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTypes, setShareTypes] = useState<Set<string>>(new Set(['tudo']));
  const [shareCategories, setShareCategories] = useState<Set<string>>(new Set(['tudo']));
  const [showDestinations, setShowDestinations] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [showCategorySaved, setShowCategorySaved] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categorySaveDiagnostic, setCategorySaveDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const [shareCopyDiagnostic, setShareCopyDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const closeToastRef = useRef<HTMLButtonElement>(null);
  // Feedback visual ao salvar categoria
  useEffect(() => {
    setSearchQuery(readStoredString(storageKeys.searchQuery, ''));
    setShowFilters(readStoredBoolean(storageKeys.showFilters, false));
    setCategoryFilter(readStoredString(storageKeys.categoryFilter, 'Todas') as Category | 'Todas');
    setStateFilter('Todas');
    setDateStart(readStoredString(storageKeys.dateStart, ''));
    setDateEnd(readStoredString(storageKeys.dateEnd, ''));
    setSortConfig(readStoredSortConfig(storageKeys.sortConfig));
    setSelectedIds(new Set());
    listCache.paramsKey = '';
    listCache.transactionsRef = null;
    listCache.data = [];
  }, [storageKeys]);

  // Persiste filtros no localStorage por workspace
  useEffect(() => { localStorage.setItem(storageKeys.searchQuery, JSON.stringify(searchQuery)); }, [searchQuery, storageKeys]);
  useEffect(() => { localStorage.setItem(storageKeys.showFilters, JSON.stringify(showFilters)); }, [showFilters, storageKeys]);
  useEffect(() => { localStorage.setItem(storageKeys.categoryFilter, JSON.stringify(categoryFilter)); }, [categoryFilter, storageKeys]);
  useEffect(() => { localStorage.setItem(storageKeys.dateStart, JSON.stringify(dateStart)); }, [dateStart, storageKeys]);
  useEffect(() => { localStorage.setItem(storageKeys.dateEnd, JSON.stringify(dateEnd)); }, [dateEnd, storageKeys]);
  useEffect(() => { localStorage.setItem(storageKeys.sortConfig, JSON.stringify(sortConfig)); }, [sortConfig, storageKeys]);

  useEffect(() => {
    if (showCategorySaved) {
      const timer = setTimeout(() => setShowCategorySaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showCategorySaved]);
  // Modal de edição de categoria
  const [editCategoryValue, setEditCategoryValue] = useState<Category | null>(null);
  const [previousCategory, setPreviousCategory] = useState<Category | null>(null);
  // Foco automático no primeiro botão de categoria ao abrir modal
  const firstCatBtnRef = useRef<HTMLButtonElement>(null);
  const [suggestedCategory, setSuggestedCategory] = useState<Category | null>(null);
  const [suggestionDiagnostic, setSuggestionDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  useEffect(() => {
    let active = true;
    async function fetchSuggestion() {
      if (editingTransaction) {
        setEditCategoryValue(editingTransaction.category);
        setPreviousCategory(editingTransaction.category);
        setSuggestedCategory(null);
        setSuggestionDiagnostic(null);
        setTimeout(() => {
          firstCatBtnRef.current?.focus();
        }, 100);
        if (editingTransaction.merchant) {
          const resolvedUserId = userId || 'local';
          try {
            const cat = await detectMerchantCategory(resolvedUserId, editingTransaction.merchant);
            if (cat && active) setSuggestedCategory(cat as Category);
          } catch (error) {
            logWarn('[TransactionList] Failed to suggest category', {
              error,
              merchant: editingTransaction.merchant,
              fallback: 'transaction-list-suggest-category-failed',
            });
            if (active) {
              setSuggestionDiagnostic({
                title: 'Sugestao de IA indisponivel',
                message: 'A IA nao conseguiu sugerir uma categoria agora.',
                suggestion: 'Escolha a categoria manualmente e salve a alteracao.',
              });
            }
          }
        }
      }
    }
    fetchSuggestion();
    return () => { active = false; };
  }, [editingTransaction, userId]);

  const handleSaveCategory = async () => {
    if (!editingTransaction || !editCategoryValue) return;
    setSavingCategory(true);
    setCategorySaveDiagnostic(null);
    try {
      const updated = { ...editingTransaction, category: editCategoryValue };
      onUpdate(updated);
      if (updated.merchant) {
        try {
          await saveMerchantCategoryLearning(userId || 'local', updated.merchant, editCategoryValue);
        } catch (learningError) {
          logWarn('[TransactionList] Failed to learn category', {
            error: learningError,
            merchant: updated.merchant,
            category: editCategoryValue,
            fallback: 'transaction-list-learn-category-failed',
          });
          setCategorySaveDiagnostic({
            title: 'Categoria salva localmente',
            message: 'A transacao foi atualizada, mas o aprendizado da IA nao foi salvo agora.',
            suggestion: 'Revise a categoria depois ou tente sincronizar o aprendizado mais tarde.',
          });
          return;
        }
      }
      setShowCategorySaved(true);
      setEditingTransaction(null);
    } finally {
      setSavingCategory(false);
    }
  };

  useEffect(() => {
    if (showCopyToast) {
      const timer = setTimeout(() => setShowCopyToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showCopyToast]);

  const filteredAndSorted = useMemo(() => {
    // Gera uma chave única baseada nos parâmetros de filtro e ordenação
    const paramsKey = JSON.stringify({
      workspaceId: activeWorkspaceId || 'global',
      q: searchQuery,
      c: categoryFilter,
      ds: dateStart,
      de: dateEnd,
      s: sortConfig
    });

    // Se a referência da lista de transações e os parâmetros forem os mesmos, retorna do cache
    if (listCache.transactionsRef === transactions && listCache.paramsKey === paramsKey) {
      return listCache.data;
    }

    // Expande com recorrentes geradas dinamicamente (próximos 12 meses)
    const now = new Date();
    const start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const end = new Date(now.getFullYear() + 1, now.getMonth(), 1);
    const expanded = expandTransactionsWithRecurring(transactions, start, end);

    let result = expanded.filter((t) => {
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'Todas' || t.category === categoryFilter;
      const matchesState = stateFilter === 'Todas' || classifyTransactionFinancialState(t) === stateFilter;
      const tDate = new Date(t.date);
      const matchesDateStart = !dateStart || tDate >= new Date(dateStart + 'T00:00:00');
      const matchesDateEnd = !dateEnd || tDate <= new Date(dateEnd + 'T23:59:59');
      return matchesSearch && matchesCategory && matchesState && matchesDateStart && matchesDateEnd;
    });

    result.sort((a, b) => {
      let comp = 0;
      if (sortConfig.key === 'amount') comp = compareMoney(a.amount, b.amount);
      else if (sortConfig.key === 'category') comp = a.category.localeCompare(b.category);
      else if (sortConfig.key === 'description') comp = a.description.localeCompare(b.description);
      else comp = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortConfig.direction === 'asc' ? comp : -comp;
    });

    // Atualiza o cache
    listCache.paramsKey = paramsKey;
    listCache.transactionsRef = transactions;
    listCache.data = result;

    return result;
  }, [transactions, activeWorkspaceId, searchQuery, categoryFilter, stateFilter, dateStart, dateEnd, sortConfig]);

  const transactionStateSummary = useMemo(() => {
    return filteredAndSorted.reduce(
      (summary, transaction) => {
        const state = classifyTransactionFinancialState(transaction);
        summary[state] += 1;
        return summary;
      },
      { confirmed: 0, pending: 0, overdue: 0 } as Record<TransactionFinancialState, number>,
    );
  }, [filteredAndSorted]);

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];

    if (categoryFilter !== 'Todas') {
      parts.push(`Categoria: ${categoryFilter}`);
    }

    if (stateFilter !== 'Todas') {
      parts.push(`Estado: ${formatFinancialStateLabel(stateFilter)}`);
    }

    if (dateStart || dateEnd) {
      parts.push('Periodo personalizado');
    }

    return parts.length > 0 ? parts.join(' · ') : 'Sem filtros aplicados';
  }, [categoryFilter, dateEnd, dateStart, stateFilter]);

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <div className="w-3 h-3" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  const formatVal = (amt: number) => formatCurrency(amt);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredAndSorted.length && filteredAndSorted.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSorted.map(t => t.id)));
    }
  };

  const bulkDelete = () => {
    if (!canEdit || selectedIds.size === 0) return;
    if (confirm(`Deseja excluir permanentemente os ${selectedIds.size} itens selecionados?`)) {
      onDeleteMultiple(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const confirmDelete = () => {
    if (transactionToDelete) {
      onDelete(transactionToDelete.id);
      setTransactionToDelete(null);
      setViewingTransaction(null);
    }
  };

  const getCategoryIcon = (category: Category) => {
    switch (category) {
      case Category.PESSOAL: return <ShoppingBag size={14} />;
      case Category.CONSULTORIO: return <GraduationCap size={14} />;
      case Category.NEGOCIO: return <Briefcase size={14} />;
      case Category.INVESTIMENTO: return <TrendingUp size={14} />;
      default: return <Wallet size={14} />;
    }
  };

  const generateReportText = () => {
    let list = filteredAndSorted;
    if (!shareTypes.has('tudo')) {
      list = list.filter(t => {
        if (shareTypes.has('ganhos') && t.type === TransactionType.RECEITA) return true;
        if (shareTypes.has('gastos') && t.type === TransactionType.DESPESA) return true;
        return false;
      });
    }
    if (!shareCategories.has('tudo')) {
      list = list.filter(t => shareCategories.has(t.category.toLowerCase()));
    }
    let text = `📊 *Relatório Financeiro Flow*\n\n`;
    list.forEach(t => {
      text += `• ${t.description} (${t.category})\n  ${t.type === TransactionType.RECEITA ? '🟢 Ganho' : '🔴 Gasto'} ${formatVal(t.amount)}\n\n`;
    });
    const total = calculateSignedBalance(list);
    text += `*Saldo do Período:* ${formatVal(total)}`;
    return text;
  };

  const handleShare = async (method: 'whatsapp' | 'email' | 'copy' | 'csv') => {
    const text = generateReportText();
    if (method === 'whatsapp') {
      // Garantir que os emojis e caracteres especiais sejam mantidos
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
      setIsShareModalOpen(false);
      setShowDestinations(false);
    } else if (method === 'email') {
      window.location.href = `mailto:?subject=Relatorio Financeiro Flow&body=${encodeURIComponent(text)}`;
      setIsShareModalOpen(false);
      setShowDestinations(false);
    } else if (method === 'copy') {
      try {
        await navigator.clipboard.writeText(text);
        setShareCopyDiagnostic(null);
        setShowCopyToast(true);
        setIsShareModalOpen(false);
        setShowDestinations(false);
      } catch (error) {
        logWarn('[TransactionList] Failed to copy summary', {
          error,
          fallback: 'transaction-list-copy-summary-failed',
        });
        setShareCopyDiagnostic({
          title: 'Falha ao copiar resumo',
          message: 'O navegador bloqueou a copia do texto do historico.',
          suggestion: 'Use WhatsApp, e-mail ou copie o conteudo manualmente.',
        });
      }
    } else if (method === 'csv') {
      handleExportCSV();
      setIsShareModalOpen(false);
      setShowDestinations(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Data", "Descricao", "Categoria", "Tipo", "Valor"];
    const rows = filteredAndSorted.map(t => [new Date(t.date).toLocaleDateString('pt-BR'), t.description, t.category, t.type, t.amount]);
    const csv = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historico-flow.csv';
    a.click();
  };

  const toggleShareFilter = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
    const newSet = new Set(set);
    if (value === 'tudo') {
      newSet.clear();
      newSet.add('tudo');
    } else {
      newSet.delete('tudo');
      if (newSet.has(value)) {
        newSet.delete(value);
        if (newSet.size === 0) newSet.add('tudo');
      } else {
        newSet.add(value);
      }
    }
    setFn(newSet);
  };

  return (
    <div className="relative w-full flex flex-col gap-3 pb-[calc(11rem+env(safe-area-inset-bottom))] animate-in fade-in duration-700 md:gap-6 md:pb-20">
      <div className={`${PANEL_SURFACE} p-3.5 md:p-6`}>
        <div className="flex items-start justify-between gap-3 md:gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 md:text-xs">Workspace</p>
            <h2 className="mt-1 text-[1.38rem] font-semibold tracking-tight text-slate-950 dark:text-white md:text-2xl">Histórico</h2>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300 md:text-sm">
              {activeWorkspaceName || 'Carregando workspace'}
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-200 md:h-11 md:w-11">
            <History size={18} className="md:hidden" />
            <History size={22} className="hidden md:block" />
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1 md:mt-5 md:gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] md:px-3 md:py-1 md:text-[11px] ${TRANSACTION_LIST_CLASSES.stateConfirmed}`}>
            Confirmado {transactionStateSummary.confirmed}
          </span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] md:px-3 md:py-1 md:text-[11px] ${TRANSACTION_LIST_CLASSES.statePending}`}>
            Pendente {transactionStateSummary.pending}
          </span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] md:px-3 md:py-1 md:text-[11px] ${TRANSACTION_LIST_CLASSES.stateOverdue}`}>
            Vencido {transactionStateSummary.overdue}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 md:space-y-3">
        <div className={`${TRANSACTION_TOOLBAR_SURFACE} flex flex-col gap-1.5 p-2 md:p-2.5 sm:flex-row sm:items-center`}>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={TRANSACTION_TOOLBAR_INPUT}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setIsShareModalOpen(true)}
              aria-label="Abrir compartilhamento do historico"
              className={`${TRANSACTION_TOOLBAR_BUTTON} h-9 w-9 md:h-11 md:w-11`}
            >
              <Share2 size={15} />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Abrir filtros da lista"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all md:h-11 md:w-11 ${showFilters ? TRANSACTION_LIST_CLASSES.filterButtonActive : TRANSACTION_LIST_CLASSES.filterButtonInactive}`}
            >
              <Filter size={15} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className={`${TRANSACTION_TOOLBAR_SURFACE} p-3 space-y-3 animate-in slide-in-from-top-2 md:p-4 md:space-y-4`}>
             <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
                <span className="text-sm font-semibold text-slate-400 uppercase tracking-[0.18em]">Filtros</span>
                <button onClick={() => {setCategoryFilter('Todas'); setStateFilter('Todas'); setDateStart(''); setDateEnd('');}} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800"><RotateCcw size={10} /> Reset</button>
             </div>
             <div className="space-y-3.5 md:space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-400 uppercase tracking-[0.16em] ml-1">Categoria</label>
                <div className="flex flex-wrap gap-1">
                  {TRANSACTION_CATEGORY_FILTERS.map((cat) => (
                    <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-2 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.14em] transition-all md:px-3 md:text-xs ${categoryFilter === cat ? TRANSACTION_LIST_CLASSES.categoryFilterActive : TRANSACTION_LIST_CLASSES.categoryFilterInactive}`}>{cat}</button>
                  ))}
                </div>
               </div>
               <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-[0.16em] ml-1">Estado financeiro</label>
                  <div className="flex flex-wrap gap-1">
                    {(['Todas', 'confirmed', 'pending', 'overdue'] as TransactionFinancialStateFilter[]).map((state) => (
                      <button
                        key={state}
                        onClick={() => setStateFilter(state)}
                        className={`px-2 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.14em] transition-all md:px-3 md:text-xs ${stateFilter === state ? TRANSACTION_LIST_CLASSES.categoryFilterActive : TRANSACTION_LIST_CLASSES.categoryFilterInactive}`}
                      >
                        {state === 'Todas' ? 'Todas' : formatFinancialStateLabel(state)}
                      </button>
                    ))}
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-400 uppercase tracking-[0.16em] ml-1">Início</label>
                    <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-medium text-slate-600 dark:text-white border-none outline-none" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-400 uppercase tracking-[0.16em] ml-1">Fim</label>
                    <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-medium text-slate-600 dark:text-white border-none outline-none" />
                 </div>
               </div>
             </div>
          </div>
        )}
      </div>

      <div className="hidden flex-wrap items-center gap-2 px-1 md:flex">
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Filtros ativos:</span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {activeFilterSummary}
        </span>
      </div>

      {/* Header de Ordenação e Seleção */}
      <div className="hidden items-center gap-4 px-5 py-2 text-sm font-semibold text-slate-400 uppercase tracking-[0.18em] md:flex">
        <button onClick={selectAll} className="shrink-0 hover:text-slate-700 transition-colors">
          {selectedIds.size === filteredAndSorted.length && filteredAndSorted.length > 0 ? <CheckSquare size={16} className="text-slate-700" /> : <Square size={16} />}
        </button>
        <button onClick={() => handleSort('category')} className="w-8 shrink-0 text-center hover:text-slate-700 transition-colors flex justify-center group">
          <SortIcon column="category" />
        </button>
        <button onClick={() => handleSort('description')} className="flex-1 text-left flex items-center gap-1 hover:text-slate-700 transition-colors group">
          Descrição <SortIcon column="description" />
        </button>
        <button onClick={() => handleSort('date')} className="flex items-center gap-1 hover:text-slate-700 transition-colors group">
          Data <SortIcon column="date" />
        </button>
        <button onClick={() => handleSort('amount')} className="flex items-center gap-1 hover:text-slate-700 transition-colors group">
          Valor <SortIcon column="amount" />
        </button>
      </div>

      <div className={`${PANEL_SURFACE} overflow-hidden divide-y divide-slate-50 dark:divide-slate-700`}>
        {filteredAndSorted.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <History size={22} />
            </div>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {transactions.length === 0 ? 'Nenhum lançamento ainda' : 'Nenhum lançamento encontrado'}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {transactions.length === 0
                ? 'Comece pelo botão + no Dashboard. Depois os lançamentos aparecem aqui para revisão.'
                : 'Tente limpar os filtros ou volte ao Dashboard para conferir se o lançamento foi feito em outro recorte.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Dashboard
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                +
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Transações
              </span>
            </div>
          </div>
        )}

        {filteredAndSorted.map((t) => {
          const transactionState = classifyTransactionFinancialState(t);
          const transactionStateClass = transactionState === 'pending'
            ? TRANSACTION_LIST_CLASSES.statePending
            : transactionState === 'overdue'
              ? TRANSACTION_LIST_CLASSES.stateOverdue
              : TRANSACTION_LIST_CLASSES.stateConfirmed;

          return (
          <div 
            key={t.id} 
            onClick={() => setViewingTransaction(t)}
            className={`p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all cursor-pointer group ${selectedIds.has(t.id) ? TRANSACTION_LIST_CLASSES.rowSelected : transactionState === 'overdue' ? TRANSACTION_LIST_CLASSES.rowOverdue : TRANSACTION_LIST_CLASSES.rowUnselected}`}
          >
            <button 
              onClick={(e) => toggleSelect(t.id, e)}
              className={`shrink-0 transition-colors ${selectedIds.has(t.id) ? TRANSACTION_LIST_CLASSES.checkboxSelected : TRANSACTION_LIST_CLASSES.checkboxUnselected}`}
            >
              {selectedIds.has(t.id) ? <CheckSquare size={22} /> : <Square size={22} />}
            </button>
            <div className={`p-2.5 rounded-xl shrink-0 ${t.type === TransactionType.RECEITA ? TRANSACTION_LIST_CLASSES.categoryBadgeIncome : TRANSACTION_LIST_CLASSES.categoryBadgeExpense}`}>
              {getCategoryIcon(t.category)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium text-slate-800 dark:text-white text-sm tracking-tight truncate">{t.description}</h4>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${t.type === TransactionType.RECEITA ? TRANSACTION_LIST_CLASSES.typeIncomeBadge : TRANSACTION_LIST_CLASSES.typeExpenseBadge}`}>
                  {t.type}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-1 ${transactionStateClass}`}>
                  {transactionState === 'overdue' && <AlertTriangle size={8} className="shrink-0" />}
                  {formatFinancialStateLabel(transactionState)}
                </span>
                {t.generated && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] shrink-0">
                    <RefreshCw size={8} /> Recorrente
                  </span>
                )}
                {t.recurring && !t.generated && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-violet-50 dark:bg-violet-500/10 text-violet-500 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] shrink-0">
                    <RefreshCw size={8} /> Base
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-[0.16em] mt-1">{new Date(t.date).toLocaleDateString('pt-BR')} • {t.category}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-sm font-semibold ${t.type === TransactionType.RECEITA ? TRANSACTION_LIST_CLASSES.amountIncome : TRANSACTION_LIST_CLASSES.amountExpense}`}>{hideValues ? '••••' : formatVal(t.amount)}</span>
            </div>
          </div>
          );
        })}
      </div>

      {/* Toast de Cópia */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[300] transition-all duration-300 transform ${showCopyToast ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0 pointer-events-none'}`}>
        <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-semibold text-xs uppercase tracking-[0.08em] border border-white/20">
          <Check size={16} strokeWidth={3} /> Relatório copiado com sucesso!
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className={TRANSACTION_BULK_SURFACE}>
           <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
             <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white md:h-9 md:px-3 md:text-xs">
               <CheckSquare size={13} /> <span className="whitespace-nowrap">{selectedIds.size} Selecionados</span>
             </div>

             <div className="flex flex-1 items-center gap-1 overflow-x-auto">
               <button onClick={(e) => { e.stopPropagation(); setIsShareModalOpen(true); }} aria-label="Abrir compartilhamento do historico" className={`${TRANSACTION_BULK_BUTTON} shrink-0 text-emerald-300`}>
                 <Share2 size={15} />
                 <span className="hidden sm:inline">Relatório</span>
               </button>

               {canEdit && <button
                 onClick={(e) => { e.stopPropagation(); bulkDelete(); }}
                 aria-label="Excluir itens selecionados"
                 className={`${TRANSACTION_BULK_BUTTON} shrink-0 text-rose-300`}
               >
                 <Trash2 size={15} />
                 <span className="hidden sm:inline">Excluir</span>
               </button>}
             </div>

             <button
               onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set()); }}
               className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 transition-colors hover:bg-white/10 hover:text-white md:h-9 md:px-3 md:text-xs"
             >
               <X size={14} />
               <span className="hidden sm:inline">Limpar Seleção</span>
             </button>
           </div>
        </div>
      )}

      {isShareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`${MODAL_SURFACE} w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95`}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-white uppercase tracking-tight">Gerar Relatório</h3>
              <button onClick={() => { setIsShareModalOpen(false); setShowDestinations(false); }} className="p-1 text-slate-400"><X size={20} /></button>
            </div>
            {!showDestinations ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-400 uppercase tracking-[0.16em] ml-1">Tipo de Registro</label>
                  <div className="flex flex-wrap gap-2">
                    {['tudo', 'ganhos', 'gastos'].map(type => (
                      <button
                        key={type}
                        onClick={() => toggleShareFilter(shareTypes, setShareTypes, type)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-[0.08em] transition-all border ${shareTypes.has(type) ? TRANSACTION_LIST_CLASSES.shareTypeActive : TRANSACTION_LIST_CLASSES.shareTypeInactive}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-400 uppercase tracking-[0.16em] ml-1">Categorias</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleShareFilter(shareCategories, setShareCategories, 'tudo')}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-[0.08em] transition-all border ${shareCategories.has('tudo') ? TRANSACTION_LIST_CLASSES.shareTypeActive : TRANSACTION_LIST_CLASSES.shareTypeInactive}`}
                    >
                      Tudo
                    </button>
                    {Object.values(Category).map(cat => (
                      <button
                        key={cat}
                        onClick={() => toggleShareFilter(shareCategories, setShareCategories, cat.toLowerCase())}
                        className={`px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-[0.08em] transition-all border ${shareCategories.has(cat.toLowerCase()) ? TRANSACTION_LIST_CLASSES.shareTypeActive : TRANSACTION_LIST_CLASSES.shareTypeInactive}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={() => setShowDestinations(true)}
                  className={`w-full py-5 ${TRANSACTION_LIST_CLASSES.primaryAction} rounded-2xl font-semibold text-xs uppercase tracking-[0.08em] shadow-sm flex items-center justify-center gap-3 transition-all active:scale-95`}
                >
                  <Share2 size={18} strokeWidth={3} /> Compartilhar Agora
                </button>
              </div>
          ) : (
              <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom-2">
                {shareCopyDiagnostic && (
                  <div role="status" className="col-span-2 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">{shareCopyDiagnostic.title}</p>
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-100">{shareCopyDiagnostic.message}</p>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-600 dark:text-amber-300">Proximo passo: {shareCopyDiagnostic.suggestion}</p>
                  </div>
                )}
                <button onClick={() => void handleShare('whatsapp')} className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex flex-col items-center gap-2 hover:scale-105 transition-all">
                  <MessageCircle className="text-emerald-500" size={24} />
                  <span className="text-sm font-semibold text-emerald-600 uppercase tracking-[0.08em]">WhatsApp</span>
                </button>
                <button onClick={() => void handleShare('copy')} aria-label="Copiar texto do historico" className={`p-4 ${TRANSACTION_LIST_CLASSES.neutralShareTile}`}>
                  <FileText className="text-slate-500" size={24} />
                  <span className="text-sm font-semibold text-slate-600 uppercase tracking-[0.08em]">Copiar Texto</span>
                </button>
                <button onClick={() => void handleShare('csv')} className={`p-4 ${TRANSACTION_LIST_CLASSES.neutralShareTile}`}>
                  <Download className="text-slate-500" size={24} />
                  <span className="text-sm font-semibold text-slate-500 uppercase tracking-[0.08em]">Tabela CSV</span>
                </button>
                <button onClick={() => void handleShare('email')} className={`p-4 ${TRANSACTION_LIST_CLASSES.neutralShareTile}`}>
                  <Mail className="text-slate-500" size={24} />
                  <span className="text-sm font-semibold text-slate-500 uppercase tracking-[0.08em]">E-mail</span>
                </button>
                <button 
                  onClick={() => setShowDestinations(false)} 
                  className="col-span-2 py-3 text-sm font-semibold text-slate-400 uppercase tracking-[0.16em] mt-2"
                >
                  Voltar para filtros
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {editingTransaction && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-label="Editar Categoria">
          <div className={`${MODAL_SURFACE} w-full max-w-xs p-8 space-y-6 animate-in zoom-in-95`}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white uppercase tracking-tight" id="modal-title">Editar Categoria</h3>
              <button onClick={() => setEditingTransaction(null)} className="p-1 text-slate-400" aria-label="Fechar modal de edição de categoria"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-[0.16em] mb-1">Categoria</p>
                {suggestedCategory && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-full px-2 py-0.5">Sugestão IA: {suggestedCategory}</span>
                  </div>
                )}
                {suggestionDiagnostic && (
                  <div role="status" className="mb-2 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 p-3 space-y-1">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">{suggestionDiagnostic.title}</p>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-100">{suggestionDiagnostic.message}</p>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300">Próximo passo: {suggestionDiagnostic.suggestion}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(Category).map((cat, idx) => (
                    <button
                      key={cat}
                      type="button"
                      ref={idx === 0 ? firstCatBtnRef : undefined}
                      onClick={() => setEditCategoryValue(cat)}
                      className={`p-3 rounded-2xl border flex items-center gap-2 transition-all ${editCategoryValue === cat ? 'bg-slate-800 text-white border-slate-800 shadow-sm dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100' : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400'}`}
                      aria-label={`Selecionar categoria ${cat}`}
                    >
                      <span className="text-sm font-semibold uppercase tracking-tight truncate">{cat}</span>
                      {suggestedCategory === cat && (
                        <span className="ml-1 text-xs font-medium text-slate-400">(IA)</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveCategory}
                className={`flex-1 py-4 ${TRANSACTION_LIST_CLASSES.primaryAction} rounded-2xl font-semibold text-xs uppercase shadow-sm active:scale-95 transition-all disabled:opacity-60`}
                disabled={savingCategory || !editCategoryValue || editCategoryValue === editingTransaction.category}
                aria-label="Salvar categoria"
              >
                {savingCategory ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setEditingTransaction(null)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl font-semibold text-xs uppercase active:scale-95 transition-all" aria-label="Cancelar edição">Cancelar</button>
              {previousCategory && editCategoryValue !== previousCategory && (
                <button
                  onClick={() => {
                    setEditCategoryValue(previousCategory);
                    setTimeout(() => {
                      // Foca no botão salvar para garantir acessibilidade e evitar sumiço do botão por race condition
                      const btn = document.querySelector('[aria-label="Salvar categoria"]') as HTMLButtonElement;
                      btn?.focus();
                    }, 50);
                  }}
                  className="flex-1 py-4 bg-yellow-100 dark:bg-yellow-700 text-yellow-700 dark:text-yellow-100 rounded-2xl font-semibold text-xs uppercase active:scale-95 transition-all border border-yellow-300 dark:border-yellow-600"
                  aria-label="Desfazer alteração de categoria"
                >
                  Desfazer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast de categoria salva com botão de fechar manual */}
      <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[350] transition-all duration-300 transform ${showCategorySaved ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0 pointer-events-none'}`} role="status" aria-live="polite">
        <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-semibold text-xs uppercase tracking-[0.08em] border border-white/20">
          <Check size={16} strokeWidth={3} /> Categoria atualizada e IA treinada!
          <button ref={closeToastRef} onClick={() => setShowCategorySaved(false)} className="ml-2 p-1 rounded-full bg-white/20 hover:bg-white/40 transition-colors" aria-label="Fechar aviso de categoria salva"><X size={14} /></button>
        </div>
      </div>

      {categorySaveDiagnostic && (
        <div className="fixed top-36 left-1/2 -translate-x-1/2 z-[340] w-[min(92vw,34rem)]">
          <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-1 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">{categorySaveDiagnostic.title}</p>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-100">{categorySaveDiagnostic.message}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-600 dark:text-amber-300">Proximo passo: {categorySaveDiagnostic.suggestion}</p>
          </div>
        </div>
      )}

      {viewingTransaction && !isShareModalOpen && !transactionToDelete && !editingTransaction && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className={`${MODAL_SURFACE} w-full max-sm:rounded-3xl p-8 space-y-6 animate-in zoom-in-95`}>
            <div className="flex justify-between items-center">
              <div className={`p-2.5 ${TRANSACTION_LIST_CLASSES.neutralInfoBadge}`}><Info size={20} /></div>
              <button onClick={() => setViewingTransaction(null)} className="p-2 text-slate-400"><X size={20} /></button>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.08em]">Detalhes do Lançamento</p>
              <h3 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight mt-1">{viewingTransaction.description}</h3>
              <p className={`text-2xl font-semibold mt-2 ${viewingTransaction.type === TransactionType.RECEITA ? 'text-emerald-600' : 'text-rose-600'}`}>{formatVal(viewingTransaction.amount)}</p>
            </div>
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700">
               <div className="flex justify-between"><span className="text-xs font-semibold text-slate-400 uppercase">Categoria</span><span className="text-xs font-medium dark:text-white">{viewingTransaction.category}</span></div>
               <div className="flex justify-between"><span className="text-xs font-semibold text-slate-400 uppercase">Data</span><span className="text-xs font-medium dark:text-white">{new Date(viewingTransaction.date).toLocaleString('pt-BR')}</span></div>
               <div className="flex justify-between"><span className="text-xs font-semibold text-slate-400 uppercase">Tipo</span><span className="text-xs font-medium dark:text-white">{viewingTransaction.type}</span></div>
            </div>
            <div className="flex gap-2 pt-2">
               {canEdit && <button onClick={() => { setEditingTransaction(viewingTransaction); setViewingTransaction(null); }} className={`flex-1 py-4 ${TRANSACTION_LIST_CLASSES.primaryAction} rounded-2xl font-semibold text-xs uppercase shadow-sm active:scale-95 transition-all`}>Editar</button>}
               {canEdit && <button onClick={() => setTransactionToDelete(viewingTransaction)} className="flex-1 py-4 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-2xl font-semibold text-xs uppercase active:scale-95 transition-all">Excluir</button>}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão Individual */}
      {transactionToDelete && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[250] flex items-center justify-center p-4">
          <div className={`${MODAL_SURFACE} w-full max-w-[340px] p-8 space-y-6 animate-in zoom-in-95 text-center`}>
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-white uppercase tracking-tight">Confirmar Exclusão</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Você tem certeza que deseja excluir permanentemente o lançamento "<strong>{transactionToDelete.description}</strong>"?</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
               <button onClick={confirmDelete} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-semibold text-xs uppercase shadow-lg shadow-rose-200 dark:shadow-rose-900/20 active:scale-95 transition-all">Sim, Excluir</button>
               <button onClick={() => setTransactionToDelete(null)} className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl font-semibold text-xs uppercase active:scale-95 transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionList;






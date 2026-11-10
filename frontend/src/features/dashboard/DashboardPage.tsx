import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CreditCard, WalletCards } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { Account, Transaction } from '@/types/api'
const money = (amount: string, currency: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount))
export function DashboardPage() { const [accounts, setAccounts] = useState<Account[]>([]); const [transactions, setTransactions] = useState<Transaction[]>([]); const [selected, setSelected] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const account = useMemo(() => accounts.find(item => item.id === selected) ?? accounts[0], [accounts, selected])
  useEffect(() => {
  api.accounts()
    .then(items => {
      console.log('Accounts API response:', items);

      const safeAccounts = Array.isArray(items) ? items : [];

      setAccounts(safeAccounts);

      if (safeAccounts.length > 0) {
        setSelected(safeAccounts[0].id);
      }
    })
    .catch(cause => {
      setError(cause instanceof Error ? cause.message : 'Unable to load accounts');
    })
    .finally(() => setLoading(false));
}, []);


  useEffect(() => {
  if (!account) {
    setTransactions([]);
    return;
  }

  api.transactionHistory(account.id)
  .then(result => {
    console.log('Transaction API response:', result);
    setTransactions(result);
  })
  .catch(cause => {
    setError(
      cause instanceof Error
        ? cause.message
        : 'Unable to load activity'
    );
  });
}, [account]);


  if (loading) return <main className="mx-auto max-w-6xl p-6 text-sm text-muted">Loading your accounts…</main>
  return <main className="mx-auto max-w-6xl p-4 sm:p-6"><div className="mb-7"><p className="text-sm font-medium text-brand">Overview</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Your accounts</h1></div>{error && <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{accounts.length === 0 ? <Card className="p-6 text-sm text-muted">No accounts are available for this user.</Card> : <><div className="grid gap-4 md:grid-cols-3"><Card className="bg-gradient-to-br from-brand to-blue-800 p-6 text-white md:col-span-2"><div className="flex items-start justify-between"><div><p className="text-sm text-blue-100">Available balance</p><p className="mt-3 text-3xl font-bold">{money(account?.balance ?? '0', account?.currency ?? 'INR')}</p></div><CreditCard className="text-blue-100" /></div><div className="mt-9 flex items-end justify-between text-sm"><div><p className="text-blue-100">{account?.type} • •••• {account?.accountNumber.slice(-4)}</p><p className="mt-1 font-medium">{account?.status}</p></div><select value={account?.id ?? ''} onChange={event => setSelected(event.target.value)} className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-xs"><option value={account?.id}>{account?.type}</option>{accounts.filter(item => item.id !== account?.id).map(item => <option className="text-ink" key={item.id} value={item.id}>{item.type}</option>)}</select></div></Card><Card className="p-6"><WalletCards className="text-brand" /><p className="mt-5 text-sm text-muted">Accounts</p><p className="mt-1 text-3xl font-bold">{accounts.length}</p><p className="mt-4 text-sm text-muted">All balances are in their account currency.</p></Card></div><Card className="mt-5 overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-bold">Recent activity</h2><p className="mt-1 text-sm text-muted">Latest transactions for this account</p></div>{transactions.length === 0 ? <p className="p-5 text-sm text-muted">No transactions found yet.</p> : <ul>{transactions.map(item => <li className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0 sm:px-5" key={item.id}><span className={`grid size-10 place-items-center rounded-full ${item.direction === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{item.direction === 'IN' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.description || item.counterparty || item.type}</p><p className="text-xs text-muted">{new Date(item.createdAt).toLocaleDateString('en-IN')} · {item.status}</p></div><p className={`text-sm font-bold ${item.direction === 'IN' ? 'text-emerald-700' : 'text-ink'}`}>{item.direction === 'IN' ? '+' : '−'}{money(item.amount, account?.currency ?? 'INR')}</p></li>)}</ul>}</Card></>}</main> }

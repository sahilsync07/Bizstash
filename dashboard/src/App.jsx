import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  LayoutDashboard, TrendingUp, Users, Package, FileText,
  ArrowUpRight, ArrowDownRight, Search, Calendar, Menu, X,
  ChevronRight, Wallet, CreditCard, DollarSign, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Constants & Config ---
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const COMPANY_NAME = 'default_company';

// --- Utility Functions ---
const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

const formatDate = (dateStr) => {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const y = dateStr.substring(0, 4);
  const m = dateStr.substring(4, 6);
  const d = dateStr.substring(6, 8);
  return `${d}/${m}/${y}`;
};

const formatMonth = (yyyymm) => {
  const y = yyyymm.substring(0, 4);
  const m = yyyymm.substring(4, 6);
  const date = new Date(y, m - 1);
  return date.toLocaleString('default', { month: 'short', year: '2-digit' });
};

// --- Main Application Component ---
export default function App() {
  const [activeTab, setActiveTab] = useState('summary');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [targetLedger, setTargetLedger] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/${COMPANY_NAME}/data.json`)
      .then(res => res.json())
      .then(d => {
        setData(d.analysis);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load data", err);
        setLoading(false);
      });
  }, []);

  const handleDrillDown = (ledgerName) => {
    setTargetLedger(ledgerName);
    setActiveTab('ledger');
  };

  if (loading) return <LoadingScreen />;
  if (!data) return <ErrorScreen />;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        toggle={() => setSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header
          companyName={COMPANY_NAME}
          toggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'summary' && <SummaryDashboard data={data} onDrillDown={handleDrillDown} />}
                {activeTab === 'sales' && <SalesAnalytics data={data.monthlyStats} />}
                {activeTab === 'debtors' && <PartyAnalytics data={data.debtors} type="Debtors" color="orange" onDrillDown={handleDrillDown} />}
                {activeTab === 'creditors' && <PartyAnalytics data={data.creditors} type="Creditors" color="rose" onDrillDown={handleDrillDown} />}
                {activeTab === 'stocks' && <InventoryAnalytics data={data.stocks} />}
                {activeTab === 'ledger' && <LedgerView data={data} initialLedger={targetLedger} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

// --- Sidebar ---
function Sidebar({ activeTab, setActiveTab, isOpen, toggle }) {
  const menuItems = [
    { id: 'summary', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sales', label: 'Sales & Purchase', icon: TrendingUp },
    { id: 'debtors', label: 'Receivables', icon: Wallet },
    { id: 'creditors', label: 'Payables', icon: CreditCard },
    { id: 'stocks', label: 'Inventory', icon: Package },
    { id: 'ledger', label: 'Ledger Book', icon: FileText },
  ];

  return (
    <motion.aside
      animate={{ width: isOpen ? 260 : 80 }}
      className={`bg-slate-900 text-slate-300 flex flex-col shadow-xl z-30 transition-all duration-300 absolute md:relative h-full ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
    >
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-lg">T</span>
        </div>
        {isOpen && <span className="ml-3 font-bold text-white text-lg tracking-tight">Bizstash</span>}
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id); if (window.innerWidth < 768) toggle(); }}
            className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${activeTab === item.id
              ? 'bg-blue-600/10 text-blue-400 shadow-sm ring-1 ring-blue-600/20'
              : 'hover:bg-slate-800 hover:text-white'
              }`}
          >
            <item.icon size={22} className={`shrink-0 ${activeTab === item.id ? 'text-blue-500' : 'text-slate-500 group-hover:text-blue-400'}`} />
            {isOpen && <span className="ml-3 font-medium text-sm whitespace-nowrap">{item.label}</span>}
            {isOpen && activeTab === item.id && <ChevronRight size={14} className="ml-auto text-blue-500" />}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className={`flex items-center p-2 rounded-lg bg-slate-800/50 ${!isOpen && 'justify-center'}`}>
          <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
            <Users size={14} className="text-slate-400" />
          </div>
          {isOpen && (
            <div className="ml-3 overflow-hidden">
              <p className="text-xs font-medium text-white truncate">Admin User</p>
              <p className="text-[10px] text-slate-500 truncate">Default Company</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

// --- Header ---
function Header({ companyName, toggleSidebar, isSidebarOpen }) {
  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 flex justify-between items-center sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 md:hidden">
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest hidden md:block">Financial Year</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">2024-2026</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="md:flex hidden items-center bg-slate-100 rounded-full px-4 py-1.5 border border-slate-200">
          <Search size={14} className="text-slate-400 mr-2" />
          <input type="text" placeholder="Search..." className="bg-transparent border-none outline-none text-sm text-slate-600 w-32 focus:w-48 transition-all" />
        </div>
        <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse"></div>
      </div>
    </header>
  );
}

// --- Dashboard Component ---
function SummaryDashboard({ data, onDrillDown }) {
  const totalSales = Object.values(data.monthlyStats).reduce((acc, curr) => acc + curr.sales, 0);
  const totalPurchase = Object.values(data.monthlyStats).reduce((acc, curr) => acc + curr.purchase, 0);
  const totalDebtors = data.debtors.reduce((acc, curr) => acc + curr.balance, 0);
  const totalCreditors = data.creditors.reduce((acc, curr) => acc + curr.balance, 0);

  // Prepare Chart Data
  const chartData = Object.keys(data.monthlyStats).sort().map(k => ({
    name: formatMonth(k),
    Sales: data.monthlyStats[k].sales,
    Purchase: data.monthlyStats[k].purchase,
  }));

  const pieData = [
    { name: 'Debtors', value: totalDebtors },
    { name: 'Creditors', value: totalCreditors }
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Total Revenue" value={totalSales} trend="+12.5%" color="emerald" icon={TrendingUp} />
        <KpiCard title="Total Expenses" value={totalPurchase} trend="+4.2%" color="blue" icon={Activity} />
        <KpiCard title="Receivables" value={totalDebtors} trend="-2.1%" color="orange" icon={Wallet} />
        <KpiCard title="Payables" value={totalCreditors} trend="0.0%" color="rose" icon={CreditCard} />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Area Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Income vs Expense</h3>
              <p className="text-sm text-slate-500">Monthly financial performance</p>
            </div>
            <div className="flex gap-2">
              <span className="flex items-center text-xs text-emerald-600 font-medium"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-1" /> Sales</span>
              <span className="flex items-center text-xs text-blue-600 font-medium"><div className="w-2 h-2 rounded-full bg-blue-500 mr-1" /> Purchase</span>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPur" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(value) => `₹${value / 1000}k`} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Sales" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
                <Area type="monotone" dataKey="Purchase" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPur)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Liability Ratio</h3>
          <p className="text-sm text-slate-500 mb-6">Receivables vs Payables</p>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#f97316' : '#f43f5e'} />)}
                </Pie>
                <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-400">Total Receivables</p>
              <p className="font-bold text-orange-500">{formatCurrency(totalDebtors)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Payables</p>
              <p className="font-bold text-rose-500">{formatCurrency(totalCreditors)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ListBox
          title="Top 5 Outstanding Debtors"
          items={data.debtors.slice(0, 5)}
          type="money"
          icon={ArrowUpRight}
          color="text-orange-600"
          onDataClick={onDrillDown}
        />
        <ListBox
          title="Top 5 Selling Items"
          items={data.stocks.slice(0, 5).map(s => ({ name: s.name, balance: s.revenue, sub: s.qtySold + ' units' }))}
          type="money"
          icon={Package}
          color="text-emerald-600"
        />
      </div>
    </div>
  );
}

// --- Analytics Views ---

function SalesAnalytics({ data }) {
  const chartData = Object.keys(data).sort().map(k => ({
    name: formatMonth(k),
    Sales: data[k].sales,
    Purchase: data[k].purchase,
    Net: data[k].sales - data[k].purchase
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[400px] flex flex-col">
        <h3 className="text-lg font-bold text-slate-800 mb-6 shrink-0">Monthly Volume Analysis</h3>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(v) => `₹${v / 1000}k`} />
              <RechartsTooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="Sales" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Purchase" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <DataTable
          headers={['Month', 'Total Sales', 'Total Purchase', 'Net Profit/Loss']}
          rows={Object.keys(data).sort().map(k => {
            const net = data[k].sales - data[k].purchase;
            return [
              <span className="font-semibold text-slate-700">{formatMonth(k)}</span>,
              <span className="text-emerald-600 font-medium">{formatCurrency(data[k].sales)}</span>,
              <span className="text-blue-600 font-medium">{formatCurrency(data[k].purchase)}</span>,
              <span className={`font-bold ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(net)}</span>
            ]
          })}
        />
      </div>
    </div>
  );
}

function PartyAnalytics({ data, type, color, onDrillDown }) {
  const highRisk = data.filter(d => d.buckets.daysOver90 > 0).length;
  const total = data.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${color === 'orange' ? 'border-orange-500' : 'border-rose-500'}`}>
          <p className="text-slate-500 text-sm font-medium">Total Balance</p>
          <h3 className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(data.reduce((a, b) => a + b.balance, 0))}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-slate-300">
          <p className="text-slate-500 text-sm font-medium">Total Parties</p>
          <h3 className="text-2xl font-bold text-slate-800 mt-1">{total}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-red-500">
          <p className="text-slate-500 text-sm font-medium">High Risk (&gt;90 Days)</p>
          <h3 className="text-2xl font-bold text-red-600 mt-1">{highRisk} <span className="text-sm font-normal text-slate-400">parties</span></h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-800">{type} List</h3>
          <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">Sorted by Balance</span>
        </div>
        <DataTable
          headers={['Party Name', 'Balance', '< 30 Days', '30-90 Days', '> 90 Days']}
          onRowClick={(row) => onDrillDown(row[0])}
          rows={data.map(p => [
            p.name,
            <span className="font-bold text-slate-700">{formatCurrency(p.balance)}</span>,
            <span className="text-slate-500">{formatCurrency(p.buckets.days30)}</span>,
            <span className="text-orange-500 font-medium">{formatCurrency(p.buckets.days60 + p.buckets.days90)}</span>,
            <span className={`font-bold ${p.buckets.daysOver90 > 0 ? 'text-red-600' : 'text-slate-300'}`}>{formatCurrency(p.buckets.daysOver90)}</span>
          ])}
        />
      </div>
    </div>
  )
}

function InventoryAnalytics({ data }) {
  const topItems = data.slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[500px] flex flex-col">
        <h3 className="text-lg font-bold text-slate-800 mb-4 shrink-0">Top 20 Products by Revenue</h3>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={topItems} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: '#64748b' }} />
              <RechartsTooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// --- Ledger View (Tally Style) ---
function LedgerView({ data, initialLedger }) {
  const [selectedLedger, setSelectedLedger] = useState(initialLedger || '');
  const [startDate, setStartDate] = useState('2024-04-01');
  const [endDate, setEndDate] = useState('2026-03-31');
  const [showRunBal, setShowRunBal] = useState(true);

  // Sync prop
  useEffect(() => { if (initialLedger) setSelectedLedger(initialLedger); }, [initialLedger]);

  const viewData = useMemo(() => {
    if (!selectedLedger) return [];

    // Filter & Transform
    const txns = data.transactions
      .filter(t => t.ledgers.some(l => l.name === selectedLedger))
      .map(t => {
        const entry = t.ledgers.find(l => l.name === selectedLedger);
        const other = t.ledgers.find(l => l.name !== selectedLedger);
        if (!entry) return null;
        return {
          date: t.date,
          particulars: other ? other.name : t.type,
          type: t.type,
          no: t.number,
          debit: entry.amount > 0 ? entry.amount : 0,
          credit: entry.amount < 0 ? Math.abs(entry.amount) : 0,
          signed: entry.amount
        };
      })
      .filter(Boolean)
      .filter(r => r.date >= startDate.replaceAll('-', '') && r.date <= endDate.replaceAll('-', ''))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Running Balance (using opening if avail)
    let bal = data.ledgerOpenings?.[selectedLedger]?.openingBalance || 0;
    return txns.map(r => {
      bal += r.signed;
      return { ...r, balance: bal };
    });
  }, [selectedLedger, startDate, endDate]);

  const totals = viewData.reduce((acc, curr) => ({ dr: acc.dr + curr.debit, cr: acc.cr + curr.credit }), { dr: 0, cr: 0 });
  const closing = viewData.length > 0 ? viewData[viewData.length - 1].balance : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-140px)]">
      <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-end bg-slate-50/50 rounded-t-2xl">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Ledger Account</label>
          <select
            className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 shadow-sm"
            value={selectedLedger}
            onChange={e => setSelectedLedger(e.target.value)}
          >
            <option value="">Select Account...</option>
            {data.ledgersList?.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg p-2.5 shadow-sm" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg p-2.5 shadow-sm" />
        </div>
        <div className="flex items-center h-10 pb-1">
          <input type="checkbox" checked={showRunBal} onChange={e => setShowRunBal(e.target.checked)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300" />
          <span className="ml-2 text-sm text-slate-600 font-medium">Running Bal</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 w-32">Date</th>
              <th className="px-6 py-3">Particulars</th>
              <th className="px-6 py-3 w-32">Vch Type</th>
              <th className="px-6 py-3 w-24 text-right">Debit</th>
              <th className="px-6 py-3 w-24 text-right">Credit</th>
              {showRunBal && <th className="px-6 py-3 w-32 text-right">Balance</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {viewData.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-6 py-3 font-mono text-slate-500 text-xs">{formatDate(row.date)}</td>
                <td className="px-6 py-3 font-medium text-slate-700 group-hover:text-blue-700 cursor-pointer">{row.particulars}</td>
                <td className="px-6 py-3 text-slate-400 italic text-xs">{row.type}</td>
                <td className="px-6 py-3 text-right text-slate-700">{row.debit ? formatCurrency(row.debit) : '-'}</td>
                <td className="px-6 py-3 text-right text-slate-700">{row.credit ? formatCurrency(row.credit) : '-'}</td>
                {showRunBal && (
                  <td className={`px-6 py-3 text-right font-mono text-xs font-bold ${row.balance < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {formatCurrency(Math.abs(row.balance))} {row.balance < 0 ? 'Cr' : 'Dr'}
                  </td>
                )}
              </tr>
            ))}
            {viewData.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No transactions found</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-8 text-sm font-bold text-slate-700">
        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-400 font-normal uppercase">Measurements</span>
          <span>{viewData.length} Vouchers</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-400 font-normal uppercase">Total Debit</span>
          <span className="text-slate-800">{formatCurrency(totals.dr)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-400 font-normal uppercase">Total Credit</span>
          <span className="text-slate-800">{formatCurrency(totals.cr)}</span>
        </div>
        <div className="flex flex-col items-end pl-4 border-l border-slate-300">
          <span className="text-xs text-slate-400 font-normal uppercase">Closing Balance</span>
          <span className={`text-lg ${closing < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatCurrency(Math.abs(closing))} {closing < 0 ? 'Cr' : 'Dr'}
          </span>
        </div>
      </div>
    </div>
  )
}

// --- Shared Generic Components ---

function KpiCard({ title, value, trend, color, icon: Icon }) {
  const colorMap = {
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    orange: 'text-orange-600 bg-orange-50',
    rose: 'text-rose-600 bg-rose-50',
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colorMap[color]} bg-opacity-50`}>
          <Icon size={24} />
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {trend}
        </span>
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(value)}</h3>
      </div>
    </div>
  )
}

function ListBox({ title, items, icon: Icon, color, onDataClick }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Icon size={18} /></div>
        <h3 className="font-bold text-slate-800">{title}</h3>
      </div>
      <div className="space-y-4 flex-1">
        {items.map((item, i) => (
          <div
            key={i}
            onClick={() => onDataClick && onDataClick(item.name)}
            className={`flex justify-between items-center p-3 rounded-lg border border-transparent ${onDataClick ? 'hover:bg-slate-50 hover:border-slate-100 cursor-pointer' : ''}`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="text-xs font-bold text-slate-300 w-4">0{i + 1}</span>
              <div className="truncate">
                <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                {item.sub && <p className="text-xs text-slate-400">{item.sub}</p>}
              </div>
            </div>
            <span className={`text-sm font-bold whitespace-nowrap ${color}`}>{formatCurrency(item.balance)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DataTable({ headers, rows, onRowClick }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
          <tr>
            {headers.map((h, i) => <th key={i} className="px-6 py-4">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick && onRowClick(row.map(c => c.props?.children || c))} // Extract text if react node
              className={onRowClick ? 'hover:bg-blue-50/50 cursor-pointer transition-colors' : ''}
            >
              {row.map((cell, j) => <td key={j} className="px-6 py-4 text-slate-700">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl border border-slate-700">
        <p className="font-bold mb-2 text-slate-300">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400">{entry.name}:</span>
            <span className="font-mono font-bold">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-50 flex-col gap-4">
      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-500 font-medium animate-pulse">Synchronizing Ledger Data...</p>
    </div>
  )
}

function ErrorScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-50 flex-col gap-4">
      <X size={48} className="text-red-500" />
      <h2 className="text-xl font-bold text-slate-800">Connection Failed</h2>
      <p className="text-slate-500">Could not retrieve financial records. Please ensure standard Tally XML sync is active.</p>
    </div>
  )
}

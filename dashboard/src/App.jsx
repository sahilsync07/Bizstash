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

  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // 1. Fetch Company List
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/companies.json`)
      .then(res => res.json())
      .then(list => {
        setCompanies(list);
        if (list.length > 0) setSelectedCompany(list[list.length - 1]); // Default to latest
        else setLoading(false); // No companies found
      })
      .catch(err => {
        console.error("Failed to load company index", err);
        // Fallback to default if index missing
        setSelectedCompany({ id: 'default_company', name: 'Default Company' });
      });
  }, []);

  // 2. Fetch Data when Company Changes
  useEffect(() => {
    if (!selectedCompany) return;

    setLoading(true);
    fetch(`${import.meta.env.BASE_URL}data/${selectedCompany.id}/data.json`)
      .then(res => res.json())
      .then(d => {
        setData(d.analysis);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load data", err);
        setLoading(false);
        setData(null);
      });
  }, [selectedCompany]);

  const handleDrillDown = (ledgerName) => {
    setTargetLedger(ledgerName);
    setActiveTab('ledger');
  };

  if (loading) return <LoadingScreen />;
  if (!data && companies.length === 0) return <ErrorScreen message="No Companies Found. Please run sync script." />;
  if (!data) return <ErrorScreen message="Could not load financial records." />;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        toggle={() => setSidebarOpen(!isSidebarOpen)}
        companyName={selectedCompany?.name}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header
          companies={companies}
          selectedCompany={selectedCompany}
          onSelectCompany={(id) => setSelectedCompany(companies.find(c => c.id === id))}
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
                {activeTab === 'linemen' && <LinemanView data={data.debtors} onDrillDown={handleDrillDown} />}
                {activeTab === 'overdues' && <OverdueTable data={data.creditors} />}
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
function Sidebar({ activeTab, setActiveTab, isOpen, toggle, companyName }) {
  const menuItems = [
    { id: 'summary', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sales', label: 'Sales & Purchase', icon: TrendingUp },
    { id: 'debtors', label: 'Receivables', icon: Wallet },
    { id: 'creditors', label: 'Payables', icon: CreditCard },
    { id: 'stocks', label: 'Inventory', icon: Package },
    { id: 'overdues', label: 'Overdues', icon: Activity },
    { id: 'linemen', label: 'Linemen', icon: Users },
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
              <p className="text-xs font-medium text-white truncate">Active Profile</p>
              <p className="text-[10px] text-slate-500 truncate">{companyName || 'Loading...'}</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

// --- Header ---
function Header({ companies, selectedCompany, onSelectCompany, toggleSidebar, isSidebarOpen }) {
  // Format last sync time relative
  const lastSync = selectedCompany?.lastUpdated
    ? new Date(selectedCompany.lastUpdated).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 flex justify-between items-center sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 md:hidden">
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Company Switcher */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <select
              value={selectedCompany?.id || ''}
              onChange={(e) => onSelectCompany(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer hover:bg-slate-100 rounded px-1 -ml-1 transition-colors"
            >
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <p className="text-[10px] text-slate-400 font-medium ml-0.5">Last Sync: {lastSync}</p>
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, fast, slow, non-moving

  // KPI Calculations
  const totalStockValue = data.reduce((acc, curr) => acc + (curr.closingValue || 0), 0);
  const deadStockValue = data.filter(d => d.movement === 'Non-Moving').reduce((acc, curr) => acc + (curr.closingValue || 0), 0);
  const topItem = data.sort((a, b) => b.revenue - a.revenue)[0];

  // Charts Data
  const movementData = [
    { name: 'Fast Moving', value: data.filter(d => d.movement === 'Fast').length, color: '#10b981' },
    { name: 'Slow Moving', value: data.filter(d => d.movement === 'Slow').length, color: '#f59e0b' },
    { name: 'Non-Moving', value: data.filter(d => d.movement === 'Non-Moving').length, color: '#ef4444' }
  ];

  const abcData = [
    { name: 'Class A (High Value)', value: data.filter(d => d.class === 'A').length, color: '#3b82f6' },
    { name: 'Class B (Med Value)', value: data.filter(d => d.class === 'B').length, color: '#8b5cf6' },
    { name: 'Class C (Low Value)', value: data.filter(d => d.class === 'C').length, color: '#94a3b8' }
  ];

  const filteredData = data.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || item.movement.toLowerCase() === filter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Total Stock Valuation" value={totalStockValue} trend="Assets" color="emerald" icon={Package} />
        <KpiCard title="Dead Stock Value" value={deadStockValue} trend="Risk" color="rose" icon={Activity} />
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium">Top Revenue Generator</p>
            <h3 className="text-lg font-bold text-slate-800 mt-1 truncate">{topItem?.name || 'N/A'}</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-2">{formatCurrency(topItem?.revenue || 0)}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Movement Composition */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
          <h3 className="text-lg font-bold text-slate-800 mb-4 w-full">Stock Movement Analysis</h3>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={movementData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {movementData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ABC Analysis */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
          <h3 className="text-lg font-bold text-slate-800 mb-4 w-full">ABC Classification</h3>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={abcData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {abcData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
                <RechartsTooltip />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[500px]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 gap-4">
          <h3 className="font-bold text-slate-800">Detailed Stock Report</h3>

          <div className="flex items-center gap-4 flex-1 justify-end">
            {/* Search */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all max-w-sm w-full">
              <Search size={16} className="text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Search Item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-slate-700 w-full"
              />
            </div>
            {/* Filter Tabs */}
            <div className="flex bg-white rounded-lg border border-slate-200 p-1 shrink-0">
              {['all', 'Fast', 'Slow', 'Non-Moving'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs font-bold rounded-md capitalize transition-colors ${filter === f ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <DataTable
            headers={['Item Name', 'Inward', 'Outward', 'Closing Qty', 'Valuation', 'Class', 'Status']}
            rows={filteredData.map(item => [
              <span className="font-medium text-slate-700">{item.name}</span>,
              <span className="text-slate-500">{item.inwardQty}</span>,
              <span className="text-slate-500">{item.outwardQty}</span>,
              <span className="font-bold text-slate-800">{item.closingQty}</span>,
              <span className="font-bold text-emerald-600">{formatCurrency(item.closingValue)}</span>,
              <span className={`text-xs px-2 py-0.5 rounded font-bold border ${item.class === 'A' ? 'bg-blue-50 text-blue-600 border-blue-200' : item.class === 'B' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>Class {item.class}</span>,
              <span className={`text-xs font-bold ${item.movement === 'Fast' ? 'text-emerald-500' : item.movement === 'Slow' ? 'text-orange-500' : 'text-red-500'}`}>{item.movement}</span>
            ])}
          />
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
        if (!entry) return null;

        // Smart Particulars: Find ledger with opposite sign (Dr vs Cr) to identify the true source/dest
        // This prevents showing other co-parties in a compound voucher (e.g. multiple credits in one receipt)
        let other = t.ledgers.find(l =>
          l.name !== selectedLedger &&
          ((entry.amount > 0 && l.amount < 0) || (entry.amount < 0 && l.amount > 0))
        );

        // Fallback: If no opposite found (rare), just take the first different ledger
        if (!other) other = t.ledgers.find(l => l.name !== selectedLedger);

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

// --- Creditor Config ---
const getCreditDays = (partyName) => {
  const lower = partyName.toLowerCase();

  // Explicit Paragon check (or if group checking becomes available later)
  if (lower.includes('paragon')) return 30;

  if (lower.includes('action') || lower.includes('cubix')) return 60;

  return 60; // Default for all others
};

function OverdueTable({ data }) {
  const [filter, setFilter] = useState('all'); // all, overdue, due
  const [searchTerm, setSearchTerm] = useState('');

  const bills = useMemo(() => {
    const all = [];
    data.forEach(party => {
      // Use new 'openBills' structure which has netted amounts
      if (!party.openBills) return;

      party.openBills.forEach(bill => {
        // Date parsing: 'YYYYMMDD' from backend
        // Note: process_tally_v2 ensures bill.date IS a string YYYYMMDD
        const dateStr = bill.date;
        const y = dateStr.substring(0, 4);
        const m = dateStr.substring(4, 6);
        const d = dateStr.substring(6, 8);
        const bDate = new Date(`${y}-${m}-${d}`);

        const creditDays = getCreditDays(party.name);
        const dueDate = new Date(bDate);
        dueDate.setDate(dueDate.getDate() + creditDays);

        const today = new Date();
        const isOverdue = today > dueDate;
        const daysOver = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

        all.push({
          party: party.name,
          billNo: bill.name,
          billDate: bDate,
          amount: bill.amount,
          status: isOverdue ? 'Overdue' : 'Due',
          overdueDays: isOverdue ? daysOver : 0
        });
      });
    });
    return all.sort((a, b) => b.amount - a.amount);
  }, [data]);

  const filtered = bills.filter(b => {
    const matchesStatus = filter === 'all' ? true : b.status.toLowerCase() === filter;
    const matchesSearch = searchTerm === '' ? true :
      (b.party.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.billNo.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
      <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4 bg-slate-50">
        <h3 className="font-bold text-slate-800">Bill-wise Payables Analysis</h3>

        {/* Search Bar */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all flex-1 max-w-sm">
          <Search size={16} className="text-slate-400 mr-2" />
          <input
            type="text"
            placeholder="Search Party or Bill No..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-slate-700 w-full placeholder:text-slate-400"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="ml-2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-white rounded-lg border border-slate-200 p-1">
          {['all', 'overdue', 'due'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-bold rounded-md capitalize transition-colors ${filter === f ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <DataTable
          headers={['Party Name', 'Bill No', 'Bill Date', 'Status', 'Due Date', 'Amount', 'Overdue By']}
          rows={filtered.map(b => [
            <span className="font-medium text-slate-700">{b.party}</span>,
            <span className="font-mono text-xs text-slate-600">{b.billNo}</span>,
            <span className="font-mono text-xs text-slate-500">{b.billDate.toLocaleDateString('en-GB')}</span>,
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${b.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{b.status}</span>,
            <span className="font-mono text-xs text-slate-400">
              {new Date(b.billDate.getTime() + (getCreditDays(b.party) * 86400000)).toLocaleDateString('en-GB')}
            </span>,
            <span className="font-bold">{formatCurrency(b.amount)}</span>,
            <span className={`text-xs font-bold ${b.overdueDays > 0 ? 'text-red-500' : 'text-slate-300'}`}>{b.overdueDays > 0 ? `${b.overdueDays} Days` : '-'}</span>
          ])}
        />
      </div>
    </div>
  )
}

function DataTable({ headers, rows, onRowClick }) {
  return (
    <>
      {/* Desktop/Tablet View (Table) */}
      <div className="hidden md:block overflow-x-auto">
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
                onClick={() => onRowClick && onRowClick(row.map(c => c.props?.children || c))}
                className={onRowClick ? 'hover:bg-blue-50/50 cursor-pointer transition-colors' : ''}
              >
                {row.map((cell, j) => <td key={j} className="px-6 py-4 text-slate-700">{cell}</td>)}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="px-6 py-8 text-center text-slate-400">
                  No records found matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile View (Cards) */}
      <div className="md:hidden space-y-4 p-4 bg-slate-50">
        {rows.map((row, i) => (
          <div
            key={i}
            onClick={() => onRowClick && onRowClick(row.map(c => c.props?.children || c))}
            className={`bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3 ${onRowClick ? 'active:bg-slate-50' : ''}`}
          >
            {/* First Column is usually the Title (Party Name / Item Name) */}
            <div className="border-b border-slate-100 pb-2 mb-1">
              <h4 className="font-bold text-slate-800 text-base">{row[0]}</h4>
            </div>

            {/* Rest of the columns as Key-Value pairs */}
            <div className="grid grid-cols-2 gap-y-3 gap-x-2">
              {row.slice(1).map((cell, j) => (
                <div key={j} className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">{headers[j + 1]}</span>
                  <span className="text-sm text-slate-700 font-medium break-all">{cell}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="text-center py-8 text-slate-400">No records found.</div>
        )}
      </div>
    </>
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

function ErrorScreen({ message }) {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-50 flex-col gap-4">
      <X size={48} className="text-red-500" />
      <h2 className="text-xl font-bold text-slate-800">Connection Failed</h2>
      <p className="text-slate-500">{message || "Could not retrieve financial records. Please ensure standard Tally XML sync is active."}</p>
    </div>
  )
}

// --- Lineman View ---
const LINEMEN_CONFIG = [
  {
    name: "Sushant [Bobby]",
    lines: ["TIKIRI", "KASIPUR", "DURGI", "THERUBALI", "JK", "KALYAN SINGHPUR"],
    color: "bg-blue-500"
  },
  {
    name: "Dulamani Sahu",
    lines: ["BALIMELA", "CHITROKUNDA", "MALKANGIRI", "GUDARI", "GUNUPUR", "PARLAKHIMUNDI", "MUNIGUDA", "B.CTC", "PHULBAANI"],
    color: "bg-purple-500"
  },
  {
    name: "Aparna",
    lines: ["RAYAGADA", "LOCAL"],
    color: "bg-pink-500"
  },
  {
    name: "Raju",
    lines: ["JEYPUR", "PARVATHIPURAM", "KORAPUT", "SRIKAKULAM"],
    color: "bg-emerald-500"
  }
];

function LinemanView({ data, onDrillDown }) {
  const [selectedLineman, setSelectedLineman] = useState(null);

  const linemanData = useMemo(() => {
    if (!data) return [];
    return LINEMEN_CONFIG.map(config => {
      // Find all debtors belonging to this Lineman's lines
      const parties = data.filter(d => {
        if (!d.parentGroup) return false;
        const group = d.parentGroup.toUpperCase();
        return config.lines.some(l => group.includes(l)); // removed toUpperCase() since lines are already CAPS
      });

      const totalDue = parties.reduce((acc, curr) => acc + curr.balance, 0);
      const highRisk = parties.filter(p => p.buckets.daysOver90 > 0).length;

      return { ...config, parties, totalDue, highRisk };
    });
  }, [data]);

  const activeData = selectedLineman ? linemanData.find(l => l.name === selectedLineman) : null;

  return (
    <div className="space-y-6">
      {/* Linemen Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {linemanData.map((agent, i) => (
          <div
            key={i}
            onClick={() => setSelectedLineman(agent.name)}
            className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 cursor-pointer transition-all hover:shadow-md ${selectedLineman === agent.name ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className={`h-12 w-12 rounded-full ${agent.color} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>
                {agent.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-slate-800 truncate">{agent.name}</h3>
                <p className="text-xs text-slate-500">{agent.parties.length} Parties</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Total Due</span>
                <span className="font-bold text-slate-700">{formatCurrency(agent.totalDue)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">High Risk</span>
                <span className={`font-bold ${agent.highRisk > 0 ? 'text-red-600' : 'text-slate-500'}`}>{agent.highRisk}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail View */}
      {activeData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="font-bold text-lg text-slate-800">{activeData.name}'s Area</h3>
              <p className="text-sm text-slate-500 mt-1">
                Covering: {activeData.lines.join(', ')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase font-bold text-slate-400">Total Outstanding</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(activeData.totalDue)}</p>
            </div>
          </div>

          <DataTable
            headers={['Group / Line', 'Party Name', 'Balance', 'Status', 'Action']}
            rows={activeData.parties.sort((a, b) => b.balance - a.balance).map(p => [
              <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded inline-block">{p.parentGroup}</span>,
              <span className="font-medium text-slate-700">{p.name}</span>,
              <span className="font-bold text-slate-700">{formatCurrency(p.balance)}</span>,
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${p.status === 'Non-Performing' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {p.status}
              </span>,
              <button
                onClick={(e) => { e.stopPropagation(); onDrillDown(p.name); }}
                className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100 font-medium transition-colors"
              >
                View Ledger
              </button>
            ])}
          />
        </motion.div>
      )}
    </div>
  )
}

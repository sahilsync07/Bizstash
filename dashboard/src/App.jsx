import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  LayoutDashboard, TrendingUp, Users, Package, FileText,
  ArrowUpRight, ArrowDownRight, Search, Calendar, Menu, X,
  ChevronRight, Wallet, CreditCard, DollarSign, Activity, Zap, MessageSquare, PieChart as PieIcon,
  MapPin, BookOpen, LogOut, User, Settings, Filter, Download, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Constants & Config ---
const COLORS = ['#D9F575', '#C5C0F2', '#A3E635', '#FFA5A5', '#818CF8', '#F472B6'];

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
  // Default to closed on mobile (< 768px), open on desktop
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
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
    <div className="flex h-screen bg-flux-light text-flux-text font-sans overflow-hidden">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

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

        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-[1600px] mx-auto space-y-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
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
    { id: 'sales', label: 'Sales Metrics', icon: PieIcon },
    { id: 'debtors', label: 'Parties', icon: Users },
    { id: 'stocks', label: 'Inventory', icon: Package },
    { id: 'overdues', label: 'Overdues', icon: FileText, alert: true }, // Added Overdues
    { id: 'linemen', label: 'Lineman View', icon: MapPin },
    { id: 'ledger', label: 'Ledger Book', icon: BookOpen },
  ];

  return (
    <motion.aside
      animate={{ width: isOpen ? 280 : 90 }}
      className={`bg-flux-black text-slate-400 flex flex-col z-30 transition-all duration-300 absolute md:relative h-full rounded-r-[3rem] shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
    >
      <div className="h-24 flex items-center px-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 text-flux-lime flex items-center justify-center">
            {/* Bizstash Logo Icon */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 19h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16V9H4v2zm0-6v2h16V5H4z" />
            </svg>
          </div>
          {isOpen && <span className="font-bold text-white text-2xl tracking-tight">Bizstash</span>}
        </div>
      </div>



      <nav className="flex-1 px-6 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id); if (window.innerWidth < 768) toggle(); }}
            className={`w-full flex items-center p-4 rounded-full transition-all duration-200 group relative overflow-hidden ${activeTab === item.id
              ? 'bg-white text-flux-black font-bold shadow-lg transform scale-105' // Active: White, Fixed
              : 'hover:text-white'
              }`}
          >
            <item.icon size={22} className={`shrink-0 z-10 ${activeTab === item.id ? 'text-flux-black' : 'group-hover:text-flux-lime transition-colors'}`} />
            {isOpen && <span className="ml-4 font-medium text-[15px] z-10">{item.label}</span>}
            {isOpen && item.alert && <div className="ml-auto w-2 h-2 rounded-full bg-red-500 z-10 animate-pulse" />}
          </button>
        ))}
      </nav>

      {/* User Footer (Replacing Pro Plan) */}
      <div className="p-6 mt-auto">
        <div className="bg-white/5 p-4 rounded-3xl backdrop-blur-sm border border-white/5 flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-colors group">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-flux-lime to-emerald-400 flex items-center justify-center text-flux-black font-bold text-sm shadow-lg">
            AT
          </div>
          {isOpen && (
            <div className="flex-1 overflow-hidden">
              <h4 className="text-white font-bold text-sm truncate">Admin Test PC</h4>
              <p className="text-gray-400 text-xs truncate">Super Admin</p>
            </div>
          )}
          {isOpen && <LogOut size={16} className="text-gray-500 group-hover:text-red-400 transition-colors" />}
        </div>
      </div>
    </motion.aside>
  );
}

// --- Header ---
function Header({ companies, selectedCompany, onSelectCompany, toggleSidebar, isSidebarOpen }) {
  const currentDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="h-24 px-8 flex justify-between items-center sticky top-0 z-20 bg-flux-light/80 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-3 bg-white hover:bg-gray-50 rounded-full text-flux-black md:hidden shadow-sm transition-transform active:scale-95">
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="hidden md:block">
          <h1 className="text-3xl font-bold text-flux-black">Bizstash Analytics</h1>
          <p className="text-flux-text-dim text-sm font-medium">{currentDate}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <div className="hidden md:flex items-center bg-white rounded-full px-5 py-3 shadow-sm border-2 border-transparent focus-within:border-flux-lime/50 transition-all w-80">
          <Search size={18} className="text-flux-text-dim mr-3" />
          <input type="text" placeholder="Global Search..." className="bg-transparent border-none outline-none text-sm text-flux-black w-full placeholder:text-flux-text-dim font-medium" />
        </div>

        <div className="relative z-50">
          <div
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 bg-white rounded-full p-1.5 pr-5 shadow-sm cursor-pointer hover:shadow-md transition-all border border-gray-100"
          >
            <div className="h-10 w-10 rounded-full bg-flux-purple/20 flex items-center justify-center text-flux-purple font-bold border-2 border-white">
              AT
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-flux-black">{selectedCompany?.name || 'Select Company'}</span>
              <span className="text-[10px] text-flux-text-dim font-medium uppercase tracking-wider">Admin</span>
            </div>
            <ChevronRight size={14} className={`text-flux-text-dim ml-auto transition-transform ${showProfileMenu ? 'rotate-90' : ''}`} />
          </div>

          {/* Profile Dropdown */}
          <AnimatePresence>
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowProfileMenu(false)}></div>
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-14 w-64 bg-white rounded-[1.5rem] shadow-xl border border-gray-100 p-2 z-40 transform origin-top-right"
                >
                  <div className="px-4 py-3 border-b border-gray-50">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Switch Company</p>
                    <div className="space-y-1">
                      {companies.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { onSelectCompany(c.id); setShowProfileMenu(false); }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold flex items-center justify-between ${selectedCompany?.id === c.id ? 'bg-flux-lime/10 text-flux-black' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                          {c.name}
                          {selectedCompany?.id === c.id && <div className="w-2 h-2 rounded-full bg-flux-lime"></div>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-red-50 text-sm font-bold text-red-500 flex items-center gap-3 transition-colors">
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
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
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Total Revenue" value={totalSales} trend="+12.5%" icon={ArrowUpRight} accent="lime" />
        <KpiCard title="Total Expenses" value={totalPurchase} trend="+4.2%" icon={Activity} accent="purple" />
        <KpiCard title="Receivables" value={totalDebtors} trend="-2.1%" icon={Wallet} accent="blue" />
        <KpiCard title="Payables" value={totalCreditors} trend="0.0%" icon={CreditCard} accent="rose" />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Area Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-bold text-flux-black">Income vs Expense</h3>
              <p className="text-sm text-flux-text-dim mt-1">Monthly financial performance</p>
            </div>
            <div className="flex gap-3">
              <span className="flex items-center text-xs font-bold text-flux-black bg-flux-lime/20 px-3 py-1.5 rounded-full"><div className="w-2 h-2 rounded-full bg-flux-lime mr-2" /> Sales</span>
              <span className="flex items-center text-xs font-bold text-flux-black bg-flux-purple/20 px-3 py-1.5 rounded-full"><div className="w-2 h-2 rounded-full bg-flux-purple mr-2" /> Purchase</span>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D9F575" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#D9F575" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPur" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C5C0F2" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#C5C0F2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" strokeOpacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 500 }} tickFormatter={(value) => `₹${value / 1000}k`} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Sales" stroke="#A3E635" fillOpacity={1} fill="url(#colorSales)" strokeWidth={3} />
                <Area type="monotone" dataKey="Purchase" stroke="#818CF8" fillOpacity={1} fill="url(#colorPur)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Pie Chart */}
        <div className="bg-flux-black p-8 rounded-[2rem] shadow-xl flex flex-col relative overflow-hidden text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-flux-purple/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <h3 className="text-xl font-bold mb-1 relative z-10">Liability Ratio</h3>
          <p className="text-sm text-gray-400 mb-8 relative z-10">Receivables vs Payables</p>
          <div className="flex-1 min-h-[220px] relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#D9F575' : '#C5C0F2'} />)}
                </Pie>
                <RechartsTooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 text-center">
            <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm">
              <p className="text-[10px] text-gray-300 uppercase tracking-wider mb-1">Receivables</p>
              <p className="font-bold text-flux-lime text-sm lg:text-base">{formatCurrency(totalDebtors)}</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm">
              <p className="text-[10px] text-gray-300 uppercase tracking-wider mb-1">Payables</p>
              <p className="font-bold text-flux-purple text-sm lg:text-base">{formatCurrency(totalCreditors)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ListBox
          title="Top 5 Outstanding Debtors"
          items={data.debtors.slice(0, 5)}
          type="money"
          icon={ArrowUpRight}
          accent="orange"
          onDataClick={onDrillDown}
        />
        <ListBox
          title="Top 5 Selling Items"
          items={data.stocks.slice(0, 5).map(s => ({ name: s.name, balance: s.revenue, sub: s.qtySold + ' units' }))}
          type="money"
          icon={Package}
          accent="lime"
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
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2rem] shadow-sm h-[450px] flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-bold text-flux-black">Monthly Volume Analysis</h3>
          <button className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors"><Calendar size={20} className="text-gray-500" /></button>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontWeight: 500 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontWeight: 500 }} tickFormatter={(v) => `₹${v / 1000}k`} />
              <RechartsTooltip cursor={{ fill: '#F3F4F6', radius: 8 }} content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
              <Bar dataKey="Sales" fill="#D9F575" radius={[8, 8, 8, 8]} maxBarSize={50} />
              <Bar dataKey="Purchase" fill="#C5C0F2" radius={[8, 8, 8, 8]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-gray-100">
        <DataTable
          headers={['Month', 'Total Sales', 'Total Purchase', 'Net Profit/Loss']}
          rows={Object.keys(data).sort().map(k => {
            const net = data[k].sales - data[k].purchase;
            return [
              <span className="font-bold text-flux-black">{formatMonth(k)}</span>,
              <span className="text-flux-black font-medium">{formatCurrency(data[k].sales)}</span>,
              <span className="text-flux-text-dim font-medium">{formatCurrency(data[k].purchase)}</span>,
              <span className={`font-bold px-3 py-1 rounded-full text-xs ${net >= 0 ? 'bg-flux-lime/20 text-flux-black' : 'bg-red-100 text-red-600'}`}>{formatCurrency(net)}</span>
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
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm relative overflow-hidden group">
          <div className={`absolute top-0 left-0 w-2 h-full ${type === 'Debtors' ? 'bg-orange-400' : 'bg-rose-400'} group-hover:w-full transition-all duration-500 opacity-10`}></div>
          <p className="text-flux-text-dim text-sm font-medium relative z-10">Total Balance</p>
          <h3 className="text-3xl font-bold text-flux-black mt-2 relative z-10">{formatCurrency(data.reduce((a, b) => a + b.balance, 0))}</h3>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
          <p className="text-flux-text-dim text-sm font-medium">Total Parties</p>
          <h3 className="text-3xl font-bold text-flux-black mt-2">{total}</h3>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 relative">
          <div className="absolute top-4 right-4 text-red-100"><Activity size={48} /></div>
          <p className="text-flux-text-dim text-sm font-medium">High Risk (&gt;90 Days)</p>
          <h3 className="text-3xl font-bold text-red-500 mt-2">{highRisk} <span className="text-sm font-normal text-gray-400">parties</span></h3>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-xl text-flux-black">{type} List</h3>
          <span className="text-xs bg-flux-light px-3 py-1.5 rounded-full text-flux-text-dim font-medium">Sorted by Balance</span>
        </div>
        <DataTable
          headers={['Party Name', 'Balance', '< 30 Days', '30-90 Days', '> 90 Days']}
          onRowClick={(row) => onDrillDown(row[0])}
          rows={data.map(p => [
            p.name,
            <span className="font-bold text-flux-black">{formatCurrency(p.balance)}</span>,
            <span className="text-gray-400">{formatCurrency(p.buckets.days30)}</span>,
            <span className="text-orange-500 font-medium">{formatCurrency(p.buckets.days60 + p.buckets.days90)}</span>,
            <span className={`font-bold ${p.buckets.daysOver90 > 0 ? 'text-red-500' : 'text-gray-200'}`}>{formatCurrency(p.buckets.daysOver90)}</span>
          ])}
        />
      </div>
    </div>
  )
}

// --- Inventory Logic ---
const categorizeMovement = (item) => {
  // Parsing dates YYYYMMDD or Date objects
  // Fallback to random/mock if missing for demo, BUT logic is implemented as requested
  const now = new Date();
  const parseDate = (d) => {
    if (!d) return null;
    if (typeof d === 'string' && d.length === 8) {
      return new Date(`${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`);
    }
    return new Date(d);
  };

  const lastSale = parseDate(item.lastSaleDate);
  // const lastPurchase = parseDate(item.lastPurchaseDate); // Available for future logic

  if (!lastSale) return 'Non-Moving'; // No sale ever

  const diffTime = Math.abs(now - lastSale);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) return 'Fast';
  if (diffDays <= 90) return 'Slow';
  return 'Non-Moving';
};

function InventoryAnalytics({ data }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, fast, slow, non-moving

  // Enhance data with FSN Logic
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      movement: categorizeMovement(item)
    }));
  }, [data]);

  // KPI Calculations
  const totalStockValue = processedData.reduce((acc, curr) => acc + (curr.closingValue || 0), 0);
  const deadStockValue = processedData.filter(d => d.movement === 'Non-Moving').reduce((acc, curr) => acc + (curr.closingValue || 0), 0);
  const topItem = processedData.sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];

  // Charts Data
  const movementData = [
    { name: 'Fast', value: processedData.filter(d => d.movement === 'Fast').length, color: '#D9F575' },
    { name: 'Slow', value: processedData.filter(d => d.movement === 'Slow').length, color: '#C5C0F2' },
    { name: 'Non-Moving', value: processedData.filter(d => d.movement === 'Non-Moving').length, color: '#FFA5A5' }
  ];

  const filteredData = processedData.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || item.movement.toLowerCase() === filter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Total Stock Valuation" value={totalStockValue} trend="Assets" icon={Package} accent="lime" />
        <KpiCard title="Dead Stock Value" value={deadStockValue} trend="Risk" icon={Activity} accent="rose" />
        <div className="bg-flux-black p-8 rounded-[2rem] shadow-sm text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-flux-lime rounded-full blur-3xl opacity-20"></div>
          <div>
            <p className="text-gray-400 text-sm font-medium">Top Revenue Generator</p>
            <h3 className="text-xl font-bold text-white mt-1 truncate">{topItem?.name || 'N/A'}</h3>
          </div>
          <p className="text-3xl font-bold text-flux-lime mt-4">{formatCurrency(topItem?.revenue || 0)}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Movement Composition */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center">
          <h3 className="text-xl font-bold text-flux-black mb-4 w-full">Stock Movement</h3>
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={movementData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {movementData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* List Preview */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-xl font-bold text-flux-black mb-4">Quick Stats</h3>
          <div className="space-y-4">
            {movementData.map(m => (
              <div key={m.name} className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: m.color }}></div>
                  <span className="font-medium text-flux-black">{m.name} items</span>
                </div>
                <span className="font-bold text-lg">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
        <div className="p-6 border-b border-gray-100 flex flex-wrap justify-between items-center bg-white gap-4">
          <h3 className="font-bold text-xl text-flux-black">Detailed Stock Report</h3>

          <div className="flex items-center gap-4 flex-1 justify-end">
            {/* Search */}
            <div className="flex items-center bg-gray-50 rounded-full px-4 py-2 border border-transparent focus-within:border-flux-lime/50 transition-all max-w-sm w-full">
              <Search size={16} className="text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="Search Item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-flux-black w-full"
              />
            </div>
            {/* Filter Tabs */}
            <div className="flex bg-gray-100 rounded-full p-1 shrink-0">
              {['all', 'Fast', 'Slow', 'Non-Moving'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-full capitalize transition-all ${filter === f ? 'bg-white text-flux-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <DataTable
            headers={['Item Name', 'In', 'Out', 'Closing', 'Valuation', 'Status']}
            rows={filteredData.map(item => [
              <span className="font-medium text-flux-black">{item.name}</span>,
              <span className="text-gray-400">{item.inwardQty}</span>,
              <span className="text-gray-400">{item.outwardQty}</span>,
              <span className="font-bold text-flux-black">{item.closingQty}</span>,
              <span className="font-bold text-white bg-flux-black px-2 py-1 rounded-lg text-xs tracking-wide">{formatCurrency(item.closingValue)}</span>,
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${item.movement === 'Fast' ? 'bg-flux-lime/20 text-emerald-700' : item.movement === 'Slow' ? 'bg-flux-purple/20 text-indigo-700' : 'bg-red-100 text-red-500'}`}>{item.movement}</span>
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

    // Filter & Transform logic remains same...
    const txns = data.transactions
      .filter(t => t.ledgers.some(l => l.name === selectedLedger))
      .map(t => {
        const entry = t.ledgers.find(l => l.name === selectedLedger);
        if (!entry) return null;
        let other = t.ledgers.find(l =>
          l.name !== selectedLedger &&
          ((entry.amount > 0 && l.amount < 0) || (entry.amount < 0 && l.amount > 0))
        );
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

    let bal = data.ledgerOpenings?.[selectedLedger]?.openingBalance || 0;
    return txns.map(r => {
      bal += r.signed;
      return { ...r, balance: bal };
    });
  }, [selectedLedger, startDate, endDate]);

  const totals = viewData.reduce((acc, curr) => ({ dr: acc.dr + curr.debit, cr: acc.cr + curr.credit }), { dr: 0, cr: 0 });
  const closing = viewData.length > 0 ? viewData[viewData.length - 1].balance : 0;

  return (
    <div className="bg-white rounded-[2rem] shadow-sm flex flex-col h-[calc(100vh-140px)] overflow-hidden border border-gray-100">
      <div className="p-6 border-b border-gray-100 flex flex-wrap gap-4 items-end bg-gray-50/50">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Ledger Account</label>
          <select
            className="w-full bg-white border-0 ring-1 ring-gray-200 text-flux-black text-sm rounded-xl focus:ring-2 focus:ring-flux-lime p-3 font-semibold"
            value={selectedLedger}
            onChange={e => setSelectedLedger(e.target.value)}
          >
            <option value="">Select Account...</option>
            {data.ledgersList?.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white ring-1 ring-gray-200 text-flux-black text-sm rounded-xl p-3 border-0" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white ring-1 ring-gray-200 text-flux-black text-sm rounded-xl p-3 border-0" />
        </div>
        <div className="flex items-center h-12 pb-1">
          <input type="checkbox" checked={showRunBal} onChange={e => setShowRunBal(e.target.checked)} className="w-5 h-5 text-flux-lime rounded focus:ring-flux-lime border-gray-300" />
          <span className="ml-2 text-sm text-flux-black font-bold">Running Bal</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-bold sticky top-0 z-10">
            <tr>
              <th className="px-8 py-4 w-32 rounded-l-xl">Date</th>
              <th className="px-8 py-4">Particulars</th>
              <th className="px-8 py-4 w-32">Type</th>
              <th className="px-8 py-4 w-32 text-right">Debit</th>
              <th className="px-8 py-4 w-32 text-right">Credit</th>
              {showRunBal && <th className="px-8 py-4 w-40 text-right rounded-r-xl">Balance</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {viewData.map((row, i) => (
              <tr key={i} className="hover:bg-flux-lime/5 transition-colors group">
                <td className="px-8 py-4 font-mono text-gray-400 text-xs">{formatDate(row.date)}</td>
                <td className="px-8 py-4 font-bold text-flux-black group-hover:text-black cursor-pointer">{row.particulars}</td>
                <td className="px-8 py-4 text-gray-400 text-xs uppercase tracking-wide">{row.type}</td>
                <td className="px-8 py-4 text-right text-flux-black font-medium">{row.debit ? formatCurrency(row.debit) : '-'}</td>
                <td className="px-8 py-4 text-right text-flux-text font-medium">{row.credit ? formatCurrency(row.credit) : '-'}</td>
                {showRunBal && (
                  <td className={`px-8 py-4 text-right font-mono text-xs font-bold ${row.balance < 0 ? 'text-flux-black bg-flux-lime/20 rounded-lg' : 'text-gray-500'}`}>
                    {formatCurrency(Math.abs(row.balance))} {row.balance < 0 ? 'Cr' : 'Dr'}
                  </td>
                )}
              </tr>
            ))}
            {viewData.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-gray-300 font-bold text-xl">Select a ledger to view transactions</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Shared Generic Components ---

function KpiCard({ title, value, trend, accent = 'lime', icon: Icon }) {
  const accentColors = {
    lime: 'bg-flux-lime text-flux-black',
    purple: 'bg-flux-purple text-flux-black',
    blue: 'bg-blue-100 text-blue-700',
    rose: 'bg-rose-100 text-rose-700',
    orange: 'bg-orange-100 text-orange-700'
  }

  return (
    <div className="bg-white p-6 pb-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 group">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3.5 rounded-2xl ${accentColors[accent]} bg-opacity-100 transition-transform group-hover:scale-110 duration-300`}>
          <Icon size={24} />
        </div>
        <span className={`text-xs font-extrabold px-3 py-1.5 rounded-full ${trend.startsWith('+') ? 'bg-flux-lime/30 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
          {trend}
        </span>
      </div>
      <div>
        <p className="text-gray-400 text-sm font-bold mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-flux-black tracking-tight">{formatCurrency(value)}</h3>
      </div>
    </div>
  )
}

function ListBox({ title, items, icon: Icon, accent = 'lime', onDataClick }) {
  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2.5 rounded-xl ${accent === 'lime' ? 'bg-flux-lime text-flux-black' : 'bg-orange-100 text-orange-600'}`}><Icon size={20} /></div>
        <h3 className="font-bold text-xl text-flux-black">{title}</h3>
      </div>
      <div className="space-y-4 flex-1">
        {items.map((item, i) => (
          <div
            key={i}
            onClick={() => onDataClick && onDataClick(item.name)}
            className={`flex justify-between items-center p-4 rounded-2xl border border-transparent transition-all ${onDataClick ? 'hover:bg-gray-50 hover:border-gray-200 cursor-pointer hover:shadow-sm' : ''}`}
          >
            <div className="flex items-center gap-4 overflow-hidden">
              <span className="text-xs font-bold text-gray-300 w-6">0{i + 1}</span>
              <div className="truncate">
                <p className="text-base font-bold text-flux-black truncate mb-0.5">{item.name}</p>
                {item.sub && <p className="text-xs text-gray-400 font-medium">{item.sub}</p>}
              </div>
            </div>
            <span className={`text-sm font-bold whitespace-nowrap bg-gray-50 px-3 py-1.5 rounded-lg`}>{formatCurrency(item.balance)}</span>
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
    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
      <div className="p-6 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4 bg-gray-50/50">
        <h3 className="font-bold text-xl text-flux-black">Bill-wise Payables Analysis</h3>

        {/* Search Bar */}
        <div className="flex items-center bg-white border border-gray-200 rounded-xl px-4 py-2 focus-within:ring-2 focus-within:ring-flux-lime/50 transition-all flex-1 max-w-sm">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search Party or Bill No..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-flux-black w-full placeholder:text-gray-400 font-medium"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="ml-2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-white rounded-xl border border-gray-200 p-1">
          {['all', 'overdue', 'due'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg capitalize transition-colors ${filter === f ? 'bg-flux-black text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
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
            <span className="font-bold text-flux-black">{b.party}</span>,
            <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{b.billNo}</span>,
            <span className="font-mono text-xs text-gray-400">{b.billDate.toLocaleDateString('en-GB')}</span>,
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${b.status === 'Overdue' ? 'bg-red-100 text-red-600' : 'bg-flux-lime/20 text-emerald-700'}`}>{b.status}</span>,
            <span className="font-mono text-xs text-gray-400">
              {new Date(b.billDate.getTime() + (getCreditDays(b.party) * 86400000)).toLocaleDateString('en-GB')}
            </span>,
            <span className="font-bold text-flux-black">{formatCurrency(b.amount)}</span>,
            <span className={`text-xs font-bold ${b.overdueDays > 0 ? 'text-red-500' : 'text-gray-300'}`}>{b.overdueDays > 0 ? `${b.overdueDays} Days` : '-'}</span>
          ])}
        />
      </div>
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
  const [viewMode, setViewMode] = useState('combined'); // 'combined' | 'grouped'
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const linemanData = useMemo(() => {
    if (!data) return [];
    return LINEMEN_CONFIG.map(config => {
      // Find all debtors belonging to this Lineman's lines
      const parties = data.filter(d => {
        if (!d.parentGroup) return false;
        const group = d.parentGroup.toUpperCase();
        return config.lines.some(l => group.includes(l));
      });

      const totalDue = parties.reduce((acc, curr) => acc + curr.balance, 0);
      const highRisk = parties.filter(p => p.buckets.daysOver90 > 0).length;

      // Group parties by Line for 'grouped' view
      const partiesByLine = parties.reduce((acc, curr) => {
        const group = curr.parentGroup || 'Uncategorized';
        if (!acc[group]) acc[group] = [];
        acc[group].push(curr);
        return acc;
      }, {});

      return { ...config, parties, partiesByLine, totalDue, highRisk };
    });
  }, [data]);

  const activeData = selectedLineman ? linemanData.find(l => l.name === selectedLineman) : null;

  return (
    <div className="space-y-8">
      {/* Linemen Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {linemanData.map((agent, i) => (
          <div
            key={i}
            onClick={() => setSelectedLineman(agent.name)}
            className={`bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 ${selectedLineman === agent.name ? 'ring-2 ring-flux-lime ring-offset-2' : ''}`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className={`h-12 w-12 rounded-full ${agent.color} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>
                {agent.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-flux-black truncate">{agent.name}</h3>
                <p className="text-xs text-gray-500 font-medium">{agent.parties.length} Parties</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-medium">Total Due</span>
                <span className="font-bold text-flux-black">{formatCurrency(agent.totalDue)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-medium">High Risk</span>
                <span className={`font-bold ${agent.highRisk > 0 ? 'text-red-500' : 'text-gray-300'}`}>{agent.highRisk}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail View */}
      {activeData && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-8 border-b border-gray-100 flex flex-wrap justify-between items-center bg-gray-50/50 gap-4">
            <div>
              <h3 className="font-bold text-xl text-flux-black">{activeData.name}'s Area</h3>
              <p className="text-sm text-gray-400 mt-1 font-medium">
                Covering: {activeData.lines.join(', ')}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* View Toggle */}
              <div className="bg-gray-100 p-1 rounded-xl flex items-center">
                <button
                  onClick={() => setViewMode('combined')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'combined' ? 'bg-white text-flux-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Combined
                </button>
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'grouped' ? 'bg-white text-flux-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Grouped (By Line)
                </button>
              </div>

              <div className="text-right pl-4 border-l border-gray-200">
                <p className="text-xs uppercase font-bold text-gray-400">Total Outstanding</p>
                <p className="text-3xl font-bold text-flux-lime text-shadow-sm">{formatCurrency(activeData.totalDue)}</p>
              </div>
            </div>
          </div>

          {viewMode === 'combined' ? (
            <DataTable
              headers={['Group / Line', 'Party Name', 'Balance', 'Status', 'Action']}
              rows={activeData.parties.sort((a, b) => b.balance - a.balance).map(p => [
                <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded inline-block">{p.parentGroup}</span>,
                <span className="font-bold text-flux-black">{p.name}</span>,
                <span className="font-medium text-flux-black">{formatCurrency(p.balance)}</span>,
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${p.status === 'Non-Performing' ? 'bg-red-100 text-red-700' : 'bg-flux-lime/20 text-emerald-700'}`}>
                  {p.status}
                </span>,
                <button
                  onClick={(e) => { e.stopPropagation(); onDrillDown(p.name); }}
                  className="text-xs bg-flux-black/5 text-flux-black px-3 py-1.5 rounded-lg hover:bg-flux-black hover:text-white font-bold transition-all"
                >
                  View Ledger
                </button>
              ])}
            />
          ) : (
            <div className="p-4 space-y-4">
              {Object.entries(activeData.partiesByLine).map(([line, parties]) => {
                const isExpanded = expandedGroups[line];
                const lineTotal = parties.reduce((sum, p) => sum + p.balance, 0);

                return (
                  <div key={line} className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
                    <div
                      onClick={() => toggleGroup(line)}
                      className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors bg-gray-50/30"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        <h4 className="font-bold text-flux-black">{line}</h4>
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold">{parties.length}</span>
                      </div>
                      <div className="font-bold text-flux-black">{formatCurrency(lineTotal)}</div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-gray-100 table-auto w-full">
                            <DataTable
                              headers={['Party Name', 'Balance', 'Status', 'Action']}
                              rows={parties.sort((a, b) => b.balance - a.balance).map(p => [
                                <span className="font-bold text-gray-700 pl-8">{p.name}</span>,
                                <span className="font-medium text-gray-700">{formatCurrency(p.balance)}</span>,
                                <span className={`text-xs px-2 py-1 rounded-full font-bold ${p.status === 'Non-Performing' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                  {p.status}
                                </span>,
                                <button
                                  onClick={(e) => { e.stopPropagation(); onDrillDown(p.name); }}
                                  className="text-xs text-blue-600 font-bold hover:underline"
                                >
                                  View
                                </button>
                              ])}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-flux-light flex-col gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-flux-lime/30 border-t-flux-lime rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 bg-white rounded-full"></div>
        </div>
      </div>
      <p className="text-flux-text-dim font-bold animate-pulse tracking-wide">INITIALIZING BIZSTASH...</p>
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div className="flex items-center justify-center h-screen bg-flux-light flex-col gap-6">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-2">
        <X size={40} />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-flux-black mb-2">Connection Failed</h2>
        <p className="text-flux-text-dim max-w-md">{message || "Could not retrieve financial records. Please ensure standard Tally XML sync is active."}</p>
      </div>
      <button onClick={() => window.location.reload()} className="px-6 py-2 bg-flux-black text-white rounded-full font-bold text-sm hover:scale-105 transition-transform">
        Retry Connection
      </button>
    </div>
  )
}

function DataTable({ headers, rows, onRowClick }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            {headers.map((h, i) => (
              <th key={i} className="p-4 text-sm font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-gray-50/50 first:pl-8 last:pr-8">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={i} onClick={() => onRowClick && onRowClick(row)} className={`group transition-colors ${onRowClick ? 'hover:bg-blue-50/30 cursor-pointer' : ''}`}>
              {row.map((cell, j) => (
                <td key={j} className="p-4 text-sm first:pl-8 last:pr-8 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="p-8 text-center text-gray-400 font-medium">
                No records found matching criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-flux-black text-white p-4 rounded-xl shadow-xl border border-white/10">
        <p className="text-sm font-bold mb-2 text-gray-400">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
            <span className="text-xs font-medium">{p.name}: </span>
            <span className="text-sm font-bold">{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

import { useState, useEffect } from 'react';
import { Search, Filter, ChevronRight, Eye, FileText, X, Calendar, Hash, Type } from 'lucide-react';
import { motion } from 'framer-motion';

const VOUCHER_TYPES = [
  'Tax Invoice', 'Purchase', 'Receipt', 'Payment',
  'Journal', 'Contra', 'Credit Note', 'Debit Note'
];

const TYPE_COLORS = {
  'Tax Invoice': 'bg-blue-100 text-blue-800',
  'Purchase': 'bg-orange-100 text-orange-800',
  'Receipt': 'bg-green-100 text-green-800',
  'Payment': 'bg-purple-100 text-purple-800',
  'Journal': 'bg-yellow-100 text-yellow-800',
  'Contra': 'bg-pink-100 text-pink-800',
  'Credit Note': 'bg-red-100 text-red-800',
  'Debit Note': 'bg-indigo-100 text-indigo-800'
};

// Stale-While-Revalidate caching utility
const fetchWithSWR = async (url, cacheName = 'bizstash-data') => {
  try {
    // Try to get from cache first
    if ('caches' in window) {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(url);

      // Return cached data immediately if available
      if (cachedResponse) {
        const cachedData = await cachedResponse.json();

        // Fetch fresh data in background (don't await)
        fetch(url)
          .then(res => res.json())
          .then(data => {
            cache.put(url, new Response(JSON.stringify(data)));
            // Could dispatch event here to notify component of refresh
          })
          .catch(err => console.warn('Background refresh failed:', err));

        return cachedData;
      }
    }

    // If no cache, fetch and cache
    const response = await fetch(url);
    const data = await response.json();

    if ('caches' in window) {
      const cache = await caches.open(cacheName);
      cache.put(url, new Response(JSON.stringify(data)));
    }

    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

export default function BillsBrowser({ vouchers: propVouchers }) {
  const [bills, setBills] = useState([]);
  const [allBills, setAllBills] = useState(propVouchers || []); // Store all bills for client-side filtering
  const [loading, setLoading] = useState(!propVouchers);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [page, setPage] = useState(0);
  const [totalBills, setTotalBills] = useState(0);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isCached, setIsCached] = useState(false);

  const limit = 20;

  // Sync with prop changes
  useEffect(() => {
    if (propVouchers) {
      setAllBills(propVouchers);
      setLoading(false);
    }
  }, [propVouchers]);


  // Filter and paginate when search/type changes
  useEffect(() => {
    filterAndPaginate();
    setPage(0);
  }, [selectedType, search, allBills]);


  const filterAndPaginate = () => {
    let filtered = allBills;

    // Filter by type
    if (selectedType && selectedType !== 'all') {
      filtered = filtered.filter(v => v.type === selectedType);
    }

    // Filter by search
    if (search) {
      filtered = filtered.filter(v =>
        (v.referenceNumber && v.referenceNumber.toLowerCase().includes(search.toLowerCase())) ||
        (v.date && v.date.includes(search))
      );
    }

    // Paginate
    const startIdx = page * limit;
    const endIdx = startIdx + limit;
    const paginatedBills = filtered.slice(startIdx, endIdx);

    setBills(paginatedBills);
    setTotalBills(filtered.length);
  };

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    return `${d}/${m}/${y}`;
  };

  const formatProperCase = (text) => {
    if (!text) return text;
    const words = text.toLowerCase().split(' ');
    return words.map(word => {
      if (word === 'm/s') return 'M/s';
      if (word.startsWith('(')) return '(' + word.charAt(1).toUpperCase() + word.slice(2);
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  const handleViewBill = (bill) => {
    setSelectedBill(bill);
    setShowDetail(true);
  };

  const totalPages = Math.ceil(totalBills / limit);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-3xl font-bold text-flux-black">Bills & Vouchers</h2>
          <p className="text-flux-text-dim text-sm mt-1">
            Browse all {totalBills.toLocaleString()} bills {isCached && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-2 inline">📦 Cached</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by reference number or date (YYYYMMDD)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-flux-lime"
          />
        </div>

        {/* Type Filter */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Voucher Type</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedType === 'all'
                ? 'bg-flux-lime text-flux-black'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              All Types
            </button>
            {VOUCHER_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedType === type
                  ? `${TYPE_COLORS[type]} font-bold`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bills Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin">
            <div className="h-12 w-12 border-4 border-flux-lime border-t-transparent rounded-full" />
          </div>
        </div>
      ) : bills.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600 font-medium">No bills found</p>
          <p className="text-gray-500 text-sm mt-1">Try adjusting your search filters</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Reference</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Details</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bills.map((bill, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${TYPE_COLORS[bill.type] || 'bg-gray-100 text-gray-700'}`}>
                        {bill.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-flux-black font-medium">{formatDate(bill.date)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {bill.referenceNumber || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {bill.details && Array.isArray(bill.details) && bill.details.length > 0
                        ? `${bill.details.length} line(s)`
                        : '0 lines'
                      }
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleViewBill(bill)}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-flux-lime text-flux-black font-medium text-sm hover:bg-opacity-90 transition-all"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, totalBills)} of {totalBills.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-flux-black font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm font-medium text-gray-600">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 rounded-lg bg-flux-lime text-flux-black font-medium hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bill Detail Modal */}
      <AnimatePresence>
        {showDetail && selectedBill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[100]"
            onClick={() => setShowDetail(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2.5rem] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
            >
              {/* Decorative Header Bar */}
              <div className={`h-3 w-full ${selectedBill.type === 'Receipt' ? 'bg-green-400' :
                selectedBill.type === 'Payment' ? 'bg-purple-500' :
                  selectedBill.type === 'Journal' ? 'bg-amber-500' :
                    selectedBill.type === 'Tax Invoice' ? 'bg-blue-500' :
                      selectedBill.type === 'Contra' ? 'bg-teal-500' : 'bg-gray-400'
                }`} />

              {/* Main Header */}
              <div className="flex justify-between items-start p-8 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-3xl font-black text-flux-black tracking-tight">{selectedBill.type.toUpperCase()}</h3>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${TYPE_COLORS[selectedBill.type] || 'bg-gray-100 text-gray-700'}`}>
                      Digital Voucher
                    </span>
                  </div>
                  <p className="text-flux-text-dim font-bold text-sm tracking-wide">
                    Voucher No: <span className="text-flux-black">{selectedBill.referenceNumber || 'N/A'}</span>
                  </p>
                </div>
                <button
                  onClick={() => setShowDetail(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-flux-black"
                >
                  <X size={28} />
                </button>
              </div>

              {/* Body Content */}
              <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-8 custom-scrollbar">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100 space-y-1">
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                      <Calendar size={14} className="opacity-50" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Transaction Date</span>
                    </div>
                    <p className="text-xl font-black text-flux-black">{formatDate(selectedBill.date)}</p>
                  </div>
                  <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100 space-y-1">
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                      <Hash size={14} className="opacity-50" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Reference Code</span>
                    </div>
                    <p className="text-xl font-black text-flux-black truncate">{selectedBill.referenceNumber || '—'}</p>
                  </div>
                </div>

                {/* Ledger Entries Table */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Accounting Details</h4>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-bold">
                      {selectedBill.details?.length || 0} Entries
                    </span>
                  </div>

                  <div className="border border-gray-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-100">
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Particulars</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Debit</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selectedBill.details && selectedBill.details.length > 0 ? (
                          selectedBill.details.map((detail, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-6 py-4">
                                <p className="font-bold text-flux-black text-sm group-hover:text-flux-lime transition-colors">
                                  {formatProperCase(detail.ledger || detail.account || 'Unnamed Ledger')}
                                </p>
                                {detail.description && (
                                  <p className="text-[10px] text-gray-400 mt-1 font-medium italic">{detail.description}</p>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {detail.debit ? (
                                  <span className="text-sm font-black text-flux-black">₹{Math.abs(detail.debit).toLocaleString('en-IN')}</span>
                                ) : <span className="text-gray-200">—</span>}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {detail.credit ? (
                                  <span className="text-sm font-black text-flux-black">₹{Math.abs(detail.credit).toLocaleString('en-IN')}</span>
                                ) : <span className="text-gray-200">—</span>}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" className="px-6 py-12 text-center">
                              <Type className="mx-auto text-gray-200 mb-3 opacity-50" size={32} />
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No accounting lines captured</p>
                              <p className="text-[10px] text-gray-300 mt-1">Check if the sync pulled complete data</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {/* Footer Totals */}
                      {selectedBill.details?.length > 0 && (
                        <tfoot className="bg-gray-50/30 font-bold border-t border-gray-100">
                          <tr>
                            <td className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-gray-400">Total</td>
                            <td className="px-6 py-4 text-right text-sm font-black text-flux-black">
                              ₹{selectedBill.details.reduce((acc, d) => acc + (d.debit || 0), 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-black text-flux-black">
                              ₹{selectedBill.details.reduce((acc, d) => acc + (d.credit || 0), 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* Inventory Table (if applicable) */}
                {selectedBill.inventory && selectedBill.inventory.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] px-2">Inventory Items</h4>
                    <div className="border border-gray-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50/80 border-b border-gray-100">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Stock Item</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Quantity</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {selectedBill.inventory.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-bold text-flux-black text-sm">{formatProperCase(item.name)}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">@ ₹{(item.rate || 0).toLocaleString('en-IN')}</p>
                              </td>
                              <td className="px-6 py-4 text-right font-black text-flux-black text-sm">
                                {item.qty}
                              </td>
                              <td className="px-6 py-4 text-right font-black text-flux-lime text-sm">
                                ₹{item.amount.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Narration */}
                {selectedBill.narration && (
                  <div className="bg-flux-black rounded-3xl p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3">Narration / Memo</h4>
                    <p className="text-sm font-medium leading-relaxed italic text-gray-200">
                      "{selectedBill.narration}"
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2 group cursor-help">
                  <Activity size={16} className="text-flux-lime animate-pulse" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-flux-black transition-colors">
                    Verified Digital Record
                  </span>
                </div>
                <button
                  onClick={() => setShowDetail(false)}
                  className="px-8 py-3 bg-flux-black text-white rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

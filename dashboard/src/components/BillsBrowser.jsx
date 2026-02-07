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

export default function BillsBrowser() {
  const [bills, setBills] = useState([]);
  const [allBills, setAllBills] = useState([]); // Store all bills for client-side filtering
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [page, setPage] = useState(0);
  const [totalBills, setTotalBills] = useState(0);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isCached, setIsCached] = useState(false);

  const limit = 20;

  // Fetch bills once on mount
  useEffect(() => {
    loadBills();
  }, []);

  // Filter and paginate when search/type changes
  useEffect(() => {
    filterAndPaginate();
    setPage(0);
  }, [selectedType, search, allBills]);

  const loadBills = async () => {
    setLoading(true);
    try {
      const dataUrl = `${import.meta.env.BASE_URL}data/vouchers.json`;
      
      // Use stale-while-revalidate strategy
      const data = await fetchWithSWR(dataUrl);
      
      const vouchers = data.data ? Object.values(data.data) : [];
      setAllBills(vouchers);
      setTotalBills(vouchers.length);
      
      // Check if this came from cache
      if ('caches' in window) {
        const cache = await caches.open('bizstash-data');
        const match = await cache.match(dataUrl);
        setIsCached(!!match);
      }
    } catch (error) {
      console.error('Failed to fetch bills:', error);
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

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
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedType === 'all'
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
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedType === type
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
      {showDetail && selectedBill && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowDetail(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div>
                <h3 className="text-2xl font-bold text-flux-black">Bill Details</h3>
                <p className="text-gray-600 text-sm mt-1">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-2 ${TYPE_COLORS[selectedBill.type] || 'bg-gray-100 text-gray-700'}`}>
                    {selectedBill.type}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar size={20} className="text-flux-lime mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-bold">Date</p>
                    <p className="text-lg font-bold text-flux-black mt-1">{formatDate(selectedBill.date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Hash size={20} className="text-flux-lime mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-bold">Reference</p>
                    <p className="text-lg font-bold text-flux-black mt-1">{selectedBill.referenceNumber || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              {selectedBill.details && Array.isArray(selectedBill.details) && selectedBill.details.length > 0 ? (
                <div>
                  <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">Line Items ({selectedBill.details.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedBill.details.map((detail, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-flux-black">{detail.ledger || detail.account || 'Unnamed'}</p>
                            {detail.description && (
                              <p className="text-xs text-gray-600 mt-1">{detail.description}</p>
                            )}
                          </div>
                          {detail.amount && (
                            <span className="font-bold text-flux-lime">
                              ₹{detail.amount.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        {detail.debit !== undefined || detail.credit !== undefined ? (
                          <div className="mt-2 text-xs text-gray-600 flex gap-4">
                            {detail.debit !== undefined && (
                              <span>Debit: ₹{detail.debit.toLocaleString('en-IN')}</span>
                            )}
                            {detail.credit !== undefined && (
                              <span>Credit: ₹{detail.credit.toLocaleString('en-IN')}</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-600">
                  No line items available
                </div>
              )}

              {/* JSON Preview */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">Raw Data</h4>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto max-h-40">
                  {JSON.stringify(selectedBill, null, 2)}
                </pre>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    return `${d}/${m}/${y}`;
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
          <p className="text-flux-text-dim text-sm mt-1">Browse all {totalBills.toLocaleString()} bills</p>
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
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-flux-lime"
          />
        </div>

        {/* Type Filter */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Voucher Type</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedType('all');
                setPage(0);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedType === 'all'
                  ? 'bg-flux-lime text-flux-black'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Types
            </button>
            {VOUCHER_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => {
                  setSelectedType(type);
                  setPage(0);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedType === type
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
      {showDetail && selectedBill && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowDetail(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div>
                <h3 className="text-2xl font-bold text-flux-black">Bill Details</h3>
                <p className="text-gray-600 text-sm mt-1">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-2 ${TYPE_COLORS[selectedBill.type] || 'bg-gray-100 text-gray-700'}`}>
                    {selectedBill.type}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar size={20} className="text-flux-lime mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-bold">Date</p>
                    <p className="text-lg font-bold text-flux-black mt-1">{formatDate(selectedBill.date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Hash size={20} className="text-flux-lime mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-bold">Reference</p>
                    <p className="text-lg font-bold text-flux-black mt-1">{selectedBill.referenceNumber || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              {selectedBill.details && Array.isArray(selectedBill.details) && selectedBill.details.length > 0 ? (
                <div>
                  <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">Line Items ({selectedBill.details.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedBill.details.map((detail, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-flux-black">{detail.ledger || detail.account || 'Unnamed'}</p>
                            {detail.description && (
                              <p className="text-xs text-gray-600 mt-1">{detail.description}</p>
                            )}
                          </div>
                          {detail.amount && (
                            <span className="font-bold text-flux-lime">
                              ₹{detail.amount.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        {detail.debit !== undefined || detail.credit !== undefined ? (
                          <div className="mt-2 text-xs text-gray-600 flex gap-4">
                            {detail.debit !== undefined && (
                              <span>Debit: ₹{detail.debit.toLocaleString('en-IN')}</span>
                            )}
                            {detail.credit !== undefined && (
                              <span>Credit: ₹{detail.credit.toLocaleString('en-IN')}</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-600">
                  No line items available
                </div>
              )}

              {/* JSON Preview */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">Raw Data</h4>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto max-h-40">
                  {JSON.stringify(selectedBill, null, 2)}
                </pre>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

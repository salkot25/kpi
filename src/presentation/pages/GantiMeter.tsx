import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Search, 
  Filter, 
  RotateCw, 
  Eye, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  Wrench, 
  Gauge, 
  Clock,
  TrendingUp
} from 'lucide-react';
import { borderRadius, shadows } from '../../design-system/tokens';
import { GasP2TLRepository } from '../../data/repositories/gas-p2tl.repository';
import type { P2TLGantiMeterRecord } from '../../core/entities/report.entity';

const p2tlRepository = new GasP2TLRepository();

export const GantiMeter: React.FC = () => {
  const [records, setRecords] = useState<P2TLGantiMeterRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // empty initially for smart default
  const [selectedYear, setSelectedYear] = useState<string>('');   // empty initially for smart default
  const [selectedDayDate, setSelectedDayDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedSort, setSelectedSort] = useState<'date_desc' | 'date_asc'>('date_desc');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalFiltered: 0,
    totalPages: 1
  });

  // Backend stats, breakdown & metadata states
  const [stats, setStats] = useState({ todayCount: 0, monthCount: 0, yearCount: 0 });
  const [reasonsBreakdown, setReasonsBreakdown] = useState<Array<{ reason: string; count: number }>>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([String(new Date().getFullYear())]);

  // Detail Modal state
  const [selectedRecord, setSelectedRecord] = useState<P2TLGantiMeterRecord | null>(null);

  // Search debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch data from backend
  const fetchGantiMeterData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const isInitial = selectedMonth === '' && selectedYear === '';
      const response = await p2tlRepository.getGantiMeter({
        page: currentPage,
        limit: itemsPerPage,
        month: selectedMonth || undefined,
        year: selectedYear || undefined,
        search: debouncedSearch || undefined,
        day: selectedDayDate || undefined,
        sort: selectedSort,
        smartDefault: isInitial ? 'true' : 'false'
      });

      if (response.status === 'success') {
        setRecords(response.records || []);
        if (response.pagination) {
          setPagination(response.pagination);
        }
        if (response.stats) {
          setStats({
            todayCount: response.stats.todayCount || 0,
            monthCount: response.stats.monthCount || 0,
            yearCount: response.stats.yearCount || 0
          });
        }
        if (response.reasonsBreakdown) {
          setReasonsBreakdown(response.reasonsBreakdown);
        }
        if (response.availableYears) {
          setAvailableYears(response.availableYears);
        }

        // If it was the initial load, sync dropdown selectors with appliedMonth/appliedYear from server
        if (isInitial) {
          setSelectedMonth(response.appliedMonth || 'all');
          setSelectedYear(response.appliedYear || 'all');
        }
      } else {
        setErrorMsg('Gagal mengambil data: ' + (response as any).message);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal terhubung ke API Google Sheets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGantiMeterData();
  }, [currentPage, itemsPerPage, debouncedSearch, selectedMonth, selectedYear, selectedDayDate, selectedSort]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedMonth('all');
    setSelectedYear('all');
    setSelectedDayDate('');
    setSelectedSort('date_desc');
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Month names helper for selector
  const monthsList = [
    { value: '01', name: 'Januari' },
    { value: '02', name: 'Februari' },
    { value: '03', name: 'Maret' },
    { value: '04', name: 'April' },
    { value: '05', name: 'Mei' },
    { value: '06', name: 'Juni' },
    { value: '07', name: 'Juli' },
    { value: '08', name: 'Agustus' },
    { value: '09', name: 'September' },
    { value: '10', name: 'Oktober' },
    { value: '11', name: 'November' },
    { value: '12', name: 'Desember' }
  ];

  const totalPages = pagination.totalPages;
  const totalFiltered = pagination.totalFiltered;

  return (
    <div className="space-y-6">
      
      {/* 1. Page Header Banner */}
      <div className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${borderRadius.xxl} ${shadows.md} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-50">Monitoring Penggantian kWh Meter</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
            Dashboard analisis data penggantian kWh meter berdasarkan data terintegrasi sheet 'Ganti Meter'.
          </p>
        </div>
        <button
          onClick={fetchGantiMeterData}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 ${borderRadius.xl} transition-all`}
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* 2. Dynamic statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Today Card */}
        <div className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${borderRadius.xxl} ${shadows.md} relative overflow-hidden group`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-sky-500/10 to-indigo-500/10 rounded-full blur-xl transform translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">HARI INI</span>
            <div className="p-2 bg-sky-500/10 text-sky-500 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 group-hover:text-sky-500 transition-colors">{stats.todayCount}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">Meter diganti hari ini</p>
          </div>
        </div>

        {/* Month Card */}
        <div className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${borderRadius.xxl} ${shadows.md} relative overflow-hidden group`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-yellow-500/10 rounded-full blur-xl transform translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">BULAN INI</span>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 group-hover:text-amber-500 transition-colors">{stats.monthCount}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">Meter diganti bulan ini</p>
          </div>
        </div>

        {/* Year Card */}
        <div className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${borderRadius.xxl} ${shadows.md} relative overflow-hidden group`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-xl transform translate-x-8 -translate-y-8 group-hover:scale-125 transition-transform duration-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">TAHUN INI</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 group-hover:text-emerald-500 transition-colors">{stats.yearCount}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">Total penggantian tahunan</p>
          </div>
        </div>

      </div>

      {/* 3. Filters and Search Section */}
      <div className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${borderRadius.xxl} ${shadows.md} space-y-4`}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Filter Pencarian & Data</h3>
          </div>
          {(searchTerm || selectedMonth !== 'all' || selectedYear !== 'all' || selectedDayDate) && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-extrabold text-rose-500 hover:text-rose-600 transition-colors"
            >
              Reset Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          
          {/* Quick Search */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari IDPEL, Nama, Agenda..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
              }}
              className="w-full pl-9 pr-4 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Month Filter */}
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 transition-all"
          >
            <option value="all">Semua Bulan</option>
            {monthsList.map(m => (
              <option key={m.value} value={m.value}>{m.name}</option>
            ))}
          </select>

          {/* Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 transition-all"
          >
            <option value="all">Semua Tahun</option>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Day Date Filter */}
          <div className="relative flex items-center w-full">
            <input
              type="date"
              value={selectedDayDate}
              onChange={(e) => {
                setSelectedDayDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-3 pr-8 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 transition-all"
            />
            {selectedDayDate && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDayDate('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 rounded-md transition-colors"
                title="Hapus Tanggal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Filter */}
          <select
            value={selectedSort}
            onChange={(e) => {
              setSelectedSort(e.target.value as 'date_desc' | 'date_asc');
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 transition-all"
          >
            <option value="date_desc">Tanggal Terbaru</option>
            <option value="date_asc">Tanggal Terlama</option>
          </select>

        </div>
      </div>

      {/* 4. Chart & Table Layout (Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Reasons Chart (Col-span 4) */}
        <div className={`lg:col-span-4 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${borderRadius.xxl} ${shadows.md} flex flex-col`}>
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Komposisi Alasan Penggantian</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Pemicu utama penggantian kWh meter</p>
          </div>

          {reasonsBreakdown.length === 0 ? (
            <div className="flex-grow flex items-center justify-center py-12 text-slate-500 text-xs font-semibold text-center">
              Tidak ada data untuk filter aktif.
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1">
              {reasonsBreakdown.map((item, idx) => {
                const maxCount = reasonsBreakdown[0]?.count || 1;
                const percent = totalFiltered > 0 ? Math.round((item.count / totalFiltered) * 100) : 0;
                const barWidth = `${(item.count / maxCount) * 100}%`;
                
                const barColors = [
                  'from-sky-500 to-indigo-500',
                  'from-amber-400 to-yellow-500',
                  'from-emerald-400 to-teal-500',
                  'from-rose-400 to-pink-500',
                  'from-purple-400 to-indigo-500',
                  'from-orange-400 to-red-500',
                  'from-cyan-400 to-sky-500',
                  'from-violet-400 to-purple-500',
                ];
                const activeColor = barColors[idx % barColors.length];

                return (
                  <div key={item.reason} className="group">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-tight">{item.reason}</span>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                        {item.count} <span className="text-emerald-500 dark:text-emerald-400">({percent}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${activeColor} rounded-full transition-all duration-500 group-hover:brightness-110`}
                        style={{ width: barWidth }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Replacements Table (Col-span 8) */}
        <div className={`lg:col-span-8 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${borderRadius.xxl} ${shadows.md} flex flex-col`}>
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800 mb-3 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Daftar Data Penggantian kWh Meter</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Ditemukan <span className="text-emerald-500 font-bold">{totalFiltered}</span> rekaman data penggantian</p>
            </div>
          </div>

          <div className="flex-grow overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RotateCw className="w-8 h-8 text-emerald-500 animate-spin" />
                <span className="text-xs font-bold text-slate-500">Memuat data 'Ganti Meter'...</span>
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-20 text-slate-500 text-xs font-semibold">
                Tidak ada data penggantian kWh meter ditemukan.
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[560px]">
                <thead>
                  <tr className="border-b-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3">IDPEL / NAMA</th>
                    <th className="py-2.5 px-3">ALASAN PENGGANTIAN</th>
                    <th className="py-2.5 px-3">METER BARU</th>
                    <th className="py-2.5 px-3 text-center w-12">AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, index) => {
                    const rowNo = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <tr key={rec.noagenda + '-' + rec.idpel} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 text-xs font-bold text-slate-300 dark:text-slate-600">{rowNo}</td>
                        <td className="py-3 px-3">
                          <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 tracking-wide">{rec.idpel}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 truncate max-w-[180px]">{rec.nama}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase leading-tight">
                            {rec.alasanGantiMeter || 'Lainnya'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{rec.noMeterBaru || '-'}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{rec.merkMeterBaru || '-'}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setSelectedRecord(rec)}
                            className="p-1.5 hover:bg-sky-50 dark:hover:bg-sky-500/10 text-sky-500 rounded-lg transition-colors inline-flex items-center justify-center"
                            title="Lihat Detail Lengkap"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Controls */}
          {totalFiltered > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3 flex flex-wrap items-center justify-between gap-3">
              
              {/* Rows Per Page & Info */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Baris:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 text-[10px] font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 transition-all"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-[10px] text-slate-400 font-medium">
                  {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, totalFiltered)} dari <span className="font-bold text-slate-600 dark:text-slate-300">{totalFiltered}</span>
                </span>
              </div>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors text-slate-500"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {(() => {
                  const pageNumbers: number[] = [];
                  if (totalPages <= 5) {
                    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
                  } else {
                    pageNumbers.push(1);
                    let start = Math.max(2, currentPage - 1);
                    let end = Math.min(totalPages - 1, currentPage + 1);
                    if (currentPage <= 2) end = 4;
                    else if (currentPage >= totalPages - 1) start = totalPages - 3;
                    if (start > 2) pageNumbers.push(-1);
                    for (let i = start; i <= end; i++) pageNumbers.push(i);
                    if (end < totalPages - 1) pageNumbers.push(-2);
                    pageNumbers.push(totalPages);
                  }
                  return pageNumbers.map((pageNum, idx) => {
                    if (pageNum < 0) {
                      return <span key={`e-${idx}`} className="px-1 text-slate-300 text-xs select-none">…</span>;
                    }
                    return (
                      <button
                        key={`p-${pageNum}`}
                        onClick={() => handlePageChange(pageNum)}
                        className={`min-w-[28px] h-7 px-1.5 text-xs font-bold rounded-lg border transition-all ${
                          currentPage === pageNum
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  });
                })()}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors text-slate-500"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* 5. Detail Modal Dialog */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${borderRadius.xxl} ${shadows.xl} w-full max-w-2xl max-h-[90vh] flex flex-col`}>
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                  <Gauge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-50 uppercase tracking-wider">Detail Penggantian kWh Meter</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">No. Agenda: {selectedRecord.noagenda}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 select-text text-slate-700 dark:text-slate-300">
              
              {/* Category 1: Informasi Pelanggan */}
              <div>
                <h4 className="text-xs font-black tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-500" />
                  <span>Informasi Pelanggan</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/60 dark:border-slate-850">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">ID Pelanggan</span>
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{selectedRecord.idpel}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Nama Pelanggan</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{selectedRecord.nama}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Alamat</span>
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{selectedRecord.alamat}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Tarif / Daya</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{selectedRecord.tarif} / {selectedRecord.daya} VA</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Pembatas Meter</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">KDPEMBMETER: {selectedRecord.kdpembmeter || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Category 2: Detail Penggantian */}
              <div>
                <h4 className="text-xs font-black tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  <span>Detail Penggantian</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/60 dark:border-slate-850">
                  <div className="md:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Alasan Ganti Meter</span>
                    <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 uppercase">{selectedRecord.alasanGantiMeter || 'Lainnya'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Tanggal Remaja</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{selectedRecord.tglremaja || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Tanggal Nyala</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{selectedRecord.tglnyala || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Category 3: Meter Baru vs Meter Lama Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Meter Baru */}
                <div>
                  <h4 className="text-xs font-black tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Meter Baru</span>
                  </h4>
                  <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/[0.02] rounded-xl border border-emerald-500/10 space-y-2.5">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Nomor Meter</span>
                      <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{selectedRecord.noMeterBaru || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Merk / Tipe</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{selectedRecord.merkMeterBaru || '-'} / {selectedRecord.typeMeterBaru || '-'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Tahun Tera</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{selectedRecord.thteraMeterBaru || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Tahun Buat</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{selectedRecord.thbuatMeterBaru || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meter Lama */}
                <div>
                  <h4 className="text-xs font-black tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>Meter Lama</span>
                  </h4>
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/20 rounded-xl border border-slate-200 dark:border-slate-850 space-y-2.5">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Nomor Meter</span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{selectedRecord.noMeterLama || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase block">Merk / Tipe</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{selectedRecord.merkMeterLama || '-'} / {selectedRecord.typeMeterLama || '-'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Tahun Tera</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{selectedRecord.thteraMeterLama || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Tahun Buat</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{selectedRecord.thbuatMeterLama || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-850 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Search,
  RotateCw,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  Wrench,
  Gauge,
  Clock,
  TrendingUp,
  CheckCircle2,
  Zap,
  BarChart2,
  ListFilter,
  Save,
  AlertTriangle
} from 'lucide-react';
import { colors, borderRadius, shadows } from '../../design-system/tokens';
import { GasP2TLRepository } from '../../data/repositories/gas-p2tl.repository';
import type { P2TLGantiMeterRecord } from '../../core/entities/report.entity';
import { Button } from '../components/Button';
import { formatIndoNumber } from '../../core/usecases/generate-report.usecase';

const p2tlRepository = new GasP2TLRepository();

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const monthsList = MONTH_NAMES_ID.map((name, i) => ({
  value: String(i + 1).padStart(2, '0'),
  name
}));

const BAR_COLORS = [
  'from-emerald-400 to-teal-500',
  'from-sky-400 to-indigo-500',
  'from-amber-400 to-yellow-500',
  'from-rose-400 to-pink-500',
  'from-violet-400 to-purple-500',
  'from-orange-400 to-red-500',
  'from-cyan-400 to-sky-500',
  'from-blue-400 to-indigo-500',
];

interface GantiMeterProps {
  workingDays?: '5' | '6' | '7';
}

function getWorkingDaysCount(monthIndex: number, yearStr: string, setting: '5' | '6' | '7'): number {
  const year = parseInt(yearStr, 10);
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  let workingDays = 0;
  
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, monthIndex, d);
    const dayOfWeek = date.getDay();
    
    if (setting === '5') {
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    } else if (setting === '6') {
      if (dayOfWeek !== 0) {
        workingDays++;
      }
    } else {
      workingDays++;
    }
  }
  return workingDays;
}

export const GantiMeter: React.FC<GantiMeterProps> = () => {
  const [subTab, setSubTab] = useState<'realisasi' | 'target' | 'ringkasan'>('realisasi');
  const [records, setRecords] = useState<P2TLGantiMeterRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedDayDate, setSelectedDayDate] = useState<string>('');
  const [selectedSort, setSelectedSort] = useState<'date_desc' | 'date_asc'>('date_desc');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalFiltered: 0, totalPages: 1 });

  const [stats, setStats] = useState({ todayCount: 0, monthCount: 0, yearCount: 0 });
  const [reasonsBreakdown, setReasonsBreakdown] = useState<Array<{ reason: string; count: number }>>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([String(new Date().getFullYear())]);

  const activeWorkingDays = '5';
  const [targetYear, setTargetYear] = useState<string>(() => String(new Date().getFullYear()));
  const [targetsState, setTargetsState] = useState<number[]>(Array(12).fill(50));
  const [activeYearTargets, setActiveYearTargets] = useState<number[]>(Array(12).fill(50));
  const [savingTargets, setSavingTargets] = useState<boolean>(false);
  const [targetsStatus, setTargetsStatus] = useState<{ show: boolean; success: boolean; message: string } | null>(null);
  const [loadingTargets, setLoadingTargets] = useState<boolean>(false);

  const [dailyTrend, setDailyTrend] = useState<Array<{ label: string; count: number; target: number }>>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<Array<{ label: string; count: number; target: number }>>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<Array<{ label: string; count: number; target: number }>>([]);
  const [granularity, setGranularity] = useState<'hari' | 'minggu' | 'bulan'>('bulan');
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const loadTargets = async (year: string) => {
    setLoadingTargets(true);
    try {
      const trgs = await p2tlRepository.getGantiMeterTargets(year);
      setTargetsState(trgs);
    } catch (e) {
      console.warn("Failed to load targets:", e);
    } finally {
      setLoadingTargets(false);
    }
  };

  useEffect(() => {
    loadTargets(targetYear);
  }, [targetYear]);

  const handleTargetChange = (monthIdx: number, value: string) => {
    const newTargets = [...targetsState];
    if (value === '') {
      newTargets[monthIdx] = 0;
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        newTargets[monthIdx] = num;
      }
    }
    setTargetsState(newTargets);
  };

  const handleSaveTargets = async () => {
    setSavingTargets(true);
    setTargetsStatus(null);
    try {
      const success = await p2tlRepository.saveGantiMeterTargets(targetYear, targetsState);
      if (success) {
        setTargetsStatus({
          show: true,
          success: true,
          message: `Target bulanan ganti meter tahun ${targetYear} berhasil disimpan ke Google Sheets!`
        });
        if (targetYear === activeYear) {
          setActiveYearTargets(targetsState);
        }
      } else {
        setTargetsStatus({
          show: true,
          success: false,
          message: 'Koneksi gagal. Gagal menyimpan target ke spreadsheet.'
        });
      }
    } catch (e) {
      setTargetsStatus({
        show: true,
        success: false,
        message: 'Gagal menyimpan target bulanan ke spreadsheet.'
      });
    } finally {
      setSavingTargets(false);
      setTimeout(() => {
        setTargetsStatus(prev => prev ? { ...prev, show: false } : null);
      }, 4000);
    }
  };

  const activeYear = selectedYear && selectedYear !== 'all' ? selectedYear : String(new Date().getFullYear());
  const activeMonthIndex = selectedMonth && selectedMonth !== 'all'
    ? parseInt(selectedMonth, 10) - 1
    : new Date().getMonth();

  useEffect(() => {
    const loadActiveTargets = async () => {
      try {
        const trgs = await p2tlRepository.getGantiMeterTargets(activeYear);
        setActiveYearTargets(trgs);
      } catch (e) {
        console.warn("Failed to load active targets:", e);
      }
    };
    loadActiveTargets();
  }, [activeYear]);

  const targetPerBulan = activeYearTargets[activeMonthIndex] || 50;
  const bulanPercent = targetPerBulan > 0 ? Math.min(100, Math.round((stats.monthCount / targetPerBulan) * 100)) : 0;

  const [selectedRecord, setSelectedRecord] = useState<P2TLGantiMeterRecord | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchData = async () => {
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
        if (response.pagination) setPagination(response.pagination);
        if (response.stats) setStats({
          todayCount: response.stats.todayCount || 0,
          monthCount: response.stats.monthCount || 0,
          yearCount: response.stats.yearCount || 0
        });
        if (response.reasonsBreakdown) setReasonsBreakdown(response.reasonsBreakdown);
        if (response.availableYears) setAvailableYears(response.availableYears);
        if (response.dailyTrend) setDailyTrend(response.dailyTrend);
        if (response.weeklyTrend) setWeeklyTrend(response.weeklyTrend);
        if (response.monthlyTrend) setMonthlyTrend(response.monthlyTrend);
        if (isInitial) {
          setSelectedMonth(response.appliedMonth || 'all');
          setSelectedYear(response.appliedYear || 'all');
        }
      } else {
        setErrorMsg('Gagal mengambil data: ' + (response as any).message);
      }
    } catch (err: any) {
      setErrorMsg('Gagal terhubung ke API Google Sheets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, itemsPerPage, debouncedSearch, selectedMonth, selectedYear, selectedDayDate, selectedSort]);

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
    if (newPage >= 1 && newPage <= pagination.totalPages) setCurrentPage(newPage);
  };

  const totalPages = pagination.totalPages;
  const totalFiltered = pagination.totalFiltered;

  const currentChartData = granularity === 'hari' ? dailyTrend : granularity === 'minggu' ? weeklyTrend : monthlyTrend;

  return (
    <div className="space-y-6">

      {/* ── TOP HEADER BANNER ── */}
      <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
        <div>
          <h2 className="text-lg font-black tracking-tight mb-1 text-slate-900 dark:text-slate-50">
            Monitoring Penggantian kWh Meter
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Data terintegrasi dari sheet <strong>Ganti Meter</strong></span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {/* Sub-tab pill selector */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-850">
            {([
              { key: 'realisasi', label: 'Realisasi' },
              { key: 'target',    label: 'Target' },
              { key: 'ringkasan', label: 'Ringkasan' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setSubTab(tab.key)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  subTab === tab.key
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-800 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 ${borderRadius.xl} transition-all`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* ── SUMMARY STAT CARDS (always visible) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Hari Ini */}
        <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Hari Ini</span>
            <div className="text-xl font-black text-slate-800 dark:text-slate-50">{stats.todayCount} Unit</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Meter diganti hari ini</div>
          </div>
          <div className="p-3 bg-sky-500/10 text-sky-500 rounded-xl border border-sky-500/10">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Bulan Ini */}
        <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Bulan Ini</span>
            <div className="text-xl font-black text-slate-800 dark:text-slate-50">{stats.monthCount} Unit</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Target: {targetPerBulan} unit</div>
          </div>
          {/* Mini progress ring */}
          <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
            <svg width={56} height={56} className="transform -rotate-90">
              <circle className="text-slate-200 dark:text-slate-800" strokeWidth={5} stroke="currentColor" fill="transparent" r={23} cx={28} cy={28} />
              <circle
                className={`${bulanPercent >= 70 ? 'text-emerald-500' : 'text-amber-500'} transition-all duration-500`}
                strokeWidth={5}
                strokeDasharray={`${(bulanPercent / 100) * 144.51} 144.51`}
                strokeDashoffset={0}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r={23}
                cx={28}
                cy={28}
              />
            </svg>
            <span className="absolute text-[9px] font-extrabold text-slate-800 dark:text-slate-100">{bulanPercent}%</span>
          </div>
        </div>

        {/* Tahun Ini */}
        <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tahun Ini</span>
            <div className="text-xl font-black text-slate-800 dark:text-slate-50">{stats.yearCount} Unit</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total penggantian tahunan</div>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/10">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {subTab === 'ringkasan' && (
        <div className={`p-5 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} space-y-4`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">Filter Pencarian & Analisis</h3>
            </div>
            {(searchTerm || (selectedMonth !== 'all' && selectedMonth !== '') || (selectedYear !== 'all' && selectedYear !== '') || selectedDayDate) && (
              <button onClick={handleResetFilters} className="text-xs font-extrabold text-rose-500 hover:text-rose-600 transition-colors">
                Reset Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari IDPEL, Nama, Agenda..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 text-xs font-semibold ${colors.inputBg} border ${colors.inputBorder} rounded-xl text-slate-700 dark:text-slate-300 outline-none transition-all`}
              />
            </div>
            <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setCurrentPage(1); }}
              className={`w-full px-3 py-2.5 text-xs font-bold ${colors.inputBg} border ${colors.inputBorder} rounded-xl text-slate-700 dark:text-slate-300 outline-none transition-all`}>
              <option value="all">Semua Bulan</option>
              {monthsList.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
            </select>
            <select value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setCurrentPage(1); }}
              className={`w-full px-3 py-2.5 text-xs font-bold ${colors.inputBg} border ${colors.inputBorder} rounded-xl text-slate-700 dark:text-slate-300 outline-none transition-all`}>
              <option value="all">Semua Tahun</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="relative flex items-center">
              <input type="date" value={selectedDayDate} onChange={e => { setSelectedDayDate(e.target.value); setCurrentPage(1); }}
                className={`w-full px-3 py-2.5 text-xs font-bold ${colors.inputBg} border ${colors.inputBorder} rounded-xl text-slate-700 dark:text-slate-300 outline-none transition-all`} />
              {selectedDayDate && (
                <button type="button" onClick={() => { setSelectedDayDate(''); setCurrentPage(1); }}
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-655 rounded-md">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select value={selectedSort} onChange={e => { setSelectedSort(e.target.value as any); setCurrentPage(1); }}
              className={`w-full px-3 py-2.5 text-xs font-bold ${colors.inputBg} border ${colors.inputBorder} rounded-xl text-slate-700 dark:text-slate-355 outline-none transition-all`}>
              <option value="date_desc">Tanggal Terbaru</option>
              <option value="date_asc">Tanggal Terlama</option>
            </select>
          </div>
        </div>
      )}

      {/* ── TAB 1 — REALISASI (Visual Charts) ── */}
      {subTab === 'realisasi' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Reasons Breakdown Chart */}
          <div className={`lg:col-span-4 p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} flex flex-col`}>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>Komposisi Alasan</span>
            </h3>
            <p className="text-[10px] text-slate-505 dark:text-slate-400 font-semibold mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
              Pemicu utama penggantian kWh meter
            </p>

            {reasonsBreakdown.length === 0 ? (
              <div className="flex-grow flex items-center justify-center py-12 text-slate-500 text-xs font-semibold text-center">
                Tidak ada data untuk filter aktif.
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto pr-1 flex-grow">
                {reasonsBreakdown.map((item, idx) => {
                  const maxCount = reasonsBreakdown[0]?.count || 1;
                  const percent = totalFiltered > 0 ? Math.round((item.count / totalFiltered) * 100) : 0;
                  return (
                    <div key={item.reason} className="group">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-[11px] font-semibold text-slate-750 dark:text-slate-300 leading-tight">{item.reason}</span>
                        <span className="text-[11px] font-bold text-slate-555 dark:text-slate-400 whitespace-nowrap shrink-0">
                          {item.count} <span className="text-emerald-500 dark:text-emerald-400">({percent}%)</span>
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-850">
                        <div
                          className={`h-full bg-gradient-to-r ${BAR_COLORS[idx % BAR_COLORS.length]} rounded-full transition-all duration-500 group-hover:brightness-110`}
                          style={{ width: `${(item.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trend Charts */}
          <div className="lg:col-span-8 space-y-6">
            {/* Custom SVG Trend Chart */}
            <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} flex flex-col relative min-h-[300px]`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>
                    {granularity === 'hari' ? `Realisasi & Target Ganti Meter per Hari (${MONTH_NAMES_ID[activeMonthIndex]} ${activeYear})` :
                     granularity === 'minggu' ? `Realisasi & Target Ganti Meter per Minggu (${MONTH_NAMES_ID[activeMonthIndex]} ${activeYear})` :
                     `Realisasi & Target Ganti Meter per Bulan (${activeYear})`}
                  </span>
                </h3>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wide">Tampilkan:</span>
                    <select
                      value={granularity}
                      onChange={(e) => {
                        setGranularity(e.target.value as any);
                        setHoveredPoint(null);
                      }}
                      className="px-2 py-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-lg outline-none text-slate-700 dark:text-slate-355 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-custom"
                    >
                      <option value="hari">Per Hari</option>
                      <option value="minggu">Per Minggu</option>
                      <option value="bulan">Per Bulan</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Chart Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500" />
                  <span>Realisasi Penggantian</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-500" />
                  <span>Target</span>
                </div>
              </div>

              {(() => {
                const maxChartVal = Math.max(
                  ...currentChartData.map(d => d.count),
                  ...currentChartData.map(d => d.target),
                  10
                );
                const hasTrendData = currentChartData.some(d => d.count > 0 || d.target > 0);

                if (!hasTrendData) {
                  return (
                    <div className="flex-grow flex items-center justify-center min-h-[180px] text-xs text-slate-505 font-semibold">
                      Tidak ada tren data penggantian yang terekam.
                    </div>
                  );
                }

                return (
                  <div className="flex-grow flex items-center justify-center min-h-[180px] pt-2">
                    <svg viewBox="0 0 500 210" className="w-full h-auto">
                      {/* Grid Lines & Labels */}
                      {Array.from({ length: 5 }).map((_, i) => {
                        const yVal = 20 + i * 40;
                        const gridVal = maxChartVal - (maxChartVal * (i / 4));
                        return (
                          <g key={i}>
                            <line x1="45" y1={yVal} x2="485" y2={yVal} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray="3 3" />
                            <text x="38" y={yVal + 3} textAnchor="end" className="text-[8px] font-bold text-slate-400 dark:text-slate-500">
                              {Math.round(gridVal)} Unit
                            </text>
                          </g>
                        );
                      })}

                      {/* X-Axis line */}
                      <line x1="45" y1="180" x2="485" y2="180" className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="1" />

                      {/* Bars & Target Lines */}
                      {currentChartData.map((m, idx) => {
                        const plotWidth = 440;
                        const step = plotWidth / currentChartData.length;
                        const center = 45 + idx * step + step / 2;
                        
                        // Target Line Y position
                        const targetVal = m.target;
                        const targetY = 180 - (targetVal / maxChartVal) * 160;

                        // Realization Bar
                        const realHeight = (m.count / maxChartVal) * 160;
                        const realY = 180 - realHeight;

                        const barWidth = Math.max(4, Math.floor(step * 0.5));
                        const realX = center - barWidth / 2;

                        const showLabel = granularity !== 'hari' || (idx + 1) === 1 || (idx + 1) % 5 === 0 || (idx + 1) === currentChartData.length;
                        const labelToDisplay = showLabel ? m.label : '';

                        return (
                          <g key={idx}>
                            {/* Target Milestone Dash Line */}
                            <line
                              x1={center - barWidth * 0.75}
                              y1={targetY}
                              x2={center + barWidth * 0.75}
                              y2={targetY}
                              stroke="#f59e0b"
                              strokeWidth="2"
                              strokeDasharray="3 1.5"
                            />

                            {/* Current Realization Bar */}
                            <rect
                              x={realX}
                              y={realY}
                              width={barWidth}
                              height={Math.max(realHeight, 2)}
                              rx="1.5"
                              className={`${hoveredPoint === idx ? 'fill-emerald-500' : 'fill-emerald-500/80 dark:fill-emerald-500/70'} transition-all duration-200 cursor-pointer`}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const containerRect = e.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
                                if (containerRect) {
                                  setTooltipPos({
                                    x: rect.left - containerRect.left,
                                    y: rect.top - containerRect.top
                                  });
                                }
                                setHoveredPoint(idx);
                              }}
                              onMouseLeave={() => setHoveredPoint(null)}
                            />

                            {/* Label */}
                            {labelToDisplay && (
                              <text
                                x={center}
                                y="196"
                                textAnchor="middle"
                                className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500"
                              >
                                {labelToDisplay}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })()}

              {/* Tooltip Overlay */}
              {hoveredPoint !== null && currentChartData[hoveredPoint] && (
                <div 
                  className="absolute bg-slate-900/95 dark:bg-slate-950/95 text-slate-55 border border-slate-700/50 backdrop-blur-md rounded-xl p-3 shadow-xl pointer-events-none text-[11px] font-semibold space-y-1.5 z-10 transition-all duration-150"
                  style={{ left: tooltipPos.x + 10, top: tooltipPos.y - 100 }}
                >
                  <div className="font-extrabold text-emerald-400 border-b border-slate-800 pb-1 mb-1">
                    {granularity === 'hari' ? `Tanggal ${currentChartData[hoveredPoint].label} ${MONTH_NAMES_ID[activeMonthIndex]}` :
                     granularity === 'minggu' ? `Minggu ke-${currentChartData[hoveredPoint].label.slice(1)}` :
                     `Bulan ${currentChartData[hoveredPoint].label}`}
                  </div>
                  <div>Realisasi: <span className="font-black text-slate-100">{currentChartData[hoveredPoint].count} Unit</span></div>
                  <div className="border-t border-slate-800/60 pt-1 mt-1">Target: <span className="font-black text-amber-400">{currentChartData[hoveredPoint].target} Unit</span></div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── TAB 2 — TARGET ── */}
      {subTab === 'target' && (
        <div className="space-y-6">

          {/* Top action header card */}
          <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
            <div>
              <h3 className="text-lg font-black tracking-tight mb-1 text-slate-855 dark:text-slate-50">Target Bulanan Ganti Meter</h3>
              <p className="text-xs text-slate-505 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Kelola target unit ganti meter bulanan untuk menghitung kumulatif tahunan.</span>
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pilih Tahun:</span>
                <select
                  value={targetYear}
                  onChange={(e) => setTargetYear(e.target.value)}
                  className={`px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg outline-none text-slate-750 dark:text-slate-300 focus:border-emerald-500 transition-custom`}
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>

              <Button 
                variant="primary" 
                onClick={handleSaveTargets}
                loading={savingTargets}
                icon={<Save className="w-4 h-4 text-slate-950" />}
              >
                Simpan Target
              </Button>
            </div>
          </div>

          {targetsStatus?.show && (
            <div className={`p-4 rounded-lg flex items-start gap-3 border text-sm transition-custom ${
              targetsStatus.success 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]' 
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {targetsStatus.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              )}
              <span className="font-semibold">{targetsStatus.message}</span>
            </div>
          )}

          {/* Summary Row */}
          {(() => {
            const totalYearTarget = targetsState.reduce((sum, val) => sum + val, 0);
            const targetSemester1 = targetsState.slice(0, 6).reduce((sum, val) => sum + val, 0);
            const targetSemester2 = targetsState.slice(6, 12).reduce((sum, val) => sum + val, 0);
            
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Target Tahun {targetYear}</span>
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatIndoNumber(totalYearTarget)} Unit</div>
                  </div>
                  <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>

                <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Target Semester 1 (Jan-Jun)</span>
                    <div className="text-xl font-black text-slate-800 dark:text-slate-50 mt-1">{formatIndoNumber(targetSemester1)} Unit</div>
                  </div>
                  <div className="p-3 bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl">
                    <Layers className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                  </div>
                </div>

                <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Target Semester 2 (Jul-Des)</span>
                    <div className="text-xl font-black text-slate-800 dark:text-slate-50 mt-1">{formatIndoNumber(targetSemester2)} Unit</div>
                  </div>
                  <div className="p-3 bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl">
                    <BarChart2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                  </div>
                </div>

                <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Rata-Rata Bulanan</span>
                    <div className="text-xl font-black text-slate-800 dark:text-slate-50 mt-1">{formatIndoNumber(Math.round(totalYearTarget / 12))} Unit</div>
                  </div>
                  <div className="p-3 bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl">
                    <Zap className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Table targets grid */}
          <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} relative`}>
            {loadingTargets && (
              <div className="absolute inset-0 bg-slate-100/60 dark:bg-slate-950/60 backdrop-blur-xs rounded-2xl flex items-center justify-center flex-col gap-2 z-10">
                <svg className="animate-spin h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Memuat target tahun {targetYear}...</span>
              </div>
            )}

            {(() => {
              const cumulativeTargets = targetsState.reduce<number[]>((acc, currentVal, idx) => {
                if (idx === 0) {
                  acc.push(currentVal);
                } else {
                  acc.push(acc[idx - 1] + currentVal);
                }
                return acc;
              }, []);

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-880 text-slate-500 dark:text-slate-400 font-black">
                        <th className="pb-3 pr-2 w-12">No</th>
                        <th className="pb-3 pr-2 w-48">Bulan</th>
                        <th className="pb-3 pr-2 w-64">Target Bulan (Unit)</th>
                        <th className="pb-3 pr-2 text-right">Target Kumulatif (Unit)</th>
                        <th className="pb-3 pr-2 text-right">Jumlah Hari Kerja</th>
                        <th className="pb-3 text-right">Rata-Rata Target Harian (Unit)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MONTH_NAMES_ID.map((month, idx) => {
                        const days = getWorkingDaysCount(idx, targetYear, activeWorkingDays);
                        const dailyAvg = targetsState[idx] > 0 ? Math.round(targetsState[idx] / days) : 0;
                        
                        return (
                          <tr key={idx} className="border-b border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                            <td className="py-2.5 pr-2 font-bold text-slate-400 dark:text-slate-505">{idx + 1}</td>
                            <td className="py-2.5 pr-2 font-extrabold text-slate-800 dark:text-slate-200">{month}</td>
                            <td className="py-2.5 pr-2">
                              <input
                                type="number"
                                value={targetsState[idx] === 0 ? '' : targetsState[idx]}
                                onChange={(e) => handleTargetChange(idx, e.target.value)}
                                placeholder="0"
                                className={`w-48 px-3 py-1.5 text-xs font-semibold bg-slate-100/60 dark:bg-slate-950/60 border border-slate-250 dark:border-slate-800 focus:border-emerald-500 rounded-lg outline-none text-slate-800 dark:text-slate-100 transition-custom`}
                              />
                            </td>
                            <td className="py-2.5 pr-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {formatIndoNumber(cumulativeTargets[idx])} Unit
                            </td>
                            <td className="py-2.5 pr-2 text-right font-semibold text-slate-400 dark:text-slate-500">
                              {days} Hari
                            </td>
                            <td className="py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">
                              {formatIndoNumber(dailyAvg)} Unit / hari
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── TAB 3 — RINGKASAN (Summary & Table) ── */}
      {subTab === 'ringkasan' && (
        <div className="space-y-6">

          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Penggantian', value: `${stats.yearCount} Unit`, sub: `Total tahun ${activeYear}`, icon: <Gauge className="w-6 h-6" />, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/10 dark:border-emerald-500/20' },
              { label: 'Alasan Terbanyak', value: reasonsBreakdown[0]?.reason || '-', sub: `${reasonsBreakdown[0]?.count || 0} kasus`, icon: <Wrench className="w-6 h-6" />, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/10 dark:border-amber-500/20' },
              { label: 'Rata-rata Bulanan', value: `${Math.round(stats.yearCount / 12)} Unit`, sub: 'Estimasi per bulan', icon: <TrendingUp className="w-6 h-6" />, color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/10 dark:border-sky-500/20' },
            ].map((card, i) => (
              <div key={i} className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none ${borderRadius.xxl} flex items-center justify-between`}>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{card.label}</span>
                  <div className="text-xl font-black text-slate-900 dark:text-slate-50 mt-1">{card.value}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">{card.sub}</div>
                </div>
                <div className={`p-4 rounded-2xl border ${card.color}`}>{card.icon}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Reasons Breakdown Summary */}
            <div className={`lg:col-span-4 p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md}`}>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Distribusi Alasan</span>
              </h3>

              {reasonsBreakdown.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500 font-semibold">Tidak ada data.</div>
              ) : (
                <div className="space-y-4">
                  {reasonsBreakdown.map((item, idx) => {
                    const maxCount = reasonsBreakdown[0]?.count || 1;
                    const pct = totalFiltered > 0 ? Math.round((item.count / totalFiltered) * 100) : 0;
                    return (
                      <div key={item.reason} className="group flex items-center gap-4">
                        <div className="w-32 shrink-0 text-[11px] font-semibold text-slate-750 dark:text-slate-350 truncate">{item.reason || 'Lainnya'}</div>
                        <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-955 rounded-full overflow-hidden border border-slate-200 dark:border-slate-850">
                          <div
                            className={`h-full bg-gradient-to-r ${BAR_COLORS[idx % BAR_COLORS.length]} rounded-full transition-all duration-700 group-hover:brightness-110`}
                            style={{ width: `${(item.count / maxCount) * 100}%` }}
                          />
                        </div>
                        <div className="w-24 shrink-0 text-right">
                          <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">{item.count}</span>
                          <span className="text-[10px] text-emerald-500 ml-1 font-bold">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Data Table */}
            <div className={`lg:col-span-8 p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} flex flex-col`}>
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800 mb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">Daftar Data Penggantian</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                    Ditemukan <span className="text-emerald-500 font-bold">{totalFiltered}</span> rekaman
                  </p>
                </div>
              </div>

              <div className="flex-grow overflow-x-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <svg className="animate-spin h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-xs font-bold text-slate-505 animate-pulse">Memuat data...</span>
                  </div>
                ) : records.length === 0 ? (
                  <div className="text-center py-20 text-slate-505 text-xs font-semibold">Tidak ada data ditemukan.</div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[560px]">
                    <thead>
                      <tr className="border-b-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-405 tracking-widest">
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
                          <tr key={rec.noagenda + '-' + rec.idpel}
                            className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-55 dark:hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-3 text-xs font-bold text-slate-300 dark:text-slate-600">{rowNo}</td>
                            <td className="py-3 px-3">
                              <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{rec.idpel}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 truncate max-w-[180px]">{rec.nama}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                                {rec.alasanGantiMeter || 'Lainnya'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{rec.noMeterBaru || '-'}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-0.5">{rec.merkMeterBaru || '-'}</div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button onClick={() => setSelectedRecord(rec)}
                                className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-500 rounded-lg transition-colors inline-flex items-center justify-center"
                                title="Lihat Detail">
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

              {/* Pagination */}
              {totalFiltered > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Baris:</span>
                    <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      className="px-2 py-1 text-[10px] font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 outline-none">
                      {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, totalFiltered)} dari <span className="font-bold text-slate-600 dark:text-slate-300">{totalFiltered}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-555 transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    {(() => {
                      const pages: number[] = [];
                      if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
                      else {
                        pages.push(1);
                        let start = Math.max(2, currentPage - 1);
                        let end = Math.min(totalPages - 1, currentPage + 1);
                        if (currentPage <= 2) end = 4;
                        else if (currentPage >= totalPages - 1) start = totalPages - 3;
                        if (start > 2) pages.push(-1);
                        for (let i = start; i <= end; i++) pages.push(i);
                        if (end < totalPages - 1) pages.push(-2);
                        pages.push(totalPages);
                      }
                      return pages.map((p, i) => p < 0
                        ? <span key={`e${i}`} className="px-1 text-slate-300 text-xs">…</span>
                        : <button key={`p${p}`} onClick={() => handlePageChange(p)}
                            className={`min-w-[28px] h-7 px-1.5 text-xs font-bold rounded-lg border transition-all ${
                              currentPage === p
                                ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-300'
                            }`}>{p}</button>
                      );
                    })()}
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-555 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${borderRadius.xxl} ${shadows.xl} w-full max-w-2xl max-h-[90vh] flex flex-col`}>

            <div className="p-6 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl"><Gauge className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-50 uppercase tracking-wider">Detail Penggantian kWh Meter</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">No. Agenda: {selectedRecord.noagenda}</p>
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-555 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-slate-700 dark:text-slate-300">

              <div>
                <h4 className="text-xs font-black tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-500" /><span>Informasi Pelanggan</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/60 dark:border-slate-850">
                  {[
                    { label: 'ID Pelanggan', value: selectedRecord.idpel },
                    { label: 'Nama Pelanggan', value: selectedRecord.nama },
                    { label: 'Tarif / Daya', value: `${selectedRecord.tarif} / ${selectedRecord.daya} VA` },
                    { label: 'Pembatas Meter', value: selectedRecord.kdpembmeter || '-' },
                  ].map(f => (
                    <div key={f.label}>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{f.label}</span>
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{f.value}</span>
                    </div>
                  ))}
                  <div className="md:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Alamat</span>
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{selectedRecord.alamat}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-500" /><span>Detail Penggantian</span>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-black tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" /><span>Meter Baru</span>
                  </h4>
                  <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/[0.02] rounded-xl border border-emerald-500/10 space-y-2.5">
                    {[
                      { l: 'Nomor Meter', v: selectedRecord.noMeterBaru },
                      { l: 'Merk / Tipe', v: `${selectedRecord.merkMeterBaru || '-'} / ${selectedRecord.typeMeterBaru || '-'}` },
                      { l: 'Tahun Tera', v: selectedRecord.thteraMeterBaru },
                      { l: 'Tahun Buat', v: selectedRecord.thbuatMeterBaru },
                    ].map(f => (
                      <div key={f.l}>
                        <span className="text-[9px] font-black text-slate-400 uppercase block">{f.l}</span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{f.v || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-black tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" /><span>Meter Lama</span>
                  </h4>
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/20 rounded-xl border border-slate-200 dark:border-slate-850 space-y-2.5">
                    {[
                      { l: 'Nomor Meter', v: selectedRecord.noMeterLama },
                      { l: 'Merk / Tipe', v: `${selectedRecord.merkMeterLama || '-'} / ${selectedRecord.typeMeterLama || '-'}` },
                      { l: 'Tahun Tera', v: selectedRecord.thteraMeterLama },
                      { l: 'Tahun Buat', v: selectedRecord.thbuatMeterLama },
                    ].map(f => (
                      <div key={f.l}>
                        <span className="text-[9px] font-black text-slate-400 uppercase block">{f.l}</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{f.v || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-850 flex justify-end">
              <button onClick={() => setSelectedRecord(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all">
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

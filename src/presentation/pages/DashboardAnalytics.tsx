import React, { useState, useEffect } from 'react';
import { 
  TrendingUp,  
  Users, 
  Calendar, 
  Database,
  Search,
  ChevronLeft,
  ChevronRight,
  Zap,
  DollarSign,
  Briefcase,
  Layers
} from 'lucide-react';
import { colors, borderRadius, shadows } from '../../design-system/tokens';
import type { P2TLTarget, P2TLRealization, P2TLResponse } from '../../core/entities/report.entity';
import { GasP2TLRepository } from '../../data/repositories/gas-p2tl.repository';
import { formatIndoNumber, getIndonesianDateString } from '../../core/usecases/generate-report.usecase';
import { Button } from '../components/Button';
import { MonthlyTargets } from './MonthlyTargets';

const p2tlRepository = new GasP2TLRepository();

// Pure utility helper functions moved outside component scope to prevent TDZ ReferenceError
function getYearString(dateStr: string): string {
  if (!dateStr) return '2026';
  const parts = dateStr.split('-');
  return parts[0] || '2026';
}

function getDaysInMonth(dateStr: string): number {
  if (!dateStr) return 30;
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10); // 1-indexed
  return new Date(year, month, 0).getDate();
}

function getIndonesianMonthName(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  const monthIndex = parseInt(parts[1], 10) - 1;
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return months[monthIndex] || '';
}

function normalizeDateString(dateVal: any): string {
  if (!dateVal) return '';
  if (typeof dateVal !== 'string') {
    try {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const r = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${r}`;
      }
    } catch (_) {}
    return '';
  }

  const str = dateVal.trim();
  if (!str) return '';

  const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const idMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (idMatch) {
    const d = idMatch[1].padStart(2, '0');
    const m = idMatch[2].padStart(2, '0');
    const y = idMatch[3];
    return `${y}-${m}-${d}`;
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const r = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${r}`;
    }
  } catch (_) {}

  return str;
}

// Helper to get count of working days in a month based on settings
function getWorkingDaysCount(year: number, monthIndex: number, setting: '5' | '6' | '7'): number {
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  let workingDays = 0;
  
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, monthIndex, d);
    const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday
    
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

// Helper to determine if a specific date is a working day based on settings
function isDateWorkingDay(year: number, monthIndex: number, day: number, setting: '5' | '6' | '7'): boolean {
  const date = new Date(year, monthIndex, day);
  const dayOfWeek = date.getDay();
  if (setting === '5') {
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  } else if (setting === '6') {
    return dayOfWeek !== 0;
  }
  return true;
}

interface DashboardAnalyticsProps {
  targets: P2TLTarget;
  realization: P2TLRealization;
  execSummary: P2TLResponse['execSummary'];
  onNavigateToReport: () => void;
  workingDays?: '5' | '6' | '7';
}

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  targets,
  realization,
  execSummary,
  onNavigateToReport,
  workingDays
}) => {
  const [subTab, setSubTab] = useState<'kpi' | 'targets' | 'summary'>('kpi');
  const [logs, setLogs] = useState<any[]>([]);
  const [logRows, setLogRows] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [logsPage, setLogsPage] = useState<number>(1);
  const [logsLimit, setLogsLimit] = useState<number>(10);
  const [logsPagination, setLogsPagination] = useState({ page: 1, limit: 10, totalFiltered: 0, totalPages: 1 });

  // SVG Chart hover and tooltip states
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [compositionMetric, setCompositionMetric] = useState<'tarif' | 'golongan' | 'daya'>('tarif');

  // Chart granularity (hari | minggu | bulan)
  const [granularity, setGranularity] = useState<'hari' | 'minggu' | 'bulan'>('bulan');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setLogsPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch logs for chart calculations
  useEffect(() => {
    const fetchChartLogs = async () => {
      try {
        const result = await p2tlRepository.getLogs();
        const sorted = result.sort((a: any, b: any) => {
          const dateA = a.Date || a.date || a.Timestamp || '';
          const dateB = b.Date || b.date || b.Timestamp || '';
          return dateB.localeCompare(dateA);
        });
        setLogs(sorted);
      } catch (e) {
        console.error("Failed to load logs in dashboard:", e);
      }
    };
    fetchChartLogs();
  }, []);

  // Fetch logs for table with server-side pagination and search
  useEffect(() => {
    const fetchTableLogs = async () => {
      setLoadingLogs(true);
      try {
        const response = await p2tlRepository.getLogsPaginated({
          page: logsPage,
          limit: logsLimit,
          search: debouncedSearchTerm || undefined,
          sort: 'date_desc',
        });
        setLogRows(response.data || []);
        setLogsPagination(response.pagination || { page: logsPage, limit: logsLimit, totalFiltered: 0, totalPages: 1 });
      } catch (e) {
        console.error("Failed to load paginated logs in dashboard:", e);
        setLogRows([]);
      } finally {
        setLoadingLogs(false);
      }
    };
    fetchTableLogs();
  }, [logsPage, logsLimit, debouncedSearchTerm]);

  const activeWorkingDays = workingDays || (localStorage.getItem('p2tl_working_days') as '5' | '6' | '7') || '7';
  
  const parts = targets.date.split('-');
  const year = parseInt(parts[0], 10) || new Date().getFullYear();
  const month = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
  const day = parseInt(parts[2], 10) || new Date().getDate();

  // Monthly targets state for semester calculations
  const [monthlyTargets, setMonthlyTargets] = useState<number[]>(Array(12).fill(130205));

  useEffect(() => {
    const fetchMonthlyTargets = async () => {
      try {
        const yearVal = targets.date.split('-')[0] || String(new Date().getFullYear());
        const result = await p2tlRepository.getMonthlyTargets(yearVal);
        const mappedTargets = Array(12).fill(130205);
        result.forEach((item: any) => {
          const mIdx = Number(item.Month) - 1;
          if (mIdx >= 0 && mIdx < 12) {
            mappedTargets[mIdx] = Number(item.Target_kWh) || 130205;
          }
        });
        setMonthlyTargets(mappedTargets);
      } catch (e) {
        console.error("Failed to load monthly targets in DashboardAnalytics:", e);
      }
    };
    fetchMonthlyTargets();
  }, [targets.date]);

  const workingDaysInMonth = getWorkingDaysCount(year, month - 1, activeWorkingDays);
  const targetMonth = monthlyTargets[month - 1] ?? 130205;
  const isWorking = isDateWorkingDay(year, month - 1, day, activeWorkingDays);
  const targetHarianCalculated = isWorking ? Math.round(targetMonth / workingDaysInMonth) : 0;
  const targetKumulatifCalculated = monthlyTargets.slice(0, month).reduce((sum, val) => sum + val, 0);

  // Current selected date stats
  const relHarian = realization.realisasiHarianKwh === '' ? 0 : Number(realization.realisasiHarianKwh);
  const relKumulatif = realization.realisasiKumulatifKwh === '' ? 0 : Number(realization.realisasiKumulatifKwh);
  
  const harianPercent = targetHarianCalculated > 0 ? (relHarian / targetHarianCalculated) * 100 : 0;
  const kumulatifPercent = targetKumulatifCalculated > 0 ? (relKumulatif / targetKumulatifCalculated) * 100 : 0;

  // Compute chart dataset dynamically based on granularity
  const getChartDataForGranularity = () => {
    const parts = targets.date.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);

    if (granularity === 'hari') {
      const daysCount = getDaysInMonth(targets.date);
      const dailyItems: any[] = [];
      for (let d = 1; d <= daysCount; d++) {
        const dStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const logEntry = logs.find(log => {
          const dateVal = log.Date || log.date || '';
          return normalizeDateString(dateVal) === dStr;
        });
        const kwhReal = logEntry ? (Number(logEntry.Realisasi_Harian_kWh || logEntry.realisasiHarianKwh) || 0) : 0;
        
        let cases = 0;
        if (logEntry) {
          cases = (Number(logEntry.Realisasi_LKBK_Plg || logEntry.realisasiLkbkPlg) || 0) +
                  (Number(logEntry.Realisasi_3Phasa_Plg || logEntry.realisasi3PhasaPlg) || 0) +
                  (Number(logEntry.Realisasi_DLPD_Plg || logEntry.realisasiDlpdPlg) || 0) +
                  (Number(logEntry.Realisasi_Pengembangan_Plg || logEntry.realisasiPengembanganPlg) || 0) +
                  (Number(logEntry.Realisasi_TS_Periodik_Plg || logEntry.realisasiTsPeriodikPlg) || 0) +
                  (Number(logEntry.Realisasi_TS_Macet_Plg || logEntry.realisasiTsMacetPlg) || 0) +
                  (Number(logEntry.Realisasi_Lainnya_Plg || logEntry.realisasiLainnyaPlg) || 0);
        }

        const isDayWorking = isDateWorkingDay(year, month - 1, d, activeWorkingDays);
        const dayTarget = isDayWorking ? Math.round(targetMonth / workingDaysInMonth) : 0;

        dailyItems.push({
          label: `${d}`,
          kwh: kwhReal,
          target: dayTarget,
          cases
        });
      }
      return dailyItems;
    }

    if (granularity === 'minggu') {
      const daysCount = getDaysInMonth(targets.date);
      const weeklyItems: any[] = [];
      const ranges = [
        { w: 1, start: 1, end: 7 },
        { w: 2, start: 8, end: 14 },
        { w: 3, start: 15, end: 21 },
        { w: 4, start: 22, end: 28 },
        { w: 5, start: 29, end: daysCount }
      ];

      ranges.forEach(r => {
        let weeklyReal = 0;
        let weeklyCases = 0;
        for (let d = r.start; d <= r.end; d++) {
          const dStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const logEntry = logs.find(log => {
            const dateVal = log.Date || log.date || '';
            return normalizeDateString(dateVal) === dStr;
          });
          if (logEntry) {
            weeklyReal += Number(logEntry.Realisasi_Harian_kWh || logEntry.realisasiHarianKwh) || 0;
            weeklyCases += (Number(logEntry.Realisasi_LKBK_Plg || logEntry.realisasiLkbkPlg) || 0) +
                           (Number(logEntry.Realisasi_3Phasa_Plg || logEntry.realisasi3PhasaPlg) || 0) +
                           (Number(logEntry.Realisasi_DLPD_Plg || logEntry.realisasiDlpdPlg) || 0) +
                           (Number(logEntry.Realisasi_Pengembangan_Plg || logEntry.realisasiPengembanganPlg) || 0) +
                           (Number(logEntry.Realisasi_TS_Periodik_Plg || logEntry.realisasiTsPeriodikPlg) || 0) +
                           (Number(logEntry.Realisasi_TS_Macet_Plg || logEntry.realisasiTsMacetPlg) || 0) +
                           (Number(logEntry.Realisasi_Lainnya_Plg || logEntry.realisasiLainnyaPlg) || 0);
          }
        }
        
        let weeklyTarget = 0;
        for (let d = r.start; d <= r.end; d++) {
          const isDayWorking = isDateWorkingDay(year, month - 1, d, activeWorkingDays);
          weeklyTarget += isDayWorking ? Math.round(targetMonth / workingDaysInMonth) : 0;
        }

        weeklyItems.push({
          label: `W${r.w}`,
          kwh: weeklyReal,
          target: weeklyTarget,
          cases: weeklyCases
        });
      });
      return weeklyItems;
    }

    // Default 'bulan'
    const trend = execSummary?.monthlyTrend || [];
    return trend.map((m, idx) => ({
      label: m.month,
      kwh: m.kwh,
      target: monthlyTargets[idx] ?? 130205,
      cases: m.cases
    }));
  };

  const currentChartData = getChartDataForGranularity();

  // Semester calculations
  const dateParts = targets.date.split('-');
  const paramMonth = parseInt(dateParts[1], 10) - 1; // 0-indexed: 0-11
  const isSemester1 = paramMonth <= 5;
  const semesterLabel = isSemester1 ? 'Semester I' : 'Semester II';
  
  const targetSemester = isSemester1 
    ? monthlyTargets.slice(0, 6).reduce((sum, val) => sum + val, 0)
    : monthlyTargets.slice(6, 12).reduce((sum, val) => sum + val, 0);
    
  const trend = execSummary?.monthlyTrend || [];
  const realSemester = isSemester1
    ? trend.slice(0, 6).reduce((sum, item) => sum + (Number(item.kwh) || 0), 0)
    : trend.slice(6, 12).reduce((sum, item) => sum + (Number(item.kwh) || 0), 0);
    
  const semesterPercent = targetSemester > 0 ? (realSemester / targetSemester) * 100 : 0;

  // Breakdown categories
  const categories = [
    { name: 'LKBK Macet / Numpuk', target: targets.targetLkbkPlg, real: realization.realisasiLkbkPlg === '' ? 0 : Number(realization.realisasiLkbkPlg) },
    { name: 'Periksa Plg 3 Phasa', target: targets.target3PhasaPlg, real: realization.realisasi3PhasaPlg === '' ? 0 : Number(realization.realisasi3PhasaPlg) },
    { name: 'Periksa TO DLPD', target: targets.targetDlpdPlg, real: realization.realisasiDlpdPlg === '' ? 0 : Number(realization.realisasiDlpdPlg) },
    { name: 'Pengembangan TO', target: targets.targetPengembanganPlg, real: realization.realisasiPengembanganPlg === '' ? 0 : Number(realization.realisasiPengembanganPlg) },
    { name: 'Penagihan TS kWh Periodik', target: targets.targetTsPeriodikPlg, real: realization.realisasiTsPeriodikPlg === '' ? 0 : Number(realization.realisasiTsPeriodikPlg) },
    { name: 'Penagihan TS Macet (Kuning)', target: targets.targetTsMacetPlg, real: realization.realisasiTsMacetPlg === '' ? 0 : Number(realization.realisasiTsMacetPlg) },
    { name: 'Lainnya', target: targets.targetLainnyaPlg, real: realization.realisasiLainnyaPlg === '' ? 0 : Number(realization.realisasiLainnyaPlg) },
  ];

  const currentYear = getYearString(targets.date);
  const targetBulanKwh = targetMonth;
  const currentMonthName = getIndonesianMonthName(targets.date);

  const getMonthlyRealization = () => {
    if (!execSummary || !execSummary.monthlyTrend || execSummary.monthlyTrend.length === 0) {
      return 0;
    }
    const parts = targets.date.split('-');
    const monthIndex = parseInt(parts[1], 10) - 1;
    const monthData = execSummary.monthlyTrend[monthIndex];
    return monthData ? monthData.kwh : 0;
  };
  const relBulan = getMonthlyRealization();
  const bulanPercent = targetBulanKwh > 0 ? (relBulan / targetBulanKwh) * 100 : 0;

  // SVG Progress Ring Helper
  const ProgressRing = ({ percentage, size = 60, strokeWidth = 5, colorClass = "text-emerald-500" }: { percentage: number, size?: number, strokeWidth?: number, colorClass?: string }) => {
    const cleanPercentage = Math.min(100, Math.max(0, percentage));
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (cleanPercentage / 100) * circumference;
    
    return (
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            className="text-slate-200 dark:text-slate-800"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className={`${colorClass} transition-all duration-500 ease-out`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        <span className="absolute text-[10px] font-extrabold text-slate-800 dark:text-slate-100">{Math.round(percentage)}%</span>
      </div>
    );
  };


  return (
    <div className="space-y-6">
      
      {/* Top Welcome Action Banner */}
      <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
        <div>
          <h2 className="text-lg font-black tracking-tight mb-1 text-slate-900 dark:text-slate-50">Kinerja P2TL ULP Salatiga Kota</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Target aktif untuk: <strong>{getIndonesianDateString(targets.date)}</strong></span>
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {/* Subtab selection pills */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-850">
            <button
              onClick={() => setSubTab('kpi')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-custom ${
                subTab === 'kpi'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-800 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              KPI & Breakdown
            </button>
            <button
              onClick={() => setSubTab('targets')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-custom ${
                subTab === 'targets'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-800 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Target Bulanan
            </button>
            <button
              onClick={() => setSubTab('summary')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-custom ${
                subTab === 'summary'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-800 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Executive Summary ({currentYear})
            </button>
          </div>

          <Button 
            variant="primary" 
            onClick={onNavigateToReport}
            icon={<ChevronRight className="w-4 h-4 text-slate-950" />}
          >
            Kirim Laporan Baru
          </Button>
        </div>
      </div>

      {subTab === 'kpi' ? (
        /* TAB 1: KPI & BREAKDOWN */
        <>
          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Kinerja Harian Card */}
            <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Kinerja Harian</span>
                <div className="text-xl font-black text-slate-800 dark:text-slate-50">{formatIndoNumber(relHarian)} kWh</div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Target: {formatIndoNumber(targetHarianCalculated)} kWh</div>
              </div>
              <ProgressRing percentage={harianPercent} colorClass={harianPercent >= 100 ? "text-emerald-500" : harianPercent >= 50 ? "text-amber-500" : "text-rose-500"} />
            </div>

            {/* Kinerja Bulanan Card */}
            <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Kinerja Bulanan</span>
                <div className="text-xl font-black text-slate-800 dark:text-slate-50">{formatIndoNumber(relBulan)} kWh</div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Target: {formatIndoNumber(targetBulanKwh)} kWh ({currentMonthName})</div>
              </div>
              <ProgressRing percentage={bulanPercent} colorClass={bulanPercent >= 70 ? "text-emerald-500" : "text-amber-500"} />
            </div>

            {/* Kinerja Semester Card */}
            <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Kinerja {semesterLabel}</span>
                <div className="text-xl font-black text-slate-800 dark:text-slate-50">{formatIndoNumber(realSemester)} kWh</div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Target: {formatIndoNumber(targetSemester)} kWh</div>
              </div>
              <ProgressRing percentage={semesterPercent} colorClass={semesterPercent >= 70 ? "text-emerald-500" : "text-amber-500"} />
            </div>

            {/* Kinerja Kumulatif Card */}
            <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Kinerja Kumulatif</span>
                <div className="text-xl font-black text-slate-800 dark:text-slate-50">{formatIndoNumber(relKumulatif)} kWh</div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Target: {formatIndoNumber(targetKumulatifCalculated)} kWh</div>
              </div>
              <ProgressRing percentage={kumulatifPercent} colorClass={kumulatifPercent >= 70 ? "text-emerald-500" : "text-amber-500"} />
            </div>

          </div>

          {/* Breakdown Section: Tariff breakdown vs Monthly aggregates */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Findings Composition - Donut Chart Composition */}
            <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} flex flex-col justify-between`}>
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-2 border-b border-slate-200 dark:border-slate-880">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    <span>Komposisi Temuan</span>
                  </h3>
                  <select
                    value={compositionMetric}
                    onChange={(e) => setCompositionMetric(e.target.value as any)}
                    className="px-2 py-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-lg outline-none text-slate-700 dark:text-slate-350 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-custom"
                  >
                    <option value="tarif">Menurut Tarif</option>
                    <option value="golongan">Menurut Golongan</option>
                    <option value="daya">Menurut Daya</option>
                  </select>
                </div>

                {(() => {
                  // Get active dataset based on selected metric
                  const getActiveDataset = () => {
                    switch (compositionMetric) {
                      case 'golongan':
                        return execSummary.golonganBreakdown || [];
                      case 'daya':
                        return execSummary.dayaBreakdown || [];
                      case 'tarif':
                      default:
                        return execSummary.tariffBreakdown || [];
                    }
                  };

                  const activeDataset = getActiveDataset();
                  const totalCases = activeDataset.reduce((sum, item) => sum + item.cases, 0);

                  // Label helper for legend
                  const getLabelName = (itemClass: string) => {
                    if (compositionMetric === 'tarif') {
                      switch (itemClass) {
                        case 'R': return 'Rumah Tangga (R)';
                        case 'B': return 'Bisnis / Usaha (B)';
                        case 'S': return 'Sosial / Tempat Ibadah (S)';
                        case 'I': return 'Industri (I)';
                        case 'P': return 'Publik / Kantor / PJU (P)';
                        default: return 'Lainnya';
                      }
                    } else if (compositionMetric === 'golongan') {
                      switch (itemClass) {
                        case 'P1': return 'Golongan P1';
                        case 'P2': return 'Golongan P2';
                        case 'P3': return 'Golongan P3';
                        case 'P4': return 'Golongan P4';
                        case 'K2': return 'Golongan K2';
                        default: return 'Lainnya';
                      }
                    }
                    return itemClass; // For Daya and kWh, their names are already full labels
                  };

                  // Color helper for SVG slices
                  const getSliceColor = (itemClass: string) => {
                    if (compositionMetric === 'tarif') {
                      switch (itemClass) {
                        case 'R': return '#10b981'; // Emerald
                        case 'B': return '#3b82f6'; // Blue
                        case 'S': return '#6366f1'; // Indigo
                        case 'I': return '#f59e0b'; // Amber
                        case 'P': return '#f43f5e'; // Rose
                        default: return '#64748b'; // Slate
                      }
                    } else if (compositionMetric === 'golongan') {
                      switch (itemClass) {
                        case 'P1': return '#10b981'; // Emerald
                        case 'P2': return '#3b82f6'; // Blue
                        case 'P3': return '#6366f1'; // Indigo
                        case 'P4': return '#f59e0b'; // Amber
                        case 'K2': return '#f43f5e'; // Rose
                        default: return '#64748b'; // Slate
                      }
                    } else { // daya
                      switch (itemClass) {
                        case '450 VA': return '#10b981'; // Emerald
                        case '900 VA': return '#3b82f6'; // Blue
                        case '1300 VA': return '#6366f1'; // Indigo
                        case '2200 VA': return '#f59e0b'; // Amber
                        case '> 2200 VA': return '#f43f5e'; // Rose
                        default: return '#64748b'; // Slate
                      }
                    }
                  };

                  // Tailwind bg class helper for legend dots
                  const getSliceTailwindColor = (itemClass: string) => {
                    if (compositionMetric === 'tarif') {
                      switch (itemClass) {
                        case 'R': return 'bg-emerald-500';
                        case 'B': return 'bg-blue-500';
                        case 'S': return 'bg-indigo-500';
                        case 'I': return 'bg-amber-500';
                        case 'P': return 'bg-rose-500';
                        default: return 'bg-slate-400';
                      }
                    } else if (compositionMetric === 'golongan') {
                      switch (itemClass) {
                        case 'P1': return 'bg-emerald-500';
                        case 'P2': return 'bg-blue-500';
                        case 'P3': return 'bg-indigo-500';
                        case 'P4': return 'bg-amber-500';
                        case 'K2': return 'bg-rose-500';
                        default: return 'bg-slate-400';
                      }
                    } else { // daya
                      switch (itemClass) {
                        case '450 VA': return 'bg-emerald-500';
                        case '900 VA': return 'bg-blue-500';
                        case '1300 VA': return 'bg-indigo-500';
                        case '2200 VA': return 'bg-amber-500';
                        case '> 2200 VA': return 'bg-rose-500';
                        default: return 'bg-slate-400';
                      }
                    }
                  };

                  if (activeDataset.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/60 dark:border-slate-800/40 rounded-xl space-y-3 my-4">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Data filter "{compositionMetric}" tidak ditemukan.
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-505 max-w-xs leading-relaxed">
                          Kemungkinan karena Google Apps Script web app Anda belum diperbarui ke versi terbaru. Silakan salin ulang kode di file <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono text-[10px]">p2tl-backend.gs</code> ke Apps Script Editor Anda lalu deploy sebagai versi baru.
                        </div>
                      </div>
                    );
                  }

                  let accumulatedPercent = 0;
                  const donutSegments = activeDataset.map((t) => {
                    const percent = totalCases > 0 ? (t.cases / totalCases) * 100 : 0;
                    const strokeDasharray = `${(percent / 100) * 251.327} ${251.327}`;
                    const strokeDashoffset = -((accumulatedPercent / 100) * 251.327);
                    accumulatedPercent += percent;
                    return {
                      ...t,
                      percent,
                      strokeDasharray,
                      strokeDashoffset,
                      color: getSliceColor(t.class),
                      twColor: getSliceTailwindColor(t.class)
                    };
                  });

                  if (totalCases === 0) {
                    return <div className="text-xs text-slate-500 text-center py-12">Tidak ada data untuk filter ini.</div>;
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-10 gap-6 items-center py-2 flex-grow w-full">
                      {/* Donut Chart (60% width ratio) */}
                      <div className="sm:col-span-6 flex justify-center w-full">
                        <div className="relative w-48 h-48">
                          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              className="stroke-slate-100 dark:stroke-slate-850"
                              strokeWidth="10"
                            />
                            {donutSegments.map((seg, idx) => (
                              <circle
                                key={idx}
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                stroke={seg.color}
                                strokeWidth="10"
                                strokeDasharray={seg.strokeDasharray}
                                strokeDashoffset={seg.strokeDashoffset}
                                className="transition-all duration-500 ease-out"
                              />
                            ))}
                          </svg>
                          
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-black text-slate-850 dark:text-slate-100 leading-none">
                              {totalCases}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550 mt-0.5">
                              Kasus
                            </span>
                            <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 mt-0.5 leading-none">
                              {formatIndoNumber(activeDataset.reduce((s, d) => s + (d.kwh || 0), 0))} kWh
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Legend List (40% width ratio) */}
                      <div className="sm:col-span-4 space-y-2.5 pr-1 w-full">
                        {donutSegments.map((seg, idx) => (
                          <div key={idx} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850/60 pb-1.5 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2.5 h-2.5 rounded-full ${seg.twColor} flex-shrink-0`} />
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-350 truncate">
                                  {getLabelName(seg.class)}
                                </div>
                                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in">
                                  {formatIndoNumber(seg.kwh || 0)} kWh
                                </div>
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right ml-2">
                              <div className="text-[11px] font-extrabold text-slate-650 dark:text-slate-350">
                                {seg.cases} kasus
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-550">
                                {Math.round(seg.percent)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Monthly Trend aggregated items - Custom SVG Bar Chart */}
            <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} flex flex-col relative`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>
                    {granularity === 'hari' ? `Realisasi & Target kWh per Hari (${currentMonthName})` :
                     granularity === 'minggu' ? `Realisasi & Target kWh per Minggu (${currentMonthName})` :
                     `Realisasi & Target kWh per Bulan`}
                  </span>
                </h3>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Tampilkan:</span>
                    <select
                      value={granularity}
                      onChange={(e) => {
                        setGranularity(e.target.value as any);
                        setHoveredMonth(null);
                      }}
                      className="px-2 py-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-lg outline-none text-slate-700 dark:text-slate-350 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-custom"
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
                  <span>Realisasi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-500" />
                  <span>Target</span>
                </div>
              </div>

              {(() => {
                const maxKwh = Math.max(
                  ...currentChartData.map(d => d.kwh),
                  ...currentChartData.map(d => d.target),
                  10000
                );
                const hasTrendData = currentChartData.some(d => d.kwh > 0 || d.target > 0);

                if (!hasTrendData) {
                  return (
                    <div className="flex-grow flex items-center justify-center min-h-[180px] text-xs text-slate-500 font-semibold">
                      Tidak ada tren data yang terekam.
                    </div>
                  );
                }

                return (
                  <div className="flex-grow flex items-center justify-center min-h-[180px] pt-2">
                    <svg viewBox="0 0 500 210" className="w-full h-auto">
                      {/* Grid Lines & Labels */}
                      {Array.from({ length: 5 }).map((_, i) => {
                        const yVal = 20 + i * 40;
                        const gridKwh = maxKwh - (maxKwh * (i / 4));
                        return (
                          <g key={i}>
                            <line x1="45" y1={yVal} x2="485" y2={yVal} className="stroke-slate-200 dark:stroke-slate-880" strokeDasharray="3 3" />
                            <text x="38" y={yVal + 3} textAnchor="end" className="text-[8px] font-bold text-slate-400 dark:text-slate-500">
                              {formatIndoNumber(Math.round(gridKwh))}
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
                        const targetKwhVal = m.target;
                        const targetY = 180 - (targetKwhVal / maxKwh) * 160;

                        // Realization Bar
                        const realHeight = (m.kwh / maxKwh) * 160;
                        const realY = 180 - realHeight;

                        const barWidth = Math.max(4, Math.floor(step * 0.5));
                        const realX = center - barWidth / 2;

                        // Clean X-Axis tick label filtering for daily density
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
                              className={`${hoveredMonth === idx ? 'fill-emerald-500' : 'fill-emerald-500/80 dark:fill-emerald-500/70'} transition-all duration-200 cursor-pointer`}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const containerRect = e.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
                                if (containerRect) {
                                  setTooltipPos({
                                    x: rect.left - containerRect.left,
                                    y: rect.top - containerRect.top
                                  });
                                }
                                setHoveredMonth(idx);
                              }}
                              onMouseLeave={() => setHoveredMonth(null)}
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
              {hoveredMonth !== null && currentChartData[hoveredMonth] && (
                <div 
                  className="absolute bg-slate-900/95 dark:bg-slate-950/95 text-slate-50 border border-slate-700/50 backdrop-blur-md rounded-xl p-3 shadow-xl pointer-events-none text-[11px] font-semibold space-y-1.5 z-10 transition-all duration-150"
                  style={{ left: tooltipPos.x + 10, top: tooltipPos.y - 110 }}
                >
                  <div className="font-extrabold text-emerald-400 border-b border-slate-800 pb-1 mb-1">
                    {granularity === 'hari' ? `Tanggal ${currentChartData[hoveredMonth].label} ${currentMonthName}` :
                     granularity === 'minggu' ? `Minggu ke-${currentChartData[hoveredMonth].label.slice(1)}` :
                     currentChartData[hoveredMonth].label}
                  </div>
                  <div>Realisasi: <span className="font-black text-slate-100">{formatIndoNumber(currentChartData[hoveredMonth].kwh)} kWh</span></div>
                  <div className="border-t border-slate-800/60 pt-1 mt-1">Target: <span className="font-black text-amber-400">{formatIndoNumber(currentChartData[hoveredMonth].target)} kWh</span></div>
                  <div className="text-[10px] text-slate-400">Kasus: <span className="font-bold text-slate-200">{currentChartData[hoveredMonth].cases} Kasus</span></div>
                </div>
              )}
            </div>

          </div>
        </>
      ) : subTab === 'targets' ? (
        /* TAB 2: TARGET BULANAN PANEL */
        <MonthlyTargets workingDays={activeWorkingDays} />
      ) : (
        /* TAB 3: EXECUTIVE SUMMARY PANEL */
        <div className="space-y-6">
          
          {/* Top Level Summary Stats for the Year */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Total Cases inspected */}
            <div className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none ${borderRadius.xxl} flex items-center justify-between`}>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Temuan Tahun {currentYear}</span>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-50 mt-1">{formatIndoNumber(execSummary.totalCasesYear)} Kasus</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">Mencakup pemeriksaan PLN</div>
              </div>
              <div className="p-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/10 dark:border-emerald-500/20">
                <Briefcase className="w-6 h-6" />
              </div>
            </div>

            {/* Total kWh saved */}
            <div className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none ${borderRadius.xxl} flex items-center justify-between`}>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Energi Diselamatkan</span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatIndoNumber(execSummary.totalKwhYear)} kWh</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">Estimasi kWh terselamatkan</div>
              </div>
              <div className="p-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/10 dark:border-emerald-500/20">
                <Zap className="w-6 h-6" />
              </div>
            </div>

            {/* Total TS recovered */}
            <div className={`p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none ${borderRadius.xxl} flex items-center justify-between`}>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tagihan Susulan (TS)</span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">Rp {formatIndoNumber(execSummary.totalTsYear)}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">Pendapatan berhasil diamankan</div>
              </div>
              <div className="p-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/10 dark:border-emerald-500/20">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

          </div>

          {/* Breakdown & Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Breakdown bars */}
            <div className={`lg:col-span-5 p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} flex flex-col`}>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-4 pb-2 border-b border-slate-200 dark:border-slate-880 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Sasaran Operasi per Kategori</span>
              </h3>

              <div className="space-y-4 flex-grow flex flex-col justify-center">
                {categories.map((cat, idx) => {
                  const percent = cat.target > 0 ? (cat.real / cat.target) * 100 : 0;
                  return (
                    <div key={idx} className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold text-slate-750 dark:text-slate-300">
                        <span className="truncate pr-2">{idx + 1}. {cat.name}</span>
                        <span className="flex-shrink-0 text-slate-500 dark:text-slate-400">{cat.real} / {cat.target} Plg</span>
                      </div>
                      
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-500`}
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Logs timeline */}
            <div className={`lg:col-span-7 p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} flex flex-col`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-2 border-b border-slate-200 dark:border-slate-880">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>Log Realisasi Laporan</span>
                </h3>

                <div className="relative w-full sm:w-48 flex items-center">
                  <input
                    type="text"
                    placeholder="Cari tanggal..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100/60 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg outline-none text-slate-700 dark:text-slate-300 focus:border-emerald-500 transition-custom`}
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-505 absolute left-2.5 pointer-events-none" />
                </div>
              </div>

              <div className="flex-grow overflow-x-auto min-h-[300px] max-h-[320px] pr-2">
                {loadingLogs ? (
                  <div className="h-full flex items-center justify-center flex-col gap-2 py-12">
                    <svg className="animate-spin h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-xs text-slate-400 font-semibold">Memuat log database...</span>
                  </div>
                ) : logRows.length === 0 ? (
                  <div className="h-full flex items-center justify-center py-12 text-xs text-slate-500 font-semibold">
                    Tidak ada log laporan yang ditemukan.
                  </div>
                ) : (
                  <>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 font-bold">
                          <th className="pb-3 pr-2">Tanggal Laporan</th>
                          <th className="pb-3 pr-2">Harian (kWh)</th>
                          <th className="pb-3 pr-2">Kumulatif (kWh)</th>
                          <th className="pb-3">Sasaran</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logRows.map((log, idx) => {
                          const dateStr = log.Date || log.date || '';
                          const harian = log.Realisasi_Harian_kWh || log.realisasiHarianKwh || 0;
                          const kumulatif = log.Realisasi_Kumulatif_kWh || log.realisasiKumulatifKwh || 0;
                          
                          const sasaranTotal = 
                            (Number(log.Realisasi_LKBK_Plg || log.realisasiLkbkPlg) || 0) +
                            (Number(log.Realisasi_3Phasa_Plg || log.realisasi3PhasaPlg) || 0) +
                            (Number(log.Realisasi_DLPD_Plg || log.realisasiDlpdPlg) || 0) +
                            (Number(log.Realisasi_Pengembangan_Plg || log.realisasiPengembanganPlg) || 0) +
                            (Number(log.Realisasi_TS_Periodik_Plg || log.realisasiTsPeriodikPlg) || 0) +
                            (Number(log.Realisasi_TS_Macet_Plg || log.realisasiTsMacetPlg) || 0) +
                            (Number(log.Realisasi_Lainnya_Plg || log.realisasiLainnyaPlg) || 0);

                          return (
                            <tr key={`${dateStr}-${idx}`} className="border-b border-slate-200 dark:border-slate-850/60 hover:bg-slate-100 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                              <td className="py-3 pr-2 font-semibold">{getIndonesianDateString(dateStr)}</td>
                              <td className="py-3 pr-2">{formatIndoNumber(harian)}</td>
                              <td className="py-3 pr-2">{formatIndoNumber(kumulatif)}</td>
                              <td className="py-3 font-semibold text-emerald-600 dark:text-emerald-400">{sasaranTotal} Plg</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-850 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                          Halaman {logsPagination.page} dari {Math.max(1, logsPagination.totalPages)} ({logsPagination.totalFiltered} data)
                        </span>
                        <select
                          value={logsLimit}
                          onChange={(e) => {
                            setLogsLimit(Number(e.target.value));
                            setLogsPage(1);
                          }}
                          className="px-2 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg outline-none text-slate-700 dark:text-slate-300"
                        >
                          <option value={5}>5/baris</option>
                          <option value={10}>10/baris</option>
                          <option value={20}>20/baris</option>
                          <option value={50}>50/baris</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                          disabled={logsPagination.page <= 1}
                          className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-custom"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setLogsPage((p) => Math.min(logsPagination.totalPages || 1, p + 1))}
                          disabled={logsPagination.page >= (logsPagination.totalPages || 1)}
                          className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-custom"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Top 5 Highest findings Table */}
          <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md}`}>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-rose-500 animate-pulse" />
              <span className="text-rose-500">Top 5 Kasus Temuan Terbesar (Berdasarkan Tagihan Susulan)</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black">
                    <th className="pb-3 pr-2">IDPEL & Nama</th>
                    <th className="pb-3 pr-2">No. Agenda</th>
                    <th className="pb-3 pr-2">Tarif/Gol</th>
                    <th className="pb-3 pr-2 text-right">kWh Temuan</th>
                    <th className="pb-3 text-right">Tagihan Susulan (TS)</th>
                  </tr>
                </thead>
                <tbody>
                  {execSummary.topFindings.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                      <td className="py-3 pr-2">
                        <div className="font-extrabold text-slate-800 dark:text-slate-200">{item.nama}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{item.idpel}</div>
                      </td>
                      <td className="py-3 pr-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">{item.noagenda}</td>
                      <td className="py-3 pr-2">
                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded font-bold">{item.tarif}</span>
                        <span className="text-slate-400 dark:text-slate-500 text-[10px] ml-1">{item.gol}</span>
                      </td>
                      <td className="py-3 pr-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatIndoNumber(item.kwh)} kWh</td>
                      <td className="py-3 text-right font-black text-rose-500 dark:text-rose-400">Rp {formatIndoNumber(item.ts)}</td>
                    </tr>
                  ))}
                  {execSummary.topFindings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-500 py-6">Tidak ada temuan besar.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

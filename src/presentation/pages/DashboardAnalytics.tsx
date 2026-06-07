import React, { useState, useEffect } from 'react';
import { 
  TrendingUp,  
  Calendar, 
  ChevronRight,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  AlertTriangle,
  Trophy,
  TrendingDown,
  BarChart3
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

  // SVG Chart hover and tooltip states
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [compositionMetric, setCompositionMetric] = useState<'tarif' | 'golongan' | 'daya'>('tarif');

  // Chart granularity (hari | minggu | bulan)
  const [granularity, setGranularity] = useState<'hari' | 'minggu' | 'bulan'>('bulan');


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
              Realisasi
            </button>
            <button
              onClick={() => setSubTab('targets')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-custom ${
                subTab === 'targets'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-800 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Target
            </button>
            <button
              onClick={() => setSubTab('summary')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-custom ${
                subTab === 'summary'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-800 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Ringkasan ({currentYear})
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
      ) : (() => {
        /* TAB 3: RINGKASAN (REVAMPED) */
        const prevYear = year - 1;
        const prevMonthlyTrend = execSummary.prevMonthlyTrend ?? [];

        

        // Diagnostic calculations
        const totalTargetYear = monthlyTargets.reduce((s, v) => s + v, 0);
        const totalRealYear = execSummary.totalKwhYear;
        const sisaTarget = Math.max(0, totalTargetYear - totalRealYear);
        const sisaBulan = Math.max(1, 12 - month);
        const rataRataDibutuhkan = Math.round(sisaTarget / sisaBulan);

        const prevTotalKwhYtd = prevMonthlyTrend.slice(0, month).reduce((sum, m) => sum + (m?.kwh ?? 0), 0);
        const diffKwhYtd = totalRealYear - prevTotalKwhYtd;
        const pctGrowthYtd = prevTotalKwhYtd > 0 ? (diffKwhYtd / prevTotalKwhYtd) * 100 : (totalRealYear > 0 ? 100 : 0);

        // Scenario Projections variables
        const currentMonthNum = month;
        const remainingMonths = Math.max(0, 12 - currentMonthNum);
        const avgRealKwh = currentMonthNum > 0 ? totalRealYear / currentMonthNum : 0;

        // Calculate sisa hari kerja dari sisa bulan untuk Skenario 2
        let remainingWorkingDays = 0;
        for (let m = currentMonthNum; m < 12; m++) {
          remainingWorkingDays += getWorkingDaysCount(year, m, activeWorkingDays);
        }
        remainingWorkingDays = Math.max(1, remainingWorkingDays);

        // Scenario 1: Apabila Progres Seperti Saat Ini (Current Pace)
        const projectedKwhCurrent = Math.round(totalRealYear + (avgRealKwh * remainingMonths));
        const pctCurrent = totalTargetYear > 0 ? (projectedKwhCurrent / totalTargetYear) * 100 : 0;
        const gapCurrent = totalTargetYear - projectedKwhCurrent;
        
        // Performa bulanan yang dibutuhkan agar target tahunan tercapai
        const avgRequiredKwhCurrent = remainingMonths > 0 ? Math.round(sisaTarget / remainingMonths) : 0;
        const pctIncreaseRequiredCurrent = (avgRealKwh > 0 && sisaTarget > 0) ? Math.round(((avgRequiredKwhCurrent / avgRealKwh) - 1) * 100) : 0;

        // Scenario 2: Jika Target Harian Kumulatif Tercapai
        // Agar target kumulatif tercapai, kita harus menutup sisaTarget dengan sisa hari kerja.
        const newTargetHarian = remainingWorkingDays > 0 ? Math.round(sisaTarget / remainingWorkingDays) : 0;
        const baselineTargetHarian = Math.round(targetMonth / Math.max(1, workingDaysInMonth));
        const pctDailyIncrease = (baselineTargetHarian > 0 && sisaTarget > 0) ? Math.round(((newTargetHarian / baselineTargetHarian) - 1) * 100) : 0;

        // Scenario 3: Cara Mencapai Target 110%
        const target110Year = totalTargetYear * 1.10;
        const sisaTarget110 = Math.max(0, target110Year - totalRealYear);
        const avgRequiredKwh110 = remainingMonths > 0 ? Math.round(sisaTarget110 / remainingMonths) : 0;
        const pctEffortRequired110 = (avgRealKwh > 0 && sisaTarget110 > 0) ? Math.round(((avgRequiredKwh110 / avgRealKwh) - 1) * 100) : 0;

        // Best / worst months
        const monthlyTrendData = execSummary.monthlyTrend || [];
        const monthsWithData = monthlyTrendData.filter(m => m.kwh > 0);
        const bestMonth = monthsWithData.length > 0 ? monthsWithData.reduce((best, m) => m.kwh > best.kwh ? m : best, monthsWithData[0]) : null;
        const worstMonth = monthsWithData.length > 0 ? monthsWithData.reduce((worst, m) => m.kwh < worst.kwh ? m : worst, monthsWithData[0]) : null;

        // YoY chart data
        const yoyChartData = monthlyTrendData.map((m, idx) => ({
          label: m.month,
          current: m.kwh,
          prev: prevMonthlyTrend[idx]?.kwh ?? 0,
          target: monthlyTargets[idx] ?? 0,
        }));
        const yoyMaxVal = Math.max(...yoyChartData.map(d => Math.max(d.current, d.prev, d.target)), 1);



        const targetKumulatifYtd = monthlyTargets.slice(0, month).reduce((sum, val) => sum + val, 0);
        const pctYtd = targetKumulatifYtd > 0 ? (totalRealYear / targetKumulatifYtd) * 100 : 0;
        const pctAnnual = totalTargetYear > 0 ? (totalRealYear / totalTargetYear) * 100 : 0;

        const getKpiStatus = (pYtd: number, currentMonth: number, real: number, targetYtd: number) => {
          const diff = real - targetYtd;
          const diffStr = diff >= 0 ? `surplus +${formatIndoNumber(diff)} kWh` : `defisit ${formatIndoNumber(Math.abs(diff))} kWh`;
          const monthsList = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
          ];
          const monthName = monthsList[currentMonth - 1] || '';
          
          if (pYtd >= 100) {
            return {
              label: 'SANGAT BAIK',
              color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
              iconColor: 'text-emerald-500',
              description: `Kinerja luar biasa! Hingga bulan ${monthName}, realisasi kumulatif tahunan mencapai ${formatIndoNumber(real)} kWh. Angka ini mencatatkan ${diffStr} di atas target YTD (${formatIndoNumber(targetYtd)} kWh). Pertahankan intensitas pengawasan dan kualitas operasi untuk mengamankan surplus ini hingga akhir tahun.`
            };
          } else if (pYtd >= 90) {
            return {
              label: 'BAIK (ON TRACK)',
              color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
              iconColor: 'text-teal-500',
              description: `Kinerja aman dan terkendali. Realisasi kumulatif tahunan hingga ${monthName} sebesar ${formatIndoNumber(real)} kWh sudah berjalan sesuai rencana (on-track) dengan pencapaian ${Math.round(pYtd)}% dari target YTD. Lakukan akselerasi minor pada bulan berikutnya agar target tahunan tercapai lebih cepat.`
            };
          } else if (pYtd >= 75) {
            return {
              label: 'CUKUP (PERLU PERHATIAN)',
              color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
              iconColor: 'text-amber-500',
              description: `Kinerja berada dalam zona kuning. Hingga bulan ${monthName}, pencapaian kumulatif berada di bawah target YTD dengan ${diffStr} (${Math.round(pYtd)}% dari target YTD). Tim lapangan disarankan meningkatkan intensitas patroli P2TL dan menyasar golongan tarif potensial untuk mengejar ketertinggalan.`
            };
          } else {
            return {
              label: 'KURANG (KRITIS)',
              color: 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20',
              iconColor: 'text-rose-500',
              description: `Status waspada/kritis! Target kWh kumulatif tahunan mengalami ${diffStr} yang signifikan dibandingkan target YTD. Segera susun langkah perbaikan (recovery plan), optimalkan data DLPD, dan lakukan evaluasi menyeluruh terhadap fokus operasi P2TL guna mendongkrak pencapaian kwh.`
            };
          }
        };

        const statusInfo = getKpiStatus(pctYtd, month, totalRealYear, targetKumulatifYtd);

        return (
        <div className="space-y-6">
          
          {/* HERO HEADER: Kondisi Pencapaian kWh Kumulatif Tahunan */}
          <div className={`p-6 ${borderRadius.xxl} border ${colors.border} ${shadows.md} bg-gradient-to-br from-emerald-50/50 via-white to-slate-50/50 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-950 flex flex-col lg:flex-row justify-between items-stretch gap-6 relative overflow-hidden`}>
            {/* Abstract background glow effects */}
            <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Left: Status & Details */}
            <div className="flex-1 space-y-4 z-10 flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Status Pencapaian Kumulatif</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
                
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight leading-tight">
                  Analisis Pencapaian kWh Kumulatif Tahun {year}
                </h2>
                
                <p className="text-xs text-slate-600 dark:text-slate-350 font-semibold leading-relaxed max-w-3xl">
                  {statusInfo.description}
                </p>
              </div>

              {/* Metric mini indicators */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Realisasi YTD</div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-50">{formatIndoNumber(totalRealYear)} <span className="text-[10px] text-slate-500 font-semibold">kWh</span></div>
                </div>
                <div className="space-y-1 border-l border-slate-200 dark:border-slate-800 pl-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target YTD</div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-50">{formatIndoNumber(targetKumulatifYtd)} <span className="text-[10px] text-slate-500 font-semibold">kWh</span></div>
                </div>
                <div className="space-y-1 border-l border-slate-200 dark:border-slate-800 pl-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Tahunan</div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-50">{formatIndoNumber(totalTargetYear)} <span className="text-[10px] text-slate-500 font-semibold">kWh</span></div>
                </div>
              </div>
            </div>

            {/* Right: Visual Ring / Bar Progress */}
            <div className="w-full lg:w-72 flex flex-row lg:flex-col items-center justify-center lg:justify-between p-4 lg:p-6 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl z-10 shrink-0 gap-6">
              {/* YTD Progress radial meter */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative flex items-center justify-center w-28 h-28">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="56"
                      cy="56"
                      r="48"
                      className="stroke-slate-200 dark:stroke-slate-800"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r="48"
                      className={`transition-all duration-1000 ease-out ${
                        pctYtd >= 100 ? 'stroke-emerald-500' : pctYtd >= 90 ? 'stroke-teal-500' : pctYtd >= 75 ? 'stroke-amber-500' : 'stroke-rose-500'
                      }`}
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 48}
                      strokeDashoffset={2 * Math.PI * 48 * (1 - Math.min(100, pctYtd) / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-lg font-black text-slate-900 dark:text-slate-50">{Math.round(pctYtd)}%</span>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">dari Target YTD</span>
                  </div>
                </div>
              </div>

              {/* Annual Progress bar */}
              <div className="flex-1 lg:w-full space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase tracking-wide">
                  <span>Progres Target Tahunan</span>
                  <span className="text-slate-700 dark:text-slate-300">{Math.round(pctAnnual)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-300/20 dark:border-slate-700/20">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      pctAnnual >= 100 ? 'bg-emerald-500' : pctAnnual >= 50 ? 'bg-emerald-500/80' : 'bg-emerald-500/50'
                    }`}
                    style={{ width: `${Math.min(100, pctAnnual)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          

          {/* SECTION 2: YoY Monthly Comparison Chart & Data Table */}
          <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md}`}>
            
            {/* Header section with cumulative YTD comparison */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-705 dark:text-slate-200 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>Perbandingan Bulanan kWh — {currentYear} vs {prevYear}</span>
                </h3>
                <div className="text-[11px] text-slate-505 dark:text-slate-400 font-semibold">
                  Kumulatif YTD: <span className="font-bold text-slate-700 dark:text-slate-200">{formatIndoNumber(totalRealYear)} kWh</span> vs <span className="font-bold text-slate-700 dark:text-slate-202">{formatIndoNumber(prevTotalKwhYtd)} kWh ({prevYear})</span>
                  <span className={`ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black ${diffKwhYtd >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-505 dark:text-rose-400'}`}>
                    {diffKwhYtd >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {diffKwhYtd >= 0 ? '+' : ''}{Math.round(pctGrowthYtd)}% YoY
                  </span>
                </div>
              </div>

              {/* Legends */}
              <div className="flex items-center gap-4 text-[10px] font-bold shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-slate-500 dark:text-slate-400">{currentYear}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />
                  <span className="text-slate-500 dark:text-slate-400">{prevYear}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-amber-500" />
                  <span className="text-slate-500 dark:text-slate-400">Target</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              {/* Left Column: SVG Chart */}
              <div className="lg:col-span-8 relative" style={{ height: 220 }}>
                <svg width="100%" height="220" viewBox="0 0 720 220" preserveAspectRatio="none" className="overflow-visible">
                  {yoyChartData.map((d, idx) => {
                    const groupWidth = 720 / 12;
                    const barW = 14;
                    const gap = 2;
                    const centerX = groupWidth * idx + groupWidth / 2;
                    const prevBarX = centerX - barW - gap / 2;
                    const currBarX = centerX + gap / 2;
                    const maxH = 175;
                    const prevH = yoyMaxVal > 0 ? (d.prev / yoyMaxVal) * maxH : 0;
                    const currH = yoyMaxVal > 0 ? (d.current / yoyMaxVal) * maxH : 0;
                    const targetY = yoyMaxVal > 0 ? 185 - (d.target / yoyMaxVal) * maxH : 185;

                    return (
                      <g key={idx}>
                        {/* Previous year bar */}
                        <rect
                          x={prevBarX}
                          y={185 - prevH}
                          width={barW}
                          height={Math.max(prevH, 1)}
                          rx="1.5"
                          className="fill-slate-300 dark:fill-slate-600/80 transition-all duration-350"
                        />
                        {/* Current year bar */}
                        <rect
                          x={currBarX}
                          y={185 - currH}
                          width={barW}
                          height={Math.max(currH, 1)}
                          rx="1.5"
                          className="fill-emerald-500 dark:fill-emerald-500/80 transition-all duration-350"
                        />
                        {/* Target marker line */}
                        <line
                          x1={prevBarX - 2}
                          y1={targetY}
                          x2={currBarX + barW + 2}
                          y2={targetY}
                          className="stroke-amber-500"
                          strokeWidth="1.5"
                          strokeDasharray="3,2"
                        />
                        {/* Month label */}
                        <text
                          x={centerX}
                          y="202"
                          textAnchor="middle"
                          className="text-[9px] font-extrabold fill-slate-400 dark:fill-slate-500"
                        >
                          {d.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Right Column: Month-by-month Data Summary */}
              <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 lg:pl-6 pt-4 lg:pt-0">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Rincian Perbandingan Bulanan</div>
                <div className="overflow-y-auto max-h-[180px] pr-1 space-y-2 text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <th className="pb-1.5">Bulan</th>
                        <th className="pb-1.5 text-right">{prevYear}</th>
                        <th className="pb-1.5 text-right">{currentYear}</th>
                        <th className="pb-1.5 text-right">YoY (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60 dark:divide-slate-800/40">
                      {yoyChartData.map((d, idx) => {
                        const mDiff = d.current - d.prev;
                        const mPct = d.prev > 0 ? (mDiff / d.prev) * 100 : (d.current > 0 ? 100 : 0);
                        const isCurrentActive = idx < month; // only show data up to current selected month or actual months
                        
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                            <td className="py-1.5 font-bold text-slate-600 dark:text-slate-300">{d.label}</td>
                            <td className="py-1.5 text-right text-slate-500 dark:text-slate-400 font-semibold">{formatIndoNumber(d.prev)}</td>
                            <td className="py-1.5 text-right text-slate-800 dark:text-slate-100 font-bold">{isCurrentActive ? formatIndoNumber(d.current) : '-'}</td>
                            <td className="py-1.5 text-right font-black">
                              {isCurrentActive ? (
                                <span className={`inline-flex items-center gap-0.5 text-[10px] ${mDiff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {mDiff >= 0 ? '+' : ''}{Math.round(mPct)}%
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>

          {/* SECTION 3: Diagnostic Alert Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Sisa Target */}
            <div className={`p-5 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} space-y-2`}>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/15">
                  <Target className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sisa Target Tahun</span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-slate-50">{formatIndoNumber(sisaTarget)} <span className="text-xs font-bold text-slate-400">kWh</span></div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${totalRealYear >= totalTargetYear ? 'bg-emerald-500' : totalRealYear >= totalTargetYear * 0.6 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(100, totalTargetYear > 0 ? (totalRealYear / totalTargetYear) * 100 : 0)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 font-semibold">
                Tercapai: {formatIndoNumber(totalRealYear)} / {formatIndoNumber(totalTargetYear)} kWh ({totalTargetYear > 0 ? Math.round((totalRealYear / totalTargetYear) * 100) : 0}%)
              </div>
            </div>

            {/* Rata-rata Dibutuhkan */}
            <div className={`p-5 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} space-y-2`}>
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg border ${rataRataDibutuhkan > (monthlyTargets[month - 1] ?? 130205) * 1.2 ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/15' : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/15'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Kebutuhan/Bulan</span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-slate-50">{formatIndoNumber(rataRataDibutuhkan)} <span className="text-xs font-bold text-slate-400">kWh</span></div>
              <div className="text-[10px] text-slate-400 font-semibold">
                Rata-rata kWh yang harus dicapai di {sisaBulan} bulan tersisa
              </div>
              {rataRataDibutuhkan > (monthlyTargets[month - 1] ?? 130205) * 1.2 && (
                <div className="text-[10px] text-rose-500 dark:text-rose-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Melebihi rata-rata target bulanan!
                </div>
              )}
            </div>

            {/* Bulan Terbaik */}
            <div className={`p-5 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} space-y-2`}>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-500/15">
                  <Trophy className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Bulan Terbaik</span>
              </div>
              {bestMonth ? (
                <>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{bestMonth.month}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">
                    {formatIndoNumber(bestMonth.kwh)} kWh · {bestMonth.cases} kasus
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-400 font-semibold">Belum ada data</div>
              )}
            </div>

            {/* Bulan Terburuk */}
            <div className={`p-5 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} space-y-2`}>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-lg border border-rose-500/15">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Bulan Terburuk</span>
              </div>
              {worstMonth ? (
                <>
                  <div className="text-xl font-black text-rose-500 dark:text-rose-400">{worstMonth.month}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">
                    {formatIndoNumber(worstMonth.kwh)} kWh · {worstMonth.cases} kasus
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-400 font-semibold">Belum ada data</div>
              )}
            </div>

          </div>

          {/* SECTION 3b: Skenario Proyeksi Pencapaian Target Tahunan */}
          <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} space-y-4`}>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-500/15">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Skenario Proyeksi Pencapaian Target Tahunan</h3>
                <p className="text-[10px] text-slate-400 font-semibold">Simulasi pencapaian target kumulatif tahunan {year} ({formatIndoNumber(totalTargetYear)} kWh) berdasarkan 3 skenario taktis.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Skenario 1: Apabila Progres Seperti Saat Ini */}
              <div className="p-4 bg-slate-50/40 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-800/50 rounded-xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Apabila Progres Seperti Saat Ini</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${gapCurrent <= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/10'}`}>
                      {gapCurrent <= 0 ? 'TERCAPAI' : 'PERLU AKSELERASI'}
                    </span>
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {formatIndoNumber(projectedKwhCurrent)} <span className="text-xs font-bold text-slate-400">kWh</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                    Proyeksi Akhir Tahun
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-350 font-semibold leading-relaxed">
                    {gapCurrent > 0 ? (
                      <>
                        Dengan ritme saat ini, akhir tahun diproyeksikan defisit <span className="font-black text-rose-500">{formatIndoNumber(gapCurrent)} kWh</span>. Agar target tercapai, sisa {remainingMonths} bulan membutuhkan rata-rata <span className="font-black text-slate-800 dark:text-slate-200">{formatIndoNumber(avgRequiredKwhCurrent)} kWh/bulan</span> (naik <span className="font-black text-rose-500">{pctIncreaseRequiredCurrent}%</span> dari rata-rata saat ini).
                      </>
                    ) : (
                      <>
                        Dengan ritme saat ini, akhir tahun diproyeksikan surplus <span className="font-black text-emerald-500">{formatIndoNumber(Math.abs(gapCurrent))} kWh</span>. Target kumulatif tahunan diproyeksikan dapat tercapai dengan sukses.
                      </>
                    )}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-slate-250/20 dark:border-slate-800/60 text-[10px] font-bold text-slate-450 dark:text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Rata-rata Realisasi:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-extrabold">{formatIndoNumber(Math.round(avgRealKwh))} kWh/bln</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kebutuhan Bulanan:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-extrabold">{formatIndoNumber(avgRequiredKwhCurrent)} kWh/bln</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>Proyeksi Pencapaian</span>
                    <span>{Math.round(pctCurrent)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${gapCurrent <= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                      style={{ width: `${Math.min(100, pctCurrent)}%` }} 
                    />
                  </div>
                </div>
              </div>

              {/* Skenario 2: Jika Target Harian Kumulatif Tercapai */}
              <div className="p-4 bg-slate-50/40 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-800/50 rounded-xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Jika Target Harian Kumulatif Tercapai</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">
                      TERCAPAI
                    </span>
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {formatIndoNumber(totalTargetYear)} <span className="text-xs font-bold text-slate-400">kWh</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                    Disesuaikan untuk Target
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-350 font-semibold leading-relaxed">
                    {pctDailyIncrease > 0 ? (
                      <>
                        Agar target kumulatif tercapai (menutup defisit berjalan), target harian sisa <span className="font-bold text-slate-850 dark:text-slate-150">{remainingWorkingDays} hari kerja</span> tahun ini harus disesuaikan menjadi <span className="font-black text-emerald-500">{formatIndoNumber(newTargetHarian)} kWh/hari</span> (naik <span className="font-black text-rose-500">{pctDailyIncrease}%</span> dari target harian awal).
                      </>
                    ) : (
                      <>
                        Target kumulatif tahunan berjalan aman. Target harian sisa <span className="font-bold text-slate-850 dark:text-slate-150">{remainingWorkingDays} hari kerja</span> tahun ini disesuaikan menjadi <span className="font-black text-emerald-500">{formatIndoNumber(newTargetHarian)} kWh/hari</span> (turun <span className="font-black text-emerald-600">{Math.abs(pctDailyIncrease)}%</span> dari target harian awal).
                      </>
                    )}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-250/20 dark:border-slate-800/60 text-[10px] font-bold text-slate-450 dark:text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Target Harian Awal:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-extrabold">{formatIndoNumber(baselineTargetHarian)} kWh/hari</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Harian Baru:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-extrabold">{formatIndoNumber(newTargetHarian)} kWh/hari</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kebutuhan Bulanan:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-extrabold">{formatIndoNumber(avgRequiredKwhCurrent)} kWh/bln</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>Proyeksi Pencapaian</span>
                    <span>100%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-emerald-500" 
                      style={{ width: '100%' }} 
                    />
                  </div>
                </div>
              </div>

              {/* Skenario 3: Cara Mencapai Target 110% */}
              <div className="p-4 bg-slate-50/40 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-800/50 rounded-xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Cara Mencapai Target 110%</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${totalRealYear >= target110Year ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/10'}`}>
                      {totalRealYear >= target110Year ? 'TERCAPAI' : `PERLU EFFORT +${pctEffortRequired110}%`}
                    </span>
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {formatIndoNumber(Math.round(target110Year))} <span className="text-xs font-bold text-slate-400">kWh</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                    Target Optimis (110%)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-350 font-semibold leading-relaxed">
                    {totalRealYear < target110Year ? (
                      <>
                        Agar target optimis 110% tercapai (<span className="font-black text-slate-800 dark:text-slate-200">{formatIndoNumber(Math.round(target110Year))} kWh</span>), performa di sisa {remainingMonths} bulan harus ditingkatkan sebesar <span className="font-black text-rose-500">{pctEffortRequired110}%</span> dari rata-rata saat ini (membutuhkan rata-rata <span className="font-black text-slate-800 dark:text-slate-200">{formatIndoNumber(avgRequiredKwh110)} kWh/bulan</span>).
                      </>
                    ) : (
                      <>
                        Target optimis 110% tahunan sebesar <span className="font-black text-emerald-500">{formatIndoNumber(Math.round(target110Year))} kWh</span> telah berhasil dilampaui!
                      </>
                    )}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-250/20 dark:border-slate-800/60 text-[10px] font-bold text-slate-450 dark:text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Rata-rata Realisasi:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-extrabold">{formatIndoNumber(Math.round(avgRealKwh))} kWh/bln</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kebutuhan Bulanan (110%):</span>
                    <span className="text-slate-700 dark:text-slate-200 font-extrabold">{formatIndoNumber(avgRequiredKwh110)} kWh/bln</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>Progres Terhadap Target 110%</span>
                    <span>{Math.round(target110Year > 0 ? (totalRealYear / target110Year) * 100 : 0)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${totalRealYear >= target110Year ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                      style={{ width: `${Math.min(100, target110Year > 0 ? (totalRealYear / target110Year) * 100 : 0)}%` }} 
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
        );
      })()}

    </div>
  );
};

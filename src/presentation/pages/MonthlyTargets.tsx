import React, { useState, useEffect } from 'react';
import { Calendar, Save, AlertTriangle, CheckCircle2, TrendingUp, Zap, Layers, BarChart2 } from 'lucide-react';
import { colors, borderRadius, shadows } from '../../design-system/tokens';
import { Button } from '../components/Button';
import { GasP2TLRepository } from '../../data/repositories/gas-p2tl.repository';
import { formatIndoNumber } from '../../core/usecases/generate-report.usecase';

const p2tlRepository = new GasP2TLRepository();

interface MonthlyTargetsProps {
  workingDays?: '5' | '6' | '7';
}

// Helper to get count of working days in a month based on settings
function getWorkingDaysCount(monthIndex: number, yearStr: string, setting: '5' | '6' | '7'): number {
  const year = parseInt(yearStr, 10);
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

export const MonthlyTargets: React.FC<MonthlyTargetsProps> = ({ workingDays }) => {
  const activeWorkingDays = workingDays || (localStorage.getItem('p2tl_working_days') as '5' | '6' | '7') || '7';
  
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    return String(new Date().getFullYear());
  });
  
  const [targets, setTargets] = useState<number[]>(Array(12).fill(130205));
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [status, setStatus] = useState<{ show: boolean; success: boolean; message: string } | null>(null);

  // Month names in Indonesian
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Load monthly targets for selected year
  const loadMonthlyTargets = async (year: string) => {
    setLoading(true);
    setStatus(null);
    try {
      const result = await p2tlRepository.getMonthlyTargets(year);
      // Map result array to numbers array of length 12
      const mappedTargets = Array(12).fill(0);
      result.forEach((item: any) => {
        const mIdx = Number(item.Month) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          mappedTargets[mIdx] = Number(item.Target_kWh) || 0;
        }
      });
      setTargets(mappedTargets);
    } catch (e) {
      console.error(e);
      setStatus({
        show: true,
        success: false,
        message: 'Gagal mengambil data target dari Google Sheets. Menggunakan nilai default.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthlyTargets(selectedYear);
  }, [selectedYear]);

  // Update target for a specific month
  const handleTargetChange = (monthIdx: number, value: string) => {
    const newTargets = [...targets];
    if (value === '') {
      newTargets[monthIdx] = 0;
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        newTargets[monthIdx] = num;
      }
    }
    setTargets(newTargets);
  };

  // Save targets to spreadsheet
  const handleSaveTargets = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const success = await p2tlRepository.saveMonthlyTargets(selectedYear, targets);
      if (success) {
        setStatus({
          show: true,
          success: true,
          message: `Target bulanan tahun ${selectedYear} berhasil disimpan ke Google Sheets!`
        });
      } else {
        setStatus({
          show: true,
          success: false,
          message: 'Koneksi gagal. Target bulanan disimpan secara lokal sebagai draft (Offline Mode).'
        });
      }
    } catch (e) {
      setStatus({
        show: true,
        success: false,
        message: 'Gagal menyimpan target bulanan ke spreadsheet.'
      });
    } finally {
      setSaving(false);
      // Hide status alert after 4 seconds
      setTimeout(() => {
        setStatus(prev => prev ? { ...prev, show: false } : null);
      }, 4000);
    }
  };

  // Calculate cumulative targets
  const cumulativeTargets = targets.reduce<number[]>((acc, currentVal, idx) => {
    if (idx === 0) {
      acc.push(currentVal);
    } else {
      acc.push(acc[idx - 1] + currentVal);
    }
    return acc;
  }, []);

  const totalYearTarget = targets.reduce((sum, val) => sum + val, 0);
  const targetSemester1 = targets.slice(0, 6).reduce((sum, val) => sum + val, 0);
  const targetSemester2 = targets.slice(6, 12).reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-6">
      
      {/* Top action header card */}
      <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
        <div>
          <h2 className="text-lg font-black tracking-tight mb-1 text-slate-800 dark:text-slate-50">Manajemen Target Bulanan P2TL</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Kelola target kWh untuk setiap bulan untuk menghitung kumulatif tahunan.</span>
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Year selector dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pilih Tahun:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
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
            loading={saving}
            icon={<Save className="w-4 h-4 text-slate-950" />}
          >
            Simpan Target
          </Button>
        </div>
      </div>

      {status?.show && (
        <div className={`p-4 rounded-lg flex items-start gap-3 border text-sm transition-custom ${
          status.success 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]' 
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          {status.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          )}
          <span className="font-semibold">{status.message}</span>
        </div>
      )}

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Target Tahun {selectedYear}</span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatIndoNumber(totalYearTarget)} kWh</div>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Target Semester 1 (Jan-Jun)</span>
            <div className="text-xl font-black text-slate-800 dark:text-slate-50 mt-1">{formatIndoNumber(targetSemester1)} kWh</div>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl">
            <Layers className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          </div>
        </div>

        <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Target Semester 2 (Jul-Des)</span>
            <div className="text-xl font-black text-slate-800 dark:text-slate-50 mt-1">{formatIndoNumber(targetSemester2)} kWh</div>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl">
            <BarChart2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          </div>
        </div>

        <div className={`p-5 ${colors.card} ${borderRadius.xl} border ${colors.border} flex items-center justify-between`}>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Rata-Rata Bulanan</span>
            <div className="text-xl font-black text-slate-800 dark:text-slate-50 mt-1">{formatIndoNumber(Math.round(totalYearTarget / 12))} kWh</div>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl">
            <Zap className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </div>
        </div>
      </div>

      {/* Table targets grid */}
      <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} relative`}>
        {loading && (
          <div className="absolute inset-0 bg-slate-100/60 dark:bg-slate-950/60 backdrop-blur-xs rounded-2xl flex items-center justify-center flex-col gap-2 z-10">
            <svg className="animate-spin h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Memuat target tahun {selectedYear}...</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-880 text-slate-500 dark:text-slate-400 font-black">
                <th className="pb-3 pr-2 w-12">No</th>
                <th className="pb-3 pr-2 w-48">Bulan</th>
                <th className="pb-3 pr-2 w-64">Target Bulan (kWh)</th>
                <th className="pb-3 pr-2 text-right">Target Kumulatif (kWh)</th>
                <th className="pb-3 pr-2 text-right">Jumlah Hari</th>
                <th className="pb-3 text-right">Rata-Rata Target Harian (kWh)</th>
              </tr>
            </thead>
            <tbody>
              {monthNames.map((month, idx) => {
                const days = getWorkingDaysCount(idx, selectedYear, activeWorkingDays);
                const dailyAvg = targets[idx] > 0 ? Math.round(targets[idx] / days) : 0;
                
                return (
                  <tr key={idx} className="border-b border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                    <td className="py-2.5 pr-2 font-bold text-slate-400 dark:text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 pr-2 font-extrabold text-slate-800 dark:text-slate-200">{month}</td>
                    <td className="py-2.5 pr-2">
                      <input
                        type="number"
                        value={targets[idx] === 0 ? '' : targets[idx]}
                        onChange={(e) => handleTargetChange(idx, e.target.value)}
                        placeholder="0"
                        className={`w-48 px-3 py-1.5 text-xs font-semibold bg-slate-100/60 dark:bg-slate-950/60 border border-slate-250 dark:border-slate-800 focus:border-emerald-500 rounded-lg outline-none text-slate-800 dark:text-slate-100 transition-custom`}
                      />
                    </td>
                    <td className="py-2.5 pr-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatIndoNumber(cumulativeTargets[idx])} kWh
                    </td>
                    <td className="py-2.5 pr-2 text-right font-semibold text-slate-400 dark:text-slate-500">
                      {days} Hari
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">
                      {formatIndoNumber(dailyAvg)} kWh / hari
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

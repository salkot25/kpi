import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Settings, 
  Copy, 
  Check, 
  Send, 
  RefreshCw,
  FileText,
  AlertTriangle,
  Database,
  LayoutDashboard,
  Menu,
  X,
  Calendar,
  Gauge
} from 'lucide-react';
import { colors, borderRadius, shadows } from '../../design-system/tokens';
import { InputField } from '../components/InputField';
import { Button } from '../components/Button';
import type { P2TLTarget, P2TLRealization, P2TLCalculatedReport, P2TLResponse } from '../../core/entities/report.entity';
import { GasP2TLRepository } from '../../data/repositories/gas-p2tl.repository';
import { GenerateReportUseCase, formatIndoNumber } from '../../core/usecases/generate-report.usecase';
import { DashboardAnalytics } from './DashboardAnalytics';
import { MonthlyTargets } from './MonthlyTargets';
import { GantiMeter } from './GantiMeter';

// Instantiate dependencies
const p2tlRepository = new GasP2TLRepository();
const generateReportUseCase = new GenerateReportUseCase();

export const Dashboard: React.FC = () => {
  // Navigation states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'report' | 'targets' | 'ganti_meter' | 'settings'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('p2tl_theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('p2tl_theme', theme);
  }, [theme]);

  // Network connection state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // Date state (defaults to today in local time YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Database settings state
  const [gasUrl, setGasUrl] = useState<string>(() => {
    return localStorage.getItem('p2tl_gas_url') || '';
  });
  const [testStatus, setTestStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ type: 'idle' });
  const [debugData, setDebugData] = useState<string>('');
  const [debugPayloadIndicators, setDebugPayloadIndicators] = useState<any | null>(null);
  const [loadingDebug, setLoadingDebug] = useState<boolean>(false);

  // Data fetching status
  const [loadingTargets, setLoadingTargets] = useState<boolean>(false);
  const [targetSource, setTargetSource] = useState<'api' | 'cache' | 'default'>('default');

  // Targets, Realizations, and Executive Summary states
  const [targets, setTargets] = useState<P2TLTarget>({
    date: selectedDate,
    targetHarianKwh: 19933,
    targetKumulatifKwh: 1562458,
    targetLkbkPlg: 2,
    target3PhasaPlg: 5,
    targetDlpdPlg: 26,
    targetPengembanganPlg: 0,
    targetTsPeriodikPlg: 0,
    targetTsMacetPlg: 0,
    targetLainnyaPlg: 0,
  });

  const [realization, setRealization] = useState<P2TLRealization>({
    date: selectedDate,
    realisasiHarianKwh: '',
    realisasiKumulatifKwh: '',
    realisasiLkbkPlg: '',
    realisasi3PhasaPlg: '',
    realisasiDlpdPlg: '',
    realisasiPengembanganPlg: '',
    realisasiTsPeriodikPlg: '',
    realisasiTsMacetPlg: '',
    realisasiLainnyaPlg: '',
  });

  const [execSummary, setExecSummary] = useState<P2TLResponse['execSummary']>({
    totalCasesYear: 0,
    totalKwhYear: 0,
    totalTsYear: 0,
    monthlyTrend: [],
    tariffBreakdown: [],
    golonganBreakdown: [],
    dayaBreakdown: [],
    kwhBreakdown: [],
    topFindings: []
  });

  // Resulting report
  const [calculatedReport, setCalculatedReport] = useState<P2TLCalculatedReport | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [whatsappPhone, setWhatsappPhone] = useState<string>(() => {
    return localStorage.getItem('p2tl_whatsapp_phone') || '';
  });
  const [submittingData, setSubmittingData] = useState<boolean>(false);
  const [workingDays, setWorkingDays] = useState<'5' | '6' | '7'>(() => {
    return (localStorage.getItem('p2tl_working_days') as '5' | '6' | '7') || '7';
  });

  const handlePhoneChange = (val: string) => {
    setWhatsappPhone(val);
    localStorage.setItem('p2tl_whatsapp_phone', val);
  };

  const saveSettingsToDb = async (currentTheme: 'light' | 'dark', currentPhone: string, currentWorkingDays: '5' | '6' | '7') => {
    try {
      await p2tlRepository.saveSettings({
        theme: currentTheme,
        whatsappPhone: currentPhone,
        working_days: currentWorkingDays
      });
      fetchTargetsData(selectedDate);
    } catch (err) {
      console.warn("Failed to sync settings to spreadsheet:", err);
    }
  };
  const [submitResult, setSubmitResult] = useState<{ show: boolean; success: boolean; message: string } | null>(null);

  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [settingsStatus, setSettingsStatus] = useState<{ type: 'idle' | 'success' | 'error'; message?: string }>({ type: 'idle' });

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsStatus({ type: 'idle' });
    try {
      const success = await p2tlRepository.saveSettings({
        theme,
        whatsappPhone: whatsappPhone.trim(),
        working_days: workingDays
      });
      if (success) {
        setSettingsStatus({ type: 'success', message: 'Nomor WhatsApp default berhasil disimpan ke spreadsheet!' });
        fetchTargetsData(selectedDate);
      } else {
        setSettingsStatus({ type: 'error', message: 'Gagal menyimpan ke spreadsheet. URL API mungkin belum dikonfigurasi.' });
      }
    } catch (err) {
      setSettingsStatus({ type: 'error', message: 'Gagal menyimpan pengaturan ke database.' });
    } finally {
      setSavingSettings(false);
      setTimeout(() => {
        setSettingsStatus({ type: 'idle' });
      }, 4000);
    }
  };

  // Monitor network connection status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch targets when date changes or GAS URL changes
  const fetchTargetsData = async (date: string) => {
    setLoadingTargets(true);
    try {
      const responseObj = await p2tlRepository.getTargets(date);
      setTargets(responseObj.target);
      setExecSummary(responseObj.execSummary);
      
      // Determine what source was used
      const savedGasUrl = localStorage.getItem('p2tl_gas_url');
      if (!savedGasUrl) {
        setTargetSource('default');
      } else {
        const cachedStr = localStorage.getItem(`p2tl_target_cache_${date}`);
        if (cachedStr) {
          setTargetSource(isOnline ? 'api' : 'cache');
        } else {
          setTargetSource('default');
        }
      }

      // Check if there's a saved draft for this date
      const draft = p2tlRepository.getDraftRealization(date);
      const sheetHarian = responseObj.realization.realisasiHarianKwh;
      const sheetKumulatif = responseObj.realization.realisasiKumulatifKwh;

      if (draft) {
        setRealization({
          ...draft,
          realisasiHarianKwh: draft.realisasiHarianKwh !== '' ? draft.realisasiHarianKwh : (sheetHarian > 0 ? sheetHarian : ''),
          realisasiKumulatifKwh: draft.realisasiKumulatifKwh !== '' ? draft.realisasiKumulatifKwh : (sheetKumulatif > 0 ? sheetKumulatif : ''),
        });
      } else {
        setRealization({
          date,
          realisasiHarianKwh: sheetHarian > 0 ? sheetHarian : '',
          realisasiKumulatifKwh: sheetKumulatif > 0 ? sheetKumulatif : '',
          realisasiLkbkPlg: '',
          realisasi3PhasaPlg: '',
          realisasiDlpdPlg: '',
          realisasiPengembanganPlg: '',
          realisasiTsPeriodikPlg: '',
          realisasiTsMacetPlg: '',
          realisasiLainnyaPlg: '',
        });
      }

      if (responseObj.settings) {
        const remoteSettings = responseObj.settings;
        if (remoteSettings.theme === 'light' || remoteSettings.theme === 'dark') {
          setTheme(remoteSettings.theme);
          localStorage.setItem('p2tl_theme', remoteSettings.theme);
        }
        if (remoteSettings.whatsappPhone !== undefined) {
          setWhatsappPhone(remoteSettings.whatsappPhone);
          localStorage.setItem('p2tl_whatsapp_phone', remoteSettings.whatsappPhone);
        }
        if (remoteSettings.working_days !== undefined) {
          setWorkingDays(remoteSettings.working_days as any);
          localStorage.setItem('p2tl_working_days', remoteSettings.working_days);
        }
      }
    } catch (err) {
      console.error(err);
      setTargetSource('default');
    } finally {
      setLoadingTargets(false);
    }
  };

  useEffect(() => {
    fetchTargetsData(selectedDate);
  }, [selectedDate]);

  // Recalculate report whenever targets or realizations change
  useEffect(() => {
    const report = generateReportUseCase.execute(targets, {
      ...realization,
      date: selectedDate
    });
    setCalculatedReport(report);
  }, [targets, realization, selectedDate]);

  // Update a single realization field
  const updateRealizationField = (field: keyof P2TLRealization, val: string) => {
    let parsedVal: number | '' = '';
    if (val !== '') {
      parsedVal = parseInt(val, 10);
      if (isNaN(parsedVal)) return;
    }

    const updated = {
      ...realization,
      [field]: parsedVal
    };
    setRealization(updated);
    
    // Save draft immediately to local storage
    localStorage.setItem(`p2tl_draft_cache_${selectedDate}`, JSON.stringify(updated));
  };

  // Save GAS Web App URL
  const handleSaveGasUrl = () => {
    localStorage.setItem('p2tl_gas_url', gasUrl.trim());
    fetchTargetsData(selectedDate);
    setTestStatus({ type: 'success', message: 'URL API Google Sheets berhasil disimpan!' });
    setTimeout(() => {
      setTestStatus({ type: 'idle' });
    }, 4000);
  };

  // Test GAS Web App Connection
  const handleTestConnection = async () => {
    if (!gasUrl.trim()) {
      setTestStatus({ type: 'error', message: 'Tolong masukkan URL Web App yang valid.' });
      return;
    }
    
    setTestStatus({ type: 'loading' });
    try {
      const response = await fetch(`${gasUrl.trim()}?date=${selectedDate}`, {
        method: 'GET',
        mode: 'cors',
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.status === 'success') {
        setTestStatus({ type: 'success', message: 'Koneksi Sukses! Data target berhasil didapatkan.' });
      } else {
        setTestStatus({ type: 'error', message: 'Koneksi gagal atau format salah.' });
      }
    } catch (e) {
      setTestStatus({ 
        type: 'error', 
        message: 'Koneksi gagal. Pastikan URL benar dan CORS diizinkan di Google Apps Script.' 
      });
    }
  };

  // Fetch Spreadsheet structural debug info
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const handleFetchDebugInfo = async () => {
    if (!gasUrl.trim()) {
      setDebugData("Tolong masukkan URL Web App yang valid.");
      setDebugPayloadIndicators(null);
      return;
    }
    setLoadingDebug(true);
    setDebugData('');
    setDebugPayloadIndicators(null);
    try {
      const response = await fetch(`${gasUrl.trim()}?action=debug`, {
        method: 'GET',
        mode: 'cors',
      });
      if (!response.ok) throw new Error("HTTP error: " + response.status);
      const result = await response.json();
      setDebugData(JSON.stringify(result, null, 2));
      setDebugPayloadIndicators(result?.debug?.payloadIndicators || null);
    } catch (e: any) {
      setDebugData("Gagal mengambil info debug. Pastikan:\n1. URL Web App benar.\n2. Anda sudah menpublikasikan ulang (Deploy -> Manage Deployments -> Edit -> New Version) script Apps Script di Google Sheets.\n3. Akses diset ke 'Anyone'.\n\nDetail error: " + e.message);
      setDebugPayloadIndicators(null);
    } finally {
      setLoadingDebug(false);
    }
  };

  // Copy report to clipboard
  const handleCopyToClipboard = () => {
    if (!calculatedReport) return;
    navigator.clipboard.writeText(calculatedReport.whatsappText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // Log realization and redirect to WhatsApp
  const handleSendWhatsapp = async () => {
    if (!calculatedReport) return;
    
    setSubmittingData(true);
    setSubmitResult(null);

    const savedSuccess = await p2tlRepository.saveRealization({
      ...realization,
      date: selectedDate
    });

    await saveSettingsToDb(theme, whatsappPhone, workingDays);

    setSubmittingData(false);

    if (savedSuccess) {
      setSubmitResult({
        show: true,
        success: true,
        message: 'Data realisasi berhasil direkam ke Google Sheets!'
      });
    } else {
      setSubmitResult({
        show: true,
        success: false,
        message: 'Gagal mengirim ke Google Sheets. Laporan disimpan secara lokal sebagai draft (Mode Offline).'
      });
    }

    setTimeout(() => {
      setSubmitResult(prev => prev ? { ...prev, show: false } : null);
    }, 4000);

    let formattedPhone = whatsappPhone.trim();
    if (formattedPhone) {
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '62' + formattedPhone.slice(1);
      } else if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.slice(1);
      }
    }

    const encodedText = encodeURIComponent(calculatedReport.whatsappText);
    const waLink = formattedPhone 
      ? `https://wa.me/${formattedPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    window.open(waLink, '_blank');
  };

  return (
    <div className={`min-h-screen ${colors.bg} ${colors.text} flex flex-col md:flex-row select-none`}>
      
      {/* 1. SIDEBAR (Collapsible on Mobile, Fixed on Desktop) */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen w-72 bg-slate-900 border-r border-slate-800 z-40
        flex flex-col justify-between p-6 transition-transform duration-350 ease-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-8">
          {/* Logo / Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500 text-slate-950 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-md font-black tracking-tight text-slate-50 leading-tight">P2TL WhatsApp</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ULP Salatiga Kota</p>
              </div>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1 bg-slate-950/40 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold tracking-wide transition-custom ${borderRadius.xl} ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard Analisis</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('report');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold tracking-wide transition-custom ${borderRadius.xl} ${
                activeTab === 'report'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>Input & Kirim Laporan</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('ganti_meter');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold tracking-wide transition-custom ${borderRadius.xl} ${
                activeTab === 'ganti_meter'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Gauge className="w-5 h-5" />
              <span>Penggantian kWh Meter</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('settings');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold tracking-wide transition-custom ${borderRadius.xl} ${
                activeTab === 'settings'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850 dark:hover:bg-slate-850'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span>Pengaturan</span>
            </button>
          </nav>
        </div>

        {/* Footer Area with network and settings */}
        <div className="space-y-4 pt-4 border-t border-slate-850">
          
          {/* Connection badge */}
          <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-custom ${
            isOnline 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]' 
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
          }`}>
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>ONLINE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>OFFLINE MODE</span>
              </>
            )}
          </div>

          <div className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-wider">
            P2TL Salatiga Kota &copy; 2026
          </div>
        </div>
      </aside>

      {/* Overlay backdrop for mobile menu */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      {/* 2. MAIN CONTAINER AREA */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        
        {/* Mobile Navbar Header */}
        <header className="md:hidden flex justify-between items-center bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500 text-slate-950 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-100 uppercase tracking-wide">P2TL Salatiga</h1>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 bg-slate-950/40 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg transition-custom"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
          
          {activeTab === 'dashboard' ? (
            /* Dashboard View */
            <DashboardAnalytics 
              targets={targets}
              realization={realization}
              execSummary={execSummary}
              onNavigateToReport={() => setActiveTab('report')}
              workingDays={workingDays}
            />
          ) : activeTab === 'targets' ? (
            /* Monthly Targets View */
            <MonthlyTargets workingDays={workingDays} />
          ) : activeTab === 'ganti_meter' ? (
            /* kWh Meter Replacement View */
            <GantiMeter />
          ) : activeTab === 'settings' ? (
            /* Settings View */
            <div className="space-y-6">
              {/* Header Banner */}
              <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md}`}>
                <h2 className="text-lg font-black tracking-tight mb-1 text-slate-800 dark:text-slate-50">Pengaturan Aplikasi</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Kelola konfigurasi API Google Sheets dan tema tampilan aplikasi.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* 1. API & Database Settings Card */}
                <div className={`lg:col-span-8 p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} space-y-6`}>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <Database className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                    <span>Konfigurasi API Google Sheets</span>
                  </h3>

                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      Masukkan URL Web App dari Google Apps Script yang telah dideploy untuk mensinkronisasi target bulanan dan pencatatan laporan realisasi secara real-time.
                    </p>

                    <InputField
                      label="Google Apps Script Web App URL"
                      type="url"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={gasUrl}
                      onChange={setGasUrl}
                    />

                    <div className="flex flex-wrap gap-3 justify-between pt-2">
                      <Button 
                        variant="secondary"
                        onClick={handleFetchDebugInfo}
                        loading={loadingDebug}
                        className="text-xs px-3.5 py-2 border border-slate-300 dark:border-slate-750 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        icon={<RefreshCw className="w-3.5 h-3.5" />}
                      >
                        Struktur Sheet
                      </Button>

                      <div className="flex gap-2">
                        <Button 
                          variant="secondary"
                          onClick={handleTestConnection}
                          loading={testStatus.type === 'loading'}
                          icon={<RefreshCw className="w-4 h-4" />}
                        >
                          Tes Koneksi
                        </Button>
                        <Button 
                          variant="primary"
                          onClick={handleSaveGasUrl}
                        >
                          Simpan URL
                        </Button>
                      </div>
                    </div>

                    {testStatus.message && (
                      <div className={`p-3.5 rounded-xl border text-xs leading-relaxed transition-custom ${
                        testStatus.type === 'success' 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      }`}>
                        <span className="font-semibold">{testStatus.message}</span>
                      </div>
                    )}

                    {debugData && (
                      <div className="space-y-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-850">
                        {debugPayloadIndicators && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl space-y-1.5">
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Payload Logs</div>
                              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Total Rows: <span className="font-black text-emerald-600 dark:text-emerald-400">{debugPayloadIndicators.logs?.totalRows ?? 0}</span></div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400">All Rows: {formatBytes(Number(debugPayloadIndicators.logs?.estimatedAllRowsBytes || 0))}</div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400">Page 20: {formatBytes(Number(debugPayloadIndicators.logs?.estimatedPage20Bytes || 0))}</div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400">Page 50: {formatBytes(Number(debugPayloadIndicators.logs?.estimatedPage50Bytes || 0))}</div>
                            </div>

                            <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl space-y-1.5">
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Payload Ganti Meter</div>
                              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Total Rows: <span className="font-black text-emerald-600 dark:text-emerald-400">{debugPayloadIndicators.gantiMeter?.totalRows ?? 0}</span></div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400">All Rows: {formatBytes(Number(debugPayloadIndicators.gantiMeter?.estimatedAllRowsBytes || 0))}</div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400">Page 10: {formatBytes(Number(debugPayloadIndicators.gantiMeter?.estimatedPage10Bytes || 0))}</div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400">Page 50: {formatBytes(Number(debugPayloadIndicators.gantiMeter?.estimatedPage50Bytes || 0))}</div>
                            </div>
                          </div>
                        )}

                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Log Struktur Sheet (AD & Mappings):</div>
                        <pre className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl font-mono text-[10px] leading-normal text-slate-700 dark:text-emerald-400 overflow-auto max-h-56 whitespace-pre-wrap select-text">
                          {debugData}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Theme Selection Card */}
                <div className={`lg:col-span-4 p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} space-y-6`}>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <Settings className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                    <span>Tema Tampilan</span>
                  </h3>

                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      Pilih tema tampilan warna antarmuka aplikasi.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Light Mode Option */}
                      <button
                        onClick={() => {
                          setTheme('light');
                          saveSettingsToDb('light', whatsappPhone, workingDays);
                        }}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-custom ${
                          theme === 'light'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm shadow-emerald-500/10'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-350 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'light' ? 'bg-emerald-500 text-slate-50' : 'bg-slate-200 dark:bg-slate-900'}`}>
                          ☀️
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">Light Mode</span>
                      </button>
 
                      {/* Dark Mode Option */}
                      <button
                        onClick={() => {
                          setTheme('dark');
                          saveSettingsToDb('dark', whatsappPhone, workingDays);
                        }}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-custom ${
                          theme === 'dark'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm shadow-emerald-500/10'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-350 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 dark:bg-slate-900'}`}>
                          🌙
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">Dark Mode</span>
                      </button>
                    </div>

                    <div className="pt-2">
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                        <span>Aktif:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{theme === 'dark' ? 'Dark Mode (Default)' : 'Light Mode'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. WhatsApp Settings Card */}
                <div className={`lg:col-span-4 p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} space-y-6`}>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <Send className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                    <span>WhatsApp Default</span>
                  </h3>

                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      Masukkan nomor WhatsApp tujuan default untuk pengiriman laporan.
                    </p>

                    <InputField
                      label="Nomor WhatsApp Default"
                      type="text"
                      placeholder="Contoh: 628123456789"
                      value={whatsappPhone}
                      onChange={handlePhoneChange}
                    />

                    <div className="flex justify-end pt-2">
                      <Button
                        variant="primary"
                        onClick={handleSaveSettings}
                        loading={savingSettings}
                      >
                        Simpan Nomor
                      </Button>
                    </div>

                    {settingsStatus.message && (
                      <div className={`p-3.5 rounded-xl border text-xs leading-relaxed transition-custom ${
                        settingsStatus.type === 'success' 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      }`}>
                        <span className="font-semibold">{settingsStatus.message}</span>
                      </div>
                    )}
                  </div>
                </div>
 
                {/* 4. Working Days Settings Card */}
                <div className={`lg:col-span-4 p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md} space-y-6`}>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <Calendar className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                    <span>Hari Kerja P2TL</span>
                  </h3>
 
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      Tentukan hari operasional kerja mingguan untuk kalkulasi target harian secara otomatis.
                    </p>
 
                    <select
                      value={workingDays}
                      onChange={(e) => {
                        const val = e.target.value as '5' | '6' | '7';
                        setWorkingDays(val);
                        localStorage.setItem('p2tl_working_days', val);
                        saveSettingsToDb(theme, whatsappPhone, val);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg outline-none text-slate-700 dark:text-slate-300 focus:border-emerald-500 transition-custom font-bold"
                    >
                      <option value="5">Senin - Jumat (5 Hari Kerja)</option>
                      <option value="6">Senin - Sabtu (6 Hari Kerja)</option>
                      <option value="7">Senin - Minggu (7 Hari Kerja)</option>
                    </select>
 
                    <div className="pt-2">
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                        <span>Aktif:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {workingDays === '5' ? 'Senin - Jumat' : workingDays === '6' ? 'Senin - Sabtu' : 'Senin - Minggu'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            /* Report Input and Preview View */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Report Input fields (Col-span 7) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Date Selection Box */}
                <div className={`p-5 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md}`}>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="w-full md:w-auto">
                      <InputField
                        label="Tanggal Laporan (Rencana/Realisasi)"
                        type="date"
                        value={selectedDate}
                        onChange={setSelectedDate}
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1 items-start md:items-end text-xs">
                      <div className="font-semibold text-slate-400">Database Source:</div>
                      <div className="flex items-center gap-1.5">
                        {loadingTargets ? (
                          <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                        ) : (
                          <Database className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span className={`font-bold uppercase ${
                          loadingTargets ? 'text-emerald-400 animate-pulse' : targetSource === 'api' ? 'text-emerald-400' : targetSource === 'cache' ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                          {loadingTargets ? 'Loading...' : targetSource === 'api' ? 'Google Sheet API' : targetSource === 'cache' ? 'Local Cache' : 'Default Templates'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {submitResult?.show && (
                    <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 border text-sm transition-custom ${
                      submitResult.success 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span className="font-medium">{submitResult.message}</span>
                    </div>
                  )}
                </div>

                {/* Input realizations details card */}
                <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.md}`}>
                  <h2 className="text-base font-extrabold tracking-wide text-slate-800 dark:text-slate-100 uppercase mb-4 flex items-center gap-2">
                    <span>Input Realisasi Target</span>
                    <span className="h-1px flex-grow bg-slate-200 dark:bg-slate-800"></span>
                  </h2>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">TARGET HARIAN: {formatIndoNumber(targets.targetHarianKwh)} kWh</div>
                        <InputField
                          label="Realisasi Harian"
                          type="number"
                          placeholder="Masukkan kWh harian..."
                          suffix="kWh"
                          value={realization.realisasiHarianKwh}
                          onChange={(val) => updateRealizationField('realisasiHarianKwh', val)}
                        />
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">TARGET KUMULATIF: {formatIndoNumber(targets.targetKumulatifKwh)} kWh</div>
                        <InputField
                          label="Realisasi Kumulatif"
                          type="number"
                          placeholder="Masukkan kWh kumulatif..."
                          suffix="kWh"
                          value={realization.realisasiKumulatifKwh}
                          onChange={(val) => updateRealizationField('realisasiKumulatifKwh', val)}
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-2">
                        <span>Breakdown Sasaran Pelanggan (Plg)</span>
                        <span className="h-1px flex-grow bg-slate-200 dark:bg-slate-850"></span>
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* LKBK */}
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850/80 rounded-xl">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-xs">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{targets.targetLkbkPlg}</span>
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase">Target</span>
                          </div>
                          <div className="flex-grow">
                            <InputField
                              label="1. LKBK Macet / Numpuk"
                              type="number"
                              placeholder="Realisasi..."
                              value={realization.realisasiLkbkPlg}
                              onChange={(val) => updateRealizationField('realisasiLkbkPlg', val)}
                            />
                          </div>
                        </div>

                        {/* 3 Phasa */}
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850/80 rounded-xl">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-xs">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{targets.target3PhasaPlg}</span>
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase">Target</span>
                          </div>
                          <div className="flex-grow">
                            <InputField
                              label="2. Periksa Plg 3 Phasa"
                              type="number"
                              placeholder="Realisasi..."
                              value={realization.realisasi3PhasaPlg}
                              onChange={(val) => updateRealizationField('realisasi3PhasaPlg', val)}
                            />
                          </div>
                        </div>

                        {/* DLPD */}
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850/80 rounded-xl">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-xs">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{targets.targetDlpdPlg}</span>
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase">Target</span>
                          </div>
                          <div className="flex-grow">
                            <InputField
                              label="3. Periksa TO DLPD"
                              type="number"
                              placeholder="Realisasi..."
                              value={realization.realisasiDlpdPlg}
                              onChange={(val) => updateRealizationField('realisasiDlpdPlg', val)}
                            />
                          </div>
                        </div>

                        {/* Pengembangan */}
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850/80 rounded-xl">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-xs">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{targets.targetPengembanganPlg}</span>
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase">Target</span>
                          </div>
                          <div className="flex-grow">
                            <InputField
                              label="4. Pengembangan TO"
                              type="number"
                              placeholder="Realisasi..."
                              value={realization.realisasiPengembanganPlg}
                              onChange={(val) => updateRealizationField('realisasiPengembanganPlg', val)}
                            />
                          </div>
                        </div>

                        {/* TS Periodik */}
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850/80 rounded-xl">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-xs">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{targets.targetTsPeriodikPlg}</span>
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase">Target</span>
                          </div>
                          <div className="flex-grow">
                            <InputField
                              label="5. Penagihan TS kWh Periodik"
                              type="number"
                              placeholder="Realisasi..."
                              value={realization.realisasiTsPeriodikPlg}
                              onChange={(val) => updateRealizationField('realisasiTsPeriodikPlg', val)}
                            />
                          </div>
                        </div>

                        {/* TS Macet (Kuning) */}
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850/80 rounded-xl">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-xs">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{targets.targetTsMacetPlg}</span>
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase">Target</span>
                          </div>
                          <div className="flex-grow">
                            <InputField
                              label="6. Penagihan TS Macet (Kuning)"
                              type="number"
                              placeholder="Realisasi..."
                              value={realization.realisasiTsMacetPlg}
                              onChange={(val) => updateRealizationField('realisasiTsMacetPlg', val)}
                            />
                          </div>
                        </div>

                        {/* Lainnya */}
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850/80 rounded-xl">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-xs">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{targets.targetLainnyaPlg}</span>
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase">Target</span>
                          </div>
                          <div className="flex-grow">
                            <InputField
                              label="7. Lainnya"
                              type="number"
                              placeholder="Realisasi..."
                              value={realization.realisasiLainnyaPlg}
                              onChange={(val) => updateRealizationField('realisasiLainnyaPlg', val)}
                            />
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Whatsapp Message Live Preview (Col-span 5) */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className={`p-6 ${colors.card} ${borderRadius.xxl} border ${colors.border} ${shadows.xl} flex flex-col`}>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <span>Preview Laporan WhatsApp</span>
                    </h2>
                    
                    <Button
                      variant="secondary"
                      onClick={handleCopyToClipboard}
                      className="px-3 py-1.5"
                      icon={copySuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    >
                      {copySuccess ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>

                  <div className="flex-grow">
                    <pre className="p-4 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl font-mono text-[11px] md:text-[12px] leading-relaxed text-slate-800 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap select-text max-h-[450px]">
                      {calculatedReport ? calculatedReport.whatsappText : 'Generating preview...'}
                    </pre>
                  </div>

                  <div className="mt-6 space-y-4 pt-4 border-t border-slate-200 dark:border-slate-850">
                    <InputField
                      label="Nomor WhatsApp Penerima (Opsional)"
                      type="text"
                      placeholder="Contoh: 628123456789 atau kosongkan"
                      value={whatsappPhone}
                      onChange={handlePhoneChange}
                      onBlur={() => saveSettingsToDb(theme, whatsappPhone, workingDays)}
                      helperText="Mengosongkan nomor akan membuka WhatsApp chat selector"
                    />

                    <Button
                      variant="primary"
                      onClick={handleSendWhatsapp}
                      loading={submittingData}
                      className="w-full text-base font-extrabold uppercase py-4"
                      icon={<Send className="w-5 h-5 text-slate-950" />}
                    >
                      Kirim Laporan P2TL
                    </Button>
                  </div>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>



    </div>
  );
};

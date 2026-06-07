export interface P2TLTarget {
  date: string; // YYYY-MM-DD
  targetHarianKwh: number;
  targetKumulatifKwh: number;
  targetLkbkPlg: number;
  target3PhasaPlg: number;
  targetDlpdPlg: number;
  targetPengembanganPlg: number;
  targetTsPeriodikPlg: number;
  targetTsMacetPlg: number;
  targetLainnyaPlg: number;
}

export interface P2TLRealization {
  date: string; // YYYY-MM-DD
  realisasiHarianKwh: number | '';
  realisasiKumulatifKwh: number | '';
  realisasiLkbkPlg: number | '';
  realisasi3PhasaPlg: number | '';
  realisasiDlpdPlg: number | '';
  realisasiPengembanganPlg: number | '';
  realisasiTsPeriodikPlg: number | '';
  realisasiTsMacetPlg: number | '';
  realisasiLainnyaPlg: number | '';
}

export interface P2TLCalculatedReport {
  date: string;
  formattedDateIndo: string; // e.g. "Sabtu, 06 Juni 2026"
  
  targetHarianKwh: number;
  realisasiHarianKwh: number;
  
  targetKumulatifKwh: number;
  realisasiKumulatifKwh: number;
  realisasiKumulatifPercent: number; // e.g. 71.78
  
  gapKumulatifKwh: number;
  
  totalTargetSasaranPlg: number;
  totalRealisasiSasaranPlg: number;
  
  // Specific Sasaran
  lkbkTarget: number;
  lkbkReal: number;
  
  phasa3Target: number;
  phasa3Real: number;
  
  dlpdTarget: number;
  dlpdReal: number;
  
  pengembanganTarget: number;
  pengembanganReal: number;
  
  tsPeriodikTarget: number;
  tsPeriodikReal: number;
  
  tsMacetTarget: number;
  tsMacetReal: number;
  
  lainnyaTarget: number;
  lainnyaReal: number;
  
  // Final Formatted Whatsapp Text
  whatsappText: string;
}

export interface P2TLResponse {
  target: P2TLTarget;
  realization: {
    realisasiHarianKwh: number;
    realisasiKumulatifKwh: number;
    realisasiHarianTs: number;
    realisasiKumulatifTs: number;
    inspectionsCountHarian: number;
    inspectionsCountKumulatif: number;
  };
  execSummary: {
    totalCasesYear: number;
    totalKwhYear: number;
    totalTsYear: number;
    monthlyTrend: Array<{ month: string; cases: number; kwh: number; ts: number }>;
    tariffBreakdown: Array<{ class: string; cases: number; kwh: number; ts: number }>;
    golonganBreakdown?: Array<{ class: string; cases: number; kwh: number }>;
    dayaBreakdown?: Array<{ class: string; cases: number; kwh: number }>;
    kwhBreakdown?: Array<{ class: string; cases: number; kwh: number }>;
    topFindings: Array<{
      noagenda: string;
      idpel: string;
      nama: string;
      gol: string;
      tarif: string;
      kwh: number;
      ts: number;
      date: string;
    }>;
  };
  settings?: Record<string, string>;
}

export interface P2TLGantiMeterRecord {
  noagenda: string;
  idpel: string;
  nama: string;
  alamat: string;
  tarif: string;
  daya: string;
  tglremaja: string;
  tglnyala: string;
  alasanGantiMeter: string;
  noMeterBaru: string;
  merkMeterBaru: string;
  typeMeterBaru: string;
  thteraMeterBaru: string;
  thbuatMeterBaru: string;
  noMeterLama: string;
  merkMeterLama: string;
  typeMeterLama: string;
  thteraMeterLama: string;
  thbuatMeterLama: string;
  kdpembmeter: string;
}

export interface GantiMeterParams {
  page?: number;
  limit?: number;
  month?: string;
  year?: string;
  search?: string;
  day?: string;
  smartDefault?: string;
  sort?: 'date_desc' | 'date_asc';
}

export interface P2TLGantiMeterResponse {
  status: string;
  records: P2TLGantiMeterRecord[];
  pagination: {
    page: number;
    limit: number;
    totalFiltered: number;
    totalPages: number;
  };
  stats: {
    todayCount: number;
    monthCount: number;
    yearCount: number;
  };
  reasonsBreakdown: Array<{ reason: string; count: number }>;
  cumulativeReasonsBreakdown?: Array<{ reason: string; count: number }>;
  cumulativeOldMeterBreakdown?: Array<{ reason: string; count: number }>;
  cumulativePembMeterBreakdown?: Array<{ reason: string; count: number }>;
  totalCumulativeFiltered?: number;
  availableYears: string[];
  appliedMonth: string;
  appliedYear: string;
  sortApplied?: 'date_desc' | 'date_asc';
  dailyTrend?: Array<{ label: string; count: number; target: number }>;
  weeklyTrend?: Array<{ label: string; count: number; target: number }>;
  monthlyTrend?: Array<{ label: string; count: number; target: number }>;
}

export interface LogsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'date_desc' | 'date_asc';
}

export interface P2TLLogsResponse {
  status: string;
  data: any[];
  pagination: {
    page: number;
    limit: number;
    totalFiltered: number;
    totalPages: number;
  };
  sortApplied: 'date_desc' | 'date_asc';
}

import type { IP2TLRepository } from '../../core/repositories/p2tl.repository';
import type { P2TLTarget, P2TLRealization, P2TLResponse, P2TLGantiMeterResponse, P2TLGantiMeterRecord, GantiMeterParams, LogsQueryParams, P2TLLogsResponse } from '../../core/entities/report.entity';

const TARGET_CACHE_PREFIX = 'p2tl_target_cache_';
const DRAFT_CACHE_PREFIX = 'p2tl_draft_cache_';
const CONFIG_KEY_GAS_URL = 'p2tl_gas_url';

export class GasP2TLRepository implements IP2TLRepository {
  private getGasUrl(): string | null {
    return localStorage.getItem(CONFIG_KEY_GAS_URL);
  }

  private setCacheItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      const err = error as { name?: string };
      if (err?.name === 'QuotaExceededError') {
        try {
          // Purge historical target caches first, keeping the latest entries.
          const targetKeys = Object.keys(localStorage)
            .filter((k) => k.startsWith(TARGET_CACHE_PREFIX))
            .sort();

          while (targetKeys.length > 30) {
            const oldestKey = targetKeys.shift();
            if (oldestKey) localStorage.removeItem(oldestKey);
          }

          localStorage.setItem(key, value);
        } catch (retryError) {
          console.warn(`Cache write skipped for ${key}:`, retryError);
        }
        return;
      }

      console.warn(`Cache write skipped for ${key}:`, error);
    }
  }

  async getTargets(date: string): Promise<P2TLResponse> {
    const gasUrl = this.getGasUrl();
    const cacheKey = `${TARGET_CACHE_PREFIX}${date}`;
    
    // Default targets fallback if offline or no network response
    const fallbackTargets: P2TLTarget = {
      date,
      targetHarianKwh: 19933,
      targetKumulatifKwh: 1562458,
      targetLkbkPlg: 2,
      target3PhasaPlg: 5,
      targetDlpdPlg: 26,
      targetPengembanganPlg: 0,
      targetTsPeriodikPlg: 0,
      targetTsMacetPlg: 0,
      targetLainnyaPlg: 0,
    };

    const fallbackResponse: P2TLResponse = {
      target: fallbackTargets,
      realization: {
        realisasiHarianKwh: 0,
        realisasiKumulatifKwh: 0,
        realisasiHarianTs: 0,
        realisasiKumulatifTs: 0,
        inspectionsCountHarian: 0,
        inspectionsCountKumulatif: 0
      },
      execSummary: {
        totalCasesYear: 142,
        totalKwhYear: 1438902,
        totalTsYear: 1582792200,
        monthlyTrend: [
          { month: 'Jan', kwh: 125400, cases: 12, ts: 125400 * 1100 },
          { month: 'Feb', kwh: 118900, cases: 10, ts: 118900 * 1100 },
          { month: 'Mar', kwh: 132100, cases: 15, ts: 132100 * 1100 },
          { month: 'Apr', kwh: 129800, cases: 14, ts: 129800 * 1100 },
          { month: 'Mei', kwh: 141200, cases: 18, ts: 141200 * 1100 },
          { month: 'Jun', kwh: 135600, cases: 16, ts: 135600 * 1100 },
          { month: 'Jul', kwh: 120500, cases: 11, ts: 120500 * 1100 },
          { month: 'Agu', kwh: 128900, cases: 13, ts: 128900 * 1100 },
          { month: 'Sep', kwh: 134200, cases: 15, ts: 134200 * 1100 },
          { month: 'Okt', kwh: 115400, cases: 9, ts: 115400 * 1100 },
          { month: 'Nov', kwh: 129000, cases: 12, ts: 129000 * 1100 },
          { month: 'Des', kwh: 127902, cases: 12, ts: 127902 * 1100 }
        ],
        tariffBreakdown: [
          { class: 'R', cases: 85, kwh: 685400, ts: 753940000 },
          { class: 'B', cases: 35, kwh: 452100, ts: 497310000 },
          { class: 'S', cases: 12, kwh: 125400, ts: 137940000 },
          { class: 'I', cases: 6, kwh: 142000, ts: 156200000 },
          { class: 'P', cases: 4, kwh: 34002, ts: 37402200 }
        ],
        golonganBreakdown: [
          { class: 'P1', cases: 45, kwh: 412000 },
          { class: 'P2', cases: 30, kwh: 325000 },
          { class: 'P3', cases: 25, kwh: 265400 },
          { class: 'P4', cases: 22, kwh: 242000 },
          { class: 'K2', cases: 15, kwh: 145000 },
          { class: 'LAINNYA', cases: 5, kwh: 49502 }
        ],
        dayaBreakdown: [
          { class: '450 VA', cases: 42, kwh: 189000 },
          { class: '900 VA', cases: 58, kwh: 522000 },
          { class: '1300 VA', cases: 28, kwh: 385000 },
          { class: '2200 VA', cases: 10, kwh: 212000 },
          { class: '> 2200 VA', cases: 4, kwh: 130902 }
        ],
        kwhBreakdown: [],
        topFindings: [
          { noagenda: '537210928312', idpel: '537210982312', nama: 'CV Maju Jaya Elektronik', gol: 'B1/13200VA', tarif: 'B', kwh: 12450, ts: 13695000, date: '2026-06-06' },
          { noagenda: '537210928315', idpel: '537210982319', nama: 'Bpk. Ahmad Subarjo', gol: 'R1/2200VA', tarif: 'R', kwh: 8900, ts: 9790000, date: '2026-06-06' },
          { noagenda: '537210928320', idpel: '537210982325', nama: 'Industri Plastik Salatiga', gol: 'I2/33000VA', tarif: 'I', kwh: 7200, ts: 7920000, date: '2026-06-06' },
          { noagenda: '537210928322', idpel: '537210982330', nama: 'Masjid Agung Salatiga', gol: 'S2/6600VA', tarif: 'S', kwh: 5600, ts: 6160000, date: '2026-06-06' },
          { noagenda: '537210928325', idpel: '537210982341', nama: 'Kantor Kelurahan Kalicacing', gol: 'P1/4400VA', tarif: 'P', kwh: 4100, ts: 4510000, date: '2026-06-06' }
        ]
      }
    };

    if (!gasUrl) {
      // No API URL configured yet, check cache or return fallback
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (_) {
          return fallbackResponse;
        }
      }
      return fallbackResponse;
    }

    try {
      // Append date as query param
      const url = `${gasUrl}?date=${date}`;
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.status === 'success' && result.data) {
        const parsedTarget: P2TLTarget = {
          date: result.date || date,
          targetHarianKwh: Number(result.data.Target_Harian_kWh) || 0,
          targetKumulatifKwh: Number(result.data.Target_Kumulatif_kWh) || 0,
          targetLkbkPlg: Number(result.data.Target_LKBK_Plg) || 0,
          target3PhasaPlg: Number(result.data.Target_3Phasa_Plg) || 0,
          targetDlpdPlg: Number(result.data.Target_DLPD_Plg) || 0,
          targetPengembanganPlg: Number(result.data.Target_Pengembangan_Plg) || 0,
          targetTsPeriodikPlg: Number(result.data.Target_TS_Periodik_Plg) || 0,
          targetTsMacetPlg: Number(result.data.Target_TS_Macet_Plg) || 0,
          targetLainnyaPlg: Number(result.data.Target_Lainnya_Plg) || 0,
        };
        
        const apiResponse: P2TLResponse = {
          target: parsedTarget,
          realization: {
            realisasiHarianKwh: result.realization ? Number(result.realization.realisasiHarianKwh) || 0 : 0,
            realisasiKumulatifKwh: result.realization ? Number(result.realization.realisasiKumulatifKwh) || 0 : 0,
            realisasiHarianTs: result.realization ? Number(result.realization.realisasiHarianTs) || 0 : 0,
            realisasiKumulatifTs: result.realization ? Number(result.realization.realisasiKumulatifTs) || 0 : 0,
            inspectionsCountHarian: result.realization ? Number(result.realization.inspectionsCountHarian) || 0 : 0,
            inspectionsCountKumulatif: result.realization ? Number(result.realization.inspectionsCountKumulatif) || 0 : 0,
          },
           execSummary: {
            totalCasesYear: result.execSummary ? Number(result.execSummary.totalCasesYear) || 0 : 0,
            totalKwhYear: result.execSummary ? Number(result.execSummary.totalKwhYear) || 0 : 0,
            totalTsYear: result.execSummary ? Number(result.execSummary.totalTsYear) || 0 : 0,
            monthlyTrend: result.execSummary && Array.isArray(result.execSummary.monthlyTrend) ? result.execSummary.monthlyTrend : [],
            tariffBreakdown: result.execSummary && Array.isArray(result.execSummary.tariffBreakdown) ? result.execSummary.tariffBreakdown : [],
            golonganBreakdown: result.execSummary && Array.isArray(result.execSummary.golonganBreakdown) ? result.execSummary.golonganBreakdown : [],
            dayaBreakdown: result.execSummary && Array.isArray(result.execSummary.dayaBreakdown) ? result.execSummary.dayaBreakdown : [],
            kwhBreakdown: result.execSummary && Array.isArray(result.execSummary.kwhBreakdown) ? result.execSummary.kwhBreakdown : [],
            topFindings: result.execSummary && Array.isArray(result.execSummary.topFindings) ? result.execSummary.topFindings : [],
          },
          settings: result.settings || undefined
        };
        
        // Save to cache
        this.setCacheItem(cacheKey, JSON.stringify(apiResponse));
        if (result.settings) {
          this.setCacheItem('p2tl_settings_cache', JSON.stringify(result.settings));
        }
        return apiResponse;
      }
      
      throw new Error("Invalid response format from GAS");
    } catch (error) {
      console.warn("GAS fetch targets failed. Using local cache/defaults:", error);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (_) {
          return fallbackResponse;
        }
      }
      return fallbackResponse;
    }
  }

  async saveRealization(realization: P2TLRealization): Promise<boolean> {
    const date = realization.date;
    const cacheKey = `${DRAFT_CACHE_PREFIX}${date}`;
    
    // Store locally as draft first (always succeeds)
    this.setCacheItem(cacheKey, JSON.stringify(realization));
    
    const gasUrl = this.getGasUrl();
    if (!gasUrl) {
      // No GAS URL configured - offline draft mode
      return false;
    }

    try {
      // POST the data to Google Apps Script Web App
      // Since Google Apps Script Web App doGet/doPost redirects can sometimes trigger CORS errors
      // with standard JSON post, we submit as text/plain or standard fetch depending on configuration.
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors', // standard for GAS web apps to prevent CORS block on redirects
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(realization)
      });
      
      // Note: 'no-cors' mode results in an opaque response, which has status 0.
      // This is a known GAS web app detail. We assume success if fetch finishes without throwing.
      return true;
    } catch (error) {
      console.error("Failed to POST realization to Google Sheets:", error);
      return false;
    }
  }

  // Helper to load draft realization for a date
  getDraftRealization(date: string): P2TLRealization | null {
    const cacheKey = `${DRAFT_CACHE_PREFIX}${date}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  async getLogs(): Promise<any[]> {
    const res = await this.getLogsPaginated({ page: 1, limit: 120, sort: 'date_desc' });
    return res.data;
  }

  async getLogsPaginated(params?: LogsQueryParams): Promise<P2TLLogsResponse> {
    const gasUrl = this.getGasUrl();
    const cacheKey = 'p2tl_logs_cache';

    const generateFallbackLogs = () => {
      const mockLogs: any[] = [];
      const today = new Date();
      for (let i = 0; i < 60; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const harianKwh = Math.floor(15000 + Math.random() * 8000);
        const lkbk = Math.random() > 0.6 ? 1 : 0;
        const phasa3 = Math.random() > 0.4 ? Math.floor(1 + Math.random() * 2) : 0;
        const dlpd = Math.floor(15 + Math.random() * 12);

        mockLogs.push({
          Date: dateStr,
          Timestamp: d.toISOString(),
          Realisasi_Harian_kWh: harianKwh,
          Realisasi_Kumulatif_kWh: 1200000 + (60 - i) * 19000,
          Realisasi_LKBK_Plg: lkbk,
          Realisasi_3Phasa_Plg: phasa3,
          Realisasi_DLPD_Plg: dlpd,
          Realisasi_Pengembangan_Plg: 0,
          Realisasi_TS_Periodik_Plg: 0,
          Realisasi_TS_Macet_Plg: 0,
          Realisasi_Lainnya_Plg: 0,
          Realisasi_Harian_TS: harianKwh * 1100,
          Realisasi_Kumulatif_TS: 1200000 * 1100,
        });
      }
      return mockLogs;
    };

    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(200, Math.max(1, params?.limit || 20));
    const search = (params?.search || '').trim();
    const sort = params?.sort === 'date_asc' ? 'date_asc' : 'date_desc';

    const fallbackSlice = (source: any[]): P2TLLogsResponse => {
      const filtered = search
        ? source.filter((log) => {
            const d = String(log.Date || log.date || log.Timestamp || '').toLowerCase();
            return d.includes(search.toLowerCase());
          })
        : source;

      const sorted = [...filtered].sort((a, b) => {
        const da = String(a.Date || a.date || a.Timestamp || '');
        const db = String(b.Date || b.date || b.Timestamp || '');
        return sort === 'date_asc' ? da.localeCompare(db) : db.localeCompare(da);
      });

      const totalFiltered = sorted.length;
      const totalPages = Math.ceil(totalFiltered / limit) || 1;
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * limit;

      return {
        status: 'success',
        data: sorted.slice(start, start + limit),
        pagination: { page: safePage, limit, totalFiltered, totalPages },
        sortApplied: sort,
      };
    };

    const getCachedOrFallback = (): P2TLLogsResponse => {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return fallbackSlice(parsed);
          }
        } catch (_) {}
      }
      return fallbackSlice(generateFallbackLogs());
    };

    if (!gasUrl) {
      return getCachedOrFallback();
    }

    try {
      const qp = new URLSearchParams({ action: 'get_logs' });
      qp.set('page', String(page));
      qp.set('limit', String(limit));
      qp.set('sort', sort);
      if (search) qp.set('search', search);

      const response = await fetch(`${gasUrl}?${qp.toString()}`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.status === 'success' && Array.isArray(result.data)) {
        if (result.data.length > 0 && page === 1 && !search) {
          this.setCacheItem(cacheKey, JSON.stringify(result.data));
        }
        return {
          status: 'success',
          data: result.data,
          pagination: {
            page: Number(result.pagination?.page) || page,
            limit: Number(result.pagination?.limit) || limit,
            totalFiltered: Number(result.pagination?.totalFiltered) || result.data.length,
            totalPages: Number(result.pagination?.totalPages) || 1,
          },
          sortApplied: result.sortApplied === 'date_asc' ? 'date_asc' : 'date_desc',
        };
      }
      throw new Error();
    } catch (error) {
      console.warn('GAS fetch logs failed. Using local cache:', error);
      return getCachedOrFallback();
    }
  }

  async getMonthlyTargets(year: string): Promise<any[]> {
    const gasUrl = this.getGasUrl();
    const cacheKey = `p2tl_monthly_targets_cache_${year}`;
    
    const defaultTargets = Array.from({ length: 12 }, (_, i) => ({
      Month: i + 1,
      Target_kWh: 130205
    }));

    if (!gasUrl) {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : defaultTargets;
    }

    try {
      const url = `${gasUrl}?action=get_monthly_targets&year=${year}`;
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.status === 'success' && Array.isArray(result.data)) {
        this.setCacheItem(cacheKey, JSON.stringify(result.data));
        return result.data;
      }
      throw new Error();
    } catch (error) {
      console.warn("GAS fetch monthly targets failed. Using local cache:", error);
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : defaultTargets;
    }
  }

  async saveMonthlyTargets(year: string, targets: number[]): Promise<boolean> {
    const cacheKey = `p2tl_monthly_targets_cache_${year}`;
    
    const cachedData = targets.map((val, i) => ({
      Month: i + 1,
      Target_kWh: val
    }));
    this.setCacheItem(cacheKey, JSON.stringify(cachedData));

    const gasUrl = this.getGasUrl();
    if (!gasUrl) return false;

    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save_monthly_targets',
          year,
          targets
        })
      });
      return true;
    } catch (error) {
      console.error("Failed to POST monthly targets to Google Sheets:", error);
      return false;
    }
  }

  async getSettings(): Promise<Record<string, string>> {
    const gasUrl = this.getGasUrl();
    const cacheKey = 'p2tl_settings_cache';
    if (!gasUrl) {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : {};
    }

    try {
      const response = await fetch(`${gasUrl}?action=get_settings`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        }
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.status === 'success' && result.settings) {
        this.setCacheItem(cacheKey, JSON.stringify(result.settings));
        return result.settings;
      }
      throw new Error();
    } catch (error) {
      console.warn("GAS fetch settings failed. Using local cache:", error);
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : {};
    }
  }

  async saveSettings(settings: Record<string, string>): Promise<boolean> {
    const cacheKey = 'p2tl_settings_cache';
    this.setCacheItem(cacheKey, JSON.stringify(settings));

    const gasUrl = this.getGasUrl();
    if (!gasUrl) return false;

    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save_settings',
          settings
        })
      });
      return true;
    } catch (error) {
      console.error("Failed to POST settings to Google Sheets:", error);
      return false;
    }
  }

  async getGantiMeter(params?: GantiMeterParams): Promise<P2TLGantiMeterResponse> {
    const gasUrl = this.getGasUrl();

    const mapRecord = (rec: any): P2TLGantiMeterRecord => ({
      noagenda: String(rec.noagenda || rec.NOAGENDA || "").trim(),
      idpel: String(rec.idpel || rec.IDPEL || "").trim(),
      nama: String(rec.nama || rec.NAMA || "").trim(),
      alamat: String(rec.alamat || rec.ALAMAT || "").trim(),
      tarif: String(rec.tarif || rec.TARIF || "").trim(),
      daya: String(rec.daya || rec.DAYA || "").trim(),
      tglremaja: String(rec.tglremaja || rec.TGLREMAJA || "").trim(),
      tglnyala: String(rec.tglnyala || rec.TGLNYALA || "").trim(),
      alasanGantiMeter: String(rec.alasanGantiMeter || rec.ALASAN_GANTI_METER || "").trim(),
      noMeterBaru: String(rec.noMeterBaru || rec.NO_METER_BARU || "").trim(),
      merkMeterBaru: String(rec.merkMeterBaru || rec.MERK_METER_BARU || "").trim(),
      typeMeterBaru: String(rec.typeMeterBaru || rec.TYPE_METER_BARU || "").trim(),
      thteraMeterBaru: String(rec.thteraMeterBaru || rec.THTERA_METER_BARU || "").trim(),
      thbuatMeterBaru: String(rec.thbuatMeterBaru || rec.THBUAT_METER_BARU || "").trim(),
      noMeterLama: String(rec.noMeterLama || rec.NO_METER_LAMA || "").trim(),
      merkMeterLama: String(rec.merkMeterLama || rec.MERK_METER_LAMA || "").trim(),
      typeMeterLama: String(rec.typeMeterLama || rec.TYPE_METER_LAMA || "").trim(),
      thteraMeterLama: String(rec.thteraMeterLama || rec.THTERA_METER_LAMA || "").trim(),
      thbuatMeterLama: String(rec.thbuatMeterLama || rec.THBUAT_METER_LAMA || "").trim(),
      kdpembmeter: String(rec.kdpembmeter || rec.KDPEMBMETER || "").trim(),
    });

    const curYear = String(new Date().getFullYear());
    const curMonth = String(new Date().getMonth() + 1).padStart(2, '0');

    const fallbackResponse: P2TLGantiMeterResponse = {
      status: "success",
      records: [],
      pagination: { page: 1, limit: 10, totalFiltered: 0, totalPages: 0 },
      stats: { todayCount: 0, monthCount: 0, yearCount: 0 },
      reasonsBreakdown: [],
      availableYears: [curYear],
      appliedMonth: curMonth,
      appliedYear: curYear,
      dailyTrend: [],
      weeklyTrend: [],
      monthlyTrend: [],
    };

    if (!gasUrl) return fallbackResponse;

    try {
      // Build query string with pagination & filter params
      const qp = new URLSearchParams({ action: 'get_ganti_meter' });
      if (params?.page) qp.set('page', String(params.page));
      if (params?.limit) qp.set('limit', String(params.limit));
      if (params?.month && params.month !== 'all') qp.set('month', params.month);
      if (params?.year && params.year !== 'all') qp.set('year', params.year);
      if (params?.search) qp.set('search', params.search);
      if (params?.day) qp.set('day', params.day);
      if (params?.smartDefault) qp.set('smart_default', params.smartDefault);
      if (params?.sort) qp.set('sort', params.sort);

      const response = await fetch(`${gasUrl}?${qp.toString()}`, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      if (result.status === 'success') {
        if (Array.isArray(result.records)) {
          result.records = result.records.map(mapRecord);
        }
        return result as P2TLGantiMeterResponse;
      }
      throw new Error("Invalid response format");
    } catch (error) {
      console.warn("GAS fetch ganti meter failed:", error);
      return fallbackResponse;
    }
  }

  async getGantiMeterTargets(year: string): Promise<number[]> {
    const gasUrl = this.getGasUrl();
    const cacheKey = `p2tl_ganti_meter_targets_cache_${year}`;
    const defaultTargets = Array(12).fill(50);

    if (!gasUrl) {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : defaultTargets;
    }

    try {
      const url = `${gasUrl}?action=get_ganti_meter_targets&year=${year}`;
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.status === 'success' && Array.isArray(result.data)) {
        const targets = Array(12).fill(50);
        result.data.forEach((row: any) => {
          const m = Number(row.Month) - 1;
          if (m >= 0 && m < 12) {
            targets[m] = Number(row.Target_Qty) || 0;
          }
        });
        this.setCacheItem(cacheKey, JSON.stringify(targets));
        return targets;
      }
      throw new Error();
    } catch (error) {
      console.warn("GAS fetch ganti meter targets failed. Using local cache:", error);
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : defaultTargets;
    }
  }

  async saveGantiMeterTargets(year: string, targets: number[]): Promise<boolean> {
    const cacheKey = `p2tl_ganti_meter_targets_cache_${year}`;
    this.setCacheItem(cacheKey, JSON.stringify(targets));

    const gasUrl = this.getGasUrl();
    if (!gasUrl) return false;

    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save_ganti_meter_targets',
          year,
          targets
        })
      });
      return true;
    } catch (error) {
      console.error("Failed to POST ganti meter targets to Google Sheets:", error);
      return false;
    }
  }
}


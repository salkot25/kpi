import type { P2TLRealization, P2TLResponse, P2TLGantiMeterResponse, GantiMeterParams, LogsQueryParams, P2TLLogsResponse } from '../entities/report.entity';

export interface IP2TLRepository {
  getTargets(date: string): Promise<P2TLResponse>;
  saveRealization(realization: P2TLRealization): Promise<boolean>;
  getLogs(): Promise<any[]>;
  getLogsPaginated(params?: LogsQueryParams): Promise<P2TLLogsResponse>;
  getMonthlyTargets(year: string): Promise<any[]>;
  saveMonthlyTargets(year: string, targets: number[]): Promise<boolean>;
  getSettings(): Promise<Record<string, string>>;
  saveSettings(settings: Record<string, string>): Promise<boolean>;
  getGantiMeter(params?: GantiMeterParams): Promise<P2TLGantiMeterResponse>;
}

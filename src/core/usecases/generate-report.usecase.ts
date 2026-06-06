import type { P2TLTarget, P2TLRealization, P2TLCalculatedReport } from '../entities/report.entity';

// Helper to format numbers with dot as thousand separator
export function formatIndoNumber(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '..........';
  const num = Number(value);
  if (isNaN(num)) return '..........';
  
  // Format with Indonesian locale style (dot for thousand separator, comma for decimal)
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

// Helper to format percentage with comma as decimal separator
export function formatIndoPercent(value: number): string {
  if (isNaN(value) || !isFinite(value)) return '0,00';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

// Helper to format date to Indonesian format (e.g. Sabtu, 06 Juni 2026)
export function getIndonesianDateString(dateStr: string): string {
  if (!dateStr) return '..........';
  const dateParts = dateStr.split('-');
  if (dateParts.length !== 3) return dateStr;
  
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);
  
  const dateObj = new Date(year, month, day);
  
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  const dayName = days[dateObj.getDay()];
  const dayStr = String(day).padStart(2, '0');
  const monthName = months[dateObj.getMonth()];
  
  return `${dayName}, ${dayStr} ${monthName} ${year}`;
}

export class GenerateReportUseCase {
  execute(target: P2TLTarget, realization: P2TLRealization): P2TLCalculatedReport {
    // Standardize realization values (fallback to 0 for calculations, keep empty string representation)
    const relHarian = realization.realisasiHarianKwh === '' ? 0 : Number(realization.realisasiHarianKwh);
    const relKumulatif = realization.realisasiKumulatifKwh === '' ? 0 : Number(realization.realisasiKumulatifKwh);
    
    const relLkbk = realization.realisasiLkbkPlg === '' ? 0 : Number(realization.realisasiLkbkPlg);
    const rel3Phasa = realization.realisasi3PhasaPlg === '' ? 0 : Number(realization.realisasi3PhasaPlg);
    const relDlpd = realization.realisasiDlpdPlg === '' ? 0 : Number(realization.realisasiDlpdPlg);
    const relPengembangan = realization.realisasiPengembanganPlg === '' ? 0 : Number(realization.realisasiPengembanganPlg);
    const relTsPeriodik = realization.realisasiTsPeriodikPlg === '' ? 0 : Number(realization.realisasiTsPeriodikPlg);
    const relTsMacet = realization.realisasiTsMacetPlg === '' ? 0 : Number(realization.realisasiTsMacetPlg);
    const relLainnya = realization.realisasiLainnyaPlg === '' ? 0 : Number(realization.realisasiLainnyaPlg);
    
    // Calculate percentage
    const kumulatifPercent = target.targetKumulatifKwh > 0 
      ? (relKumulatif / target.targetKumulatifKwh) * 100 
      : 0;
      
    // Calculate GAP Kumulatif
    const gapKumulatif = target.targetKumulatifKwh - relKumulatif;
    
    // Total Target Sasaran is the sum of category targets
    const totalTargetSasaran = 
      target.targetLkbkPlg + 
      target.target3PhasaPlg + 
      target.targetDlpdPlg + 
      target.targetPengembanganPlg + 
      target.targetTsPeriodikPlg + 
      target.targetTsMacetPlg + 
      target.targetLainnyaPlg;
      
    // Total Realisasi Sasaran is the sum of category realizations
    const totalRealisasiSasaran = 
      relLkbk + 
      rel3Phasa + 
      relDlpd + 
      relPengembangan + 
      relTsPeriodik + 
      relTsMacet + 
      relLainnya;
      
    const formattedDateIndo = getIndonesianDateString(realization.date || target.date);
    
    // Formatted strings for template output
    const harianRealStr = realization.realisasiHarianKwh === '' ? '..........' : formatIndoNumber(relHarian);
    const kumulatifRealStr = realization.realisasiKumulatifKwh === '' ? '.................' : formatIndoNumber(relKumulatif);
    const kumulatifPercentStr = realization.realisasiKumulatifKwh === '' ? '.....%' : `${formatIndoPercent(kumulatifPercent)}%`;
    const gapStr = formatIndoNumber(gapKumulatif);
    
    const lkbkRealStr = realization.realisasiLkbkPlg === '' ? '......' : `${relLkbk}`;
    const phasa3RealStr = realization.realisasi3PhasaPlg === '' ? '......' : `${rel3Phasa}`;
    const dlpdRealStr = realization.realisasiDlpdPlg === '' ? '......' : `${relDlpd}`;
    const pengembanganRealStr = realization.realisasiPengembanganPlg === '' ? '......' : `${relPengembangan}`;
    const tsPeriodikRealStr = realization.realisasiTsPeriodikPlg === '' ? '......' : `${relTsPeriodik}`;
    const tsMacetRealStr = realization.realisasiTsMacetPlg === '' ? '......' : `${relTsMacet}`;
    const lainnyaRealStr = realization.realisasiLainnyaPlg === '' ? '......' : `${relLainnya}`;
    const totalRealisasiSasaranStr = totalRealisasiSasaran === 0 && realization.realisasiLkbkPlg === '' ? '......' : `${totalRealisasiSasaran}`;

    // Build the Whatsapp template string exactly as requested
    const whatsappText = `Assalamualaikum Wr. Wb.
Yth.
MUP3 Salatiga
Asman TEL
Semangat Pagi

Berikut disampaikan Rencana P2TL ULP Salatiga Kota
${formattedDateIndo}
1. Target / Realisasi Harian : ${formatIndoNumber(target.targetHarianKwh)}/ ${harianRealStr} kWh
2. Target/ Realisasi Kumulatif : ${formatIndoNumber(target.targetKumulatifKwh)}/ ${kumulatifRealStr} kWh (${kumulatifPercentStr})
3. GAP Kumulatif : ${gapStr} kWh
Sasaran Operasi :   ${totalTargetSasaran} Plg / ${totalRealisasiSasaranStr} Plg (target diperiksa/ yang diperiksa)
1. LKBK Macet / Numpuk : ${target.targetLkbkPlg} Plg / ${lkbkRealStr} Plg
2. Periksa Plg 3 Phasa : ${target.target3PhasaPlg} Plg / ${phasa3RealStr} Plg
3. Periksa TO DLPD : ${target.targetDlpdPlg} Plg / ${dlpdRealStr} Plg
4. Pengembangan TO  : ${target.targetPengembanganPlg} Plg / ${pengembanganRealStr} Plg
5. Penagihan TS kWh Periodik : ${target.targetTsPeriodikPlg} Plg / ${tsPeriodikRealStr} Plg
6. Penagihan TS Macet (Kuning): ${target.targetTsMacetPlg} Plg / ${tsMacetRealStr} Plg
7. lainnya : ${target.targetLainnyaPlg} Plg / ${lainnyaRealStr} Plg

Demikian disampaikan 
Terima kasih`;

    return {
      date: target.date,
      formattedDateIndo,
      targetHarianKwh: target.targetHarianKwh,
      realisasiHarianKwh: relHarian,
      targetKumulatifKwh: target.targetKumulatifKwh,
      realisasiKumulatifKwh: relKumulatif,
      realisasiKumulatifPercent: kumulatifPercent,
      gapKumulatifKwh: gapKumulatif,
      totalTargetSasaranPlg: totalTargetSasaran,
      totalRealisasiSasaranPlg: totalRealisasiSasaran,
      
      lkbkTarget: target.targetLkbkPlg,
      lkbkReal: relLkbk,
      
      phasa3Target: target.target3PhasaPlg,
      phasa3Real: rel3Phasa,
      
      dlpdTarget: target.targetDlpdPlg,
      dlpdReal: relDlpd,
      
      pengembanganTarget: target.targetPengembanganPlg,
      pengembanganReal: relPengembangan,
      
      tsPeriodikTarget: target.targetTsPeriodikPlg,
      tsPeriodikReal: relTsPeriodik,
      
      tsMacetTarget: target.targetTsMacetPlg,
      tsMacetReal: relTsMacet,
      
      lainnyaTarget: target.targetLainnyaPlg,
      lainnyaReal: relLainnya,
      
      whatsappText
    };
  }
}

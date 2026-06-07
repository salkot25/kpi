/**
 * P2TL WhatsApp Report Generator Backend (Google Apps Script)
 *
 * This script should be deployed as a Web App in Google Apps Script.
 * Access level: "Anyone, even anonymous" or configured for service accounts.
 *
 * It manages three sheets:
 * 1. "Targets" - Holds target targets for specific dates.
 * 2. "Realisasi_Logs" - Appends realizations when reports are sent.
 * 3. "Realisasi" - The raw realization finding records.
 */

// Helper to get or create a sheet and set up headers if empty
function getOrCreateSheet(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getSheetCaseInsensitive(ss, sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    // Format headers
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#0f172a");
    headerRange.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Case-insensitive sheet lookup with trimming
function getSheetCaseInsensitive(ss, name) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName().toUpperCase().trim();
    if (sName === name.toUpperCase().trim()) {
      return sheets[i];
    }
  }
  return null;
}

// Ensure the sheets exist and are formatted correctly
function setupSheets() {
  var targetHeaders = [
    "Date",
    "Target_Harian_kWh",
    "Target_Kumulatif_kWh",
    "Target_LKBK_Plg",
    "Target_3Phasa_Plg",
    "Target_DLPD_Plg",
    "Target_Pengembangan_Plg",
    "Target_TS_Periodik_Plg",
    "Target_TS_Macet_Plg",
    "Target_Lainnya_Plg"
  ];
  
  var logHeaders = [
    "Timestamp",
    "Date",
    "Realisasi_Harian_kWh",
    "Realisasi_Kumulatif_kWh",
    "Realisasi_LKBK_Plg",
    "Realisasi_3Phasa_Plg",
    "Realisasi_DLPD_Plg",
    "Realisasi_Pengembangan_Plg",
    "Realisasi_TS_Periodik_Plg",
    "Realisasi_TS_Macet_Plg",
    "Realisasi_Lainnya_Plg"
  ];

  var monthlyTargetHeaders = [
    "Year",
    "Month",
    "Target_kWh"
  ];
  
  getOrCreateSheet("Targets", targetHeaders);
  getOrCreateSheet("Realisasi_Logs", logHeaders);
  getOrCreateSheet("Targets_Bulanan", monthlyTargetHeaders);
  getOrCreateSheet("Targets_Ganti_Meter", ["Year", "Month", "Target_Qty"]);
  getOrCreateSheet("Settings", ["Key", "Value"]);
}

// Helper to read all settings from Settings sheet
function getSettingsFromSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getSheetCaseInsensitive(ss, "Settings");
  if (!sheet) return {};
  
  var data = sheet.getDataRange().getValues();
  var settings = {};
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    var val = String(data[i][1]).trim();
    if (key) {
      settings[key] = val;
    }
  }
  return settings;
}

// Helper to write settings to Settings sheet (upsert key-value pairs)
function saveSettingsToSheet(settingsObj) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet("Settings", ["Key", "Value"]);
  
  // Read existing settings
  var data = sheet.getDataRange().getValues();
  var keysMap = {};
  for (var i = 1; i < data.length; i++) {
    keysMap[String(data[i][0]).trim()] = i + 1; // row index (1-based)
  }
  
  for (var key in settingsObj) {
    if (settingsObj.hasOwnProperty(key)) {
      var val = String(settingsObj[key]).trim();
      var rowIndex = keysMap[key];
      if (rowIndex) {
        sheet.getRange(rowIndex, 2).setValue(val);
      } else {
        sheet.appendRow([key, val]);
        // Update keysMap to support multiple edits of same key in one session
        data = sheet.getDataRange().getValues();
        keysMap[key] = data.length;
      }
    }
  }
}

// Helper to check if a value is a Date object timezone-safely and cross-context safely
function isDateObject(val) {
  return val && (val instanceof Date || (typeof val === 'object' && typeof val.getFullYear === 'function'));
}

// Helper to parse dates in format DD/MM/YYYY, D/M/YYYY, ISO, or Date objects timezone-safely
function parseDateRegister(cellValue) {
  if (isDateObject(cellValue)) {
    try {
      var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
      var dateStr = Utilities.formatDate(cellValue, tz, "yyyy-MM-dd");
      var parts = dateStr.split('-');
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } catch (e) {
      return cellValue;
    }
  }
  
  var str = String(cellValue).trim();
  if (!str) return null;
  
  // Extract only the date portion (remove time if any)
  var datePart = str.split(/[ T]/)[0];
  
  // Try split by slash, dash, or dot
  var parts = datePart.split(/[\/\-\.]/);
  if (parts.length === 3) {
    var p0 = parseInt(parts[0], 10);
    var p1 = parseInt(parts[1], 10) - 1; // 0-indexed in JS Date
    var p2 = parseInt(parts[2], 10);
    
    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      // ISO format: YYYY-MM-DD
      if (parts[0].length === 4) {
        return new Date(p0, p1, p2);
      }
      // ID format: DD-MM-YYYY
      if (parts[2].length === 4 || parts[2].length === 2) {
        var year = p2;
        if (year < 100) year += 2000; // handle 2-digit years
        return new Date(year, p1, p0);
      }
    }
  }
  
  // JS Date parsing fallback
  var jsDate = new Date(str);
  if (!isNaN(jsDate.getTime())) {
    return jsDate;
  }
  
  return null;
}

// Helper to parse numeric values with potential dots as thousand separators
function parseNumericValue(cellValue) {
  if (typeof cellValue === 'number') {
    return cellValue;
  }
  var str = String(cellValue).trim();
  if (!str) return 0;
  
  // Remove thousand separator dots, replace comma with dot for decimals
  str = str.replace(/\./g, '').replace(/,/g, '.');
  var val = parseFloat(str);
  return isNaN(val) ? 0 : val;
}

// Case-insensitive header matching that scans multiple rows (0 to 12) in sheet data
function findHeaderIndexInSheet(sheetData, possibleNames) {
  var maxRows = Math.min(sheetData.length, 12);
  
  // Clean possible names (remove spaces, slashes, dashes, lowercase)
  var cleanNames = possibleNames.map(function(name) {
    return String(name).toUpperCase().replace(/[\/\-\_\s]/g, "");
  });
  
  // First pass: exact cleaned cell value matching
  for (var j = 0; j < cleanNames.length; j++) {
    var target = cleanNames[j];
    if (target === "") continue;
    for (var r = 0; r < maxRows; r++) {
      var row = sheetData[r];
      for (var c = 0; c < row.length; c++) {
        var cellVal = String(row[c] || "").toUpperCase().trim();
        var cleanCellVal = cellVal.replace(/[\/\-\_\s]/g, "");
        if (cleanCellVal === target) {
          return c;
        }
      }
    }
  }
  
  // Second pass: substring cell value matching
  for (var j = 0; j < cleanNames.length; j++) {
    var target = cleanNames[j];
    if (target === "") continue;
    for (var r = 0; r < maxRows; r++) {
      var row = sheetData[r];
      for (var c = 0; c < row.length; c++) {
        var cellVal = String(row[c] || "").toUpperCase().trim();
        var cleanCellVal = cellVal.replace(/[\/\-\_\s]/g, "");
        if (cleanCellVal !== "") {
          if (cleanCellVal.indexOf(target) !== -1 || target.indexOf(cleanCellVal) !== -1) {
            return c;
          }
        }
      }
    }
  }
  
  return -1;
}

// Helper to calculate the number of operational working days in a month based on settings
function getWorkingDaysInMonth(year, monthIndex, setting) {
  var daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  var workingDays = 0;
  for (var d = 1; d <= daysInMonth; d++) {
    var dateObj = new Date(year, monthIndex, d);
    var dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
    if (setting === "5") {
      // Monday - Friday (exclude Sunday 0, Saturday 6)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    } else if (setting === "6") {
      // Monday - Saturday (exclude Sunday 0)
      if (dayOfWeek !== 0) {
        workingDays++;
      }
    } else {
      // Monday - Sunday (7 days)
      workingDays++;
    }
  }
  return workingDays;
}

// Helper to calculate daily and cumulative target based on Targets_Bulanan sheet
function getCalculatedTargetsFromMonthly(year, monthIndex, day) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var monthlySheet = getSheetCaseInsensitive(ss, "Targets_Bulanan");
  if (!monthlySheet) return null;
  
  var data = monthlySheet.getDataRange().getValues();
  var targetsMap = {};
  for (var i = 1; i < data.length; i++) {
    var rowYear = Number(data[i][0]);
    if (rowYear === year) {
      var m = Number(data[i][1]);
      var targetVal = Number(data[i][2]);
      targetsMap[m] = targetVal;
    }
  }
  
  // If no records found for this year, return null
  if (Object.keys(targetsMap).length === 0) return null;
  
  // Get settings to check working days configuration
  var settings = getSettingsFromSheet();
  var workingDaysSetting = settings["working_days"] || "7"; // default to 7 (Senin - Minggu)
  
  var workingDaysInMonth = getWorkingDaysInMonth(year, monthIndex, workingDaysSetting);
  var targetMonth = targetsMap[monthIndex + 1] || 130205;
  
  // Check if current day of week is a working day
  var currentDayOfWeek = new Date(year, monthIndex, day).getDay();
  var isWorkingDay = true;
  if (workingDaysSetting === "5") {
    isWorkingDay = (currentDayOfWeek !== 0 && currentDayOfWeek !== 6);
  } else if (workingDaysSetting === "6") {
    isWorkingDay = (currentDayOfWeek !== 0);
  }
  
  var harian = isWorkingDay ? Math.round(targetMonth / workingDaysInMonth) : 0;
  
  var cumulative = 0;
  // Calculate cumulative targets in full up to this month
  for (var m = 1; m <= monthIndex + 1; m++) {
    cumulative += (targetsMap[m] || 130205);
  }
  
  return {
    harian: harian,
    cumulative: cumulative
  };
}

// Handle GET requests (Retrieve P2TL targets, historical logs, or calculated realisations)
function doGet(e) {
  setupSheets();
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = e && e.parameter && e.parameter.action;
  
  if (action === "get_ganti_meter") {
    var gantiMeterSheet = getSheetCaseInsensitive(ss, "Ganti Meter");
    if (!gantiMeterSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Sheet 'Ganti Meter' tidak ditemukan."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = gantiMeterSheet.getDataRange().getValues();
    var emptyResponse = {
      status: "success",
      records: [],
      pagination: { page: 1, limit: 10, totalFiltered: 0, totalPages: 0 },
      stats: { todayCount: 0, monthCount: 0, yearCount: 0 },
      reasonsBreakdown: [],
      availableYears: [String(new Date().getFullYear())],
      appliedMonth: "all",
      appliedYear: "all",
      sortApplied: "date_desc"
    };
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify(emptyResponse))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // ── Parse query params for pagination & filtering ──
    var pageParam = parseInt((e && e.parameter && e.parameter.page) || "1", 10) || 1;
    var limitParam = parseInt((e && e.parameter && e.parameter.limit) || "10", 10) || 10;
    var filterMonth = ((e && e.parameter && e.parameter.month) || "").trim();
    var filterYear = ((e && e.parameter && e.parameter.year) || "").trim();
    var filterSearch = ((e && e.parameter && e.parameter.search) || "").toLowerCase().trim();
    var filterDay = ((e && e.parameter && e.parameter.day) || "").trim();
    var smartDefault = ((e && e.parameter && e.parameter.smart_default) || "") === "true";
    var sortParam = ((e && e.parameter && e.parameter.sort) || "date_desc").toLowerCase().trim();
    if (sortParam !== "date_asc" && sortParam !== "date_desc") sortParam = "date_desc";
    
    if (limitParam > 100) limitParam = 100;
    if (limitParam < 1) limitParam = 10;
    if (pageParam < 1) pageParam = 1;
    
    // ── Column mapping ──
    var targetCols = [
      "NOAGENDA", "IDPEL", "NAMA", "ALAMAT", "TARIF", "DAYA", "TGLREMAJA", "TGLNYALA", 
      "ALASAN_GANTI_METER", "NO_METER_BARU", "MERK_METER_BARU", "TYPE_METER_BARU", 
      "THTERA_METER_BARU", "THBUAT_METER_BARU", "NO_METER_LAMA", "MERK_METER_LAMA", 
      "TYPE_METER_LAMA", "THTERA_METER_LAMA", "THBUAT_METER_LAMA", "KDPEMBMETER"
    ];
    var colMap = {};
    for (var i = 0; i < targetCols.length; i++) {
      var col = targetCols[i];
      colMap[col] = findHeaderIndexInSheet(data, [col, col.replace(/_/g, " "), col.replace(/_/g, "")]);
    }
    
    // ── Current date reference for global stats ──
    var tz = ss.getSpreadsheetTimeZone();
    var nowStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
    var nowParts = nowStr.split('-');
    var refYear = parseInt(nowParts[0], 10);
    var refMonth = parseInt(nowParts[1], 10) - 1; // 0-indexed
    var refDay = parseInt(nowParts[2], 10);
    
    // ── PASS 1: Build all records, collect global stats & metadata ──
    var allRecords = [];
    var todayCount = 0;
    var monthCount = 0;
    var yearCount = 0;
    var availableYearsSet = {};
    var latestDate = null;
    var latestYearStr = "";
    var latestMonthStr = "";
    
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var record = {};
      var hasData = false;
      
      for (var c = 0; c < targetCols.length; c++) {
        var col2 = targetCols[c];
        var idx = colMap[col2];
        var val = idx !== -1 ? row[idx] : "";
        if (val !== "") hasData = true;
        
        if ((col2 === "TGLREMAJA" || col2 === "TGLNYALA") && val) {
          var pd = parseDateRegister(val);
          if (pd) {
            record[col2] = Utilities.formatDate(pd, tz, "yyyy-MM-dd");
          } else {
            record[col2] = String(val).trim();
          }
        } else if (isDateObject(val)) {
          record[col2] = Utilities.formatDate(val, tz, "yyyy-MM-dd");
        } else {
          record[col2] = String(val).trim();
        }
      }
      if (!hasData) continue;
      
      // Parse record date for stats & filtering (use TGLREMAJA only)
      var recDateStr = record["TGLREMAJA"] || "";
      var recDate = recDateStr ? parseDateRegister(recDateStr) : null;
      var ry = null, rm = null, rd = null;
      var recTs = 0;
      if (recDate) {
        ry = recDate.getFullYear();
        rm = recDate.getMonth(); // 0-indexed
        rd = recDate.getDate();
        recTs = recDate.getTime();
        availableYearsSet[String(ry)] = true;
        
        // Track latest record
        if (!latestDate || recDate > latestDate) {
          latestDate = recDate;
          latestYearStr = String(ry);
          latestMonthStr = (rm + 1 < 10 ? "0" : "") + String(rm + 1);
        }
        
        // Global stats (always counted regardless of filters)
        if (ry === refYear) {
          yearCount++;
          if (rm === refMonth) {
            monthCount++;
            if (rd === refDay) { todayCount++; }
          }
        }
      }
      // Attach parsed date info to record for filter pass
      record._ry = ry;
      record._rm = rm;
      record._dateStr = recDateStr;
      record._ts = recTs;
      record._rowIndex = r;
      allRecords.push(record);
    }
    
    // ── Determine applied filters (smart default logic) ──
    var appliedMonth = filterMonth || "all";
    var appliedYear = filterYear || "all";
    
    if (smartDefault && !filterMonth && !filterYear && !filterDay) {
      if (monthCount > 0) {
        appliedMonth = (refMonth + 1 < 10 ? "0" : "") + String(refMonth + 1);
        appliedYear = String(refYear);
      } else if (latestYearStr && latestMonthStr) {
        appliedMonth = latestMonthStr;
        appliedYear = latestYearStr;
      }
    }
    
    // ── PASS 2: Filter records ──
    var filteredRecords = [];
    var reasonsMap = {};
    
    for (var fi = 0; fi < allRecords.length; fi++) {
      var rec = allRecords[fi];
      
      // Day filter (overrides month/year)
      if (filterDay) {
        if ((rec._dateStr || "") !== filterDay) continue;
      } else {
        // Month filter (1-indexed string "01"-"12")
        if (appliedMonth && appliedMonth !== "all") {
          var fmVal = parseInt(appliedMonth, 10) - 1;
          if (rec._rm === null || rec._rm !== fmVal) continue;
        }
        // Year filter
        if (appliedYear && appliedYear !== "all") {
          var fyVal = parseInt(appliedYear, 10);
          if (rec._ry === null || rec._ry !== fyVal) continue;
        }
      }
      
      // Search filter
      if (filterSearch) {
        var haystack = [
          rec["NOAGENDA"] || "", rec["IDPEL"] || "", rec["NAMA"] || "",
          rec["ALAMAT"] || "", rec["ALASAN_GANTI_METER"] || ""
        ].join(" ").toLowerCase();
        if (haystack.indexOf(filterSearch) === -1) continue;
      }
      
      // Passed all filters
      var reason = (rec["ALASAN_GANTI_METER"] || "Lainnya").trim();
      if (!reason) reason = "Lainnya";
      reasonsMap[reason] = (reasonsMap[reason] || 0) + 1;
      filteredRecords.push(rec);
    }

    // ── Server-side sort ──
    filteredRecords.sort(function(a, b) {
      var at = Number(a._ts || 0);
      var bt = Number(b._ts || 0);
      if (at !== bt) {
        return sortParam === "date_asc" ? (at - bt) : (bt - at);
      }
      var ai = Number(a._rowIndex || 0);
      var bi = Number(b._rowIndex || 0);
      return sortParam === "date_asc" ? (ai - bi) : (bi - ai);
    });
    
    // ── Build reasons breakdown ──
    var reasonsList = [];
    for (var rk in reasonsMap) {
      if (reasonsMap.hasOwnProperty(rk)) {
        reasonsList.push({ reason: rk, count: reasonsMap[rk] });
      }
    }
    reasonsList.sort(function(a, b) { return b.count - a.count; });
    
    // ── Available years ──
    var availableYears = Object.keys(availableYearsSet).sort().reverse();
    if (availableYears.length === 0) availableYears = [String(new Date().getFullYear())];
    
    // ── PASS 3: Calculate trends for charts ──
    var dailyTrend = [];
    var weeklyTrend = [];
    var monthlyTrend = [];
    
    var isSpecificMonth = (appliedMonth && appliedMonth !== "all");
    var isSpecificYear = (appliedYear && appliedYear !== "all");
    
    var targetYearInt = isSpecificYear ? parseInt(appliedYear, 10) : new Date().getFullYear();
    var targetMonthInt = isSpecificMonth ? parseInt(appliedMonth, 10) - 1 : new Date().getMonth();
    
    // Load Targets_Ganti_Meter for the target year
    var gantiMeterTargetsMap = {};
    for (var m = 1; m <= 12; m++) {
      gantiMeterTargetsMap[m] = 50;
    }
    var gmTargetSheet = getSheetCaseInsensitive(ss, "Targets_Ganti_Meter");
    if (gmTargetSheet) {
      var gmTargetData = gmTargetSheet.getDataRange().getValues();
      for (var i = 1; i < gmTargetData.length; i++) {
        var rowYear = Number(gmTargetData[i][0]);
        if (rowYear === targetYearInt) {
          var monthNum = Number(gmTargetData[i][1]);
          var qty = Number(gmTargetData[i][2]);
          gantiMeterTargetsMap[monthNum] = qty;
        }
      }
    }
    
    // Days in that month
    var daysCount = new Date(targetYearInt, targetMonthInt + 1, 0).getDate();
    
    // Initialize daily trend map
    var dailyMap = {};
    for (var d = 1; d <= daysCount; d++) {
      dailyMap[d] = 0;
    }
    
    // Initialize weekly trend map
    var weeklyMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    // Count matches in filteredRecords
    for (var fi = 0; fi < filteredRecords.length; fi++) {
      var rec = filteredRecords[fi];
      var recYear = rec._ry;
      var recMonth = rec._rm;
      if (recYear === targetYearInt && recMonth === targetMonthInt && rec._dateStr) {
        var recDate = parseDateRegister(rec._dateStr);
        if (recDate) {
          var dayNum = recDate.getDate();
          if (dayNum >= 1 && dayNum <= daysCount) {
            dailyMap[dayNum]++;
            
            if (dayNum <= 7) weeklyMap[1]++;
            else if (dayNum <= 14) weeklyMap[2]++;
            else if (dayNum <= 21) weeklyMap[3]++;
            else if (dayNum <= 28) weeklyMap[4]++;
            else weeklyMap[5]++;
          }
        }
      }
    }
    
    // Workdays count for target division (5 work days/week)
    var workingDaysInMonth = getWorkingDaysInMonth(targetYearInt, targetMonthInt, "5");
    var targetForMonth = gantiMeterTargetsMap[targetMonthInt + 1];
    
    for (var d = 1; d <= daysCount; d++) {
      var dateObj = new Date(targetYearInt, targetMonthInt, d);
      var dayOfWeek = dateObj.getDay();
      var isWorkingDay = (dayOfWeek !== 0 && dayOfWeek !== 6);
      var dayTarget = isWorkingDay ? Math.round(targetForMonth / workingDaysInMonth) : 0;
      
      dailyTrend.push({
        label: String(d),
        count: dailyMap[d],
        target: dayTarget
      });
    }
    
    var weeklyTargets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    var ranges = [
      { w: 1, start: 1, end: 7 },
      { w: 2, start: 8, end: 14 },
      { w: 3, start: 15, end: 21 },
      { w: 4, start: 22, end: 28 },
      { w: 5, start: 29, end: daysCount }
    ];
    ranges.forEach(function(r) {
      var weekTarget = 0;
      for (var d = r.start; d <= r.end; d++) {
        var dateObj = new Date(targetYearInt, targetMonthInt, d);
        var dayOfWeek = dateObj.getDay();
        var isWorkingDay = (dayOfWeek !== 0 && dayOfWeek !== 6);
        weekTarget += isWorkingDay ? Math.round(targetForMonth / workingDaysInMonth) : 0;
      }
      weeklyTargets[r.w] = weekTarget;
    });
    
    for (var w = 1; w <= 5; w++) {
      weeklyTrend.push({
        label: "W" + w,
        count: weeklyMap[w],
        target: weeklyTargets[w]
      });
    }
    
    var monthlyMap = {};
    var monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    for (var m = 0; m < 12; m++) {
      monthlyMap[m] = 0;
    }
    
    for (var fi = 0; fi < allRecords.length; fi++) {
      var rec = allRecords[fi];
      if (rec._ry === targetYearInt && rec._rm !== null) {
        monthlyMap[rec._rm]++;
      }
    }
    
    for (var m = 0; m < 12; m++) {
      monthlyTrend.push({
        label: monthNames[m],
        count: monthlyMap[m],
        target: gantiMeterTargetsMap[m + 1]
      });
    }

    // ── Paginate ──
    var totalFiltered = filteredRecords.length;
    var totalPages = Math.ceil(totalFiltered / limitParam) || 1;
    if (pageParam > totalPages) pageParam = totalPages;
    if (pageParam < 1) pageParam = 1;
    var startIdx = (pageParam - 1) * limitParam;
    var pageRecords = filteredRecords.slice(startIdx, startIdx + limitParam);
    
    // Clean internal fields before sending
    for (var ci = 0; ci < pageRecords.length; ci++) {
      delete pageRecords[ci]._ry;
      delete pageRecords[ci]._rm;
      delete pageRecords[ci]._dateStr;
      delete pageRecords[ci]._ts;
      delete pageRecords[ci]._rowIndex;
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      records: pageRecords,
      pagination: {
        page: pageParam,
        limit: limitParam,
        totalFiltered: totalFiltered,
        totalPages: totalPages
      },
      stats: {
        todayCount: todayCount,
        monthCount: monthCount,
        yearCount: yearCount
      },
      reasonsBreakdown: reasonsList,
      availableYears: availableYears,
      appliedMonth: appliedMonth,
      appliedYear: appliedYear,
      sortApplied: sortParam,
      dailyTrend: dailyTrend,
      weeklyTrend: weeklyTrend,
      monthlyTrend: monthlyTrend
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "get_settings") {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      settings: getSettingsFromSheet()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "get_monthly_targets") {
    var yearParam = e && e.parameter && e.parameter.year;
    if (!yearParam) {
      yearParam = String(new Date().getFullYear());
    }
    var monthlySheet = getOrCreateSheet("Targets_Bulanan", ["Year", "Month", "Target_kWh"]);
    var monthlyData = monthlySheet.getDataRange().getValues();
    var targetsList = [];
    
    // Check if we already have records for this year
    for (var i = 1; i < monthlyData.length; i++) {
      var rowYear = String(monthlyData[i][0]).trim();
      if (rowYear === yearParam) {
        targetsList.push({
          Month: Number(monthlyData[i][1]),
          Target_kWh: Number(monthlyData[i][2])
        });
      }
    }
    
    // If no records found for this year, generate defaults, write them to the sheet, and return them
    if (targetsList.length === 0) {
      for (var m = 1; m <= 12; m++) {
        var defaultTarget = 130205; // default target kWh per month
        monthlySheet.appendRow([Number(yearParam), m, defaultTarget]);
        targetsList.push({
          Month: m,
          Target_kWh: defaultTarget
        });
      }
    } else {
      // Sort targetsList by Month ascending
      targetsList.sort(function(a, b) { return a.Month - b.Month; });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: targetsList
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "get_ganti_meter_targets") {
    var yearParam = e && e.parameter && e.parameter.year;
    if (!yearParam) {
      yearParam = String(new Date().getFullYear());
    }
    var gantiMeterSheet = getOrCreateSheet("Targets_Ganti_Meter", ["Year", "Month", "Target_Qty"]);
    var gantiMeterData = gantiMeterSheet.getDataRange().getValues();
    var targetsList = [];
    
    // Check if we already have records for this year
    for (var i = 1; i < gantiMeterData.length; i++) {
      var rowYear = String(gantiMeterData[i][0]).trim();
      if (rowYear === yearParam) {
        targetsList.push({
          Month: Number(gantiMeterData[i][1]),
          Target_Qty: Number(gantiMeterData[i][2])
        });
      }
    }
    
    // If no records found for this year, generate defaults, write them to the sheet, and return them
    if (targetsList.length === 0) {
      for (var m = 1; m <= 12; m++) {
        var defaultTarget = 50; // default target quantity per month
        gantiMeterSheet.appendRow([Number(yearParam), m, defaultTarget]);
        targetsList.push({
          Month: m,
          Target_Qty: defaultTarget
        });
      }
    } else {
      // Sort targetsList by Month ascending
      targetsList.sort(function(a, b) { return a.Month - b.Month; });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: targetsList
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // 1. Debug action to inspect Spreadsheet structure and header parsing
  if (action === "debug") {
    var debugInfo = {};
    debugInfo.sheets = ss.getSheets().map(function(s) { return s.getName(); });
    
    var relSheet = getSheetCaseInsensitive(ss, "Realisasi");
    if (!relSheet) {
      debugInfo.error = "Sheet 'Realisasi' not found";
    } else {
      var data = relSheet.getDataRange().getValues();
      debugInfo.totalRows = data.length;
      if (data.length > 0) {
        // Output first 10 rows for manual structural inspection
        debugInfo.first10Rows = data.slice(0, 10).map(function(row) {
          return row.map(function(cell) { return String(cell); });
        });
        
        var mappedIndices = {};
        var searchHeaders = ["NOAGENDA", "IDPEL", "NAMA", "GOL", "ALAMAT", "TARIF/DAYA", "KWH", "TS", "TANGGAL REGISTER"];
        
        mappedIndices["NOAGENDA"] = findHeaderIndexInSheet(data, ["NOAGENDA", "NO AGENDA", "AGENDA"]);
        mappedIndices["IDPEL"] = findHeaderIndexInSheet(data, ["IDPEL", "ID PEL", "ID PELANGGAN"]);
        mappedIndices["NAMA"] = findHeaderIndexInSheet(data, ["NAMA", "NAMA PELANGGAN", "NAMA_PELANGGAN"]);
        mappedIndices["GOL"] = findHeaderIndexInSheet(data, ["GOL", "GOLONGAN", "GOL PELANGGARAN"]);
        mappedIndices["ALAMAT"] = findHeaderIndexInSheet(data, ["ALAMAT"]);
        mappedIndices["TARIF/DAYA"] = findHeaderIndexInSheet(data, ["TARIF/DAYA", "TARIF", "DAYA", "TARIF_DAYA"]);
        mappedIndices["KWH"] = findHeaderIndexInSheet(data, ["KWH", "KWH TEMUAN", "KWH_TEMUAN"]);
        mappedIndices["TS"] = findHeaderIndexInSheet(data, ["TS", "TAGIHAN SUSULAN", "TAGIHAN_SUSULAN", "TS_KWH"]);
        mappedIndices["TANGGAL REGISTER"] = findHeaderIndexInSheet(data, ["TANGGAL REGISTER", "TANGGAL_REGISTER", "TGL REGISTER", "TGL_REGISTER", "REGISTER"]);
        
        debugInfo.mappedIndices = mappedIndices;
        
        debugInfo.samples = [];
        // Scan starting from row 0, but only output sample rows that have a parsed date (i.e. actual data rows)
        var sampleCount = 0;
        for (var rIdx = 0; rIdx < data.length && sampleCount < 5; rIdx++) {
          var row = data[rIdx];
          var regDateVal = mappedIndices["TANGGAL REGISTER"] !== -1 ? row[mappedIndices["TANGGAL REGISTER"]] : null;
          var parsedDate = parseDateRegister(regDateVal);
          if (!parsedDate) continue;
          
          sampleCount++;
          var sampleRow = { rowIndex: rIdx };
          for (var sIdx = 0; sIdx < searchHeaders.length; sIdx++) {
            var colName = searchHeaders[sIdx];
            var colIdx = mappedIndices[colName];
            if (colIdx !== -1 && colIdx !== undefined) {
              var cellVal = row[colIdx];
              sampleRow[colName] = {
                raw: cellVal,
                type: typeof cellVal,
                isDate: isDateObject(cellVal)
              };
              if (colName === "TANGGAL REGISTER") {
                sampleRow[colName].parsed = parsedDate;
                sampleRow[colName].formatted = Utilities.formatDate(parsedDate, "GMT+7", "yyyy-MM-dd");
              }
              if (colName === "KWH" || colName === "TS") {
                sampleRow[colName].parsedNum = parseNumericValue(cellVal);
              }
            }
          }
          debugInfo.samples.push(sampleRow);
        }
      }
      
      // Add Ganti Meter sheet debug details
      var gantiMeterSheet = getSheetCaseInsensitive(ss, "Ganti Meter");
      if (!gantiMeterSheet) {
        debugInfo.gantiMeterError = "Sheet 'Ganti Meter' not found";
      } else {
        var gmData = gantiMeterSheet.getDataRange().getValues();
        debugInfo.gantiMeterTotalRows = gmData.length;
        if (gmData.length > 0) {
          debugInfo.gantiMeterHeaders = gmData[0];
          debugInfo.gantiMeterFirstRowSample = gmData.length > 1 ? gmData[1] : null;
        }
      }

      // Payload size indicators for quantitative monitoring in debug mode
      var byteSizeOf = function(obj) {
        return Utilities.newBlob(JSON.stringify(obj)).getBytes().length;
      };

      // Estimate logs payload (using Realisasi_Logs row shape)
      var logsSheet = getSheetCaseInsensitive(ss, "Realisasi_Logs");
      var logsRows = 0;
      var logsAvgRowBytes = 0;
      if (logsSheet) {
        var logsData = logsSheet.getDataRange().getValues();
        logsRows = Math.max(0, logsData.length - 1);
        if (logsData.length > 1) {
          var sampleLogs = logsData.slice(1, Math.min(logsData.length, 51));
          var sampleBytes = 0;
          for (var si = 0; si < sampleLogs.length; si++) {
            sampleBytes += byteSizeOf(sampleLogs[si]);
          }
          logsAvgRowBytes = sampleLogs.length > 0 ? Math.round(sampleBytes / sampleLogs.length) : 0;
        }
      }

      // Estimate ganti meter payload (using full row width sample)
      var gmSheet = getSheetCaseInsensitive(ss, "Ganti Meter");
      var gmRows = 0;
      var gmAvgRowBytes = 0;
      if (gmSheet) {
        var gmAll = gmSheet.getDataRange().getValues();
        gmRows = Math.max(0, gmAll.length - 1);
        if (gmAll.length > 1) {
          var sampleGm = gmAll.slice(1, Math.min(gmAll.length, 51));
          var sampleGmBytes = 0;
          for (var gi = 0; gi < sampleGm.length; gi++) {
            sampleGmBytes += byteSizeOf(sampleGm[gi]);
          }
          gmAvgRowBytes = sampleGm.length > 0 ? Math.round(sampleGmBytes / sampleGm.length) : 0;
        }
      }

      debugInfo.payloadIndicators = {
        logs: {
          totalRows: logsRows,
          estimatedAllRowsBytes: logsAvgRowBytes * logsRows,
          estimatedPage20Bytes: logsAvgRowBytes * 20,
          estimatedPage50Bytes: logsAvgRowBytes * 50
        },
        gantiMeter: {
          totalRows: gmRows,
          estimatedAllRowsBytes: gmAvgRowBytes * gmRows,
          estimatedPage10Bytes: gmAvgRowBytes * 10,
          estimatedPage50Bytes: gmAvgRowBytes * 50
        }
      };
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", debug: debugInfo }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Action to fetch logs
  if (action === "get_logs") {
    var pageLog = parseInt((e && e.parameter && e.parameter.page) || "1", 10) || 1;
    var limitLog = parseInt((e && e.parameter && e.parameter.limit) || "20", 10) || 20;
    var searchLog = ((e && e.parameter && e.parameter.search) || "").toLowerCase().trim();
    var sortLog = ((e && e.parameter && e.parameter.sort) || "date_desc").toLowerCase().trim();
    if (sortLog !== "date_asc" && sortLog !== "date_desc") sortLog = "date_desc";
    if (limitLog > 200) limitLog = 200;
    if (limitLog < 1) limitLog = 20;
    if (pageLog < 1) pageLog = 1;

    var logs = [];
    var logSheet = getSheetCaseInsensitive(ss, "Realisasi_Logs");
    if (logSheet) {
      var logData = logSheet.getDataRange().getValues();
      if (logData.length > 1) {
        var logHeaders = logData[0];
        var dateColIdx = logHeaders.indexOf("Date");
        if (dateColIdx === -1) dateColIdx = logHeaders.indexOf("date");
        if (dateColIdx === -1) dateColIdx = 1; // default fallback
        
        for (var i = 1; i < logData.length; i++) {
          var dateVal = logData[i][dateColIdx];
          if (!dateVal || String(dateVal).trim() === "") continue; // Skip empty rows
          
          var row = {};
          for (var j = 0; j < logHeaders.length; j++) {
            var val = logData[i][j];
            if (isDateObject(val)) {
              row[logHeaders[j]] = Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd HH:mm:ss");
            } else {
              row[logHeaders[j]] = val;
            }
          }
          row._dateSort = String(row[logHeaders[dateColIdx]] || "").trim();
          logs.push(row);
        }
      }
    }

    // If no reports have been submitted to Realisasi_Logs, compile log entries dynamically from the Realisasi sheet
    if (logs.length === 0) {
      var realisasiSheet = getSheetCaseInsensitive(ss, "Realisasi");
      if (realisasiSheet) {
        var relData = realisasiSheet.getDataRange().getValues();
        if (relData.length > 1) {
          var idxTanggalRegister = findHeaderIndexInSheet(relData, ["TANGGAL REGISTER", "TANGGAL_REGISTER", "TGL REGISTER", "TGL_REGISTER", "REGISTER", "TANGGAL"]);
          var idxKwh = findHeaderIndexInSheet(relData, ["KWH", "KWH TEMUAN", "KWH_TEMUAN"]);
          var idxGol = findHeaderIndexInSheet(relData, ["GOL", "GOLONGAN", "GOL PELANGGARAN"]);
          var idxTs = findHeaderIndexInSheet(relData, ["TS", "TAGIHAN SUSULAN", "TAGIHAN_SUSULAN", "TS_KWH"]);
          
          var dailyMap = {};
          
          for (var i = 1; i < relData.length; i++) {
            var rowDateVal = idxTanggalRegister !== -1 ? relData[i][idxTanggalRegister] : null;
            var parsedDate = parseDateRegister(rowDateVal);
            if (!parsedDate) continue;
            
            var dateStr = "";
            if (parsedDate instanceof Date && !isNaN(parsedDate.getTime())) {
              dateStr = Utilities.formatDate(parsedDate, "GMT+7", "yyyy-MM-dd");
            } else {
              continue;
            }
            var kwhVal = idxKwh !== -1 ? parseNumericValue(relData[i][idxKwh]) : 0;
            var tsVal = idxTs !== -1 ? parseNumericValue(relData[i][idxTs]) : 0;
            var golStr = idxGol !== -1 ? String(relData[i][idxGol]).toUpperCase().trim() : "";
            
            if (!dailyMap[dateStr]) {
              dailyMap[dateStr] = {
                Date: dateStr,
                Timestamp: dateStr + " 00:00:00",
                Realisasi_Harian_kWh: 0,
                Realisasi_Kumulatif_kWh: 0,
                Realisasi_LKBK_Plg: 0,
                Realisasi_3Phasa_Plg: 0,
                Realisasi_DLPD_Plg: 0,
                Realisasi_Pengembangan_Plg: 0,
                Realisasi_TS_Periodik_Plg: 0,
                Realisasi_TS_Macet_Plg: 0,
                Realisasi_Lainnya_Plg: 0,
                Realisasi_Harian_TS: 0,
                Realisasi_Kumulatif_TS: 0
              };
            }
            
            dailyMap[dateStr].Realisasi_Harian_kWh += kwhVal;
            dailyMap[dateStr].Realisasi_Harian_TS += tsVal;
            
            // Increment category count based on golStr/category matching
            if (golStr.indexOf("LKBK") !== -1 || golStr.indexOf("MACET") !== -1) {
              dailyMap[dateStr].Realisasi_LKBK_Plg++;
            } else if (golStr.indexOf("3 PHASA") !== -1 || golStr.indexOf("3 PHASE") !== -1 || golStr.indexOf("3P") !== -1) {
              dailyMap[dateStr].Realisasi_3Phasa_Plg++;
            } else if (golStr.indexOf("DLPD") !== -1) {
              dailyMap[dateStr].Realisasi_DLPD_Plg++;
            } else if (golStr.indexOf("PENGEMBANGAN") !== -1) {
              dailyMap[dateStr].Realisasi_Pengembangan_Plg++;
            } else if (golStr.indexOf("PERIODIK") !== -1) {
              dailyMap[dateStr].Realisasi_TS_Periodik_Plg++;
            } else if (golStr.indexOf("KUNING") !== -1 || golStr.indexOf("TS MACET") !== -1) {
              dailyMap[dateStr].Realisasi_TS_Macet_Plg++;
            } else {
              dailyMap[dateStr].Realisasi_Lainnya_Plg++;
            }
          }
          
          // Convert map to array and sort chronologically by date
          var dailyList = Object.keys(dailyMap).map(function(k) { return dailyMap[k]; });
          dailyList.sort(function(a, b) {
            return a.Date.localeCompare(b.Date);
          });
          
          // Calculate cumulative values
          var runningKwh = 0;
          var runningTs = 0;
          for (var k = 0; k < dailyList.length; k++) {
            runningKwh += dailyList[k].Realisasi_Harian_kWh;
            runningTs += dailyList[k].Realisasi_Harian_TS;
            dailyList[k].Realisasi_Kumulatif_kWh = runningKwh;
            dailyList[k].Realisasi_Kumulatif_TS = runningTs;
          }
          
          for (var dl = 0; dl < dailyList.length; dl++) {
            dailyList[dl]._dateSort = dailyList[dl].Date;
          }
          logs = dailyList;
        }
      }
    }

    if (searchLog) {
      logs = logs.filter(function(log) {
        var dateVal = String(log.Date || log.date || log.Timestamp || "").toLowerCase();
        return dateVal.indexOf(searchLog) !== -1;
      });
    }

    logs.sort(function(a, b) {
      var da = String(a._dateSort || a.Date || a.date || a.Timestamp || "");
      var db = String(b._dateSort || b.Date || b.date || b.Timestamp || "");
      return sortLog === "date_asc" ? da.localeCompare(db) : db.localeCompare(da);
    });

    var totalFilteredLogs = logs.length;
    var totalPagesLogs = Math.ceil(totalFilteredLogs / limitLog) || 1;
    if (pageLog > totalPagesLogs) pageLog = totalPagesLogs;
    if (pageLog < 1) pageLog = 1;
    var startLog = (pageLog - 1) * limitLog;
    var pageLogs = logs.slice(startLog, startLog + limitLog);

    for (var li = 0; li < pageLogs.length; li++) {
      delete pageLogs[li]._dateSort;
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: pageLogs,
      pagination: {
        page: pageLog,
        limit: limitLog,
        totalFiltered: totalFilteredLogs,
        totalPages: totalPagesLogs
      },
      sortApplied: sortLog
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Default action: fetch targets and aggregates for a specific date
  var dateParam = e && e.parameter && e.parameter.date; // Format YYYY-MM-DD
  if (!dateParam) {
    var today = new Date();
    var utc = today.getTime() + (today.getTimezoneOffset() * 60000);
    var localTime = new Date(utc + (3600000 * 7));
    dateParam = Utilities.formatDate(localTime, "GMT+7", "yyyy-MM-dd");
  }
  
  var paramParts = dateParam.split('-');
  var paramYear = parseInt(paramParts[0], 10);
  var paramMonth = parseInt(paramParts[1], 10) - 1;
  var paramDay = parseInt(paramParts[2], 10);
  var paramDateObj = new Date(paramYear, paramMonth, paramDay);

  // A. Fetch Target Data
  var targetSheet = getSheetCaseInsensitive(ss, "Targets");
  var targetData = targetSheet.getDataRange().getValues();
  var targetHeaders = targetData[0];
  var targetRow = null;
  
  for (var i = 1; i < targetData.length; i++) {
    var rowDate = targetData[i][0];
    var formattedRowDate = "";
    if (isDateObject(rowDate)) {
      formattedRowDate = Utilities.formatDate(rowDate, "GMT+7", "yyyy-MM-dd");
    } else {
      formattedRowDate = String(rowDate).trim();
    }
    if (formattedRowDate === dateParam) {
      targetRow = targetData[i];
      break;
    }
  }
  
  var targetObj = {};
  if (targetRow) {
    for (var j = 0; j < targetHeaders.length; j++) {
      targetObj[targetHeaders[j]] = targetRow[j];
    }
  } else {
    // Standard template fallbacks
    targetObj = {
      "Date": dateParam,
      "Target_Harian_kWh": 19933,
      "Target_Kumulatif_kWh": 1562458,
      "Target_LKBK_Plg": 2,
      "Target_3Phasa_Plg": 5,
      "Target_DLPD_Plg": 26,
      "Target_Pengembangan_Plg": 0,
      "Target_TS_Periodik_Plg": 0,
      "Target_TS_Macet_Plg": 0,
      "Target_Lainnya_Plg": 0
    };
  }

  // Override daily/cumulative target with calculated target if Monthly Targets sheet has data for this year
  var calculatedTargets = getCalculatedTargetsFromMonthly(paramYear, paramMonth, paramDay);
  if (calculatedTargets) {
    targetObj["Target_Harian_kWh"] = calculatedTargets.harian;
    targetObj["Target_Kumulatif_kWh"] = calculatedTargets.cumulative;
  }

  // B. Process "Realisasi" Sheet for Calculations and Executive Summary
  var realisasiSheet = getSheetCaseInsensitive(ss, "Realisasi");
  var realisasiHarianKwh = 0;
  var realisasiKumulatifKwh = 0;
  var realisasiHarianTs = 0;
  var realisasiKumulatifTs = 0;
  var inspectionsCountHarian = 0;
  var inspectionsCountKumulatif = 0;
  
  var execSummary = {
    totalCasesYear: 0,
    totalKwhYear: 0,
    totalTsYear: 0,
    monthlyTrend: [],
    tariffBreakdown: [],
    golonganBreakdown: [],
    dayaBreakdown: [],
    kwhBreakdown: [],
    topFindings: []
  };

  if (realisasiSheet) {
    var relData = realisasiSheet.getDataRange().getValues();
    if (relData.length > 0) {
      // Index markers using robust multiple-row scanning search
      var idxNoAgenda = findHeaderIndexInSheet(relData, ["NOAGENDA", "NO AGENDA", "AGENDA"]);
      var idxIdpel = findHeaderIndexInSheet(relData, ["IDPEL", "ID PEL", "ID PELANGGAN"]);
      var idxNama = findHeaderIndexInSheet(relData, ["NAMA", "NAMA PELANGGAN", "NAMA_PELANGGAN"]);
      var idxGol = findHeaderIndexInSheet(relData, ["GOL", "GOLONGAN", "GOL PELANGGARAN"]);
      var idxAlamat = findHeaderIndexInSheet(relData, ["ALAMAT"]);
      var idxTarifDaya = findHeaderIndexInSheet(relData, ["TARIF/DAYA", "TARIF", "DAYA", "TARIF_DAYA"]);
      var idxKwh = findHeaderIndexInSheet(relData, ["KWH", "KWH TEMUAN", "KWH_TEMUAN"]);
      var idxTs = findHeaderIndexInSheet(relData, ["TS", "TAGIHAN SUSULAN", "TAGIHAN_SUSULAN", "TS_KWH"]);
      var idxTanggalRegister = findHeaderIndexInSheet(relData, ["TANGGAL REGISTER", "TANGGAL_REGISTER", "TGL REGISTER", "TGL_REGISTER", "REGISTER"]);

      // Initialize monthly aggregation slots
      var monthlySlots = {};
      var monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
      for (var m = 0; m < 12; m++) {
        monthlySlots[m] = { month: monthNames[m], cases: 0, kwh: 0, ts: 0 };
      }
      
      var tariffGroups = {};
      var golonganGroups = {};
      var dayaGroups = {
        "450 VA": { class: "450 VA", cases: 0, kwh: 0 },
        "900 VA": { class: "900 VA", cases: 0, kwh: 0 },
        "1300 VA": { class: "1300 VA", cases: 0, kwh: 0 },
        "2200 VA": { class: "2200 VA", cases: 0, kwh: 0 },
        "> 2200 VA": { class: "> 2200 VA", cases: 0, kwh: 0 }
      };
      var kwhGroups = {
        "0 kWh": { class: "0 kWh", cases: 0, kwh: 0 },
        "1 - 100 kWh": { class: "1 - 100 kWh", cases: 0, kwh: 0 },
        "101 - 1.000 kWh": { class: "101 - 1.000 kWh", cases: 0, kwh: 0 },
        "1.001 - 5.000 kWh": { class: "1.001 - 5.000 kWh", cases: 0, kwh: 0 },
        "> 5.000 kWh": { class: "> 5.000 kWh", cases: 0, kwh: 0 }
      };
      var allYearFindings = [];

      // Scan starting from row 0, skipping rows that are not data (i.e. don't have a valid register date)
      for (var r = 0; r < relData.length; r++) {
        var rowVal = relData[r];
        
        var regDateVal = idxTanggalRegister !== -1 ? rowVal[idxTanggalRegister] : null;
        var parsedDate = parseDateRegister(regDateVal);
        if (!parsedDate) continue;
        
        var rowYear = parsedDate.getFullYear();
        var rowMonth = parsedDate.getMonth();
        var rowDay = parsedDate.getDate();
        
        var kwhVal = idxKwh !== -1 ? parseNumericValue(rowVal[idxKwh]) : 0;
        var tsVal = idxTs !== -1 ? parseNumericValue(rowVal[idxTs]) : 0;
        
        // Match chosen year
        if (rowYear === paramYear) {
          execSummary.totalCasesYear++;
          execSummary.totalKwhYear += kwhVal;
          execSummary.totalTsYear += tsVal;
          
          if (monthlySlots[rowMonth]) {
            monthlySlots[rowMonth].cases++;
            monthlySlots[rowMonth].kwh += kwhVal;
            monthlySlots[rowMonth].ts += tsVal;
          }
          
          // Group by Tariff prefix letter
          var tarifStr = idxTarifDaya !== -1 ? String(rowVal[idxTarifDaya]).trim() : "";
          var tarifClass = "LAINNYA";
          if (tarifStr) {
            var firstChar = tarifStr.charAt(0).toUpperCase();
            if (["R", "B", "S", "I", "P"].indexOf(firstChar) !== -1) {
              tarifClass = firstChar;
            }
          }
          if (!tariffGroups[tarifClass]) {
            tariffGroups[tarifClass] = { class: tarifClass, cases: 0, kwh: 0, ts: 0 };
          }
          tariffGroups[tarifClass].cases++;
          tariffGroups[tarifClass].kwh += kwhVal;
          tariffGroups[tarifClass].ts += tsVal;

          // Group by Golongan Pelanggaran (P1, P2, P3, P4, K2)
          var golStr = idxGol !== -1 ? String(rowVal[idxGol]).trim().toUpperCase() : "";
          if (!golStr) golStr = "LAINNYA";
          if (["P1", "P2", "P3", "P4", "K2"].indexOf(golStr) === -1) {
            golStr = "LAINNYA";
          }
          if (!golonganGroups[golStr]) {
            golonganGroups[golStr] = { class: golStr, cases: 0, kwh: 0 };
          }
          golonganGroups[golStr].cases++;
          golonganGroups[golStr].kwh += kwhVal;

          // Group by Daya
          var tarifDayaStr = idxTarifDaya !== -1 ? String(rowVal[idxTarifDaya]).trim() : "";
          var dayaVal = 0;
          if (tarifDayaStr) {
            var partsDaya = tarifDayaStr.split('/');
            if (partsDaya.length > 1) {
              dayaVal = parseInt(partsDaya[1].replace(/[^0-9]/g, ""), 10) || 0;
            } else {
              dayaVal = parseInt(tarifDayaStr.replace(/[^0-9]/g, ""), 10) || 0;
            }
          }
          
          var dayaLabel = "> 2200 VA";
          if (dayaVal === 450) {
            dayaLabel = "450 VA";
          } else if (dayaVal === 900) {
            dayaLabel = "900 VA";
          } else if (dayaVal === 1300) {
            dayaLabel = "1300 VA";
          } else if (dayaVal === 2200) {
            dayaLabel = "2200 VA";
          } else if (dayaVal > 0 && dayaVal < 450) {
            dayaLabel = "450 VA";
          } else if (dayaVal > 450 && dayaVal < 900) {
            dayaLabel = "900 VA";
          } else if (dayaVal > 900 && dayaVal < 1300) {
            dayaLabel = "1300 VA";
          } else if (dayaVal > 1300 && dayaVal < 2200) {
            dayaLabel = "2200 VA";
          }
          dayaGroups[dayaLabel].cases++;
          dayaGroups[dayaLabel].kwh += kwhVal;

          // Group by kWh Range
          var kwhValRounded = Math.round(kwhVal);
          var kwhLabel = "0 kWh";
          if (kwhValRounded === 0) {
            kwhLabel = "0 kWh";
          } else if (kwhValRounded >= 1 && kwhValRounded <= 100) {
            kwhLabel = "1 - 100 kWh";
          } else if (kwhValRounded >= 101 && kwhValRounded <= 1000) {
            kwhLabel = "101 - 1.000 kWh";
          } else if (kwhValRounded >= 1001 && kwhValRounded <= 5000) {
            kwhLabel = "1.001 - 5.000 kWh";
          } else if (kwhValRounded > 5000) {
            kwhLabel = "> 5.000 kWh";
          }
          kwhGroups[kwhLabel].cases++;
          kwhGroups[kwhLabel].kwh += kwhVal;

          allYearFindings.push({
            noagenda: idxNoAgenda !== -1 ? String(rowVal[idxNoAgenda]) : "",
            idpel: idxIdpel !== -1 ? String(rowVal[idxIdpel]) : "",
            nama: idxNama !== -1 ? String(rowVal[idxNama]) : "",
            gol: idxGol !== -1 ? String(rowVal[idxGol]) : "",
            tarif: tarifStr,
            kwh: kwhVal,
            ts: tsVal,
            date: Utilities.formatDate(parsedDate, "GMT+7", "yyyy-MM-dd")
          });
          
          // Cumulative up to selected date
          var rowDateCompare = new Date(rowYear, rowMonth, rowDay);
          if (rowDateCompare <= paramDateObj) {
            realisasiKumulatifKwh += kwhVal;
            realisasiKumulatifTs += tsVal;
            inspectionsCountKumulatif++;
          }
        }
        
        // Exact day match (Harian)
        if (rowYear === paramYear && rowMonth === paramMonth && rowDay === paramDay) {
          realisasiHarianKwh += kwhVal;
          realisasiHarianTs += tsVal;
          inspectionsCountHarian++;
        }
      }
      
      execSummary.monthlyTrend = Object.keys(monthlySlots).map(function(k) { return monthlySlots[k]; });
      execSummary.tariffBreakdown = Object.keys(tariffGroups).map(function(k) { return tariffGroups[k]; });
      
      execSummary.golonganBreakdown = Object.keys(golonganGroups).map(function(k) { return golonganGroups[k]; });
      var orderGol = ["P1", "P2", "P3", "P4", "K2", "LAINNYA"];
      execSummary.golonganBreakdown.sort(function(a, b) {
        return orderGol.indexOf(a.class) - orderGol.indexOf(b.class);
      });

      execSummary.dayaBreakdown = Object.keys(dayaGroups).map(function(k) { return dayaGroups[k]; }).filter(function(g) { return g.cases > 0; });
      execSummary.kwhBreakdown = Object.keys(kwhGroups).map(function(k) { return kwhGroups[k]; }).filter(function(g) { return g.cases > 0; });
      
      // Sort to get top 5 highest findings
      allYearFindings.sort(function(a, b) { return b.ts - a.ts; });
      execSummary.topFindings = allYearFindings.slice(0, 5);
    }
  }

  var responseData = {
    status: "success",
    date: dateParam,
    found: targetRow ? true : false,
    data: targetObj,
    realization: {
      realisasiHarianKwh: realisasiHarianKwh,
      realisasiKumulatifKwh: realisasiKumulatifKwh,
      realisasiHarianTs: realisasiHarianTs,
      realisasiKumulatifTs: realisasiKumulatifTs,
      inspectionsCountHarian: inspectionsCountHarian,
      inspectionsCountKumulatif: inspectionsCountKumulatif
    },
    execSummary: execSummary,
    settings: getSettingsFromSheet()
  };
  
  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

// Handle POST requests (Submit realization values to Google Sheets)
function doPost(e) {
  setupSheets();
  
  var response = {};
  try {
    var postData;
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (err) {
        postData = e.parameter;
      }
    } else {
      postData = e.parameter;
    }

    // Handle save settings action
    if (postData && postData.action === "save_settings") {
      var settings = postData.settings;
      saveSettingsToSheet(settings);
      
      response.status = "success";
      response.message = "Settings saved to spreadsheet successfully.";
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Handle monthly target save action
    if (postData && postData.action === "save_monthly_targets") {
      var year = String(postData.year).trim();
      var targets = postData.targets; // Array of 12 numbers
      
      var monthlySheet = getOrCreateSheet("Targets_Bulanan", ["Year", "Month", "Target_kWh"]);
      var monthlyData = monthlySheet.getDataRange().getValues();
      
      // Delete existing rows for this year (excluding header)
      for (var i = monthlyData.length - 1; i >= 1; i--) {
        var rowYear = String(monthlyData[i][0]).trim();
        if (rowYear === year) {
          monthlySheet.deleteRow(i + 1); // 1-indexed
        }
      }
      
      // Append new targets
      for (var m = 0; m < 12; m++) {
        var mNum = m + 1;
        var targetKwh = Number(targets[m]) || 0;
        monthlySheet.appendRow([Number(year), mNum, targetKwh]);
      }
      
      response.status = "success";
      response.message = "Monthly targets saved successfully.";
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Handle ganti meter target save action
    if (postData && postData.action === "save_ganti_meter_targets") {
      var year = String(postData.year).trim();
      var targets = postData.targets; // Array of 12 numbers
      
      var gantiMeterSheet = getOrCreateSheet("Targets_Ganti_Meter", ["Year", "Month", "Target_Qty"]);
      var gantiMeterData = gantiMeterSheet.getDataRange().getValues();
      
      // Delete existing rows for this year (excluding header)
      for (var i = gantiMeterData.length - 1; i >= 1; i--) {
        var rowYear = String(gantiMeterData[i][0]).trim();
        if (rowYear === year) {
          gantiMeterSheet.deleteRow(i + 1); // 1-indexed
        }
      }
      
      // Append new targets
      for (var m = 0; m < 12; m++) {
        var mNum = m + 1;
        var targetQty = Number(targets[m]) || 0;
        gantiMeterSheet.appendRow([Number(year), mNum, targetQty]);
      }
      
      response.status = "success";
      response.message = "Ganti Meter targets saved successfully.";
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var logSheet = getSheetCaseInsensitive(SpreadsheetApp.getActiveSpreadsheet(), "Realisasi_Logs");
    var timestamp = new Date();
    
    var newRow = [
      timestamp,
      postData.date || "",
      Number(postData.realisasiHarianKwh) || 0,
      Number(postData.realisasiKumulatifKwh) || 0,
      Number(postData.realisasiLkbkPlg) || 0,
      Number(postData.realisasi3PhasaPlg) || 0,
      Number(postData.realisasiDlpdPlg) || 0,
      Number(postData.realisasiPengembanganPlg) || 0,
      Number(postData.realisasiTsPeriodikPlg) || 0,
      Number(postData.realisasiTsMacetPlg) || 0,
      Number(postData.realisasiLainnyaPlg) || 0
    ];
    
    logSheet.appendRow(newRow);
    
    response.status = "success";
    response.message = "Realisasi data saved successfully.";
  } catch (error) {
    response.status = "error";
    response.message = error.toString();
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

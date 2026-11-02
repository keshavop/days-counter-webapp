/**
 * Days Counter — Google Apps Script backend.
 *
 * Stores events as rows in a tab called "events" in the spreadsheet this script is bound to.
 * Deploy: Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 * Optional: Project settings → Script properties → API_KEY = <secret>, and enter the same key in the app.
 *
 * API
 *   GET  ?action=ping&key=…   → { ok, sheetName, sheetUrl }
 *   GET  ?action=list&key=…   → { ok, rows: [ {id, title, …}, … ] }
 *   GET  ?action=csv&key=…    → the sheet as CSV text
 *   POST { action: "upsert",  key, rows }  → insert/update rows by id (newer updated_at wins);
 *                                            rows with deleted="TRUE" are removed. Returns { ok, rows }.
 *   POST { action: "replace", key, rows }  → overwrite all rows. Returns { ok, rows }.
 */

var SHEET_NAME = 'events';
var HEADERS = [
  'id', 'title', 'date', 'description', 'reminder_at', 'notify_text', 'repeat', 'format',
  'cover', 'image', 'dim', 'font', 'counter_size', 'title_size', 'color', 'divider',
  'created_at', 'updated_at', 'deleted'
];

function doGet(e) {
  return handle_(function () {
    var p = (e && e.parameter) || {};
    checkKey_(p.key);
    var action = p.action || 'list';
    if (action === 'ping') {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      getSheet_();
      return { ok: true, sheetName: ss.getName(), sheetUrl: ss.getUrl() };
    }
    if (action === 'csv') {
      return ContentService.createTextOutput(toCsv_()).setMimeType(ContentService.MimeType.CSV);
    }
    return { ok: true, rows: readRows_() };
  });
}

function doPost(e) {
  return handle_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkKey_(body.key);
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var rows = Array.isArray(body.rows) ? body.rows : [];
      if (body.action === 'upsert') upsert_(rows);
      else if (body.action === 'replace') replace_(rows);
      else throw new Error('Unknown action: ' + body.action);
      SpreadsheetApp.flush();
      return { ok: true, rows: readRows_() };
    } finally {
      lock.releaseLock();
    }
  });
}

/* ---------- helpers ---------- */

function handle_(fn) {
  var out;
  try {
    out = fn();
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  if (out && typeof out.getContent === 'function') return out; // already a TextOutput (csv)
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function checkKey_(key) {
  var expected = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (expected && key !== expected) throw new Error('Wrong access key');
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  // Keep everything as plain text so dates like 2026-12-19 aren't turned into Date cells.
  sh.getRange(1, 1, sh.getMaxRows(), HEADERS.length).setNumberFormat('@');
  return sh;
}

/** Column index (0-based) of every known header, read from the sheet so columns can be reordered. */
function headerMap_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var map = {};
  head.forEach(function (h, i) { map[String(h).trim()] = i; });
  // Add any missing headers to the right.
  HEADERS.forEach(function (h) {
    if (map[h] === undefined) {
      var col = sh.getLastColumn() + 1;
      sh.getRange(1, col).setValue(h).setFontWeight('bold');
      map[h] = col - 1;
    }
  });
  return map;
}

function readRows_() {
  var sh = getSheet_();
  var map = headerMap_(sh);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getDisplayValues();
  var rows = [];
  values.forEach(function (v) {
    var row = {};
    HEADERS.forEach(function (h) { row[h] = v[map[h]] || ''; });
    if (row.id && row.date) rows.push(row);
  });
  return rows;
}

function toValues_(row, map, width) {
  var out = new Array(width).fill('');
  HEADERS.forEach(function (h) {
    var v = row[h];
    out[map[h]] = v === undefined || v === null ? '' : String(v);
  });
  return out;
}

function upsert_(rows) {
  var sh = getSheet_();
  var map = headerMap_(sh);
  var width = sh.getLastColumn();
  var last = sh.getLastRow();
  var existing = last >= 2 ? sh.getRange(2, 1, last - 1, width).getDisplayValues() : [];
  var index = {};
  existing.forEach(function (v, i) { index[v[map.id]] = { rowNum: i + 2, updated: v[map.updated_at] }; });

  var toDelete = [];
  var toAppend = [];
  rows.forEach(function (row) {
    if (!row || !row.id) return;
    var hit = index[row.id];
    var isDeleted = /^(true|1|yes)$/i.test(String(row.deleted || ''));
    if (isDeleted) {
      if (hit && hit.rowNum > 0) toDelete.push(hit.rowNum);
      return;
    }
    row.deleted = '';
    if (hit && hit.rowNum > 0) {
      // Last write wins: ignore a change older than what the sheet already has.
      if (hit.updated && row.updated_at && String(row.updated_at) < String(hit.updated)) return;
      sh.getRange(hit.rowNum, 1, 1, width).setValues([toValues_(row, map, width)]);
    } else if (!hit) {
      toAppend.push(toValues_(row, map, width));
      index[row.id] = { rowNum: -1, updated: row.updated_at };
    }
  });

  if (toAppend.length) {
    sh.getRange(sh.getLastRow() + 1, 1, toAppend.length, width).setNumberFormat('@').setValues(toAppend);
  }
  toDelete.sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
}

function replace_(rows) {
  var sh = getSheet_();
  var last = sh.getLastRow();
  if (last >= 2) sh.deleteRows(2, last - 1);
  upsert_(rows);
}

function toCsv_() {
  var rows = readRows_();
  var esc = function (v) {
    v = String(v);
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  var lines = [HEADERS.join(',')];
  rows.forEach(function (r) { lines.push(HEADERS.map(function (h) { return esc(r[h]); }).join(',')); });
  return lines.join('\r\n');
}

/**
 * Days Counter — CSV storage in Google Drive.
 *
 * The app's server keeps two CSV files in one Drive folder: users.csv and events.csv.
 * This script only reads and overwrites those files; the app does everything else.
 *
 * Setup (script.google.com → New project, paste this file):
 * 1. Set SECRET below to a long random string (e.g. `openssl rand -hex 24`).
 *    The same value goes in the app's DRIVE_SCRIPT_SECRET.
 * 2. Optional: Project settings → Script properties → FOLDER_ID = the id of a Drive folder.
 *    Without it the script creates a folder called "Days Counter data" on first use.
 * 3. Deploy → New deployment → Web app: Execute as **Me**, Who has access **Anyone**.
 *    Authorise, then copy the /exec URL into DRIVE_SCRIPT_URL.
 * After editing later: Deploy → Manage deployments → Edit → Version: New version.
 *
 * Every request must carry SECRET, so the URL alone gives no access.
 *
 * API (POST, JSON body)
 *   { secret, action: "info" }                    → { ok, folder, url }
 *   { secret, action: "read",  file }             → { ok, csv }   ("" if the file doesn't exist yet)
 *   { secret, action: "write", file, csv }        → { ok }
 */

const SECRET = "change-me-to-a-long-random-string";
var FOLDER_NAME = "Days Counter data";
var FILES = { "users.csv": true, "events.csv": true };

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: "bad request: body must be JSON" });
  }
  if (!SECRET || SECRET === "change-me-to-a-long-random-string") {
    return reply({ ok: false, error: "set SECRET in the Apps Script first" });
  }
  if (req.secret !== SECRET) return reply({ ok: false, error: "unauthorized" });

  // One request at a time, so a write never interleaves with another read or write.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return reply({ ok: false, error: "busy, try again" });
  try {
    var dir = folder();
    switch (req.action) {
      case "info":
        return reply({ ok: true, folder: dir.getName(), url: dir.getUrl() });

      case "read": {
        var f = file(dir, req.file);
        return reply({ ok: true, csv: f ? f.getBlob().getDataAsString("UTF-8") : "" });
      }

      case "write": {
        if (typeof req.csv !== "string") return reply({ ok: false, error: "write needs csv text" });
        var existing = file(dir, req.file);
        if (existing) existing.setContent(req.csv);
        else dir.createFile(req.file, req.csv, MimeType.CSV);
        return reply({ ok: true });
      }

      default:
        return reply({ ok: false, error: "unknown action " + req.action });
    }
  } catch (err) {
    return reply({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return reply({ ok: true, service: "days-counter" });
}

function folder() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("FOLDER_ID");
  if (id) return DriveApp.getFolderById(id);
  var found = DriveApp.getFoldersByName(FOLDER_NAME);
  var dir = found.hasNext() ? found.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty("FOLDER_ID", dir.getId());
  return dir;
}

function file(dir, name) {
  if (!FILES[name]) throw new Error('unknown file "' + name + '"');
  var found = dir.getFilesByName(name);
  return found.hasNext() ? found.next() : null;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

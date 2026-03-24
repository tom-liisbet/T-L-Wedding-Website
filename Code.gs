// ─────────────────────────────────────────────────────────────
//  Tom & Liisbet Wedding — RSVP Google Apps Script
//  Paste this entire file into the Apps Script editor.
//  Deploy as a Web App (see setup steps below).
// ─────────────────────────────────────────────────────────────

var SHEET_NAME         = 'RSVPs';
var INVITES_SHEET_NAME = 'Invites';

// RSVPs sheet headers — Invite ID and Submission Type appended at the end
// so existing rows remain valid if you had RSVPs before this update.
var HEADERS = [
  'Timestamp',
  'First Name',
  'Last Name',
  'Email',
  'Attendance',
  'Guests',
  'Dietary',
  'Accommodation',
  'Tuljak Interest',
  'Song Request',
  'Message',
  'Invite ID',       // col 12 (index 11)
  'Submission Type'  // col 13 (index 12) — "New" or "Update"
];

// Invites sheet headers
var INVITE_HEADERS = [
  'Invite ID',        // A — unique key, e.g. INV001
  'Emails',           // B — comma-separated emails, e.g. "a@b.com, c@d.com"
  'Guest Names',      // C — display name shown on site, e.g. "John & Jane Smith"
  'Max Guests',       // D — max guests allowed for this invite
  'RSVP Submitted',   // E — auto-filled: blank → "yes"
  'RSVP Timestamp'    // F — auto-filled date/time
];

// ── Utility ──
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────
//  GET — email lookup
//  Called by the website with ?action=lookup&email=...
// ─────────────────────────────────────────────────────────────
function doGet(e) {
  var email = ((e.parameter && e.parameter.email) || '').toLowerCase().trim();
  return lookupEmail(email);
}

function lookupEmail(email) {
  try {
    if (!email) {
      return jsonResponse({ found: false, error: 'No email provided' });
    }

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(INVITES_SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ found: false, error: 'Invites sheet not found — run setupInvitesSheet() first' });
    }

    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      var row    = data[i];
      var emails = String(row[1])
        .split(',')
        .map(function(addr) { return addr.trim().toLowerCase(); });

      if (emails.indexOf(email) > -1) {
        return jsonResponse({
          found:         true,
          inviteId:      String(row[0]),
          guestNames:    String(row[2]),
          maxGuests:     parseInt(row[3]) || 4,
          alreadyRsvped: String(row[4]).toLowerCase() === 'yes'
        });
      }
    }

    return jsonResponse({ found: false });

  } catch (err) {
    return jsonResponse({ found: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
//  POST — save RSVP
// ─────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    // Create the RSVPs sheet on first run
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    }

    var p        = e.parameter;
    var isUpdate = p.is_update === 'true';
    var inviteId = p.invite_id || '';

    // If updating, delete the previous RSVP row for this invite
    if (isUpdate && inviteId) {
      var allData = sheet.getDataRange().getValues();
      // Invite ID lives at index 11 (column 12)
      for (var i = allData.length - 1; i >= 1; i--) {
        if (String(allData[i][11]) === inviteId) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
    }

    sheet.appendRow([
      new Date(),
      p.first_name      || '',
      p.last_name       || '',
      p.email           || '',
      p.attendance      || '',
      p.guests          || '',
      p.dietary         || '',
      p.accommodation   || '',
      p.tuljak_interest || '',
      p.song_request    || '',
      p.message         || '',
      inviteId,
      isUpdate ? 'Update' : 'New'
    ]);

    // Mark the invite row as submitted
    if (inviteId) {
      markInviteRsvped(inviteId);
    }

    return jsonResponse({ result: 'success' });

  } catch (err) {
    return jsonResponse({ result: 'error', error: err.message });
  }
}

// ── Helper: stamp the Invites sheet when an RSVP is received ──
function markInviteRsvped(inviteId) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(INVITES_SHEET_NAME);
    if (!sheet) return;

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === inviteId) {
        sheet.getRange(i + 1, 5).setValue('yes');       // Col E — RSVP Submitted
        sheet.getRange(i + 1, 6).setValue(new Date());  // Col F — RSVP Timestamp
        return;
      }
    }
  } catch (err) {
    // Don't let this prevent the RSVP from saving
  }
}

// ─────────────────────────────────────────────────────────────
//  RUN ONCE: creates the Invites sheet with headers
//  In the Apps Script editor: Run → Run function → setupInvitesSheet
// ─────────────────────────────────────────────────────────────
function setupInvitesSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(INVITES_SHEET_NAME);

  if (sheet) {
    Logger.log('Invites sheet already exists — nothing to do.');
    return;
  }

  sheet = ss.insertSheet(INVITES_SHEET_NAME);
  sheet.appendRow(INVITE_HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, INVITE_HEADERS.length).setFontWeight('bold');

  sheet.setColumnWidth(1, 80);   // Invite ID
  sheet.setColumnWidth(2, 240);  // Emails
  sheet.setColumnWidth(3, 180);  // Guest Names
  sheet.setColumnWidth(4, 90);   // Max Guests
  sheet.setColumnWidth(5, 120);  // RSVP Submitted
  sheet.setColumnWidth(6, 160);  // RSVP Timestamp

  Logger.log('Invites sheet created successfully.');
}

// ─────────────────────────────────────────────────────────────
//  SETUP GUIDE
//
//  1. In the Apps Script editor, paste this file and save (Ctrl+S)
//  2. Run setupInvitesSheet() once (Run menu → Run function)
//     — this creates the "Invites" tab in your spreadsheet
//  3. Deploy → Manage deployments → edit pencil
//       Change version to "New version", click Deploy
//     The URL stays the same.
//
//  ADDING GUESTS TO YOUR INVITE LIST:
//  Open the "Invites" tab and add one row per invite group:
//    Invite ID   │ Emails                          │ Guest Names          │ Max Guests
//    INV001      │ john@example.com                │ John Smith           │ 1
//    INV002      │ jane@example.com, bob@ex.com    │ Jane & Bob Williams  │ 2
//    INV003      │ family@example.com              │ The Kowalski Family  │ 4
//
//  Leave "RSVP Submitted" and "RSVP Timestamp" blank — they fill automatically.
//
//  NOTE: The website lookup uses a GET request. If guests report the email
//  check not working, make sure the deployment is set to
//  "Execute as: Me" and "Who has access: Anyone".
// ─────────────────────────────────────────────────────────────

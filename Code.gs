// ─────────────────────────────────────────────────────────────
//  Tom & Liisbet Wedding — RSVP Google Apps Script
//  Paste this entire file into the Apps Script editor.
//  Deploy as a Web App (see setup steps below).
// ─────────────────────────────────────────────────────────────

var SHEET_NAME         = 'RSVPs';
var INVITES_SHEET_NAME = 'Invites';
var HOME_SHEET_NAME    = 'Home';

// RSVPs sheet headers — Invite ID and Submission Type appended at the end
// so existing rows remain valid if you had RSVPs before this update.
var HEADERS = [
  'Timestamp',
  'First Name',
  'Last Name',
  'Email',
  'Attendance',      // E (index 4)
  'Guests',          // F (index 5)
  'Dietary',
  'Accommodation',   // H (index 7)
  'Tuljak Interest',
  'Song Request',
  'Message',
  'Invite ID',       // L (index 11)
  'Submission Type', // M (index 12) — "New" or "Update"
  'Plus One Name',   // N (index 13)
  'Attending Names'  // O (index 14) — listed when fewer guests attend than invited
];

// Invites sheet headers
var INVITE_HEADERS = [
  'Invite ID',        // A — unique key, e.g. INV001
  'Emails',           // B — comma-separated emails, e.g. "a@b.com, c@d.com"
  'Guest Names',      // C — display name shown on site, e.g. "John & Jane Smith"
  'Max Guests',       // D — max guests allowed for this invite
  'RSVP Submitted',   // E — auto-filled: blank → "yes"
  'RSVP Timestamp',   // F — auto-filled date/time
  'Plus One'          // G — "yes" if this individual invitee is allowed to bring a +1
];

// ── Utility ──
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Read a named parameter from the Home sheet (column A = key, column B = value) ──
function getParameter(key) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOME_SHEET_NAME);
    if (!sheet) return null;
    var data = sheet.getDataRange().getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === key.trim().toLowerCase()) {
        return data[i][1];
      }
    }
  } catch (err) { /* fall through */ }
  return null;
}

// ─────────────────────────────────────────────────────────────
//  GET — dispatcher
//  ?action=lookup&email=...   → email invite lookup
//  ?action=cabin-count        → cabin spots remaining
// ─────────────────────────────────────────────────────────────
function doGet(e) {
  var action = (e.parameter && e.parameter.action) || 'lookup';

  if (action === 'cabin-count') {
    return getCabinCount();
  }

  // Default: email lookup
  var email = ((e.parameter && e.parameter.email) || '').toLowerCase().trim();
  return lookupEmail(email);
}

// ── GET: cabin availability — reads total from Home sheet ──
function getCabinCount() {
  try {
    // Read the editable parameter from the Home sheet
    var param = getParameter('Cabin Total Spots');
    var total = (param !== null && !isNaN(parseInt(param))) ? parseInt(param) : 40;

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ available: total, total: total, booked: 0 });
    }

    var data        = sheet.getDataRange().getValues();
    var cabinGuests = 0;

    for (var i = 1; i < data.length; i++) {
      // Col index 4 = Attendance, 5 = Guests, 7 = Accommodation
      if (String(data[i][4]).toLowerCase() === 'yes' &&
          String(data[i][7]).toLowerCase() === 'cabin') {
        cabinGuests += parseInt(data[i][5]) || 1;
      }
    }

    return jsonResponse({
      available: Math.max(0, total - cabinGuests),
      total:     total,
      booked:    cabinGuests
    });
  } catch (err) {
    return jsonResponse({ available: 40, total: 40, booked: 0, error: err.message });
  }
}

// ── GET: email invite lookup ──
function lookupEmail(email) {
  try {
    if (!email) {
      return jsonResponse({ found: false, error: 'No email provided' });
    }

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(INVITES_SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ found: false, error: 'Invites sheet not found — run setup() first' });
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
          maxGuests:     parseInt(row[3]) || 1,
          alreadyRsvped: String(row[4]).toLowerCase() === 'yes',
          plusOne:       String(row[6]).toLowerCase() === 'yes'
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
      // Invite ID lives at index 11 (column L)
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
      isUpdate ? 'Update' : 'New',
      p.plus_one_name    || '',
      p.attending_names  || ''
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
//  RUN ONCE: combined setup — creates Home + Invites sheets
//  In the Apps Script editor: Run → Run function → setup
// ─────────────────────────────────────────────────────────────
function setup() {
  setupHomeSheet();
  setupInvitesSheet();
  setupRsvpSheet();
  Logger.log('Setup complete.');
}

function setupHomeSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HOME_SHEET_NAME);

  if (sheet) {
    Logger.log('Home sheet already exists — nothing to do.');
    return;
  }

  sheet = ss.insertSheet(HOME_SHEET_NAME, 0); // Insert as first tab
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 140);

  // ── Title ──
  sheet.getRange('A1').setValue('Tom & Liisbet Wedding — Dashboard');
  sheet.getRange('A1').setFontSize(13).setFontWeight('bold');
  sheet.getRange('A1:B1').merge();

  // ── Settings section ──
  sheet.getRange('A3').setValue('Settings').setFontWeight('bold').setFontColor('#527a5e');
  sheet.getRange('A4').setValue('Cabin Total Spots');
  sheet.getRange('B4').setValue(40).setFontWeight('bold');

  // ── Guest stats ──
  sheet.getRange('A6').setValue('Guest Stats').setFontWeight('bold').setFontColor('#527a5e');
  sheet.getRange('A7').setValue('Total Invites');
  sheet.getRange('B7').setFormula('=COUNTA(Invites!A2:A)');
  sheet.getRange('A8').setValue('RSVPs Received');
  sheet.getRange('B8').setFormula('=COUNTIF(Invites!E2:E,"yes")');
  sheet.getRange('A9').setValue('Not Yet RSVPed');
  sheet.getRange('B9').setFormula('=B7-B8');

  // ── RSVP breakdown ──
  sheet.getRange('A11').setValue('RSVP Breakdown').setFontWeight('bold').setFontColor('#527a5e');
  sheet.getRange('A12').setValue('Attending');
  sheet.getRange('B12').setFormula('=COUNTIF(RSVPs!E2:E,"yes")');
  sheet.getRange('A13').setValue('Declining');
  sheet.getRange('B13').setFormula('=COUNTIF(RSVPs!E2:E,"no")');
  sheet.getRange('A14').setValue('Total Guest Count (attending)');
  sheet.getRange('B14').setFormula('=SUMIF(RSVPs!E2:E,"yes",RSVPs!F2:F)');

  // ── Accommodation breakdown ──
  sheet.getRange('A16').setValue('Accommodation').setFontWeight('bold').setFontColor('#527a5e');
  sheet.getRange('A17').setValue('Cabin Bookings (guests)');
  sheet.getRange('B17').setFormula('=SUMIFS(RSVPs!F2:F,RSVPs!E2:E,"yes",RSVPs!H2:H,"cabin")');
  sheet.getRange('A18').setValue('Cabin Spots Available');
  sheet.getRange('B18').setFormula('=B4-B17');
  sheet.getRange('A19').setValue('Camping (RSVPs)');
  sheet.getRange('B19').setFormula('=COUNTIFS(RSVPs!E2:E,"yes",RSVPs!H2:H,"camping")');
  sheet.getRange('A20').setValue('Hotel / Nearby (RSVPs)');
  sheet.getRange('B20').setFormula('=COUNTIFS(RSVPs!E2:E,"yes",RSVPs!H2:H,"hotel")');

  // Light row shading for readability
  sheet.getRange('A4:B4').setBackground('#f0f5f1');
  sheet.getRange('A7:B9').setBackground('#f9fbf9');
  sheet.getRange('A12:B14').setBackground('#f9fbf9');
  sheet.getRange('A17:B20').setBackground('#f9fbf9');

  Logger.log('Home sheet created successfully.');
}

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
  sheet.setColumnWidth(7, 80);   // Plus One

  Logger.log('Invites sheet created successfully.');
}

function setupRsvpSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (sheet) {
    Logger.log('RSVPs sheet already exists — nothing to do.');
    return;
  }

  sheet = ss.insertSheet(SHEET_NAME);
  sheet.appendRow(HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#e8f0ed');

  sheet.setColumnWidth(1,  160);  // Timestamp
  sheet.setColumnWidth(2,  100);  // First Name
  sheet.setColumnWidth(3,  100);  // Last Name
  sheet.setColumnWidth(4,  200);  // Email
  sheet.setColumnWidth(5,  90);   // Attendance
  sheet.setColumnWidth(6,  60);   // Guests
  sheet.setColumnWidth(7,  200);  // Dietary
  sheet.setColumnWidth(8,  110);  // Accommodation
  sheet.setColumnWidth(9,  120);  // Tuljak Interest
  sheet.setColumnWidth(10, 160);  // Song Request
  sheet.setColumnWidth(11, 200);  // Message
  sheet.setColumnWidth(12, 70);   // Invite ID
  sheet.setColumnWidth(13, 100);  // Submission Type
  sheet.setColumnWidth(14, 130);  // Plus One Name
  sheet.setColumnWidth(15, 200);  // Attending Names

  Logger.log('RSVPs sheet created successfully.');
}

// ─────────────────────────────────────────────────────────────
//  SETUP GUIDE
//
//  1. Paste this file into the Apps Script editor and save (Ctrl+S)
//  2. Run setup() once: Run menu → Run function → setup
//     This creates the "Home" and "Invites" tabs automatically.
//  3. Deploy → Manage deployments → edit pencil
//       Change version to "New version", click Deploy
//     The URL stays the same.
//
//  HOME SHEET — your live wedding dashboard:
//    • Change "Cabin Total Spots" (cell B4) to adjust cabin capacity.
//      The website tracker and RSVP form update automatically.
//    • All other stats update live as guests submit RSVPs.
//
//  INVITES SHEET — add one row per invite group:
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

// ─────────────────────────────────────────────────────────────
//  Tom & Liisbet Wedding — RSVP Google Apps Script
//  Paste this entire file into the Apps Script editor.
//  Deploy as a Web App (see README steps below).
// ─────────────────────────────────────────────────────────────

var SHEET_NAME = 'RSVPs';

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
  'Message'
];

function doPost(e) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    // Create the sheet and header row on first run
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      // Make header row bold
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    }

    var p = e.parameter;

    sheet.appendRow([
      new Date(),
      p.first_name       || '',
      p.last_name        || '',
      p.email            || '',
      p.attendance       || '',
      p.guests           || '',
      p.dietary          || '',
      p.accommodation    || '',
      p.tuljak_interest  || '',
      p.song_request     || '',
      p.message          || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─────────────────────────────────────────────────────────────
//  HOW TO DEPLOY
//
//  1. Open your Google Sheet (or create a new one at sheets.google.com)
//  2. Click Extensions → Apps Script
//  3. Delete any existing code, paste in this entire file, save (Ctrl+S)
//  4. Click Deploy → New deployment
//       Type:             Web app
//       Execute as:       Me (your Google account)
//       Who has access:   Anyone
//  5. Click Deploy — authorise when prompted
//  6. Copy the Web App URL — looks like:
//       https://script.google.com/macros/s/AKfycb.../exec
//  7. In index.html, find this line:
//       action="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
//     Replace YOUR_SCRIPT_ID with the ID from your URL (the long string between /s/ and /exec)
//
//  REDEPLOYING AFTER CHANGES:
//  If you ever edit this script, go to Deploy → Manage deployments,
//  click the pencil icon, change version to "New version", then Deploy.
//  The URL stays the same.
// ─────────────────────────────────────────────────────────────

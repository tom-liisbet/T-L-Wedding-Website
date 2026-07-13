/**
 * ── Tom & Liisbet — Invite Mail Merge ──────────────────────────────────────
 *
 * Sends the wedding invite email to every guest in the RSVP Google Sheet,
 * personalized with their names ("Dear Anna and Mart,").
 *
 * HOW TO USE (see apps-script/README.md for the full walkthrough):
 *   1. Run previewRecipients()  — logs who would get an email. Sends nothing.
 *   2. Run sendTestInvite()     — sends ONE fully-rendered invite to yourselves.
 *   3. Run sendInvites()        — the real thing.
 *
 * Rows are skipped when the email cell is empty or "Invite Sent" already has
 * a timestamp, so the script is safe to re-run — a second run only picks up
 * rows that failed or were added later.
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
var CONFIG = {
  // Tab with the guest list. Leave '' to use the FIRST tab in the spreadsheet.
  TAB_NAME: '',

  // Header names, matched case-insensitively (spaces/underscores ignored).
  // If the script can't find them it lists the headers it DID see in the log.
  EMAIL_HEADER: 'email',
  NAMES_HEADER: 'guestNames',

  // Column used to track progress. Created automatically if missing.
  SENT_HEADER: 'Invite Sent',

  SUBJECT: "You're Invited! Tom & Liisbet — September 5th, 2026",
  FROM_NAME: 'Tom & Liisbet',
  REPLY_TO: 'tomandliisbet@gmail.com',

  // Where sendTestInvite() delivers the sample email.
  TEST_RECIPIENT: 'tomandliisbet@gmail.com',

  SITE_URL: 'https://tom-liisbet.github.io/T-L-Wedding-Website',
  INVITE_IMAGE_URL: 'https://tom-liisbet.github.io/T-L-Wedding-Website/Images/Photos/Invite/Invite-email.jpg'
};

// ── 1. DRY RUN ──────────────────────────────────────────────────────────────
function previewRecipients() {
  var rows = getEligibleRows_();
  Logger.log('%s invite(s) would be sent:', rows.length);
  rows.forEach(function (r) {
    Logger.log('  row %s  %s  ->  "%s"', r.rowNumber, r.email, greeting_(r.names));
  });
  Logger.log('Remaining Gmail quota today: %s', MailApp.getRemainingDailyQuota());
}

// ── 2. TEST EMAIL (to yourselves) ───────────────────────────────────────────
function sendTestInvite() {
  var rows = getEligibleRows_();
  if (!rows.length) throw new Error('No eligible rows found — nothing to test with.');
  var sample = rows[0];
  GmailApp.sendEmail(CONFIG.TEST_RECIPIENT, '[TEST] ' + CONFIG.SUBJECT, plainBody_(sample.names), {
    htmlBody: htmlBody_(sample.names),
    name: CONFIG.FROM_NAME,
    replyTo: CONFIG.REPLY_TO
  });
  Logger.log('Test invite sent to %s using row %s (%s). Check phone + desktop, and that it lands in Primary.',
    CONFIG.TEST_RECIPIENT, sample.rowNumber, sample.email);
}

// ── 3. THE REAL SEND ────────────────────────────────────────────────────────
function sendInvites() {
  var sheet = getSheet_();
  var rows  = getEligibleRows_();
  if (!rows.length) { Logger.log('Nothing to send — every row is either sent or has no email.'); return; }

  var quota = MailApp.getRemainingDailyQuota();
  if (quota < rows.length) {
    throw new Error('Only ' + quota + ' emails left in today\'s Gmail quota but ' + rows.length +
      ' invites to send. Run again tomorrow — already-sent rows are skipped automatically.');
  }

  var sentCol = ensureSentColumn_(sheet);
  var sent = 0, failed = 0;

  rows.forEach(function (r) {
    try {
      GmailApp.sendEmail(r.email, CONFIG.SUBJECT, plainBody_(r.names), {
        htmlBody: htmlBody_(r.names),
        name: CONFIG.FROM_NAME,
        replyTo: CONFIG.REPLY_TO
      });
      sheet.getRange(r.rowNumber, sentCol).setValue(new Date());
      sent++;
    } catch (e) {
      failed++;
      Logger.log('FAILED row %s (%s): %s', r.rowNumber, r.email, e.message);
    }
  });

  Logger.log('Done. Sent: %s   Failed: %s (failed rows keep an empty "%s" cell — fix and re-run).',
    sent, failed, CONFIG.SENT_HEADER);
}

// ── EMAIL CONTENT ───────────────────────────────────────────────────────────
function greeting_(namesCell) {
  var names = String(namesCell || '').split(/,|&| and /i)
    .map(function (n) { return n.trim(); })
    .filter(Boolean);
  if (!names.length) return 'Dear friend,';
  if (names.length === 1) return 'Dear ' + names[0] + ',';
  if (names.length === 2) return 'Dear ' + names[0] + ' and ' + names[1] + ',';
  return 'Dear ' + names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1] + ',';
}

function htmlBody_(namesCell) {
  var rsvpUrl = CONFIG.SITE_URL + '/rsvp.html';
  return '' +
  '<div style="margin:0;padding:0;background-color:#1a2120;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a2120;">' +
      '<tr><td align="center" style="padding:32px 16px;">' +
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">' +

          // Greeting
          '<tr><td align="center" style="padding:0 24px 24px;font-family:Georgia,\'Times New Roman\',serif;' +
            'font-size:22px;font-style:italic;color:#e0cc92;">' + escapeHtml_(greeting_(namesCell)) + '</td></tr>' +

          // The invite
          '<tr><td align="center">' +
            '<a href="' + CONFIG.SITE_URL + '" style="text-decoration:none;">' +
              '<img src="' + CONFIG.INVITE_IMAGE_URL + '" width="600" ' +
                'style="width:100%;max-width:600px;height:auto;display:block;border:0;" ' +
                'alt="You are invited to the wedding of Tom & Liisbet — September 5th, 2026 at J&otilde;ek&auml;&auml;ru, ' +
                '38 Viru Ave, Udora ON. Please arrive by 4:45pm; dinner and dancing to follow. RSVP by August 7th."/>' +
            '</a>' +
          '</td></tr>' +

          // RSVP button
          '<tr><td align="center" style="padding:36px 24px 10px;">' +
            '<a href="' + rsvpUrl + '" style="display:inline-block;padding:16px 48px;background-color:#c9ab6e;' +
              'color:#1a2120;font-family:Georgia,serif;font-size:15px;letter-spacing:3px;text-transform:uppercase;' +
              'text-decoration:none;border-radius:2px;">RSVP</a>' +
          '</td></tr>' +

          // Fine print
          '<tr><td align="center" style="padding:10px 24px 6px;font-family:Georgia,serif;font-size:14px;color:#ede9e0;">' +
            'Kindly reply by August 7th, 2026' +
          '</td></tr>' +
          '<tr><td align="center" style="padding:6px 24px 36px;font-family:Georgia,serif;font-size:13px;line-height:1.7;color:#9aa89e;">' +
            'Schedule, directions, and accommodation info are all on our website:<br/>' +
            '<a href="' + CONFIG.SITE_URL + '" style="color:#82b090;text-decoration:underline;">' +
              CONFIG.SITE_URL.replace('https://', '') + '</a><br/><br/>' +
            'Questions? Just reply to this email.' +
          '</td></tr>' +

        '</table>' +
      '</td></tr>' +
    '</table>' +
  '</div>';
}

function plainBody_(namesCell) {
  return greeting_(namesCell) + '\n\n' +
    'You are invited to the wedding of Tom & Liisbet!\n\n' +
    'Saturday, September 5th, 2026\n' +
    'Jõekääru — 38 Viru Ave, Udora, ON\n' +
    'Please arrive by 4:45pm. Dinner and dancing to follow.\n\n' +
    'Please RSVP by August 7th, 2026:\n' +
    CONFIG.SITE_URL + '/rsvp.html\n\n' +
    'Schedule, directions, and accommodation info: ' + CONFIG.SITE_URL + '\n\n' +
    'Questions? Just reply to this email.\n\n' +
    'With love,\nTom & Liisbet';
}

// ── SHEET PLUMBING ──────────────────────────────────────────────────────────
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = CONFIG.TAB_NAME ? ss.getSheetByName(CONFIG.TAB_NAME) : ss.getSheets()[0];
  if (!sheet) throw new Error('Tab "' + CONFIG.TAB_NAME + '" not found. Tabs: ' +
    ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
  return sheet;
}

function normalize_(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

function findColumn_(headers, wanted) {
  var target = normalize_(wanted);
  for (var i = 0; i < headers.length; i++) {
    if (normalize_(headers[i]) === target) return i + 1; // 1-based
  }
  return -1;
}

function getEligibleRows_() {
  var sheet   = getSheet_();
  var data    = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];

  var emailCol = findColumn_(headers, CONFIG.EMAIL_HEADER);
  var namesCol = findColumn_(headers, CONFIG.NAMES_HEADER);
  var sentCol  = findColumn_(headers, CONFIG.SENT_HEADER); // may be -1 before first send

  if (emailCol === -1 || namesCol === -1) {
    throw new Error('Could not find header "' + (emailCol === -1 ? CONFIG.EMAIL_HEADER : CONFIG.NAMES_HEADER) +
      '". Headers found: ' + headers.join(' | ') + '  — adjust CONFIG at the top of the script.');
  }

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var email = String(data[i][emailCol - 1] || '').trim();
    var sent  = sentCol === -1 ? '' : data[i][sentCol - 1];
    if (!email || !/@/.test(email)) continue;   // no usable email
    if (sent) continue;                          // already sent
    rows.push({ rowNumber: i + 1, email: email, names: data[i][namesCol - 1] });
  }
  return rows;
}

function ensureSentColumn_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = findColumn_(headers, CONFIG.SENT_HEADER);
  if (col !== -1) return col;
  col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue(CONFIG.SENT_HEADER);
  return col;
}

function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

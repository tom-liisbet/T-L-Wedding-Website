# Sending the invite emails

`send-invites.gs` mass-sends the invite (the designed image in `Images/Photos/Invite/`)
to everyone in the RSVP Google Sheet, personalized as "Dear Anna and Mart," from the
names cell next to each email address.

## One-time setup

1. **Push the invite image first.** The email loads the invite from the live website, so
   commit & sync the repo (it needs `Images/Photos/Invite/Invite-email.jpg` on GitHub Pages).
   Verify it loads: https://tom-liisbet.github.io/T-L-Wedding-Website/Images/Photos/Invite/Invite-email.jpg
2. Log into Google as **tomandliisbet@gmail.com** and open the RSVP guest-list spreadsheet.
3. **Extensions → Apps Script**, click **+** next to Files → Script, name it `send-invites`,
   paste the entire contents of `send-invites.gs`, and save.
4. Check the `CONFIG` block at the top:
   - `TAB_NAME` — leave `''` if the guest list is the first tab, otherwise put the tab's name.
   - `EMAIL_HEADER` / `NAMES_HEADER` — must match your column headers (capitalization and
     spaces don't matter). If they're wrong, the script tells you which headers it found.

## Sending (in this order!)

| Step | Run | What happens |
|------|-----|--------------|
| 1 | `previewRecipients` | Nothing is sent. The log (View → Logs / Executions) lists every recipient and their greeting. Check the count and a few greetings. |
| 2 | `sendTestInvite` | One complete invite goes to **tomandliisbet@gmail.com only**. Open it on a phone and a computer. Check it's in Primary, not Spam/Promotions. |
| 3 | `sendInvites` | The real send. Each success is timestamped in the **Invite Sent** column (created automatically). |

The first run will ask for authorization — approve it (it's your own script sending from
your own account).

## Good to know

- **Safe to re-run.** Rows with an `Invite Sent` timestamp are skipped, so running
  `sendInvites` twice never double-sends. Failed rows stay blank — fix the address and re-run.
- **Late additions:** add a new row with email + names, run `sendInvites` again; only the
  new row goes out.
- **Quota:** free Gmail allows ~100 recipients/day from Apps Script. The script checks
  before sending and refuses to start a batch it can't finish; if that happens, just run
  it again the next day.
- **Replies** go straight to tomandliisbet@gmail.com.

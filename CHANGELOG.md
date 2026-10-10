# Changelog

One entry per merged PR, newest first. Plain English, written so it can be
passed on to the club. Versions are the short git commit shown in the site footer.

## 2026-10-10
- **Safer releases** (PR #10): changes now go to a staging site first and
  reach the real site automatically when approved, with automatic database
  backups, upgrades and rollback. The site footer shows which version is live.
- **Referees' bank details are encrypted** (PR #9): stored encrypted and only
  ever shown partly hidden (e.g. ••••5678); full details are used only to make
  the bank payment file.
- **Draw requests** (PR #8): fix a particular match to a week, or choose which
  week a team has its bye; the draw re-arranges whole rounds around them.

## 2026-10-09
- **Team calendars** (PR #7): save your teams and add their games (and bye
  weeks) to your phone's calendar; it updates itself if the draw changes.
  "All my fixtures" shows every saved team in one list.
- **Shirt numbers, byes, grand finals** (PR #6): shirt number boxes in each
  team list; each round shows who has the bye; the grand final is created
  automatically once both semi-finals are decided; registration status is read
  correctly from the PlayFootball export.
- **Draw options and team admin** (PR #5): choose how many times teams play
  each other, an end date, or "keep playing until"; split a competition into
  divisions part-way; move a team to another division, rename teams, delete
  teams properly; coaches can coach several teams; unpaid or awaiting-approval
  registrations are flagged.

## 2026-10-07
- **Draft draws, breaks and holidays** (PR #4): new draws stay hidden until
  you publish them; add holidays and breaks and the draw skips them; the admin
  menu stays in place and highlights where you are.
- **Authorise all / Reject all** (PR #3) for ineligible nominated players.
- **Users, permissions and audit log** (PR #2): administrator accounts with
  permissions, a full activity log, and approving players outside their age
  group with a recorded reason.
- **Moved to EmuTel hosting** (PR #1).

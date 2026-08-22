# Changelog

All notable changes to the Theos Gospel Hall app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.5.0] - 2026-08-22

### Added
- **Expanded Bible versions**: six new public-domain English translations — World English Bible, American Standard Version, Young's Literal Translation, Berean Standard Bible, Douay-Rheims, and the Geneva Bible (1599) — join the existing Tamil OV, Tamil ERV, NIV, ERV, and KJV, selectable from the same English/Tamil version pickers. New versions are fetched a chapter at a time and cached on the device, so a chapter loads instantly on every visit after the first and refreshes quietly in the background instead of showing a loading screen.
- **Bible Text-to-Speech**: listen to a chapter read aloud with Play/Pause/Resume/Stop controls. The app automatically speaks in English or Tamil to match the selected version, favors the best-quality voice installed on the device, highlights the verse currently being read, and — unless manually stopped — keeps reading automatically into the next chapter and book, all the way through to the end of Revelation.
- **In-app Notification Center**: a bell icon with an unread badge on the Home screen opens a history of past notifications grouped by Today/Yesterday/Earlier, with icons by category (Bible Study, Prayer, Youth, Special Meeting, App Update) and per-device read tracking.
- **Home screen theme picker**: a Settings icon on Home opens a Light/Dark/Sepia picker, matching the theme control already available elsewhere in the app.

### Changed
- **Bible reader**: the selected or currently-read verse now uses a softer highlighted-card style instead of a solid color block, and the verse list reserves enough space at the bottom so the last verse is never hidden behind the navigation bar.
- **Bible version-selection screen**: the chapter-number grid keeps every box the same size, even on a partial last row (e.g. chapters 26–27 of a 27-chapter book), instead of stretching them to fill the row.

### Fixed
- **Live video playback**: watching a currently-live stream no longer incorrectly marked it as "already finished" the next time it was opened.
- **Bible Reader**: fixed a brief white flash when returning from the Bible Reader to the Bible tab in the Dark or Sepia theme, caused by the native screen background not following the in-app theme.
- **Contact screen**: returning from the Admin Panel, or cancelling out of the admin login, now scrolls back to where the version footer is visible instead of leaving the page scrolled mid-way.

## [1.4.0] - 2026-07-31

### Added
- **Manage Registrations**: a new admin screen (Admin Panel → Discipleship & Academy Registrations → Manage Registrations) for independently controlling the Youth Program and Academy registrations. For each, administrators can set the registration to Open or Closed, define a custom "Closed Message (Shown to Users)" — mandatory while Closed, disabled while Open — and show or hide the program's card on the Home screen, with a confirmation warning before hiding. Changes are staged locally and only take effect after Save. When a registration is Closed, its Home screen button is grayed out and shows the configured message instead of opening the registration form; when hidden, the program's card is removed from the Home screen entirely.
- **Site Maintenance for Videos**: a new admin screen (Admin Panel → App Management → Site Maintenance → Videos) to put the Videos section into maintenance mode for all users, with a confirmation warning before enabling and changes only taking effect after Save. While enabled, the Videos tab stays visible but shows a themed "Videos are currently under maintenance" page in place of its normal content.

### Changed
- **Admin Panel reorganized**: "View Registrations" is renamed "Discipleship & Academy Registrations" and now opens a chooser between View Registrations (unchanged) and the new Manage Registrations. "App Management" moved to the last position on the main Admin Panel and now appears as a single warning-styled card noting that changes inside take effect immediately, opening into a dedicated screen listing App Update Settings, Send Notifications, Live Playlists, API Keys, and the new Site Maintenance.

## [1.3.0] - 2026-07-29

### Added
- **App Update Settings** admin module (grouped under a new "App Management" section) to configure the Latest Version, Minimum Required Version, update message, and Play Store URL used to gate in-app updates. Version fields are validated to a strict `x.y.z` format with inline error hints and a hard block on save, and the screen shows an audit trail of who last saved the settings.
- **In-app update prompts**: devices below the configured Minimum Required Version see a non-dismissable "Update Required" popup; devices below the Latest Version (but at or above the minimum) see a dismissible "Update Available" popup with Update Now / Skip. Both now appear as a themed modal over the running app — the Home screen stays visible underneath — instead of replacing the whole app with a full-screen page.
- **Notify Users About Update**: a one-tap tool in the App Update Settings screen to broadcast an editable push notification to all app users announcing a new version.

### Changed
- **Admin Panel reorganized**: modules are now grouped, with a new "App Management" section — App Update Settings, Send Notifications, Live Playlists, API Keys, in that order — always shown last. The main module list is reordered to Songs, View Registrations, Upcoming Special Meetings (renamed from "Special Meetings"), Pastor & Ministry Content. "Notifications" is renamed "Send Notifications" throughout.
- **Review Your Registration**: the mobile number is now shown in `+<country code>-<number>` format (e.g. `+91-7501234567`) instead of run-together digits.
- Registration success screen copy now reads "We'll get in touch with you soon."

## [1.2.0] - 2026-07-29

### Added
- **In-app registration** for the TGH Special Youth Discipleship Program and TGH Academy, replacing the previous WhatsApp-redirect Register buttons. The form collects Name, Date of Birth, Gender, mobile number, Place, and optional Church Details, is fully themed to the app's light/dark/sepia modes, and ends with a themed confirmation screen before returning to Home. TGH Academy registrations require an Indian (+91) mobile number with a locked country code; the Youth Discipleship Program continues to accept international numbers. Duplicate registrations are blocked per program at the Firestore rules level.
- **View Registrations** admin module for both programs, with Registered / Accepted / Deleted status tabs, search, a detailed per-registration view, status changes, soft-delete/restore, permanent delete, and a full audit trail (which admin last modified a registration, and when). The detail view also shows a consistently formatted mobile number and a one-tap call button.
- **Export registrations to Excel and PDF** from the Registered, Accepted, and Deleted tabs, with a scope picker (All / Registered / Accepted / Deleted) showing live record counts. Exporting "All" produces a multi-section report — separate sheets/pages per status — with frozen header rows, borders, auto-sized columns, and repeating table headers in PDF. All exported and displayed dates/times use IST regardless of device timezone. Files are named `{Program}_{Status}_{date}_{time}` and shared via the device's native share sheet.

### Changed
- Home screen: both program Register buttons now read "Register Now" with a matching icon, and show at-a-glance "🌐 Online Program" / "📍 Offline Classes – Tirupur" badges so users know the program mode before registering.
- Home screen: corrected the Youth Discipleship Program's meeting platform from Google Meet to Zoom, and fixed the "Tiruppur" → "Tirupur" spelling throughout.
- Admin Dashboard: the module list now scrolls instead of clipping off-screen as new modules are added.

## [1.1.0] - 2026-07-26

### Added
- **Playlists** section on the Videos screen (alongside Shorts, Videos, Songs, Live, All) that lists every YouTube playlist and podcast on the channel as a browsable grid, with thumbnail, title, and video count shown next to the name (e.g. "Bible Study (15)"). Opening a playlist shows the same count in its header.
- Selecting a playlist opens its videos using the same list layout, player, and playback experience (resume playback, fullscreen, share, open in YouTube) already used throughout the Videos screen, so the browsing experience stays fully consistent with the rest of the app. Videos for a playlist are cached for the app session, so reopening the same playlist is instant.
- **Notifications** module in the Admin Panel that lets administrators broadcast a push notification to all app users. Includes mandatory message validation, a confirmation step before sending, and clear success, partial-failure, and error feedback.
- **Screen Lock** for the video player and Songs player: a lock button disables all touch/swipe controls until unlocked, with a clear "Locked" indicator on screen. Unlocking requires a double-tap to prevent accidental unlocks. Songs continue to auto-advance to the next track while locked — only manual interaction is blocked. Not available on Shorts.
- **Contact screen:** long-press (or tap the new copy icon) on a branch address to copy just that address plus its Google Maps link to the clipboard. A copy icon next to "Our Branches" copies all branch addresses at once, grouped by city.
- **Favorites:** a heart icon on every song row (both Geethangalum Keerthanaigalum and Special Songs) lets users mark or unmark favorites directly from the list — including un-favoriting from the Favorites tab itself — with a toast confirming "Added to Favorites." / "Removed from Favorites."
- **Reliability:** YouTube data now falls back across multiple API keys when a quota limit is hit, with separate tracking for search vs. normal requests so a search-quota limit doesn't block browsing. If every key is exhausted, users see a friendly "Sorry, we're experiencing a technical issue. Please try again later." screen instead of a broken/blank one.
- **Accessibility:** text throughout the app now scales more gracefully on devices where the user has increased the system font size, preventing headings and labels from overlapping, truncating, or breaking mid-word.

### Fixed
- **Live tab:** upcoming/scheduled live streams were shown with a red "LIVE" badge and the video's original publish date, misleading users into thinking the stream was already airing. Scheduled streams now show a distinct "SCHEDULED" badge along with their actual scheduled start date and time; currently-live and already-aired streams are unaffected.
- **Admin panel:** adding or deleting a Live playlist didn't appear in the app until the user manually pulled to refresh.
- **Videos screen:** pressing the hardware Back button while inside a playlist exited the app instead of returning to the Playlists grid.
- **Songs screens:** tapping a song while the search keyboard was open required two taps (the first only dismissed the keyboard) and the keyboard lingered visibly afterward. Tapping a song now opens it immediately on the first tap, the keyboard hides right away, and the search field clears automatically. Applies to both Songs tabs.
- **Large system font sizes:** several headings and labels (Home screen banners, Contact branch names, Songs tab toggle, bottom tab bar) could wrap mid-word, overlap, or get cut off with "..." on devices with larger accessibility font settings; these now shrink-to-fit or truncate gracefully instead.

## [1.0.0] - 2026-06-04

Initial consolidated release, covering all features shipped prior to this changelog being introduced.

### Added
- **Home**: church overview, About the Pastor & Founder, upcoming events, and ministry information, backed by admin-managed content.
- **Bible**: reader supporting 5 versions (Tamil OV, Tamil ERV, English NIV, English ERV, English KJV) with a bilingual (Tamil + English) reading mode, book/chapter navigation, and adjustable reading settings.
- **Videos**: YouTube-integrated Shorts, Videos, Songs, Live, and All feeds with in-app search, and a shared video/short/song player supporting resume playback, fullscreen, sharing, and "open in YouTube".
- **Live streaming**: automatic detection of currently-live broadcasts with a "We're Live Now" popup on app launch that jumps straight into playback.
- **Songs**: Geethangalum Keerthanaigalum hymnal and a separate Other Songs library, each with a dedicated reader.
- **Contact**: church contact details and ministry information.
- **Admin panel**: content management for Home content, Live playlists, Songs (Geethangalum & Other Songs), and Special Meetings.
- **Push notifications** for live streams and announcements, with per-device registration.
- **Light/Dark theme** support across the app.
- **First-launch setup experience** that prepares Bible and Songs data before first use.
- Android release build optimizations (R8 minification, resource shrinking) and updated app icons.

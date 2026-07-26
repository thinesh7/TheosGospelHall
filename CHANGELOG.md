# Changelog

All notable changes to the Theos Gospel Hall app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

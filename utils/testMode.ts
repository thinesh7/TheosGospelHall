// Single switch for the Notification Center feature's manual test pass.
// While true, every notification-related Firestore collection (push tokens,
// the notification history feed, delivery logs, and special-meeting events)
// is redirected to its test_ equivalent, so nothing during testing reaches
// production devices or production data.
//
// Flip this back to false once testing is confirmed working, and before any
// build a real user will install.
export const NOTIFICATION_TEST_MODE = false;

export const COLLECTIONS = {
  notifications: NOTIFICATION_TEST_MODE ? 'test_notifications' : 'notifications',
  pushTokens: NOTIFICATION_TEST_MODE ? 'test_pushTokens' : 'pushTokens',
  notificationLogs: NOTIFICATION_TEST_MODE ? 'test_notificationLogs' : 'notificationLogs',
  events: NOTIFICATION_TEST_MODE ? 'test_events' : 'events',
} as const;

// Native: zero-risk passthrough to the existing library — behavior for
// Android/iOS is completely unchanged. See YoutubePlayer.web.tsx for why web
// needs a real implementation instead of just resolving this same import:
// react-native-youtube-iframe's web build never actually completes its
// onReady handshake through react-native-web-webview's iframe shim (playback
// gets stuck on the app's own "Preparing your video..." loading state
// forever), so web needs the YouTube IFrame Player API directly.
export { default } from 'react-native-youtube-iframe';

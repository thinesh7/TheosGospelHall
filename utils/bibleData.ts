/** 'bundled' = shipped in the JS bundle via require() (assets/bible/*.json), no network needed.
 *  'bolls' = fetched on demand (chapter-level) from the bolls.life API and cached locally. */
export type BibleVersionSource = 'bundled' | 'bolls';

/** 'public-domain' / 'cc-by-sa-4.0' are cleared for redistribution and offline caching.
 *  'proprietary-unverified' marks pre-existing bundled content whose redistribution license
 *  was not independently confirmed as part of this work — see README/legal notes. */
export type BibleLicenseType = 'public-domain' | 'cc-by-sa-4.0' | 'proprietary-unverified';

export interface BibleLicenseInfo {
  type: BibleLicenseType;
  holder?: string;
  notes: string;
}

export interface BibleVersionMeta {
  code: string;
  name: string;
  short: string;
  lang: 'English' | 'Tamil';
  source: BibleVersionSource;
  /** Translation code to use when querying the bolls.life API, if different from `code`. */
  bollsCode?: string;
  license: BibleLicenseInfo;
  offlineCachingAllowed: boolean;
}

/**
 * Adding a new version = add one entry here (+ a bollsCode if it's on bolls.life, or
 * bundle assets/bible/{code}_{book}.json files for a 'bundled' source). No other file
 * needs to change: the version-selection UI, reader, cache, and bilingual pickers all
 * derive from this list.
 */
export const BIBLE_VERSIONS: BibleVersionMeta[] = [
  // --- Pre-existing bundled versions ---
  {
    code: 'TAMOVR', name: 'Tamil Bible (OV)', short: 'OV', lang: 'Tamil', source: 'bundled',
    license: { type: 'proprietary-unverified', notes: 'Bundled prior to this work; provenance/redistribution rights not independently confirmed. Flagged for legal follow-up.' },
    offlineCachingAllowed: true,
  },
  {
    code: 'TAMBL98', name: 'Tamil Bible (ERV)', short: 'ERV', lang: 'Tamil', source: 'bundled',
    license: { type: 'proprietary-unverified', holder: 'World Bible Translation Center / Bible League International (Easy-to-Read Version)', notes: 'Bundled prior to this work; ERV is a copyrighted translation and no redistribution license was confirmed. Flagged for legal follow-up.' },
    offlineCachingAllowed: true,
  },
  {
    code: 'NIV', name: 'English (NIV)', short: 'NIV', lang: 'English', source: 'bundled',
    license: { type: 'proprietary-unverified', holder: 'Biblica', notes: 'Bundled prior to this work. NIV is copyrighted by Biblica; commercial app redistribution normally requires a paid license (confirmed NOT available for free commercial use via API.Bible). Flagged for legal follow-up — consider replacing with a public-domain version.' },
    offlineCachingAllowed: true,
  },
  {
    code: 'ERV', name: 'English (ERV)', short: 'ERV', lang: 'English', source: 'bundled',
    license: { type: 'proprietary-unverified', holder: 'World Bible Translation Center / Bible League International', notes: 'Bundled prior to this work; ERV is a copyrighted translation and no redistribution license was confirmed. Flagged for legal follow-up.' },
    offlineCachingAllowed: true,
  },
  {
    code: 'KJV', name: 'English (KJV)', short: 'KJV', lang: 'English', source: 'bundled',
    license: { type: 'public-domain', notes: 'King James Version (1769) is public domain outside the UK (Crown copyright applies only within the UK, where free/non-commercial use is customarily permitted).' },
    offlineCachingAllowed: true,
  },

  // --- New: public-domain English versions, fetched chapter-by-chapter from bolls.life and cached ---
  {
    code: 'WEB', name: 'World English Bible', short: 'WEB', lang: 'English', source: 'bolls', bollsCode: 'WEB',
    license: { type: 'public-domain', holder: 'Rainbow Missions, Inc.', notes: 'Explicitly dedicated to the public domain; no restrictions on redistribution or caching.' },
    offlineCachingAllowed: true,
  },
  {
    code: 'ASV', name: 'American Standard Version', short: 'ASV', lang: 'English', source: 'bolls', bollsCode: 'ASV',
    license: { type: 'public-domain', notes: 'Published 1901; copyright has expired.' },
    offlineCachingAllowed: true,
  },
  {
    code: 'YLT', name: "Young's Literal Translation", short: 'YLT', lang: 'English', source: 'bolls', bollsCode: 'YLT',
    license: { type: 'public-domain', notes: 'Published 1898 by Robert Young; copyright has expired.' },
    offlineCachingAllowed: true,
  },
  {
    code: 'BSB', name: 'Berean Standard Bible', short: 'BSB', lang: 'English', source: 'bolls', bollsCode: 'BSB',
    license: { type: 'public-domain', holder: 'Bible Hub / Berean Bible', notes: 'Explicitly dedicated to the public domain on April 30, 2023; no license required for any use.' },
    offlineCachingAllowed: true,
  },
  {
    code: 'DRB', name: 'Douay-Rheims Bible', short: 'DRB', lang: 'English', source: 'bolls', bollsCode: 'DRB',
    license: { type: 'public-domain', notes: '1899 Challoner revision; copyright has expired.' },
    offlineCachingAllowed: true,
  },
  {
    code: 'GNV', name: 'Geneva Bible (1599)', short: 'GNV', lang: 'English', source: 'bolls', bollsCode: 'GNV',
    license: { type: 'public-domain', notes: 'Published 1599; copyright has expired.' },
    offlineCachingAllowed: true,
  },
];

export const BOOKS = [
  { id: 1, name: 'Genesis', tamil: 'ஆதியாகமம்', chapters: 50 },
  { id: 2, name: 'Exodus', tamil: 'யாத்திராகமம்', chapters: 40 },
  { id: 3, name: 'Leviticus', tamil: 'லேவியராகமம்', chapters: 27 },
  { id: 4, name: 'Numbers', tamil: 'எண்ணாகமம்', chapters: 36 },
  { id: 5, name: 'Deuteronomy', tamil: 'உபாகமம்', chapters: 34 },
  { id: 6, name: 'Joshua', tamil: 'யோசுவா', chapters: 24 },
  { id: 7, name: 'Judges', tamil: 'நியாயாதிபதிகள்', chapters: 21 },
  { id: 8, name: 'Ruth', tamil: 'ரூத்', chapters: 4 },
  { id: 9, name: '1 Samuel', tamil: '1 சாமுவேல்', chapters: 31 },
  { id: 10, name: '2 Samuel', tamil: '2 சாமுவேல்', chapters: 24 },
  { id: 11, name: '1 Kings', tamil: '1 இராஜாக்கள்', chapters: 22 },
  { id: 12, name: '2 Kings', tamil: '2 இராஜாக்கள்', chapters: 25 },
  { id: 13, name: '1 Chronicles', tamil: '1 நாளாகமம்', chapters: 29 },
  { id: 14, name: '2 Chronicles', tamil: '2 நாளாகமம்', chapters: 36 },
  { id: 15, name: 'Ezra', tamil: 'எஸ்றா', chapters: 10 },
  { id: 16, name: 'Nehemiah', tamil: 'நெகேமியா', chapters: 13 },
  { id: 17, name: 'Esther', tamil: 'எஸ்தர்', chapters: 10 },
  { id: 18, name: 'Job', tamil: 'யோபு', chapters: 42 },
  { id: 19, name: 'Psalms', tamil: 'சங்கீதம்', chapters: 150 },
  { id: 20, name: 'Proverbs', tamil: 'நீதிமொழிகள்', chapters: 31 },
  { id: 21, name: 'Ecclesiastes', tamil: 'பிரசங்கி', chapters: 12 },
  { id: 22, name: 'Song of Solomon', tamil: 'உன்னதப்பாட்டு', chapters: 8 },
  { id: 23, name: 'Isaiah', tamil: 'ஏசாயா', chapters: 66 },
  { id: 24, name: 'Jeremiah', tamil: 'எரேமியா', chapters: 52 },
  { id: 25, name: 'Lamentations', tamil: 'புலம்பல்', chapters: 5 },
  { id: 26, name: 'Ezekiel', tamil: 'எசேக்கியேல்', chapters: 48 },
  { id: 27, name: 'Daniel', tamil: 'தானியேல்', chapters: 12 },
  { id: 28, name: 'Hosea', tamil: 'ஓசியா', chapters: 14 },
  { id: 29, name: 'Joel', tamil: 'யோவேல்', chapters: 3 },
  { id: 30, name: 'Amos', tamil: 'ஆமோஸ்', chapters: 9 },
  { id: 31, name: 'Obadiah', tamil: 'ஒபதியா', chapters: 1 },
  { id: 32, name: 'Jonah', tamil: 'யோனா', chapters: 4 },
  { id: 33, name: 'Micah', tamil: 'மீகா', chapters: 7 },
  { id: 34, name: 'Nahum', tamil: 'நாகூம்', chapters: 3 },
  { id: 35, name: 'Habakkuk', tamil: 'ஆபகூக்', chapters: 3 },
  { id: 36, name: 'Zephaniah', tamil: 'செப்பனியா', chapters: 3 },
  { id: 37, name: 'Haggai', tamil: 'ஆகாய்', chapters: 2 },
  { id: 38, name: 'Zechariah', tamil: 'சகரியா', chapters: 14 },
  { id: 39, name: 'Malachi', tamil: 'மல்கியா', chapters: 4 },
  { id: 40, name: 'Matthew', tamil: 'மத்தேயு', chapters: 28 },
  { id: 41, name: 'Mark', tamil: 'மாற்கு', chapters: 16 },
  { id: 42, name: 'Luke', tamil: 'லூக்கா', chapters: 24 },
  { id: 43, name: 'John', tamil: 'யோவான்', chapters: 21 },
  { id: 44, name: 'Acts', tamil: 'அப்போஸ்தலர்', chapters: 28 },
  { id: 45, name: 'Romans', tamil: 'ரோமர்', chapters: 16 },
  { id: 46, name: '1 Corinthians', tamil: '1 கொரிந்தியர்', chapters: 16 },
  { id: 47, name: '2 Corinthians', tamil: '2 கொரிந்தியர்', chapters: 13 },
  { id: 48, name: 'Galatians', tamil: 'கலாத்தியர்', chapters: 6 },
  { id: 49, name: 'Ephesians', tamil: 'எபேசியர்', chapters: 6 },
  { id: 50, name: 'Philippians', tamil: 'பிலிப்பியர்', chapters: 4 },
  { id: 51, name: 'Colossians', tamil: 'கொலோசெயர்', chapters: 4 },
  { id: 52, name: '1 Thessalonians', tamil: '1 தெசலோனிக்கேயர்', chapters: 5 },
  { id: 53, name: '2 Thessalonians', tamil: '2 தெசலோனிக்கேயர்', chapters: 3 },
  { id: 54, name: '1 Timothy', tamil: '1 தீமோத்தேயு', chapters: 6 },
  { id: 55, name: '2 Timothy', tamil: '2 தீமோத்தேயு', chapters: 4 },
  { id: 56, name: 'Titus', tamil: 'தீத்து', chapters: 3 },
  { id: 57, name: 'Philemon', tamil: 'பிலேமோன்', chapters: 1 },
  { id: 58, name: 'Hebrews', tamil: 'எபிரெயர்', chapters: 13 },
  { id: 59, name: 'James', tamil: 'யாக்கோபு', chapters: 5 },
  { id: 60, name: '1 Peter', tamil: '1 பேதுரு', chapters: 5 },
  { id: 61, name: '2 Peter', tamil: '2 பேதுரு', chapters: 3 },
  { id: 62, name: '1 John', tamil: '1 யோவான்', chapters: 5 },
  { id: 63, name: '2 John', tamil: '2 யோவான்', chapters: 1 },
  { id: 64, name: '3 John', tamil: '3 யோவான்', chapters: 1 },
  { id: 65, name: 'Jude', tamil: 'யூதா', chapters: 1 },
  { id: 66, name: 'Revelation', tamil: 'வெளிப்படுத்தல்', chapters: 22 },
];

export const BIBLE_ASSETS: Record<string, Record<number, any>> = {
  TAMOVR: { 1: require('../assets/bible/TAMOVR_1.json'), 2: require('../assets/bible/TAMOVR_2.json'), 3: require('../assets/bible/TAMOVR_3.json'), 4: require('../assets/bible/TAMOVR_4.json'), 5: require('../assets/bible/TAMOVR_5.json'), 6: require('../assets/bible/TAMOVR_6.json'), 7: require('../assets/bible/TAMOVR_7.json'), 8: require('../assets/bible/TAMOVR_8.json'), 9: require('../assets/bible/TAMOVR_9.json'), 10: require('../assets/bible/TAMOVR_10.json'), 11: require('../assets/bible/TAMOVR_11.json'), 12: require('../assets/bible/TAMOVR_12.json'), 13: require('../assets/bible/TAMOVR_13.json'), 14: require('../assets/bible/TAMOVR_14.json'), 15: require('../assets/bible/TAMOVR_15.json'), 16: require('../assets/bible/TAMOVR_16.json'), 17: require('../assets/bible/TAMOVR_17.json'), 18: require('../assets/bible/TAMOVR_18.json'), 19: require('../assets/bible/TAMOVR_19.json'), 20: require('../assets/bible/TAMOVR_20.json'), 21: require('../assets/bible/TAMOVR_21.json'), 22: require('../assets/bible/TAMOVR_22.json'), 23: require('../assets/bible/TAMOVR_23.json'), 24: require('../assets/bible/TAMOVR_24.json'), 25: require('../assets/bible/TAMOVR_25.json'), 26: require('../assets/bible/TAMOVR_26.json'), 27: require('../assets/bible/TAMOVR_27.json'), 28: require('../assets/bible/TAMOVR_28.json'), 29: require('../assets/bible/TAMOVR_29.json'), 30: require('../assets/bible/TAMOVR_30.json'), 31: require('../assets/bible/TAMOVR_31.json'), 32: require('../assets/bible/TAMOVR_32.json'), 33: require('../assets/bible/TAMOVR_33.json'), 34: require('../assets/bible/TAMOVR_34.json'), 35: require('../assets/bible/TAMOVR_35.json'), 36: require('../assets/bible/TAMOVR_36.json'), 37: require('../assets/bible/TAMOVR_37.json'), 38: require('../assets/bible/TAMOVR_38.json'), 39: require('../assets/bible/TAMOVR_39.json'), 40: require('../assets/bible/TAMOVR_40.json'), 41: require('../assets/bible/TAMOVR_41.json'), 42: require('../assets/bible/TAMOVR_42.json'), 43: require('../assets/bible/TAMOVR_43.json'), 44: require('../assets/bible/TAMOVR_44.json'), 45: require('../assets/bible/TAMOVR_45.json'), 46: require('../assets/bible/TAMOVR_46.json'), 47: require('../assets/bible/TAMOVR_47.json'), 48: require('../assets/bible/TAMOVR_48.json'), 49: require('../assets/bible/TAMOVR_49.json'), 50: require('../assets/bible/TAMOVR_50.json'), 51: require('../assets/bible/TAMOVR_51.json'), 52: require('../assets/bible/TAMOVR_52.json'), 53: require('../assets/bible/TAMOVR_53.json'), 54: require('../assets/bible/TAMOVR_54.json'), 55: require('../assets/bible/TAMOVR_55.json'), 56: require('../assets/bible/TAMOVR_56.json'), 57: require('../assets/bible/TAMOVR_57.json'), 58: require('../assets/bible/TAMOVR_58.json'), 59: require('../assets/bible/TAMOVR_59.json'), 60: require('../assets/bible/TAMOVR_60.json'), 61: require('../assets/bible/TAMOVR_61.json'), 62: require('../assets/bible/TAMOVR_62.json'), 63: require('../assets/bible/TAMOVR_63.json'), 64: require('../assets/bible/TAMOVR_64.json'), 65: require('../assets/bible/TAMOVR_65.json'), 66: require('../assets/bible/TAMOVR_66.json') },
  TAMBL98: { 1: require('../assets/bible/TAMBL98_1.json'), 2: require('../assets/bible/TAMBL98_2.json'), 3: require('../assets/bible/TAMBL98_3.json'), 4: require('../assets/bible/TAMBL98_4.json'), 5: require('../assets/bible/TAMBL98_5.json'), 6: require('../assets/bible/TAMBL98_6.json'), 7: require('../assets/bible/TAMBL98_7.json'), 8: require('../assets/bible/TAMBL98_8.json'), 9: require('../assets/bible/TAMBL98_9.json'), 10: require('../assets/bible/TAMBL98_10.json'), 11: require('../assets/bible/TAMBL98_11.json'), 12: require('../assets/bible/TAMBL98_12.json'), 13: require('../assets/bible/TAMBL98_13.json'), 14: require('../assets/bible/TAMBL98_14.json'), 15: require('../assets/bible/TAMBL98_15.json'), 16: require('../assets/bible/TAMBL98_16.json'), 17: require('../assets/bible/TAMBL98_17.json'), 18: require('../assets/bible/TAMBL98_18.json'), 19: require('../assets/bible/TAMBL98_19.json'), 20: require('../assets/bible/TAMBL98_20.json'), 21: require('../assets/bible/TAMBL98_21.json'), 22: require('../assets/bible/TAMBL98_22.json'), 23: require('../assets/bible/TAMBL98_23.json'), 24: require('../assets/bible/TAMBL98_24.json'), 25: require('../assets/bible/TAMBL98_25.json'), 26: require('../assets/bible/TAMBL98_26.json'), 27: require('../assets/bible/TAMBL98_27.json'), 28: require('../assets/bible/TAMBL98_28.json'), 29: require('../assets/bible/TAMBL98_29.json'), 30: require('../assets/bible/TAMBL98_30.json'), 31: require('../assets/bible/TAMBL98_31.json'), 32: require('../assets/bible/TAMBL98_32.json'), 33: require('../assets/bible/TAMBL98_33.json'), 34: require('../assets/bible/TAMBL98_34.json'), 35: require('../assets/bible/TAMBL98_35.json'), 36: require('../assets/bible/TAMBL98_36.json'), 37: require('../assets/bible/TAMBL98_37.json'), 38: require('../assets/bible/TAMBL98_38.json'), 39: require('../assets/bible/TAMBL98_39.json'), 40: require('../assets/bible/TAMBL98_40.json'), 41: require('../assets/bible/TAMBL98_41.json'), 42: require('../assets/bible/TAMBL98_42.json'), 43: require('../assets/bible/TAMBL98_43.json'), 44: require('../assets/bible/TAMBL98_44.json'), 45: require('../assets/bible/TAMBL98_45.json'), 46: require('../assets/bible/TAMBL98_46.json'), 47: require('../assets/bible/TAMBL98_47.json'), 48: require('../assets/bible/TAMBL98_48.json'), 49: require('../assets/bible/TAMBL98_49.json'), 50: require('../assets/bible/TAMBL98_50.json'), 51: require('../assets/bible/TAMBL98_51.json'), 52: require('../assets/bible/TAMBL98_52.json'), 53: require('../assets/bible/TAMBL98_53.json'), 54: require('../assets/bible/TAMBL98_54.json'), 55: require('../assets/bible/TAMBL98_55.json'), 56: require('../assets/bible/TAMBL98_56.json'), 57: require('../assets/bible/TAMBL98_57.json'), 58: require('../assets/bible/TAMBL98_58.json'), 59: require('../assets/bible/TAMBL98_59.json'), 60: require('../assets/bible/TAMBL98_60.json'), 61: require('../assets/bible/TAMBL98_61.json'), 62: require('../assets/bible/TAMBL98_62.json'), 63: require('../assets/bible/TAMBL98_63.json'), 64: require('../assets/bible/TAMBL98_64.json'), 65: require('../assets/bible/TAMBL98_65.json'), 66: require('../assets/bible/TAMBL98_66.json') },
  ERV: { 1: require('../assets/bible/ERV_1.json'), 2: require('../assets/bible/ERV_2.json'), 3: require('../assets/bible/ERV_3.json'), 4: require('../assets/bible/ERV_4.json'), 5: require('../assets/bible/ERV_5.json'), 6: require('../assets/bible/ERV_6.json'), 7: require('../assets/bible/ERV_7.json'), 8: require('../assets/bible/ERV_8.json'), 9: require('../assets/bible/ERV_9.json'), 10: require('../assets/bible/ERV_10.json'), 11: require('../assets/bible/ERV_11.json'), 12: require('../assets/bible/ERV_12.json'), 13: require('../assets/bible/ERV_13.json'), 14: require('../assets/bible/ERV_14.json'), 15: require('../assets/bible/ERV_15.json'), 16: require('../assets/bible/ERV_16.json'), 17: require('../assets/bible/ERV_17.json'), 18: require('../assets/bible/ERV_18.json'), 19: require('../assets/bible/ERV_19.json'), 20: require('../assets/bible/ERV_20.json'), 21: require('../assets/bible/ERV_21.json'), 22: require('../assets/bible/ERV_22.json'), 23: require('../assets/bible/ERV_23.json'), 24: require('../assets/bible/ERV_24.json'), 25: require('../assets/bible/ERV_25.json'), 26: require('../assets/bible/ERV_26.json'), 27: require('../assets/bible/ERV_27.json'), 28: require('../assets/bible/ERV_28.json'), 29: require('../assets/bible/ERV_29.json'), 30: require('../assets/bible/ERV_30.json'), 31: require('../assets/bible/ERV_31.json'), 32: require('../assets/bible/ERV_32.json'), 33: require('../assets/bible/ERV_33.json'), 34: require('../assets/bible/ERV_34.json'), 35: require('../assets/bible/ERV_35.json'), 36: require('../assets/bible/ERV_36.json'), 37: require('../assets/bible/ERV_37.json'), 38: require('../assets/bible/ERV_38.json'), 39: require('../assets/bible/ERV_39.json'), 40: require('../assets/bible/ERV_40.json'), 41: require('../assets/bible/ERV_41.json'), 42: require('../assets/bible/ERV_42.json'), 43: require('../assets/bible/ERV_43.json'), 44: require('../assets/bible/ERV_44.json'), 45: require('../assets/bible/ERV_45.json'), 46: require('../assets/bible/ERV_46.json'), 47: require('../assets/bible/ERV_47.json'), 48: require('../assets/bible/ERV_48.json'), 49: require('../assets/bible/ERV_49.json'), 50: require('../assets/bible/ERV_50.json'), 51: require('../assets/bible/ERV_51.json'), 52: require('../assets/bible/ERV_52.json'), 53: require('../assets/bible/ERV_53.json'), 54: require('../assets/bible/ERV_54.json'), 55: require('../assets/bible/ERV_55.json'), 56: require('../assets/bible/ERV_56.json'), 57: require('../assets/bible/ERV_57.json'), 58: require('../assets/bible/ERV_58.json'), 59: require('../assets/bible/ERV_59.json'), 60: require('../assets/bible/ERV_60.json'), 61: require('../assets/bible/ERV_61.json'), 62: require('../assets/bible/ERV_62.json'), 63: require('../assets/bible/ERV_63.json'), 64: require('../assets/bible/ERV_64.json'), 65: require('../assets/bible/ERV_65.json'), 66: require('../assets/bible/ERV_66.json') },
  KJV: { 1: require('../assets/bible/KJV_1.json'), 2: require('../assets/bible/KJV_2.json'), 3: require('../assets/bible/KJV_3.json'), 4: require('../assets/bible/KJV_4.json'), 5: require('../assets/bible/KJV_5.json'), 6: require('../assets/bible/KJV_6.json'), 7: require('../assets/bible/KJV_7.json'), 8: require('../assets/bible/KJV_8.json'), 9: require('../assets/bible/KJV_9.json'), 10: require('../assets/bible/KJV_10.json'), 11: require('../assets/bible/KJV_11.json'), 12: require('../assets/bible/KJV_12.json'), 13: require('../assets/bible/KJV_13.json'), 14: require('../assets/bible/KJV_14.json'), 15: require('../assets/bible/KJV_15.json'), 16: require('../assets/bible/KJV_16.json'), 17: require('../assets/bible/KJV_17.json'), 18: require('../assets/bible/KJV_18.json'), 19: require('../assets/bible/KJV_19.json'), 20: require('../assets/bible/KJV_20.json'), 21: require('../assets/bible/KJV_21.json'), 22: require('../assets/bible/KJV_22.json'), 23: require('../assets/bible/KJV_23.json'), 24: require('../assets/bible/KJV_24.json'), 25: require('../assets/bible/KJV_25.json'), 26: require('../assets/bible/KJV_26.json'), 27: require('../assets/bible/KJV_27.json'), 28: require('../assets/bible/KJV_28.json'), 29: require('../assets/bible/KJV_29.json'), 30: require('../assets/bible/KJV_30.json'), 31: require('../assets/bible/KJV_31.json'), 32: require('../assets/bible/KJV_32.json'), 33: require('../assets/bible/KJV_33.json'), 34: require('../assets/bible/KJV_34.json'), 35: require('../assets/bible/KJV_35.json'), 36: require('../assets/bible/KJV_36.json'), 37: require('../assets/bible/KJV_37.json'), 38: require('../assets/bible/KJV_38.json'), 39: require('../assets/bible/KJV_39.json'), 40: require('../assets/bible/KJV_40.json'), 41: require('../assets/bible/KJV_41.json'), 42: require('../assets/bible/KJV_42.json'), 43: require('../assets/bible/KJV_43.json'), 44: require('../assets/bible/KJV_44.json'), 45: require('../assets/bible/KJV_45.json'), 46: require('../assets/bible/KJV_46.json'), 47: require('../assets/bible/KJV_47.json'), 48: require('../assets/bible/KJV_48.json'), 49: require('../assets/bible/KJV_49.json'), 50: require('../assets/bible/KJV_50.json'), 51: require('../assets/bible/KJV_51.json'), 52: require('../assets/bible/KJV_52.json'), 53: require('../assets/bible/KJV_53.json'), 54: require('../assets/bible/KJV_54.json'), 55: require('../assets/bible/KJV_55.json'), 56: require('../assets/bible/KJV_56.json'), 57: require('../assets/bible/KJV_57.json'), 58: require('../assets/bible/KJV_58.json'), 59: require('../assets/bible/KJV_59.json'), 60: require('../assets/bible/KJV_60.json'), 61: require('../assets/bible/KJV_61.json'), 62: require('../assets/bible/KJV_62.json'), 63: require('../assets/bible/KJV_63.json'), 64: require('../assets/bible/KJV_64.json'), 65: require('../assets/bible/KJV_65.json'), 66: require('../assets/bible/KJV_66.json') },
  NIV: { 1: require('../assets/bible/NIV_1.json'), 2: require('../assets/bible/NIV_2.json'), 3: require('../assets/bible/NIV_3.json'), 4: require('../assets/bible/NIV_4.json'), 5: require('../assets/bible/NIV_5.json'), 6: require('../assets/bible/NIV_6.json'), 7: require('../assets/bible/NIV_7.json'), 8: require('../assets/bible/NIV_8.json'), 9: require('../assets/bible/NIV_9.json'), 10: require('../assets/bible/NIV_10.json'), 11: require('../assets/bible/NIV_11.json'), 12: require('../assets/bible/NIV_12.json'), 13: require('../assets/bible/NIV_13.json'), 14: require('../assets/bible/NIV_14.json'), 15: require('../assets/bible/NIV_15.json'), 16: require('../assets/bible/NIV_16.json'), 17: require('../assets/bible/NIV_17.json'), 18: require('../assets/bible/NIV_18.json'), 19: require('../assets/bible/NIV_19.json'), 20: require('../assets/bible/NIV_20.json'), 21: require('../assets/bible/NIV_21.json'), 22: require('../assets/bible/NIV_22.json'), 23: require('../assets/bible/NIV_23.json'), 24: require('../assets/bible/NIV_24.json'), 25: require('../assets/bible/NIV_25.json'), 26: require('../assets/bible/NIV_26.json'), 27: require('../assets/bible/NIV_27.json'), 28: require('../assets/bible/NIV_28.json'), 29: require('../assets/bible/NIV_29.json'), 30: require('../assets/bible/NIV_30.json'), 31: require('../assets/bible/NIV_31.json'), 32: require('../assets/bible/NIV_32.json'), 33: require('../assets/bible/NIV_33.json'), 34: require('../assets/bible/NIV_34.json'), 35: require('../assets/bible/NIV_35.json'), 36: require('../assets/bible/NIV_36.json'), 37: require('../assets/bible/NIV_37.json'), 38: require('../assets/bible/NIV_38.json'), 39: require('../assets/bible/NIV_39.json'), 40: require('../assets/bible/NIV_40.json'), 41: require('../assets/bible/NIV_41.json'), 42: require('../assets/bible/NIV_42.json'), 43: require('../assets/bible/NIV_43.json'), 44: require('../assets/bible/NIV_44.json'), 45: require('../assets/bible/NIV_45.json'), 46: require('../assets/bible/NIV_46.json'), 47: require('../assets/bible/NIV_47.json'), 48: require('../assets/bible/NIV_48.json'), 49: require('../assets/bible/NIV_49.json'), 50: require('../assets/bible/NIV_50.json'), 51: require('../assets/bible/NIV_51.json'), 52: require('../assets/bible/NIV_52.json'), 53: require('../assets/bible/NIV_53.json'), 54: require('../assets/bible/NIV_54.json'), 55: require('../assets/bible/NIV_55.json'), 56: require('../assets/bible/NIV_56.json'), 57: require('../assets/bible/NIV_57.json'), 58: require('../assets/bible/NIV_58.json'), 59: require('../assets/bible/NIV_59.json'), 60: require('../assets/bible/NIV_60.json'), 61: require('../assets/bible/NIV_61.json'), 62: require('../assets/bible/NIV_62.json'), 63: require('../assets/bible/NIV_63.json'), 64: require('../assets/bible/NIV_64.json'), 65: require('../assets/bible/NIV_65.json'), 66: require('../assets/bible/NIV_66.json') },
};

export const cleanText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/<S>\d+<\/S>/g, '')
    .replace(/<sup[^>]*>.*?<\/sup>/gs, '')
    .replace(/<sub[^>]*>.*?<\/sub>/gs, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

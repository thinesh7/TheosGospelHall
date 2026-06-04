import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Modal,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';

const BIBLE_VERSIONS = [
  { code: 'TAMOVR', name: 'Tamil Bible (OV)', short: 'OV', lang: 'Tamil' },
  { code: 'TAMBL98', name: 'Tamil Bible (ERV)', short: 'ERV', lang: 'Tamil' },
  { code: 'KJV', name: 'English (KJV)', short: 'KJV', lang: 'English' },
  { code: 'ERV', name: 'English (ERV)', short: 'ERV', lang: 'English' },
];

const BOOKS = [
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

const BIBLE_ASSETS: Record<string, Record<number, any>> = {
  TAMOVR: { 1: require('../../assets/bible/TAMOVR_1.json'), 2: require('../../assets/bible/TAMOVR_2.json'), 3: require('../../assets/bible/TAMOVR_3.json'), 4: require('../../assets/bible/TAMOVR_4.json'), 5: require('../../assets/bible/TAMOVR_5.json'), 6: require('../../assets/bible/TAMOVR_6.json'), 7: require('../../assets/bible/TAMOVR_7.json'), 8: require('../../assets/bible/TAMOVR_8.json'), 9: require('../../assets/bible/TAMOVR_9.json'), 10: require('../../assets/bible/TAMOVR_10.json'), 11: require('../../assets/bible/TAMOVR_11.json'), 12: require('../../assets/bible/TAMOVR_12.json'), 13: require('../../assets/bible/TAMOVR_13.json'), 14: require('../../assets/bible/TAMOVR_14.json'), 15: require('../../assets/bible/TAMOVR_15.json'), 16: require('../../assets/bible/TAMOVR_16.json'), 17: require('../../assets/bible/TAMOVR_17.json'), 18: require('../../assets/bible/TAMOVR_18.json'), 19: require('../../assets/bible/TAMOVR_19.json'), 20: require('../../assets/bible/TAMOVR_20.json'), 21: require('../../assets/bible/TAMOVR_21.json'), 22: require('../../assets/bible/TAMOVR_22.json'), 23: require('../../assets/bible/TAMOVR_23.json'), 24: require('../../assets/bible/TAMOVR_24.json'), 25: require('../../assets/bible/TAMOVR_25.json'), 26: require('../../assets/bible/TAMOVR_26.json'), 27: require('../../assets/bible/TAMOVR_27.json'), 28: require('../../assets/bible/TAMOVR_28.json'), 29: require('../../assets/bible/TAMOVR_29.json'), 30: require('../../assets/bible/TAMOVR_30.json'), 31: require('../../assets/bible/TAMOVR_31.json'), 32: require('../../assets/bible/TAMOVR_32.json'), 33: require('../../assets/bible/TAMOVR_33.json'), 34: require('../../assets/bible/TAMOVR_34.json'), 35: require('../../assets/bible/TAMOVR_35.json'), 36: require('../../assets/bible/TAMOVR_36.json'), 37: require('../../assets/bible/TAMOVR_37.json'), 38: require('../../assets/bible/TAMOVR_38.json'), 39: require('../../assets/bible/TAMOVR_39.json'), 40: require('../../assets/bible/TAMOVR_40.json'), 41: require('../../assets/bible/TAMOVR_41.json'), 42: require('../../assets/bible/TAMOVR_42.json'), 43: require('../../assets/bible/TAMOVR_43.json'), 44: require('../../assets/bible/TAMOVR_44.json'), 45: require('../../assets/bible/TAMOVR_45.json'), 46: require('../../assets/bible/TAMOVR_46.json'), 47: require('../../assets/bible/TAMOVR_47.json'), 48: require('../../assets/bible/TAMOVR_48.json'), 49: require('../../assets/bible/TAMOVR_49.json'), 50: require('../../assets/bible/TAMOVR_50.json'), 51: require('../../assets/bible/TAMOVR_51.json'), 52: require('../../assets/bible/TAMOVR_52.json'), 53: require('../../assets/bible/TAMOVR_53.json'), 54: require('../../assets/bible/TAMOVR_54.json'), 55: require('../../assets/bible/TAMOVR_55.json'), 56: require('../../assets/bible/TAMOVR_56.json'), 57: require('../../assets/bible/TAMOVR_57.json'), 58: require('../../assets/bible/TAMOVR_58.json'), 59: require('../../assets/bible/TAMOVR_59.json'), 60: require('../../assets/bible/TAMOVR_60.json'), 61: require('../../assets/bible/TAMOVR_61.json'), 62: require('../../assets/bible/TAMOVR_62.json'), 63: require('../../assets/bible/TAMOVR_63.json'), 64: require('../../assets/bible/TAMOVR_64.json'), 65: require('../../assets/bible/TAMOVR_65.json'), 66: require('../../assets/bible/TAMOVR_66.json') },
  TAMBL98: { 1: require('../../assets/bible/TAMBL98_1.json'), 2: require('../../assets/bible/TAMBL98_2.json'), 3: require('../../assets/bible/TAMBL98_3.json'), 4: require('../../assets/bible/TAMBL98_4.json'), 5: require('../../assets/bible/TAMBL98_5.json'), 6: require('../../assets/bible/TAMBL98_6.json'), 7: require('../../assets/bible/TAMBL98_7.json'), 8: require('../../assets/bible/TAMBL98_8.json'), 9: require('../../assets/bible/TAMBL98_9.json'), 10: require('../../assets/bible/TAMBL98_10.json'), 11: require('../../assets/bible/TAMBL98_11.json'), 12: require('../../assets/bible/TAMBL98_12.json'), 13: require('../../assets/bible/TAMBL98_13.json'), 14: require('../../assets/bible/TAMBL98_14.json'), 15: require('../../assets/bible/TAMBL98_15.json'), 16: require('../../assets/bible/TAMBL98_16.json'), 17: require('../../assets/bible/TAMBL98_17.json'), 18: require('../../assets/bible/TAMBL98_18.json'), 19: require('../../assets/bible/TAMBL98_19.json'), 20: require('../../assets/bible/TAMBL98_20.json'), 21: require('../../assets/bible/TAMBL98_21.json'), 22: require('../../assets/bible/TAMBL98_22.json'), 23: require('../../assets/bible/TAMBL98_23.json'), 24: require('../../assets/bible/TAMBL98_24.json'), 25: require('../../assets/bible/TAMBL98_25.json'), 26: require('../../assets/bible/TAMBL98_26.json'), 27: require('../../assets/bible/TAMBL98_27.json'), 28: require('../../assets/bible/TAMBL98_28.json'), 29: require('../../assets/bible/TAMBL98_29.json'), 30: require('../../assets/bible/TAMBL98_30.json'), 31: require('../../assets/bible/TAMBL98_31.json'), 32: require('../../assets/bible/TAMBL98_32.json'), 33: require('../../assets/bible/TAMBL98_33.json'), 34: require('../../assets/bible/TAMBL98_34.json'), 35: require('../../assets/bible/TAMBL98_35.json'), 36: require('../../assets/bible/TAMBL98_36.json'), 37: require('../../assets/bible/TAMBL98_37.json'), 38: require('../../assets/bible/TAMBL98_38.json'), 39: require('../../assets/bible/TAMBL98_39.json'), 40: require('../../assets/bible/TAMBL98_40.json'), 41: require('../../assets/bible/TAMBL98_41.json'), 42: require('../../assets/bible/TAMBL98_42.json'), 43: require('../../assets/bible/TAMBL98_43.json'), 44: require('../../assets/bible/TAMBL98_44.json'), 45: require('../../assets/bible/TAMBL98_45.json'), 46: require('../../assets/bible/TAMBL98_46.json'), 47: require('../../assets/bible/TAMBL98_47.json'), 48: require('../../assets/bible/TAMBL98_48.json'), 49: require('../../assets/bible/TAMBL98_49.json'), 50: require('../../assets/bible/TAMBL98_50.json'), 51: require('../../assets/bible/TAMBL98_51.json'), 52: require('../../assets/bible/TAMBL98_52.json'), 53: require('../../assets/bible/TAMBL98_53.json'), 54: require('../../assets/bible/TAMBL98_54.json'), 55: require('../../assets/bible/TAMBL98_55.json'), 56: require('../../assets/bible/TAMBL98_56.json'), 57: require('../../assets/bible/TAMBL98_57.json'), 58: require('../../assets/bible/TAMBL98_58.json'), 59: require('../../assets/bible/TAMBL98_59.json'), 60: require('../../assets/bible/TAMBL98_60.json'), 61: require('../../assets/bible/TAMBL98_61.json'), 62: require('../../assets/bible/TAMBL98_62.json'), 63: require('../../assets/bible/TAMBL98_63.json'), 64: require('../../assets/bible/TAMBL98_64.json'), 65: require('../../assets/bible/TAMBL98_65.json'), 66: require('../../assets/bible/TAMBL98_66.json') },
  ERV: { 1: require('../../assets/bible/ERV_1.json'), 2: require('../../assets/bible/ERV_2.json'), 3: require('../../assets/bible/ERV_3.json'), 4: require('../../assets/bible/ERV_4.json'), 5: require('../../assets/bible/ERV_5.json'), 6: require('../../assets/bible/ERV_6.json'), 7: require('../../assets/bible/ERV_7.json'), 8: require('../../assets/bible/ERV_8.json'), 9: require('../../assets/bible/ERV_9.json'), 10: require('../../assets/bible/ERV_10.json'), 11: require('../../assets/bible/ERV_11.json'), 12: require('../../assets/bible/ERV_12.json'), 13: require('../../assets/bible/ERV_13.json'), 14: require('../../assets/bible/ERV_14.json'), 15: require('../../assets/bible/ERV_15.json'), 16: require('../../assets/bible/ERV_16.json'), 17: require('../../assets/bible/ERV_17.json'), 18: require('../../assets/bible/ERV_18.json'), 19: require('../../assets/bible/ERV_19.json'), 20: require('../../assets/bible/ERV_20.json'), 21: require('../../assets/bible/ERV_21.json'), 22: require('../../assets/bible/ERV_22.json'), 23: require('../../assets/bible/ERV_23.json'), 24: require('../../assets/bible/ERV_24.json'), 25: require('../../assets/bible/ERV_25.json'), 26: require('../../assets/bible/ERV_26.json'), 27: require('../../assets/bible/ERV_27.json'), 28: require('../../assets/bible/ERV_28.json'), 29: require('../../assets/bible/ERV_29.json'), 30: require('../../assets/bible/ERV_30.json'), 31: require('../../assets/bible/ERV_31.json'), 32: require('../../assets/bible/ERV_32.json'), 33: require('../../assets/bible/ERV_33.json'), 34: require('../../assets/bible/ERV_34.json'), 35: require('../../assets/bible/ERV_35.json'), 36: require('../../assets/bible/ERV_36.json'), 37: require('../../assets/bible/ERV_37.json'), 38: require('../../assets/bible/ERV_38.json'), 39: require('../../assets/bible/ERV_39.json'), 40: require('../../assets/bible/ERV_40.json'), 41: require('../../assets/bible/ERV_41.json'), 42: require('../../assets/bible/ERV_42.json'), 43: require('../../assets/bible/ERV_43.json'), 44: require('../../assets/bible/ERV_44.json'), 45: require('../../assets/bible/ERV_45.json'), 46: require('../../assets/bible/ERV_46.json'), 47: require('../../assets/bible/ERV_47.json'), 48: require('../../assets/bible/ERV_48.json'), 49: require('../../assets/bible/ERV_49.json'), 50: require('../../assets/bible/ERV_50.json'), 51: require('../../assets/bible/ERV_51.json'), 52: require('../../assets/bible/ERV_52.json'), 53: require('../../assets/bible/ERV_53.json'), 54: require('../../assets/bible/ERV_54.json'), 55: require('../../assets/bible/ERV_55.json'), 56: require('../../assets/bible/ERV_56.json'), 57: require('../../assets/bible/ERV_57.json'), 58: require('../../assets/bible/ERV_58.json'), 59: require('../../assets/bible/ERV_59.json'), 60: require('../../assets/bible/ERV_60.json'), 61: require('../../assets/bible/ERV_61.json'), 62: require('../../assets/bible/ERV_62.json'), 63: require('../../assets/bible/ERV_63.json'), 64: require('../../assets/bible/ERV_64.json'), 65: require('../../assets/bible/ERV_65.json'), 66: require('../../assets/bible/ERV_66.json') },
  KJV: { 1: require('../../assets/bible/KJV_1.json'), 2: require('../../assets/bible/KJV_2.json'), 3: require('../../assets/bible/KJV_3.json'), 4: require('../../assets/bible/KJV_4.json'), 5: require('../../assets/bible/KJV_5.json'), 6: require('../../assets/bible/KJV_6.json'), 7: require('../../assets/bible/KJV_7.json'), 8: require('../../assets/bible/KJV_8.json'), 9: require('../../assets/bible/KJV_9.json'), 10: require('../../assets/bible/KJV_10.json'), 11: require('../../assets/bible/KJV_11.json'), 12: require('../../assets/bible/KJV_12.json'), 13: require('../../assets/bible/KJV_13.json'), 14: require('../../assets/bible/KJV_14.json'), 15: require('../../assets/bible/KJV_15.json'), 16: require('../../assets/bible/KJV_16.json'), 17: require('../../assets/bible/KJV_17.json'), 18: require('../../assets/bible/KJV_18.json'), 19: require('../../assets/bible/KJV_19.json'), 20: require('../../assets/bible/KJV_20.json'), 21: require('../../assets/bible/KJV_21.json'), 22: require('../../assets/bible/KJV_22.json'), 23: require('../../assets/bible/KJV_23.json'), 24: require('../../assets/bible/KJV_24.json'), 25: require('../../assets/bible/KJV_25.json'), 26: require('../../assets/bible/KJV_26.json'), 27: require('../../assets/bible/KJV_27.json'), 28: require('../../assets/bible/KJV_28.json'), 29: require('../../assets/bible/KJV_29.json'), 30: require('../../assets/bible/KJV_30.json'), 31: require('../../assets/bible/KJV_31.json'), 32: require('../../assets/bible/KJV_32.json'), 33: require('../../assets/bible/KJV_33.json'), 34: require('../../assets/bible/KJV_34.json'), 35: require('../../assets/bible/KJV_35.json'), 36: require('../../assets/bible/KJV_36.json'), 37: require('../../assets/bible/KJV_37.json'), 38: require('../../assets/bible/KJV_38.json'), 39: require('../../assets/bible/KJV_39.json'), 40: require('../../assets/bible/KJV_40.json'), 41: require('../../assets/bible/KJV_41.json'), 42: require('../../assets/bible/KJV_42.json'), 43: require('../../assets/bible/KJV_43.json'), 44: require('../../assets/bible/KJV_44.json'), 45: require('../../assets/bible/KJV_45.json'), 46: require('../../assets/bible/KJV_46.json'), 47: require('../../assets/bible/KJV_47.json'), 48: require('../../assets/bible/KJV_48.json'), 49: require('../../assets/bible/KJV_49.json'), 50: require('../../assets/bible/KJV_50.json'), 51: require('../../assets/bible/KJV_51.json'), 52: require('../../assets/bible/KJV_52.json'), 53: require('../../assets/bible/KJV_53.json'), 54: require('../../assets/bible/KJV_54.json'), 55: require('../../assets/bible/KJV_55.json'), 56: require('../../assets/bible/KJV_56.json'), 57: require('../../assets/bible/KJV_57.json'), 58: require('../../assets/bible/KJV_58.json'), 59: require('../../assets/bible/KJV_59.json'), 60: require('../../assets/bible/KJV_60.json'), 61: require('../../assets/bible/KJV_61.json'), 62: require('../../assets/bible/KJV_62.json'), 63: require('../../assets/bible/KJV_63.json'), 64: require('../../assets/bible/KJV_64.json'), 65: require('../../assets/bible/KJV_65.json'), 66: require('../../assets/bible/KJV_66.json') },
};

const THEMES = {
  light: { bg: '#f8f9fa', headerBg: '#0f3460', cardBg: '#fff', text: '#1a1a2e', subText: '#666', verseNum: '#0f3460', divider: '#eee', navBg: '#fff' },
  dark: { bg: '#121212', headerBg: '#1a1a2e', cardBg: '#1e1e1e', text: '#e0e0e0', subText: '#999', verseNum: '#7eb8f7', divider: '#333', navBg: '#1e1e1e' },
  sepia: { bg: '#f4ecd8', headerBg: '#5c4033', cardBg: '#fdf5e6', text: '#3e2723', subText: '#795548', verseNum: '#8d6e63', divider: '#d7ccc8', navBg: '#fdf5e6' },
};

const cleanText = (text: string): string => {
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

export default function BibleScreen() {
  const [version, setVersion] = useState('TAMOVR');
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [primaryVerses, setPrimaryVerses] = useState<any[]>([]);
  const [secondaryVerses, setSecondaryVerses] = useState<any[]>([]);
  const [view, setView] = useState<'home' | 'books' | 'chapters' | 'verses'>('home');
  const [testament, setTestament] = useState<'OT' | 'NT'>('OT');
  const [fontSize, setFontSize] = useState(17);
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  const [isBilingual, setIsBilingual] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [secondaryVersion, setSecondaryVersion] = useState('ERV');
  const [activeVerse, setActiveVerse] = useState(0);
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookModalTestament, setBookModalTestament] = useState<'OT' | 'NT'>('OT');
  const versesListRef = useRef<FlatList>(null);
  const verseBarRef = useRef<ScrollView>(null);
  const secondaryVersionRef = useRef('ERV');
  const pendingScrollRef = useRef<number | null>(null);
  const VERSE_BTN_WIDTH = 40;

  const T = THEMES[theme];
  const isEnglish = BIBLE_VERSIONS.find(v => v.code === version)?.lang === 'English';

  useEffect(() => { secondaryVersionRef.current = secondaryVersion; }, [secondaryVersion]);

  useEffect(() => {
    const backAction = () => {
      if (showBookModal) { setShowBookModal(false); return true; }
      if (view === 'verses') { setView('chapters'); return true; }
      if (view === 'chapters') { setView('books'); return true; }
      if (view === 'books') { setView('home'); setIsBilingual(false); return true; }
      return false;
    };
    const handler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => handler.remove();
  }, [view, showBookModal]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 60 && Math.abs(g.dy) < 30 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -80) navigateChapter('next');
        else if (g.dx > 80) navigateChapter('prev');
      },
    })
  ).current;

  const loadChapter = (book: any, chapter: number, keepBook = false) => {
    try {
      if (!keepBook) setSelectedBook(book);
      const bookData = BIBLE_ASSETS[version]?.[book.id];
      if (bookData) setPrimaryVerses(bookData[String(chapter)] || []);
      const secVer = secondaryVersionRef.current;
      if (isBilingual && !isEnglish) {
        const secData = BIBLE_ASSETS[secVer]?.[book.id];
        if (secData) setSecondaryVerses(secData[String(chapter)] || []);
        else setSecondaryVerses([]);
      } else {
        setSecondaryVerses([]);
      }
      setSelectedChapter(chapter);
      setActiveVerse(0);
      pendingScrollRef.current = null;
      setView('verses');
      setTimeout(() => {
        versesListRef.current?.scrollToOffset({ offset: 0, animated: false });
        verseBarRef.current?.scrollTo({ x: 0, animated: false });
      }, 100);
    } catch (e) { console.log('Load error:', e); }
  };

  const navigateChapter = (dir: 'next' | 'prev') => {
    if (!selectedBook) return;
    const totalChapters = selectedBook.chapters;
    if (dir === 'next') {
      if (selectedChapter < totalChapters) loadChapter(selectedBook, selectedChapter + 1, true);
      else { const nb = BOOKS.find(b => b.id === selectedBook.id + 1); if (nb) loadChapter(nb, 1); }
    } else {
      if (selectedChapter > 1) loadChapter(selectedBook, selectedChapter - 1, true);
      else { const pb = BOOKS.find(b => b.id === selectedBook.id - 1); if (pb) loadChapter(pb, pb.chapters); }
    }
  };

  const syncVerseBar = (idx: number) => {
    const barX = idx * VERSE_BTN_WIDTH - 120;
    verseBarRef.current?.scrollTo({ x: Math.max(0, barX), animated: false });
  };

  // THE REAL FIX: use scrollToIndex which works regardless of whether
  // items are rendered yet. onScrollToIndexFailed handles the rare case
  // where the list hasn't rendered that far yet by first scrolling near
  // then retrying after a short delay.
  const jumpToVerse = (verseIdx: number) => {
    setActiveVerse(verseIdx);
    syncVerseBar(verseIdx);
    pendingScrollRef.current = verseIdx;
    try {
      versesListRef.current?.scrollToIndex({
        index: verseIdx,
        animated: true,
        viewPosition: 0,
      });
    } catch (e) {
      // List not ready yet — will be handled by onScrollToIndexFailed
    }
  };

  const handleScrollToIndexFailed = (info: { index: number; averageItemLength: number; highestMeasuredFrameIndex: number }) => {
    const idx = info.index;
    // First scroll to the highest measured index to force rendering
    versesListRef.current?.scrollToIndex({
      index: info.highestMeasuredFrameIndex,
      animated: false,
    });
    // Then retry the actual target after items render
    setTimeout(() => {
      if (pendingScrollRef.current === idx) {
        versesListRef.current?.scrollToIndex({
          index: idx,
          animated: true,
          viewPosition: 0,
        });
      }
    }, 200);
  };

  const copyVerse = async (verseNum: number, text: string) => {
    const bookName = isEnglish ? selectedBook?.name : selectedBook?.tamil;
    const copyText = `${bookName} ${selectedChapter}:${verseNum} - ${cleanText(text)}`;
    await Clipboard.setStringAsync(copyText);
    ToastAndroid.show('Verse copied!', ToastAndroid.SHORT);
  };

  const OTBooks = BOOKS.filter(b => b.id <= 39);
  const NTBooks = BOOKS.filter(b => b.id >= 40);

  const BookSelectorModal = () => (
    <Modal visible={showBookModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.bookModalCard, { backgroundColor: T.cardBg }]}>
          <View style={[styles.bookModalHeader, { backgroundColor: T.headerBg }]}>
            <Text style={styles.bookModalTitle}>Select Book</Text>
            <TouchableOpacity onPress={() => setShowBookModal(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={[styles.testamentRow, { backgroundColor: T.cardBg }]}>
            <TouchableOpacity style={[styles.testamentBtn, bookModalTestament === 'OT' && { backgroundColor: T.headerBg }]} onPress={() => setBookModalTestament('OT')}>
              <Text style={[styles.testamentText, { color: bookModalTestament === 'OT' ? '#fff' : T.subText }]}>
                {isEnglish ? 'Old Testament' : 'பழைய ஏற்பாடு'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.testamentBtn, bookModalTestament === 'NT' && { backgroundColor: T.headerBg }]} onPress={() => setBookModalTestament('NT')}>
              <Text style={[styles.testamentText, { color: bookModalTestament === 'NT' ? '#fff' : T.subText }]}>
                {isEnglish ? 'New Testament' : 'புதிய ஏற்பாடு'}
              </Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={bookModalTestament === 'OT' ? OTBooks : NTBooks}
            key={`modal-books-${bookModalTestament}`}
            keyExtractor={item => item.id.toString()}
            numColumns={2}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.bookCard, { backgroundColor: T.bg, borderWidth: 1, borderColor: T.divider }]}
                onPress={() => { setShowBookModal(false); setSelectedBook(item); setView('chapters'); }}
              >
                <Text style={[styles.bookName, { color: T.text }]}>
                  {isBilingual ? item.name : isEnglish ? item.name : item.tamil}
                </Text>
                {isBilingual && <Text style={[styles.bookTamil, { color: T.subText }]}>{item.tamil}</Text>}
                <Text style={[styles.bookChapters, { color: T.verseNum }]}>{item.chapters} chapters</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  const SettingsModal = () => (
    <Modal visible={showSettings} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: T.cardBg }]}>
          <Text style={[styles.modalTitle, { color: T.text }]}>⚙️ Reading Settings</Text>
          <Text style={[styles.settingLabel, { color: T.subText }]}>Font Size</Text>
          <View style={styles.fontSizeRow}>
            <TouchableOpacity style={[styles.fontBtn, { borderColor: T.verseNum }]} onPress={() => setFontSize(f => Math.max(12, f - 2))}>
              <Text style={[styles.fontBtnText, { color: T.verseNum }]}>A-</Text>
            </TouchableOpacity>
            <Text style={[styles.fontSizeValue, { color: T.text }]}>{fontSize}px</Text>
            <TouchableOpacity style={[styles.fontBtn, { borderColor: T.verseNum }]} onPress={() => setFontSize(f => Math.min(30, f + 2))}>
              <Text style={[styles.fontBtnText, { color: T.verseNum }]}>A+</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.settingLabel, { color: T.subText }]}>Theme</Text>
          <View style={styles.themeRow}>
            {(['light', 'dark', 'sepia'] as const).map(t => (
              <TouchableOpacity key={t} style={[styles.themeBtn, { backgroundColor: THEMES[t].bg, borderColor: theme === t ? '#0f3460' : '#ddd' }]} onPress={() => setTheme(t)}>
                <Text style={{ color: THEMES[t].text, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!isEnglish && (
            <>
              <Text style={[styles.settingLabel, { color: T.subText }]}>Reading Mode</Text>
              <View style={styles.modeRow}>
                <TouchableOpacity style={[styles.modeBtn, !isBilingual && { backgroundColor: '#0f3460' }]} onPress={() => setIsBilingual(false)}>
                  <Text style={{ color: isBilingual ? '#666' : '#fff', fontWeight: '600', fontSize: 13 }}>Single</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeBtn, isBilingual && { backgroundColor: '#7209b7' }]} onPress={() => setIsBilingual(true)}>
                  <Text style={{ color: isBilingual ? '#fff' : '#666', fontWeight: '600', fontSize: 13 }}>Bilingual</Text>
                </TouchableOpacity>
              </View>
              {isBilingual && (
                <>
                  <Text style={[styles.settingLabel, { color: T.subText }]}>English Version</Text>
                  <View style={styles.versionPickRow}>
                    {BIBLE_VERSIONS.filter(v => v.lang === 'English').map(v => (
                      <TouchableOpacity
                        key={v.code}
                        style={[styles.versionPick, secondaryVersion === v.code && { backgroundColor: '#7209b7' }]}
                        onPress={() => {
                          setSecondaryVersion(v.code);
                          secondaryVersionRef.current = v.code;
                          if (selectedBook && selectedChapter) {
                            const secData = BIBLE_ASSETS[v.code]?.[selectedBook.id];
                            if (secData) setSecondaryVerses(secData[String(selectedChapter)] || []);
                          }
                        }}
                      >
                        <Text style={{ color: secondaryVersion === v.code ? '#fff' : '#666', fontSize: 11, fontWeight: '600' }}>{v.short}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowSettings(false)}>
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // HOME
  if (view === 'home') {
    const tamilVersions = BIBLE_VERSIONS.filter(v => v.lang === 'Tamil');
    const englishVersions = BIBLE_VERSIONS.filter(v => v.lang === 'English');
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.header, { backgroundColor: T.headerBg }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>📖 Bible</Text>
            <Text style={styles.headerSubtitle}>4 versions available</Text>
          </View>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <TouchableOpacity style={styles.bilingualCard} onPress={() => {
            setIsBilingual(true); setVersion('TAMOVR');
            setSecondaryVersion('ERV'); secondaryVersionRef.current = 'ERV';
            setView('books'); setTestament('OT');
          }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bilingualTitle}>🌐 Bilingual Reading</Text>
              <Text style={styles.bilingualDesc}>Tamil (top) + English (bottom) together</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.sectionLabel, { color: T.subText }]}>Tamil Versions</Text>
          {tamilVersions.map(v => (
            <TouchableOpacity key={v.code} style={[styles.versionCard, { backgroundColor: T.cardBg }]}
              onPress={() => { setIsBilingual(false); setVersion(v.code); setView('books'); setTestament('OT'); }}>
              <View style={styles.versionIcon}><Text style={styles.versionIconText}>த</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.versionName, { color: T.text }]}>{v.name}</Text>
                <Text style={[styles.versionShort, { color: T.subText }]}>{v.short}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={T.subText} />
            </TouchableOpacity>
          ))}
          <Text style={[styles.sectionLabel, { color: T.subText, marginTop: 16 }]}>English Versions</Text>
          {englishVersions.map(v => (
            <TouchableOpacity key={v.code} style={[styles.versionCard, { backgroundColor: T.cardBg }]}
              onPress={() => { setIsBilingual(false); setVersion(v.code); setView('books'); setTestament('OT'); }}>
              <View style={[styles.versionIcon, { backgroundColor: '#1a6b3a' }]}><Text style={styles.versionIconText}>E</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.versionName, { color: T.text }]}>{v.name}</Text>
                <Text style={[styles.versionShort, { color: T.subText }]}>{v.short}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={T.subText} />
            </TouchableOpacity>
          ))}
        </ScrollView>
        <SettingsModal />
      </View>
    );
  }

  // BOOKS
  if (view === 'books') {
    const books = testament === 'OT' ? OTBooks : NTBooks;
    const currentVersion = BIBLE_VERSIONS.find(v => v.code === version);
    const otLabel = isEnglish ? 'Old Testament (OT)' : 'பழைய ஏற்பாடு (OT)';
    const ntLabel = isEnglish ? 'New Testament (NT)' : 'புதிய ஏற்பாடு (NT)';
    const selectLabel = isEnglish ? 'Select a book' : 'புத்தகம் தேர்வு செய்யுங்கள்';
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
        <View style={[styles.header, { backgroundColor: T.headerBg }]}>
          <TouchableOpacity onPress={() => { setView('home'); setIsBilingual(false); }} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{isBilingual ? '🌐 Bilingual' : currentVersion?.name}</Text>
            <Text style={styles.headerSubtitle}>{selectLabel}</Text>
          </View>
        </View>
        <View style={[styles.testamentRow, { backgroundColor: T.cardBg }]}>
          <TouchableOpacity style={[styles.testamentBtn, testament === 'OT' && { backgroundColor: T.headerBg }]} onPress={() => setTestament('OT')}>
            <Text style={[styles.testamentText, { color: testament === 'OT' ? '#fff' : T.subText }]}>{otLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.testamentBtn, testament === 'NT' && { backgroundColor: T.headerBg }]} onPress={() => setTestament('NT')}>
            <Text style={[styles.testamentText, { color: testament === 'NT' ? '#fff' : T.subText }]}>{ntLabel}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={books} key={`books-${testament}`}
          keyExtractor={item => item.id.toString()} numColumns={2}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.bookCard, { backgroundColor: T.cardBg }]}
              onPress={() => { setSelectedBook(item); setView('chapters'); }}>
              <Text style={[styles.bookName, { color: T.text }]}>{isBilingual ? item.name : isEnglish ? item.name : item.tamil}</Text>
              {isBilingual && <Text style={[styles.bookTamil, { color: T.subText }]}>{item.tamil}</Text>}
              <Text style={[styles.bookChapters, { color: T.verseNum }]}>{item.chapters} chapters</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // CHAPTERS
  if (view === 'chapters' && selectedBook) {
    const chapters = Array.from({ length: selectedBook.chapters }, (_, i) => i + 1);
    const chapterTitle = isBilingual ? `${selectedBook.name} | ${selectedBook.tamil}` : isEnglish ? selectedBook.name : selectedBook.tamil;
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
        <View style={[styles.header, { backgroundColor: T.headerBg }]}>
          <TouchableOpacity onPress={() => setView('books')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{chapterTitle}</Text>
            <Text style={styles.headerSubtitle}>{isEnglish || isBilingual ? 'Select chapter' : 'அதிகாரம் தேர்வு செய்யுங்கள்'}</Text>
          </View>
        </View>
        <FlatList
          data={chapters} key={`chapters-${selectedBook.id}`}
          keyExtractor={item => item.toString()} numColumns={5}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.chapterBtn, { backgroundColor: T.cardBg }]} onPress={() => loadChapter(selectedBook, item)}>
              <Text style={[styles.chapterText, { color: T.verseNum }]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // VERSES
  if (view === 'verses') {
    const showBilingual = isBilingual && !isEnglish && secondaryVerses.length > 0;
    const maxVerses = Math.max(primaryVerses.length, showBilingual ? secondaryVerses.length : 0);
    const primaryVersion = BIBLE_VERSIONS.find(v => v.code === version);
    const secVersion = BIBLE_VERSIONS.find(v => v.code === secondaryVersion);
    const totalChapters = selectedBook?.chapters || 1;
    const bookDisplayName = isBilingual ? selectedBook?.name : isEnglish ? selectedBook?.name : selectedBook?.tamil;
    const isFirstChapterFirstBook = selectedChapter === 1 && selectedBook?.id === 1;
    const isLastChapterLastBook = selectedChapter === totalChapters && selectedBook?.id === 66;

    return (
      <View style={[styles.container, { backgroundColor: T.bg }]} {...panResponder.panHandlers}>
        <View style={[styles.header, { backgroundColor: T.headerBg }]}>
          <TouchableOpacity onPress={() => setView('chapters')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => {
              setBookModalTestament(selectedBook?.id <= 39 ? 'OT' : 'NT');
              setShowBookModal(true);
            }}>
              <Text style={[styles.headerTitle, { textDecorationLine: 'underline' }]} numberOfLines={1}>
                {bookDisplayName} {selectedChapter}
              </Text>
            </TouchableOpacity>
            <Text style={styles.headerSubtitle}>
              {showBilingual ? `${primaryVersion?.short} + ${secVersion?.short}` : primaryVersion?.short} • tap name to change book
            </Text>
          </View>
          <TouchableOpacity onPress={() => setFontSize(f => Math.max(12, f - 2))} style={styles.fontQuickBtn}>
            <Text style={styles.fontQuickText}>A-</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFontSize(f => Math.min(30, f + 2))} style={styles.fontQuickBtn}>
            <Text style={styles.fontQuickText}>A+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Verse jump bar */}
        <View style={[styles.verseJumpBar, { backgroundColor: T.navBg, borderBottomColor: T.divider }]}>
          <ScrollView ref={verseBarRef} horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 8, gap: 4 }}>
            {primaryVerses.map((_, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.verseJumpBtn, { width: VERSE_BTN_WIDTH - 4 }, activeVerse === i && { backgroundColor: T.headerBg }]}
                onPress={() => jumpToVerse(i)}
              >
                <Text style={[styles.verseJumpText, { color: activeVerse === i ? '#fff' : T.verseNum }]}>{i + 1}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {showBilingual ? (
          <FlatList
            ref={versesListRef}
            data={Array.from({ length: maxVerses }, (_, i) => i)}
            key="bilingual"
            keyExtractor={i => i.toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            onViewableItemsChanged={({ viewableItems }) => {
              if (viewableItems.length > 0) {
                const idx = viewableItems[0].index ?? 0;
                setActiveVerse(idx);
                syncVerseBar(idx);
              }
            }}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            renderItem={({ item: i }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onLongPress={() => copyVerse(i + 1, (primaryVerses[i]?.text || '') + ' | ' + (secondaryVerses[i]?.text || ''))}
              >
                <View style={[styles.bilingualVerseBlock, { borderColor: T.divider }]}>
                  <View style={[styles.verseNumBadge, { backgroundColor: T.headerBg }]}>
                    <Text style={styles.verseNumBadgeText}>{i + 1}</Text>
                    <Text style={styles.longPressHint}>hold to copy</Text>
                  </View>
                  {primaryVerses[i] && (
                    <View style={[styles.tamilSection, { backgroundColor: T.cardBg, borderBottomWidth: 1, borderBottomColor: T.divider }]}>
                      <Text style={[styles.versionTag, { color: T.verseNum }]}>{primaryVersion?.short}</Text>
                      <Text style={{ fontSize, color: T.text, lineHeight: fontSize * 1.7 }}>{cleanText(primaryVerses[i]?.text)}</Text>
                    </View>
                  )}
                  {secondaryVerses[i] && (
                    <View style={[styles.englishSection, { backgroundColor: T.bg }]}>
                      <Text style={[styles.versionTag, { color: T.subText }]}>{secVersion?.short}</Text>
                      <Text style={{ fontSize, color: T.text, lineHeight: fontSize * 1.7 }}>{cleanText(secondaryVerses[i]?.text)}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        ) : (
          <FlatList
            ref={versesListRef}
            data={primaryVerses}
            key="single"
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            onViewableItemsChanged={({ viewableItems }) => {
              if (viewableItems.length > 0) {
                const idx = viewableItems[0].index ?? 0;
                setActiveVerse(idx);
                syncVerseBar(idx);
              }
            }}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onLongPress={() => copyVerse(item.verse, item.text)}
              >
                <View style={[styles.verseRow, { borderBottomColor: T.divider }]}>
                  <Text style={[styles.verseNumber, { fontSize: fontSize - 3, color: T.verseNum }]}>{item.verse}</Text>
                  <Text style={[styles.verseText, { fontSize, color: T.text, lineHeight: fontSize * 1.7 }]}>{cleanText(item.text)}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        <View style={[styles.bottomNav, { backgroundColor: T.navBg, borderTopColor: T.divider }]}>
          <TouchableOpacity style={[styles.navBtn, isFirstChapterFirstBook && styles.navBtnDisabled]}
            onPress={() => !isFirstChapterFirstBook && navigateChapter('prev')}>
            <Ionicons name="chevron-back" size={20} color={isFirstChapterFirstBook ? '#ccc' : T.verseNum} />
            <Text style={[styles.navBtnText, { color: isFirstChapterFirstBook ? '#ccc' : T.verseNum }]}>
              {isEnglish || isBilingual ? 'Previous' : 'முந்தையது'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navChapterInfo} onPress={() => setView('chapters')}>
            <Text style={[styles.navChapterText, { color: T.text }]}>Ch {selectedChapter}/{totalChapters}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navBtnRight, isLastChapterLastBook && styles.navBtnDisabled]}
            onPress={() => !isLastChapterLastBook && navigateChapter('next')}>
            <Text style={[styles.navBtnText, { color: isLastChapterLastBook ? '#ccc' : T.verseNum }]}>
              {isEnglish || isBilingual ? 'Next' : 'அடுத்தது'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={isLastChapterLastBook ? '#ccc' : T.verseNum} />
          </TouchableOpacity>
        </View>

        <SettingsModal />
        <BookSelectorModal />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 50, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 11, color: '#a8c0e8', marginTop: 2 },
  backBtn: { padding: 4 },
  settingsBtn: { padding: 4 },
  fontQuickBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  fontQuickText: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  bilingualCard: { backgroundColor: '#7209b7', borderRadius: 16, padding: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center', elevation: 4 },
  bilingualTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  bilingualDesc: { fontSize: 13, color: '#e0b0ff', marginTop: 4 },
  sectionLabel: { fontSize: 13, fontWeight: 'bold', marginBottom: 10 },
  versionCard: { borderRadius: 14, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 3, gap: 12 },
  versionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0f3460', alignItems: 'center', justifyContent: 'center' },
  versionIconText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  versionName: { fontSize: 15, fontWeight: 'bold' },
  versionShort: { fontSize: 12, marginTop: 2 },
  testamentRow: { flexDirection: 'row', padding: 8, gap: 8 },
  testamentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  testamentText: { fontSize: 12, fontWeight: '600' },
  bookCard: { flex: 1, margin: 6, borderRadius: 12, padding: 14, elevation: 2 },
  bookName: { fontSize: 13, fontWeight: 'bold' },
  bookTamil: { fontSize: 11, marginTop: 2 },
  bookChapters: { fontSize: 10, marginTop: 6, fontWeight: '600' },
  chapterBtn: { flex: 1, margin: 6, borderRadius: 10, padding: 14, alignItems: 'center', elevation: 2 },
  chapterText: { fontSize: 16, fontWeight: 'bold' },
  verseJumpBar: { borderBottomWidth: 1, paddingVertical: 6 },
  verseJumpBtn: { height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  verseJumpText: { fontSize: 13, fontWeight: '700' },
  verseRow: { flexDirection: 'row', marginBottom: 12, gap: 8, paddingBottom: 12, borderBottomWidth: 0.5, alignItems: 'flex-start' },
  verseNumber: { fontWeight: 'bold', minWidth: 26, marginTop: 2 },
  verseText: { flex: 1 },
  bilingualVerseBlock: { marginBottom: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, elevation: 2 },
  verseNumBadge: { paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verseNumBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  longPressHint: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  tamilSection: { padding: 12 },
  englishSection: { padding: 12 },
  versionTag: { fontSize: 10, fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase' },
  bottomNav: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  navBtnRight: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 13, fontWeight: '600' },
  navChapterInfo: { flex: 1, alignItems: 'center' },
  navChapterText: { fontSize: 14, fontWeight: 'bold' },
  bookModalCard: { flex: 1, marginTop: 60, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  bookModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 20 },
  bookModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  settingLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 16 },
  fontSizeRow: { flexDirection: 'row', alignItems: 'center', gap: 16, justifyContent: 'center' },
  fontBtn: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  fontBtnText: { fontWeight: 'bold', fontSize: 16 },
  fontSizeValue: { fontSize: 18, fontWeight: 'bold', minWidth: 60, textAlign: 'center' },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 2 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#eee' },
  versionPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  versionPick: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#eee' },
  closeBtn: { backgroundColor: '#0f3460', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
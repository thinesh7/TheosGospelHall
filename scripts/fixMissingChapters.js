/**
 * fixMissingChapters.js
 * Scans all Bible JSON files for missing or empty chapters,
 * then re-downloads only those from bolls.life.
 *
 * Usage: node scripts/fixMissingChapters.js
 *
 * To re-download ALL files from scratch instead:
 *   node scripts/fixMissingChapters.js --full
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const VERSIONS = ['TAMOVR', 'TAMBL98', 'ERV', 'KJV'];
const dir = path.join(__dirname, '..', 'assets', 'bible');
const FULL_MODE = process.argv.includes('--full');

const BOOKS = [
  { id: 1,  chapters: 50  }, { id: 2,  chapters: 40  }, { id: 3,  chapters: 27  },
  { id: 4,  chapters: 36  }, { id: 5,  chapters: 34  }, { id: 6,  chapters: 24  },
  { id: 7,  chapters: 21  }, { id: 8,  chapters: 4   }, { id: 9,  chapters: 31  },
  { id: 10, chapters: 24  }, { id: 11, chapters: 22  }, { id: 12, chapters: 25  },
  { id: 13, chapters: 29  }, { id: 14, chapters: 36  }, { id: 15, chapters: 10  },
  { id: 16, chapters: 13  }, { id: 17, chapters: 10  }, { id: 18, chapters: 42  },
  { id: 19, chapters: 150 }, { id: 20, chapters: 31  }, { id: 21, chapters: 12  },
  { id: 22, chapters: 8   }, { id: 23, chapters: 66  }, { id: 24, chapters: 52  },
  { id: 25, chapters: 5   }, { id: 26, chapters: 48  }, { id: 27, chapters: 12  },
  { id: 28, chapters: 14  }, { id: 29, chapters: 3   }, { id: 30, chapters: 9   },
  { id: 31, chapters: 1   }, { id: 32, chapters: 4   }, { id: 33, chapters: 7   },
  { id: 34, chapters: 3   }, { id: 35, chapters: 3   }, { id: 36, chapters: 3   },
  { id: 37, chapters: 2   }, { id: 38, chapters: 14  }, { id: 39, chapters: 4   },
  { id: 40, chapters: 28  }, { id: 41, chapters: 16  }, { id: 42, chapters: 24  },
  { id: 43, chapters: 21  }, { id: 44, chapters: 28  }, { id: 45, chapters: 16  },
  { id: 46, chapters: 16  }, { id: 47, chapters: 13  }, { id: 48, chapters: 6   },
  { id: 49, chapters: 6   }, { id: 50, chapters: 4   }, { id: 51, chapters: 4   },
  { id: 52, chapters: 5   }, { id: 53, chapters: 3   }, { id: 54, chapters: 6   },
  { id: 55, chapters: 4   }, { id: 56, chapters: 3   }, { id: 57, chapters: 1   },
  { id: 58, chapters: 13  }, { id: 59, chapters: 5   }, { id: 60, chapters: 5   },
  { id: 61, chapters: 3   }, { id: 62, chapters: 5   }, { id: 63, chapters: 1   },
  { id: 64, chapters: 1   }, { id: 65, chapters: 1   }, { id: 66, chapters: 22  },
];

function fetchChapter(version, bookId, chapter) {
  return new Promise((resolve, reject) => {
    const url = `https://bolls.life/get-chapter/${version}/${bookId}/${chapter}/`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // bolls.life returns array of {pk, verse, text} or {verse, text}
          const verses = parsed
            .filter(v => v.verse && v.text)
            .map(v => ({
              verse: typeof v.verse === 'string' ? parseInt(v.verse) : v.verse,
              text: v.text.replace(/\s+/g, ' ').trim(),
            }));
          resolve(verses);
        } catch (e) {
          reject(new Error(`Parse error ${version} ${bookId}:${chapter} — ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function scanMissing() {
  const missing = [];

  for (const version of VERSIONS) {
    for (const book of BOOKS) {
      const filePath = path.join(dir, `${version}_${book.id}.json`);

      if (!fs.existsSync(filePath)) {
        // Whole file missing — add all chapters
        for (let ch = 1; ch <= book.chapters; ch++) {
          missing.push({ version, bookId: book.id, chapter: ch, totalChapters: book.chapters, reason: 'file missing' });
        }
        continue;
      }

      let bookData;
      try {
        bookData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        // Corrupt file — re-download all chapters
        for (let ch = 1; ch <= book.chapters; ch++) {
          missing.push({ version, bookId: book.id, chapter: ch, totalChapters: book.chapters, reason: 'corrupt file' });
        }
        continue;
      }

      for (let ch = 1; ch <= book.chapters; ch++) {
        const verses = bookData[String(ch)];
        if (!verses || verses.length === 0) {
          missing.push({ version, bookId: book.id, chapter: ch, totalChapters: book.chapters, reason: 'empty chapter' });
        }
      }
    }
  }

  return missing;
}

async function fixChapter(version, bookId, chapter) {
  const filePath = path.join(dir, `${version}_${bookId}.json`);
  let bookData = {};

  if (fs.existsSync(filePath)) {
    try { bookData = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch (e) { bookData = {}; }
  }

  const verses = await fetchChapter(version, bookId, chapter);
  bookData[String(chapter)] = verses;
  fs.writeFileSync(filePath, JSON.stringify(bookData, null, 2), 'utf8');
  return verses.length;
}

async function downloadFullBook(version, bookId, totalChapters) {
  const filePath = path.join(dir, `${version}_${bookId}.json`);
  const bookData = {};

  for (let ch = 1; ch <= totalChapters; ch++) {
    process.stdout.write(`  ${version} book ${bookId}: chapter ${ch}/${totalChapters}\r`);
    try {
      bookData[String(ch)] = await fetchChapter(version, bookId, ch);
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.error(`\n  ❌ ${version} ${bookId}:${ch} — ${e.message}`);
      bookData[String(ch)] = [];
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(bookData, null, 2), 'utf8');
  console.log(`  ✅ ${version}_${bookId}.json saved`);
}

async function runFullDownload() {
  console.log('🔄 Full re-download mode — downloading all versions and books...\n');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (const version of VERSIONS) {
    console.log(`\n📖 Version: ${version}`);
    for (const book of BOOKS) {
      await downloadFullBook(version, book.id, book.chapters);
    }
  }
  console.log('\n✅ Full download complete.');
}

async function runFixMode() {
  console.log('🔍 Scanning all Bible files for missing or empty chapters...\n');

  const missing = scanMissing();

  if (missing.length === 0) {
    console.log('✅ All chapters present — nothing to fix!');
    return;
  }

  // Group by version+book for reporting
  const grouped = {};
  for (const m of missing) {
    const key = `${m.version}_${m.bookId}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m.chapter);
  }

  console.log(`Found ${missing.length} missing/empty chapters across ${Object.keys(grouped).length} files:\n`);
  for (const [key, chapters] of Object.entries(grouped)) {
    console.log(`  ${key}.json — chapters: ${chapters.join(', ')}`);
  }

  console.log(`\n⬇️  Re-downloading ${missing.length} chapters...\n`);

  let fixed = 0;
  let failed = 0;

  for (const { version, bookId, chapter, reason } of missing) {
    process.stdout.write(`  Fixing ${version} book ${bookId} ch ${chapter} (${reason})...\r`);
    try {
      const count = await fixChapter(version, bookId, chapter);
      if (count === 0) {
        console.log(`  ⚠️  ${version} ${bookId}:${chapter} — downloaded but empty (${count} verses)`);
      }
      fixed++;
      await new Promise(r => setTimeout(r, 150)); // be gentle with the API
    } catch (e) {
      console.error(`\n  ❌ ${version} ${bookId}:${chapter} — ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Done — fixed: ${fixed}, failed: ${failed}`);

  if (failed > 0) {
    console.log('   Run the script again to retry failed chapters.');
  }
}

async function main() {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (FULL_MODE) {
    await runFullDownload();
  } else {
    await runFixMode();
  }
}

main().catch(console.error);

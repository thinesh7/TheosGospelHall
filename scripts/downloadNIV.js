/**
 * downloadNIV.js
 * Downloads the NIV Bible translation from bolls.life and writes one
 * JSON file per book to assets/bible/NIV_{bookId}.json, matching the
 * format used by the existing TAMOVR/TAMBL98/ERV/KJV data.
 *
 * Usage: node scripts/downloadNIV.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const VERSION = 'NIV';
const dir = path.join(__dirname, '..', 'assets', 'bible');

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

// NIV verse text uses <br/> for two unrelated things with no structural marker
// to tell them apart: (1) an editorial section heading / structural label
// ("The Beginning", "BOOK I", "Psalm 90") glued onto the first verse of a
// section, and (2) poetic line breaks within a single verse. Stripping every
// leading segment as a "heading" is destructive (it deletes real verse text
// like Psalm 5:10 "Declare them guilty, O God!"); keeping every <br/> as a
// space is non-destructive but leaves headings glued onto verses ("The
// Beginning In the beginning God created..."). This classifier distinguishes
// them: a heading/label is a short, title-cased phrase with no trailing
// punctuation, followed by a segment that starts a new capitalized clause.
// Verified against the full NIV dataset (31,086 verses) before being trusted —
// see the conversation history / project memory for the audit method.
function isHeadingSegment(segmentText, restOfTextJoined) {
  const trimmed = segmentText.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  // Headings/labels never end with punctuation (they're noun phrases, not
  // sentences) — a poetic line or psalm superscription ending in ".", "!",
  // "?", ",", ";", ":" etc. is real verse content, not a label.
  if (/[.,;:!?—-]\s*$/.test(trimmed)) return false;

  const restFirstChar = restOfTextJoined.trim().replace(/^["'“‘\s]+/, '').charAt(0);
  const restStartsLower = !!restFirstChar && restFirstChar === restFirstChar.toLowerCase() && restFirstChar !== restFirstChar.toUpperCase();
  if (restStartsLower) return false; // poetry continuing mid-clause, not a new section

  if (words.length > 10) return false;

  // Judge capitalization only on words containing letters, so numeric labels
  // like "Psalms 1–41" or "Psalm 90" aren't dragged below threshold by "1–41".
  const alphaWords = words.filter(w => /[A-Za-z]/.test(w));
  if (alphaWords.length === 0) return false;
  const capCount = alphaWords.filter(w => {
    const ch = w.replace(/^[^A-Za-z]+/, '').charAt(0);
    return ch && ch === ch.toUpperCase() && ch !== ch.toLowerCase();
  }).length;

  return (capCount / alphaWords.length) >= 0.6;
}

function cleanVerseText(rawText) {
  if (!rawText.includes('<br')) return rawText.replace(/\s+/g, ' ').trim();
  const segments = rawText.split(/<br\s*\/?>/i);
  let i = 0;
  // Strip consecutive leading heading/label segments (handles stacked cases
  // like "BOOK I<br/>Psalms 1-41<br/>Psalm 1<br/>Blessed is..."), stopping at
  // the first segment that reads as real verse/superscription text.
  while (i < segments.length - 1 && isHeadingSegment(segments[i], segments.slice(i + 1).join(' '))) {
    i++;
  }
  return segments.slice(i).join(' ').replace(/\s+/g, ' ').trim();
}

function fetchChapter(version, bookId, chapter) {
  return new Promise((resolve, reject) => {
    const url = `https://bolls.life/get-chapter/${version}/${bookId}/${chapter}/`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const verses = parsed
            .filter(v => v.verse && v.text)
            .map(v => ({
              verse: typeof v.verse === 'string' ? parseInt(v.verse) : v.verse,
              text: cleanVerseText(v.text),
            }));
          resolve(verses);
        } catch (e) {
          reject(new Error(`Parse error ${version} ${bookId}:${chapter} — ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function downloadBook(bookId, totalChapters) {
  const filePath = path.join(dir, `${VERSION}_${bookId}.json`);
  const bookData = {};

  for (let ch = 1; ch <= totalChapters; ch++) {
    process.stdout.write(`  ${VERSION} book ${bookId}: chapter ${ch}/${totalChapters}\r`);
    try {
      bookData[String(ch)] = await fetchChapter(VERSION, bookId, ch);
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error(`\n  ❌ ${VERSION} ${bookId}:${ch} — ${e.message}`);
      bookData[String(ch)] = [];
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(bookData), 'utf8');
  console.log(`  ✅ ${VERSION}_${bookId}.json saved`);
}

async function main() {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  console.log(`📖 Downloading ${VERSION}...\n`);
  for (const book of BOOKS) {
    await downloadBook(book.id, book.chapters);
  }
  console.log('\n🎉 NIV download complete!');
}

main().catch(console.error);

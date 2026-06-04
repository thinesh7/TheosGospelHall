const fs = require('fs');
const path = require('path');
const https = require('https');

const BOOKS = [
  {id:1,chapters:50},{id:2,chapters:40},{id:3,chapters:27},{id:4,chapters:36},{id:5,chapters:34},
  {id:6,chapters:24},{id:7,chapters:21},{id:8,chapters:4},{id:9,chapters:31},{id:10,chapters:24},
  {id:11,chapters:22},{id:12,chapters:25},{id:13,chapters:29},{id:14,chapters:36},{id:15,chapters:10},
  {id:16,chapters:13},{id:17,chapters:10},{id:18,chapters:42},{id:19,chapters:150},{id:20,chapters:31},
  {id:21,chapters:12},{id:22,chapters:8},{id:23,chapters:66},{id:24,chapters:52},{id:25,chapters:5},
  {id:26,chapters:48},{id:27,chapters:12},{id:28,chapters:14},{id:29,chapters:3},{id:30,chapters:9},
  {id:31,chapters:1},{id:32,chapters:4},{id:33,chapters:7},{id:34,chapters:3},{id:35,chapters:3},
  {id:36,chapters:3},{id:37,chapters:2},{id:38,chapters:14},{id:39,chapters:4},{id:40,chapters:28},
  {id:41,chapters:16},{id:42,chapters:24},{id:43,chapters:21},{id:44,chapters:28},{id:45,chapters:16},
  {id:46,chapters:16},{id:47,chapters:13},{id:48,chapters:6},{id:49,chapters:6},{id:50,chapters:4},
  {id:51,chapters:4},{id:52,chapters:5},{id:53,chapters:3},{id:54,chapters:6},{id:55,chapters:4},
  {id:56,chapters:3},{id:57,chapters:1},{id:58,chapters:13},{id:59,chapters:5},{id:60,chapters:5},
  {id:61,chapters:3},{id:62,chapters:5},{id:63,chapters:1},{id:64,chapters:1},{id:65,chapters:1},
  {id:66,chapters:22}
];

const VERSIONS = ['TAMOVR', 'TAMBL98', 'ERV', 'KJV'];
const dir = path.join(__dirname, '../assets/bible');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function download() {
  for (const version of VERSIONS) {
    console.log(`\n📖 Downloading ${version}...`);
    for (const book of BOOKS) {
      const bookData = {};
      for (let ch = 1; ch <= book.chapters; ch++) {
        try {
          const data = await fetchJSON(`https://bolls.life/get-chapter/${version}/${book.id}/${ch}/`);
          bookData[String(ch)] = data;
          process.stdout.write('.');
        } catch(e) {
          process.stdout.write('x');
        }
      }
      const filePath = path.join(dir, `${version}_${book.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(bookData));
      console.log(` ✅ Book ${book.id} done`);
    }
    console.log(`\n✅ ${version} complete!`);
  }
  console.log('\n🎉 All Bible data downloaded!');
}

download();
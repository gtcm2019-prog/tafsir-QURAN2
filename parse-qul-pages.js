#!/usr/bin/env node

/**
 * PARSEUR QUL PAGES (604)
 * Extrait le mapping page ↔ verse_key
 */

const fs = require('fs');
const path = require('path');

function parseQULPages(pagesDir) {
  console.log('📖 Parsing QUL pages (1-604)...\n');
  
  const pageVerseMap = {}; // page -> [verse_keys]
  const versePageMap = {}; // verse_key -> page
  
  let pagesProcessed = 0;
  let versesExtracted = 0;
  
  // Lire les 604 fichiers
  for (let pageNum = 1; pageNum <= 604; pageNum++) {
    const fileName = String(pageNum).padStart(3, '0') + '.json';
    const filePath = path.join(pagesDir, fileName);
    
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Page ${pageNum} not found`);
        continue;
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const pageData = JSON.parse(fileContent);
      
      const verseKeys = new Set();
      
      // Extraire tous les verse_keys de cette page
      if (pageData.lines) {
        for (const line of pageData.lines) {
          if (line.words) {
            for (const word of line.words) {
              if (word.verse_key) {
                verseKeys.add(word.verse_key);
                versePageMap[word.verse_key] = pageNum;
              }
            }
          }
        }
      }
      
      if (verseKeys.size > 0) {
        pageVerseMap[pageNum] = Array.from(verseKeys);
        versesExtracted += verseKeys.size;
        pagesProcessed++;
      }
      
      // Progress
      if (pageNum % 100 === 0) {
        console.log(`✓ Processed pages: ${pageNum}/604`);
      }
      
    } catch (error) {
      console.error(`❌ Error parsing page ${pageNum}:`, error.message);
    }
  }
  
  console.log(`\n✅ EXTRACTION COMPLETE!`);
  console.log(`   Pages processed: ${pagesProcessed}`);
  console.log(`   Verses extracted: ${versesExtracted}`);
  console.log(`   Unique verse keys: ${Object.keys(versePageMap).length}\n`);
  
  return { pageVerseMap, versePageMap };
}

function generateSQL(versePageMap) {
  console.log('📝 Generating SQL...\n');
  
  // Ajouter colonne page_mushaf si elle n'existe pas
  let sql = `-- =====================================================================
-- ADD PAGE NUMBERS TO AYAHS (MUSHAF MEDANI)
-- =====================================================================

-- Ajouter colonne si elle n'existe pas
ALTER TABLE ayahs ADD COLUMN IF NOT EXISTS page_mushaf SMALLINT;

-- Créer index
CREATE INDEX IF NOT EXISTS idx_ayahs_page ON ayahs(page_mushaf);

-- =====================================================================
-- UPDATE PAGES (from QUL)
-- =====================================================================

BEGIN;

`;
  
  // Générer les UPDATEs
  let updateCount = 0;
  for (const [verseKey, pageNum] of Object.entries(versePageMap)) {
    const [surahNum, ayahNum] = verseKey.split(':').map(Number);
    
    sql += `UPDATE ayahs SET page_mushaf = ${pageNum} WHERE surah_number = ${surahNum} AND ayah_number = ${ayahNum};\n`;
    updateCount++;
  }
  
  sql += `\nCOMMIT;\n\n`;
  sql += `-- =====================================================================\n`;
  sql += `-- VERIFICATION\n`;
  sql += `-- =====================================================================\n\n`;
  sql += `-- SELECT COUNT(*) FROM ayahs WHERE page_mushaf IS NOT NULL;\n`;
  sql += `-- Résultat doit être: 6236\n\n`;
  sql += `-- SELECT DISTINCT page_mushaf FROM ayahs ORDER BY page_mushaf;\n`;
  sql += `-- Résultat doit être: 1-604\n`;
  
  console.log(`✅ SQL Generated!`);
  console.log(`   Updates: ${updateCount}\n`);
  
  return sql;
}

// MAIN
const pagesDir = process.argv[2] || '/Téléchargement/pages';

if (!fs.existsSync(pagesDir)) {
  console.error(`❌ Directory not found: ${pagesDir}`);
  console.log('\nUsage: node parse-qul-pages.js /path/to/pages');
  process.exit(1);
}

const { pageVerseMap, versePageMap } = parseQULPages(pagesDir);
const sqlScript = generateSQL(versePageMap);

// Sauvegarder SQL
const outputFile = '/home/claude/add-pages-mushaf.sql';
fs.writeFileSync(outputFile, sqlScript, 'utf8');

console.log(`📁 Saved to: ${outputFile}`);
console.log(`📦 File size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB\n`);

// Stats
const pagesWithContent = Object.keys(pageVerseMap).length;
console.log(`📊 STATS:`);
console.log(`   Pages with verses: ${pagesWithContent}/604`);
console.log(`   Total verse mappings: ${Object.keys(versePageMap).length}`);
console.log(`   Expected: 6236\n`);

console.log(`✨ Ready for Supabase import!`);

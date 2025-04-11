const fs = require('fs');

// Read the JSON file
const wikiData = require('/Users/krempovych/Documents/roo/root/checkbox_wiki_scrape.json');

// Create output directory if it doesn't exist
const outputDir = './wiki_docs';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Process each document
wikiData.forEach((doc, index) => {
  if (doc.success && doc.markdown) {
    // Create a sanitized filename from the URL
    const filename = doc.url
      .replace(/https?:\/\//, '')
      .replace(/\//g, '_')
      .replace(/\s+/g, '_')
      .replace(/[^\w.-]/g, '_');
    
    // Write markdown content to file
    fs.writeFileSync(`${outputDir}/${filename}.md`, doc.markdown);
    console.log(`Created file: ${filename}.md`);
  } else {
    console.log(`Skipping document ${index}: No content or unsuccessful scrape`);
  }
});

console.log('Extraction complete!');

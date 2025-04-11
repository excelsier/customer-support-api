const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const ACCOUNT_ID = 'ced558f4eac9172b07993051961ac91e';
const API_TOKEN = 'd8WD_2cCQ3KjQQ5xvUFp3PUWqWdx_wNg5skySkfx';
const AUTORAG_NAME = 'sweet-glitter-e320';
const DOCS_DIR = './wiki_docs';

// Function to upload file directly to AutoRAG
function uploadFileToAutoRAG(filePath, fileName) {
  const fullPath = path.resolve(filePath);
  
  console.log(`Uploading ${fileName} to AutoRAG instance ${AUTORAG_NAME}...`);
  
  try {
    // Read file content
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Create temporary JSON file for the upload
    const tempJson = {
      content: content,
      metadata: {
        filename: fileName,
        source: "Checkbox Wiki Documentation",
        language: "uk"  // Ukrainian language code
      }
    };
    
    const tempJsonPath = `/tmp/${fileName}.json`;
    fs.writeFileSync(tempJsonPath, JSON.stringify(tempJson));
    
    // Upload using curl
    const command = `curl -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/autorag/rags/${AUTORAG_NAME}/data" \\
      -H "Authorization: Bearer ${API_TOKEN}" \\
      -H "Content-Type: application/json" \\
      -d @${tempJsonPath}`;
    
    const result = execSync(command, { encoding: 'utf8' });
    console.log(`Successfully uploaded ${fileName} to AutoRAG`);
    console.log(result);
    
    // Clean up temp file
    fs.unlinkSync(tempJsonPath);
    return true;
  } catch (error) {
    console.error(`Error uploading ${fileName}:`, error.message);
    return false;
  }
}

// Process all markdown files in the directory
function uploadAllFiles() {
  const files = fs.readdirSync(DOCS_DIR).filter(file => file.endsWith('.md'));
  
  console.log(`Found ${files.length} markdown files to upload directly to AutoRAG.`);
  
  let successCount = 0;
  
  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file);
    if (uploadFileToAutoRAG(filePath, file)) {
      successCount++;
    }
  }
  
  console.log(`Upload complete: ${successCount}/${files.length} files uploaded successfully.`);
}

// Start the upload process
uploadAllFiles();

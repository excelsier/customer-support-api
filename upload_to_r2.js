const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const ACCOUNT_ID = 'ced558f4eac9172b07993051961ac91e';
const API_TOKEN = 'd8WD_2cCQ3KjQQ5xvUFp3PUWqWdx_wNg5skySkfx';
const BUCKET_NAME = 'test'; // The bucket associated with your AutoRAG instance
const DOCS_DIR = './wiki_docs';

// Function to upload a file to R2 using curl
function uploadFileToR2(filePath, fileName) {
  const fullPath = path.resolve(filePath);
  const contentType = 'text/markdown';
  
  console.log(`Uploading ${fileName} to R2 bucket ${BUCKET_NAME}...`);
  
  try {
    // Using Buffer for the file data instead of @file syntax to avoid path escaping issues
    const fileData = fs.readFileSync(fullPath);
    
    // Write to a temporary file without spaces in the path
    const tempPath = `/tmp/${fileName}`;
    fs.writeFileSync(tempPath, fileData);
    
    const command = `curl -X PUT "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET_NAME}/objects/${fileName}" \
      -H "Authorization: Bearer ${API_TOKEN}" \
      -H "Content-Type: ${contentType}" \
      --data-binary @${tempPath}`;
    
    const result = execSync(command, { encoding: 'utf8' });
    console.log(`Successfully uploaded ${fileName}`);
    console.log(result);
    
    // Clean up temp file
    fs.unlinkSync(tempPath);
    return true;
  } catch (error) {
    console.error(`Error uploading ${fileName}:`, error.message);
    return false;
  }
}

// Process all markdown files in the directory
function uploadAllFiles() {
  const files = fs.readdirSync(DOCS_DIR).filter(file => file.endsWith('.md'));
  
  console.log(`Found ${files.length} markdown files to upload.`);
  
  let successCount = 0;
  
  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file);
    if (uploadFileToR2(filePath, file)) {
      successCount++;
    }
  }
  
  console.log(`Upload complete: ${successCount}/${files.length} files uploaded successfully.`);
}

// Start the upload process
uploadAllFiles();

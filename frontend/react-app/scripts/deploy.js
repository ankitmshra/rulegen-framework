/**
 * Deployment script for copying React build to Django static folder
 * Adapted for Docker environment
 */

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

// Source and target directories
const BUILD_DIR = path.resolve(__dirname, '../build');
const TARGET_DIR = process.env.DEPLOY_DIR || path.resolve(__dirname, '../../deploy');

// Check if build directory exists
if (!fs.existsSync(BUILD_DIR)) {
  console.error('Build directory does not exist. Run `npm run build` first.');
  process.exit(1);
}

// Create target directory if it doesn't exist
if (!fs.existsSync(path.dirname(TARGET_DIR))) {
  fs.mkdirSync(path.dirname(TARGET_DIR), { recursive: true });
}

// Clean target directory
if (fs.existsSync(TARGET_DIR)) {
  console.log(`Cleaning target directory: ${TARGET_DIR}`);
  rimraf.sync(TARGET_DIR);
}

// Create target directory
fs.mkdirSync(TARGET_DIR, { recursive: true });

/**
 * Copy directory recursively
 * @param {string} source - Source directory
 * @param {string} target - Target directory
 */
function copyDirectory(source, target) {
  // Create target directory
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  // Copy files
  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// Copy build files to target directory
console.log(`Copying build files from ${BUILD_DIR} to ${TARGET_DIR}`);
copyDirectory(BUILD_DIR, TARGET_DIR);

// Update asset manifest if needed
const manifestPath = path.join(TARGET_DIR, 'asset-manifest.json');
if (fs.existsSync(manifestPath)) {
  console.log('Updating asset manifest for Django compatibility');
  
  const manifest = require(manifestPath);
  
  // Process the manifest
  let updatedManifest = JSON.stringify(manifest, null, 2);
  
  // Write updated manifest
  fs.writeFileSync(manifestPath, updatedManifest);
}

console.log('Deployment complete! React app has been successfully copied to Django static folder.');

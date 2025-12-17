import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to copy to docs
const ASSET_DIRS = ['Music', 'Videos', 'ElizaOS Stickers', 'Brand Kit'];
const DIST_DIR = path.join(__dirname, 'docs');

// Recursively copy directory
async function copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

// Copy all asset directories to docs
async function copyAssets() {
    console.log('Copying assets to docs folder...');
    
    for (const dir of ASSET_DIRS) {
        const srcPath = path.join(__dirname, dir);
        const destPath = path.join(DIST_DIR, dir);
        
        try {
            await fs.access(srcPath);
            console.log(`Copying ${dir}...`);
            await copyDirectory(srcPath, destPath);
            console.log(`✓ ${dir} copied successfully`);
        } catch (error) {
            console.warn(`Directory ${dir} not found, skipping...`);
        }
    }
    
    // Copy About page files
    try {
        const aboutHtml = path.join(__dirname, 'about.html');
        const aboutJs = path.join(__dirname, 'about.js');
        
        if (await fs.access(aboutHtml).then(() => true).catch(() => false)) {
            await fs.copyFile(aboutHtml, path.join(DIST_DIR, 'about.html'));
            console.log('✓ about.html copied');
        }
        if (await fs.access(aboutJs).then(() => true).catch(() => false)) {
            await fs.copyFile(aboutJs, path.join(DIST_DIR, 'about.js'));
            console.log('✓ about.js copied');
        }
    } catch (error) {
        console.warn('Error copying About page files:', error.message);
    }
    
    console.log('Assets copied to docs folder!');
}

copyAssets().catch(console.error);

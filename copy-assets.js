import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to copy to docs
const ASSET_DIRS = ['Music', 'Videos', 'ElizaOS Stickers', 'Brand Kit', 'ElizaOS Art'];
const DIST_DIR = path.join(__dirname, 'docs');
const THUMBNAILS_DIR = path.join(__dirname, 'thumbnails');

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
    
    // Copy manifest.json from public directory to docs
    try {
        const manifestSrc = path.join(__dirname, 'public', 'manifest.json');
        const manifestDest = path.join(DIST_DIR, 'manifest.json');
        
        if (await fs.access(manifestSrc).then(() => true).catch(() => false)) {
            await fs.copyFile(manifestSrc, manifestDest);
            console.log('✓ manifest.json copied');
        } else {
            console.warn('⚠ manifest.json not found in public directory');
        }
    } catch (error) {
        console.warn('Error copying manifest.json:', error.message);
    }
    
    // Copy thumbnails directory if it exists
    try {
        await fs.access(THUMBNAILS_DIR);
        const thumbnailsDest = path.join(DIST_DIR, 'thumbnails');
        console.log('Copying thumbnails...');
        await copyDirectory(THUMBNAILS_DIR, thumbnailsDest);
        console.log('✓ Thumbnails copied successfully');
    } catch (error) {
        console.warn('Thumbnails directory not found, skipping...');
    }
    
    // Create .nojekyll file to disable Jekyll processing on GitHub Pages
    try {
        const nojekyllPath = path.join(DIST_DIR, '.nojekyll');
        await fs.writeFile(nojekyllPath, '');
        console.log('✓ .nojekyll file created');
    } catch (error) {
        console.warn('Error creating .nojekyll file:', error.message);
    }
    
    console.log('Assets copied to docs folder!');
}

copyAssets().catch(console.error);




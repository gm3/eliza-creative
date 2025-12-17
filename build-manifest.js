import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to include in the manifest
const ASSET_DIRS = ['Music', 'Videos', 'ElizaOS Stickers'];

// Recursively scan directory and build file tree
async function scanDirectory(dirPath, basePath = '') {
    const items = [];
    
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/');
            
            if (entry.isDirectory()) {
                const children = await scanDirectory(fullPath, relativePath);
                items.push({
                    name: entry.name,
                    type: 'directory',
                    path: '/' + relativePath,
                    children: children
                });
            } else {
                items.push({
                    name: entry.name,
                    type: 'file',
                    path: '/' + relativePath
                });
            }
        }
    } catch (error) {
        console.error(`Error scanning ${dirPath}:`, error.message);
    }
    
    return items.sort((a, b) => {
        // Directories first, then files, then alphabetically
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
    });
}

// Build manifest for all asset directories
async function buildManifest() {
    console.log('Building file manifest...');
    
    const manifest = {};
    
    for (const dir of ASSET_DIRS) {
        const dirPath = path.join(__dirname, dir);
        try {
            await fs.access(dirPath);
            console.log(`Scanning ${dir}...`);
            manifest[dir] = await scanDirectory(dirPath, dir);
        } catch (error) {
            console.warn(`Directory ${dir} not found, skipping...`);
        }
    }
    
    // Also include root level files
    try {
        const rootEntries = await fs.readdir(__dirname, { withFileTypes: true });
        const rootFiles = rootEntries
            .filter(entry => entry.isFile() && 
                ['.mp3', '.mp4', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(
                    path.extname(entry.name).toLowerCase()
                ))
            .map(entry => ({
                name: entry.name,
                type: 'file',
                path: '/' + entry.name
            }));
        
        if (rootFiles.length > 0) {
            manifest['.'] = rootFiles;
        }
    } catch (error) {
        console.warn('Error scanning root directory:', error.message);
    }
    
    // Write manifest to public directory (for Vite)
    const publicDir = path.join(__dirname, 'public');
    await fs.mkdir(publicDir, { recursive: true });
    
    const manifestPath = path.join(publicDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`Manifest written to ${manifestPath}`);
    console.log(`Total directories: ${Object.keys(manifest).length}`);
    
    // Also write to root for reference
    const rootManifestPath = path.join(__dirname, 'manifest.json');
    await fs.writeFile(rootManifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Manifest also written to ${rootManifestPath}`);
}

buildManifest().catch(console.error);

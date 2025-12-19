import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to process
const ASSET_DIRS = ['Music', 'Videos', 'ElizaOS Stickers', 'Brand Kit', 'ElizaOS Art'];
const THUMBNAIL_SIZE = 400; // Max width/height for thumbnails
const THUMBNAIL_QUALITY = 80; // JPEG quality (1-100)

// Recursively find all image files
async function findImages(dirPath, basePath = '') {
    const images = [];
    
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/');
            
            if (entry.isDirectory()) {
                const subImages = await findImages(fullPath, relativePath);
                images.push(...subImages);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                    images.push({
                        fullPath,
                        relativePath: '/' + relativePath,
                        name: entry.name
                    });
                }
            }
        }
    } catch (error) {
        console.warn(`Error scanning ${dirPath}:`, error.message);
    }
    
    return images;
}

// Generate thumbnail for an image
async function generateThumbnail(imagePath, outputPath) {
    try {
        // Check if thumbnail already exists and is newer than source
        try {
            const sourceStats = await fs.stat(imagePath);
            const thumbStats = await fs.stat(outputPath);
            if (thumbStats.mtime > sourceStats.mtime) {
                return true; // Thumbnail is up to date, skip
            }
        } catch {
            // Thumbnail doesn't exist, need to create it
        }
        
        // Generate optimized JPEG thumbnail (much smaller file size)
        await sharp(imagePath)
            .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ 
                quality: THUMBNAIL_QUALITY,
                mozjpeg: true // Better compression
            })
            .toFile(outputPath);
        return true;
    } catch (error) {
        console.warn(`Failed to generate thumbnail for ${imagePath}:`, error.message);
        return false;
    }
}

// Main function
async function generateThumbnails() {
    console.log('Generating thumbnails for images...');
    
    const thumbnailsDir = path.join(__dirname, 'thumbnails');
    await fs.mkdir(thumbnailsDir, { recursive: true });
    
    let totalImages = 0;
    let processedImages = 0;
    
    for (const dir of ASSET_DIRS) {
        const dirPath = path.join(__dirname, dir);
        try {
            await fs.access(dirPath);
            console.log(`Processing ${dir}...`);
            
            const images = await findImages(dirPath, dir);
            totalImages += images.length;
            
            for (const image of images) {
                // Create thumbnail path (preserve directory structure, convert to .jpg)
                const ext = path.extname(image.relativePath);
                const thumbnailPath = path.join(thumbnailsDir, image.relativePath.replace(ext, '.jpg'));
                const thumbnailDir = path.dirname(thumbnailPath);
                await fs.mkdir(thumbnailDir, { recursive: true });
                
                const success = await generateThumbnail(image.fullPath, thumbnailPath);
                if (success) {
                    processedImages++;
                    if (processedImages % 10 === 0) {
                        console.log(`  Processed ${processedImages} images...`);
                    }
                }
            }
        } catch (error) {
            console.warn(`Directory ${dir} not found, skipping...`);
        }
    }
    
    console.log(`✓ Generated ${processedImages} thumbnails out of ${totalImages} images`);
    console.log(`Thumbnails saved to: ${thumbnailsDir}`);
}

generateThumbnails().catch(console.error);



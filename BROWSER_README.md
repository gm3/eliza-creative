# ElizaOS Creative Asset Browser - Development Guide

A dark-mode, sleek frontend application for exploring and managing the ElizaOS Creative Asset Library. This browser dynamically loads assets from a generated manifest and provides an intuitive interface for browsing music, videos, images, and other creative assets.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation
```bash
npm install
```

⚡ **Thumbnails are automatically generated during installation!** This may take a few minutes if you have many images, as it processes all images in your asset directories.

### Development
```bash
npm run dev
```
This will:
1. Generate/update the `manifest.json` file by scanning asset directories
2. Start the Vite development server (usually at `http://localhost:5173`)
3. Automatically reload when you make code changes

### Building for Production
```bash
npm run build
```
This will:
1. Generate/update the `manifest.json` file
2. **Generate thumbnails** for all images (if not already up-to-date)
3. Build the application with Vite (outputs to `/docs`)
4. Copy all asset directories and thumbnails to `/docs`
5. Copy `manifest.json` to `/docs`
6. Create `.nojekyll` file for GitHub Pages

### Preview Production Build
```bash
npm run preview
```
Preview the production build locally before deploying.

### Regenerate Manifest Only
```bash
npm run manifest
```
Manually regenerate the `manifest.json` file without building.

### Regenerate Thumbnails
```bash
npm run thumbnails
```
Manually regenerate thumbnails for all images. Useful after adding new images or if thumbnails are outdated.

---

## 📁 Project Structure

```
eliza-creative/
├── index.html              # Main HTML entry point
├── app.js                  # Frontend JavaScript (SPA logic, file tree, asset preview)
├── styles.css              # Dark mode styling
├── about.html              # About page content
├── about.js                # About page animations
├── build-manifest.js       # Script to generate manifest.json from asset directories
├── generate-thumbnails.js  # Script to generate image thumbnails
├── copy-assets.js          # Script to copy assets to /docs after build
├── vite.config.js          # Vite build configuration
├── thumbnails/             # Generated thumbnails directory (gitignored)
├── public/
│   └── manifest.json       # Generated file manifest (gitignored)
├── docs/                   # Build output (for GitHub Pages)
│   ├── index.html
│   ├── assets/
│   ├── manifest.json
│   ├── Music/
│   ├── Videos/
│   ├── ElizaOS Stickers/
│   └── Brand Kit/
└── [Asset Directories]     # Music/, Videos/, etc.
```

---

## 🔄 How It Works

### Dynamic Asset Loading

The browser uses a **manifest-based system** to dynamically load and display assets:

1. **Manifest Generation** (`build-manifest.js`):
   - Scans asset directories: `Music/`, `Videos/`, `ElizaOS Stickers/`, `Brand Kit/`
   - Recursively builds a JSON tree structure
   - Writes `manifest.json` to `public/` directory

2. **Frontend Loading** (`app.js`):
   - Fetches `manifest.json` on page load
   - Dynamically renders file tree in left panel
   - Renders asset previews/bento grid in main panel
   - No hardcoded file lists - everything is data-driven

3. **Asset Display**:
   - **File Tree**: Hierarchical folder structure with expand/collapse
   - **Bento Grid**: Visual grid layout for images and videos
   - **Audio List**: Compact list view for music folders with integrated player
   - **Search**: Live filtering across all assets by name and path

### Adding New Assets

**The system automatically detects new assets** - just follow these steps:

1. **Add your files** to the appropriate directory:
   - Music files → `Music/` (or subfolders)
   - Videos → `Videos/`
   - Images → `ElizaOS Stickers/` (or create new folder)
   - Brand assets → `Brand Kit/`

2. **For local development:**
   ```bash
   npm run dev
   ```
   The manifest regenerates automatically. Refresh your browser to see new assets.

3. **For production (GitHub Pages):**
   ```bash
   npm run build
   git add .
   git commit -m "Add new assets"
   git push
   ```
   The build process will:
   - Regenerate manifest with new files
   - Copy new assets to `/docs`
   - Update `docs/manifest.json`

### Adding New Asset Directories

If you create a new top-level directory (e.g., `Art/`, `Fonts/`), update `build-manifest.js`:

```javascript
const ASSET_DIRS = ['Music', 'Videos', 'ElizaOS Stickers', 'Brand Kit', 'Art'];
```

Then rebuild:
```bash
npm run build
```

---

## 🎨 Features

### File Browser (Left Panel)
- Hierarchical folder tree
- Expand/collapse folders
- Click folders to view contents in bento grid
- Click files to preview

### Asset Preview (Main Panel)
- **Images**: Full preview with download button overlay
- **Videos**: Playback with hover-to-play in grid, download button
- **Audio**: Integrated music player with playlist, controls, volume
- **Search**: Live search with results in bento view

### Music Player
- Playlist of all audio files in current folder
- Play/pause, previous/next track
- Seek bar with time display
- Volume control (slider + mute)
- Download current track
- Click any audio item to jump to that track

### View Modes
- **Bento Grid**: Visual cards for images/videos
- **Audio List**: Compact horizontal list for music
- **Preview**: Individual asset view
- Automatically switches based on folder content

### Navigation
- **Browser**: Default file browser view
- **About**: Information about the site
- **Brand Kit**: Brand guidelines and assets (loads dynamically)
- **Back Button**: Returns to previous folder/view when previewing assets

### Performance Optimizations
- **Thumbnails**: Automatic generation of optimized image thumbnails
- **Lazy Loading**: Images load only when entering viewport
- **Pagination**: Initial load limited to 30 items, "Load More" for additional items
- **Event Delegation**: Efficient event handling for large grids
- **Video Thumbnails**: First frame automatically loads for video previews

---

## 🛠️ Development Workflow

### Making Code Changes

1. **Edit files** (`app.js`, `styles.css`, `index.html`, etc.)
2. **Development server** automatically reloads (via Vite HMR)
3. **Test locally** at `http://localhost:3000`

### Adding New Features

1. **Frontend logic**: Edit `app.js`
2. **Styling**: Edit `styles.css`
3. **HTML structure**: Edit `index.html`
4. **Animations**: Uses Motion.dev library (already imported)

### Testing Production Build

1. Run `npm run build`
2. Run `npm run preview`
3. Test at the preview URL
4. Check `/docs` folder to verify all assets copied correctly

---

## 📦 Deployment (GitHub Pages)

### Setup
1. Repository settings → Pages
2. Source: Deploy from a branch
3. Branch: `main` (or `master`)
4. Folder: `/docs`

### Deployment Process

1. **Make changes** (code or assets)
2. **Build**:
   ```bash
   npm run build
   ```
3. **Commit and push**:
   ```bash
   git add .
   git commit -m "Update assets and rebuild"
   git push
   ```
4. **GitHub Pages** automatically deploys from `/docs` folder
5. Site available at: `https://[username].github.io/eliza-creative/`

### Important Notes

- **Base Path**: Configured as `/eliza-creative/` in `vite.config.js`
- **Manifest**: Must be in `/docs/manifest.json` (handled by build)
- **Assets**: All asset directories copied to `/docs` during build
- **Jekyll**: Disabled via `.nojekyll` file (auto-created)

---

## 🔧 Configuration

### Vite Config (`vite.config.js`)
- **Base path**: `/eliza-creative/` (for GitHub Pages)
- **Output**: `docs/` directory
- **Public dir**: `public/` (manifest.json location)

### Manifest Generation (`build-manifest.js`)
- **Scanned directories**: `ASSET_DIRS` array
- **Output**: `public/manifest.json` and root `manifest.json`
- **File types**: Automatically detects images, audio, video

### Thumbnail Generation (`generate-thumbnails.js`)
- **Scans**: All image files in asset directories (JPG, PNG, GIF, WebP)
- **Generates**: 400x400px JPEG thumbnails
- **Output**: `/thumbnails` directory (preserves folder structure)
- **Smart**: Skips images that already have up-to-date thumbnails

### Asset Copying (`copy-assets.js`)
- **Copies**: All asset directories to `/docs`
- **Also copies**: `thumbnails/`, `about.html`, `about.js`, `manifest.json`
- **Creates**: `.nojekyll` file

---

## 🐛 Troubleshooting

### Manifest not loading
- **Check**: `docs/manifest.json` exists after build
- **Verify**: `.gitignore` allows `!docs/manifest.json`
- **Rebuild**: Run `npm run build` again

### Assets not appearing
- **Regenerate manifest**: `npm run manifest`
- **Check directory**: Ensure files are in scanned directories
- **Rebuild**: `npm run build`

### Thumbnails not loading
- **Regenerate thumbnails**: `npm run thumbnails`
- **Check thumbnails directory**: Ensure `/thumbnails` exists and has files
- **Verify Sharp is installed**: `npm install sharp`
- **Check file permissions**: Ensure write access to create thumbnails

### 404 errors on GitHub Pages
- **Base path**: Verify `vite.config.js` has correct `base` setting
- **File paths**: Check browser console for actual requested URLs
- **Rebuild**: Ensure latest build is committed and pushed

### Development server issues
- **Port conflict**: Change port in `vite.config.js`
- **Manifest missing**: Run `npm run manifest` first
- **Clear cache**: Delete `node_modules/.vite` if needed

---

## 🖼️ Thumbnails

### Automatic Generation

Thumbnails are **automatically generated** when you run:
- `npm install` (via `postinstall` script)
- `npm run build` (before building)

### Manual Generation

To regenerate thumbnails manually:
```bash
npm run thumbnails
```

### Thumbnail Details

- **Size:** 400x400px maximum (maintains aspect ratio)
- **Format:** JPEG (80% quality) for consistency and smaller file sizes
- **Location:** `/thumbnails` directory (mirrors asset folder structure)
- **Performance:** Thumbnails are ~10-100x smaller than original images, dramatically improving page load times

### Performance Benefits

Using thumbnails provides significant performance improvements:

- **Faster Initial Load:** Only 30 small thumbnails load initially (vs. 30+ full-size images)
- **Reduced Memory Usage:** Thumbnails are 10-100x smaller, using much less RAM
- **Better Scrolling:** Lazy loading with Intersection Observer loads images as you scroll
- **Scalable:** Works efficiently with thousands of images

### Disabling Automatic Thumbnails

If you want to skip thumbnail generation during install:
1. Remove the `postinstall` script from `package.json`
2. Or use `npm install --ignore-scripts`

**Note:** Without thumbnails, the site will still work but will load full-size images, which may be slow with many images.

---

## 📝 Scripts Reference

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies and **automatically generate thumbnails** |
| `npm run dev` | Start development server (auto-regenerates manifest) |
| `npm run build` | Build for production (generates manifest, thumbnails, builds, copies assets) |
| `npm run build-no-thumbnails` | Build without regenerating thumbnails (faster) |
| `npm run preview` | Preview production build locally |
| `npm run manifest` | Regenerate manifest.json only |
| `npm run thumbnails` | Manually regenerate all thumbnails |

---

## 🎯 Key Concepts

- **Dynamic**: No hardcoded file lists - everything comes from manifest
- **SPA**: Single-page application - no full page reloads
- **Base Path Aware**: Handles GitHub Pages subdirectory correctly
- **Asset Types**: Automatically detects and handles images, audio, video
- **Responsive**: Adapts layout based on content type (bento vs list)

---

## 🤝 Contributing

When contributing to the browser:

1. **Follow existing patterns** in `app.js` and `styles.css`
2. **Test locally** with `npm run dev`
3. **Build before committing** to verify production build works
4. **Keep it simple** - prefer straightforward solutions
5. **Document changes** in code comments

---

## 📚 Dependencies

- **Vite**: Build tool and dev server
- **Motion.dev**: Animation library for smooth UI transitions
- **Sharp**: Image processing library for thumbnail generation

---

## 🔗 Related Files

- `README.md` - Main repository README (asset library overview)
- `package.json` - Project metadata and scripts
- `vite.config.js` - Build configuration
- `build-manifest.js` - Manifest generation script
- `generate-thumbnails.js` - Thumbnail generation script
- `copy-assets.js` - Asset copying script

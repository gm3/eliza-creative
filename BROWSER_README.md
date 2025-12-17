# ElizaOS Creative Asset Browser

A sleek, dark-mode frontend for browsing and previewing creative assets in the ElizaOS Creative Asset Library.

## Features

- 🎨 **Dark Mode UI** - Slim, sleek, modern design
- 📁 **File Browser** - Left panel with expandable folder tree
- 🎵 **Audio Preview** - Play MP3 and other audio files
- 🎬 **Video Preview** - Watch MP4 and other video files
- 🖼️ **Image Preview** - View JPG, PNG, and other image files
- 🚀 **Fast Navigation** - Quick access to all assets
- 📦 **GitHub Pages Ready** - Static build with Vite

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the manifest and start dev server:**
   ```bash
   npm run build
   npm run dev
   ```

3. **Open in browser:**
   Navigate to `http://localhost:3000`

## Development

The app uses Vite for development and building. The build process:
1. Scans your asset directories (`Music`, `Videos`, `ElizaOS Stickers`)
2. Generates a `manifest.json` file with the file structure
3. Builds the static site for deployment

### Build Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production (generates manifest + builds site)
- `npm run preview` - Preview production build locally

## Deployment to GitHub Pages

The repository includes a GitHub Actions workflow that automatically:
1. Builds the manifest from your asset directories
2. Builds the static site with Vite
3. Copies all asset files to the dist folder
4. Deploys to GitHub Pages

Just push to the `main` branch and the workflow will handle deployment.

### Manual Deployment

If you prefer to deploy manually:

1. Build the project:
   ```bash
   npm run build
   ```

2. Copy your asset directories to `dist/`:
   ```bash
   cp -r Music dist/
   cp -r Videos dist/
   cp -r "ElizaOS Stickers" dist/
   ```

3. Push the `dist` folder contents to the `gh-pages` branch

## File Structure

```
├── index.html          # Main HTML structure
├── styles.css          # Dark mode styling
├── app.js              # Frontend JavaScript logic
├── vite.config.js      # Vite configuration
├── build-manifest.js   # Script to generate file manifest
├── public/             # Public assets (manifest.json goes here)
└── package.json        # Dependencies
```

## Supported File Types

- **Audio:** MP3, WAV, OGG, M4A
- **Video:** MP4, WebM, MOV
- **Images:** JPG, JPEG, PNG, GIF, WebP

## How It Works

Instead of a backend API, the app uses a pre-generated `manifest.json` file that contains the complete file structure. This manifest is generated at build time by scanning your asset directories. The frontend loads this manifest and builds the file tree from it.

This approach works perfectly with GitHub Pages since it only serves static files - no server required!

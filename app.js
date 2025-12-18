// Import Motion.dev for animations
import { animate, stagger } from 'motion';

// State
let manifest = null;
let currentPath = '';
let currentView = 'preview'; // 'preview' or 'bento'
let allAssets = []; // Flat list of all assets for bento view
let currentFolderContext = null; // Current folder path for filtering bento view
let searchQuery = ''; // Current search query

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadManifest();
    renderRootDirectories();
    setupNavigation();
    setupSearch();
    animateInitialLoad();
});

// Get base path for GitHub Pages
// Use Vite's BASE_URL if available, otherwise detect from pathname
function getBasePath() {
    // Try to use Vite's BASE_URL first (available in built files)
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) {
        const base = import.meta.env.BASE_URL;
        return base === '/' ? '' : base.replace(/\/$/, ''); // Remove trailing slash
    }
    // Fallback: detect from pathname
    const pathname = window.location.pathname;
    if (pathname.includes('/eliza-creative/')) {
        return '/eliza-creative';
    }
    return '';
}

// Load manifest file
async function loadManifest() {
    try {
        const basePath = getBasePath();
        // Try to load manifest from public directory
        const response = await fetch(`${basePath}/manifest.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        manifest = await response.json();
        collectAllAssets(); // Collect assets after manifest loads
    } catch (error) {
        console.error('Error loading manifest:', error);
        const errorMsg = window.location.protocol === 'file:' 
            ? 'Please run "npm run dev" to start the development server. Opening HTML directly from file:// is not supported.'
            : 'Error loading file manifest. Make sure to run "npm run build" first to generate manifest.json';
        document.getElementById('file-tree').innerHTML = 
            `<div class="file-tree-item" style="color: #ff6b6b; padding: 20px;">${errorMsg}</div>`;
    }
}

// Collect all assets for bento view
function collectAllAssets() {
    allAssets = [];
    if (!manifest) return;
    
    function traverse(items, basePath = '') {
        items.forEach(item => {
            if (item.type === 'file') {
                const ext = item.name.split('.').pop().toLowerCase();
                if (['mp3', 'wav', 'ogg', 'm4a', 'mp4', 'webm', 'mov', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                    allAssets.push({
                        ...item,
                        category: getCategoryFromPath(item.path)
                    });
                }
            } else if (item.type === 'directory' && item.children) {
                traverse(item.children, item.path);
            }
        });
    }
    
    Object.keys(manifest).forEach(key => {
        if (key !== '.') {
            traverse(manifest[key]);
        }
    });
}

function getCategoryFromPath(path) {
    if (path.includes('Music')) return 'Music';
    if (path.includes('Videos')) return 'Videos';
    if (path.includes('ElizaOS Stickers')) return 'Stickers';
    if (path.includes('Brand Kit')) return 'Brand Kit';
    return 'Other';
}



// Get assets from a specific folder path
function getAssetsFromFolder(folderPath) {
    if (!folderPath || folderPath === '') {
        return allAssets; // Return all assets if no folder context
    }
    
    // Normalize paths for comparison
    const folderPathClean = folderPath.startsWith('/') ? folderPath.substring(1) : folderPath;
    const folderPathNormalized = folderPathClean.replace(/\\/g, '/');
    
    // Filter assets that belong to the current folder or its subfolders
    return allAssets.filter(asset => {
        const assetPath = asset.path.startsWith('/') ? asset.path.substring(1) : asset.path;
        const assetPathNormalized = assetPath.replace(/\\/g, '/');
        
        // Check if asset is directly in this folder or in a subfolder
        return assetPathNormalized.startsWith(folderPathNormalized + '/') || 
               assetPathNormalized === folderPathNormalized;
    });
}

// Filter assets by search query
function filterAssetsBySearch(assets, query) {
    if (!query || query.trim() === '') {
        return assets;
    }
    
    const searchLower = query.toLowerCase().trim();
    return assets.filter(asset => {
        const nameLower = asset.name.toLowerCase();
        const pathLower = asset.path.toLowerCase();
        return nameLower.includes(searchLower) || pathLower.includes(searchLower);
    });
}

// Render bento grid
function renderBentoGrid() {
    const previewContainer = document.getElementById('asset-preview');
    
    // Get assets based on current folder context
    let assetsToShow = currentFolderContext ? getAssetsFromFolder(currentFolderContext) : allAssets;
    
    // Apply search filter if there's a search query
    if (searchQuery) {
        assetsToShow = filterAssetsBySearch(assetsToShow, searchQuery);
    }
    
    const folderName = currentFolderContext ? currentFolderContext.split('/').pop() || currentFolderContext : 'All';
    const titleText = searchQuery 
        ? `Search: "${searchQuery}" (${assetsToShow.length} results)`
        : currentFolderContext ? `${folderName} Assets` : 'All Assets';
    document.getElementById('asset-title').textContent = titleText;
    
    if (assetsToShow.length === 0) {
        const emptyMessage = searchQuery 
            ? `No assets found matching "${searchQuery}"`
            : 'No assets found in this folder';
        previewContainer.innerHTML = `<div class="empty-state"><p>${emptyMessage}</p></div>`;
        return;
    }
    
    // Check if we're viewing music assets
    const isMusicView = currentFolderContext && (currentFolderContext.includes('Music') || currentFolderContext.includes('/Music'));
    const audioAssets = assetsToShow.filter(asset => {
        const ext = asset.name.split('.').pop().toLowerCase();
        return ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
    });
    
    // Check if we should use list layout for audio items
    const hasAudioItems = assetsToShow.some(asset => {
        const ext = asset.name.split('.').pop().toLowerCase();
        return ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
    });
    const useListLayout = isMusicView && hasAudioItems;
    
    let gridHTML = '';
    
    // Add music player if viewing music assets with audio files
    if (isMusicView && audioAssets.length > 0) {
        gridHTML += renderMusicPlayer(audioAssets);
    }
    
    if (useListLayout) {
        gridHTML += '<div class="audio-list">';
    } else {
        gridHTML += '<div class="bento-grid">';
    }
    
    const basePath = getBasePath();
    assetsToShow.forEach(asset => {
        const ext = asset.name.split('.').pop().toLowerCase();
        const assetPath = asset.path.startsWith('/') ? asset.path : `/${asset.path}`;
        const assetUrl = `${basePath}${assetPath}`;
        const type = getFileTypeClass(asset.name);
        
        if (type === 'image') {
            gridHTML += `
                <div class="bento-item image" data-path="${escapeHtml(asset.path)}" data-name="${escapeHtml(asset.name)}">
                    <div class="image-container-bento">
                        <img src="${assetUrl}" alt="${escapeHtml(asset.name)}" loading="lazy">
                        <button class="download-button-overlay" data-download-path="${escapeHtml(asset.path)}" data-download-name="${escapeHtml(asset.name)}" title="Download Image">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="bento-item-icon"></div>
                    <div class="bento-item-content">
                        <div class="bento-item-title">${escapeHtml(asset.name)}</div>
                        <div class="bento-item-path">${escapeHtml(asset.path)}</div>
                    </div>
                </div>
            `;
        } else if (type === 'video') {
            gridHTML += `
                <div class="bento-item video" data-path="${escapeHtml(asset.path)}" data-name="${escapeHtml(asset.name)}">
                    <div class="video-container">
                        <video muted loop>
                            <source src="${assetUrl}" type="video/${ext === 'mov' ? 'quicktime' : ext}">
                        </video>
                        <button class="download-button-overlay" data-download-path="${escapeHtml(asset.path)}" data-download-name="${escapeHtml(asset.name)}" title="Download Video">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="bento-item-icon"></div>
                    <div class="bento-item-content">
                        <div class="bento-item-title">${escapeHtml(asset.name)}</div>
                        <div class="bento-item-path">${escapeHtml(asset.path)}</div>
                    </div>
                </div>
            `;
        } else if (type === 'audio') {
            if (useListLayout) {
                // List layout for audio items
                gridHTML += `
                    <div class="audio-list-item" data-path="${escapeHtml(asset.path)}" data-name="${escapeHtml(asset.name)}">
                        <div class="audio-list-icon">🎵</div>
                        <div class="audio-list-info">
                            <div class="audio-list-title">${escapeHtml(asset.name)}</div>
                            <div class="audio-list-path">${escapeHtml(asset.path)}</div>
                        </div>
                        <button class="audio-list-download" data-download-path="${escapeHtml(asset.path)}" data-download-name="${escapeHtml(asset.name)}" title="Download Audio">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </button>
                    </div>
                `;
            } else {
                // Grid layout for audio items (when not in music view)
                gridHTML += `
                    <div class="bento-item audio" data-path="${escapeHtml(asset.path)}" data-name="${escapeHtml(asset.name)}">
                        <div class="bento-item-placeholder">
                            <div class="bento-item-placeholder-icon">🎵</div>
                            <div class="bento-item-placeholder-title">${escapeHtml(asset.name)}</div>
                            <div class="bento-item-placeholder-path">${escapeHtml(asset.path)}</div>
                            <button class="download-button-overlay audio-download-btn" data-download-path="${escapeHtml(asset.path)}" data-download-name="${escapeHtml(asset.name)}" title="Download Audio">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </button>
                        </div>
                        <div class="bento-item-icon"></div>
                    </div>
                `;
            }
        }
    });
    
    if (useListLayout) {
        gridHTML += '</div>';
    } else {
        gridHTML += '</div>';
    }
    previewContainer.innerHTML = gridHTML;
    
    // Animate items with Motion.dev
    const items = useListLayout 
        ? document.querySelectorAll('.audio-list-item')
        : document.querySelectorAll('.bento-item');
    if (items.length > 0) {
        animate(items,
            { opacity: [0, 1], scale: [0.9, 1], y: [20, 0] },
            {
                duration: 0.4,
                delay: stagger(0.02),
                easing: 'ease-out'
            }
        );
    }
    
    // Setup music player if present (check again after DOM is updated)
    const musicPlayerContainer = previewContainer.querySelector('.music-player-container');
    if (musicPlayerContainer && isMusicView && audioAssets.length > 0) {
        setupMusicPlayer(audioAssets);
    }
    
    // Add click handlers to audio list items
    document.querySelectorAll('.audio-list-item').forEach(item => {
        item.addEventListener('click', () => {
            const path = item.getAttribute('data-path');
            const name = item.getAttribute('data-name');
            
            // If we have a music player, play it
            if (isMusicView && audioAssets.length > 0) {
                const audioIndex = audioAssets.findIndex(a => {
                    const aPath = a.path.startsWith('/') ? a.path : `/${a.path}`;
                    const itemPath = path.startsWith('/') ? path : `/${path}`;
                    return aPath === itemPath;
                });
                if (audioIndex !== -1) {
                    playTrackInPlayer(audioIndex);
                    return;
                }
            }
            
            // Otherwise, switch to preview view and load the asset
            currentView = 'preview';
            selectFile(path, name);
        });
    });
    
    // Add click handlers to bento items (non-audio or non-music view)
    document.querySelectorAll('.bento-item').forEach(item => {
        item.addEventListener('click', () => {
            const path = item.getAttribute('data-path');
            const name = item.getAttribute('data-name');
            
            // If it's an audio file and we have a music player, play it
            if (isMusicView && item.classList.contains('audio') && audioAssets.length > 0) {
                const audioIndex = audioAssets.findIndex(a => {
                    const aPath = a.path.startsWith('/') ? a.path : `/${a.path}`;
                    const itemPath = path.startsWith('/') ? path : `/${path}`;
                    return aPath === itemPath;
                });
                if (audioIndex !== -1) {
                    playTrackInPlayer(audioIndex);
                    return;
                }
            }
            
            // Otherwise, switch to preview view and load the asset
            currentView = 'preview';
            selectFile(path, name);
        });
    });
    
    // Play videos on hover with Motion.dev animation
    document.querySelectorAll('.bento-item video').forEach(video => {
        const item = video.closest('.bento-item');
        const videoContainer = video.closest('.video-container');
        
        // Only handle hover on the video element itself, not the container
        video.addEventListener('mouseenter', () => {
            video.play().catch(() => {});
        });
        video.addEventListener('mouseleave', () => {
            // Only pause if not hovering over the download button
            const downloadBtn = videoContainer?.querySelector('.download-button-overlay');
            if (!downloadBtn?.matches(':hover')) {
                video.pause();
                video.currentTime = 0;
            }
        });
        
        // Handle item hover for animations (but not video play/pause)
        item.addEventListener('mouseenter', () => {
            // Animate hover effect
            animate(item, 
                { scale: [1, 1.02], y: [0, -4] },
                { duration: 0.2, easing: 'ease-out' }
            );
        });
        item.addEventListener('mouseleave', () => {
            // Animate hover out
            animate(item,
                { scale: [1.02, 1], y: [-4, 0] },
                { duration: 0.2, easing: 'ease-out' }
            );
        });
    });
    
    // Add download handlers for video download buttons
    document.querySelectorAll('.bento-item .video-container .download-button-overlay').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the item click
            e.preventDefault();
            const path = button.getAttribute('data-download-path');
            const name = button.getAttribute('data-download-name');
            const downloadUrl = path.startsWith('/') ? path : `/${path}`;
            
            // Create a temporary anchor element to trigger download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = name;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
        
        // Keep video playing when hovering over download button
        button.addEventListener('mouseenter', () => {
            const video = button.closest('.video-container')?.querySelector('video');
            if (video && video.paused) {
                video.play().catch(() => {});
            }
        });
    });
    
    // Add hover animations for non-video items (images and audio)
    document.querySelectorAll('.bento-item').forEach(item => {
        // Skip if already has video hover handler
        if (item.querySelector('video')) return;
        
        item.addEventListener('mouseenter', () => {
            animate(item,
                { scale: [1, 1.02], y: [0, -4] },
                { duration: 0.2, easing: 'ease-out' }
            );
        });
        item.addEventListener('mouseleave', () => {
            animate(item,
                { scale: [1.02, 1], y: [-4, 0] },
                { duration: 0.2, easing: 'ease-out' }
            );
        });
    });
    
    // Add download handlers for image download buttons in bento grid
    document.querySelectorAll('.bento-item .image-container-bento .download-button-overlay').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the item click
            e.preventDefault();
            const path = button.getAttribute('data-download-path');
            const name = button.getAttribute('data-download-name');
            const downloadUrl = path.startsWith('/') ? path : `/${path}`;
            
            // Create a temporary anchor element to trigger download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = name;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    });
    
    // Add download handlers for audio download buttons in bento grid
    document.querySelectorAll('.bento-item .audio-download-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the item click
            e.preventDefault();
            const path = button.getAttribute('data-download-path');
            const name = button.getAttribute('data-download-name');
            const downloadUrl = path.startsWith('/') ? path : `/${path}`;
            
            // Create a temporary anchor element to trigger download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = name;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    });
    
    // Add download handlers for audio list download buttons
    document.querySelectorAll('.audio-list-download').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the item click
            e.preventDefault();
            const path = button.getAttribute('data-download-path');
            const name = button.getAttribute('data-download-name');
            const downloadUrl = path.startsWith('/') ? path : `/${path}`;
            
            // Create a temporary anchor element to trigger download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = name;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    });
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    
    if (!searchInput) return;
    
    // Search input handler
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        
        // Show/hide clear button
        if (searchQuery.trim()) {
            searchClear.style.display = 'block';
        } else {
            searchClear.style.display = 'none';
        }
        
        // If in bento view, re-render with search results
        if (currentView === 'bento') {
            renderBentoGrid();
        } else {
            // Switch to bento view when searching
            currentView = 'bento';
            renderBentoGrid();
        }
    });
    
    // Clear search handler
    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClear.style.display = 'none';
        
        // Re-render bento grid without search
        if (currentView === 'bento') {
            renderBentoGrid();
        }
    });
    
    // Enter key to search
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (currentView !== 'bento') {
                currentView = 'bento';
            }
            renderBentoGrid();
        }
    });
}

// Render root directories
function renderRootDirectories() {
    const treeContainer = document.getElementById('file-tree');
    treeContainer.innerHTML = '';
    
    if (!manifest) return;
    
    // Render each root directory
    Object.keys(manifest).forEach(key => {
        const items = manifest[key];
        if (key === '.') {
            // Root level files
            items.forEach(item => renderFileItem(item, treeContainer, 0));
        } else {
            // Directory
            renderDirectoryItem(key, items, treeContainer, 0);
        }
    });
}

// Render directory item
function renderDirectoryItem(name, children, parentElement, level) {
    const itemElement = document.createElement('div');
    itemElement.className = `file-tree-item directory folder`;
    itemElement.style.paddingLeft = `${12 + level * 20}px`;
    // Store the full path for context tracking
    const folderPath = name;
    itemElement.setAttribute('data-path', folderPath);
    itemElement.innerHTML = `
        <span class="folder-icon collapsed">📁</span>
        <span>${escapeHtml(name)}</span>
    `;
    
    itemElement.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFolder(itemElement, name, children);
    });
    
    parentElement.appendChild(itemElement);
}

// Render file item
function renderFileItem(item, parentElement, level) {
    const itemElement = document.createElement('div');
    itemElement.className = `file-tree-item file ${getFileTypeClass(item.name)}`;
    itemElement.style.paddingLeft = `${12 + level * 20}px`;
    itemElement.setAttribute('data-path', item.path);
    itemElement.textContent = item.name;
    
    itemElement.addEventListener('click', (e) => {
        e.stopPropagation();
        selectFile(item.path, item.name);
    });
    
    parentElement.appendChild(itemElement);
}

// Toggle folder expansion
function toggleFolder(element, dirName, children) {
    const icon = element.querySelector('.folder-icon');
    const isExpanded = icon.classList.contains('expanded');
    
    
    if (isExpanded) {
        // Collapse - remove children
        icon.classList.remove('expanded');
        icon.classList.add('collapsed');
        icon.textContent = '📁';
        
        // Clear folder context if this was the active folder
        const folderPath = element.getAttribute('data-path') || dirName;
        const currentPathNormalized = currentFolderContext ? currentFolderContext.replace(/\\/g, '/') : '';
        const folderPathNormalized = folderPath.replace(/\\/g, '/');
        
        if (currentPathNormalized === folderPathNormalized || currentPathNormalized.startsWith(folderPathNormalized + '/')) {
            // Find parent folder or clear context
            const parentFolder = element.parentElement.querySelector(`.file-tree-item.folder[data-path]`);
            if (parentFolder && parentFolder !== element) {
                const parentPath = parentFolder.getAttribute('data-path');
                currentFolderContext = parentPath.startsWith('/') ? parentPath : `/${parentPath}`;
            } else {
                currentFolderContext = null;
            }
            
            // Update active state
            document.querySelectorAll('.file-tree-item').forEach(item => {
                item.classList.remove('active');
            });
            if (currentFolderContext && parentFolder) {
                parentFolder.classList.add('active');
            }
        }
        
        // Find and remove all children of this folder
        const parent = element.parentElement;
        let nextSibling = element.nextSibling;
        const parentLevel = parseInt(element.style.paddingLeft) || 0;
        
        while (nextSibling) {
            const nextLevel = parseInt(nextSibling.style.paddingLeft) || 0;
            if (nextLevel <= parentLevel) {
                break; // Reached a sibling or parent level item
            }
            const toRemove = nextSibling;
            nextSibling = nextSibling.nextSibling;
            toRemove.remove();
        }
        
        // If in bento view, refresh the grid
        if (currentView === 'bento') {
            renderBentoGrid();
        }
    } else {
        // Expand - set folder context
        const folderPath = element.getAttribute('data-path') || dirName;
        currentFolderContext = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
        
        // Update active state in file tree
        document.querySelectorAll('.file-tree-item').forEach(item => {
            item.classList.remove('active');
        });
        element.classList.add('active');
        
        icon.classList.remove('collapsed');
        icon.classList.add('expanded');
        icon.textContent = '📂';
        
        // Render children
        const parent = element.parentElement;
        const nextSibling = element.nextSibling;
        const level = parseInt(element.style.paddingLeft) || 0;
        const childLevel = level + 20;
        
        // Create fragment for all children
        const fragment = document.createDocumentFragment();
        children.forEach(item => {
            if (item.type === 'directory') {
                const childElement = document.createElement('div');
                childElement.className = `file-tree-item directory folder`;
                childElement.style.paddingLeft = `${12 + childLevel}px`;
                childElement.setAttribute('data-path', item.path);
                childElement.innerHTML = `
                    <span class="folder-icon collapsed">📁</span>
                    <span>${escapeHtml(item.name)}</span>
                `;
                childElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFolder(childElement, item.name, item.children || []);
                });
                fragment.appendChild(childElement);
            } else {
                const childElement = document.createElement('div');
                childElement.className = `file-tree-item file ${getFileTypeClass(item.name)}`;
                childElement.style.paddingLeft = `${12 + childLevel}px`;
                childElement.setAttribute('data-path', item.path);
                childElement.textContent = item.name;
                childElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectFile(item.path, item.name);
                });
                fragment.appendChild(childElement);
            }
        });
        
        if (nextSibling) {
            parent.insertBefore(fragment, nextSibling);
        } else {
            parent.appendChild(fragment);
        }
        
        // Animate folder expansion with Motion.dev
        // Note: fragment.children is a live collection, convert to array after insertion
        setTimeout(() => {
            const insertedChildren = [];
            let next = element.nextSibling;
            const parentLevel = parseInt(element.style.paddingLeft) || 0;
            while (next) {
                const nextLevel = parseInt(next.style.paddingLeft) || 0;
                if (nextLevel <= parentLevel) break;
                insertedChildren.push(next);
                next = next.nextSibling;
            }
            
            if (insertedChildren.length > 0) {
                animate(insertedChildren,
                    { opacity: [0, 1], x: [-10, 0] },
                    {
                        duration: 0.3,
                        delay: stagger(0.02),
                        easing: 'ease-out'
                    }
                );
            }
        }, 0);
        
        // Automatically switch to bento/list view when expanding a folder
        currentView = 'bento';
        renderBentoGrid();
    }
}

// Select and preview file
function selectFile(path, name) {
    // Special handling for Brand Kit index.html - load it in the main content area
    if (path.includes('Brand Kit/index.html') || path.includes('Brand Kit\\index.html')) {
        loadBrandKitPage();
        return;
    }
    
    // Switch to preview view if in bento view
    if (currentView === 'bento') {
        currentView = 'preview';
    }
    
    // Update active state
    document.querySelectorAll('.file-tree-item').forEach(item => {
        item.classList.remove('active');
    });
    const clickedElement = event?.target?.closest('.file-tree-item');
    if (clickedElement) {
        clickedElement.classList.add('active');
    }
    
    // Update title
    document.getElementById('asset-title').textContent = name;
    
    // Load preview
    loadAssetPreview(path, name);
}

// Load asset preview
function loadAssetPreview(path, name) {
    const previewContainer = document.getElementById('asset-preview');
    previewContainer.innerHTML = '<div class="loading">Loading</div>';
    
    const fileExtension = name.split('.').pop().toLowerCase();
    // Construct asset URL - use the path with base path for GitHub Pages
    const basePath = getBasePath();
    const assetPath = path.startsWith('/') ? path : `/${path}`;
    const assetUrl = `${basePath}${assetPath}`;
    
    let previewHTML = '';
    
    if (['mp4', 'webm', 'mov'].includes(fileExtension)) {
        previewHTML = `
            <div class="asset-preview">
                <video controls autoplay>
                    <source src="${assetUrl}" type="video/${fileExtension === 'mov' ? 'quicktime' : fileExtension}">
                    Your browser does not support the video tag.
                </video>
                <div class="asset-info">
                    <h3>${escapeHtml(name)}</h3>
                    <p class="asset-path">${escapeHtml(path)}</p>
                    <a href="${assetUrl}" download="${escapeHtml(name)}" class="download-button">
                        Download Video
                    </a>
                </div>
            </div>
        `;
    } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension)) {
        previewHTML = `
            <div class="asset-preview">
                <audio controls autoplay>
                    <source src="${assetUrl}" type="audio/${fileExtension === 'm4a' ? 'mp4' : fileExtension}">
                    Your browser does not support the audio tag.
                </audio>
                <div class="asset-info">
                    <h3>${escapeHtml(name)}</h3>
                    <p class="asset-path">${escapeHtml(path)}</p>
                    <a href="${assetUrl}" download="${escapeHtml(name)}" class="download-button">
                        Download Audio
                    </a>
                </div>
            </div>
        `;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) {
        previewHTML = `
            <div class="asset-preview">
                <div class="image-container">
                    <img src="${assetUrl}" alt="${escapeHtml(name)}" id="preview-image">
                    <a href="${assetUrl}" download="${escapeHtml(name)}" class="download-button-overlay" title="Download Image">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </a>
                </div>
                <div class="asset-info">
                    <h3>${escapeHtml(name)}</h3>
                    <p class="asset-path">${escapeHtml(path)}</p>
                </div>
            </div>
        `;
    } else {
        previewHTML = `
            <div class="asset-preview">
                <div class="asset-info">
                    <h3>${escapeHtml(name)}</h3>
                    <p class="asset-path">${escapeHtml(path)}</p>
                    <p>Preview not available for this file type.</p>
                </div>
            </div>
        `;
    }
    
    previewContainer.innerHTML = previewHTML;
    
    // Animate preview content with Motion.dev
    const previewContent = previewContainer.querySelector('.asset-preview');
    if (previewContent) {
        animate(previewContent,
            { opacity: [0, 1], y: [10, 0] },
            { duration: 0.4, easing: 'ease-out' }
        );
    }
}

// Get file type class for styling
function getFileTypeClass(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
    if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    return '';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Setup navigation highlighting and handlers
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Load the appropriate view
            const view = link.getAttribute('data-view');
            if (view === 'about') {
                loadAboutPage();
            } else if (view === 'browser') {
                loadBrowserView();
            }
        });
    });
    
    // Set browser as active by default
    document.getElementById('nav-browser').classList.add('active');
}

// Load About page content into main area
async function loadAboutPage() {
    const previewContainer = document.getElementById('asset-preview');
    document.getElementById('asset-title').textContent = 'About';
    
    try {
        const basePath = getBasePath();
        const response = await fetch(`${basePath}/about.html`);
        if (!response.ok) throw new Error('Failed to load about page');
        const html = await response.text();
        
        // Extract body content from the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const aboutContent = doc.querySelector('.about-container');
        
        if (aboutContent) {
            // Clone to avoid modifying the original
            const contentClone = aboutContent.cloneNode(true);
            
            // Remove the back link since we're in the app
            const backLink = contentClone.querySelector('.back-link');
            if (backLink) backLink.remove();
            
            previewContainer.innerHTML = contentClone.innerHTML;
            
            // Re-initialize animations for loaded content
            const sections = previewContainer.querySelectorAll('.about-section');
            if (sections.length > 0) {
                animate(sections,
                    { opacity: [0, 1], y: [20, 0] },
                    { 
                        duration: 0.6,
                        delay: stagger(0.1),
                        easing: 'ease-out'
                    }
                );
            }
            
            // Re-initialize feature cards animations
            const cards = previewContainer.querySelectorAll('.feature-card');
            if (cards.length > 0) {
                animate(cards,
                    { opacity: [0, 1], scale: [0.95, 1] },
                    {
                        duration: 0.5,
                        delay: stagger(0.05),
                        easing: 'ease-out'
                    }
                );
            }
        } else {
            previewContainer.innerHTML = '<div class="empty-state"><p>About page content not found</p></div>';
        }
    } catch (error) {
        console.error('Error loading about page:', error);
        previewContainer.innerHTML = '<div class="empty-state"><p>Error loading about page</p></div>';
    }
}

// Load Brand Kit page content into main area
async function loadBrandKitPage() {
    const previewContainer = document.getElementById('asset-preview');
    document.getElementById('asset-title').textContent = 'Brand Kit';
    
    // Switch to preview view
    currentView = 'preview';
    
    try {
        const basePath = getBasePath();
        const response = await fetch(`${basePath}/Brand Kit/index.html`);
        if (!response.ok) throw new Error('Failed to load brand kit page');
        const html = await response.text();
        
        // Extract body content from the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const brandKitContainer = doc.querySelector('.brand-kit-container');
        
        if (brandKitContainer) {
            // Clone to avoid modifying the original
            const containerClone = brandKitContainer.cloneNode(true);
            
            // Remove the back link since we're in the app
            const backLink = containerClone.querySelector('.back-link');
            if (backLink) backLink.remove();
            
            previewContainer.innerHTML = containerClone.innerHTML;
            
            // Animate the loaded content
            const sections = previewContainer.querySelectorAll('.brand-kit-content > *');
            if (sections.length > 0) {
                animate(sections,
                    { opacity: [0, 1], y: [20, 0] },
                    { 
                        duration: 0.6,
                        delay: stagger(0.08),
                        easing: 'ease-out'
                    }
                );
            }
        } else {
            previewContainer.innerHTML = '<div class="empty-state"><p>Brand Kit content not found</p></div>';
        }
    } catch (error) {
        console.error('Error loading brand kit page:', error);
        previewContainer.innerHTML = '<div class="empty-state"><p>Error loading brand kit page</p></div>';
    }
}

// Load browser view (default state)
function loadBrowserView() {
    document.getElementById('asset-title').textContent = 'Select an asset to preview';
    const previewContainer = document.getElementById('asset-preview');
    previewContainer.innerHTML = '<div class="empty-state"><p>Browse assets from the left panel</p></div>';
    
    // Reset view to preview
    currentView = 'preview';
    
    // Clear folder context
    currentFolderContext = null;
    
    // Clear active folder in file tree
    document.querySelectorAll('.file-tree-item').forEach(item => {
        item.classList.remove('active');
    });
}

// Animate initial page load
function animateInitialLoad() {
    // Animate browser panel
    const browserPanel = document.querySelector('.browser-panel');
    if (browserPanel) {
        animate(browserPanel,
            { opacity: [0, 1], x: [-20, 0] },
            { duration: 0.5, easing: 'ease-out' }
        );
    }
    
    // Animate main panel
    const mainPanel = document.querySelector('.main-panel');
    if (mainPanel) {
        animate(mainPanel,
            { opacity: [0, 1], x: [20, 0] },
            { duration: 0.5, delay: 0.1, easing: 'ease-out' }
        );
    }
}

// Music player state
let musicPlayerState = {
    currentTrackIndex: 0,
    playlist: [],
    audioElement: null,
    isPlaying: false,
    volume: 1.0, // 0.0 to 1.0
    isMuted: false
};

// Render music player component
function renderMusicPlayer(audioAssets) {
    const basePath = getBasePath();
    const playlist = audioAssets.map(asset => {
        const assetPath = asset.path.startsWith('/') ? asset.path : `/${asset.path}`;
        return {
            name: asset.name,
            path: `${basePath}${assetPath}`,
            displayName: asset.name.replace(/\.[^/.]+$/, '') // Remove extension
        };
    });
    
    musicPlayerState.playlist = playlist;
    
    return `
        <div class="music-player-container">
            <div class="music-player">
                <div class="music-player-info">
                    <div class="music-player-track-info">
                        <div class="music-player-track-name" id="music-player-track-name">${playlist[0]?.displayName || 'No track'}</div>
                        <div class="music-player-track-number" id="music-player-track-number">1 / ${playlist.length}</div>
                    </div>
                    <audio id="music-player-audio" preload="metadata"></audio>
                    <div class="music-player-controls">
                        <button class="music-player-btn" id="music-player-prev" title="Previous">⏮</button>
                        <button class="music-player-btn music-player-play-pause" id="music-player-play-pause" title="Play/Pause">▶</button>
                        <button class="music-player-btn" id="music-player-next" title="Next">⏭</button>
                        <a class="music-player-btn music-player-download" id="music-player-download" title="Download Track" download>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </a>
                    </div>
                    <div class="music-player-progress">
                        <div class="music-player-time" id="music-player-current-time">0:00</div>
                        <input type="range" class="music-player-seek" id="music-player-seek" min="0" max="100" value="0">
                        <div class="music-player-time" id="music-player-duration">0:00</div>
                    </div>
                    <div class="music-player-volume">
                        <button class="music-player-btn music-player-volume-btn" id="music-player-mute" title="Mute/Unmute">🔊</button>
                        <input type="range" class="music-player-volume-slider" id="music-player-volume" min="0" max="100" value="100">
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Setup music player functionality
function setupMusicPlayer(audioAssets) {
    const audio = document.getElementById('music-player-audio');
    if (!audio) return;
    
    musicPlayerState.audioElement = audio;
    musicPlayerState.currentTrackIndex = 0;
    
    // Load first track
    loadTrack(0);
    
    // Volume controls
    const volumeSlider = document.getElementById('music-player-volume');
    const muteBtn = document.getElementById('music-player-mute');
    
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            musicPlayerState.volume = volume;
            if (audio) {
                audio.volume = volume;
                // Update mute state
                if (volume === 0) {
                    musicPlayerState.isMuted = true;
                    if (muteBtn) muteBtn.textContent = '🔇';
                } else if (musicPlayerState.isMuted && volume > 0) {
                    musicPlayerState.isMuted = false;
                    if (muteBtn) muteBtn.textContent = '🔊';
                }
            }
        });
        
        // Set initial volume
        volumeSlider.value = musicPlayerState.volume * 100;
        if (audio) {
            audio.volume = musicPlayerState.volume;
        }
    }
    
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            if (audio) {
                if (musicPlayerState.isMuted) {
                    // Unmute - restore previous volume
                    audio.volume = musicPlayerState.volume;
                    musicPlayerState.isMuted = false;
                    muteBtn.textContent = '🔊';
                    if (volumeSlider) volumeSlider.value = musicPlayerState.volume * 100;
                } else {
                    // Mute
                    audio.volume = 0;
                    musicPlayerState.isMuted = true;
                    muteBtn.textContent = '🔇';
                    if (volumeSlider) volumeSlider.value = 0;
                }
            }
        });
    }
    
    // Download button
    const downloadBtn = document.getElementById('music-player-download');
    if (downloadBtn) {
        updateDownloadButton(downloadBtn, musicPlayerState.playlist[0]);
        downloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const currentTrack = musicPlayerState.playlist[musicPlayerState.currentTrackIndex];
            if (currentTrack) {
                downloadBtn.href = currentTrack.path;
                downloadBtn.download = currentTrack.name;
                downloadBtn.click();
            }
        });
    }
    
    // Play/Pause button
    const playPauseBtn = document.getElementById('music-player-play-pause');
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            if (musicPlayerState.isPlaying) {
                audio.pause();
            } else {
                audio.play();
            }
        });
    }
    
    // Previous button
    const prevBtn = document.getElementById('music-player-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            const newIndex = musicPlayerState.currentTrackIndex > 0 
                ? musicPlayerState.currentTrackIndex - 1 
                : musicPlayerState.playlist.length - 1;
            loadTrack(newIndex);
            audio.play();
        });
    }
    
    // Next button
    const nextBtn = document.getElementById('music-player-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const newIndex = musicPlayerState.currentTrackIndex < musicPlayerState.playlist.length - 1
                ? musicPlayerState.currentTrackIndex + 1
                : 0;
            loadTrack(newIndex);
            audio.play();
        });
    }
    
    // Seek bar
    const seekBar = document.getElementById('music-player-seek');
    if (seekBar) {
        seekBar.addEventListener('input', (e) => {
            const seekTime = (e.target.value / 100) * audio.duration;
            audio.currentTime = seekTime;
        });
    }
    
    // Audio event listeners
    audio.addEventListener('loadedmetadata', () => {
        updateDuration();
        updateSeekBar();
    });
    
    audio.addEventListener('timeupdate', () => {
        updateCurrentTime();
        updateSeekBar();
    });
    
    audio.addEventListener('play', () => {
        musicPlayerState.isPlaying = true;
        if (playPauseBtn) playPauseBtn.textContent = '⏸';
    });
    
    audio.addEventListener('pause', () => {
        musicPlayerState.isPlaying = false;
        if (playPauseBtn) playPauseBtn.textContent = '▶';
    });
    
    audio.addEventListener('ended', () => {
        // Auto-play next track
        const newIndex = musicPlayerState.currentTrackIndex < musicPlayerState.playlist.length - 1
            ? musicPlayerState.currentTrackIndex + 1
            : 0;
        loadTrack(newIndex);
        audio.play();
    });
}

// Load a track into the player
function loadTrack(index) {
    if (index < 0 || index >= musicPlayerState.playlist.length) return;
    
    musicPlayerState.currentTrackIndex = index;
    const track = musicPlayerState.playlist[index];
    const audio = musicPlayerState.audioElement;
    
    if (audio && track) {
        audio.src = track.path;
        audio.load();
        
        // Update UI
        const trackNameEl = document.getElementById('music-player-track-name');
        const trackNumberEl = document.getElementById('music-player-track-number');
        
        if (trackNameEl) trackNameEl.textContent = track.displayName;
        if (trackNumberEl) trackNumberEl.textContent = `${index + 1} / ${musicPlayerState.playlist.length}`;
        
        // Update download button
        const downloadBtn = document.getElementById('music-player-download');
        if (downloadBtn) {
            updateDownloadButton(downloadBtn, track);
        }
        
        // Highlight active track in bento grid and audio list
        // Compare paths without base path
        const basePath = getBasePath();
        const trackPathWithoutBase = track.path.replace(basePath, '');
        const trackPathNormalized = trackPathWithoutBase.startsWith('/') ? trackPathWithoutBase : `/${trackPathWithoutBase}`;
        
        document.querySelectorAll('.bento-item.audio, .audio-list-item').forEach((item) => {
            const itemPath = item.getAttribute('data-path');
            const itemPathNormalized = itemPath.startsWith('/') ? itemPath : `/${itemPath}`;
            
            if (itemPathNormalized === trackPathNormalized) {
                item.classList.add('active-track');
            } else {
                item.classList.remove('active-track');
            }
        });
    }
}

// Update download button with current track
function updateDownloadButton(button, track) {
    if (button && track) {
        button.href = track.path;
        button.download = track.name;
    }
}

// Play a specific track from the playlist
function playTrackInPlayer(index) {
    loadTrack(index);
    if (musicPlayerState.audioElement) {
        musicPlayerState.audioElement.play();
    }
}

// Update current time display
function updateCurrentTime() {
    const audio = musicPlayerState.audioElement;
    const timeEl = document.getElementById('music-player-current-time');
    if (timeEl && audio) {
        timeEl.textContent = formatTime(audio.currentTime);
    }
}

// Update duration display
function updateDuration() {
    const audio = musicPlayerState.audioElement;
    const durationEl = document.getElementById('music-player-duration');
    if (durationEl && audio) {
        durationEl.textContent = formatTime(audio.duration || 0);
    }
}

// Update seek bar
function updateSeekBar() {
    const audio = musicPlayerState.audioElement;
    const seekBar = document.getElementById('music-player-seek');
    if (seekBar && audio && audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        seekBar.value = percent;
    }
}

// Format time as MM:SS
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

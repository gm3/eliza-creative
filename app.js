// Import Motion.dev for animations
import { animate, stagger } from 'motion';

// State
let manifest = null;
let currentPath = '';
let currentView = 'preview'; // 'preview' or 'bento'
let allAssets = []; // Flat list of all assets for bento view
let currentFolderContext = null; // Current folder path for filtering bento view
let searchQuery = ''; // Current search query
let gridEventListenersAttached = false; // Track if event listeners are already attached
let previousViewState = null; // Store previous view state for back button (bento/folder context)
let itemsPerPage = 30; // Number of items to render initially (reduced for better performance)
let currentPage = 1; // Current page of items
let allItemsToRender = []; // All items that should be rendered (for pagination)

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadManifest();
    renderRootDirectories();
    setupNavigation();
    setupSearch();
    initializePersistentMusicPlayer();
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
        // Initialize persistent music player after assets are collected
        initializePersistentMusicPlayer();
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
        // Skip Brand Kit - it's now in navigation, not file tree
        if (key !== '.' && key !== 'Brand Kit') {
            traverse(manifest[key]);
        }
    });
}

function getCategoryFromPath(path) {
    if (path.includes('Music')) return 'Music';
    if (path.includes('Videos')) return 'Videos';
    if (path.includes('ElizaOS Stickers')) return 'Stickers';
    if (path.includes('Brand Kit')) return 'Brand Kit';
    if (path.includes('ElizaOS Art')) return 'ElizaOS Art';
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
    
    // Reset event listener flag when re-rendering (new container created)
    gridEventListenersAttached = false;
    currentPage = 1; // Reset to first page when starting fresh
    
    // Clean up any existing observers
    const oldLoadMoreBtn = previewContainer.querySelector('#load-more-btn');
    if (oldLoadMoreBtn && oldLoadMoreBtn._scrollObserver) {
        oldLoadMoreBtn._scrollObserver.disconnect();
    }
    
    // Disconnect and reset global image observer when starting fresh grid
    if (globalImageObserver) {
        globalImageObserver.disconnect();
        globalImageObserver = null;
    }
    
    // Get assets based on current folder context
    let assetsToShow = currentFolderContext ? getAssetsFromFolder(currentFolderContext) : allAssets;
    
    // Apply search filter if there's a search query
    if (searchQuery) {
        assetsToShow = filterAssetsBySearch(assetsToShow, searchQuery);
    }
    
    // Store all items for pagination
    allItemsToRender = assetsToShow;
    
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
    
    // Only render first page of items for performance
    const itemsToRender = assetsToShow.slice(0, itemsPerPage);
    renderBentoGridItems(itemsToRender, assetsToShow.length, previewContainer);
}

// Render bento grid items (separated for pagination)
function renderBentoGridItems(itemsToRender, totalCount, previewContainer) {
    
    // Check if we're viewing music assets
    const isMusicView = currentFolderContext && (currentFolderContext.includes('Music') || currentFolderContext.includes('/Music'));
    const audioAssets = itemsToRender.filter(asset => {
        const ext = asset.name.split('.').pop().toLowerCase();
        return ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
    });
    
    // Check if we should use list layout for audio items
    const hasAudioItems = itemsToRender.some(asset => {
        const ext = asset.name.split('.').pop().toLowerCase();
        return ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
    });
    const useListLayout = isMusicView && hasAudioItems;
    
    let gridHTML = '';
    
    // Music player is now persistent in header, no need to render here
    
    if (useListLayout) {
        gridHTML += '<div class="audio-list">';
    } else {
        gridHTML += '<div class="bento-grid">';
    }
    
    const basePath = getBasePath();
    itemsToRender.forEach(asset => {
        const ext = asset.name.split('.').pop().toLowerCase();
        const assetPath = asset.path.startsWith('/') ? asset.path : `/${asset.path}`;
        const assetUrl = `${basePath}${assetPath}`;
        const type = getFileTypeClass(asset.name);
        
        if (type === 'image') {
            // Use thumbnail for grid view (fallback to full image if thumbnail doesn't exist)
            // Convert extension to .jpg for thumbnail
            const ext = asset.path.split('.').pop();
            const thumbnailPath = asset.path.replace(`.${ext}`, '.jpg');
            const thumbnailUrl = `${basePath}/thumbnails${thumbnailPath}`;
            gridHTML += `
                <div class="bento-item image" data-path="${escapeHtml(asset.path)}" data-name="${escapeHtml(asset.name)}">
                    <div class="image-container-bento">
                        <img class="lazy-image" data-src="${thumbnailUrl}" data-full-src="${assetUrl}" data-fallback="${assetUrl}" alt="${escapeHtml(asset.name)}" loading="lazy" decoding="async" width="400" height="400" onerror="this.onerror=null; this.src=this.dataset.fallback;">
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
                        <video muted loop preload="metadata" loading="lazy" playsinline>
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
    
    // Calculate how many items have been rendered so far
    const itemsRenderedSoFar = (currentPage - 1) * itemsPerPage + itemsToRender.length;
    const remaining = totalCount - itemsRenderedSoFar;
    
    // Add "Load More" button if there are more items
    if (remaining > 0) {
        gridHTML += `
            <div class="load-more-container">
                <button id="load-more-btn" class="load-more-btn">
                    Load More (${remaining} remaining)
                </button>
            </div>
        `;
    }
    
    // If this is the first page, replace innerHTML, otherwise append
    if (currentPage === 1) {
        previewContainer.innerHTML = gridHTML;
    } else {
        // Append to existing grid
        const existingGrid = previewContainer.querySelector('.bento-grid, .audio-list');
        if (existingGrid) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = gridHTML;
            const newItemsContainer = tempDiv.querySelector('.bento-grid, .audio-list');
            if (newItemsContainer) {
                // Extract just the items (not the container)
                const items = Array.from(newItemsContainer.children);
                items.forEach(item => existingGrid.appendChild(item));
            }
            // Update load more button
            const oldLoadMore = previewContainer.querySelector('.load-more-container');
            const newLoadMore = tempDiv.querySelector('.load-more-container');
            if (oldLoadMore && newLoadMore) {
                oldLoadMore.replaceWith(newLoadMore);
            } else if (newLoadMore) {
                existingGrid.parentElement.appendChild(newLoadMore);
            } else if (oldLoadMore && remaining <= 0) {
                // Remove button if no more items
                oldLoadMore.remove();
            }
            
            // Re-observe new videos for thumbnail loading
            const gridContainerAfter = previewContainer.querySelector('.bento-grid, .audio-list');
            if (gridContainerAfter && typeof gridContainerAfter.observeVideos === 'function') {
                gridContainerAfter.observeVideos();
            }
        }
    }
    
    // Use CSS for initial animation instead of Motion.dev for better performance with many items
    const items = useListLayout 
        ? document.querySelectorAll('.audio-list-item')
        : document.querySelectorAll('.bento-item');
    items.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px) scale(0.9)';
        // Use requestAnimationFrame for smoother staggered animation
        requestAnimationFrame(() => {
            setTimeout(() => {
                item.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0) scale(1)';
            }, index * 10); // Stagger by 10ms per item
        });
    });
    
    // Music player is now persistent in header, no setup needed here
    
    // Use event delegation for all interactions - single listener on container (only attach once)
    const gridContainer = previewContainer.querySelector('.bento-grid, .audio-list');
    if (gridContainer && !gridEventListenersAttached) {
        gridEventListenersAttached = true;
        
        // Video hover handling - load metadata first to show thumbnail, then play on hover
        let hoverTimeout;
        
        // Load video metadata when video enters viewport (for thumbnail)
        const videoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const video = entry.target;
                    if (video.readyState === 0) {
                        // Only load metadata if not already loaded
                        video.load();
                    }
                }
            });
        }, { rootMargin: '100px' });
        
        // Observe all videos in the grid (re-observe after new items are added)
        // Store on gridContainer for access when new items are added
        gridContainer.observeVideos = () => {
            gridContainer.querySelectorAll('video').forEach(video => {
                // Only observe if not already observed
                if (!video.dataset.observed) {
                    videoObserver.observe(video);
                    video.dataset.observed = 'true';
                }
            });
        };
        gridContainer.observeVideos();
        
        gridContainer.addEventListener('mouseenter', (e) => {
            const video = e.target.closest('.bento-item.video')?.querySelector('video');
            if (video) {
                clearTimeout(hoverTimeout);
                // Ensure video is loaded, then play
                if (video.readyState < 2) {
                    video.load();
                }
                video.play().catch(() => {});
            }
        }, true);
        
        gridContainer.addEventListener('mouseleave', (e) => {
            const video = e.target.closest('.bento-item.video')?.querySelector('video');
            if (video) {
                const item = video.closest('.bento-item');
                const downloadBtn = item?.querySelector('.download-button-overlay');
                if (!downloadBtn?.matches(':hover')) {
                    hoverTimeout = setTimeout(() => {
                        video.pause();
                        video.currentTime = 0;
                    }, 100);
                }
            }
        }, true);
        
        // Lightweight hover animations using CSS transforms (no Motion.dev)
        gridContainer.addEventListener('mouseenter', (e) => {
            const item = e.target.closest('.bento-item');
            if (item && !item.querySelector('video')) {
                item.style.transform = 'translateY(-4px) scale(1.02)';
            }
        }, true);
        
        gridContainer.addEventListener('mouseleave', (e) => {
            const item = e.target.closest('.bento-item');
            if (item && !item.querySelector('video')) {
                item.style.transform = '';
            }
        }, true);
        
        // Unified click handler for all interactions
        gridContainer.addEventListener('click', (e) => {
            // Handle download buttons first
            const downloadBtn = e.target.closest('.download-button-overlay, .audio-list-download');
            if (downloadBtn) {
                e.stopPropagation();
                e.preventDefault();
                const path = downloadBtn.getAttribute('data-download-path');
                const name = downloadBtn.getAttribute('data-download-name');
                const basePath = getBasePath();
                const downloadUrl = path.startsWith('/') ? `${basePath}${path}` : `${basePath}/${path}`;
                
                // Create a temporary anchor element to trigger download
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = name;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                return;
            }
            
            // Handle item clicks
            const item = e.target.closest('.bento-item, .audio-list-item');
            if (item) {
                const path = item.getAttribute('data-path');
                const name = item.getAttribute('data-name');
                
                // If it's an audio file, find it in global playlist and play it
                if (item.classList.contains('audio') || item.classList.contains('audio-list-item')) {
                    const basePath = getBasePath();
                    const itemPathNormalized = path.startsWith('/') ? path : `/${path}`;
                    const fullItemPath = `${basePath}${itemPathNormalized}`;
                    
                    const globalAudioIndex = musicPlayerState.playlist.findIndex(track => {
                        return track.path === fullItemPath || track.path.endsWith(itemPathNormalized);
                    });
                    
                    if (globalAudioIndex !== -1) {
                        playTrackInPlayer(globalAudioIndex);
                        return;
                    }
                }
                
                // Otherwise, switch to preview view and load the asset
                // Store previous view state before switching
                previousViewState = {
                    view: 'bento',
                    folderContext: currentFolderContext,
                    searchQuery: searchQuery
                };
                currentView = 'preview';
                selectFile(path, name);
            }
        });
    }
    
    // Setup "Load More" button - use event delegation to handle dynamically added buttons
    previewContainer.addEventListener('click', (e) => {
        if (e.target.id === 'load-more-btn' || e.target.closest('#load-more-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.id === 'load-more-btn' ? e.target : e.target.closest('#load-more-btn');
            if (btn && !btn.disabled) {
                btn.disabled = true; // Prevent double-clicks
                loadMoreItems(previewContainer, totalCount);
                // Re-enable after a short delay
                setTimeout(() => {
                    const newBtn = previewContainer.querySelector('#load-more-btn');
                    if (newBtn) newBtn.disabled = false;
                }, 100);
            }
        }
    });
    
    // Setup Intersection Observer for lazy image loading
    setupLazyImageLoading(previewContainer);
    
    // Setup Intersection Observer for infinite scroll (optional - loads more when near bottom)
    // Only if there are more items to load
    if (allItemsToRender.length > currentPage * itemsPerPage) {
        setupInfiniteScroll(previewContainer, totalCount);
    }
}

// Load more items when "Load More" is clicked
function loadMoreItems(previewContainer, totalCount) {
    // Increment page before calculating
    currentPage++;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const nextItems = allItemsToRender.slice(startIndex, endIndex);
    
    if (nextItems.length > 0) {
        // Render the next batch of items
        renderBentoGridItems(nextItems, totalCount, previewContainer);
        
        // Re-setup lazy loading for new images
        setupLazyImageLoading(previewContainer);
        
        // Re-setup infinite scroll if there are still more items
        const itemsRenderedSoFar = currentPage * itemsPerPage;
        if (allItemsToRender.length > itemsRenderedSoFar) {
            setupInfiniteScroll(previewContainer, totalCount);
        }
    } else {
        // No more items - remove the button if it exists
        const loadMoreBtn = previewContainer.querySelector('#load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.closest('.load-more-container')?.remove();
        }
    }
}

// Setup infinite scroll using Intersection Observer
function setupInfiniteScroll(previewContainer, totalCount) {
    // Only setup if there are more items to load
    if (allItemsToRender.length <= currentPage * itemsPerPage) {
        return;
    }
    
    const loadMoreBtn = previewContainer.querySelector('#load-more-btn');
    if (!loadMoreBtn) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Load more when button comes into view
                loadMoreItems(previewContainer, totalCount);
            }
        });
    }, {
        rootMargin: '200px' // Start loading 200px before button is visible
    });
    
    observer.observe(loadMoreBtn);
}

// Setup lazy loading for images using Intersection Observer
// Use a single global observer to avoid creating multiple observers
let globalImageObserver = null;

function setupLazyImageLoading(container) {
    // Only get images that haven't been loaded yet (still have data-src and lazy-image class)
    const lazyImages = container.querySelectorAll('img.lazy-image[data-src]:not([src])');
    
    if (lazyImages.length === 0) return; // No new images to observe
    
    if ('IntersectionObserver' in window) {
        // Create observer only once, reuse it
        if (!globalImageObserver) {
            globalImageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        // Skip if already loaded
                        if (img.src || !img.hasAttribute('data-src')) {
                            observer.unobserve(img);
                            return;
                        }
                        
                        // Load thumbnail first (much smaller file size)
                        const thumbnailSrc = img.getAttribute('data-src');
                        const fallbackSrc = img.getAttribute('data-fallback');
                        
                        // Try to load thumbnail, fallback to full image on error
                        img.onerror = function() {
                            if (this.src !== fallbackSrc && fallbackSrc) {
                                this.src = fallbackSrc;
                            }
                        };
                        
                        img.src = thumbnailSrc;
                        img.classList.remove('lazy-image');
                        img.removeAttribute('data-src');
                        
                        observer.unobserve(img);
                    }
                });
            }, {
                rootMargin: '100px' // Start loading 100px before image enters viewport
            });
        }
        
        // Only observe images that aren't already being observed
        lazyImages.forEach(img => {
            // Check if image is already being observed or already loaded
            if (!img.src && img.hasAttribute('data-src')) {
                globalImageObserver.observe(img);
            }
        });
    } else {
        // Fallback for browsers without Intersection Observer
        lazyImages.forEach(img => {
            const fallback = img.getAttribute('data-fallback');
            img.src = img.getAttribute('data-src') || fallback;
            img.onerror = function() {
                if (this.src !== fallback && fallback) {
                    this.src = fallback;
                }
            };
            img.classList.remove('lazy-image');
            img.removeAttribute('data-src');
        });
    }
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
    
    // Render each root directory (exclude Brand Kit - it's in navigation now)
    Object.keys(manifest).forEach(key => {
        // Skip Brand Kit folder - it's now in the navigation menu
        if (key === 'Brand Kit') return;
        
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
        <span class="folder-icon collapsed"></span>
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
    // Special handling: If Brand Kit folder is clicked, load the Brand Kit page directly
    if (dirName === 'Brand Kit') {
        loadBrandKitPage();
        // Also set active nav link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(l => l.classList.remove('active'));
        const brandKitNav = document.getElementById('nav-brand-kit');
        if (brandKitNav) brandKitNav.classList.add('active');
        return;
    }
    
    const icon = element.querySelector('.folder-icon');
    const isExpanded = icon.classList.contains('expanded');
    
    
    if (isExpanded) {
        // Collapse - remove children
        icon.classList.remove('expanded');
        icon.classList.add('collapsed');
        // Icon is handled by CSS, just update classes
        
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
                    <span class="folder-icon collapsed"></span>
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
    
    // Special handling for audio files - load into persistent player instead of preview
    const fileExtension = name.split('.').pop().toLowerCase();
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension)) {
        const basePath = getBasePath();
        const itemPathNormalized = path.startsWith('/') ? path : `/${path}`;
        const fullItemPath = `${basePath}${itemPathNormalized}`;
        
        // Find the track in the global playlist
        const globalAudioIndex = musicPlayerState.playlist.findIndex(track => {
            return track.path === fullItemPath || track.path.endsWith(itemPathNormalized);
        });
        
        if (globalAudioIndex !== -1) {
            // Track found in playlist - play it in persistent player
            playTrackInPlayer(globalAudioIndex);
            
            // Update active state - find the clicked element by path
            document.querySelectorAll('.file-tree-item').forEach(item => {
                item.classList.remove('active');
                // Check if this item matches the clicked path
                const itemPath = item.getAttribute('data-path');
                if (itemPath === path || itemPath === name) {
                    item.classList.add('active');
                }
            });
            
            // Don't show preview - just play in persistent player
            return;
        }
        // If track not found in playlist, fall through to show preview
    }
    
    // Store previous view state before switching to preview
    if (currentView === 'bento') {
        // We're coming from bento view - store current state
        previousViewState = {
            view: 'bento',
            folderContext: currentFolderContext,
            searchQuery: searchQuery
        };
        currentView = 'preview';
    } else if (currentView === 'preview') {
        // Already in preview - update previous state to current folder
        const folderPath = path.substring(0, path.lastIndexOf('/'));
        previousViewState = {
            view: 'bento',
            folderContext: folderPath || null,
            searchQuery: ''
        };
    } else {
        // Coming from file tree or other view - determine folder from path
        const folderPath = path.substring(0, path.lastIndexOf('/'));
        previousViewState = {
            view: 'bento',
            folderContext: folderPath || null,
            searchQuery: ''
        };
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
    
    // Back button HTML
    const backButtonHTML = previousViewState ? `
        <button class="back-button" id="back-button" title="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Back</span>
        </button>
    ` : '';
    
    let previewHTML = '';
    
    if (['mp4', 'webm', 'mov'].includes(fileExtension)) {
        previewHTML = `
            <div class="asset-preview">
                ${backButtonHTML}
                <div class="video-preview-container">
                    <video controls autoplay playsinline>
                        <source src="${assetUrl}" type="video/${fileExtension === 'mov' ? 'quicktime' : fileExtension}">
                        Your browser does not support the video tag.
                    </video>
                </div>
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
                ${backButtonHTML}
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
                ${backButtonHTML}
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
                ${backButtonHTML}
                <div class="asset-info">
                    <h3>${escapeHtml(name)}</h3>
                    <p class="asset-path">${escapeHtml(path)}</p>
                    <p>Preview not available for this file type.</p>
                </div>
            </div>
        `;
    }
    
    previewContainer.innerHTML = previewHTML;
    
    // Setup back button if it exists
    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', goBack);
    }
    
    // Animate preview content with Motion.dev
    const previewContent = previewContainer.querySelector('.asset-preview');
    if (previewContent) {
        animate(previewContent,
            { opacity: [0, 1], y: [10, 0] },
            { duration: 0.4, easing: 'ease-out' }
        );
    }
}

// Go back to previous view
function goBack() {
    if (!previousViewState) {
        // Fallback: try to determine folder from current path
        // This shouldn't happen, but just in case
        const activeFile = document.querySelector('.file-tree-item.active');
        if (activeFile) {
            const path = activeFile.getAttribute('data-path');
            if (path) {
                const folderPath = path.substring(0, path.lastIndexOf('/'));
                currentFolderContext = folderPath || null;
            }
        }
        currentView = 'bento';
        renderBentoGrid();
        return;
    }
    
    // Restore previous state
    currentView = previousViewState.view;
    currentFolderContext = previousViewState.folderContext;
    searchQuery = previousViewState.searchQuery || '';
    
    // Update search input if it exists
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = searchQuery;
    }
    
    // Clear active file selection
    document.querySelectorAll('.file-tree-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Update title
    const folderName = currentFolderContext ? currentFolderContext.split('/').pop() || currentFolderContext : 'All';
    document.getElementById('asset-title').textContent = searchQuery 
        ? `Search: ${searchQuery}` 
        : currentFolderContext ? `${folderName} Assets` : 'All Assets';
    
    // Render bento grid
    renderBentoGrid();
    
    // Clear previous view state
    previousViewState = null;
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
            } else if (view === 'showcase') {
                loadShowcasePage();
            } else if (view === 'llms') {
                loadLLMsPage();
            } else if (view === 'brand-kit') {
                loadBrandKitPage();
            }
        });
    });
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

// Load Showcase page content
async function loadShowcasePage() {
    const previewContainer = document.getElementById('asset-preview');
    document.getElementById('asset-title').textContent = 'Showcase';
    
    // Clear search
    searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    const searchClear = document.getElementById('search-clear');
    if (searchClear) searchClear.style.display = 'none';
    
    const showcaseHTML = `
        <div class="showcase-container">
            <div class="showcase-header">
                <h2>ElizaOS Creative Projects</h2>
                <p>Explore projects built with ElizaOS creative assets</p>
            </div>
            <div class="showcase-grid" id="showcase-grid">
                <!-- Projects will be loaded here -->
                <div class="showcase-item">
                    <div class="showcase-thumbnail">
                        <div class="showcase-placeholder">🎨</div>
                    </div>
                    <div class="showcase-info">
                        <h3>Project Name</h3>
                        <p>Project description goes here. This is a placeholder for showcasing ElizaOS creative projects.</p>
                        <a href="#" class="showcase-link" target="_blank">View Project →</a>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    previewContainer.innerHTML = showcaseHTML;
    
    // Animate showcase items
    const showcaseItems = previewContainer.querySelectorAll('.showcase-item');
    if (showcaseItems.length > 0) {
        animate(showcaseItems,
            { opacity: [0, 1], y: [20, 0] },
            { 
                duration: 0.6,
                delay: stagger(0.1),
                easing: 'ease-out'
            }
        );
    }
}

// Load LLMs page content
async function loadLLMsPage() {
    const previewContainer = document.getElementById('asset-preview');
    document.getElementById('asset-title').textContent = 'LLM Resources';
    
    // Clear search
    searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    const searchClear = document.getElementById('search-clear');
    if (searchClear) searchClear.style.display = 'none';
    
    const llmsHTML = `
        <div class="llms-container">
            <div class="llms-header">
                <h2>LLM Tools & Resources</h2>
                <p>Tools, prompts, and guides for creating art with LLMs</p>
            </div>
            
            <div class="llms-section">
                <h3>🔗 Tools & Platforms</h3>
                <div class="llms-links">
                    <a href="https://openai.com/dall-e" target="_blank" class="llms-link-card">
                        <div class="llms-link-icon">🎨</div>
                        <div class="llms-link-info">
                            <h4>DALL-E</h4>
                            <p>AI image generation by OpenAI</p>
                        </div>
                    </a>
                    <a href="https://midjourney.com" target="_blank" class="llms-link-card">
                        <div class="llms-link-icon">🖼️</div>
                        <div class="llms-link-info">
                            <h4>Midjourney</h4>
                            <p>AI art generation platform</p>
                        </div>
                    </a>
                    <a href="https://stability.ai" target="_blank" class="llms-link-card">
                        <div class="llms-link-icon">⚡</div>
                        <div class="llms-link-info">
                            <h4>Stability AI</h4>
                            <p>Open-source AI image models</p>
                        </div>
                    </a>
                    <a href="https://leonardo.ai" target="_blank" class="llms-link-card">
                        <div class="llms-link-icon">🎭</div>
                        <div class="llms-link-info">
                            <h4>Leonardo.ai</h4>
                            <p>AI image generation and editing</p>
                        </div>
                    </a>
                </div>
            </div>
            
            <div class="llms-section">
                <h3>💡 Example Prompts</h3>
                <div class="llms-prompts">
                    <div class="llms-prompt-card">
                        <h4>ElizaOS Character Design</h4>
                        <code class="llms-prompt-text">A sleek, futuristic AI character design for ElizaOS, featuring a minimalist aesthetic with purple and blue accents, digital art style, high detail, 4k</code>
                    </div>
                    <div class="llms-prompt-card">
                        <h4>Ambient Background</h4>
                        <code class="llms-prompt-text">Abstract digital landscape with soft gradients, ambient lighting, cyberpunk atmosphere, suitable for background music visualizer, 16:9 aspect ratio</code>
                    </div>
                    <div class="llms-prompt-card">
                        <h4>Brand Identity</h4>
                        <code class="llms-prompt-text">Modern logo concept for ElizaOS, combining geometric shapes with organic curves, purple and white color scheme, clean and professional, vector style</code>
                    </div>
                </div>
            </div>
            
            <div class="llms-section">
                <h3>📚 How-To Guides</h3>
                <div class="llms-guides">
                    <div class="llms-guide-card">
                        <h4>Getting Started with AI Art</h4>
                        <p>Learn the basics of prompt engineering and how to create effective prompts for AI image generation.</p>
                        <ul>
                            <li>Start with clear subject descriptions</li>
                            <li>Add style modifiers (art style, mood, lighting)</li>
                            <li>Specify technical details (resolution, aspect ratio)</li>
                            <li>Iterate and refine your prompts</li>
                        </ul>
                    </div>
                    <div class="llms-guide-card">
                        <h4>Creating Consistent Brand Assets</h4>
                        <p>Tips for maintaining visual consistency across multiple AI-generated assets for your brand.</p>
                        <ul>
                            <li>Use consistent color palettes</li>
                            <li>Define style keywords to reuse</li>
                            <li>Create a prompt template</li>
                            <li>Save successful prompts for reference</li>
                        </ul>
                    </div>
                    <div class="llms-guide-card">
                        <h4>Optimizing for Different Use Cases</h4>
                        <p>How to tailor your prompts for specific applications like thumbnails, backgrounds, or icons.</p>
                        <ul>
                            <li>Thumbnails: Focus on composition and readability</li>
                            <li>Backgrounds: Consider negative space</li>
                            <li>Icons: Simplify and emphasize clarity</li>
                            <li>Social media: Optimize for platform dimensions</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    previewContainer.innerHTML = llmsHTML;
    
    // Animate sections
    const sections = previewContainer.querySelectorAll('.llms-section');
    if (sections.length > 0) {
        animate(sections,
            { opacity: [0, 1], y: [20, 0] },
            { 
                duration: 0.6,
                delay: stagger(0.15),
                easing: 'ease-out'
            }
        );
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
    isMuted: false,
    isInitialized: false
};

// Initialize persistent music player in header with all audio assets
function initializePersistentMusicPlayer() {
    // Get all audio assets
    const audioAssets = allAssets.filter(asset => {
        const ext = asset.name.split('.').pop().toLowerCase();
        return ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
    });
    
    if (audioAssets.length === 0) {
        // No audio assets, hide player
        const playerContainer = document.getElementById('header-music-player');
        if (playerContainer) playerContainer.style.display = 'none';
        return;
    }
    
    // Show player container
    const playerContainer = document.getElementById('header-music-player');
    if (!playerContainer) return;
    
    playerContainer.style.display = 'block';
    
    // Render player HTML
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
    
    playerContainer.innerHTML = renderMusicPlayerHTML(playlist);
    
    // Setup player functionality
    if (!musicPlayerState.isInitialized) {
        setupMusicPlayer(audioAssets);
        musicPlayerState.isInitialized = true;
    } else {
        // Re-attach event listeners if player was already initialized
        reattachMusicPlayerListeners();
    }
}

// Render music player HTML (for header)
function renderMusicPlayerHTML(playlist) {
    return `
        <div class="music-player-container header-player">
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
                    <div class="music-player-volume-wrapper">
                        <button class="music-player-btn music-player-volume-btn" id="music-player-mute" title="Mute/Unmute">🔊</button>
                        <div class="music-player-volume-expandable" id="music-player-volume-expandable">
                            <input type="range" class="music-player-volume-slider" id="music-player-volume" min="0" max="100" value="100">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Re-attach event listeners for persistent player
function reattachMusicPlayerListeners() {
    const audio = document.getElementById('music-player-audio');
    if (audio && !musicPlayerState.audioElement) {
        musicPlayerState.audioElement = audio;
    }
    
    // Re-attach all event listeners
    setupMusicPlayer([]); // Pass empty array since playlist is already set
}

// renderMusicPlayer function removed - now using persistent header player

// Setup music player functionality
function setupMusicPlayer(audioAssets) {
    const audio = document.getElementById('music-player-audio');
    if (!audio) return;
    
    // Only set audio element if not already set (preserve across navigation)
    if (!musicPlayerState.audioElement) {
        musicPlayerState.audioElement = audio;
    } else {
        // Update reference if element was recreated
        musicPlayerState.audioElement = audio;
    }
    
    // Only load first track if playlist is empty or we're initializing
    if (musicPlayerState.playlist.length > 0 && musicPlayerState.currentTrackIndex === 0 && !musicPlayerState.isInitialized) {
        loadTrack(0);
    }
    
    // Volume controls with expand/collapse
    const volumeSlider = document.getElementById('music-player-volume');
    const muteBtn = document.getElementById('music-player-mute');
    const volumeExpandable = document.getElementById('music-player-volume-expandable');
    
    // Toggle volume slider visibility on mute button click (hold or hover)
    if (muteBtn && volumeExpandable) {
        let volumeTimeout;
        
        muteBtn.addEventListener('mouseenter', () => {
            clearTimeout(volumeTimeout);
            volumeExpandable.classList.add('expanded');
        });
        
        muteBtn.addEventListener('mouseleave', () => {
            volumeTimeout = setTimeout(() => {
                volumeExpandable.classList.remove('expanded');
            }, 500); // Hide after 500ms of mouse leave
        });
        
        // Keep expanded when hovering over the slider
        if (volumeSlider) {
            volumeSlider.addEventListener('mouseenter', () => {
                clearTimeout(volumeTimeout);
                volumeExpandable.classList.add('expanded');
            });
            
            volumeSlider.addEventListener('mouseleave', () => {
                volumeTimeout = setTimeout(() => {
                    volumeExpandable.classList.remove('expanded');
                }, 500);
            });
        }
    }
    
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

// State
let manifest = null;
let currentPath = '';

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadManifest();
    renderRootDirectories();
});

// Load manifest file
async function loadManifest() {
    try {
        // Try to load manifest from public directory
        const response = await fetch('/manifest.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        manifest = await response.json();
    } catch (error) {
        console.error('Error loading manifest:', error);
        const errorMsg = window.location.protocol === 'file:' 
            ? 'Please run "npm run dev" to start the development server. Opening HTML directly from file:// is not supported.'
            : 'Error loading file manifest. Make sure to run "npm run build" first to generate manifest.json';
        document.getElementById('file-tree').innerHTML = 
            `<div class="file-tree-item" style="color: #ff6b6b; padding: 20px;">${errorMsg}</div>`;
    }
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
    itemElement.setAttribute('data-path', name);
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
    } else {
        // Expand
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
    }
}

// Select and preview file
function selectFile(path, name) {
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
    // Remove leading slash from path for asset URL
    const assetPath = path.startsWith('/') ? path.substring(1) : path;
    const assetUrl = `/${assetPath}`;
    
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
                </div>
            </div>
        `;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) {
        previewHTML = `
            <div class="asset-preview">
                <img src="${assetUrl}" alt="${escapeHtml(name)}">
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

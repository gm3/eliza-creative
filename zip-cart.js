/**
 * Zip Cart Module
 * Handles drag-and-drop asset collection and zip file creation
 */

import JSZip from 'jszip';

class ZipCart {
    constructor() {
        this.cart = this.loadCart();
        this.basePath = this.getBasePath();
        this.panel = document.getElementById('zip-cart-panel');
        this.itemsContainer = document.getElementById('zip-cart-items');
        this.emptyState = document.getElementById('zip-cart-empty');
        this.countElement = document.getElementById('zip-cart-count');
        this.badgeElement = document.getElementById('zip-cart-badge');
        this.downloadButton = document.getElementById('zip-cart-download');
        this.triggerButton = document.getElementById('zip-cart-trigger');
        this.closeButton = document.getElementById('zip-cart-close');
        
        this.isOpen = false;
        this.dragOverZone = null;
        
        this.init();
    }

    /**
     * Get base path for asset URLs
     */
    getBasePath() {
        // Try to get from window if available (set by app.js)
        if (window.basePath !== undefined) {
            return window.basePath;
        }
        // Fallback: detect from pathname
        const pathname = window.location.pathname;
        if (pathname.includes('/eliza-creative/')) {
            return '/eliza-creative';
        }
        return '';
    }

    /**
     * Load cart from sessionStorage
     */
    loadCart() {
        try {
            const saved = sessionStorage.getItem('zipCart');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading cart:', e);
            return [];
        }
    }

    /**
     * Save cart to sessionStorage
     */
    saveCart() {
        try {
            sessionStorage.setItem('zipCart', JSON.stringify(this.cart));
        } catch (e) {
            console.error('Error saving cart:', e);
        }
    }

    /**
     * Initialize cart functionality
     */
    init() {
        // Setup event listeners
        this.triggerButton?.addEventListener('click', () => this.togglePanel());
        this.closeButton?.addEventListener('click', () => this.closePanel());
        this.downloadButton?.addEventListener('click', () => this.downloadZip());
        
        // Setup drag-and-drop detection
        this.setupDragAndDrop();
        
        // Render initial cart state
        this.render();
    }

    /**
     * Setup drag-and-drop handlers
     */
    setupDragAndDrop() {
        // Create invisible drag detection zone on right edge
        const dragZone = document.createElement('div');
        dragZone.className = 'zip-cart-drag-zone';
        document.body.appendChild(dragZone);

        // Global drag handlers
        document.addEventListener('dragstart', (e) => {
            // Check for bento items, audio list items, and preview containers
            const draggableItem = e.target.closest('.bento-item, .audio-list-item, .image-container, .video-preview-container, .audio-preview-container');
            if (draggableItem) {
                const path = draggableItem.getAttribute('data-path');
                const name = draggableItem.getAttribute('data-name');
                if (path && name) {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ path, name }));
                    e.dataTransfer.effectAllowed = 'copy';
                }
            }
        });

        // Detect drag over right edge to open panel
        let dragOverTimeout;
        document.addEventListener('dragover', (e) => {
            const rightEdge = window.innerWidth - 50; // 50px from right edge
            if (e.clientX > rightEdge && e.dataTransfer.types.includes('text/plain')) {
                if (!this.isOpen) {
                    clearTimeout(dragOverTimeout);
                    dragOverTimeout = setTimeout(() => {
                        this.openPanel();
                    }, 300); // Small delay to prevent flicker
                }
                dragZone.classList.add('active');
            } else {
                dragZone.classList.remove('active');
                clearTimeout(dragOverTimeout);
            }
        });

        // Handle drop on panel
        this.panel?.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.panel.classList.add('drag-over');
        });

        this.panel?.addEventListener('dragleave', (e) => {
            if (!this.panel.contains(e.relatedTarget)) {
                this.panel.classList.remove('drag-over');
            }
        });

        this.panel?.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.panel.classList.remove('drag-over');
            dragZone.classList.remove('active');

            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.path && data.name) {
                    this.addItem(data.path, data.name);
                }
            } catch (err) {
                console.error('Error parsing drag data:', err);
            }
        });
    }

    /**
     * Add item to cart (no duplicates)
     */
    addItem(path, name) {
        // Check if item already exists
        const exists = this.cart.some(item => item.path === path);
        if (exists) {
            return false; // Item already in cart
        }

        this.cart.push({ path, name });
        this.saveCart();
        this.render();
        this.openPanel(); // Open panel when item is added
        return true;
    }

    /**
     * Remove item from cart
     */
    removeItem(path) {
        this.cart = this.cart.filter(item => item.path !== path);
        this.saveCart();
        this.render();
    }

    /**
     * Clear all items from cart
     */
    clearCart() {
        this.cart = [];
        this.saveCart();
        this.render();
    }

    /**
     * Toggle panel open/closed
     */
    togglePanel() {
        if (this.isOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    /**
     * Open cart panel
     */
    openPanel() {
        this.isOpen = true;
        this.panel?.classList.add('open');
        this.triggerButton?.classList.add('active');
    }

    /**
     * Close cart panel
     */
    closePanel() {
        this.isOpen = false;
        this.panel?.classList.remove('open');
        this.triggerButton?.classList.remove('active');
    }

    /**
     * Render cart items
     */
    render() {
        // Update count
        const count = this.cart.length;
        this.countElement.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
        this.badgeElement.textContent = count;
        
        // Show/hide empty state
        if (count === 0) {
            this.emptyState?.classList.remove('hidden');
            this.itemsContainer?.classList.add('hidden');
            this.downloadButton.disabled = true;
        } else {
            this.emptyState?.classList.add('hidden');
            this.itemsContainer?.classList.remove('hidden');
            this.downloadButton.disabled = false;
        }

        // Render items
        if (this.itemsContainer && count > 0) {
            this.itemsContainer.innerHTML = this.cart.map(item => {
                const ext = item.name.split('.').pop().toLowerCase();
                const type = this.getFileType(ext);
                const icon = this.getFileIcon(type);
                
                return `
                    <div class="zip-cart-item" data-path="${this.escapeHtml(item.path)}">
                        <div class="zip-cart-item-icon">${icon}</div>
                        <div class="zip-cart-item-info">
                            <div class="zip-cart-item-name">${this.escapeHtml(item.name)}</div>
                            <div class="zip-cart-item-path">${this.escapeHtml(item.path)}</div>
                        </div>
                        <button class="zip-cart-item-remove" data-path="${this.escapeHtml(item.path)}" title="Remove">
                            ✕
                        </button>
                    </div>
                `;
            }).join('');

            // Add remove button listeners
            this.itemsContainer.querySelectorAll('.zip-cart-item-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const path = btn.getAttribute('data-path');
                    this.removeItem(path);
                });
            });
        }
    }

    /**
     * Get file type from extension
     */
    getFileType(ext) {
        if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
        if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
        return 'file';
    }

    /**
     * Get icon for file type
     */
    getFileIcon(type) {
        const icons = {
            audio: '🎵',
            video: '🎬',
            image: '🖼️',
            file: '📄'
        };
        return icons[type] || icons.file;
    }

    /**
     * Download all items as zip
     */
    async downloadZip() {
        if (this.cart.length === 0) return;

        this.downloadButton.disabled = true;
        this.downloadButton.textContent = 'Creating Zip...';

        try {
            const zip = new JSZip();
            const basePath = this.basePath;

            // Fetch all files and add to zip
            for (const item of this.cart) {
                try {
                    const assetPath = item.path.startsWith('/') ? item.path : `/${item.path}`;
                    const assetUrl = `${basePath}${assetPath}`;
                    
                    const response = await fetch(assetUrl);
                    if (!response.ok) throw new Error(`Failed to fetch ${item.name}`);
                    
                    const blob = await response.blob();
                    zip.file(item.name, blob);
                } catch (error) {
                    console.error(`Error adding ${item.name} to zip:`, error);
                    // Continue with other files even if one fails
                }
            }

            // Generate zip file
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            // Create download link
            const url = URL.createObjectURL(zipBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `eliza-assets-${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Reset button
            this.downloadButton.disabled = false;
            this.downloadButton.textContent = 'Download Zip';
        } catch (error) {
            console.error('Error creating zip:', error);
            alert('Error creating zip file. Please try again.');
            this.downloadButton.disabled = false;
            this.downloadButton.textContent = 'Download Zip';
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export singleton instance
export default new ZipCart();

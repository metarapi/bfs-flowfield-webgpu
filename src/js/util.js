export async function loadCSVToFloat32Array(filePath) {
    try {
        // Fetch the CSV file
        const response = await fetch(filePath);
        const csvText = await response.text();
        
        // Parse the CSV
        const rows = csvText.trim().split('\n');
        const floatArray = new Float32Array(32 * 32);
        
        for (let y = 0; y < 32; y++) {
            const values = rows[y].split(',');
            for (let x = 0; x < 32; x++) {
                floatArray[y * 32 + x] = parseFloat(values[x]);
            }
        }
        
        return floatArray;
    } catch (error) {
        console.error('Error loading or parsing CSV:', error);
        throw error;
    }
}

export function saveFloat32ArrayAsCSV(floatArray, fileName = 'data.csv') {
    if (floatArray.length !== 32 * 32) {
        throw new Error('Array length must be 1024 (32x32)');
    }

    let csvContent = '';

    // Convert to 32x32 CSV format
    for (let y = 0; y < 32; y++) {
        const row = [];
        for (let x = 0; x < 32; x++) {
            row.push(floatArray[y * 32 + x]);
        }
        csvContent += row.join(',') + '\n';
    }

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Load HTML partial and inject it into the DOM
 * @param {string} partialPath - Path to the HTML partial file
 * @param {string} targetSelector - CSS selector where to inject the HTML
 * @returns {Promise<void>}
 */
export async function loadHTMLPartial(partialPath, targetSelector = 'body') {
    try {
        console.log(`Attempting to fetch: ${partialPath}`);
        const response = await fetch(partialPath);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        console.log(`HTML loaded, length: ${html.length} characters`);
        
        const targetElement = document.querySelector(targetSelector);
        if (targetElement) {
            targetElement.insertAdjacentHTML('beforeend', html);
            console.log(`HTML injected into ${targetSelector}`);
        } else {
            console.warn(`Target element ${targetSelector} not found`);
        }
    } catch (error) {
        console.error('Error loading HTML partial:', error);
        throw error;
    }
}

/**
 * Show a modal with custom content
 * @param {string} modalId - ID of the modal element
 * @param {Object} options - Modal configuration options
 */
export function showModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Update modal content if provided
        if (options.title) {
            const titleElement = modal.querySelector('.modal-title');
            if (titleElement) titleElement.textContent = options.title;
        }
        
        if (options.body) {
            const bodyElement = modal.querySelector('.modal-body');
            if (bodyElement) bodyElement.innerHTML = options.body;
        }
        
        // Show modal
        modal.classList.remove('hidden');
        modal.classList.add('overlay-open');
    }
}

/**
 * Hide a modal
 * @param {string} modalId - ID of the modal element
 */
export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('overlay-open');
    }
}

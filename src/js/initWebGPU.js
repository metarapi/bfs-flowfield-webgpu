import { loadHTMLPartial, showModal } from './util.js';

/**
 * Check WebGPU support and show error modal if not supported
 * @returns {Promise<boolean>} True if WebGPU is supported
 */
export async function checkWebGPUSupport() {
    if (!navigator.gpu) {
        console.log('WebGPU not detected, attempting to show modal...');
        
        try {
            console.log('Loading HTML partial...');
            await loadHTMLPartial('/src/partials/webgpuModal.html');
            console.log('HTML partial loaded, showing modal...');
            showModal('webgpu-error-modal');
            console.log('Modal should be visible now');
        } catch (error) {
            console.error('Failed to load modal:', error);
            
            // Fallback: Create modal dynamically
            createWebGPUErrorModal();
        }
        return false;
    }
    return true;
}

/**
 * Create WebGPU error modal dynamically as fallback
 */
function createWebGPUErrorModal() {
    // Remove any existing modal
    const existing = document.getElementById('webgpu-error-modal');
    if (existing) existing.remove();
    
    // Create modal HTML dynamically
    const modalHTML = `
        <div id="webgpu-error-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-woodsmoke-900 text-sharklite-100 rounded-lg p-6 max-w-md mx-4 border border-woodsmoke-700">
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-brink-pink-400 text-xl font-semibold">WebGPU Not Supported</h3>
                    <button onclick="document.getElementById('webgpu-error-modal').remove()" 
                            class="text-sharklite-300 hover:text-white text-2xl leading-none">
                        &times;
                    </button>
                </div>
                <div class="flex items-start gap-4 mb-6">
                    <div class="text-brink-pink-400 text-3xl">
                        ⚠️
                    </div>
                    <div>
                        <p class="text-sharklite-200 mb-4">
                            Your browser does not support WebGPU, which is required to run this application.
                        </p>
                        <p class="text-sharklite-300 mb-4">
                            Please check the link below to see which browsers support WebGPU and how to enable it.
                        </p>
                        <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API" 
                           target="_blank" 
                           rel="noopener noreferrer"
                           class="inline-flex items-center gap-2 text-brink-pink-400 hover:text-brink-pink-300 underline">
                            🔗 WebGPU Browser Support Information
                        </a>
                    </div>
                </div>
                <div class="flex justify-end">
                    <button onclick="document.getElementById('webgpu-error-modal').remove()" 
                            class="px-4 py-2 bg-woodsmoke-800 text-sharklite-200 hover:bg-woodsmoke-700 rounded border border-woodsmoke-600">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Insert modal into DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    console.log('Fallback modal created and inserted');
}

/**
 * Initialize WebGPU device with required features and limits
 * @returns {Promise<GPUDevice>} WebGPU device
 */
export async function initWebGPU() {
    // Check WebGPU support first
    const isSupported = await checkWebGPUSupport();
    if (!isSupported) {
        throw new Error("WebGPU not supported on this browser.");
    }

    // Initialize WebGPU
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
    });

    if (!adapter) {
        throw new Error("No WebGPU adapter found.");
    }

    const device = await adapter.requestDevice({
        requiredLimits: {
            maxComputeWorkgroupStorageSize: 16384,  // 16KB
            maxStorageBufferBindingSize: 134217728  // 128MB
        }
    });

    console.log("WebGPU initialized successfully");
    return device;
}
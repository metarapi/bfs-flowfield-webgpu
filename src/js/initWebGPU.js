/**
 * Initialize WebGPU device with required features and limits
 * @returns {Promise<GPUDevice>} WebGPU device
 */
export async function initWebGPU() {
    // Check WebGPU support
    if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
    }

    // Initialize WebGPU
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
    });

    const device = await adapter.requestDevice({
        requiredLimits: {
            maxComputeWorkgroupStorageSize: 16384,  // 16KB
            maxStorageBufferBindingSize: 134217728  // 128MB
        }
    });

    console.log("WebGPU initialized successfully");
    return device;
}
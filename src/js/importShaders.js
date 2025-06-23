export async function getShaders() {
    const shaderPaths = [
        // Compute shaders
        "BFS",
        "BFSNoRelaxation",
        "gradient",
        // Vertex and fragment
        "obstacleGrid",
        "distanceGrid",
        "flowfield",
    ];

    // Get the base URL for shaders based on environment
    const getShaderUrl = (shaderName) => {
        // For production build, the files will be in the same directory structure
        return new URL(`../shaders/${shaderName}.wgsl`, import.meta.url).href;
    };

    const shaders = {};
    await Promise.all(shaderPaths.map(async (path) => {
        try {
            const response = await fetch(getShaderUrl(path));
            if (!response.ok) {
                throw new Error(`Failed to load shader ${path}: ${response.status}`);
            }
            shaders[path] = await response.text();

            // Validation for WebGPU shaders
            const hasComputeEntry = shaders[path].includes('fn main(');
            const hasVertexEntry = shaders[path].includes('fn vs(');
            const hasFragmentEntry = shaders[path].includes('fn fs(');
            
            if (!hasComputeEntry && !hasVertexEntry && !hasFragmentEntry) {
                console.warn(`Warning: Shader ${path} might be missing entry points (main/vs/fs)`);
            }
        } catch (error) {
            console.error(`Error loading shader ${path}:`, error);
        }
    }));

    return shaders;
}
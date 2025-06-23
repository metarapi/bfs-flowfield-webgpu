import { getShaders } from './importShaders.js';

export async function initPipelines(device) {
    const shaders = await getShaders();

    // Shader modules
    const bfsModule = device.createShaderModule({
        label: 'BFS Shader',
        code: shaders.BFS
    });

    // BFS No Relaxation module
    const bfsNoRelaxationModule = device.createShaderModule({
        label: 'BFS No Relaxation Shader',
        code: shaders.BFSNoRelaxation
    });

    const gradientModule = device.createShaderModule({
        label: 'Gradient Shader',
        code: shaders.gradient
    });

    // Bind group layouts (same for both BFS variants)
    const bfsBindGroupLayout = device.createBindGroupLayout({
        label: 'BFS Bind Group Layout',
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' }},
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' }},
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' }},
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' }}
        ]
    });

    const gradientBindGroupLayout = device.createBindGroupLayout({
        label: 'Gradient Bind Group Layout',
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' }},
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' }},
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' }},
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' }}
        ]
    });

    // Pipeline layouts
    const bfsPipelineLayout = device.createPipelineLayout({
        label: 'BFS Pipeline Layout',
        bindGroupLayouts: [bfsBindGroupLayout]
    });

    const gradientPipelineLayout = device.createPipelineLayout({
        label: 'Gradient Pipeline Layout',
        bindGroupLayouts: [gradientBindGroupLayout]
    });

    // Pipelines (probably should've gone with 'auto' for the layouts)
    const bfsPipeline = device.createComputePipeline({
        label: 'BFS Pipeline',
        layout: bfsPipelineLayout,
        compute: { module: bfsModule, entryPoint: 'main'}
    });

    const bfsNoRelaxationPipeline = device.createComputePipeline({
        label: 'BFS No Relaxation Pipeline',
        layout: bfsPipelineLayout, // Same layout
        compute: { module: bfsNoRelaxationModule, entryPoint: 'main'}
    });

    const gradientPipeline = device.createComputePipeline({
        label: 'Gradient Pipeline',
        layout: gradientPipelineLayout,
        compute: { module: gradientModule, entryPoint: 'main'}
    });

    // Pipelines and their layouts
    const pipelines = {
        bfs: {
            pipeline: bfsPipeline,
            bindGroupLayout: bfsBindGroupLayout,
            layout: bfsPipelineLayout
        },
        bfsNoRelaxation: {
            pipeline: bfsNoRelaxationPipeline,
            bindGroupLayout: bfsBindGroupLayout, // Same layout
            layout: bfsPipelineLayout
        },
        gradient: {
            pipeline: gradientPipeline,
            bindGroupLayout: gradientBindGroupLayout,
            layout: gradientPipelineLayout
        }
    };

    console.log("Pipelines initialized successfully");
    return pipelines;
}
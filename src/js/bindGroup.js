export async function initBindGroups(device, buffers, pipelines) {

    const bfsPing = device.createBindGroup({
        label: 'BFS Bind Group (Ping)',
        layout: pipelines.bfs.bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: buffers.gridBuffer }},
            { binding: 1, resource: { buffer: buffers.distanceBufferPing }},
            { binding: 2, resource: { buffer: buffers.distanceBufferPong }},
            { binding: 3, resource: { buffer: buffers.uniformBuffer }}
        ]
    });

    const bfsPong = device.createBindGroup({
        label: 'BFS Bind Group (Pong)',
        layout: pipelines.bfs.bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: buffers.gridBuffer }},
            { binding: 1, resource: { buffer: buffers.distanceBufferPong }},
            { binding: 2, resource: { buffer: buffers.distanceBufferPing }},
            { binding: 3, resource: { buffer: buffers.uniformBuffer }}
        ]
    });

    const gradient = device.createBindGroup({
        label: 'Gradient Bind Group',
        layout: pipelines.gradient.bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: buffers.gridBuffer }},
            { binding: 1, resource: { buffer: buffers.distanceBufferPing }},
            { binding: 2, resource: { buffer: buffers.flowfieldBuffer }},
            { binding: 3, resource: { buffer: buffers.uniformBuffer }}
        ]
    });

    const bindGroups = {
        bfsPing: bfsPing,
        bfsPong: bfsPong,
        gradient: gradient,
                getGradientBindGroup: (usesPingPong) => {
            // Return bind group that reads from the correct output buffer
            const inputBuffer = usesPingPong ? buffers.distanceBufferPong : buffers.distanceBufferPing;
            
            return device.createBindGroup({
                label: 'Dynamic Gradient Bind Group',
                layout: pipelines.gradient.bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: buffers.gridBuffer } },
                    { binding: 1, resource: { buffer: inputBuffer } },
                    { binding: 2, resource: { buffer: buffers.flowfieldBuffer } },
                    { binding: 3, resource: { buffer: buffers.uniformBuffer } }
                ]
            });
        }
    };

    return bindGroups;
}
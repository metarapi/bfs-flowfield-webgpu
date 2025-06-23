export async function initBuffers(device, gridSize, numberOfCells) {

    const gridData = new Float32Array(numberOfCells).fill(1); // Initialize with ones
    const distanceDataPing = new Float32Array(numberOfCells).fill(0); // Initialize with 0s
    const flowfieldData = new Float32Array(numberOfCells * 2).fill(0); // Initialize with zeros (2D vector)
    const uniformData = new ArrayBuffer(16);
    const dataView = new DataView(uniformData);
    let offset = 0;

    dataView.setUint32(offset, gridSize, true); offset += 4; // gridSizeX
    dataView.setUint32(offset, gridSize, true); offset += 4; // gridSizeY
    dataView.setFloat32(offset, Math.sqrt(2), true); offset += 4; // precomputed diagonal distance
    dataView.setFloat32(offset, 1/Math.sqrt(2), true); // precomputed inverse diagonal distance

    const uniformBuffer = device.createBuffer({
        label: 'Uniform Buffer',
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const gridBuffer = device.createBuffer({
        label: 'Grid Buffer',
        size: gridData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const distanceBufferPing = device.createBuffer({
        label: 'Distance Buffer (Ping)',
        size: distanceDataPing.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const distanceBufferPong = device.createBuffer({
        label: 'Distance Buffer (Pong)',
        size: distanceDataPing.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });    

    const flowfieldBuffer = device.createBuffer({
        label: 'Flowfield Buffer',
        size: flowfieldData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    device.queue.writeBuffer(gridBuffer, 0, gridData);
    device.queue.writeBuffer(distanceBufferPing, 0, distanceDataPing);
    device.queue.writeBuffer(distanceBufferPong, 0, distanceDataPing);
    device.queue.writeBuffer(flowfieldBuffer, 0, flowfieldData);

    const buffers = {
        uniformBuffer: uniformBuffer,
        gridBuffer: gridBuffer,
        distanceBufferPing: distanceBufferPing,
        distanceBufferPong: distanceBufferPong,
        flowfieldBuffer: flowfieldBuffer,
    };

    return buffers;
}
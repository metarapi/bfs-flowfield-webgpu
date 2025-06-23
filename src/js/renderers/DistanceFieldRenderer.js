import { getShaders } from '../importShaders.js';

export class DistanceFieldRenderer {
  constructor(device, canvas, gridSize = 32) {
    this.device = device;
    this.canvas = canvas;
    this.context = canvas.getContext('webgpu');
    this.gridSize = gridSize;
    this.numberOfCells = gridSize * gridSize;
    
    // Configure canvas
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: presentationFormat,
    });
    this.presentationFormat = presentationFormat;
    
    // Rendering resources
    this.pipeline = null;
    this.bindGroup = null;
    this.positionBuffer = null;
    this.uvBuffer = null;
    this.indexBuffer = null;
    this.instanceBuffer = null;
    this.uniformBuffer = null;
    this.distanceDataBuffer = null; // Will be set from simulation
    
    // Make initialization async and wait for it
    this.initPromise = this.initialize();
  }

  async initialize() {
    await this.createShaderPipeline();
    this.createQuadBuffers();
    this.createUniformBuffer();
    
    console.log("DistanceFieldRenderer initialized");
  }

  async createShaderPipeline() {
    const shaders = await getShaders();
    const shaderCode = shaders.distanceGrid;
    
    if (!shaderCode) {
      throw new Error("Failed to load distanceGrid shader");
    }

    const shaderModule = this.device.createShaderModule({
      label: 'Distance Field Shader',
      code: shaderCode
    });

    this.pipeline = this.device.createRenderPipeline({
      label: 'Distance Field Pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: 8, // 2 floats * 4 bytes
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' } // position
            ]
          },
          {
            arrayStride: 8, // 2 floats * 4 bytes
            attributes: [
              { shaderLocation: 1, offset: 0, format: 'float32x2' } // uv
            ]
          },
          {
            arrayStride: 8, // 2 u32s * 4 bytes
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 2, offset: 0, format: 'uint32' },   // gridX
              { shaderLocation: 3, offset: 4, format: 'uint32' }    // gridY
            ]
          }
        ]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{ format: this.presentationFormat }]
      }
    });
  }

  createQuadBuffers() {
    // Reuse the same quad buffer logic as ObstacleGridRenderer
    const positions = new Float32Array([
      0, 0, 1, 0, 0, 1, 1, 1
    ]);

    this.positionBuffer = this.device.createBuffer({
      label: "Distance field quad positions",
      size: positions.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(this.positionBuffer.getMappedRange()).set(positions);
    this.positionBuffer.unmap();

    const uvs = new Float32Array([
      0, 0, 1, 0, 0, 1, 1, 1
    ]);

    this.uvBuffer = this.device.createBuffer({
      label: "Distance field quad UVs",
      size: uvs.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(this.uvBuffer.getMappedRange()).set(uvs);
    this.uvBuffer.unmap();

    const indices = new Uint16Array([0, 1, 2, 2, 1, 3]);

    this.indexBuffer = this.device.createBuffer({
      label: "Distance field quad indices",
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true
    });
    new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
    this.indexBuffer.unmap();

    // Create grid cell instance data
    const instanceData = new Uint32Array(this.numberOfCells * 2);
    let idx = 0;
    for (let j = 0; j < this.gridSize; j++) {
      for (let i = 0; i < this.gridSize; i++) {
        instanceData[idx++] = i;  // x grid coordinate
        instanceData[idx++] = j;  // y grid coordinate
      }
    }

    this.instanceBuffer = this.device.createBuffer({
      label: "Distance field instance data",
      size: instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Uint32Array(this.instanceBuffer.getMappedRange()).set(instanceData);
    this.instanceBuffer.unmap();
  }

  createUniformBuffer() {
    const uniformData = new Float32Array([
      this.gridSize,    // gridSizeX
      this.gridSize,    // gridSizeY
      50.0,             // maxDistance (initial estimate)
      0.0               // padding
    ]);

    this.uniformBuffer = this.device.createBuffer({
      label: "Distance field uniform buffer",
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.uniformBuffer.getMappedRange()).set(uniformData);
    this.uniformBuffer.unmap();
  }

  async setDistanceBuffer(distanceBuffer) {
    await this.initPromise;
    this.distanceDataBuffer = distanceBuffer;
    this.createBindGroup();
  }

  createBindGroup() {
    if (!this.distanceDataBuffer || !this.pipeline) {
      return;
    }

    this.bindGroup = this.device.createBindGroup({
      label: 'Distance Field Bind Group',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.distanceDataBuffer } }
      ]
    });
  }

  updateMaxDistance(maxDistance) {
    const uniformData = new Float32Array([
      this.gridSize,    // gridSizeX
      this.gridSize,    // gridSizeY
      maxDistance,      // maxDistance
      0.0               // padding
    ]);
    
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  async render() {
    await this.initPromise;
    
    if (!this.bindGroup) {
      return;
    }

    const renderPassDescriptor = {
      label: 'Distance Field Render Pass',
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: [0.0, 0.0, 0.0, 1.0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    const commandEncoder = this.device.createCommandEncoder({ label: 'Distance Field Encoder' });
    const pass = commandEncoder.beginRenderPass(renderPassDescriptor);
    
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    
    pass.setVertexBuffer(0, this.positionBuffer);
    pass.setVertexBuffer(1, this.uvBuffer);
    pass.setVertexBuffer(2, this.instanceBuffer);
    pass.setIndexBuffer(this.indexBuffer, 'uint16');
    
    pass.drawIndexed(6, this.numberOfCells, 0, 0, 0);
    
    pass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }
}
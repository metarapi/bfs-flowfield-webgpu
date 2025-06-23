import { getShaders } from '../importShaders.js';

export class FlowfieldRenderer {
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
    this.arrowVertexBuffer = null;
    this.instanceBuffer = null;
    this.uniformBuffer = null;
    this.flowfieldDataBuffer = null; // Will be set from simulation
    
    // Make initialization async and wait for it
    this.initPromise = this.initialize();
  }

  async initialize() {
    await this.createShaderPipeline();
    this.createArrowBuffers();
    this.createUniformBuffer();
    
    console.log("FlowfieldRenderer initialized");
  }

  async createShaderPipeline() {
    const shaders = await getShaders();
    const shaderCode = shaders.flowfield;
    
    if (!shaderCode) {
      throw new Error("Failed to load flowfield shader");
    }

    const shaderModule = this.device.createShaderModule({
      label: 'Flowfield Shader',
      code: shaderCode
    });

    this.pipeline = this.device.createRenderPipeline({
      label: 'Flowfield Pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: 8, // 2 floats * 4 bytes
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' } // arrow vertex position
            ]
          },
          {
            arrayStride: 8, // 2 u32s * 4 bytes
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 1, offset: 0, format: 'uint32' },   // gridX
              { shaderLocation: 2, offset: 4, format: 'uint32' }    // gridY
            ]
          }
        ]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{
          format: this.presentationFormat,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha'
            }
          }
        }]
      }
    });
  }

  createArrowBuffers() {
    // Create a proper arrow shape with shaft and arrowhead
    const arrowVertices = new Float32Array([
      // Arrow shaft (rectangle)
      -0.25, -0.05,  // shaft bottom-left
       0.15, -0.05,  // shaft bottom-right
       0.15,  0.05,  // shaft top-right
      -0.25,  0.05,  // shaft top-left
      
      // Arrow head (triangle)
       0.15, -0.15,  // arrowhead bottom
       0.35,  0.0,   // arrowhead tip
       0.15,  0.15   // arrowhead top
    ]);

    // Arrow indices to form triangles
    const arrowIndices = new Uint16Array([
      // Shaft (2 triangles)
      0, 1, 2,
      2, 3, 0,
      
      // Arrowhead (1 triangle)
      4, 5, 6
    ]);

    this.arrowVertexBuffer = this.device.createBuffer({
      label: "Arrow vertex buffer",
      size: arrowVertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(this.arrowVertexBuffer.getMappedRange()).set(arrowVertices);
    this.arrowVertexBuffer.unmap();

    // Create index buffer for the arrow - pad size to multiple of 4
    const paddedIndexSize = Math.ceil(arrowIndices.byteLength / 4) * 4;

    // Create index buffer for the arrow
    this.arrowIndexBuffer = this.device.createBuffer({
      label: "Arrow index buffer",
      size: paddedIndexSize, // Use padded size
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true
    });

    // Only write the actual data we have
    const indexView = new Uint16Array(this.arrowIndexBuffer.getMappedRange());
    indexView.set(arrowIndices);
    this.arrowIndexBuffer.unmap();

    // Create instance data for each grid cell (unchanged)
    const instanceData = new Uint32Array(this.numberOfCells * 2);
    let idx = 0;
    for (let j = 0; j < this.gridSize; j++) {
      for (let i = 0; i < this.gridSize; i++) {
        instanceData[idx++] = i;  // x grid coordinate
        instanceData[idx++] = j;  // y grid coordinate
      }
    }

    this.instanceBuffer = this.device.createBuffer({
      label: "Flowfield instance data",
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
      1.5,              // arrowScale (increased from 0.4)
      0.0               // padding
    ]);

    this.uniformBuffer = this.device.createBuffer({
      label: "Flowfield uniform buffer",
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.uniformBuffer.getMappedRange()).set(uniformData);
    this.uniformBuffer.unmap();
  }

  async setFlowfieldBuffer(flowfieldBuffer) {
    await this.initPromise;
    this.flowfieldDataBuffer = flowfieldBuffer;
    this.createBindGroup();
  }

  createBindGroup() {
    if (!this.flowfieldDataBuffer || !this.pipeline) {
      return;
    }

    this.bindGroup = this.device.createBindGroup({
      label: 'Flowfield Bind Group',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.flowfieldDataBuffer } }
      ]
    });
  }

  async render() {
    await this.initPromise;
    
    if (!this.bindGroup) {
      return;
    }

    const renderPassDescriptor = {
      label: 'Flowfield Render Pass',
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: [0.1, 0.1, 0.1, 1.0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    const commandEncoder = this.device.createCommandEncoder({ label: 'Flowfield Encoder' });
    const pass = commandEncoder.beginRenderPass(renderPassDescriptor);
    
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    
    pass.setVertexBuffer(0, this.arrowVertexBuffer);
    pass.setVertexBuffer(1, this.instanceBuffer);
    pass.setIndexBuffer(this.arrowIndexBuffer, 'uint16');
    
    // Draw indexed triangles (9 indices per arrow: 6 for shaft + 3 for head)
    pass.drawIndexed(9, this.numberOfCells, 0, 0, 0);
    
    pass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }
}
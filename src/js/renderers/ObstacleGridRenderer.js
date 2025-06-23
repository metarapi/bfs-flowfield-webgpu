import { getShaders } from '../importShaders.js';

export class ObstacleGridRenderer {
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
    this.gridDataBuffer = null;
    
    // Grid interaction
    this.currentSourcePos = null;
    this.updateCellCallback = null;
    this.isDragging = false;
    
    // Make initialization async and wait for it
    this.initPromise = this.initialize();
  }

  async initialize() {
    await this.createShaderPipeline();
    this.createQuadBuffers();
    this.createUniformBuffer();
    this.setupInteraction();
    
    console.log("ObstacleGridRenderer initialized");
  }

  async createShaderPipeline() {
    const shaders = await getShaders();
    const shaderCode = shaders.obstacleGrid;
    
    if (!shaderCode) {
      throw new Error("Failed to load obstacleGrid shader");
    }

    const shaderModule = this.device.createShaderModule({
      label: 'Obstacle Grid Shader',
      code: shaderCode
    });

    this.pipeline = this.device.createRenderPipeline({
      label: 'Obstacle Grid Pipeline',
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
    // Vertex buffer (positions)
    const positions = new Float32Array([
      0, 0,    // Bottom left
      1, 0,    // Bottom right
      0, 1,    // Top left
      1, 1     // Top right
    ]);

    this.positionBuffer = this.device.createBuffer({
      label: "Grid quad positions",
      size: positions.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(this.positionBuffer.getMappedRange()).set(positions);
    this.positionBuffer.unmap();

    // UV buffer
    const uvs = new Float32Array([
      0, 0,    // Bottom left
      1, 0,    // Bottom right
      0, 1,    // Top left
      1, 1     // Top right
    ]);

    this.uvBuffer = this.device.createBuffer({
      label: "Grid quad UVs",
      size: uvs.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(this.uvBuffer.getMappedRange()).set(uvs);
    this.uvBuffer.unmap();

    // Index buffer
    const indices = new Uint16Array([
      0, 1, 2,    // First triangle
      2, 1, 3     // Second triangle
    ]);

    this.indexBuffer = this.device.createBuffer({
      label: "Grid quad indices",
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true
    });
    new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
    this.indexBuffer.unmap();

    // Create grid cell instance data
    this.createGridInstanceData();
  }

  createGridInstanceData() {
    const instanceCount = this.numberOfCells;
    
    // Each instance needs its grid coordinates
    const instanceData = new Uint32Array(instanceCount * 2);

    let idx = 0;
    for (let j = 0; j < this.gridSize; j++) {
      for (let i = 0; i < this.gridSize; i++) {
        instanceData[idx++] = i;  // x grid coordinate
        instanceData[idx++] = j;  // y grid coordinate
      }
    }

    this.instanceBuffer = this.device.createBuffer({
      label: "Grid instance data",
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
      this.canvas.width,  // canvasWidth
      this.canvas.height, // canvasHeight
      this.gridSize / 2,  // goalX (initial)
      this.gridSize / 2   // goalY (initial)
    ]);

    this.uniformBuffer = this.device.createBuffer({
      label: "Grid uniform buffer",
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.uniformBuffer.getMappedRange()).set(uniformData);
    this.uniformBuffer.unmap();
  }

  async setGridDataBuffer(gridBuffer) {
    // Wait for initialization to complete before proceeding
    await this.initPromise;
    
    this.gridDataBuffer = gridBuffer;
    this.createBindGroup();
  }

  createBindGroup() {
    if (!this.gridDataBuffer) {
      console.warn("Grid data buffer not set yet");
      return;
    }

    if (!this.pipeline) {
      console.warn("Pipeline not ready yet");
      return;
    }

    this.bindGroup = this.device.createBindGroup({
      label: 'Obstacle Grid Bind Group',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.gridDataBuffer } }
      ]
    });
  }

  setupInteraction() {
    // Function to convert mouse coordinates to grid coordinates
    const getGridCoordinates = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      const gridX = Math.floor((mouseX / rect.width) * this.gridSize);
      // Flip the Y coordinate by subtracting from gridSize-1
      const gridY = (this.gridSize - 1) - Math.floor((mouseY / rect.height) * this.gridSize);
      
      if (gridX >= 0 && gridX < this.gridSize && gridY >= 0 && gridY < this.gridSize) {
        return { x: gridX, y: gridY };
      }
      return null;
    };

    // Click handler
    this.canvas.addEventListener('click', (event) => {
      const coords = getGridCoordinates(event);
      if (!coords || !this.updateCellCallback) return;
      
      // Get drawing mode from a dropdown (you'll need to add this to your HTML)
      const drawingModeSelect = document.getElementById('drawingMode');
      const mode = drawingModeSelect ? drawingModeSelect.value : 'traversable';
      
      if (mode === 'source') {
        this.handleSourcePlacement(coords.x, coords.y);
      } else {
        let cellType;
        switch (mode) {
          case 'obstacle': cellType = 0.0; break;
          case 'difficult': cellType = 0.3; break;
          default: cellType = 1.0; break; // traversable
        }
        this.updateCellCallback(coords.x, coords.y, cellType);
      }
    });

    // Drag painting
    this.canvas.addEventListener('mousedown', (event) => {
      const drawingModeSelect = document.getElementById('drawingMode');
      const mode = drawingModeSelect ? drawingModeSelect.value : 'traversable';
      // Allow all modes except 'source' for drag painting
      if (mode !== 'source') {
        this.isDragging = true;
        
        // Apply the brush immediately on mousedown
        const coords = getGridCoordinates(event);
        if (coords && this.updateCellCallback) {
          let cellType;
          switch (mode) {
            case 'obstacle': cellType = 0.0; break;
            case 'difficult': cellType = 0.3; break;
            default: cellType = 1.0; break; // traversable
          }
          this.updateCellCallback(coords.x, coords.y, cellType);
        }
      }
    });

    this.canvas.addEventListener('mousemove', (event) => {
      if (!this.isDragging || !this.updateCellCallback) return;
      
      const coords = getGridCoordinates(event);
      if (!coords) return;
      
      const drawingModeSelect = document.getElementById('drawingMode');
      const mode = drawingModeSelect ? drawingModeSelect.value : 'traversable';
      
      // Apply the brush based on the current mode
      let cellType;
      switch (mode) {
        case 'obstacle': cellType = 0.0; break;
        case 'difficult': cellType = 0.3; break;
        default: cellType = 1.0; break; // traversable
      }
      this.updateCellCallback(coords.x, coords.y, cellType);
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }

  updateGoalPosition(x, y) {
    const uniformData = new Float32Array([
      this.gridSize,    // gridSizeX
      this.gridSize,    // gridSizeY
      this.canvas.width,  // canvasWidth
      this.canvas.height, // canvasHeight
      x,                  // goalX
      y                   // goalY
    ]);
    
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  handleSourcePlacement(gridX, gridY) {
    // Update goal position in renderer
    this.currentSourcePos = { x: gridX, y: gridY };
    this.updateGoalPosition(gridX, gridY);
    
    // Let the simulation know about the goal change
    if (this.updateCellCallback) {
      this.updateCellCallback(gridX, gridY, 3.0); // This will trigger setGoal in simulation
    }
  }

  async render() {
    // Wait for initialization to complete
    await this.initPromise;
    
    if (!this.bindGroup) {
      console.warn("Bind group not ready for rendering");
      return;
    }

    const renderPassDescriptor = {
      label: 'Obstacle Grid Render Pass',
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: [0.1, 0.1, 0.1, 1.0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    const commandEncoder = this.device.createCommandEncoder({ label: 'Obstacle Grid Encoder' });
    const pass = commandEncoder.beginRenderPass(renderPassDescriptor);
    
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    
    // Set vertex buffers
    pass.setVertexBuffer(0, this.positionBuffer);
    pass.setVertexBuffer(1, this.uvBuffer);
    pass.setVertexBuffer(2, this.instanceBuffer);
    pass.setIndexBuffer(this.indexBuffer, 'uint16');
    
    // Draw instanced quads (one per grid cell)
    pass.drawIndexed(6, this.numberOfCells, 0, 0, 0);
    
    pass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  getCurrentSourcePos() {
    return this.currentSourcePos;
  }

  initializeSource(gridData) {
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const index = y * this.gridSize + x;
        if (gridData[index] === 3.0) { // SOURCE
          this.currentSourcePos = { x, y };
          return;
        }
      }
    }
    this.currentSourcePos = null;
  }

  setUpdateCellCallback(callback) {
    this.updateCellCallback = callback;
  }
}
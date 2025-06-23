import { initWebGPU } from './initWebGPU.js';
import { initBuffers } from './buffers.js';
import { initPipelines } from './pipelines.js';
import { initBindGroups } from './bindGroup.js';
import { loadCSVToFloat32Array, saveFloat32ArrayAsCSV } from './util.js';
import { ObstacleGridRenderer } from './renderers/ObstacleGridRenderer.js';
import { DistanceFieldRenderer } from './renderers/DistanceFieldRenderer.js';
import { FlowfieldRenderer } from './renderers/FlowfieldRenderer.js';

export class PathfindingSimulation {
    constructor(canvases = {}, gridSize = 32) {
        this.canvases = canvases;
        this.gridSize = gridSize;
        this.numberOfCells = gridSize * gridSize;

        // WebGPU device (will be initialized)
        this.device = null;

        // Simulation state
        this.isRunning = false;
        this.currentIteration = 0;
        this.maxIterations = 512;
        this.usesPingPong = true;
        this.useRelaxation = true; // Default to relaxation enabled

        // WebGPU resources (will be initialized)
        this.buffers = null;
        this.pipelines = null;
        this.bindGroups = null;

        // Header elements for blinking effect
        this.distanceFieldHeader = null;
        this.flowfieldHeader = null;

        // Grid data
        this.gridData = new Float32Array(this.numberOfCells).fill(1.0); // Default: passable
        this.goalX = Math.floor(gridSize / 2);
        this.goalY = Math.floor(gridSize / 2);

        // Simulation control
        this.simulationSpeed = 100; // milliseconds between iterations
        this.maxDistanceValue = 50.0; // Track max distance for LUT scaling

        // Convergence detection
        this.hasConverged = false;
        this.lastIterationData = null;

        // Renderers (will be initialized)
        this.obstacleRenderer = null;
        this.distanceRenderer = null;
        this.flowfieldRenderer = null;
    }

    async initialize() {
        try {
            console.log("Initializing PathfindingSimulation...");

            // Initialize WebGPU device first
            this.device = await initWebGPU();
            console.log("WebGPU device initialized");

            // Initialize in order: buffers -> pipelines -> bind groups
            this.buffers = await initBuffers(this.device, this.gridSize, this.numberOfCells);
            this.pipelines = await initPipelines(this.device);
            this.bindGroups = await initBindGroups(this.device, this.buffers, this.pipelines);

            // Set initial goal
            this.setGoal(this.goalX, this.goalY);

            console.log("PathfindingSimulation initialized successfully");
            return this.device; // Return the device for canvas setup
        } catch (error) {
            console.error("Failed to initialize PathfindingSimulation:", error);
            throw error;
        }
    }

    // Initialize header elements for blinking effect
    initializeHeaderElements() {
        this.distanceFieldHeader = document.getElementById('distanceFieldHeader');
        this.flowfieldHeader = document.getElementById('flowfieldHeader');
    }

    // Add blinking effect when simulation is running
    startBlinking() {
        if (this.distanceFieldHeader) {
            this.distanceFieldHeader.classList.add('motion-preset-blink');
        }
        if (this.flowfieldHeader) {
            this.flowfieldHeader.classList.add('motion-preset-blink');
        }
    }

    // Stop blinking effect when simulation stops
    stopBlinking() {
        if (this.distanceFieldHeader) {
            this.distanceFieldHeader.classList.remove('motion-preset-blink');
        }
        if (this.flowfieldHeader) {
            this.flowfieldHeader.classList.remove('motion-preset-blink');
        }
    }

    // Initialize renderers after canvases are available
    async initializeRenderers() {
        if (this.canvases.obstacleCanvas) {
            this.obstacleRenderer = new ObstacleGridRenderer(
                this.device,
                this.canvases.obstacleCanvas,
                this.gridSize
            );

            await this.obstacleRenderer.setGridDataBuffer(this.buffers.gridBuffer);

            // Set up the callback for grid updates
            this.obstacleRenderer.setUpdateCellCallback((x, y, cellType) => {
                this.updateCell(x, y, cellType);
                this.obstacleRenderer.render();
            });

            // Set initial goal position in renderer
            this.obstacleRenderer.updateGoalPosition(this.goalX, this.goalY);
            await this.obstacleRenderer.render();
        }

        // Initialize distance field renderer
        if (this.canvases.distanceCanvas) {
            this.distanceRenderer = new DistanceFieldRenderer(
                this.device,
                this.canvases.distanceCanvas,
                this.gridSize
            );

            await this.distanceRenderer.setDistanceBuffer(this.buffers.distanceBufferPing);
            await this.distanceRenderer.render();
        }

        // Initialize flowfield renderer  
        if (this.canvases.flowfieldCanvas) {
            this.flowfieldRenderer = new FlowfieldRenderer(
                this.device,
                this.canvases.flowfieldCanvas,
                this.gridSize
            );

            await this.flowfieldRenderer.setFlowfieldBuffer(this.buffers.flowfieldBuffer);
            await this.flowfieldRenderer.render();
        }
    }

    // Toggle relaxation mode
    setRelaxation(enabled) {
        this.useRelaxation = enabled;
        console.log(`Relaxation ${enabled ? 'enabled' : 'disabled'}`);

        // Reset max distance when switching modes
        this.maxDistanceValue = Math.max(this.gridSize * 0.5, 10.0);
        
        // Force reset of distance field tracking
        this.lastIterationData = null;
        this.hasConverged = false;
        
        // Update distance renderer immediately with new max
        if (this.distanceRenderer) {
            this.distanceRenderer.updateMaxDistance(this.maxDistanceValue);
        }
        
        console.log(`Max distance reset to ${this.maxDistanceValue} for ${enabled ? 'relaxation' : 'no-relaxation'} mode`);
    }

    // Update renderers and render immediately after computation
    async updateRenderersAndRender() {
        // Get the correct buffer (the one that was just written to)
        const currentBuffer = this.usesPingPong ? this.buffers.distanceBufferPong : this.buffers.distanceBufferPing;
        
        // Update distance renderer
        if (this.distanceRenderer) {
            await this.distanceRenderer.setDistanceBuffer(currentBuffer);
            this.distanceRenderer.updateMaxDistance(this.maxDistanceValue);
            await this.distanceRenderer.render();
        }
        
        // Flowfield renderer automatically uses the updated flowfield buffer
        if (this.flowfieldRenderer) {
            await this.flowfieldRenderer.render();
        }
        
        // Always render obstacle grid for user interaction
        if (this.obstacleRenderer) {
            await this.obstacleRenderer.render();
        }
    }

    // Run simulation with immediate rendering after each step
    async runSimulation() {
        if (this.isRunning) {
            this.stop();
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Reset simulation state
        this.currentIteration = 0;
        this.usesPingPong = true;
        this.hasConverged = false;
        this.lastIterationData = null;

        // Calculate initial max distance based on terrain complexity
        let obstacleCount = 0;
        let difficultCount = 0;
        for (let i = 0; i < this.gridData.length; i++) {
            if (this.gridData[i] === 0.0) obstacleCount++;
            else if (this.gridData[i] === 0.3) difficultCount++;
        }
        
        const complexity = (obstacleCount + difficultCount * 0.5) / this.numberOfCells;
        const baseMax = Math.max(this.gridSize * 0.5, 10.0);
        this.maxDistanceValue = baseMax * (1 + complexity * 2);

        // Reset buffers
        const distanceData = new Float32Array(this.numberOfCells).fill(0.0);
        distanceData[this.goalY * this.gridSize + this.goalX] = 1.0;

        this.device.queue.writeBuffer(this.buffers.distanceBufferPing, 0, distanceData);
        this.device.queue.writeBuffer(this.buffers.distanceBufferPong, 0, distanceData);

        const flowfieldData = new Float32Array(this.numberOfCells * 2).fill(0.0);
        this.device.queue.writeBuffer(this.buffers.flowfieldBuffer, 0, flowfieldData);

        await this.device.queue.onSubmittedWorkDone();

        console.log(`Starting BFS simulation from goal (${this.goalX}, ${this.goalY})...`);

        this.isRunning = true;
        this.startBlinking();

        try {
            for (let i = 0; i < this.maxIterations && this.isRunning && !this.hasConverged; i++) {
                // 1. Run BFS iteration
                await this.runBFSIteration();

                // 2. Generate flowfield  
                await this.generateFlowfield();

                // 3. Update renderers and render immediately
                await this.updateRenderersAndRender();

                // 4. Check convergence and update max distance occasionally
                if (i % 3 === 0) {
                    await this.checkConvergence();
                    await this.updateMaxDistance();
                }

                if (this.hasConverged) {
                    console.log(`BFS converged after ${this.currentIteration} iterations`);
                    break;
                }

                // 5. Wait for next iteration
                if (this.simulationSpeed > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.simulationSpeed));
                }
            }

            if (!this.hasConverged) {
                console.log(`BFS completed after ${this.currentIteration} iterations (max reached)`);
            }
        } catch (error) {
            console.error("Simulation error:", error);
        } finally {
            this.isRunning = false;
            this.stopBlinking();
        }
    }

    // Run one BFS iteration
    async runBFSIteration() {
        const commandEncoder = this.device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();

        const pipelineKey = this.useRelaxation ? 'bfs' : 'bfsNoRelaxation';
        const pipeline = this.pipelines[pipelineKey].pipeline;
        const bindGroup = this.usesPingPong ? this.bindGroups.bfsPing : this.bindGroups.bfsPong;

        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, bindGroup);

        const workgroupsX = Math.ceil(this.gridSize / 8);
        const workgroupsY = Math.ceil(this.gridSize / 8);
        computePass.dispatchWorkgroups(workgroupsX, workgroupsY);

        computePass.end();
        this.device.queue.submit([commandEncoder.finish()]);
        
        // Wait for completion, then swap
        await this.device.queue.onSubmittedWorkDone();
        this.usesPingPong = !this.usesPingPong;
        this.currentIteration++;
    }

    // Generate flowfield from current distance field
    async generateFlowfield() {
        const commandEncoder = this.device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();

        computePass.setPipeline(this.pipelines.gradient.pipeline);
        
        // Use correct input buffer (the one that was just written to)
        const gradientBindGroup = this.bindGroups.getGradientBindGroup(this.usesPingPong);
        computePass.setBindGroup(0, gradientBindGroup);

        const workgroupsX = Math.ceil(this.gridSize / 8);
        const workgroupsY = Math.ceil(this.gridSize / 8);
        computePass.dispatchWorkgroups(workgroupsX, workgroupsY);

        computePass.end();
        this.device.queue.submit([commandEncoder.finish()]);
        await this.device.queue.onSubmittedWorkDone();
    }

    // Check if the distance field has converged
    async checkConvergence() {
        if (!this.buffers) return;

        const currentBuffer = this.usesPingPong ? this.buffers.distanceBufferPong : this.buffers.distanceBufferPing;

        const stagingBuffer = this.device.createBuffer({
            size: this.numberOfCells * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(currentBuffer, 0, stagingBuffer, 0, this.numberOfCells * 4);
        this.device.queue.submit([commandEncoder.finish()]);

        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const currentData = new Float32Array(stagingBuffer.getMappedRange());
        const dataCopy = new Float32Array(currentData);
        stagingBuffer.unmap();
        stagingBuffer.destroy();

        // Compare with previous iteration
        if (this.lastIterationData) {
            let hasChanged = false;
            const tolerance = 1e-6;

            for (let i = 0; i < this.numberOfCells; i++) {
                if (Math.abs(dataCopy[i] - this.lastIterationData[i]) > tolerance) {
                    hasChanged = true;
                    break;
                }
            }

            if (!hasChanged) {
                this.hasConverged = true;
                console.log("Distance field converged - no changes detected");
            }
        }

        this.lastIterationData = dataCopy;
    }

    // Update max distance tracking
    async updateMaxDistance() {
        const distanceData = await this.getCurrentDistanceData();
        if (distanceData) {
            let maxDist = 0;
            let nonZeroCount = 0;
            let avgDist = 0;

            for (let i = 0; i < distanceData.length; i++) {
                if (distanceData[i] > 0) {
                    nonZeroCount++;
                    avgDist += distanceData[i];
                    if (distanceData[i] > maxDist) {
                        maxDist = distanceData[i];
                    }
                }
            }

            if (nonZeroCount > 10) {
                avgDist /= nonZeroCount;
                
                if (maxDist < this.maxDistanceValue * 0.4) {
                    this.maxDistanceValue = Math.max(maxDist * 1.4, 5.0);
                } else if (maxDist < this.maxDistanceValue * 0.7) {
                    this.maxDistanceValue = Math.max(maxDist * 1.2, 8.0);
                } else if (maxDist > this.maxDistanceValue * 0.9) {
                    this.maxDistanceValue = maxDist * 1.15;
                }
                
                // Conservative adjustment using average distance
                if (avgDist > 0 && maxDist / avgDist > 10) {
                    const conservativeMax = avgDist * 3;
                    if (conservativeMax < this.maxDistanceValue * 0.8) {
                        this.maxDistanceValue = Math.max(conservativeMax, 10.0);
                    }
                }
            }
        }
    }

    // Get current distance data for max distance tracking
    async getCurrentDistanceData() {
        if (!this.buffers) return null;

        const currentBuffer = this.usesPingPong ? this.buffers.distanceBufferPong : this.buffers.distanceBufferPing;

        const stagingBuffer = this.device.createBuffer({
            size: this.numberOfCells * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(currentBuffer, 0, stagingBuffer, 0, this.numberOfCells * 4);
        this.device.queue.submit([commandEncoder.finish()]);

        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const data = new Float32Array(stagingBuffer.getMappedRange());
        const result = new Float32Array(data);
        stagingBuffer.unmap();
        stagingBuffer.destroy();

        return result;
    }

    // Update obstacle/terrain data
    updateCell(x, y, cellType) {
        const index = y * this.gridSize + x;

        // Handle source placement
        if (cellType === 3.0) {
            this.setGoal(x, y);
            return;
        }

        this.gridData[index] = cellType;

        // Reset convergence detection when terrain changes
        this.hasConverged = false;
        this.lastIterationData = null;

        // Reset distance field when terrain changes
        this.resetDistanceField();

        // Update GPU buffer
        this.device.queue.writeBuffer(this.buffers.gridBuffer, 0, this.gridData);
    }

    // Reset distance field while keeping goal
    resetDistanceField() {
        const distanceData = new Float32Array(this.numberOfCells).fill(0.0);
        distanceData[this.goalY * this.gridSize + this.goalX] = 1.0;

        if (this.buffers) {
            this.device.queue.writeBuffer(this.buffers.distanceBufferPing, 0, distanceData);
            this.device.queue.writeBuffer(this.buffers.distanceBufferPong, 0, distanceData);
        }

        this.currentIteration = 0;
        this.usesPingPong = true;
        
        // Reset max distance when terrain changes
        this.maxDistanceValue = Math.max(this.gridSize * 0.6, 12.0);

        if (this.buffers) {
            const flowfieldData = new Float32Array(this.numberOfCells * 2).fill(0.0);
            this.device.queue.writeBuffer(this.buffers.flowfieldBuffer, 0, flowfieldData);
        }

        // Update renderer buffers immediately
        if (this.distanceRenderer) {
            this.distanceRenderer.setDistanceBuffer(this.buffers.distanceBufferPing);
            this.distanceRenderer.updateMaxDistance(this.maxDistanceValue);
        }
    }

    // Set goal position
    setGoal(x, y) {
        this.goalX = x;
        this.goalY = y;

        // Reset convergence detection
        this.hasConverged = false;
        this.lastIterationData = null;

        // Reset distance fields
        const distanceData = new Float32Array(this.numberOfCells).fill(0.0);
        distanceData[y * this.gridSize + x] = 1.0;

        this.device.queue.writeBuffer(this.buffers.distanceBufferPing, 0, distanceData);
        this.device.queue.writeBuffer(this.buffers.distanceBufferPong, 0, distanceData);

        this.currentIteration = 0;
        this.usesPingPong = true;
    }

    // Stop simulation
    stop() {
        this.isRunning = false;
        this.stopBlinking();
    }

    // Reset the grid to all traversable terrain
    resetGrid() {
        console.log("Resetting grid to default state...");

        this.stop();
        this.gridData.fill(1.0);

        if (this.buffers) {
            this.device.queue.writeBuffer(this.buffers.gridBuffer, 0, this.gridData);
        }

        const centerX = Math.floor(this.gridSize / 2);
        const centerY = Math.floor(this.gridSize / 2);
        this.setGoal(centerX, centerY);

        this.maxDistanceValue = 10.0;

        if (this.distanceRenderer) {
            this.distanceRenderer.updateMaxDistance(this.maxDistanceValue);
        }

        if (this.obstacleRenderer) {
            this.obstacleRenderer.updateGoalPosition(centerX, centerY);
            this.obstacleRenderer.currentSourcePos = { x: centerX, y: centerY };
        }

        if (this.flowfieldRenderer) {
            const flowfieldData = new Float32Array(this.numberOfCells * 2).fill(0.0);
            this.device.queue.writeBuffer(this.buffers.flowfieldBuffer, 0, flowfieldData);
        }

        // **NEW: Re-render all three canvases after reset**
        this.renderAllCanvases();

        console.log("Grid reset complete");
    }

    // **NEW: Helper method to render all canvases**
    async renderAllCanvases() {
        try {
            // Render obstacle grid
            if (this.obstacleRenderer) {
                await this.obstacleRenderer.render();
            }

            // Render distance field
            if (this.distanceRenderer) {
                await this.distanceRenderer.render();
            }

            // Render flowfield
            if (this.flowfieldRenderer) {
                await this.flowfieldRenderer.render();
            }
        } catch (error) {
            console.error("Error rendering canvases:", error);
        }
    }

    // Load maze from CSV file
    async loadMaze() {
        try {
            console.log("Loading maze from maze.csv...");
            await this.loadObstacleGridFromCSV('./maze.csv');

            // Find a good starting position
            let goalX = Math.floor(this.gridSize / 2);
            let goalY = Math.floor(this.gridSize / 2);

            let found = false;
            for (let radius = 0; radius < this.gridSize / 2 && !found; radius++) {
                for (let dy = -radius; dy <= radius && !found; dy++) {
                    for (let dx = -radius; dx <= radius && !found; dx++) {
                        const x = Math.floor(this.gridSize / 2) + dx;
                        const y = Math.floor(this.gridSize / 2) + dy;

                        if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
                            const index = y * this.gridSize + x;
                            if (this.gridData[index] === 1.0) {
                                goalX = x;
                                goalY = y;
                                found = true;
                            }
                        }
                    }
                }
            }

            this.setGoal(goalX, goalY);

            if (this.obstacleRenderer) {
                this.obstacleRenderer.updateGoalPosition(goalX, goalY);
                this.obstacleRenderer.currentSourcePos = { x: goalX, y: goalY };
                this.obstacleRenderer.render();
            }

            this.renderAllCanvases();

            console.log(`Maze loaded successfully! Goal set at (${goalX}, ${goalY})`);

        } catch (error) {
            console.error("Failed to load maze:", error);
            console.log("Creating fallback maze pattern...");
            this.createFallbackMaze();
        }
    }

    // Create a simple maze pattern if CSV loading fails
    createFallbackMaze() {
        this.gridData.fill(1.0);

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const index = y * this.gridSize + x;

                if (x === 0 || x === this.gridSize - 1 || y === 0 || y === this.gridSize - 1) {
                    this.gridData[index] = 0.0;
                } else if ((x % 4 === 0 && y % 2 === 0) || (y % 4 === 0 && x % 2 === 0)) {
                    this.gridData[index] = 0.0;
                } else if ((x + y) % 7 === 0) {
                    this.gridData[index] = 0.3;
                }
            }
        }

        const centerX = Math.floor(this.gridSize / 2);
        const centerY = Math.floor(this.gridSize / 2);
        this.gridData[centerY * this.gridSize + centerX] = 1.0;

        if (this.buffers) {
            this.device.queue.writeBuffer(this.buffers.gridBuffer, 0, this.gridData);
        }

        this.setGoal(centerX, centerY);

        if (this.obstacleRenderer) {
            this.obstacleRenderer.updateGoalPosition(centerX, centerY);
            this.obstacleRenderer.currentSourcePos = { x: centerX, y: centerY };
            this.obstacleRenderer.render();
        }

        this.renderAllCanvases();

        console.log("Fallback maze created");
    }

    // Load obstacle grid from CSV file
    async loadObstacleGridFromCSV(csvPath) {
        try {
            console.log(`Loading obstacle grid from: ${csvPath}`);
            this.gridData = await loadCSVToFloat32Array(csvPath);

            if (this.buffers) {
                this.device.queue.writeBuffer(this.buffers.gridBuffer, 0, this.gridData);
            }

            console.log("Obstacle grid loaded successfully");
            return this.gridData;
        } catch (error) {
            console.error("Failed to load obstacle grid:", error);
            throw error;
        }
    }

    // Set simulation speed
    setSimulationSpeed(speed) {
        this.simulationSpeed = Math.max(10, Math.min(1000, speed));
    }
}
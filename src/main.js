import './style.css'
// import 'flyonui/flyonui.js';
import { PathfindingSimulation } from './js/PathfindingSimulation.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const simulation = new PathfindingSimulation({}, 32);
        
        const device = await simulation.initialize();
        console.log("Simulation initialized successfully.");

        const obstacleCanvas = document.getElementById('obstacleCanvas');
        const distanceCanvas = document.getElementById('distanceCanvas');
        const flowfieldCanvas = document.getElementById('flowfieldCanvas');
        
        simulation.canvases = {
          obstacleCanvas,
          distanceCanvas,
          flowfieldCanvas
        };

        await simulation.initializeRenderers();
        simulation.initializeHeaderElements();
        
        // **NEW: Render once initially**
        if (simulation.obstacleRenderer) await simulation.obstacleRenderer.render();
        if (simulation.distanceRenderer) await simulation.distanceRenderer.render();
        if (simulation.flowfieldRenderer) await simulation.flowfieldRenderer.render();
        
        console.log("Renderers initialized successfully.");
        
        setupButtonHandlers(simulation);
        window.simulation = simulation;
        
    } catch (error) {
        console.error("Error in main setup:", error);
    }
});


function setupButtonHandlers(simulation) {
    // Start button - now restarts simulation from current goal
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            if (simulation.isRunning) {
                console.log("Restarting BFS simulation...");
            } else {
                console.log("Starting BFS simulation...");
            }
            await simulation.runSimulation();
        });
    }
    
    // Reset button - now clearly resets everything including obstacle map
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            console.log("Resetting entire grid (obstacles + goal)...");
            simulation.resetGrid();
        });
    }

    // Maze button
    const mazeBtn = document.getElementById('mazeBtn');
    if (mazeBtn) {
        mazeBtn.addEventListener('click', async () => {
            console.log("Loading maze...");
            await simulation.loadMaze();
        });
    }

const relaxationToggle = document.getElementById('relaxationToggle');
if (relaxationToggle) {
    // Set initial state
    relaxationToggle.checked = true; // Default to relaxation enabled
   
    relaxationToggle.addEventListener('change', (event) => {
        const useRelaxation = event.target.checked;
        simulation.setRelaxation(useRelaxation);
        console.log(`Relaxation ${useRelaxation ? 'enabled' : 'disabled'}`);
        
        // Update text color based on toggle state
        const relaxationText = document.getElementById('relaxationText');
        if (relaxationText) {
            if (useRelaxation) {
                relaxationText.className = 'text-goldenrod-300';
            } else {
                relaxationText.className = 'text-neutral';
            }
        }
    });
}

    // Speed slider - now intuitive (higher values = faster)
    const speedRange = document.getElementById('speedRange');
    if (speedRange) {
        // Set initial value and range for speed
        speedRange.min = 1;    // Slowest speed
        speedRange.max = 50;   // Fastest speed  
        speedRange.value = 10; // Default speed
        
        speedRange.addEventListener('input', (event) => {
            const speedValue = parseInt(event.target.value);
            
            // **FIXED: Better mapping that avoids negative values**
            // Speed 1 = 500ms delay, Speed 50 = 10ms delay
            const delay = Math.max(10, Math.round(510 - (speedValue * 10)));
            
            simulation.setSimulationSpeed(delay);
            console.log(`Speed set to ${speedValue} (${delay}ms delay)`);
        });
        
        // Set initial speed
        const initialSpeedValue = 10;
        const initialDelay = Math.max(10, Math.round(510 - (initialSpeedValue * 10)));
        simulation.setSimulationSpeed(initialDelay);
    }
}
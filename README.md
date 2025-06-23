# BFS Flowfield WebGPU

This project visualizes BFS-based flowfields using WebGPU in the browser. It features interactive obstacle editing, distance field and flowfield visualization, and supports loading mazes from CSV files.

## Features

- WebGPU-powered grid rendering and compute shaders (see `src/shaders/`)
- Interactive obstacle and goal placement
- Distance and flowfield visualization (see `src/js/renderers/`)
- Hilbert curve maze generation and noise-based maze creation (see `src/python/hilbert.ipynb`)
- CSV import/export for grid data (see `public/maze.csv` and `src/assets/maze.csv`)
- Python scripts for LUT analysis and maze generation (`src/python/`)
- Modular JavaScript code for simulation, rendering, and WebGPU setup (`src/js/`)

## Pathfinding Algorithms: BFS vs. Relaxation

This project supports two BFS variants for distance field computation:

- **BFS without relaxation**: Classic BFS. Each cell is filled once and never updated again. This is optimal and fast when all terrain costs are equal (e.g., every cell costs 1 to enter).
- **BFS with relaxation**: Each cell can be updated if a shorter path is found later ("relaxation step"). This is necessary when terrain costs vary (e.g., difficult terrain or shortcuts), ensuring the true lowest-cost path is found. This approach is similar to Dijkstra's or Bellman-Ford algorithms.

**Summary:**
- If all terrain costs are the same: both BFS variants produce the same result.
- If terrain costs vary: use relaxation to get correct shortest paths.

See `src/shaders/BFS.wgsl` (with relaxation) and `src/shaders/BFSNoRelaxation.wgsl` (without relaxation) for implementation details.

For a more in-depth explanation, see [BFS Relaxation Explanation](bfs_relaxation_explanation.md).

## Project Structure

- `src/`
  - `js/` — Main JavaScript source code
    - `PathfindingSimulation.js` — Core simulation logic
    - `initWebGPU.js`, `importShaders.js`, `buffers.js`, `bindGroup.js`, `pipelines.js` — WebGPU setup and management
    - `renderers/` — Canvas renderers for obstacles, distance field, and flowfield
    - `util.js`, `setupCanvases.js` — Utility and setup helpers
  - `assets/` — Images and CSV files for mazes and textures
  - `shaders/` — WGSL compute shaders for BFS, flowfield, and grid operations
  - `style.css` — Main stylesheet
  - `python/` — Python scripts and Jupyter notebook for maze/noise generation and LUT analysis
- `public/` — Static files (e.g., `maze.csv`)
- `server.js` — Optional Node.js server for local hosting
- `vite.config.js` — Vite configuration
- `package.json` — Project dependencies and scripts
- `dist/` — Production build output (ignored by git)

## Getting Started

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Run the development server:**
   ```sh
   npm run dev
   ```

3. **Build for production:**
   ```sh
   npm run build
   ```

4. **Preview production build:**
   ```sh
   npm run preview
   ```

## Python Utilities

- Maze and noise generation: `src/python/hilbert.ipynb`
- LUT analysis and creation: `src/python/LUTAnalyzer.py`, `src/python/LUTMaker.py`
- Output loading: `src/python/loadOutput.py`

## Shaders

- BFS and distance field: `src/shaders/BFS.wgsl`, `src/shaders/BFSNoRelaxation.wgsl`, `src/shaders/distanceGrid.wgsl`
- Flowfield and gradient: `src/shaders/flowfield.wgsl`, `src/shaders/gradient.wgsl`
- Obstacle grid: `src/shaders/obstacleGrid.wgsl`

## License

See [LICENSE](LICENSE).

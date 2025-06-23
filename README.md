# BFS Flowfield WebGPU

This project visualizes BFS-based flowfields using WebGPU in the browser. It features interactive obstacle editing, distance field and flowfield visualization, and supports loading mazes from CSV files.

## Features

- WebGPU-powered grid rendering
- Interactive obstacle and goal placement
- Distance and flowfield visualization
- Hilbert curve maze generation (Python notebook)
- CSV import/export for grid data

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

## Directory Structure

- `src/` — Main source code (JS, CSS, assets, shaders)
- `public/` — Static files (e.g., maze CSV)
- `src/python/` — Python scripts and notebooks for maze generation
- `dist/` — Production build output (ignored by git)

## License

See [LICENSE](LICENSE).

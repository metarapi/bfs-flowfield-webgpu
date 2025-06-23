struct Uniforms {
    gridSizeX: f32,
    gridSizeY: f32,
    canvasWidth: f32,
    canvasHeight: f32,
    goalX: f32,
    goalY: f32,
};

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) gridX: u32,
    @location(3) gridY: u32,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) @interpolate(flat) gridCoord: vec2<u32>,
};

const CELL_SIZE: f32 = 0.8;

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> gridData: array<f32>;

@vertex fn vs(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Calculate cell size in NDC
    let cellWidth = 2.0 / uniforms.gridSizeX;
    let cellHeight = 2.0 / uniforms.gridSizeY;

    // Calculate position in NDC (-1 to 1)
    let gridX = f32(input.gridX);
    let gridY = f32(input.gridY);

    let baseX = -1.0 + gridX * cellWidth;
    let baseY = -1.0 + gridY * cellHeight;

    let finalX = baseX + input.position.x * cellWidth * CELL_SIZE;
    let finalY = baseY + input.position.y * cellHeight * CELL_SIZE;

    output.position = vec4<f32>(finalX, finalY, 0.0, 1.0);
    output.uv = input.uv;
    output.gridCoord = vec2<u32>(input.gridX, input.gridY);

    return output;
}

@fragment fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    let gridIndex = input.gridCoord.y * u32(uniforms.gridSizeX) + input.gridCoord.x;
    let cellValue = gridData[gridIndex];

    // Check if this is the goal position
    let isGoal = (f32(input.gridCoord.x) == uniforms.goalX && f32(input.gridCoord.y) == uniforms.goalY);

    if (isGoal) {
        return vec4<f32>(0.2, 0.8, 0.2, 1.0); // Goal - green
    }

    // Color based on terrain type only
    if (cellValue == 0.0) {
        return vec4<f32>(0.2, 0.2, 0.2, 1.0); // Obstacle - dark gray
    } else if (cellValue == 0.3) {
        return vec4<f32>(0.8, 0.6, 0.2, 1.0); // Difficult - orange
    } else {
        return vec4<f32>(0.9, 0.9, 0.9, 1.0); // Traversable - light gray
    }
}
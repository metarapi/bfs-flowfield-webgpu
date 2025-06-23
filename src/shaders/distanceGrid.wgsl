struct Uniforms {
    gridSizeX: f32,
    gridSizeY: f32,
    maxDistance: f32,
    padding: f32,
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

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> distanceData: array<f32>;

// Inferno LUT polynomial coefficients (slightly desaturated)
const RED_COEFFS = array<f32, 5>(6.381e-10, -3.626e-07, 5.265e-05, 0.002549, 0.1565);
const GREEN_COEFFS = array<f32, 5>(2.443e-11, -1.419e-09, 9.979e-06, 0.0007522, 0.05846);
const BLUE_COEFFS = array<f32, 5>(1.445e-09, -4.338e-07, 1.427e-05, 0.002326, 0.294);

//   const RED_COEFFS = array<f32, 5>(5.741e-10, -3.666e-07, 6.084e-05, 0.002347, 0.001889);
//   const GREEN_COEFFS = array<f32, 5>(-1.247e-10, 8.93e-08, -5.787e-06, 0.00152, 0.009894);
//   const BLUE_COEFFS = array<f32, 5>(1.603e-09, -4.442e-07, -1.189e-05, 0.008081, 0.01293);

fn evaluatePolynomial(coeffs: array<f32, 5>, x: f32) -> f32 {
    return coeffs[0] * pow(x, 4.0) + coeffs[1] * pow(x, 3.0) + coeffs[2] * pow(x, 2.0) + coeffs[3] * x + coeffs[4];
}

fn infernoColormap(t: f32) -> vec3<f32> {
    let clamped_t = clamp(t, 0.0, 1.0);
    let x = clamped_t * 255.0; // Scale to [0, 255] for the polynomial

    let r = clamp(evaluatePolynomial(RED_COEFFS, x), 0.0, 1.0);
    let g = clamp(evaluatePolynomial(GREEN_COEFFS, x), 0.0, 1.0);
    let b = clamp(evaluatePolynomial(BLUE_COEFFS, x), 0.0, 1.0);

    return vec3<f32>(r, g, b);
}

const CELL_SIZE: f32 = 0.8;

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
    let distance = distanceData[gridIndex];

    if (distance == 0.0) {
        return vec4<f32>(0.0, 0.0, 0.0, 1.0); // Black for unreachable/obstacles
    }

    // Normalize distance to [0, 1] range
    let normalizedDistance = distance / uniforms.maxDistance;
    let color = infernoColormap(normalizedDistance);

    return vec4<f32>(color, 1.0);
}
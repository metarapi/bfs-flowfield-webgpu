struct Uniforms {
    gridSizeX: f32,
    gridSizeY: f32,
    arrowScale: f32,
    padding: f32,
};

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) gridX: u32,
    @location(2) gridY: u32,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> flowfieldData: array<vec2<f32>>;

@vertex fn vs(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let gridIndex = input.gridY * u32(uniforms.gridSizeX) + input.gridX;
    let flowVector = flowfieldData[gridIndex];

    // Calculate cell center in NDC
    let cellWidth = 2.0 / uniforms.gridSizeX;
    let cellHeight = 2.0 / uniforms.gridSizeY;

    let centerX = -1.0 + (f32(input.gridX) + 0.5) * cellWidth;
    let centerY = -1.0 + (f32(input.gridY) + 0.5) * cellHeight;

    // Rotate and scale the arrow vertex based on flow direction
    let flowLength = length(flowVector);
    if (flowLength > 0.001) {
        let normalizedFlow = flowVector / flowLength;
        
        // Create rotation matrix
        let cos_theta = normalizedFlow.x;
        let sin_theta = normalizedFlow.y;
        
        // Apply rotation to arrow vertex
        let rotatedX = input.position.x * cos_theta - input.position.y * sin_theta;
        let rotatedY = input.position.x * sin_theta + input.position.y * cos_theta;
        
        // Scale and translate
        let scaledX = rotatedX * uniforms.arrowScale * cellWidth;
        let scaledY = rotatedY * uniforms.arrowScale * cellHeight;
        
        output.position = vec4<f32>(centerX + scaledX, centerY + scaledY, 0.0, 1.0);
        
        // Color based on flow strength
        // let intensity = min(flowLength, 1.0);
        // output.color = vec3<f32>(1.0, 1.0 - intensity * 0.5, 1.0 - intensity);
        output.color = vec3<f32>(0.671, 0.616, 0.949);
    } else {
        // No flow - make the arrow invisible by placing it outside clip space
        output.position = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        output.color = vec3<f32>(0.0, 0.0, 0.0);
    }

    return output;
}

@fragment fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(input.color, 0.8);
}
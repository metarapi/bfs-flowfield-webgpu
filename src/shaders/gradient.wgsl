struct Uniforms {
    gridSizeX: u32,
    gridSizeY: u32,
    sqrt2: f32,
    sqrt2inv: f32,
};
@group(0) @binding(0) var<storage, read> gridBuffer: array<f32>;
@group(0) @binding(1) var<storage, read> distanceBuffer: array<f32>;
@group(0) @binding(2) var<storage, read_write> flowfieldBuffer: array<vec2<f32>>;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

fn idx(x: u32, y: u32) -> u32 {
    return y * uniforms.gridSizeX + x;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let x = gid.x;
    let y = gid.y;
    if (x >= uniforms.gridSizeX || y >= uniforms.gridSizeY) {
        return;
    }
    let i = idx(x, y);

    let terrain = gridBuffer[i];
    let value = distanceBuffer[i];

    // If obstacle or empty, set flow to zero
    if (terrain == 0.0 || value == 0.0) {
        flowfieldBuffer[i] = vec2<f32>(0.0, 0.0);
        return;
    }

    // 8-connected neighbors and normalized directions
    let neighbors = array<vec2<i32>, 8>(
        vec2<i32>( 1,  0), // right
        vec2<i32>( 0,  1), // down
        vec2<i32>(-1,  0), // left
        vec2<i32>( 0, -1), // up
        vec2<i32>( 1,  1), // down-right
        vec2<i32>(-1,  1), // down-left
        vec2<i32>(-1, -1), // up-left
        vec2<i32>( 1, -1)  // up-right
    );
    let directions = array<vec2<f32>, 8>(
        vec2<f32>(1.0, 0.0),    // right
        vec2<f32>(0.0, 1.0),    // down
        vec2<f32>(-1.0, 0.0),   // left
        vec2<f32>(0.0, -1.0),   // up
        vec2<f32>(uniforms.sqrt2inv, uniforms.sqrt2inv),    // down-right
        vec2<f32>(-uniforms.sqrt2inv, uniforms.sqrt2inv),   // down-left
        vec2<f32>(-uniforms.sqrt2inv, -uniforms.sqrt2inv),    // up-left
        vec2<f32>(uniforms.sqrt2inv, -uniforms.sqrt2inv)      // up-right
    );

    var minValue = value;
    var bestDir = vec2<f32>(0.0, 0.0);

    for (var n = 0u; n < 8u; n = n + 1u) {
        let nx = i32(x) + neighbors[n].x;
        let ny = i32(y) + neighbors[n].y;
        if (nx < 0 || ny < 0 || nx >= i32(uniforms.gridSizeX) || ny >= i32(uniforms.gridSizeY)) {
            continue;
        }
        let ni = idx(u32(nx), u32(ny));
        if (gridBuffer[ni] != 0.0 && distanceBuffer[ni] > 0.0) {
            if (distanceBuffer[ni] < minValue) {
                minValue = distanceBuffer[ni];
                bestDir = directions[n];
            }
        }
    }
    flowfieldBuffer[i] = bestDir;
}
struct Uniforms {
    gridSizeX: u32,
    gridSizeY: u32,
    sqrt2: f32,
    sqrt2inv: f32,
};
@group(0) @binding(0) var<storage, read> gridBuffer: array<f32>;
@group(0) @binding(1) var<storage, read> distanceBufferIn: array<f32>;
@group(0) @binding(2) var<storage, read_write> distanceBufferOut: array<f32>;
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

    // Impassable
    if (terrain == 0.0) {
        distanceBufferOut[i] = 0.0;
        return;
    }

    let currentDist = distanceBufferIn[i];
    // If already filled, keep value
    if (currentDist > 0.0) {
        distanceBufferOut[i] = currentDist;
        return;
    }

    var minDist = 1e20;
    var found = false;

    // 8-connected neighbors and their costs
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
    let moveCosts = array<f32, 8>(
        1.0, 1.0, 1.0, 1.0,
        uniforms.sqrt2, uniforms.sqrt2, uniforms.sqrt2, uniforms.sqrt2
    );

    for (var n = 0u; n < 8u; n = n + 1u) {
        let nx = i32(x) + neighbors[n].x;
        let ny = i32(y) + neighbors[n].y;
        if (nx < 0 || ny < 0 || nx >= i32(uniforms.gridSizeX) || ny >= i32(uniforms.gridSizeY)) {
            continue;
        }
        let ni = idx(u32(nx), u32(ny));
        let neighborTerrain = gridBuffer[ni];
        let neighborDist = distanceBufferIn[ni];

        // Only consider filled and passable neighbors
        if (neighborDist > 0.0 && neighborTerrain != 0.0) {
            // Diagonal passability check (no corner cutting)
            if (n >= 4u) {
                let gate1 = idx(u32(i32(x) + neighbors[n].x), y);
                let gate2 = idx(x, u32(i32(y) + neighbors[n].y));
                if (gridBuffer[gate1] == 0.0 || gridBuffer[gate2] == 0.0) {
                    continue;
                }
            }
            // Terrain cost
            var cost = moveCosts[n];
            if (terrain < 0.0) {
                cost = cost * abs(terrain); // shortcut/teleport
            } else if (terrain > 0.0) {
                cost = cost / terrain; // normal/difficult/easy
            }
            let totalDist = neighborDist + cost;
            if (totalDist < minDist) {
                minDist = totalDist;
                found = true;
            }
        }
    }
    if (found) {
        distanceBufferOut[i] = minDist;
    } else {
        distanceBufferOut[i] = 0.0;
    }
}
import numpy as np
import matplotlib.pyplot as plt

gridSizeX = 32
gridSizeY = 32
heatGrid = np.zeros((int(gridSizeX), int(gridSizeY)))
heatGrid[5,4] = 1  # Start location with distance 1
heatGridPong = np.zeros_like(heatGrid)

# Enhanced terrain grid with continuous values
terrainGrid = np.ones((int(gridSizeX), int(gridSizeY)))  # Default: normal terrain
terrainGrid[8, 5:-3] = 0.0  # Impassable obstacle
terrainGrid[8:-3, 4] = 0.0  # Impassable obstacle
terrainGrid[0:8, 7:-3] = 0.3  # Difficult terrain (swamp)
# terrainGrid[1, :] = 1.5     # Easy terrain (road)
# terrainGrid[7, 7] = -0.5    # Teleporter/shortcut

def bfsDistanceFieldTerrainRelaxed(pingBuffer, pongBuffer, terrainBuffer, gridX, gridY, maxIterations=100):
    """
    BFS-like distance field with terrain costs and relaxation.
    Key change: Allows cells to update their values if a better path is found.
    """
    results = []
    
    # Distance weights
    ORTHOGONAL_DISTANCE = 1.0
    DIAGONAL_DISTANCE = np.sqrt(2.0)
    
    orthogonal_neighbors = [
        (1, 0), (0, 1), (-1, 0), (0, -1),
    ]
    
    diagonal_neighbors = [
        ((1, 1), [(1, 0), (0, 1)]),
        ((-1, 1), [(-1, 0), (0, 1)]),
        ((-1, -1), [(-1, 0), (0, -1)]),
        ((1, -1), [(1, 0), (0, -1)]),
    ]
    
    def is_diagonal_accessible(x, y, diag_dx, diag_dy, gate_offsets):
        for gate_dx, gate_dy in gate_offsets:
            gate_x, gate_y = x + gate_dx, y + gate_dy
            if 0 <= gate_x < gridX and 0 <= gate_y < gridY:
                if terrainBuffer[gate_x, gate_y] <= 0.0:  # Impassable
                    return False
        return True
    
    def calculate_terrain_cost(base_distance, terrain_value):
        """Calculate actual movement cost based on terrain"""
        if terrain_value <= 0.0:
            if terrain_value == 0.0:
                return float('inf')  # Impassable
            else:
                return base_distance * abs(terrain_value)  # Special terrain
        else:
            return base_distance / terrain_value  # Higher terrain = lower cost
    
    for iteration in range(maxIterations):
        if iteration % 2 == 0:
            currentBuffer = pingBuffer
            nextBuffer = pongBuffer
        else:
            currentBuffer = pongBuffer
            nextBuffer = pingBuffer
            
        # Copy current buffer to next buffer first
        nextBuffer[:] = currentBuffer[:]
        
        changed = False
        
        for x in range(gridX):
            for y in range(gridY):
                # Skip impassable terrain
                if terrainBuffer[x, y] == 0.0:
                    nextBuffer[x, y] = 0  # Mark as impassable
                    continue
                
                current_value = currentBuffer[x, y]
                min_total_distance = current_value if current_value > 0 else float('inf')
                found_improvement = False
                
                # Check orthogonal neighbors
                for dx, dy in orthogonal_neighbors:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < gridX and 0 <= ny < gridY:
                        neighbor_val = currentBuffer[nx, ny]
                        if neighbor_val > 0 and terrainBuffer[nx, ny] != 0.0:
                            terrain_cost = calculate_terrain_cost(ORTHOGONAL_DISTANCE, terrainBuffer[x, y])
                            total_distance = neighbor_val + terrain_cost
                            
                            if total_distance < min_total_distance:
                                min_total_distance = total_distance
                                found_improvement = True
                
                # Check diagonal neighbors
                for (dx, dy), gate_offsets in diagonal_neighbors:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < gridX and 0 <= ny < gridY:
                        if is_diagonal_accessible(x, y, dx, dy, gate_offsets):
                            neighbor_val = currentBuffer[nx, ny]
                            if neighbor_val > 0 and terrainBuffer[nx, ny] != 0.0:
                                terrain_cost = calculate_terrain_cost(DIAGONAL_DISTANCE, terrainBuffer[x, y])
                                total_distance = neighbor_val + terrain_cost
                                
                                if total_distance < min_total_distance:
                                    min_total_distance = total_distance
                                    found_improvement = True
                
                # Update if we found an improvement OR if the cell was never filled
                if found_improvement or (current_value == 0 and min_total_distance < float('inf')):
                    nextBuffer[x, y] = min_total_distance
                    changed = True
                    
        results.append(nextBuffer.copy())
        
        # Simple convergence check: if no changes were made, we're done
        if not changed:
            print(f"BFS converged at iteration {iteration + 1}")
            break
    
    return results

results = bfsDistanceFieldTerrainRelaxed(heatGrid, heatGridPong, terrainGrid, 
                                 gridSizeX, gridSizeY, maxIterations=100)

# Visualization
for i, result in enumerate(results):
    plt.figure(figsize=(15, 5))
    
    plt.subplot(1, 3, 1)
    plt.imshow(result, cmap="viridis")
    plt.title(f"Distance Field - Iter {i + 1}")
    plt.colorbar()
    
    plt.subplot(1, 3, 2)
    plt.imshow(terrainGrid, cmap="RdYlGn")
    plt.title("Terrain Map")
    plt.colorbar(label="Terrain Cost (0=impassable, 1=normal, >1=easy)")
    
    plt.subplot(1, 3, 3)
    # Combined view
    combined = result.copy()
    combined[terrainGrid == 0.0] = -1  # Mark obstacles
    plt.imshow(combined, cmap="viridis")
    plt.title("Distance + Obstacles")
    plt.colorbar()
    
    plt.tight_layout()
    plt.savefig(f"src/BFS Relaxation/bfs_relaxation_iteration_{i + 1:03d}.png", dpi=100, bbox_inches='tight')
    plt.close()

# print(f"Final max distance: {np.max(results[-1])}")

# Simple 8-direction gradient function
def simpleDirectionalGradient(terrainGrid, distanceField):
    """
    Calculate gradient as unit vectors pointing toward the lowest-value valid neighbor.
    Returns gradient_x, gradient_y arrays with values in {-1, 0, 1} or normalized diagonals.
    """
    gridX, gridY = distanceField.shape
    gradient_x = np.zeros_like(distanceField)
    gradient_y = np.zeros_like(distanceField)
    
    # 8-connected neighbors
    neighbors = [
        (1, 0),    # Right
        (0, 1),    # Down  
        (-1, 0),   # Left
        (0, -1),   # Up
        (1, 1),    # Down-Right
        (-1, 1),   # Down-Left
        (-1, -1),  # Up-Left
        (1, -1),   # Up-Right
    ]
    
    # Normalize diagonal directions
    sqrt2_inv = 1.0 / np.sqrt(2.0)
    direction_vectors = [
        (0.0, 1.0),           # Right
        (1.0, 0.0),           # Down
        (0.0, -1.0),          # Left
        (-1.0, 0.0),          # Up
        (sqrt2_inv, sqrt2_inv),    # Down-Right
        (sqrt2_inv, -sqrt2_inv),   # Down-Left
        (-sqrt2_inv, -sqrt2_inv),  # Up-Left
        (-sqrt2_inv, sqrt2_inv)   # Up-Right
    ]

    for x in range(gridX):
        for y in range(gridY):
            # Skip if current cell is obstacle or empty
            if terrainGrid[x, y] == 0.0 or distanceField[x, y] == 0:
                continue
            
            current_value = distanceField[x, y]
            min_value = current_value
            best_direction = None
            
            # Find the neighbor with lowest value
            for i, (dx, dy) in enumerate(neighbors):
                nx, ny = x + dx, y + dy
                if (0 <= nx < gridX and 0 <= ny < gridY and 
                    terrainGrid[nx, ny] != 0.0 and distanceField[nx, ny] > 0):
                    
                    if distanceField[nx, ny] < min_value:
                        min_value = distanceField[nx, ny]
                        best_direction = i
            
            # Set gradient to point toward lowest neighbor
            if best_direction is not None:
                gradient_x[x, y] = direction_vectors[best_direction][0]
                gradient_y[x, y] = direction_vectors[best_direction][1]
    
    return gradient_x, gradient_y


finalDistanceField = results[-1]

# Calculate simple directional gradient
gradient_x, gradient_y = simpleDirectionalGradient(terrainGrid, finalDistanceField)

# Create a meshgrid for the quiver plot
Y, X = np.mgrid[0:gridSizeY, 0:gridSizeX]

# Plot the gradient field
plt.figure(figsize=(10, 10))
plt.imshow(terrainGrid, cmap="RdYlGn", origin='lower', alpha=0.75)
plt.imshow(finalDistanceField, cmap="viridis", origin='lower', alpha=0.25)
plt.colorbar(label="Distance Value")

# Only plot arrows where we have valid gradients
valid_mask = (terrainGrid != 0.0) & (finalDistanceField > 0) & ((gradient_x != 0) | (gradient_y != 0))
plt.quiver(X[valid_mask], Y[valid_mask], 
           gradient_x[valid_mask], gradient_y[valid_mask], 
           color='red', scale=20, headlength=4, alpha=0.8, width=0.005)

plt.title("Simple 8-Direction Gradient Field")
plt.xlim(0, gridSizeX)
plt.ylim(0, gridSizeY)
plt.gca().set_aspect('equal', adjustable='box')
# plt.savefig("BFS Terrain/simple_gradient_field.png", dpi=100, bbox_inches='tight')
plt.show()
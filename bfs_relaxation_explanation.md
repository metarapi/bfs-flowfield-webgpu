# BFS vs. BFS with Relaxation: When Do You Need It?

This document explains the difference between BFS (Breadth-First Search) without relaxation and BFS with relaxation for distance field computation, and when each approach is appropriate.

## The Core Difference

The fundamental difference between these two approaches lies in how they handle cells that have already been assigned a distance value:

### BFS Without Relaxation
```wgsl
// If already filled, keep value
if (currentDist > 0.0) {
    distanceBufferOut[i] = currentDist;
    return;
}
```

Once a cell gets a distance value, it **won't be reconsidered** — this assumes the first path found is already optimal. This is the classic BFS behavior.

### BFS With Relaxation
```wgsl
// If currentDist > 0.0, keep it; else initialize to a large number (like ∞)
var minDist = select(1e20, currentDist, currentDist > 0.0);
// ... then check if any neighbor offers a better path
if (found) {
    distanceBufferOut[i] = minDist; // May update existing values
}
```

Cells can be **updated multiple times** if a shorter path is discovered later.

## When BFS Without Relaxation Works

BFS without relaxation is **optimal** when:

1. **Uniform terrain costs**: All passable cells have the same movement cost
2. **Binary obstacles**: Cells are either passable (cost = 1) or impassable (cost = ∞)
3. **Pure geometric distance**: You only care about the number of steps, not weighted distances

### Why it works:
In uniform-cost scenarios, BFS naturally explores cells in order of increasing distance from the goal. The first time a cell is reached, that path is guaranteed to be optimal because all shorter paths would have been explored first.

**Example terrain values:**
- `0.0` = impassable obstacle
- `1.0` = normal terrain (all the same cost)

## When You Need BFS With Relaxation

BFS with relaxation becomes **necessary** when:

1. **Variable terrain costs**: Different terrain types have different movement costs
2. **Weighted pathfinding**: Some paths are more expensive than others
3. **Complex cost functions**: Shortcuts, teleporters, or terrain-dependent costs

### Why relaxation is needed:
With variable costs, a cell might initially be reached via an expensive path, but later a cheaper route through different terrain might be discovered. Without relaxation, you'd keep the suboptimal first path.

**Example terrain values:**
- `0.0` = impassable obstacle  
- **Positive values < 1** (e.g., `0.3`) = difficult terrain → more expensive (`cost = cost / 0.3`)
- `1.0` = normal terrain
- **Negative values** (e.g., `-2.0`) = shortcuts/teleporters → cost multiplier (`cost = cost * 2.0`)

## Code Implementation

Both shaders use the same terrain cost calculation:

```wgsl
var cost = moveCosts[n]; // Base movement cost (1.0 or √2)

if (terrain < 0.0) {
    cost = cost * abs(terrain); // Shortcut/teleporter multiplier
} else if (terrain > 0.0) {
    cost = cost / terrain; // Normal/difficult/easy terrain
}
```

The difference is in the **update strategy**:
- **Without relaxation**: Skip cells that already have values
- **With relaxation**: Always check for improvements

## Performance Considerations

- **BFS without relaxation**: Faster, as each cell is processed fewer times
- **BFS with relaxation**: Slower, as it may require **multiple passes** over the grid to propagate improved paths — like Bellman-Ford in parallel form — especially when paths wind around costly terrain

## Algorithm Relationship

BFS with relaxation is essentially a **parallel implementation** of algorithms like:
- **Dijkstra's algorithm** (for weighted shortest paths)
- **Bellman-Ford algorithm** (for graphs with negative weights)

The relaxation step is what allows these algorithms to find optimal paths in weighted graphs.

## Practical Rule

**Use the simple rule:**
- All terrain costs the same? → BFS without relaxation
- Variable terrain costs? → BFS with relaxation

If you set all terrain values to the same positive number (e.g., `1.0`), both approaches will produce identical results. The relaxation version just does extra work that doesn't change the outcome.

## Implementation Files

- `src/shaders/BFSNoRelaxation.wgsl` - Classic BFS for uniform costs
- `src/shaders/BFS.wgsl` - BFS with relaxation for variable costs

Both use ping-pong buffering to iteratively propagate distance values from the goal outward until convergence.
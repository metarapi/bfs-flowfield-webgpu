import numpy as np
import matplotlib.pyplot as plt

data = np.loadtxt("src/assets/test_distance_field.csv", delimiter=",", dtype=float)

plt.imshow(data, cmap='inferno')
plt.show()

grad_x = np.loadtxt("src/assets/test_flowfield_x.csv", delimiter=",", dtype=float)
grad_y = np.loadtxt("src/assets/test_flowfield_y.csv", delimiter=",", dtype=float)

# Meshgrid
X, Y = np.meshgrid(np.arange(grad_x.shape[1]), np.arange(grad_y.shape[0]))

plt.quiver(X, Y, grad_x, grad_y, color='white', scale=50, headlength=4)
plt.imshow(data, cmap='inferno', alpha=0.5)
plt.show()
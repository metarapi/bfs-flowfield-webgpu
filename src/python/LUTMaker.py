import numpy as np
import matplotlib.pyplot as plt

lut_img = np.linspace(0, 1, 256).reshape(1, 256)  # Create a simple LUT image with a gradient

print("LUT Image Shape:", lut_img.shape)

plt.figure(figsize=(10, 2))
plt.imshow(lut_img, cmap='inferno', aspect='auto')
plt.show()

# Save the png image
# plt.imsave("src/assets/lut_image.png", lut_img, cmap='inferno', format='png')
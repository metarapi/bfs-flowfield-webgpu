import numpy as np
import matplotlib.pyplot as plt

# Import the "src/assets/lut_image.png",

lut_img = plt.imread("src/assets/lut_image_desaturated.png")

# Seperate the RGB channels
red_channel = lut_img[:, :, 0]
green_channel = lut_img[:, :, 1]
blue_channel = lut_img[:, :, 2]

# Reorder so that each channel is a 1D array (vector)
red_channel = red_channel.flatten()
green_channel = green_channel.flatten()
blue_channel = blue_channel.flatten()

print(type(red_channel), type(green_channel), type(blue_channel))

# Plot the RGB channels on top of each other
plt.figure(figsize=(10, 2))
plt.plot(red_channel, color='red', label='Red Channel')
plt.plot(green_channel, color='green', label='Green Channel')
plt.plot(blue_channel, color='blue', label='Blue Channel')
plt.title("LUT Image RGB Channels")
plt.xlabel("Pixel Index")
plt.ylabel("Intensity")
plt.legend()
plt.grid()
plt.show()

# Derive an equation for the R, G and B channels from the vectors
def derive_equation(channel, degree=4):
    """Derives a polynomial equation for the channel."""
    x = np.arange(len(channel))
    coefficients = np.polyfit(x, channel, degree)  # Fit a polynomial of given degree
    # Print out the polynomial equation
    equation = " + ".join([f"{coeff:.4g}*x^{degree-i}" for i, coeff in enumerate(coefficients[:-1])])
    equation += f" + {coefficients[-1]:.4g}"
    print(f"Equation for channel (degree {degree}): y = {equation}")
    return coefficients


red_coeffs = derive_equation(red_channel)
green_coeffs = derive_equation(green_channel)
blue_coeffs = derive_equation(blue_channel)
print("\nDerived Equations:")

# Overlay the equations on the plot
plt.figure(figsize=(10, 2))
plt.plot(red_channel, color='red', label='Red Channel')
plt.plot(green_channel, color='green', label='Green Channel')
plt.plot(blue_channel, color='blue', label='Blue Channel')
plt.title("LUT Image RGB Channels with Derived Equations")
plt.xlabel("Pixel Index")
plt.ylabel("Intensity")
plt.legend()
plt.grid()
plt.plot(np.polyval(red_coeffs, np.arange(len(red_channel))), color='darkred', linestyle='--', label='Red Fit')
plt.plot(np.polyval(green_coeffs, np.arange(len(green_channel))), color='darkgreen', linestyle='--', label='Green Fit')
plt.plot(np.polyval(blue_coeffs, np.arange(len(blue_channel))), color='darkblue', linestyle='--', label='Blue Fit')
plt.legend()
plt.show()

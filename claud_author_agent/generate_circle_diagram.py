"""
Generate a circle theorem diagram showing angle at center vs angle at circumference
"""
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

# Create figure and axis
fig, ax = plt.subplots(1, 1, figsize=(10, 10))
ax.set_aspect('equal')
ax.set_xlim(-2, 2)
ax.set_ylim(-2, 2)
ax.axis('off')

# Circle parameters
center = (0, 0)
radius = 1.5

# Draw the circle
circle = plt.Circle(center, radius, fill=False, color='black', linewidth=2)
ax.add_patch(circle)

# Mark center O
ax.plot(center[0], center[1], 'ko', markersize=8)
ax.text(center[0] - 0.15, center[1] - 0.15, 'O', fontsize=16, fontweight='bold')

# Define points A, B, C on the circumference
# A at 150 degrees, B at 30 degrees
angle_A = np.radians(150)
angle_B = np.radians(30)
# C on the major arc at 270 degrees (bottom)
angle_C = np.radians(270)

point_A = (center[0] + radius * np.cos(angle_A), center[1] + radius * np.sin(angle_A))
point_B = (center[0] + radius * np.cos(angle_B), center[1] + radius * np.sin(angle_B))
point_C = (center[0] + radius * np.cos(angle_C), center[1] + radius * np.sin(angle_C))

# Draw points A, B, C
ax.plot(point_A[0], point_A[1], 'ro', markersize=8)
ax.plot(point_B[0], point_B[1], 'ro', markersize=8)
ax.plot(point_C[0], point_C[1], 'ro', markersize=8)

# Label points
ax.text(point_A[0] - 0.25, point_A[1] + 0.15, 'A', fontsize=16, fontweight='bold')
ax.text(point_B[0] + 0.15, point_B[1] + 0.15, 'B', fontsize=16, fontweight='bold')
ax.text(point_C[0] + 0.15, point_C[1] - 0.25, 'C', fontsize=16, fontweight='bold')

# Draw radii OA and OB
ax.plot([center[0], point_A[0]], [center[1], point_A[1]], 'b-', linewidth=2, label='Radius')
ax.plot([center[0], point_B[0]], [center[1], point_B[1]], 'b-', linewidth=2)

# Draw chords AC and BC
ax.plot([point_A[0], point_C[0]], [point_A[1], point_C[1]], 'g--', linewidth=1.5, alpha=0.7)
ax.plot([point_B[0], point_C[0]], [point_B[1], point_C[1]], 'g--', linewidth=1.5, alpha=0.7)

# Draw chord AB (the arc subtending both angles)
ax.plot([point_A[0], point_B[0]], [point_A[1], point_B[1]], 'r-', linewidth=2.5, alpha=0.8)

# Draw angle at center (AOB)
angle_center_start = np.degrees(angle_B)
angle_center_end = np.degrees(angle_A)
arc_center = patches.Arc(center, 0.5, 0.5, angle=0,
                         theta1=angle_center_start, theta2=angle_center_end,
                         color='blue', linewidth=2.5)
ax.add_patch(arc_center)

# Add angle label for center angle
angle_mid_center = np.radians((angle_center_start + angle_center_end) / 2)
label_pos_center = (center[0] + 0.35 * np.cos(angle_mid_center),
                    center[1] + 0.35 * np.sin(angle_mid_center))
ax.text(label_pos_center[0], label_pos_center[1], '∠AOB', fontsize=13,
        fontweight='bold', color='blue')

# Draw angle at circumference (ACB)
# Calculate angles from C to A and C to B
vec_CA = (point_A[0] - point_C[0], point_A[1] - point_C[1])
vec_CB = (point_B[0] - point_C[0], point_B[1] - point_C[1])
angle_CA = np.degrees(np.arctan2(vec_CA[1], vec_CA[0]))
angle_CB = np.degrees(np.arctan2(vec_CB[1], vec_CB[0]))

arc_circum = patches.Arc(point_C, 0.5, 0.5, angle=0,
                         theta1=angle_CB, theta2=angle_CA,
                         color='green', linewidth=2.5)
ax.add_patch(arc_circum)

# Add angle label for circumference angle
angle_mid_circum = np.radians((angle_CA + angle_CB) / 2)
label_pos_circum = (point_C[0] + 0.4 * np.cos(angle_mid_circum),
                    point_C[1] + 0.4 * np.sin(angle_mid_circum))
ax.text(label_pos_circum[0], label_pos_circum[1], '∠ACB', fontsize=13,
        fontweight='bold', color='green')

# Add title
ax.text(0, 1.9, 'Circle Theorem: Angle at Center and Circumference',
        fontsize=14, fontweight='bold', ha='center')

# Add subtitle explaining the theorem
ax.text(0, -1.9, 'The angle at the center (∠AOB) is twice the angle at the circumference (∠ACB)',
        fontsize=11, ha='center', style='italic')

plt.tight_layout()

# Get the current working directory and save there
import os
output_path = os.path.join(os.getcwd(), 'diagrams', 'fixture_geo_circle_001_question.png')
os.makedirs(os.path.dirname(output_path), exist_ok=True)

plt.savefig(output_path, dpi=300, bbox_inches='tight',
            facecolor='white', edgecolor='none')
print(f"Diagram saved successfully to: {output_path}")

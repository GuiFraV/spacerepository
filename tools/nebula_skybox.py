"""Genere une skybox equirectangulaire de nebuleuse volumetrique.

Usage:
  blender --background --python nebula_skybox.py -- <width> <samples> <output_path>
"""

import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
WIDTH = int(argv[0]) if len(argv) > 0 else 1024
SAMPLES = int(argv[1]) if len(argv) > 1 else 64
OUTPUT = argv[2] if len(argv) > 2 else "//nebula_test.jpg"
HEIGHT = WIDTH // 2

scene = bpy.context.scene

for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

# --- camera equirectangulaire au centre ---
cam_data = bpy.data.cameras.new("SkyCam")
cam_data.type = "PANO"
try:
    cam_data.panorama_type = "EQUIRECTANGULAR"
except AttributeError:
    cam_data.cycles.panorama_type = "EQUIRECTANGULAR"
cam = bpy.data.objects.new("SkyCam", cam_data)
cam.location = (0, 0, 0)
cam.rotation_euler = (1.5707963, 0, 0)
scene.collection.objects.link(cam)
scene.camera = cam

# --- monde noir + etoiles lointaines ---
world = bpy.data.worlds.new("Void")
world.use_nodes = True
wnodes = world.node_tree.nodes
wlinks = world.node_tree.links
bg = wnodes["Background"]
bg.inputs["Strength"].default_value = 1.0

wcoord = wnodes.new("ShaderNodeTexCoord")
wvoronoi = wnodes.new("ShaderNodeTexVoronoi")
wvoronoi.inputs["Scale"].default_value = 90.0
wlinks.new(wcoord.outputs["Generated"], wvoronoi.inputs["Vector"])

wramp = wnodes.new("ShaderNodeValToRGB")
wramp.color_ramp.elements[0].position = 0.0
wramp.color_ramp.elements[0].color = (1, 1, 1, 1)
wramp.color_ramp.elements[1].position = 0.028
wramp.color_ramp.elements[1].color = (0, 0, 0, 1)
wlinks.new(wvoronoi.outputs["Distance"], wramp.inputs["Fac"])

wbright = wnodes.new("ShaderNodeTexNoise")
wbright.inputs["Scale"].default_value = 25.0
wlinks.new(wcoord.outputs["Generated"], wbright.inputs["Vector"])

wmix = wnodes.new("ShaderNodeMath")
wmix.operation = "MULTIPLY"
wlinks.new(wramp.outputs["Color"], wmix.inputs[0])
wlinks.new(wbright.outputs["Fac"], wmix.inputs[1])

wgain = wnodes.new("ShaderNodeMath")
wgain.operation = "MULTIPLY"
wgain.inputs[1].default_value = 2.6
wlinks.new(wmix.outputs["Value"], wgain.inputs[0])
wlinks.new(wgain.outputs["Value"], bg.inputs["Color"])
scene.world = world

# --- cube volumetrique ---
bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 0))
cube = bpy.context.active_object
cube.scale = (20, 20, 20)

mat = bpy.data.materials.new("NebulaVolume")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

output = nodes.new("ShaderNodeOutputMaterial")
output.location = (900, 0)

volume = nodes.new("ShaderNodeVolumePrincipled")
volume.location = (650, 0)
volume.inputs["Color"].default_value = (0.69, 0.69, 0.69, 1)
volume.inputs["Anisotropy"].default_value = 0.3
volume.inputs["Emission Color"].default_value = (0.9, 0.34, 0.12, 1)
links.new(volume.outputs["Volume"], output.inputs["Volume"])

coords = nodes.new("ShaderNodeTexCoord")
coords.location = (-900, 0)

mapping = nodes.new("ShaderNodeMapping")
mapping.location = (-700, 0)
mapping.inputs["Scale"].default_value = (1.5, 1.5, 1.5)
links.new(coords.outputs["Object"], mapping.inputs["Vector"])

noise_broad = nodes.new("ShaderNodeTexNoise")
noise_broad.location = (-500, 150)
noise_broad.inputs["Scale"].default_value = 0.8
noise_broad.inputs["Detail"].default_value = 3.0
links.new(mapping.outputs["Vector"], noise_broad.inputs["Vector"])

noise_fine = nodes.new("ShaderNodeTexNoise")
noise_fine.location = (-500, -150)
noise_fine.inputs["Scale"].default_value = 3.5
noise_fine.inputs["Detail"].default_value = 12.0
noise_fine.inputs["Roughness"].default_value = 0.68
noise_fine.inputs["Distortion"].default_value = 1.8
links.new(mapping.outputs["Vector"], noise_fine.inputs["Vector"])

combine = nodes.new("ShaderNodeMath")
combine.operation = "MULTIPLY"
combine.location = (-300, 0)
links.new(noise_broad.outputs["Fac"], combine.inputs[0])
links.new(noise_fine.outputs["Fac"], combine.inputs[1])

ramp = nodes.new("ShaderNodeValToRGB")
ramp.location = (-100, 0)
ramp.color_ramp.elements[0].position = 0.36
ramp.color_ramp.elements[1].position = 0.62
links.new(combine.outputs["Value"], ramp.inputs["Fac"])

density = nodes.new("ShaderNodeMath")
density.operation = "MULTIPLY"
density.inputs[1].default_value = 0.28
density.location = (300, 0)
links.new(ramp.outputs["Color"], density.inputs[0])
links.new(density.outputs["Value"], volume.inputs["Density"])

emission = nodes.new("ShaderNodeMath")
emission.operation = "MULTIPLY"
emission.inputs[1].default_value = 0.1
emission.location = (300, -200)
links.new(ramp.outputs["Color"], emission.inputs[0])
links.new(emission.outputs["Value"], volume.inputs["Emission Strength"])

cube.data.materials.append(mat)

# --- lumieres internes ---
def add_light(name, location, power, color, radius):
    data = bpy.data.lights.new(name, "POINT")
    data.energy = power
    data.color = color
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    scene.collection.objects.link(obj)


add_light("WarmCore", (14, 10, 7), 90000, (1.0, 0.54, 0.23), 5)
add_light("CoolFill", (-16, -8, -5), 55000, (0.16, 0.44, 0.66), 6)
add_light("MagentaAccent", (5, -14, 9), 28000, (0.54, 0.16, 0.4), 5)

# --- rendu ---
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.volume_step_rate = 0.5
scene.cycles.volume_max_steps = 256

try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for device_type in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
        try:
            prefs.compute_device_type = device_type
            prefs.get_devices()
            enabled = False
            for device in prefs.devices:
                if device.type != "CPU":
                    device.use = True
                    enabled = True
            if enabled:
                scene.cycles.device = "GPU"
                print(f"GPU rendering enabled via {device_type}")
                break
        except TypeError:
            continue
except Exception as exc:
    print(f"GPU setup failed, falling back to CPU: {exc}")

scene.render.resolution_x = WIDTH
scene.render.resolution_y = HEIGHT
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 92
scene.view_settings.view_transform = "Standard"
scene.render.filepath = OUTPUT

bpy.ops.render.render(write_still=True)
print(f"Saved: {OUTPUT}")

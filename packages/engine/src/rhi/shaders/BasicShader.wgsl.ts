/**
 * BasicShader.wgsl.ts - Shader WGSL fundamental para validación del RHI.
 * Soporte para Proyección 3D e Instanced Rendering vía Storage Buffers.
 */

export const BasicShaderWGSL = `
@group(0) @binding(0) var<uniform> camera: mat4x4<f32>;
@group(1) @binding(0) var<storage, read> transformData: array<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32, @builtin(instance_index) instanceIdx : u32) -> VertexOutput {
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 0.5),
        vec2<f32>(-0.5, -0.5),
        vec2<f32>(0.5, -0.5)
    );

    // Stride de 16 floats (DOD Alignment)
    let base = instanceIdx * 16u;
    
    // Extraer datos del pool
    let posX = transformData[base];
    let posY = transformData[base + 1u];
    let posZ = transformData[base + 2u];
    let scaleX = transformData[base + 7u];
    let scaleY = transformData[base + 8u];

    // Aplicar transformación local
    let finalX = (pos[VertexIndex].x * scaleX) + posX;
    let finalY = (pos[VertexIndex].y * scaleY) + posY;

    var output: VertexOutput;
    output.position = camera * vec4<f32>(finalX, finalY, posZ, 1.0);
    
    // Coloración dinámica basada en el ID de instancia
    let r = f32(instanceIdx % 100u) / 100.0;
    let g = f32((instanceIdx / 100u) % 100u) / 100.0;
    let b = 1.0 - (r + g) * 0.5;
    output.color = vec3<f32>(r, g, b);

    return output;
}

@fragment
fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(color, 1.0);
}
`;

/**
 * BasicShader.wgsl.ts - Shader WGSL fundamental para Serion Engine.
 * Soporte para Vertex Buffers, 3D Projection e Instanced Rendering.
 */

export const BasicShaderWGSL = `
@group(0) @binding(0) var<uniform> camera: mat4x4<f32>;
@group(1) @binding(0) var<storage, read> transformData: array<f32>;

struct VertexInput {
    @location(0) position: vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

@vertex
fn vs_main(model: VertexInput, @builtin(instance_index) instanceIdx : u32) -> VertexOutput {
    // Stride de 16 floats (DOD Alignment)
    let base = instanceIdx * 16u;
    
    // Extraer datos de transformación del pool
    let posX = transformData[base];
    let posY = transformData[base + 1u];
    let posZ = transformData[base + 2u];
    let scaleX = transformData[base + 7u];
    let scaleY = transformData[base + 8u];
    let scaleZ = transformData[base + 9u];

    // Aplicar transformación local (Escalado y Posicionamiento)
    let worldPos = vec3<f32>(
        (model.position.x * scaleX) + posX,
        (model.position.y * scaleY) + posY,
        (model.position.z * scaleZ) + posZ
    );

    var output: VertexOutput;
    output.position = camera * vec4<f32>(worldPos, 1.0);
    
    // Coloración dinámica basada en el ID de instancia para el Stress Test
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

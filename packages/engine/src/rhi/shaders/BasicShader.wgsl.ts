/**
 * BasicShader.wgsl.ts - Shader WGSL fundamental para validación del RHI.
 * Renderiza un triángulo neón usando vértices hardcodeados.
 */

export const BasicShaderWGSL = `
@group(0) @binding(0) var<storage, read> transformData: array<f32>;

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32, @builtin(instance_index) instanceIdx : u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 0.5),
        vec2<f32>(-0.5, -0.5),
        vec2<f32>(0.5, -0.5)
    );

    // Stride de 16 floats (DOD Alignment)
    let base = instanceIdx * 16u;
    
    // Extraer datos crudos del pool
    let posX = transformData[base];
    let posY = transformData[base + 1u];
    let scaleX = transformData[base + 7u];
    let scaleY = transformData[base + 8u];

    // Aplicar transformación
    let finalX = (pos[VertexIndex].x * scaleX) + posX;
    let finalY = (pos[VertexIndex].y * scaleY) + posY;

    return vec4<f32>(finalX, finalY, 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
    return vec4<f32>(0.0, 1.0, 0.0, 1.0); // Verde Neón (Serion Signature)
}
`;

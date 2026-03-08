/**
 * BasicShader.wgsl.ts - Shader WGSL fundamental para Serion Engine.
 * Soporte para Layout Entrelazado (Pos, Norm, UV) e Instanced Rendering.
 */

export const BasicShaderWGSL = `
@group(0) @binding(0) var<uniform> camera: mat4x4<f32>;
@group(1) @binding(0) var<storage, read> transformData: array<f32>;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldNormal: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) debugColor: vec4<f32>,
};

@vertex
fn vs_main(model: VertexInput, @builtin(instance_index) instanceIdx : u32) -> VertexOutput {
    let base = instanceIdx * 16u;
    
    // Extraer datos de transformación
    let posX = transformData[base];
    let posY = transformData[base + 1u];
    let posZ = transformData[base + 2u];
    let scaleX = transformData[base + 7u];
    let scaleY = transformData[base + 8u];
    let scaleZ = transformData[base + 9u];

    // Aplicar transformación local
    let worldPos = vec3<f32>(
        (model.position.x * scaleX) + posX,
        (model.position.y * scaleY) + posY,
        (model.position.z * scaleZ) + posZ
    );

    var output: VertexOutput;
    output.position = camera * vec4<f32>(worldPos, 1.0);
    output.worldNormal = model.normal; // De momento normal hardcodeada (sin rotación)
    output.uv = model.uv;
    
    // Debug: Visualizar normales como color
    output.debugColor = vec4<f32>(model.normal * 0.5 + 0.5, 1.0);

    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return input.debugColor;
}
`;

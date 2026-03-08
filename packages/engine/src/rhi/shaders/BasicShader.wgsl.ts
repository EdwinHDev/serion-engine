/**
 * BasicShader.wgsl.ts - Shader WGSL fundamental para Serion Engine.
 * Capa 10: Iluminación PBR Hemisférica y Matriz Normal.
 */

export const BasicShaderWGSL = `
struct GlobalEnvironment {
    viewProjectionMatrix: mat4x4<f32>,
    cameraPosition: vec4<f32>,         // xyz + pad
    sunDirection_Intensity: vec4<f32>, // xyz + w(intensity)
    sunColor_AmbientInt: vec4<f32>,    // xyz + w(ambient intensity)
    skyColor: vec4<f32>,
    groundColor: vec4<f32>
}
@group(0) @binding(0) var<uniform> env: GlobalEnvironment;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    
    // Matriz de Modelo (Instanced) - Locations 3, 4, 5, 6
    @location(3) model_res0: vec4<f32>,
    @location(4) model_res1: vec4<f32>,
    @location(5) model_res2: vec4<f32>,
    @location(6) model_res3: vec4<f32>,

    // Matriz Normal (Instanced) - Locations 7, 8, 9, 10
    @location(7) normal_res0: vec4<f32>,
    @location(8) normal_res1: vec4<f32>,
    @location(9) normal_res2: vec4<f32>,
    @location(10) normal_res3: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPosition: vec3<f32>,
    @location(1) worldNormal: vec3<f32>,
    @location(2) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    let modelMatrix = mat4x4<f32>(
        input.model_res0,
        input.model_res1,
        input.model_res2,
        input.model_res3
    );

    let normalMatrix = mat4x4<f32>(
        input.normal_res0,
        input.normal_res1,
        input.normal_res2,
        input.normal_res3
    );

    var output: VertexOutput;
    
    let worldPos = modelMatrix * vec4<f32>(input.position, 1.0);
    output.worldPosition = worldPos.xyz;
    output.position = env.viewProjectionMatrix * worldPos;
    
    // Transformar normal usando la Matriz Normal (Inverse Transpose)
    output.worldNormal = normalize((normalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
    output.uv = input.uv;

    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(input.worldNormal);
    
    // --- CONSTANTES FÍSICAS ---
    let EXPOSURE: f32 = 1.0 / 100000.0;
    let baseColor = vec3<f32>(0.8, 0.8, 0.8);
    
    // --- LUZ DIRECTA (SOL) ---
    // sunDirection ya viene invertido o lo invertimos aquí según estándar
    let nDotL = max(dot(normal, -normalize(env.sunDirection_Intensity.xyz)), 0.0);
    let directLight = nDotL * env.sunColor_AmbientInt.xyz * (env.sunDirection_Intensity.w * EXPOSURE);
    
    // --- LUZ AMBIENTAL HEMISFÉRICA (Z-UP) ---
    // Mapeamos Z de [-1, 1] a [0, 1]
    let hemiMix = (normal.z * 0.5) + 0.5;
    let ambientLight = mix(env.groundColor.xyz, env.skyColor.xyz, hemiMix) * env.sunColor_AmbientInt.w;
    
    // --- COLOR FINAL ---
    let finalRadiance = baseColor * (directLight + ambientLight);
    
    return vec4<f32>(finalRadiance, 1.0);
}
`;

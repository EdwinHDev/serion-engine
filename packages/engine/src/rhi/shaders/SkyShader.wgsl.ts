/**
 * SkyShader.wgsl.ts - Sombreador Procedural de Atmósfera Física.
 * Capa 13.10: GPU Sky Pass con Early-Z.
 */
export const SkyShaderWGSL = `
struct GlobalEnvironment {
    viewProjectionMatrix: mat4x4<f32>,
    lightViewProj0: mat4x4<f32>,
    lightViewProj1: mat4x4<f32>,
    cascadeSplits: vec4<f32>,
    cameraPosition_Unused: vec4<f32>,
    sunDirection_Intensity: vec4<f32>,
    sunColor_Ambient: vec4<f32>,
    skyColor_Alpha: vec4<f32>,
    groundColor_Alpha: vec4<f32>,
    rayleigh_mie: vec4<f32>, // Rayleigh (RGB), Mie (W)
    radii: vec4<f32>,        // PlanetR (X), AtmosR (Y)
};

@group(0) @binding(0) var<uniform> env: GlobalEnvironment;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var out: VertexOutput;
    // Full-Screen Quad (Triangle Strip)
    var pos = array<vec2<f32>, 4>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0,  1.0)
    );
    
    let p = pos[vertexIndex];
    // Early-Z: Forzamos profundidad 1.0 (z = w)
    out.position = vec4<f32>(p, 1.0, 1.0);
    out.uv = p;
    return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Reconstrucción del Rayo de la Cámara
    let invVP = inverse(env.viewProjectionMatrix);
    let viewPos = invVP * vec4<f32>(input.uv, 0.0, 1.0);
    let worldDir = normalize(viewPos.xyz / viewPos.w - env.cameraPosition_Unused.xyz);
    
    let sunDir = -normalize(env.sunDirection_Intensity.xyz);
    let sunIntensity = env.sunDirection_Intensity.w;
    
    // --- DISPERSIÓN FÍSICA APROXIMADA ---
    let cosTheta = dot(worldDir, sunDir);
    
    // 1. Rayleigh: Gradiente de elevación azul/blanco
    let rayleighFactor = max(0.0, worldDir.z * 0.5 + 0.5);
    let skyBase = mix(env.groundColor_Alpha.xyz, env.skyColor_Alpha.xyz, rayleighFactor);
    
    // 2. Mie: Disco Solar y Halo
    // Un halo difuso para iluminar el horizonte
    let mieHalo = pow(max(0.0, cosTheta), 8.0) * 0.2;
    // El disco solar real (muy afilado)
    let sunDisc = pow(max(0.0, cosTheta), 2000.0) * 10.0;
    
    // Mezcla de colores (Simplificada para rendimiento)
    let atmosphereColor = skyBase + (env.sunColor_Ambient.xyz * (mieHalo + sunDisc) * (sunIntensity / 100000.0));
    
    return vec4<f32>(atmosphereColor, 1.0);
}

// Función auxiliar para invertir matriz 4x4 en shader (indispensable para reconstruir rayos)
fn inverse(m: mat4x4<f32>) -> mat4x4<f32> {
    let a00 = m[0][0]; let a01 = m[0][1]; let a02 = m[0][2]; let a03 = m[0][3];
    let a10 = m[1][0]; let a11 = m[1][1]; let a12 = m[1][2]; let a13 = m[1][3];
    let a20 = m[2][0]; let a21 = m[2][1]; let a22 = m[2][2]; let a23 = m[2][3];
    let a30 = m[3][0]; let a31 = m[3][1]; let a32 = m[3][2]; let a33 = m[3][3];

    let b00 = a00 * a11 - a01 * a10;
    let b01 = a00 * a12 - a02 * a10;
    let b02 = a00 * a13 - a03 * a10;
    let b03 = a01 * a12 - a02 * a11;
    let b04 = a01 * a13 - a03 * a11;
    let b05 = a02 * a13 - a03 * a12;
    let b06 = a20 * a31 - a21 * a30;
    let b07 = a20 * a32 - a22 * a30;
    let b08 = a20 * a33 - a23 * a30;
    let b09 = a21 * a32 - a22 * a31;
    let b10 = a21 * a33 - a23 * a31;
    let b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    return mat4x4<f32>(
        (a11 * b11 - a12 * b10 + a13 * b09) / det,
        (a02 * b10 - a01 * b11 - a03 * b09) / det,
        (a31 * b05 - a32 * b04 + a33 * b03) / det,
        (a22 * b04 - a21 * b05 - a23 * b03) / det,
        (a12 * b08 - a10 * b11 - a13 * b07) / det,
        (a00 * b11 - a02 * b08 + a03 * b07) / det,
        (a32 * b02 - a30 * b05 - a33 * b01) / det,
        (a20 * b05 - a22 * b02 + a23 * b01) / det,
        (a10 * b10 - a11 * b08 + a13 * b06) / det,
        (a01 * b08 - a00 * b10 - a03 * b06) / det,
        (a30 * b04 - a31 * b02 + a33 * b00) / det,
        (a21 * b02 - a20 * b04 - a23 * b00) / det,
        (a11 * b07 - a10 * b09 - a12 * b06) / det,
        (a00 * b09 - a01 * b07 + a02 * b06) / det,
        (a31 * b01 - a30 * b03 - a32 * b00) / det,
        (a20 * b03 - a21 * b01 + a22 * b00) / det
    );
}
`;

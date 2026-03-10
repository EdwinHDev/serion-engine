export const SkyShaderWGSL = `
struct GlobalEnvironment {
    viewProjectionMatrix: mat4x4<f32>,
    lightViewProj0: mat4x4<f32>,
    lightViewProj1: mat4x4<f32>,
    cascadeSplits: vec4<f32>,
    cameraPosition: vec4<f32>,
    sunDirection_Intensity: vec4<f32>,
    sunColor_Ambient: vec4<f32>,
    skyColor_Alpha: vec4<f32>,
    groundColor_Alpha: vec4<f32>,
};

@group(0) @binding(0) var<uniform> env: GlobalEnvironment;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var out: VertexOutput;
    var pos = array<vec2<f32>, 4>(
        vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0,  1.0)
    );
    let p = pos[vertexIndex];
    out.position = vec4<f32>(p, 1.0, 1.0);
    out.uv = p;
    return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let invVP = inverse(env.viewProjectionMatrix);
    let viewPos = invVP * vec4<f32>(input.uv, 1.0, 1.0);
    
    // BLINDAJE 1: Evitar división por W=0
    let safeW = max(abs(viewPos.w), 0.000001) * sign(viewPos.w + 0.0000001);
    let dirRaw = (viewPos.xyz / safeW) - env.cameraPosition.xyz;
    
    // BLINDAJE 2: Prevenir vector nulo antes de normalizar
    let worldDir = normalize(dirRaw + vec3<f32>(0.00001));
    let sunDir = -normalize(env.sunDirection_Intensity.xyz + vec3<f32>(0.00001));
    
    // BLINDAJE 3 (EL ASESINO): Forzar que el coseno JAMÁS supere 0.9999
    // Esto garantiza que la base de pow() nunca sea negativa.
    let cosTheta = clamp(dot(worldDir, sunDir), -0.9999, 0.9999);
    
    let rayleighFactor = smoothstep(-0.2, 0.4, worldDir.z);
    let skyBase = mix(env.groundColor_Alpha.xyz, env.skyColor_Alpha.xyz, rayleighFactor);
    
    let sunRadiusCos = 0.99980; 
    let sunEdgeSoftness = 0.00015;
    let discFactor = smoothstep(sunRadiusCos - sunEdgeSoftness, sunRadiusCos, cosTheta);
    let physicalSunDisc = env.sunColor_Ambient.xyz * discFactor * 50.0;
    
    let g1 = 0.995;
    let base1 = max(1.0 + g1*g1 - 2.0 * g1 * cosTheta, 0.00001);
    let hg1 = (1.0 - g1*g1) / (4.0 * 3.14159 * pow(base1, 1.5));
    
    let g2 = 0.850;
    let base2 = max(1.0 + g2*g2 - 2.0 * g2 * cosTheta, 0.00001);
    let hg2 = (1.0 - g2*g2) / (4.0 * 3.14159 * pow(base2, 1.5));
    
    let mieHalo = env.sunColor_Ambient.xyz * (hg1 * 0.05 + hg2 * 0.02) * rayleighFactor;
    let rawColor = max(skyBase + physicalSunDisc + mieHalo, vec3<f32>(0.0));
    return vec4<f32>(rawColor, 1.0);
}

fn inverse(m: mat4x4<f32>) -> mat4x4<f32> {
    let a00 = m[0][0]; let a01 = m[0][1]; let a02 = m[0][2]; let a03 = m[0][3];
    let a10 = m[1][0]; let a11 = m[1][1]; let a12 = m[1][2]; let a13 = m[1][3];
    let a20 = m[2][0]; let a21 = m[2][1]; let a22 = m[2][2]; let a23 = m[2][3];
    let a30 = m[3][0]; let a31 = m[3][1]; let a32 = m[3][2]; let a33 = m[3][3];

    let b00 = a00 * a11 - a01 * a10; let b01 = a00 * a12 - a02 * a10;
    let b02 = a00 * a13 - a03 * a10; let b03 = a01 * a12 - a02 * a11;
    let b04 = a01 * a13 - a03 * a11; let b05 = a02 * a13 - a03 * a12;
    let b06 = a20 * a31 - a21 * a30; let b07 = a20 * a32 - a22 * a30;
    let b08 = a20 * a33 - a23 * a30; let b09 = a21 * a32 - a22 * a31;
    let b10 = a21 * a33 - a23 * a31; let b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    
    // BLINDAJE 4: Prevenir colapso por determinante nulo
    let safeDet = select(det, 0.000001, abs(det) < 0.000001);
    let invDet = 1.0 / safeDet;

    return mat4x4<f32>(
        (a11 * b11 - a12 * b10 + a13 * b09) * invDet, (a02 * b10 - a01 * b11 - a03 * b09) * invDet,
        (a31 * b05 - a32 * b04 + a33 * b03) * invDet, (a22 * b04 - a21 * b05 - a23 * b03) * invDet,
        (a12 * b08 - a10 * b11 - a13 * b07) * invDet, (a00 * b11 - a02 * b08 + a03 * b07) * invDet,
        (a32 * b02 - a30 * b05 - a33 * b01) * invDet, (a20 * b05 - a22 * b02 + a23 * b01) * invDet,
        (a10 * b10 - a11 * b08 + a13 * b06) * invDet, (a01 * b08 - a00 * b10 - a03 * b06) * invDet,
        (a30 * b04 - a31 * b02 + a33 * b00) * invDet, (a21 * b02 - a20 * b04 - a23 * b00) * invDet,
        (a11 * b07 - a10 * b09 - a12 * b06) * invDet, (a00 * b09 - a01 * b07 + a02 * b06) * invDet,
        (a31 * b01 - a30 * b03 - a32 * b00) * invDet, (a20 * b03 - a21 * b01 + a22 * b00) * invDet
    );
}
`;
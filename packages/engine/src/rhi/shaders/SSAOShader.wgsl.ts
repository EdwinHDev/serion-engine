export const SSAOShaderWGSL = `
struct GlobalEnvironment {
    viewProjectionMatrix: mat4x4<f32>,
    lightViewProj0: mat4x4<f32>, lightViewProj1: mat4x4<f32>,
    cascadeSplits: vec4<f32>, cameraPosition: vec4<f32>,
    sunDirection_Intensity: vec4<f32>, sunColor_Ambient: vec4<f32>,
    skyColor_Alpha: vec4<f32>, groundColor_Alpha: vec4<f32>,
};
@group(0) @binding(0) var<uniform> env: GlobalEnvironment;
@group(0) @binding(1) var depthTexture: texture_depth_2d;

struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };

@vertex fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 4>(vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0));
    var out: VertexOutput;
    out.position = vec4<f32>(pos[vIdx], 0.0, 1.0);
    out.uv = pos[vIdx] * 0.5 + 0.5; out.uv.y = 1.0 - out.uv.y;
    return out;
}

// Interleaved Gradient Noise (Standard AAA)
fn ign(pixelPos: vec2<f32>) -> f32 {
    let magic = vec3<f32>(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(pixelPos, magic.xy)));
}

fn inverse(m: mat4x4<f32>) -> mat4x4<f32> {
    let a00 = m[0][0]; let a01 = m[0][1]; let a02 = m[0][2]; let a03 = m[0][3];
    let a10 = m[1][0]; let a11 = m[1][1]; let a12 = m[1][2]; let a13 = m[1][3];
    let a20 = m[2][0]; let a21 = m[2][1]; let a22 = m[2][2]; let a23 = m[2][3];
    let a30 = m[3][0]; let a31 = m[3][1]; let a32 = m[3][2]; let a33 = m[3][3];
    let b00 = a00 * a11 - a01 * a10; let b01 = a00 * a12 - a02 * a10; let b02 = a00 * a13 - a03 * a10; let b03 = a01 * a12 - a02 * a11;
    let b04 = a01 * a13 - a03 * a11; let b05 = a02 * a13 - a03 * a12; let b06 = a20 * a31 - a21 * a30; let b07 = a20 * a32 - a22 * a30;
    let b08 = a20 * a33 - a23 * a30; let b09 = a21 * a32 - a22 * a31; let b10 = a21 * a33 - a23 * a31; let b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    let invDet = 1.0 / select(det, 0.000001, abs(det) < 0.000001);
    return mat4x4<f32>(
        (a11 * b11 - a12 * b10 + a13 * b09) * invDet, (a02 * b10 - a01 * b11 - a03 * b09) * invDet, (a31 * b05 - a32 * b04 + a33 * b03) * invDet, (a22 * b04 - a21 * b05 - a23 * b03) * invDet,
        (a12 * b08 - a10 * b11 - a13 * b07) * invDet, (a00 * b11 - a02 * b08 + a03 * b07) * invDet, (a32 * b02 - a30 * b05 - a33 * b01) * invDet, (a20 * b05 - a22 * b02 + a23 * b01) * invDet,
        (a10 * b10 - a11 * b08 + a13 * b06) * invDet, (a01 * b08 - a00 * b10 - a03 * b06) * invDet, (a30 * b04 - a31 * b02 + a33 * b00) * invDet, (a21 * b02 - a20 * b04 - a23 * b00) * invDet,
        (a11 * b07 - a10 * b09 - a12 * b06) * invDet, (a00 * b09 - a01 * b07 + a02 * b06) * invDet, (a31 * b01 - a30 * b03 - a32 * b00) * invDet, (a20 * b03 - a21 * b01 + a22 * b00) * invDet
    );
}

@fragment fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let depth = textureLoad(depthTexture, vec2<i32>(input.position.xy), 0);
    let ndc = vec4<f32>(input.uv.x * 2.0 - 1.0, 1.0 - input.uv.y * 2.0, depth, 1.0);
    let invVP = inverse(env.viewProjectionMatrix);
    let unprojected = invVP * ndc;
    let worldPos = unprojected.xyz / unprojected.w;

    // Derivadas SIEMPRE antes de bifurcaciones
    let dx = dpdx(worldPos);
    let dy = dpdy(worldPos);
    let worldNormal = normalize(cross(dy, dx));

    if (depth >= 1.0) { return vec4<f32>(1.0); }

    var occlusion = 0.0;
    let radius = 25.0; 
    let samples = 16.0;
    
    var up = vec3<f32>(0.0, 0.0, 1.0);
    if (abs(worldNormal.z) > 0.999) { up = vec3<f32>(1.0, 0.0, 0.0); }
    let tangent = normalize(cross(up, worldNormal));
    let bitangent = cross(worldNormal, tangent);
    let tbn = mat3x3<f32>(tangent, bitangent, worldNormal);

    let noise = ign(input.position.xy) * 6.2831853; 

    for (var i = 0u; i < 16u; i = i + 1u) {
        let fi = f32(i);
        let r = sqrt((fi + 0.5) / samples); 
        let theta = fi * 2.3999632 + noise; 
        
        let sampleDir = tbn * vec3<f32>(r * cos(theta), r * sin(theta), sqrt(max(0.0, 1.0 - r*r)));
        
        // Bias físico (3.0) para evitar acné
        let samplePos = worldPos + (worldNormal * 3.0) + (sampleDir * radius);
        let clipPos = env.viewProjectionMatrix * vec4<f32>(samplePos, 1.0);
        if (clipPos.w <= 0.01) { continue; }

        let sampleNDC = clipPos.xyz / clipPos.w;
        let sampleUV = vec2<f32>(sampleNDC.x * 0.5 + 0.5, 0.5 - sampleNDC.y * 0.5);

        if (sampleUV.x >= 0.0 && sampleUV.x <= 1.0 && sampleUV.y >= 0.0 && sampleUV.y <= 1.0) {
            let sceneDepth = textureLoad(depthTexture, vec2<i32>(sampleUV * vec2<f32>(textureDimensions(depthTexture))), 0);
            
            if (sceneDepth < sampleNDC.z - 0.0001) { 
                let sNdc = vec4<f32>(sampleNDC.x, sampleNDC.y, sceneDepth, 1.0);
                let sUnp = invVP * sNdc;
                let sceneWorldPos = sUnp.xyz / sUnp.w;
                
                // Falloff Físico: Ignorar colisiones que están absurdamente lejos detrás del objeto
                let dist = length(worldPos - sceneWorldPos);
                let rangeCheck = smoothstep(0.0, 1.0, radius / max(dist, 0.001));
                occlusion += 1.0 * rangeCheck;
            }
        }
    }
    let aoFinal = pow(max(0.0, 1.0 - (occlusion / samples)), 1.5);
    return vec4<f32>(aoFinal, aoFinal, aoFinal, 1.0);
}
`;
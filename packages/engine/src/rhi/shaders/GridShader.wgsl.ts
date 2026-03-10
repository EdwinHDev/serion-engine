export const GridShaderWGSL = `
struct GlobalEnvironment {
    viewProjectionMatrix: mat4x4<f32>,
    lightViewProj0: mat4x4<f32>,
    lightViewProj1: mat4x4<f32>,
    cascadeSplits: vec4<f32>,
    cameraPosition: vec4<f32>,
    sunDirection_Intensity: vec4<f32>,
    sunColor_AmbientInt: vec4<f32>,
    skyColor: vec4<f32>,
    groundColor: vec4<f32>,
};

@group(0) @binding(0) var<uniform> env: GlobalEnvironment;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) nearPoint: vec3<f32>,
    @location(1) farPoint: vec3<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // 1. Dibujamos un Quad 2D plano pegado a la pantalla, anulando la interpolación defectuosa de W
    var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
    );
    
    let p = pos[vertexIndex];
    var out: VertexOutput;
    
    // Lo empujamos al fondo de la pantalla (Z=1.0)
    out.position = vec4<f32>(p, 1.0, 1.0); 

    let invVP = inverse(env.viewProjectionMatrix);
    
    // Des-proyectamos los puntos desde la pantalla hacia el mundo 3D
    let unprojectedNear = invVP * vec4<f32>(p, 0.0, 1.0);
    let unprojectedFar  = invVP * vec4<f32>(p, 1.0, 1.0);
    
    out.nearPoint = unprojectedNear.xyz / unprojectedNear.w;
    out.farPoint  = unprojectedFar.xyz / unprojectedFar.w;
    
    return out;
}

// Estructura de salida explícita para sobreescribir la profundidad
struct FragmentOutput {
    @location(0) color: vec4<f32>,
    @builtin(frag_depth) depth: f32, 
};

@fragment
fn fs_main(input: VertexOutput) -> FragmentOutput {
    var out: FragmentOutput;
    
    // 2. Calculamos el vector exacto del rayo visual
    let worldDir = normalize(input.farPoint - input.nearPoint);
    
    // 3. BLINDAJE MATEMÁTICO: Si miramos arriba o perfectamente al horizonte, abortamos.
    if (worldDir.z >= -0.0001) {
        discard;
    }
    
    // 4. Intersección pura: ¿En qué punto X,Y golpea el rayo el suelo (Z=0)?
    let t = -env.cameraPosition.z / worldDir.z;
    let worldPos = env.cameraPosition.xyz + worldDir * t;
    
    // 5. Corrección de Profundidad para que los cubos logren tapar a la grilla correctamente
    let clipPos = env.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
    if (clipPos.w <= 0.0) { discard; }
    out.depth = clipPos.z / clipPos.w;

    let coord = worldPos.xy;
    
    // Al calcular worldPos analíticamente, fwidth jamás recibe un NaN derivado del Clip Space
    let derivative = max(fwidth(coord), vec2<f32>(0.00001));
    
    let grid100 = abs(fract(coord / 100.0 - 0.5) - 0.5) / (derivative / 100.0);
    let grid1000 = abs(fract(coord / 1000.0 - 0.5) - 0.5) / (derivative / 1000.0);
    
    let line100 = 1.0 - min(min(grid100.x, grid100.y), 1.0);
    let line1000 = 1.0 - min(min(grid1000.x, grid1000.y), 1.0);
    
    var color = vec3<f32>(0.15);
    var alpha = 0.0;
    
    alpha = mix(alpha, 0.25, line100);
    color = mix(color, vec3<f32>(0.4), line1000);
    alpha = mix(alpha, 0.5, line1000);
    
    let axisX = 1.0 - min(abs(worldPos.y) / (derivative.y * 1.5), 1.0);
    let axisY = 1.0 - min(abs(worldPos.x) / (derivative.x * 1.5), 1.0);
    
    color = mix(color, vec3<f32>(0.8, 0.1, 0.1), axisX);
    alpha = mix(alpha, 0.7, axisX);
    color = mix(color, vec3<f32>(0.1, 0.8, 0.1), axisY);
    alpha = mix(alpha, 0.7, axisY);

    // Fade out cinematográfico
    let dist = length(worldPos.xy - env.cameraPosition.xy);
    let fade = 1.0 - clamp(dist / 50000.0, 0.0, 1.0);
    
    alpha = alpha * fade;
    if (alpha <= 0.01) {
        discard;
    }
    
    out.color = vec4<f32>(color, alpha);
    return out;
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
    
    // Parche por si la cámara produce una matriz singular
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
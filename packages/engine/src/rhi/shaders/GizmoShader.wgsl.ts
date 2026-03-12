export const GizmoShaderWGSL = `
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
@group(1) @binding(0) var<uniform> gizmoModelMatrix: mat4x4<f32>;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    
    // MAGIA AAA (Constant Scale)
    let worldCenter = gizmoModelMatrix * vec4<f32>(0.0, 0.0, 0.0, 1.0);
    let dist = distance(env.cameraPosition.xyz, worldCenter.xyz);
    let scaleFactor = max(dist * 0.003, 0.1); // Factor ajustable para mantener tamaño en pantalla
    
    let scaledPos = input.position * scaleFactor;
    let finalWorldPos = gizmoModelMatrix * vec4<f32>(scaledPos, 1.0);
    
    out.clip_position = env.viewProjectionMatrix * finalWorldPos;
    out.color = input.color;
    
    return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(input.color, 1.0);
}
`;

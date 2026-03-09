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
    @location(0) worldPos: vec3<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
    );

    let p = pos[vertexIndex] * 100000.0; 
    let worldPos = vec3<f32>(p.x, p.y, 0.0);

    var out: VertexOutput;
    out.position = env.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
    out.worldPos = worldPos;
    return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let coord = input.worldPos.xy;
    
    // BLINDAJE AAA: Evitar división por cero o NaN.
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
    
    let axisX = 1.0 - min(abs(input.worldPos.y) / (derivative.y * 1.5), 1.0);
    let axisY = 1.0 - min(abs(input.worldPos.x) / (derivative.x * 1.5), 1.0);
    
    color = mix(color, vec3<f32>(0.8, 0.1, 0.1), axisX);
    alpha = mix(alpha, 0.7, axisX);
    color = mix(color, vec3<f32>(0.1, 0.8, 0.1), axisY);
    alpha = mix(alpha, 0.7, axisY);

    let dist = length(input.worldPos.xy - env.cameraPosition.xy);
    let fade = 1.0 - clamp(dist / 50000.0, 0.0, 1.0);
    
    return vec4<f32>(color, alpha * fade);
}
`;

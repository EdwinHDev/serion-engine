export const BloomShaderWGSL = `
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var out: VertexOutput;
    var pos = array<vec2<f32>, 4>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0,  1.0)
    );
    let p = pos[vertexIndex];
    out.position = vec4<f32>(p, 0.0, 1.0);
    out.uv = p * 0.5 + 0.5;
    out.uv.y = 1.0 - out.uv.y;
    return out;
}

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var sceneTexture: texture_2d<f32>;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Single-pass Extract & Blur (Cruz 5-muestras)
    let offset = 1.0 / 512.0; 
    let offsets = array<vec2<f32>, 5>(
        vec2<f32>(0.0, 0.0),
        vec2<f32>(offset, 0.0),
        vec2<f32>(-offset, 0.0),
        vec2<f32>(0.0, offset),
        vec2<f32>(0.0, -offset)
    );

    var color = vec3<f32>(0.0);
    for (var i = 0; i < 5; i++) {
        color += textureSample(sceneTexture, texSampler, input.uv + offsets[i]).rgb;
    }
    color /= 5.0;

    // Extracción de brillo (Threshold > 1.5)
    let brightness = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
    if (brightness > 1.5) {
        return vec4<f32>(color, 1.0);
    }
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}
`;

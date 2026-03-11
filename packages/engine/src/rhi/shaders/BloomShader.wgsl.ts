export const BloomShaderWGSL = `
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
    out.position = vec4<f32>(p, 0.0, 1.0);
    out.uv = p * 0.5 + 0.5;
    out.uv.y = 1.0 - out.uv.y;
    return out;
}

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var sceneTexture: texture_2d<f32>;

// 1. EXTRACCIÓN SUAVE
@fragment
fn fs_extract(input: VertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(sceneTexture, texSampler, input.uv).rgb;
    let brightness = max(color.r, max(color.g, color.b));
    // Soft knee extraction (AAA Standard)
    let threshold = 1.5;
    let contribution = max(0.0, brightness - threshold) / max(brightness, 0.00001);
    return vec4<f32>(color * contribution, 1.0);
}

// 2. DOWNSAMPLE (Dual Kawase 5-Tap)
@fragment
fn fs_downsample(input: VertexOutput) -> @location(0) vec4<f32> {
    let texSize = vec2<f32>(textureDimensions(sceneTexture));
    let d = (1.0 / texSize) * 1.0; 
    
    let s0 = textureSample(sceneTexture, texSampler, input.uv).rgb;
    let s1 = textureSample(sceneTexture, texSampler, input.uv + vec2<f32>(-d.x, -d.y)).rgb;
    let s2 = textureSample(sceneTexture, texSampler, input.uv + vec2<f32>( d.x, -d.y)).rgb;
    let s3 = textureSample(sceneTexture, texSampler, input.uv + vec2<f32>(-d.x,  d.y)).rgb;
    let s4 = textureSample(sceneTexture, texSampler, input.uv + vec2<f32>( d.x,  d.y)).rgb;

    let result = s0 * 0.5 + (s1 + s2 + s3 + s4) * 0.125;
    return vec4<f32>(result, 1.0);
}

// 3. UPSAMPLE (9-Tap Tent Filter)
@fragment
fn fs_upsample(input: VertexOutput) -> @location(0) vec4<f32> {
    let texSize = vec2<f32>(textureDimensions(sceneTexture));
    let d = (1.0 / texSize) * 1.5; // Radius spread
    
    let s0 = textureSample(sceneTexture, texSampler, input.uv).rgb;
    let s1 = textureSample(sceneTexture, texSampler, input.uv + vec2<f32>(-d.x, -d.y)).rgb;
    let s2 = textureSample(sceneTexture, texSampler, input.uv + vec2<f32>( d.x, -d.y)).rgb;
    let s3 = textureSample(sceneTexture, texSampler, input.uv + vec2<f32>(-d.x,  d.y)).rgb;
    let s4 = textureSample(sceneTexture, texSampler, input.uv + vec2<f32>( d.x,  d.y)).rgb;
    
    let s5 = textureSample(sceneTexture, texSampler, input.uv + vec2<f32>( 0.0, -d.y)).rgb;
    let s6 = textureSample(sceneTexture, texSampler, input.uv + vec2<f32>( 0.0,  d.y)).rgb;
    let s7 = textureSample(sceneTexture, texSampler, input.uv + vec2<f32>(-d.x,  0.0)).rgb;
    let s8 = textureSample(sceneTexture, texSampler, input.uv + vec2<f32>( d.x,  0.0)).rgb;

    // Weights: Center 4/16, Cross 2/16, Corners 1/16
    let result = s0 * 0.25 + (s5 + s6 + s7 + s8) * 0.125 + (s1 + s2 + s3 + s4) * 0.0625;
    return vec4<f32>(result, 1.0);
}
`;
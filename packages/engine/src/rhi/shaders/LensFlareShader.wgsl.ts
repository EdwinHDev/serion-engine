export const LensFlareShaderWGSL = `
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
@group(0) @binding(1) var brightTexture: texture_2d<f32>;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let texCenter = vec2<f32>(0.5, 0.5);
    let ghostVec = (texCenter - input.uv) * 0.45;
    
    var result = vec3<f32>(0.0);
    
    // Ghosting (Fantasmas de lente reflejados hacia el centro)
    for (var i = 1; i <= 6; i++) {
        let offset = input.uv + ghostVec * f32(i);
        
        // Máscara radial para desvanecer los fantasmas hacia los bordes de la pantalla
        let weight = length(texCenter - offset);
        let mask = pow(max(0.0, 1.0 - weight / 0.7), 2.0);
        
        let sampleColor = textureSample(brightTexture, texSampler, offset).rgb;
        result += sampleColor * mask * 0.5;
    }
    
    // Halo (Anillo exterior expansivo)
    let haloVec = normalize(ghostVec) * 0.4;
    let haloOffset = input.uv + haloVec;
    let haloWeight = length(texCenter - haloOffset);
    let haloMask = pow(max(0.0, 1.0 - abs(haloWeight - 0.5) * 5.0), 3.0); // Anillo muy estricto
    
    let haloColor = textureSample(brightTexture, texSampler, haloOffset).rgb;
    result += haloColor * haloMask * 0.8;
    
    // Tinte de lente (Reflejos fríos/Morados AAA típicos de lentes anamórficos/cinematográficos)
    let lensTint = vec3<f32>(0.5, 0.8, 1.5);
    
    return vec4<f32>(result * lensTint, 1.0);
}
`;

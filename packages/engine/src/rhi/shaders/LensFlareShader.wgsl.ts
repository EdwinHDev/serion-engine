export const LensFlareShaderWGSL = `
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 4>(
        vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0,  1.0)
    );
    var out: VertexOutput;
    out.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
    out.uv = pos[vertexIndex] * 0.5 + 0.5;
    out.uv.y = 1.0 - out.uv.y;
    return out;
}

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var brightTexture: texture_2d<f32>;

const GHOST_COUNT: u32 = 6u;
const GHOST_SPACING: f32 = 0.35;
const HALO_RADIUS: f32 = 0.45;
const CHROMATIC_ABERRATION: f32 = 0.015;

fn getGhostColor(t: f32) -> vec3<f32> {
    let r = clamp(1.0 - abs(2.0 * t - 1.0) * 2.0, 0.0, 1.0);
    let g = clamp(1.0 - abs(2.0 * t - 1.3) * 2.0, 0.0, 1.0);
    let b = clamp(1.0 - abs(2.0 * t - 1.6) * 2.0, 0.0, 1.0);
    return vec3<f32>(r, g, b);
}

fn sampleCA(uv: vec2<f32>, offsetVec: vec2<f32>) -> vec3<f32> {
    let r = textureSample(brightTexture, texSampler, uv - offsetVec).r;
    let g = textureSample(brightTexture, texSampler, uv).g;
    let b = textureSample(brightTexture, texSampler, uv + offsetVec).b;
    return vec3<f32>(r, g, b);
}

@fragment fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // MAGIA AAA: Corrección de relación de aspecto para Halos y Viñeteado 100% circulares
    let texDim = vec2<f32>(textureDimensions(brightTexture));
    let aspect = texDim.x / texDim.y;
    let aspectVec = vec2<f32>(aspect, 1.0);

    let texCenter = vec2<f32>(0.5, 0.5);
    let flippedUV = vec2<f32>(1.0) - input.uv;
    
    let ghostVec = (texCenter - flippedUV) * GHOST_SPACING;
    let ghostVecPhysical = ghostVec * aspectVec;

    var result = vec3<f32>(0.0);

    // 1. GENERACIÓN DE FANTASMAS LIMPIOS
    for (var i = 0u; i < GHOST_COUNT; i = i + 1u) {
        let offset = flippedUV + ghostVec * f32(i);
        
        let distanceToCenter = length((texCenter - offset) * aspectVec);
        let weight = distanceToCenter / 0.707;
        let falloff = pow(max(0.0, 1.0 - weight), 4.0);

        let caVec = normalize(ghostVec) * CHROMATIC_ABERRATION * f32(i) * 0.2;
        let ghostColor = sampleCA(offset, caVec);

        let spectralColor = getGhostColor(f32(i) / f32(GHOST_COUNT));
        
        // Multiplicador drásticamente reducido (de 1.2 a 0.3)
        result += ghostColor * falloff * spectralColor * 0.3;
    }

    // 2. ARO DE LENTE (HALO PERFECTAMENTE REDONDO)
    let haloVecPhysical = normalize(ghostVecPhysical) * HALO_RADIUS;
    let haloVecUV = haloVecPhysical / aspectVec;
    let haloOffset = flippedUV + haloVecUV;
    
    let haloDist = length((texCenter - haloOffset) * aspectVec);
    let haloWeight = pow(max(0.0, 1.0 - haloDist * 3.0), 4.0); // Anillo más suave
    
    let haloCA = normalize(ghostVec) * CHROMATIC_ABERRATION * 1.5;
    let haloColorSample = sampleCA(haloOffset, haloCA);
    
    // Multiplicador del halo reducido
    result += haloColorSample * haloWeight * vec3<f32>(0.2, 0.4, 0.8) * 0.4;

    return vec4<f32>(result, 1.0);
}
`;
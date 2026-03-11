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

// ---------------------------------------------------------
// PASE 1: EXTRACCIÓN FÍSICA Y BLUR HORIZONTAL (61 Taps)
// ---------------------------------------------------------
@fragment
fn fs_extract_and_blur_h(input: VertexOutput) -> @location(0) vec4<f32> {
    var result = vec3<f32>(0.0);
    var totalWeight = 0.0;
    
    // Parámetros de difuminado masivo
    let sigma = 12.0;
    let radius: i32 = 30; // 61 iteraciones garantizadas por WebGPU

    for (var i: i32 = -radius; i <= radius; i = i + 1) {
        let fi = f32(i);
        let weight = exp(-(fi * fi) / (2.0 * sigma * sigma));
        
        // Multiplicador de expansión masiva (0.002 = alcance de hasta 6% de la pantalla)
        let offset = vec2<f32>(fi * 0.002, 0.0);
        let s = textureSample(sceneTexture, texSampler, input.uv + offset).rgb;

        // EXTRACCIÓN FÍSICA (AAA Standard): En lugar de un corte brusco, sustraemos la energía base.
        // Esto derrite los píxeles duros orgánicamente.
        let brightness = max(s.r, max(s.g, s.b));
        let contribution = max(0.0, brightness - 1.5) / max(brightness, 0.00001);
        let brightPart = s * contribution;

        result += brightPart * weight;
        totalWeight += weight;
    }

    return vec4<f32>(result / totalWeight, 1.0);
}

// ---------------------------------------------------------
// PASE 2: BLUR VERTICAL MASIVO (61 Taps)
// ---------------------------------------------------------
@fragment
fn fs_blur_v(input: VertexOutput) -> @location(0) vec4<f32> {
    var result = vec3<f32>(0.0);
    var totalWeight = 0.0;
    let sigma = 12.0;
    let radius: i32 = 30;

    for (var i: i32 = -radius; i <= radius; i = i + 1) {
        let fi = f32(i);
        let weight = exp(-(fi * fi) / (2.0 * sigma * sigma));
        
        // El offset en Y es un poco mayor para compensar el formato panorámico 16:9
        let offset = vec2<f32>(0.0, fi * 0.0035); 

        let s = textureSample(sceneTexture, texSampler, input.uv + offset).rgb;

        result += s * weight;
        totalWeight += weight;
    }

    // Devolvemos el resplandor multiplicado por un factor enorme 
    // para asegurar que el halo ciegue la pantalla.
    return vec4<f32>((result / totalWeight) * 2.0, 1.0);
}
`;
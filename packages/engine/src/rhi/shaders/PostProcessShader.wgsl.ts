export const PostProcessShaderWGSL = `
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var out: VertexOutput;
    // Triangle Strip para un Quad de Pantalla Completa
    // 0: (-1,-1), 1: (1,-1), 2: (-1,1), 3: (1,1)
    var pos = array<vec2<f32>, 4>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0,  1.0)
    );
    
    let p = pos[vertexIndex];
    out.position = vec4<f32>(p, 0.0, 1.0); // Z=0.0 (Fondo)
    out.uv = p * 0.5 + 0.5;
    out.uv.y = 1.0 - out.uv.y; // Invertir Y para coordenadas de textura standard
    return out;
}

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var sceneTexture: texture_2d<f32>;
@group(0) @binding(2) var bloomTexture: texture_2d<f32>;
@group(0) @binding(3) var lensFlareTexture: texture_2d<f32>;
@group(0) @binding(4) var selectionTexture: texture_2d<f32>;

@fragment fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let hdrColor = textureSampleLevel(sceneTexture, texSampler, input.uv, 0.0).rgb;
    let bloomColor = textureSampleLevel(bloomTexture, texSampler, input.uv, 0.0).rgb;
    let lensFlareColor = textureSampleLevel(lensFlareTexture, texSampler, input.uv, 0.0).rgb;

    let finalHdrColor = hdrColor + (bloomColor * 1.2);
    
    // AAA Outline Edge Detection
    let texSize = vec2<f32>(textureDimensions(selectionTexture));
    let texel = 1.0 / texSize;
    let thickness = 2.0;
    
    let cMask = textureSampleLevel(selectionTexture, texSampler, input.uv, 0.0).r;
    var edge = 0.0;
    edge += textureSampleLevel(selectionTexture, texSampler, input.uv + vec2(texel.x * thickness, 0.0), 0.0).r;
    edge += textureSampleLevel(selectionTexture, texSampler, input.uv + vec2(-texel.x * thickness, 0.0), 0.0).r;
    edge += textureSampleLevel(selectionTexture, texSampler, input.uv + vec2(0.0, texel.y * thickness), 0.0).r;
    edge += textureSampleLevel(selectionTexture, texSampler, input.uv + vec2(0.0, -texel.y * thickness), 0.0).r;
    edge += textureSampleLevel(selectionTexture, texSampler, input.uv + vec2(texel.x * thickness, texel.y * thickness), 0.0).r;
    edge += textureSampleLevel(selectionTexture, texSampler, input.uv + vec2(-texel.x * thickness, -texel.y * thickness), 0.0).r;
    edge += textureSampleLevel(selectionTexture, texSampler, input.uv + vec2(texel.x * thickness, -texel.y * thickness), 0.0).r;
    edge += textureSampleLevel(selectionTexture, texSampler, input.uv + vec2(-texel.x * thickness, texel.y * thickness), 0.0).r;
    
    let isOutline = max(0.0, clamp(edge, 0.0, 1.0) - cMask);
    // El color de selección puro que queremos
    let outlineColor = vec3<f32>(1.0, 0.6, 0.0) * isOutline * 2.5; 
    
    // Solo procesamos el mundo, ignoramos el outline
    let colorWithFlares = finalHdrColor + (lensFlareColor * 0.5);

    // FIX ÓPTICO: Control de Exposición (Camera Aperture)
    // Valores menores a 1.0 reducen el quemado bajo la luz solar directa
    let exposure = 0.75; 
    let exposedColor = colorWithFlares * exposure;

    // ACES Filmic Tone Mapping (Ahora recibe luz controlada)
    let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
    let mapped = clamp((exposedColor * (a * exposedColor + b)) / (exposedColor * (c * exposedColor + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));

    let gammaCorrected = pow(mapped, vec3<f32>(0.454545));

    // FIX AAA: Sumar el borde de selección al final de toda la óptica
    let finalOutput = gammaCorrected + outlineColor;

    // Luminancia en Alpha para FXAA
    let luma = dot(finalOutput, vec3<f32>(0.299, 0.587, 0.114));
    return vec4<f32>(finalOutput, luma);
}
`;

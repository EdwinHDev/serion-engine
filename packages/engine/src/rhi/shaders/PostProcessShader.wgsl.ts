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
    let hdrColor = textureSample(sceneTexture, texSampler, input.uv).rgb;
    let bloomColor = textureSample(bloomTexture, texSampler, input.uv).rgb;
    let lensFlareColor = textureSample(lensFlareTexture, texSampler, input.uv).rgb;

    // Composición HDR + Bloom (SSAO ya aplicado en el Forward Pass)
    let finalHdrColor = hdrColor + (bloomColor * 1.2);
    
    // AAA Outline Edge Detection
    let texSize = vec2<f32>(textureDimensions(selectionTexture));
    let texel = 1.0 / texSize;
    let thickness = 2.0; // Grosor del borde en píxeles
    
    let cMask = textureSample(selectionTexture, texSampler, input.uv).r;
    var edge = 0.0;
    edge += textureSample(selectionTexture, texSampler, input.uv + vec2(texel.x * thickness, 0.0)).r;
    edge += textureSample(selectionTexture, texSampler, input.uv + vec2(-texel.x * thickness, 0.0)).r;
    edge += textureSample(selectionTexture, texSampler, input.uv + vec2(0.0, texel.y * thickness)).r;
    edge += textureSample(selectionTexture, texSampler, input.uv + vec2(0.0, -texel.y * thickness)).r;
    
    edge += textureSample(selectionTexture, texSampler, input.uv + vec2(texel.x * thickness, texel.y * thickness)).r;
    edge += textureSample(selectionTexture, texSampler, input.uv + vec2(-texel.x * thickness, -texel.y * thickness)).r;
    edge += textureSample(selectionTexture, texSampler, input.uv + vec2(texel.x * thickness, -texel.y * thickness)).r;
    edge += textureSample(selectionTexture, texSampler, input.uv + vec2(-texel.x * thickness, texel.y * thickness)).r;
    
    // Solo dibujamos en el exterior del objeto
    let isOutline = max(0.0, clamp(edge, 0.0, 1.0) - cMask);
    
    // Color del borde (Amarillo/Naranja Unreal Engine) multiplicando por 5.0 para que emita luz
    let outlineColor = vec3<f32>(1.0, 0.6, 0.0) * isOutline * 5.0;
    
    // Inyectamos el borde sobre la composición
    let hdrWithOutline = finalHdrColor + outlineColor;
    let colorWithFlares = hdrWithOutline + (lensFlareColor * 0.5);

    // ACES Filmic
    let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
    let mapped = clamp((colorWithFlares * (a * colorWithFlares + b)) / (colorWithFlares * (c * colorWithFlares + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));

    return vec4<f32>(pow(mapped, vec3<f32>(0.454545)), 1.0);
}
`;

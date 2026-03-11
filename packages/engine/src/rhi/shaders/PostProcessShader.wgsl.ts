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
@group(0) @binding(3) var ssaoTexture: texture_2d<f32>;
@group(0) @binding(4) var lensFlareTexture: texture_2d<f32>;

@fragment fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let hdrColor = textureSample(sceneTexture, texSampler, input.uv).rgb;
    let bloomColor = textureSample(bloomTexture, texSampler, input.uv).rgb;
    let ao = textureSample(ssaoTexture, texSampler, input.uv).r;
    let lensFlareColor = textureSample(lensFlareTexture, texSampler, input.uv).rgb;

    // LUMA MASKING: Calcular la luminancia de la escena sin procesar
    let luma = dot(hdrColor, vec3<f32>(0.2126, 0.7152, 0.0722));

    // Si el píxel es intensamente brillante (ej. le pega el sol), la oclusión se desvanece a 1.0 (Sin Sombra)
    let directLightProtection = smoothstep(0.05, 1.0, luma);
    let physicalAO = mix(ao, 1.0, directLightProtection);

    // Aplicar AO corregido antes del Bloom
    let finalHdrColor = (hdrColor * physicalAO) + (bloomColor * 0.04);
    
    // Lens Flares
    let colorWithFlares = finalHdrColor + (lensFlareColor * 0.5);

    // ACES Filmic
    let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
    let mapped = clamp((colorWithFlares * (a * colorWithFlares + b)) / (colorWithFlares * (c * colorWithFlares + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));

    return vec4<f32>(pow(mapped, vec3<f32>(0.454545)), 1.0);
}
`;

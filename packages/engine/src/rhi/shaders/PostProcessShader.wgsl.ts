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

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let hdrColor = textureSample(sceneTexture, texSampler, input.uv).rgb;
    let bloomColor = textureSample(bloomTexture, texSampler, input.uv).rgb;
    let ao = textureSample(ssaoTexture, texSampler, input.uv).r;
    
    // Suma aditiva del resplandor (Bloom)
    // Extraer AO. Multiplica el color base por el AO *ANTES* de sumar el Bloom
    // Nota: El usuario especificó (bloomColor * bloomIntensity) pero no proveyó bloomIntensity en el query
    // Mantendremos una adición directa (o podemos poner un factor de 1.0)
    let finalHdrColor = (hdrColor * ao) + bloomColor;
    
    // 1. ACES Filmic Tonemapping (Standard AAA)
    // Comprime los valores HDR (>1.0) a un rango visible [0.0, 1.0]
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    let mappedColor = clamp((finalHdrColor * (a * finalHdrColor + b)) / (finalHdrColor * (c * finalHdrColor + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
    
    // 2. Corrección Gamma (1.0 / 2.2 = 0.4545)
    // Para que los colores se vean correctos en monitores sRGB
    let finalColor = pow(mappedColor, vec3<f32>(0.454545));
    
    return vec4<f32>(finalColor, 1.0);
}
`;

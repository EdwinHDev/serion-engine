export const SSAOBlurShaderWGSL = `
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

@group(0) @binding(0) var ssaoTexture: texture_2d<f32>;
@group(0) @binding(1) var depthTexture: texture_depth_2d;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let screenPos = vec2<i32>(input.position.xy);
    let centerDepth = textureLoad(depthTexture, screenPos, 0);

    // Si miramos al cielo, no hay nada que limpiar
    if (centerDepth >= 1.0) {
        return vec4<f32>(1.0, 1.0, 1.0, 1.0);
    }

    let centerAO = textureLoad(ssaoTexture, screenPos, 0).r;
    
    var result = 0.0;
    var totalWeight = 0.0;
    
    // Rango del desenfoque (Un kernel de 5x5 píxeles)
    let blurRange = 2; 

    for (var x = -blurRange; x <= blurRange; x++) {
        for (var y = -blurRange; y <= blurRange; y++) {
            let offset = vec2<i32>(x, y);
            let samplePos = screenPos + offset;

            let sampleAO = textureLoad(ssaoTexture, samplePos, 0).r;
            let sampleDepth = textureLoad(depthTexture, samplePos, 0);

            // MAGIA BILATERAL: 
            // Calculamos la diferencia de profundidad. Si el píxel vecino está muy lejos 
            // del píxel central (es decir, es el fondo o un objeto distinto), 
            // el peso de la mezcla cae a cero. ¡Las sombras nunca sangrarán por los bordes!
            let depthDiff = abs(centerDepth - sampleDepth);
            let weight = exp(-depthDiff * 4000.0); // La curva de sensibilidad al borde

            result += sampleAO * weight;
            totalWeight += weight;
        }
    }

    let finalAO = result / max(totalWeight, 0.0001);
    
    return vec4<f32>(finalAO, finalAO, finalAO, 1.0);
}
`;
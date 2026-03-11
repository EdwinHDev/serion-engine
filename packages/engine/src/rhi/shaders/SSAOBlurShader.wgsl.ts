export const SSAOBlurShaderWGSL = `
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };

@vertex fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 4>(vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0));
    var out: VertexOutput; out.position = vec4<f32>(pos[vIdx], 0.0, 1.0); out.uv = pos[vIdx] * 0.5 + 0.5; out.uv.y = 1.0 - out.uv.y; return out;
}

@group(0) @binding(0) var ssaoTexture: texture_2d<f32>;
@group(0) @binding(1) var depthTexture: texture_depth_2d;

// Convertir Z no lineal a lineal para comparar distancias reales
fn linearizeDepth(depth: f32) -> f32 {
    let near = 1.0; let far = 50000.0;
    return (2.0 * near * far) / (far + near - (2.0 * depth - 1.0) * (far - near));
}

@fragment fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let screenPos = vec2<i32>(input.position.xy);
    let centerDepthRaw = textureLoad(depthTexture, screenPos, 0);
    if (centerDepthRaw >= 1.0) { return vec4<f32>(1.0); }

    let centerDepth = linearizeDepth(centerDepthRaw);
    var result = 0.0; var totalWeight = 0.0;
    let blurRange = 2; // Kernel 5x5

    for (var x = -blurRange; x <= blurRange; x++) {
        for (var y = -blurRange; y <= blurRange; y++) {
            let samplePos = screenPos + vec2<i32>(x, y);
            let sampleAO = textureLoad(ssaoTexture, samplePos, 0).r;
            let sampleDepthRaw = textureLoad(depthTexture, samplePos, 0);
            let sampleDepth = linearizeDepth(sampleDepthRaw);

            // Filtro Bilateral Estricto: Sensibilidad altísima a la diferencia de profundidad
            let depthDiff = abs(centerDepth - sampleDepth);
            let weight = exp(-depthDiff * 0.1); 

            result += sampleAO * weight;
            totalWeight += weight;
        }
    }
    let finalAO = result / max(totalWeight, 0.0001);
    return vec4<f32>(finalAO, finalAO, finalAO, 1.0);
}
`;
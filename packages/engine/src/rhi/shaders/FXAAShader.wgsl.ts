export const FXAAShaderWGSL = `
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
@group(0) @binding(1) var colorTexture: texture_2d<f32>;

// FXAA 3.11 Quality - Configuración
const FXAA_EDGE_THRESHOLD: f32 = 0.125;
const FXAA_EDGE_THRESHOLD_MIN: f32 = 0.0312;
const FXAA_SUBPIX: f32 = 0.75;
const FXAA_SEARCH_STEPS: i32 = 10;

fn luminance(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(0.299, 0.587, 0.114));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let texSize = vec2<f32>(textureDimensions(colorTexture));
    let rcpFrame = 1.0 / texSize;

    // Muestreo central y vecinos cardinales
    let rgbaM = textureSampleLevel(colorTexture, texSampler, input.uv, 0.0);
    let lumaM = rgbaM.a; // Luminancia pre-calculada en alpha

    let lumaN  = textureSampleLevel(colorTexture, texSampler, input.uv + vec2<f32>( 0.0, -rcpFrame.y), 0.0).a;
    let lumaS  = textureSampleLevel(colorTexture, texSampler, input.uv + vec2<f32>( 0.0,  rcpFrame.y), 0.0).a;
    let lumaE  = textureSampleLevel(colorTexture, texSampler, input.uv + vec2<f32>( rcpFrame.x,  0.0), 0.0).a;
    let lumaW  = textureSampleLevel(colorTexture, texSampler, input.uv + vec2<f32>(-rcpFrame.x,  0.0), 0.0).a;

    // Rango local de contraste
    let rangeMax = max(max(lumaN, lumaS), max(max(lumaE, lumaW), lumaM));
    let rangeMin = min(min(lumaN, lumaS), min(min(lumaE, lumaW), lumaM));
    let range = rangeMax - rangeMin;

    // Si el contraste local es bajo, no aplicar FXAA (zona plana)
    if range < max(FXAA_EDGE_THRESHOLD_MIN, rangeMax * FXAA_EDGE_THRESHOLD) {
        return vec4<f32>(rgbaM.rgb, 1.0);
    }

    // Muestreo de esquinas para calcular dirección del borde
    let lumaNW = textureSampleLevel(colorTexture, texSampler, input.uv + vec2<f32>(-rcpFrame.x, -rcpFrame.y), 0.0).a;
    let lumaNE = textureSampleLevel(colorTexture, texSampler, input.uv + vec2<f32>( rcpFrame.x, -rcpFrame.y), 0.0).a;
    let lumaSW = textureSampleLevel(colorTexture, texSampler, input.uv + vec2<f32>(-rcpFrame.x,  rcpFrame.y), 0.0).a;
    let lumaSE = textureSampleLevel(colorTexture, texSampler, input.uv + vec2<f32>( rcpFrame.x,  rcpFrame.y), 0.0).a;

    let lumaNS = lumaN + lumaS;
    let lumaEW = lumaE + lumaW;

    // Subpixel aliasing
    let lumaCorners  = lumaNW + lumaNE + lumaSW + lumaSE;
    let edgeLuma     = lumaNS + lumaEW;
    let subpixLuma   = edgeLuma + lumaCorners;
    let subpixNSWE   = subpixLuma * (1.0 / 12.0);
    let subpixAmount = clamp(abs(subpixNSWE - lumaM) / range, 0.0, 1.0);
    let subpixSmooth  = smoothstep(0.0, 1.0, subpixAmount);
    let subpixFactor  = subpixSmooth * subpixSmooth * FXAA_SUBPIX;

    // Detección de dirección del borde (horizontal vs vertical)
    let edgeH = abs(-2.0 * lumaN + lumaNW + lumaNE) +
                abs(-2.0 * lumaM + lumaW  + lumaE ) * 2.0 +
                abs(-2.0 * lumaS + lumaSW + lumaSE);
    let edgeV = abs(-2.0 * lumaW + lumaNW + lumaSW) +
                abs(-2.0 * lumaM + lumaN  + lumaS ) * 2.0 +
                abs(-2.0 * lumaE + lumaNE + lumaSE);
    let isHorizontal = edgeH >= edgeV;

    // Calcular gradiente y paso en la dirección perpendicular al borde
    var luma1: f32;
    var luma2: f32;
    var stepLength: f32;

    if isHorizontal {
        luma1 = lumaN;
        luma2 = lumaS;
        stepLength = rcpFrame.y;
    } else {
        luma1 = lumaW;
        luma2 = lumaE;
        stepLength = rcpFrame.x;
    }

    let gradient1 = luma1 - lumaM;
    let gradient2 = luma2 - lumaM;
    let is1Steeper = abs(gradient1) >= abs(gradient2);

    let gradientScaled = 0.25 * max(abs(gradient1), abs(gradient2));

    // Determinar dirección del paso
    var finalStepLength = stepLength;
    var lumaLocalAvg: f32;
    if is1Steeper {
        finalStepLength = -stepLength;
        lumaLocalAvg = 0.5 * (luma1 + lumaM);
    } else {
        lumaLocalAvg = 0.5 * (luma2 + lumaM);
    }

    // Posición inicial desplazada medio paso perpendicular al borde
    var currentUv = input.uv;
    if isHorizontal {
        currentUv.y += finalStepLength * 0.5;
    } else {
        currentUv.x += finalStepLength * 0.5;
    }

    // Dirección de búsqueda a lo largo del borde
    var offset: vec2<f32>;
    if isHorizontal {
        offset = vec2<f32>(rcpFrame.x, 0.0);
    } else {
        offset = vec2<f32>(0.0, rcpFrame.y);
    }

    // Búsqueda en ambas direcciones a lo largo del borde
    var uv1 = currentUv - offset;
    var uv2 = currentUv + offset;

    var lumaEnd1 = textureSampleLevel(colorTexture, texSampler, uv1, 0.0).a - lumaLocalAvg;
    var lumaEnd2 = textureSampleLevel(colorTexture, texSampler, uv2, 0.0).a - lumaLocalAvg;

    var reached1 = abs(lumaEnd1) >= gradientScaled;
    var reached2 = abs(lumaEnd2) >= gradientScaled;
    var reachedBoth = reached1 && reached2;

    if !reached1 { uv1 -= offset; }
    if !reached2 { uv2 += offset; }

    // Búsqueda iterativa
    if !reachedBoth {
        for (var i: i32 = 2; i < FXAA_SEARCH_STEPS; i++) {
            if !reached1 {
                lumaEnd1 = textureSampleLevel(colorTexture, texSampler, uv1, 0.0).a - lumaLocalAvg;
            }
            if !reached2 {
                lumaEnd2 = textureSampleLevel(colorTexture, texSampler, uv2, 0.0).a - lumaLocalAvg;
            }

            reached1 = abs(lumaEnd1) >= gradientScaled;
            reached2 = abs(lumaEnd2) >= gradientScaled;
            reachedBoth = reached1 && reached2;

            if !reached1 { uv1 -= offset; }
            if !reached2 { uv2 += offset; }

            if reachedBoth { break; }
        }
    }

    // Calcular distancias al borde
    var dist1: f32;
    var dist2: f32;
    if isHorizontal {
        dist1 = input.uv.x - uv1.x;
        dist2 = uv2.x - input.uv.x;
    } else {
        dist1 = input.uv.y - uv1.y;
        dist2 = uv2.y - input.uv.y;
    }

    let isDir1 = dist1 < dist2;
    let distFinal = min(dist1, dist2);
    let edgeLength = dist1 + dist2;

    // Factor de mezcla basado en la distancia al extremo del borde
    let pixelOffset = -distFinal / edgeLength + 0.5;

    // Verificar que la dirección del borde es correcta
    let isLumaMSmaller = lumaM < lumaLocalAvg;
    let correctVariation1 = (lumaEnd1 < 0.0) != isLumaMSmaller;
    let correctVariation2 = (lumaEnd2 < 0.0) != isLumaMSmaller;
    let correctVariation = select(correctVariation2, correctVariation1, isDir1);

    var finalOffset = select(0.0, pixelOffset, correctVariation);

    // Usar el mayor de subpixel y edge offset
    finalOffset = max(finalOffset, subpixFactor);

    // Muestreo final con offset
    var finalUv = input.uv;
    if isHorizontal {
        finalUv.y += finalOffset * finalStepLength;
    } else {
        finalUv.x += finalOffset * finalStepLength;
    }

    let finalColor = textureSampleLevel(colorTexture, texSampler, finalUv, 0.0).rgb;
    return vec4<f32>(finalColor, 1.0);
}
`;

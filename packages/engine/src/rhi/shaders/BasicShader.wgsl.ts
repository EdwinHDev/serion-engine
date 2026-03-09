export const BasicShaderWGSL = `
struct GlobalEnvironment {
    viewProjectionMatrix: mat4x4<f32>,
    lightViewProj0: mat4x4<f32>,
    lightViewProj1: mat4x4<f32>,
    cascadeSplits: vec4<f32>,
    cameraPosition: vec4<f32>,
    sunDirection_Intensity: vec4<f32>,
    sunColor_AmbientInt: vec4<f32>,
    skyColor: vec4<f32>,
    groundColor: vec4<f32>,
};

@group(0) @binding(0) var<uniform> env: GlobalEnvironment;
@group(0) @binding(1) var shadowMap0: texture_depth_2d;
@group(0) @binding(2) var shadowMap1: texture_depth_2d;
@group(0) @binding(3) var shadowSampler: sampler_comparison;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    
    @location(3) modelMatrixR0: vec4<f32>,
    @location(4) modelMatrixR1: vec4<f32>,
    @location(5) modelMatrixR2: vec4<f32>,
    @location(6) modelMatrixR3: vec4<f32>,
    @location(7) normalMatrixR0: vec4<f32>,
    @location(8) normalMatrixR1: vec4<f32>,
    @location(9) normalMatrixR2: vec4<f32>,
    @location(10) normalMatrixR3: vec4<f32>,
    
    @location(11) baseColor: vec4<f32>,
    @location(12) pbrParams: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPosition: vec3<f32>,
    @location(1) worldNormal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @location(3) baseColor: vec4<f32>,
    @location(4) pbrParams: vec4<f32>,
    @location(5) shadowPos0: vec3<f32>,
    @location(6) shadowPos1: vec3<f32>,
    @location(7) viewZ: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    let modelMatrix = mat4x4<f32>(
        input.modelMatrixR0,
        input.modelMatrixR1,
        input.modelMatrixR2,
        input.modelMatrixR3
    );
    
    let normalMatrix = mat4x4<f32>(
        input.normalMatrixR0,
        input.normalMatrixR1,
        input.normalMatrixR2,
        input.normalMatrixR3
    );

    var out: VertexOutput;
    let worldPos = modelMatrix * vec4<f32>(input.position, 1.0);
    out.position = env.viewProjectionMatrix * worldPos;
    out.worldPosition = worldPos.xyz;
    out.worldNormal = normalize((normalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
    out.uv = input.uv;
    out.baseColor = input.baseColor;
    out.pbrParams = input.pbrParams;
    out.viewZ = out.position.w; 

    // Proyecciones de Sombra (Hardware Depth Bias activo en Pipeline)
    let sPos0 = env.lightViewProj0 * vec4<f32>(worldPos.xyz, 1.0);
    out.shadowPos0 = vec3<f32>(sPos0.xy * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5), sPos0.z);
    
    let sPos1 = env.lightViewProj1 * vec4<f32>(worldPos.xyz, 1.0);
    out.shadowPos1 = vec3<f32>(sPos1.xy * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5), sPos1.z);
    
    return out;
}

fn calculateShadow(shadowMap: texture_depth_2d, shadowPos: vec3<f32>) -> f32 {
    let inBoundsX = step(0.0, shadowPos.x) * step(shadowPos.x, 1.0);
    let inBoundsY = step(0.0, shadowPos.y) * step(shadowPos.y, 1.0);
    let inBoundsZ = step(0.0, shadowPos.z) * step(shadowPos.z, 1.0);
    let inBounds = inBoundsX * inBoundsY * inBoundsZ;

    var visibility = 0.0;
    let size = 1.0 / 2048.0;
    
    for (var y = -1; y <= 1; y++) {
        for (var x = -1; x <= 1; x++) {
            let offset = vec2<f32>(f32(x), f32(y)) * size;
            visibility += textureSampleCompare(shadowMap, shadowSampler, shadowPos.xy + offset, shadowPos.z - 0.0005);
        }
    }
    
    visibility /= 9.0;
    return mix(1.0, visibility, inBounds);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // 1. Espacio Lineal y Parámetros
    let metallic = input.pbrParams.x;
    let roughness = input.pbrParams.y;
    let albedo = pow(input.baseColor.rgb, vec3<f32>(2.2));

    let N = normalize(input.worldNormal);
    let V = normalize(env.cameraPosition.xyz - input.worldPosition);
    let L = normalize(-env.sunDirection_Intensity.xyz);
    let nDotL = max(dot(N, L), 0.0);

    // 2. Cascaded Shadow Maps (Branchless)
    let shadow0 = calculateShadow(shadowMap0, input.shadowPos0);
    let shadow1 = calculateShadow(shadowMap1, input.shadowPos1);
    let useCascade1 = step(env.cascadeSplits.x, input.viewZ);
    let finalShadow = mix(shadow0, shadow1, useCascade1);

    // 3. Conservación de Energía PBR
    let diffuseColor = albedo * (1.0 - metallic);
    let f0 = mix(vec3<f32>(0.04), albedo, metallic);

    // 4. Luz Directa y Exposición
    let EXPOSURE: f32 = 1.0 / 100000.0;
    let sunRadiance = env.sunColor_AmbientInt.rgb * (env.sunDirection_Intensity.w * EXPOSURE);

    let H = normalize(L + V);
    let nDotH = max(dot(N, H), 0.0);
    let specPower = mix(4.0, 2048.0, 1.0 - roughness);
    let directSpecular = pow(nDotH, specPower) * f0 * sunRadiance;

    // 5. Entorno Hemisférico
    let up = N.z * 0.5 + 0.5;
    let ambientIrradiance = mix(env.groundColor.rgb, env.skyColor.rgb, up) * env.sunColor_AmbientInt.w;
    let ambientDiffuse = diffuseColor * ambientIrradiance;

    // Reflejo Ambiental (Para metales)
    let R = reflect(-V, N);
    let reflMix = R.z * 0.5 + 0.5;
    let ambientRefl = mix(env.groundColor.rgb, env.skyColor.rgb, reflMix) * env.sunColor_AmbientInt.w;
    let ambientSpecular = f0 * ambientRefl * (1.0 - roughness);

    // 6. Ecuación de Sombreado (La sombra SOLO afecta a la luz del Sol)
    let directLight = ((diffuseColor * sunRadiance * nDotL) + directSpecular) * finalShadow;
    let ambientLight = ambientDiffuse + ambientSpecular;
    var finalColor = directLight + ambientLight;

    // 7. ACES Filmic Tone Mapping
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    finalColor = clamp((finalColor * (a * finalColor + b)) / (finalColor * (c * finalColor + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));

    // 8. Corrección Gamma (sRGB)
    finalColor = pow(finalColor, vec3<f32>(1.0 / 2.2));

    return vec4<f32>(finalColor, input.baseColor.a);
}

@vertex
fn shadow_vs_main_c0(input: VertexInput) -> @builtin(position) vec4<f32> {
    let modelMatrix = mat4x4<f32>(
        input.modelMatrixR0, input.modelMatrixR1, input.modelMatrixR2, input.modelMatrixR3
    );
    let normalMatrix = mat4x4<f32>(
        input.normalMatrixR0, input.normalMatrixR1, input.normalMatrixR2, input.normalMatrixR3
    );
    
    let worldPos = (modelMatrix * vec4<f32>(input.position, 1.0)).xyz;
    let worldNormal = normalize((normalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
    
    // Dynamic Normal Offset Bias (0.15 unidades físicas)
    let biasedWorldPos = worldPos + (worldNormal * 0.15);
    
    return env.lightViewProj0 * vec4<f32>(biasedWorldPos, 1.0);
}

@vertex
fn shadow_vs_main_c1(input: VertexInput) -> @builtin(position) vec4<f32> {
    let modelMatrix = mat4x4<f32>(
        input.modelMatrixR0, input.modelMatrixR1, input.modelMatrixR2, input.modelMatrixR3
    );
    let normalMatrix = mat4x4<f32>(
        input.normalMatrixR0, input.normalMatrixR1, input.normalMatrixR2, input.normalMatrixR3
    );
    
    let worldPos = (modelMatrix * vec4<f32>(input.position, 1.0)).xyz;
    let worldNormal = normalize((normalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
    
    // Dynamic Normal Offset Bias (0.15 unidades físicas)
    let biasedWorldPos = worldPos + (worldNormal * 0.15);
    
    return env.lightViewProj1 * vec4<f32>(biasedWorldPos, 1.0);
}
`;

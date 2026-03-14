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
@group(0) @binding(4) var ssaoMap: texture_2d<f32>;

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

const PI: f32 = 3.14159265359;

fn DistributionGGX(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
let a: f32 = roughness * roughness;
let a2: f32 = a * a;
let NdotH: f32 = max(dot(N, H), 0.0);
let NdotH2: f32 = NdotH * NdotH;
let num: f32 = a2;
var denom: f32 = (NdotH2 * (a2 - 1.0) + 1.0);
denom = PI * denom * denom;
return num / max(denom, 0.0000001);
}

fn GeometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
let r: f32 = (roughness + 1.0);
let k: f32 = (r * r) / 8.0;
let num: f32 = NdotV;
let denom: f32 = NdotV * (1.0 - k) + k;
return num / max(denom, 0.0000001);
}

fn GeometrySmith(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
let NdotV: f32 = max(dot(N, V), 0.0);
let NdotL: f32 = max(dot(N, L), 0.0);
let ggx2: f32 = GeometrySchlickGGX(NdotV, roughness);
let ggx1: f32 = GeometrySchlickGGX(NdotL, roughness);
return ggx1 * ggx2;
}

fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // 1. Espacio Lineal y Parámetros PBR
    let metallic = input.pbrParams.x;
    let roughness = input.pbrParams.y;
    let albedo = pow(input.baseColor, vec4<f32>(2.2));

    let N: vec3<f32> = normalize(input.worldNormal);
    let V: vec3<f32> = normalize(env.cameraPosition.xyz - input.worldPosition);

    var F0: vec3<f32> = vec3<f32>(0.04);
    F0 = mix(F0, albedo.rgb, metallic);

    // 2. Cascaded Shadow Maps (Branchless)
    let shadow0 = calculateShadow(shadowMap0, input.shadowPos0);
    let shadow1 = calculateShadow(shadowMap1, input.shadowPos1);
    let useCascade1 = step(env.cascadeSplits.x, input.viewZ);
    let visibility = mix(shadow0, shadow1, useCascade1);

    // 3. Luz Directa (Cook-Torrance BRDF)
    var Lo: vec3<f32> = vec3<f32>(0.0);

    let L: vec3<f32> = normalize(-env.sunDirection_Intensity.xyz);
    let H: vec3<f32> = normalize(V + L);
    let NdotL: f32 = max(dot(N, L), 0.0);

    let lightColor: vec3<f32> = env.sunColor_AmbientInt.rgb;
    let lightIntensity: f32 = env.sunDirection_Intensity.w;
    let radiance: vec3<f32> = lightColor * lightIntensity;

    // Cook-Torrance BRDF
    let NDF: f32 = DistributionGGX(N, H, roughness);
    let G: f32 = GeometrySmith(N, V, L, roughness);
    let F: vec3<f32> = fresnelSchlick(max(dot(H, V), 0.0), F0);

    let numerator: vec3<f32> = NDF * G * F;
    let denominator: f32 = 4.0 * max(dot(N, V), 0.0) * NdotL;
    let specular: vec3<f32> = numerator / max(denominator, 0.001);

    let kS: vec3<f32> = F;
    var kD: vec3<f32> = vec3<f32>(1.0) - kS;
    kD = kD * (1.0 - metallic);

    // La sombra (visibility) afecta a toda la radiancia saliente
    let directLight: vec3<f32> = (kD * albedo.rgb / PI + specular) * radiance * NdotL * visibility;
    Lo = Lo + directLight;

    // LUZ AMBIENTAL Y REFLEJOS DEL CIELO (Analytical IBL & SSAO Físico)
    let screenCoord = vec2<i32>(input.position.xy);
    let ao = textureLoad(ssaoMap, screenCoord, 0).r;

    // 1. Irradiancia Difusa Analítica (Luz que rebota del cielo)
    // El cielo es más brillante cerca de la dirección del Sol (Dispersión de Rayleigh simulada)
    let skyIntensity = env.sunColor_AmbientInt.w;
    let skyGradient = mix(env.groundColor.rgb, env.skyColor.rgb, clamp(N.z * 0.5 + 0.5, 0.0, 1.0));
    
    // Simular el brillo direccional de la atmósfera
    let sunScatter = max(dot(N, L), 0.0) * 0.5 + 0.5; 
    let ambientIrradiance = skyGradient * sunScatter * skyIntensity;
    let ambientDiffuse = albedo.rgb * (1.0 - metallic) * ambientIrradiance;

    // 2. Especular Ambiental Analítico (Reflejos del entorno)
    let R = reflect(-V, N);
    let RdotL = max(dot(R, L), 0.0);
    
    // El cielo reflejado depende de hacia dónde mira el rayo rebotado
    let skyReflColor = mix(env.groundColor.rgb, env.skyColor.rgb, clamp(R.z * 0.5 + 0.5, 0.0, 1.0));
    
    // Fake Sun Specular Glow (El resplandor del sol reflejado en la atmósfera)
    // Se difumina físicamente basado en el roughness del material
    let glowPower = mix(256.0, 16.0, roughness);
    let sunGlow = pow(RdotL, glowPower) * env.sunColor_AmbientInt.rgb * (1.0 - roughness) * 0.5;
    
    let ambientRefl = skyReflColor + sunGlow;
    
    // Función de Fresnel Ambiental (Schlick aproximada con Roughness)
    let NdotV_env = max(dot(N, V), 0.0);
    let envFresnel = F0 + (max(vec3<f32>(1.0 - roughness), F0) - F0) * pow(1.0 - NdotV_env, 5.0);
    
    let ambientSpecular = ambientRefl * envFresnel * skyIntensity;

    // 3. Aplicación de Oclusión (El SSAO solo ahoga la luz indirecta)
    let ambient: vec3<f32> = (ambientDiffuse + ambientSpecular) * ao;

    // RESULTADO FÍSICO FINAL
    var finalColor: vec3<f32> = ambient + Lo;

    // 5. ACES Filmic Tone Mapping
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    finalColor = clamp((finalColor * (a * finalColor + b)) / (finalColor * (c * finalColor + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));

    // 6. Corrección Gamma (sRGB)
    finalColor = pow(finalColor, vec3<f32>(1.0 / 2.2));

    return vec4<f32>(finalColor, albedo.a);
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

@fragment
fn fs_selection(input: VertexOutput) -> @location(0) vec4<f32> {
    // El canal W de pbrParams es nuestro flag de selección (1.0 = Seleccionado)
    if (input.pbrParams.w < 0.5) {
        discard;
    }
    return vec4<f32>(1.0, 0.0, 0.0, 0.0); // Máscara sólida pura
}
`;

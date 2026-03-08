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

const EXPOSURE: f32 = 1.0;

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

    // Dynamic Shadow Bias basado en escala
    let scaleX = length(input.modelMatrixR0.xyz);
    let scaleY = length(input.modelMatrixR1.xyz);
    let scaleZ = length(input.modelMatrixR2.xyz);
    let avgScale = (scaleX + scaleY + scaleZ) / 3.0;
    let biasPos = worldPos.xyz + out.worldNormal * (0.5 * avgScale);

    // Proyecciones de Sombra
    let sPos0 = env.lightViewProj0 * vec4<f32>(biasPos, 1.0);
    out.shadowPos0 = vec3<f32>(sPos0.xy * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5), sPos0.z);
    
    let sPos1 = env.lightViewProj1 * vec4<f32>(biasPos, 1.0);
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
    let metallic = input.pbrParams.x;
    let roughness = input.pbrParams.y;
    let diffuseColor = input.baseColor.rgb * (1.0 - metallic);
    
    let N = normalize(input.worldNormal);
    let L = normalize(-env.sunDirection_Intensity.xyz);
    let nDotL = max(dot(N, L), 0.0);
    
    let shadow0 = calculateShadow(shadowMap0, input.shadowPos0);
    let shadow1 = calculateShadow(shadowMap1, input.shadowPos1);

    let useCascade1 = step(env.cascadeSplits.x, input.viewZ);
    let finalShadow = mix(shadow0, shadow1, useCascade1);

    let sunRadiance = env.sunColor_AmbientInt.rgb * (env.sunDirection_Intensity.w * EXPOSURE);
    let up = N.z * 0.5 + 0.5;
    let ambientLight = mix(env.groundColor.rgb, env.skyColor.rgb, up) * env.sunColor_AmbientInt.w;
    
    let viewDir = normalize(env.cameraPosition.xyz - input.worldPosition);
    let halfVector = normalize(L + viewDir);
    let NdotH = max(dot(N, halfVector), 0.0);
    let specPower = mix(4.0, 2048.0, 1.0 - roughness);
    let specularIntensity = pow(NdotH, specPower);
    let specColor = mix(vec3<f32>(1.0, 1.0, 1.0), input.baseColor.rgb, metallic);
    let directSpecular = specColor * (specularIntensity * env.sunDirection_Intensity.w * EXPOSURE);

    let directLight = ((diffuseColor * sunRadiance * nDotL) + (directSpecular * (1.0 - roughness))) * finalShadow;
    let finalColor = directLight + (diffuseColor * ambientLight);
    
    return vec4<f32>(finalColor, input.baseColor.a);
}
`;

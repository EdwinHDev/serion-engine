# Serion Engine - PBR Materials & Instanced Data Architecture
## ID: SER-06-MATERIALS | Estado: Activo

### 1. Visión General (El Flujo Metálico/Rugosidad)
En Serion Engine, no utilizamos el obsoleto sistema "Blinn-Phong" de colores difusos y especulares separados. Adoptamos el estándar de la industria AAA: el flujo de trabajo **PBR (Physically Based Rendering) de Metallic/Roughness**. 

Este sistema garantiza que los objetos reaccionen a la luz bajo la ley de la **Conservación de la Energía**: un objeto no puede reflejar más luz de la que recibe.

### 2. Parámetros Fundamentales
Todo material en el motor base se define por dos vectores (8 floats en total):
* **Base Color (RGBA):** El color del albedo o reflectancia base.
* **PBR Parameters (Vector4):**
  * `X (Metallic)`: Define si el objeto es un dieléctrico (0.0 = plástico/madera) o un conductor (1.0 = metal puro). Los metales puros no tienen color difuso, solo reflejan la luz teñida por su Base Color.
  * `Y (Roughness)`: Define la micro-superficie. 0.0 = Espejo perfecto (reflejos nítidos), 1.0 = Superficie mate/goma (reflejos difuminados).
  * `Z (Specular/AO)`: Multiplicador de la intensidad especular o reserva para Ambient Occlusion. (Por defecto 0.5).
  * `W (Padding)`: Reservado para alineamiento estricto de WebGPU (16 bytes).

### 3. El Nuevo Layout de Instancias (160 Bytes)
Para mantener nuestro **Draw Call Batching (Zero-GC)** de la Capa 10.5, no podemos crear shaders separados para cada color. La GPU debe recibir las propiedades del material *por cada instancia*.

El buffer instanciado (`instanceBuffer`) aumenta su *Stride* de 128 bytes (32 floats) a **160 bytes (40 floats)** por cada Actor:

| Floats | Bytes | Tipo WGSL | Propósito |
| :--- | :--- | :--- | :--- |
| `0 - 15` | 64 bytes | `mat4x4<f32>` | `modelMatrix` (Transformación espacial) |
| `16 - 31` | 64 bytes | `mat4x4<f32>` | `normalMatrix` (Corrección de deformación) |
| `32 - 35` | 16 bytes | `vec4<f32>` | `baseColor` (R, G, B, A) |
| `36 - 39` | 16 bytes | `vec4<f32>` | `pbrParams` (Metallic, Roughness, Spec, Pad) |

### 4. Componente y Gestión de Memoria
* **`SMaterialComponent`:** Se acoplará a los Actores (`SActor`) para permitir al usuario modificar el color y la rugosidad desde el Editor.
* **Memory Pool Expansion:** Al igual que las transformaciones, los materiales no deben instanciar objetos basura en el bucle principal. El motor expandirá la copia de datos hacia el `batchBuffer` escribiendo los 8 floats adicionales de forma lineal en cada frame de dibujo.

### 5. Reglas de Sombreado en WGSL
El *Fragment Shader* integrará las ecuaciones de Fresnel-Schlick y la distribución GGX en un futuro para un PBR completo. En la fase inicial, aplicará la regla básica de PBR:
`DiffuseColor = BaseColor * (1.0 - Metallic)`
`SpecularTint = mix(Blanco_Especular, BaseColor, Metallic)`
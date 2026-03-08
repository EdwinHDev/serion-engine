# Serion Engine - Lighting & Atmosphere Architecture
## ID: SER-05-LIGHTING | Estado: Activo

### 1. Visión General (El Paradigma PBR y Físico)
En Serion Engine, la iluminación no es una simple multiplicación de colores arbitrarios; es una simulación física. Para mantener un rendimiento de 60 FPS bajo nuestra arquitectura de *Forward Rendering* en WebGPU, el motor adopta el **Modelo Hemisférico PBR (Physically Based Rendering)** combinado con una **Luz Direccional Analítica**.

Toda la energía lumínica en el motor se calcula utilizando magnitudes físicas reales (Lux para la iluminancia direccional) adaptadas a nuestra escala central de **1 Unidad = 1 cm**.

### 2. La Prevención de Deformación (La Matriz Normal)
*Mandamiento Crítico de `STANDARDS.md`:* El motor permite escalar primitivas de forma no uniforme (ej. un cubo escalado a `[10, 100, 10]` para hacer una pared). Si las normales de los vértices se multiplican directamente por la Matriz de Modelo (Transformación) escalada, los vectores perpendiculares se deformarán, destruyendo el cálculo de la luz.

Para evitar esto, el renderizador exige matemáticamente:
1. **Inverse Transpose:** El RHI (o la CPU antes de enviar el buffer) debe calcular la Matriz Transpuesta Inversa de la Matriz de Modelo de cada Actor.
2. **Transformación Segura:** En el *Vertex Shader*, la normal original del vértice (32-byte layout) se debe multiplicar EXCLUSIVAMENTE por esta Matriz Normal, garantizando que el vector siga siendo perpendicular a la superficie sin importar la escala aplicada.

### 3. El Global Uniform Buffer (Alineación Estricta en Memoria)
Toda la información espacial y atmosférica se empaqueta en un único buffer global que se actualiza por frame. 
WebGPU (WGSL) exige que estos datos estén estrictamente alineados a bloques de 16 bytes (vec4 / 4 floats). Cualquier desajuste corromperá la vista de la cámara.

El `GlobalUniformBuffer` tiene un tamaño fijo y optimizado de **144 bytes**:

| Offset (Bytes) | Tamaño | Tipo WGSL | Propósito | Regla de Empaquetado (Padding) |
| :--- | :--- | :--- | :--- | :--- |
| `0` | 64 bytes | `mat4x4<f32>` | `viewProjectionMatrix` | Bloque nativo de 64b. |
| `64` | 16 bytes | `vec3<f32>` | `cameraPosition` | 12 bytes + 4 bytes (1 float) de padding. |
| `80` | 16 bytes | `vec3<f32>` + `f32` | `sunDirection` + `sunIntensity`| Empaquetado perfecto (12 + 4). Intensidad en Lux. |
| `96` | 16 bytes | `vec3<f32>` + `f32` | `sunColor` + `ambientIntensity`| Empaquetado perfecto (12 + 4). |
| `112` | 16 bytes | `vec3<f32>` | `skyColor` | 12 bytes + 4 bytes (1 float) de padding. |
| `128` | 16 bytes | `vec3<f32>` | `groundColor` | 12 bytes + 4 bytes (1 float) de padding. |

### 4. Modelos Matemáticos de Sombreado (Fragment Shader)

#### 4.1 Luz Directa Fotorrealista (Directional Light / Sol)
Representa la fuente de luz infinita. En Serion Engine, un día despejado tiene un valor aproximado de `100,000 Lux`.
* **Cálculo:** Se utiliza el Producto Punto (`dot`) entre la *Normal Corregida* (paso 2) y la dirección invertida del sol (`-sunDirection`).
* **Fórmula:** `max(dot(normal_corregida, -sunDirection), 0.0) * sunColor * (sunIntensity * exposición_global)`
* **Z-Up:** En nuestro ecosistema, un sol en el cenit exacto (mediodía) debe tener un vector de dirección `[0.0, 0.0, -1.0]`.

#### 4.2 Luz Ambiental (Hemispheric Ambient)
Simula la Dispersión de Rayleigh (cielo) y el rebote de albedo (suelo) sin el costo del Raymarching.
* **Cálculo:** Se lee la componente `Z` de la normal del píxel. Dado que el motor es **Z-Up**, `normal.z` determina si la cara mira al cielo (1.0) o al suelo (-1.0).
* **Fórmula:** Se mapea `normal.z` de `[-1, 1]` a `[0, 1]` con la fórmula `(normal.z * 0.5) + 0.5`. Este factor se usa para interpolar (`mix`) entre `groundColor` y `skyColor`. El resultado se multiplica por la `ambientIntensity`.

#### 4.3 Ecuación de Sombreado Final
El color final de la superficie calculada por la GPU es:
`Color Final = BaseColor * (Luz Directa + Luz Ambiental Hemisférica)`

### 5. Entidades del Engine (Hitos Futuros)
Para la integración con el Editor, el motor expondrá lógicamente estas variables a través de los siguientes componentes acoplables a cualquier `SActor`:
* `SDirectionalLightComponent`: Expondrá el Color, Lux (Intensidad) y transformará la rotación del actor en el vector `sunDirection`.
* `SSkyLightComponent`: Permitirá inyectar el `skyColor` y `groundColor`.

*(Nota: En ausencia de estos componentes en la escena activa, `SerionEngine` inyectará valores por defecto "Día Despejado" en el `GlobalUniformBuffer` para asegurar la visibilidad de la geometría).*
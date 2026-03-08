# Serion Engine - Shadow Mapping & Cascades Architecture
## ID: SER-07-SHADOWS | Estado: Activo

### 1. Visión General (El Estándar AAA)
Para cumplir con la precisión exigida en `STANDARDS.md` (1 Unidad = 1 cm), Serion Engine rechaza el uso de mapas de sombras monolíticos. El motor implementa **Cascaded Shadow Maps (CSM)** de 2 niveles y renderizado **Multi-Pase** para garantizar sombras ultra-nítidas en personajes y sombras suaves en estructuras lejanas.

### 2. Arquitectura de Cascadas (CSM)
El volumen de visión de la cámara principal se divide dinámicamente en dos sub-volúmenes (Cascadas) de profundidad:
* **Cascada 0 (Detalle - 0m a 15m):** Concentra un mapa de 2048x2048 píxeles en el área inmediata al jugador. Garantiza resolución a nivel de centímetros para dedos, armas y detalles pequeños.
* **Cascada 1 (Entorno - 15m a 150m):** Concentra un mapa de 2048x2048 píxeles en el medio y largo alcance. Utiliza PCF (Percentage-Closer Filtering) agresivo para crear una penumbra suave sobre edificios y montañas. Los objetos más allá de 150m no proyectan sombras direccionales.

### 3. Pipeline de Renderizado Multi-Pase
El motor abandona el Single-Pass y adopta un ciclo de 3 fases por fotograma:
1. **Pass 0 (Shadow Cascade 0):** La cámara del Sol dibuja la profundidad de la geometría cercana en `ShadowMap0`. (Fragment Shader desactivado para máximo rendimiento).
2. **Pass 1 (Shadow Cascade 1):** La cámara del Sol dibuja la profundidad de la geometría media en `ShadowMap1`.
3. **Pass 2 (Beauty Pass):** La cámara del jugador dibuja la escena. El `BasicShader` consulta las texturas de profundidad y aplica el sombreado final combinando la luz PBR con la oclusión calculada.

### 4. UberShader y Escalabilidad (Zero-Cost Toggle)
Para asegurar el rendimiento en dispositivos de gama baja, el Fragment Shader utilizará pre-procesamiento de macros lógicas (ej. `#USE_SHADOWS`). 
* **Regla de Oro:** No habrá condicionales dinámicos (`if (shadowsEnabled)`) en el código GPU. Si el usuario desactiva las sombras, el motor recompila el pipeline descartando el código de oclusión, reduciendo el costo de cálculo de sombras a **cero absoluto**.

### 5. Dynamic Shadow Bias (Prevención de Acné y Peter-Panning)
Debido a que el motor soporta escalas no uniformes masivas (ej. `[1000, 10, 1000]`), un *Depth Bias* de hardware estático es insuficiente. 
El Vertex Shader de sombras extraerá el vector de escala de la Matriz de Modelo instanciada (32-float layout) y ajustará matemáticamente la posición del vértice a lo largo de su normal antes de proyectarlo, garantizando superficies limpias sin "Shadow Acne" (manchas oscuras).

### 6. Mapa de Memoria (Global Uniforms Expansión)
El `GlobalUniformBuffer` evoluciona para soportar las nuevas matrices de proyección de luz, pasando de 144 bytes a **272 bytes**. Su alineación a bloques de 16 bytes (vec4) se mantiene perfecta:

| Offset (Bytes) | Tamaño | Tipo WGSL | Propósito |
| :--- | :--- | :--- | :--- |
| `0 - 64` | 64 bytes | `mat4x4<f32>` | `viewProjectionMatrix` (Cámara Jugador) |
| `64 - 128` | 64 bytes | `mat4x4<f32>` | `lightViewProjMatrix_Cascade0` (Sol Cercano) |
| `128 - 192` | 64 bytes | `mat4x4<f32>` | `lightViewProjMatrix_Cascade1` (Sol Lejano) |
| `192 - 208` | 16 bytes | `vec4<f32>` | `cascadeSplits` (Distancias de corte, Z = pad) |
| `208 - 224` | 16 bytes | `vec4<f32>` | `sunDirection_Intensity` |
| `224 - 240` | 16 bytes | `vec4<f32>` | `sunColor_AmbientInt` |
| `240 - 256` | 16 bytes | `vec4<f32>` | `skyColor` |
| `256 - 272` | 16 bytes | `vec4<f32>` | `groundColor` |
# Serion Engine - Post-Processing & Ambient Occlusion Architecture
## ID: SER-08-POST-PROCESS | Estado: Activo

### 1. Visión General (El Laboratorio Óptico)
Siguiendo los estándares de motores AAA (Unreal Engine) y respetando el **Mandamiento de Separación Óptica** del motor (`SER-05-LIGHTING`), Serion Engine separa estrictamente la simulación física de la luz de las imperfecciones de la lente fotográfica. 

Para lograr el fotorrealismo, el motor abandona la escritura directa al Canvas HTML (Monitor) e implementa un **Off-Screen HDR Render Target**. Toda la escena 3D se "fotografía" en una textura flotante de alta precisión en la VRAM, la cual luego pasa por una tubería de filtros (Stack) antes de ser revelada al jugador.

### 2. La Arquitectura HDR Off-Screen
El *Rendering Hardware Interface* (RHI) de Serion interrumpe el pase directo a la pantalla (`bgra8unorm`) para canalizar todo el renderizado principal (Mallas PBR, Sombras, Cielo Procedural y Rejilla) hacia una Textura Fantasma:
* **Formato:** `rgba16float` (Half-precision floating-point).
* **Propósito:** Permite que la luz física del Sol (ej. Intensidad de `120,000.0` Lux) no sea recortada (*clamped*) a `1.0` de forma prematura. Los píxeles conservan su energía lumínica real matemática para que el Stack de Post-Procesado pueda extraer el resplandor.

### 3. Screen Space Ambient Occlusion (SSAO)
Para otorgar peso físico a los objetos y asentar los modelos en el mundo, el motor implementa Oclusión Ambiental en el espacio de pantalla, calculando las sombras de contacto en esquinas y hendiduras.

#### 3.1. Matemática de Hemisferios
1. **Z-Buffer Sampling:** El algoritmo de SSAO lee la Textura de Profundidad (`depth24plus`) generada en el pase principal para reconstruir la posición espacial 3D de cada píxel de la pantalla.
2. **Reconstrucción de Normales:** Para ahorrar memoria VRAM y evitar un pesado G-Buffer completo, las normales se pueden reconstruir a partir de derivadas espaciales de la profundidad, o exportar en un pase ligero MRT (Multiple Render Targets).
3. **Rayos Aleatorios:** Se lanza un hemisferio de rayos cortos (basados en nuestra escala 1 Unidad = 1 cm) alrededor de cada píxel utilizando un *Kernel* de vectores pre-calculados y una textura de ruido 4x4.
4. **Blur Pass:** El ruido generado por el muestreo aleatorio se limpia usando un pase rápido de *Bilateral Blur* que respeta los bordes de la geometría.

### 4. El Stack de Post-Procesado (The Pipeline)
Una vez generada la textura HDR base y la textura de Oclusión, un pase 2D de pantalla completa (Post-Process Quad con `Z=1.0`) ejecuta la película fotográfica final en orden estricto:

#### Fase A: Extracción y Bloom (Resplandor)
* Se extraen los píxeles de la textura HDR que superen el umbral físico de luminosidad (`> 1.0`).
* Se utiliza un algoritmo de *Downsampling/Upsampling* iterativo (Mip-mapping) para difuminar estos píxeles intensos a bajo costo computacional, emulando la dispersión de la luz dentro del cristal de la lente (Lens Flare / Bloom).
* El resplandor se suma aditivamente a la textura HDR original.

#### Fase B: ACES Filmic Tonemapping
* La escena sigue en espacio HDR (Valores > 1.0). Los monitores estándar no pueden mostrar esto.
* El shader aplica la curva de mapeo tonal de la Academia de Cine (**ACES Filmic**), comprimiendo suavemente los blancos extremos sin perder saturación, lo que otorga el aspecto "Cinematográfico" AAA.

#### Fase C: Corrección Gamma
* Finalmente, el color resultante (que ahora va de `0.0` a `1.0`) es elevado a una potencia fraccionaria `pow(color, 1.0 / 2.2)` para ajustarse al perfil sRGB del monitor del usuario antes de estamparse en el Canvas HTML.

### 5. Mandamientos de Rendimiento (Zero-GC en RHI)
1. **Single Quad, No Vertex Buffers:** El pase final no debe requerir buffers de vértices. El Triangle Strip debe ser generado analíticamente en el Vertex Shader mediante el `vertex_index`.
2. **Bind Group Reusability:** El `GPUBindGroup` del Post-Procesado se debe instanciar una sola vez y cachearse, actualizándose **solo** si el usuario redimensiona la ventana del editor, evitando la activación del Garbage Collector de JavaScript.
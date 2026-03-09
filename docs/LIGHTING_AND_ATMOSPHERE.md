# Serion Engine - Lighting & Atmosphere Architecture
## ID: SER-05-LIGHTING | Estado: Activo

### 1. Visión General (El Paradigma PBR y Físico)
En Serion Engine, la iluminación no es una simple multiplicación de colores arbitrarios; es una simulación física estricta. Para mantener un rendimiento de 60 FPS bajo nuestra arquitectura de *Forward Rendering* en WebGPU, el motor adopta el **Modelo PBR (Physically Based Rendering)** acoplado a un sistema matemático de **Dispersión Atmosférica (Atmospheric Scattering)**.

Toda la energía lumínica en el motor se calcula utilizando magnitudes físicas reales (Lux para la iluminancia direccional) y coeficientes de dispersión de gases, adaptados a nuestra escala central de **1 Unidad = 1 cm**.

### 2. La Prevención de Deformación (La Matriz Normal)
*Mandamiento Crítico de `STANDARDS.md`:* El motor permite escalar primitivas de forma no uniforme (ej. un cubo escalado a `[10, 100, 10]`). Si las normales de los vértices se multiplican directamente por la Matriz de Modelo escalada, los vectores perpendiculares se deformarán, destruyendo el cálculo de la luz.

Para evitar esto, el renderizador exige matemáticamente:
1. **Inverse Transpose:** El RHI (o la CPU antes de enviar el buffer) debe calcular la Matriz Transpuesta Inversa de la Matriz de Modelo de cada Actor.
2. **Transformación Segura:** En el *Vertex Shader*, la normal original del vértice (32-byte layout) se debe multiplicar EXCLUSIVAMENTE por esta Matriz Normal.

### 3. Luz Direccional Analítica (`SDirectionalLightComponent`)
El "Sol" o "Luna" del motor. 
* **Magnitud Física:** Su brillo se mide en Lux (ej. 120,000 Lux para un sol de mediodía pleno).
* **Reactividad:** Este componente dicta el ángulo de iluminación mediante su *Forward Vector* (Z-Up). El motor NO rota este componente automáticamente (no hay ciclo día/noche forzado). La atmósfera reacciona a la rotación impuesta por el usuario o el Gameplay.
* **Atenuación por Transmitancia:** Su color base e intensidad originales NUNCA llegan puros a los modelos 3D. Pasan primero por el cálculo de Transmitancia atmosférica.

### 4. Simulación Atmosférica Física (`SAtmosphereComponent`)
Se abandona el concepto de "Color de Cielo" y "Color de Suelo". La atmósfera se define por las propiedades de sus gases planetarios:
1. **Dispersión de Rayleigh:** Simula moléculas pequeñas (oxígeno/nitrógeno). Esparce la luz azul en el cenit y deja pasar la luz roja/naranja en el horizonte.
2. **Dispersión de Mie:** Simula partículas pesadas (polvo/aerosoles). Es la responsable de dibujar proceduralmente el **Disco Solar** brillante y su halo direccional difuso.
3. **Escala Planetaria:** Radios matemáticos del planeta y el grosor de la atmósfera para calcular la longitud de los rayos de luz.

#### 4.1 La Optimización AAA (Cálculo de Transmitancia Híbrido)
Para evitar colapsar la GPU simulando la atmósfera en cada píxel de cada modelo 3D (Cubo, Personaje, etc.):
* El **Motor (CPU)** calcula la *Transmitancia* evaluando el ángulo Z de la Luz Direccional a través de la atmósfera.
* La CPU modifica matemáticamente la intensidad y el tinte de la luz direccional (ej. volviéndola roja y débil al atardecer) ANTES de enviarla al shader de PBR (`BasicShader.wgsl`).
* Costo en GPU para la iluminación de objetos: **Cero**.

### 5. El Entorno Visual (Sky Pass Procedural)
Para renderizar el fondo del universo (lo que ve la cámara), se utiliza un pase de renderizado dedicado:
* **The Full-Screen Quad:** En lugar de esferas gigantes, se dibuja un cuadrado que cubre toda la pantalla forzado a la profundidad máxima del Z-Buffer (`Z = 1.0`).
* **Raymarching en Fragment Shader:** Por cada píxel del fondo, se lanza un rayo matemático que calcula la dispersión de Rayleigh y Mie exacta. 
* **Resultado:** Cielos azules al mediodía, atardeceres dinámicos naranja/magenta, disco solar cegador, y transición al vacío estrellado de la noche, todo 100% reactivo al ángulo de la luz.

### 6. Mandamiento de Separación Óptica (Post-Procesado)
**Regla de Arquitectura:** El *Lens Flare* (destellos de lente), los artefactos hexagonales y el *Bloom* masivo alrededor del sol **NO** son fenómenos atmosféricos. Son imperfecciones del cristal de la cámara óptica.
* El sistema atmosférico es responsable de generar un píxel ultra-brillante (HDR > 10.0) donde está el sol.
* Un sistema de **Post-Processing Stack** (separado y acoplado a la cámara) será el responsable exclusivo de leer esos píxeles brillantes y generar el Lens Flare y el Bloom. Prohibido mezclar esta lógica en los shaders de atmósfera.
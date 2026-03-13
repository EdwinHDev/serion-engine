# Serion Engine - Volumetric Clouds Architecture
## ID: SER-06-CLOUDS | Estado: Diseño | Revisión: AAA Standard

### 1. Visión General (El Paradigma Volumétrico)
A diferencia de los motores de la vieja escuela que utilizan "Skyboxes" con texturas estáticas o cúpulas de geometría (Skydomes), Serion Engine implementa **Nubes Volumétricas Procedurales**. 

Este sistema no utiliza polígonos. En su lugar, define una "Capa Atmosférica" matemática en el cielo y utiliza **Volumetric Raymarching** (Trazado de Rayos Volumétrico) en el *Fragment Shader* para calcular la densidad del vapor de agua y cómo la luz del sol interactúa con él en tiempo real.

### 2. Pilar 1: Generación de Ruido en GPU (Compute Shaders)
Las nubes requieren "moldes" tridimensionales para tener formas algodonosas y caóticas. Descargar texturas 3D de alta resolución consumiría demasiado ancho de banda.
* **Solución DOD:** Durante la inicialización del motor (`SerionRHI`), se ejecutará un **Compute Shader** (`CloudNoiseGenerator.wgsl`) que generará matemáticamente un ruido compuesto (Perlin + Worley) en una textura tridimensional (`texture_3d<f32>`).
* **Ventaja:** Cero costo de red, y la textura reside puramente en la VRAM ultrarrápida para ser leída por el trazador de rayos.

### 3. Pilar 2: Representación Lógica (`SVolumetricCloudComponent`)
Para que el Level Designer tenga el control absoluto, las nubes deben existir en el Outliner. Se creará un actor base o se permitirá añadir este componente a cualquier actor del cielo.
**Propiedades expuestas a la Interfaz:**
* `cloudCoverage`: (0.0 a 1.0) Define si el cielo está despejado o hay tormenta.
* `cloudDensity`: Opacidad física del vapor.
* `layerBottom` y `layerTop`: Altura mínima y máxima de la capa de nubes (ej. 1500m a 4000m).
* `windDirection` y `windSpeed`: Vectores para desplazar las coordenadas de la textura 3D a lo largo del tiempo (Tick).

### 4. Pilar 3: Matemáticas de Dispersión (El Shader)
El `VolumetricCloudShader.wgsl` será uno de los shaders más pesados del motor. Realizará las siguientes operaciones físicas por cada rayo que mire al cielo:
1. **Intersección de Esfera:** Calcula si el rayo de la cámara choca con la capa esférica de nubes que envuelve al planeta.
2. **Raymarching Loop:** Avanza dentro de la nube en N pasos. En cada paso, lee la textura 3D de ruido.
3. **Ley de Beer-Lambert:** Si hay densidad, calcula cuánta luz del Sol es bloqueada antes de llegar a ese punto. Esto hace que las bases de las nubes se vean oscuras y tormentosas.
4. **Efecto Powder (Polvo):** Añade un brillo intenso (Silver Lining) en los bordes de la nube cuando el Sol está directamente detrás de ella.
5. **Fase de Henyey-Greenstein:** Calcula cómo la luz rebota hacia la cámara dependiendo del ángulo del Sol.

### 5. Mandamientos de Optimización (Rendimiento AAA)
El Trazado de Rayos es devastador para los FPS. Se imponen las siguientes reglas arquitectónicas:
* **Half-Resolution Rendering:** Las nubes **jamás** se renderizarán a la resolución nativa del canvas (ej. 4K). Se dibujarán en un búfer de tamaño reducido (1/2 o 1/4 de resolución) y luego se escalarán (Upsampling) mezclándose con la escena principal.
* **Límite de Pasos (Step Bounding):** El bucle `for` del raymarching tendrá un número estricto de iteraciones máximas (ej. 64 pasos de entrada, 6 pasos hacia el sol).
* **Early Exit:** Si la densidad acumulada del rayo llega a 1.0 (totalmente opaco), el bucle `for` debe romperse (`break`) inmediatamente para ahorrar ciclos de GPU.

### 6. Integración en el Pipeline
Las nubes se dibujan en el *Sky Pass*, estrictamente **después** del `SkyShader` (Atmósfera) y **antes** de dibujar la geometría opaca (`BasicShader`), asegurando que las montañas y edificios puedan ocluir las nubes correctamente utilizando el `depthBuffer`. 
Además, deben multiplicar su color final por la variable `dayFade` para que se oscurezcan físicamente durante la noche.
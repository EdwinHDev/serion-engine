# Serion Engine - AAA Volumetric Clouds Architecture
## ID: SER-07-AAA-CLOUDS | Estado: Diseño | Revisión: Estándar AAA Físico

### 1. Visión General (El Paradigma Nubis)
Las nubes volumétricas de grado AAA no pueden renderizarse utilizando ruido crudo en un solo paso matemático debido a la limitación de rendimiento de las GPUs. Para lograr cielos realistas que formen estrato-cúmulos, nubes cumulonimbos y que reaccionen físicamente a la luz, Serion Engine adopta una arquitectura de **Texturas 3D Pre-Horneadas + Intersección Esférica + Acumulación Temporal (TAA)**.

### 2. Pilar 1: El Sistema de Texturas (Data Layer)
El motor no generará el ruido al vuelo en el Fragment Shader. Utilizará **Compute Shaders** durante la carga del motor para esculpir tres texturas fundamentales en la VRAM:

1.  **Weather Map (Textura 2D - 1024x1024):**
    * Un mapa bidimensional que dicta el clima global.
    * Canal R: Cobertura (Dónde hay nubes y dónde está despejado).
    * Canal G: Densidad/Precipitación (Nubes grises vs Blancas).
    * Canal B: Tipo de Nube (0.0 = Estratos bajos, 1.0 = Cumulonimbos altos).
2.  **Base Shape Texture (Textura 3D - 128x128x128):**
    * Ruido *Perlin-Worley* de baja frecuencia. Define el "esqueleto" o los bloques principales de las nubes.
3.  **Erosion Detail Texture (Textura 3D - 32x32x32):**
    * Ruido *Worley* de altísima frecuencia (Fractal). Se resta a la textura base solo en los bordes para crear los detalles "algodonosos" y las volutas de vapor.

### 3. Pilar 2: Intersección Esférica Planearia
El cielo no es un techo plano. El Raymarcher se reprogramará para calcular el cruce de rayos contra dos esferas matemáticas:
* `Esfera Interior (Tierra):` Radio de 6,000,000 unidades.
* `Esfera Exterior (Atmósfera Alta):` Radio de 6,015,000 unidades (15km de grosor).
* *Ventaja:* Al mirar al horizonte, los rayos seguirán la curvatura de la Tierra de forma natural, eliminando la deformación visual y el "aplastamiento" del ruido en la lejanía.

### 4. Pilar 3: Modelo Termodinámico (Iluminación)
La luz del sol se simula a través de tres fenómenos físicos:
1.  **Beer-Lambert Law (Absorción):** Oscurece las nubes a medida que la luz viaja a través de la densidad del vapor.
2.  **Powder Effect (Dispersión Interna):** Hace que la luz rebote en los bordes de la nube hacia el espectador, generando el efecto de "algodón blanco y brillante" en las crestas superiores.
3.  **Henyey-Greenstein Dual Phase Function:** Calcula cómo el agua refracta la luz hacia adelante, creando el *Silver Lining* (el borde plateado incandescente cuando el Sol se esconde detrás de una nube).

### 5. Pilar 4: Reproyección Temporal y Anti-Aliasing (TAA)
El secreto de la industria. Dibujar 128 pasos de Raymarching por píxel destruye los 60 FPS. 
* **La Solución:** El shader lanzará únicamente entre **16 y 32 pasos**, pero utilizará un patrón de **Blue Noise** (Ruido Azul) para desfasar los rayos en cada fotograma.
* El motor guardará el fotograma actual y, en el siguiente fotograma, lo **mezclará (Blend)** con el anterior usando vectores de movimiento.
* *Resultado:* Cielos suaves, esponjosos, sin bandas (Banding) y sin granulado a un altísimo rendimiento.

---

## 🚀 Hoja de Ruta de Implementación (Phases)

La construcción de este sistema se realizará estrictamente en el siguiente orden para garantizar la estabilidad de WebGPU:

* **Fase 1: El Horno Numérico (Generadores de Ruido).** * Crear los *Compute Shaders* para generar el `Weather Map` y las texturas 3D (`Base` y `Detail`) y guardarlas en un `CloudTextureCache`.
* **Fase 2: El Cascarón Esférico.**
    * Implementar el Raymarching de intersección contra esferas planetarias. (El cielo se verá como bloques crudos que siguen el horizonte de la Tierra).
* **Fase 3: Shaping y Erosión.**
    * Conectar las texturas 3D al Raymarcher para aplicar la erosión de alta frecuencia (Convertir los bloques en nubes algodonosas).
* **Fase 4: Iluminación Física.**
    * Aplicar Beer-Powder y Henyey-Greenstein para pintar de blanco las crestas y de azul/gris oscuro los vientres de las nubes.
* **Fase 5: Temporal Reprojection (Optimización Final).**
    * Acoplar el Blue Noise y la textura de historial para eliminar el ruido y habilitar los 60 FPS.
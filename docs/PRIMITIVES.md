# Serion Engine - Primitives & Static Mesh Architecture
## ID: SER-04-PRIMITIVES | Estado: Activo

### 1. Visión General
En Serion Engine, las primitivas (Cubos, Esferas, etc.) no se generan al vuelo en cada frame ni son entidades especiales. Son mallas estáticas (`SStaticMesh`) idénticas en estructura a un modelo 3D importado. El motor las genera proceduralmente en RAM durante el arranque y las almacena de forma definitiva en la VRAM (Memoria de Video) mediante el `GeometryRegistry`.

### 2. El Formato del Vértice (Interleaved Standard)
Para maximizar el rendimiento de la caché de la GPU y preparar el motor para iluminación y materiales físicos (PBR), todos los vértices deben usar un formato entrelazado estricto de **32 bytes (8 floats)** por vértice:

* **Float 0, 1, 2:** `Position` (X, Y, Z) - Coordenadas locales.
* **Float 3, 4, 5:** `Normal` (NX, NY, NZ) - Vector de dirección para la iluminación.
* **Float 6, 7:** `UV` (U, V) - Coordenadas de texturizado bidimensional.

*Regla Estricta:* El shader (`.wgsl`) debe esperar este layout exactamente en las posiciones `@location(0)`, `@location(1)` y `@location(2)`.

### 3. Las 6 Formas Básicas (Engine Content)
El `GeometryRegistry` es responsable de inicializar las siguientes 6 primitivas fundamentales al arrancar el motor, respetando la escala de **1 Unidad = 1 cm** y la convención **Z-Up**:
1.  `Primitive_Cube`
2.  `Primitive_Sphere`
3.  `Primitive_Cylinder`
4.  `Primitive_Cone`
5.  `Primitive_Plane`
6.  `Primitive_Capsule`

### 4. Flujo de Memoria y Renderizado (Instancing)
1.  **VRAM Única:** Un `SStaticMesh` posee un `GPUBuffer` de vértices y un `GPUBuffer` de índices. Estos buffers se crean **una sola vez**.
2.  **Componentes Ligeros:** El `SStaticMeshComponent` adjunto a un `SActor` NO contiene geometría. Solo contiene un `meshId` (ej. "Primitive_Cube").
3.  **Batching:** El motor dibujará todos los actores que compartan el mismo `meshId` en un solo comando de dibujo instanciado (`drawIndexed`), minimizando las llamadas a la API gráfica.
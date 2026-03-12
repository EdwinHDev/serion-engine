# Serion Engine - Gizmos & Interaction Architecture
## ID: SER-09-GIZMOS | Estado: Activo

### 1. Visión General (The Unreal Standard)
En Serion Engine, los **Gizmos** (Manipuladores de Transformación) son la principal interfaz táctil entre el usuario y el mundo 3D. No son simples modelos decorativos; son herramientas matemáticas de precisión diseñadas para replicar exactamente el comportamiento, la visualización y la sensación de **Unreal Engine**.

Los Gizmos operan bajo reglas de renderizado exclusivas (aislados de la iluminación PBR y el Post-Procesado) y responden a un sistema de selección matemática (Raycasting) ultra-optimizado.

---

### 2. Los Tres Gizmos Fundamentales

El motor soporta tres herramientas de manipulación, cada una con sub-elementos interactivos que se iluminan (amarillo brillante) al hacer *Hover*.

#### 2.1 Translation Gizmo (Traslación)
Permite mover un objeto en el espacio 3D a lo largo de vectores rectos.
* **Componentes Visuales:**
  * **Flechas (1 Eje):** Rojo (X), Verde (Y), Azul (Z). Mueven el objeto en una línea estricta.
  * **Cuadrados Internos (2 Ejes):** Planos XY, XZ, YZ. Mueven el objeto libremente sobre una "pared" invisible plana.
  * **Esfera Central:** Movimiento relativo a los ejes X/Y de la cámara actual (Screen-Space).
* **Física de Arrastre:** Utiliza la intersección *Rayo-Plano* para garantizar que el movimiento del ratón se proyecte con precisión milimétrica sobre el eje seleccionado.

#### 2.2 Rotation Gizmo (Rotación)
Permite girar un objeto alrededor de un vector normal.
* **Componentes Visuales:**
  * **Aros (Toroides):** Rojo (Pitch/Y), Verde (Roll/X), Azul (Yaw/Z) respetando el sistema **Z-Up**. Para evitar saturación visual, solo se dibuja el semi-arco frontal hacia la cámara.
* **Comportamiento Dinámico (Procedural):**
  * Al hacer clic en un eje, los demás desaparecen.
  * El aro seleccionado se completa inmediatamente formando un círculo de 360°.
  * A medida que se arrastra el ratón, el sistema genera proceduralmente un **Gajo Geométrico (Pie Wedge)** semitransparente desde el centro hasta el cursor, rellenando el ángulo exacto recorrido para dar retroalimentación visual directa.

#### 2.3 Scale Gizmo (Escalado)
Permite modificar el tamaño del objeto (uniforme o no uniforme).
* **Componentes Visuales:**
  * **Ejes con Cubos:** Escalan el objeto estirándolo o aplastándolo en una sola dirección.
  * **Triángulos de Conexión:** Escalan en dos ejes simultáneamente.
  * **Cubo Blanco Central:** Escala uniforme absoluta (X, Y, Z crecen al mismo ritmo).

---

### 3. El Espacio de Trabajo (Coordinate Space)

Todo Gizmo debe ser capaz de operar en dos regímenes de transformación, alternables desde la UI del Editor:
1. **World Space (Absoluto):** Las flechas del Gizmo siempre apuntan a los ejes absolutos del universo (El Z azul siempre apunta al cielo), ignorando por completo la rotación actual del actor.
2. **Local Space (Relativo):** El Gizmo hereda la rotación del Actor. (Ej. Si un coche está volcado de lado, el eje Z azul apuntará en la dirección del techo del coche, no hacia el cielo del mundo).

---

### 4. Arquitectura de Renderizado (El Esqueleto Visual)

Los Gizmos **no son `SStaticMesh` normales**. Pertenecen a un pase de renderizado privilegiado y deben cumplir 3 leyes inquebrantables:

1. **Inmunidad a la Perspectiva (Constant Screen Size):** El Vertex Shader del Gizmo anula la compresión de la distancia. Si la cámara se aleja 5 kilómetros, el multiplicador de escala (`W`) aumenta proporcionalmente para que el Gizmo siempre ocupe la misma cantidad de píxeles en el monitor del usuario.
2. **Inmunidad al Entorno (Unlit Shader):** El Gizmo no reacciona al Sol, Sombras, Oclusión (SSAO) ni a la Atmósfera. Emite colores matemáticos puros (X=1,0,0 / Y=0,1,0 / Z=0,0,1).
3. **Superposición (Z-Buffer Clearing):** Justo antes de dibujar el Gizmo, el RHI ejecuta un `Depth Clear` (limpia el búfer de profundidad a `1.0`). Esto garantiza que el Gizmo se dibuje *a través* de las paredes y por encima del objeto, pero manteniendo la profundidad relativa entre sus propias piezas (la flecha Y no puede tapar a la flecha X si está detrás).

---

### 5. Sistema de Interacción (Zero-GC Raycasting)

Para evitar los "Hit Proxies" (leer colores de píxeles) que consumen ancho de banda de VRAM, la selección se hace puramente con matemáticas de CPU.

1. **Rayo Analítico:** El Viewport captura el clic 2D del ratón, lo convierte en coordenadas NDC (-1 a 1) y le pide a la `SCamera` que desproyecte un `Ray` (Origen y Dirección) hacia el mundo 3D.
2. **Sub-Picking Matemático:** El Motor no comprueba contra AABBs de caja. Utiliza algoritmos analíticos estrictos (Intersección Rayo-Cilindro para las flechas, Rayo-Toroide para los aros, y Rayo-Caja para los centros).
3. **Zero-Garbage Collection:** Durante la fase de arrastre (`mousemove`), todas las proyecciones vectoriales utilizan Float32Arrays cacheados (`SMat4`, `SVec3`). **Prohibido instanciar objetos con `new` en la función de arrastre**.

---

### 6. Desacoplamiento (UI vs Engine)

Respetando la arquitectura de eventos:
* El Motor (`SerionEngine`) no "pinta" la interfaz. Solo recibe coordenadas `(NDC_X, NDC_Y)` y devuelve deltas de transformación.
* La UI (`SerionViewport`) captura el ratón, activa el flag de "Arrastre de Gizmo" y despacha eventos para que el motor actualice la matriz del `SActor` en el `TransformPool`.
* Cualquier "Snapping" (salto de rejilla, ej. mover de 10cm en 10cm o girar 15°) se calcula antes de aplicar el delta final a la matriz.
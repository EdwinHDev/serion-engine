# Serion Engine - Gizmos & Interaction Architecture
## ID: SER-09-GIZMOS | Estado: Activo | Revisión: AAA Standard

### 1. Visión General (The Unreal Standard)
En Serion Engine, los **Gizmos** (Manipuladores de Transformación) son la principal interfaz táctil entre el usuario y el mundo 3D. No son simples modelos decorativos; son herramientas matemáticas de alta precisión diseñadas para replicar exactamente el comportamiento, la visualización y la sensación táctil de **Unreal Engine**.

Los Gizmos operan bajo reglas de renderizado exclusivas (aislados de la iluminación PBR) y responden a un sistema de selección matemática (Raycasting) ultra-optimizado y libre de recolección de basura (Zero-GC).

---

### 2. Arquitectura de Interfaz y Estado (Decoupling)

Para mantener el motor de renderizado puro y agnóstico a la web, el sistema de transformación se divide en tres pilares:

#### 2.1 EditorState (El Cerebro)
Es la Única Fuente de Verdad (Single Source of Truth). Almacena el modo actual (`translate`, `rotate`, `scale`), el espacio de coordenadas (`world`, `local`) y la configuración exacta de los imanes (Snapping) para cada herramienta.
* **Seguridad de Navegación:** Contiene el estado `isNavigating`. Si el usuario mantiene pulsado el clic derecho para volar por la escena, el `MenuManager` bloquea automáticamente todos los atajos de teclado (Q, W, E, R) para evitar cambios accidentales de herramienta.

#### 2.2 SerionViewportOverlay (La Interfaz Táctica)
Un Web Component translúcido flotante (Top-Right, 10px offset). Es puramente reactivo: escucha los eventos globales del `EditorState` para iluminar sus iconos en azul (`--serion-accent`). Contiene los selectores de herramientas, el toggle de espacio y los dropdowns nativos con los valores exactos de Snapping (ej. 15°, 10cm, 0.25x).

#### 2.3 Inyección Pasiva de Dependencias
El Motor (`SerionEngine`) jamás importa archivos de la UI. El Viewport extrae los valores de snapping del `EditorState` y se los inyecta pasivamente al motor como parámetros en cada frame durante el evento `mousemove`: `updateGizmoDrag(ndcX, ndcY, snapEnabled, snapValue)`.

---

### 3. Los Tres Gizmos Fundamentales y su Física

#### 3.1 Translation Gizmo (Traslación)
Permite mover un objeto en el espacio 3D a lo largo de vectores rectos o planos.
* **Geometría:** Cilindros rematados con conos (1 eje), triángulos invisibles (2 ejes) y una caja central.
* **Física de Arrastre:** Utiliza intersección analítica *Rayo-Plano* (`rayPlaneIntersect`).
* **Snapping:** Aplica un redondeo matemático estricto (`Math.round(val / snap) * snap`) sobre el vector de desplazamiento relativo al punto de anclaje inicial.

#### 3.2 Rotation Gizmo (Rotación) - *High Precision Tool*
Permite girar un objeto alrededor de un vector normal. Es la herramienta más compleja del motor, generada 100% de forma procedural.
* **Geometría de Reposo (Octante):** Para evitar saturación visual, dibuja 3 "Cintas Planas" (Flat Ribbons) de exactamente 90 grados (1/4 de círculo) formando un triángulo rígido entre los ejes X, Y, Z.
* **Geometría Dinámica (Drag State):**
    * Al arrastrar, los ejes inactivos desaparecen y el eje activo completa su geometría a 360°.
    * **El Abanico (Pie Wedge):** Se dibuja proceduralmente un polígono semitransparente que rellena el ángulo recorrido. Su radio es un 4% menor al del aro principal para dejar un *Gap* oscuro y evitar Z-Fighting.
    * **Precision Overlays:** Si el imán está activo, se genera un Transportador visual (líneas de marca a lo largo del aro). Dos triángulos indicadores señalan el punto de origen y el ángulo actual.
    * **HTML Tooltip:** Un elemento del DOM sigue al ratón mostrando los grados normalizados (módulo 360°) y el conteo de vueltas (`turns`).
* **Física y Matemática Crítica:**
    * **Zero-GC Radial Picking:** La detección de clics no usa cajas. Calcula la intersección del rayo contra el plano del aro y verifica si la distancia radial coincide con el radio del Gizmo.
    * **Anti-Flipping (Ángulo Continuo):** Acumula el delta del ángulo de forma continua para evadir el salto de $-\pi$ a $\pi$ de `Math.atan2`, permitiendo rotaciones infinitas.
    * **Anti-Scale (Cuaterniones):** El Delta Angle jamás se aplica directamente a las propiedades Euler del Actor. Se convierte en un Cuaternión Delta que se multiplica por el Cuaternión Inicial (`q_new = q_delta * q_start`). Esto garantiza que la matriz de rotación jamás se desnormalice, evitando que el objeto se escale o deforme al rotar.
    * **Absolute Origin Snap:** Al hacer clic con el imán activo, el ángulo inicial se ancla automáticamente al múltiplo más cercano para que los indicadores visuales coincidan perfectamente con la regla dibujada.

#### 3.3 Scale Gizmo (Escalado)
Permite modificar el tamaño del objeto.
* **Geometría:** Similar a la traslación, pero reemplazando los conos por Cubos. Posee un cubo central más masivo para la escala uniforme absoluta.
* **Física y Matemática Crítica (Geometric Ratio):**
    * A diferencia de la traslación (que suma distancias), la escala utiliza **Proporciones Geométricas** (`Multiplicador = Distancia Actual / Distancia Inicial`). Esto evita picos catastróficos de tamaño en el primer frame.
    * **Negative Scaling (Mirror):** Multiplica el resultado por la proyección del signo sobre el vector de desplazamiento. Si el ratón cruza el origen central hacia atrás, el objeto se invierte (escala negativa), replicando el comportamiento de espejado de Unreal.

---

### 4. Arquitectura de Renderizado y Memoria

Los Gizmos pertenecen a un pase de renderizado privilegiado y deben cumplir 4 leyes inquebrantables:

1.  **Inmunidad a la Perspectiva (Constant Screen Size):** El Vertex Shader del Gizmo escala la geometría (`scaleFactor = max(dist * 0.025, 0.15)`) para que siempre ocupe la misma cantidad de píxeles en pantalla, sin importar la distancia de la cámara.
2.  **Inmunidad al Entorno (Unlit Shader):** No reacciona al Sol, Sombras ni Oclusión. Emite colores matemáticos puros.
3.  **Superposición (Z-Buffer Clearing):** El RHI limpia el búfer de profundidad antes de dibujarlos, garantizando que se vean a través de las paredes pero manteniendo su propia auto-oclusión interna.
4.  **VRAM Dinámica (Zero-Overflow):** Debido a que la geometría procedural cambia drásticamente (ej. pasar de dibujar 3 aros de 90° a dibujar un anillo completo de 360°, un transportador de 72 marcas y un abanico dinámico), el `GizmoSystem` evalúa en cada frame el tamaño en bytes de los vértices generados. Si supera el buffer actual, destruye el buffer viejo (`destroy()`) y asigna uno nuevo con el tamaño exacto, evitando colapsos de memoria (`Write range does not fit`) y asegurando la máxima eficiencia de la GPU.

---

### 5. Regla de Interacción (Zero-GC Raycasting)

Durante la fase de arrastre (`updateDrag`), que se ejecuta cientos de veces por segundo:
* **PROHIBIDO** instanciar objetos con `new` (ej. `new Ray()`, `new Float32Array()`).
* Todas las matemáticas de intersección (como `rayPlaneIntersect`) deben realizarse mediante funciones puras que operen sobre arrays pre-asignados o primitivos `number`.
* Esto garantiza que el *Garbage Collector* de JavaScript no se active durante la manipulación de objetos, eliminando los micro-tirones (Lag Spikes) y manteniendo el editor a 60+ FPS rocosos.
# Serion Engine - World Standards & Metrics

Este documento define las convenciones métricas y los estándares de precisión espacial de Serion Engine para garantizar la estabilidad de las físicas y la fidelidad del renderizado.

---

## 1. Convención Métrica

Para alinearse con los estándares de la industria (Unreal Engine) y optimizar los motores de física:

- **Unidad Base**: 1 Unidad de Motor = 1 Centímetro (cm).
- **Ejes**: **Z-Up** (Eje Z positivo apunta hacia arriba).
- **Escala**: Se almacena como un Vector3 (X, Y, Z) en el pool de memoria lineal.

## 2. Gestión de Mundos Masivos (Origin Shifting)

Para evitar el temblor de precisión de punto flotante (*jittering*) en mapas extensos como Lineage 2:

- **Coordenadas Dobles**: 
    - **Posición Lógica**: Almacenada en `int64` o `double` para persistencia y lógica de juego (Posición Real).
    - **Posición de Renderizado**: Almacenada en `float32` para WebGPU (Posición Relativa).
- **Floating Origin Shift**: Cada vez que el jugador se aleja más de 2 km del origen visual, el motor realiza un "rebase", restando el offset a todos los actores para que el jugador vuelva al (0,0,0) visual sin cambiar su posición lógica.

## 3. Fidelidad Visual y Escala

La escala afecta directamente a los algoritmos de iluminación y sombreado:

- **Sombras (Shadow Bias)**: El motor ajusta automáticamente el Bias de profundidad basado en la escala del objeto para evitar el *peter-panning*.
- **Iluminación (Matriz Normal)**: El RHI calcula la matriz transpuesta inversa para asegurar que las normales de superficie no se deformen al usar escalas no uniformes.
- **Oclusión Ambiental (AO)**: Los radios de búsqueda de AO están normalizados a la escala de 1u = 1cm para resaltar detalles coherentes en cualquier tamaño.
- **Culling por Escala**: Objetos cuya escala proyectada en pantalla sea menor a 0.5 píxeles se descartan automáticamente para ahorrar Draw Calls.
# Serion Engine - Arquitectura del Grafo de Escena y Jerarquía de Transformaciones
## ID: SER-08-GRAFO-ESCENA | Estado: Activo

### 1. Visión General (El Paradigma Padre-Hijo)
El motor requiere la capacidad de emparentar actores para crear estructuras complejas (ej. un arma atada a la mano de un jugador, o las cuatro ruedas de un vehículo). Esto exige que el motor entienda matemáticamente dos espacios espaciales distintos:
* **Espacio Local (Local Space):** La posición, rotación y escala de un Actor relativa exclusivamente a su Padre.
* **Espacio Global (World Space):** La posición absoluta en el universo, resultante de multiplicar la transformación local del Actor por la transformación global de su Padre.

### 2. Prohibición de Árboles OOP (Data-Oriented Design)
*Mandamiento de Optimización:* Queda **estrictamente prohibido** utilizar estructuras de datos propias de la Programación Orientada a Objetos (OOP) para el Grafo de Escena (ej. `actor.children = [actor1, actor2]`).
* **Motivo:** Las estructuras de árbol clásicas y la recursividad causan *Cache Misses* severos. La CPU se ve obligada a saltar aleatoriamente por la memoria RAM buscando a los hijos, destruyendo el rendimiento y violando nuestro estándar DOD.
* **La Solución Serion:** El Grafo de Escena será **Plano y Lineal**.

### 3. Estructura de Datos Híbrida
Para mantener el estándar AAA y poder calcular la física de miles de actores en milisegundos sin latencia:

#### 3.1 Nivel Lógico (`SActor`)
El Actor no contendrá arreglos ni referencias directas a objetos hijos en memoria. Solo poseerá:
* `parentId: number | null` (El ID numérico de su padre directo, si lo tiene).
* Una API limpia para la lógica de juego: `attachTo(parent: SActor)` y `detach()`.

#### 3.2 Nivel de Memoria (`TransformPool`)
El `TransformPool` evolucionará para separar los conceptos matemáticos en su `Float32Array` continuo. Por cada entidad, el pool calculará y almacenará:
1. `LocalMatrix` (Construida a partir de la posición, rotación y escala locales).
2. `GlobalMatrix` (La matriz absoluta final que se envía a la tarjeta gráfica y al motor de físicas).

### 4. El Algoritmo de Grafo Plano (Topological Sort)
Para calcular las matrices globales sin usar funciones recursivas ni sufrir *1-Frame Lag* (retraso visual de 1 fotograma al seguir a un padre en movimiento), el motor implementará un algoritmo de ordenamiento topológico.

1. **La Lista de Actualización:** El `SWorld` mantendrá un arreglo plano de IDs de actores activos (`activeActorIds: number[]`).
2. **Ordenamiento Garantizado:** Cuando un Actor llama a `attachTo(parent)`, el motor reordena este arreglo garantizando matemáticamente que **el ID del Padre siempre se evalúe antes que el ID del Hijo**.
3. **El Bucle Lineal (Tick):** Durante la actualización del frame, el motor itera este arreglo de principio a fin de forma contigua:
   * Calcula la `LocalMatrix`.
   * Si el Actor tiene `parentId`, lee la `GlobalMatrix` de su padre (que, gracias al ordenamiento previo, ya fue calculada milisegundos antes) y las multiplica: `Global = ParentGlobal * Local`.
   * Si no tiene padre: `Global = Local`.
4. **Costo de Rendimiento:** Este algoritmo es lineal `O(N)`. Garantiza una optimización absoluta de la Caché de la CPU (*Zero Cache Misses*).

### 5. Propagación de Ciclo de Vida (Cascading)
El estado de jerarquía afecta al ciclo de vida global del motor:
* **Destrucción en Cascada:** Si un Actor padre es destruido mediante `SWorld.destroyActor()`, el sistema debe propagar la orden de destrucción a todos los actores cuyo `parentId` coincida con el del padre, liberando sus recursos para evitar *Memory Leaks*.
* **Visibilidad y Física:** (Futura implementación) Si un padre se oculta o se desactiva, la jerarquía propaga este estado al RHI y al motor de físicas automáticamente.
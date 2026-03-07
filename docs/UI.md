# Documentación del Proyecto: Serion Engine
## Documento 02: Especificación Técnica de la UI (The Shell Layout)

### 1. Objetivo Arquitectónico
Construir una carcasa (Shell) robusta, inmersiva y profesional que replique la experiencia de usuario de Unreal Engine 5. El sistema debe ser altamente flexible, utilizando **CSS Grid** para la estructura macro y **Flexbox** para los micro-componentes.

### 2. Estructura del DOM y Web Components
El Layout se dividirá en los siguientes Custom Elements, todos encapsulados con **Shadow DOM**:

- `<serion-editor-shell>`: El nodo raíz. Gestiona el grid global.
- `<serion-toolbar>`: Barra superior para herramientas y menús.
- `<serion-main-container>`: Contenedor medio que divide el Viewport de los paneles laterales.
- `<serion-viewport>`: Host del canvas WebGPU (El área más importante).
- `<serion-sidebar-right>`: Contenedor vertical para el Outliner y el Details Panel.
- `<serion-content-browser>`: Panel inferior para la gestión de assets.
- `<serion-status-bar>`: Información técnica y logs.

### 3. Definición del Layout (Grid System)
El Shell principal utilizará un layout de áreas nombradas para garantizar la mantenibilidad:

```css
:host {
  display: grid;
  grid-template-areas:
    "toolbar toolbar"
    "main-area main-area"
    "footer footer";
  grid-template-rows: 48px 1fr 24px;
  grid-template-columns: 1fr;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--serion-bg-0);
}
```

### 4. Sistema de Temas (Serion Deep Dark)
Definiremos un set de propiedades CSS en el :root (o en el host del shell) para asegurar la consistencia visual:


* ```--serion-bg-0```: #0F0F0F (Fondo base)
* ```--serion-bg-1```: #161616 (Paneles y Sidebar)
* ```--serion-bg-2```: #262626 (Headers de paneles y botones)
* ```--serion-border```: #2B2B2B (Separadores sutiles)
* ```--serion-accent```: #0070FF (Azul Unreal para estados activos)
* ```--serion-text-main```: #CCCCCC (Texto principal)
* ```--serion-text-dim```: #888888 (Labels y descripciones)

### 5. Comportamiento del Viewport
El componente ```<serion-viewport>``` debe ser elástico. Implementará un ResizeObserver para que, cuando el usuario redimensione la ventana o los paneles, el motor de renderizado reciba las nuevas dimensiones de inmediato y ajuste el Aspect Ratio de la cámara sin deformación.

### 6. Reglas de Interacción
* Bordes de Paneles: Deben tener un grosor de 1px con el color ```--serion-border```.
* Scrolling: El Shell principal tiene ```overflow: hidden```. Solo los componentes de contenido (Details, Outliner) pueden tener scroll interno.
* Fuentes: Utilizaremos fuentes sans-serif de sistema (Inter, Segoe UI o Roboto) con un tamaño base de 12px para mantener una estética técnica.

# Serion Engine - UI Refinement

### 1. Sistema de "Splitters" (Resizables)
Se requiere la implementación de divisores de paneles (Splitters) que permitan al usuario modificar el ancho/alto de las áreas.
- **Acción:** El `<serion-editor-shell>` debe detectar eventos de arrastre en los bordes de los paneles.

### 2. Componentización de Assets
El Content Browser debe dejar de usar elementos estáticos.
- **Componente:** `<serion-asset-item>`
- **Propiedades:** `type` (Mesh, Texture, Shader), `label` y `icon`.
- **SOLID:** Este componente debe ser agnóstico a la lógica de carga; solo representa el asset visualmente.

### 3. Debug Overlay en Viewport
El texto "SERION RENDERER..." es un buen inicio, pero necesitamos un overlay real de estadísticas.
- **Requisito:** Un componente `<serion-viewport-stats>` que flote en la esquina superior izquierda del viewport para mostrar latencia de GPU y conteo de polígonos futuro.

### 4. Sistema de Menús Desplegables
La barra superior (File, Edit, Window...) debe ser funcional.
- **Requisito:** Implementar un sistema de `Dropdown` que se cierre al hacer click fuera, usando el patrón de diseño "Singleton" para el gestor de menús abiertos.
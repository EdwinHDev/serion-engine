# Serion Engine - UI Master Design & Technical Specification

Este documento define la arquitectura, estándares y comportamiento de la interfaz de usuario del editor de Serion Engine. Debe ser respetado por cualquier módulo futuro para garantizar la consistencia de una herramienta de grado profesional.

---

## 1. Arquitectura Técnica Base

### 1.1 Web Components & Shadow DOM
Toda la UI está construida bajo el estándar de **Web Components** nativos. 
- **Shadow DOM:** Cada componente utiliza `shadowRoot` en modo `open` para encapsular estilos y evitar colisiones con el renderizador 3D.
- **Ciclo de Vida:** Se prioriza el uso de `connectedCallback` para la renderización inicial y el registro de eventos globales.

### 1.2 Sistema de Temas (Serion Deep Dark)
La identidad visual se gestiona mediante variables CSS globales definidas en `theme.css`.

| Variable | Valor | Uso |
| :--- | :--- | :--- |
| `--serion-bg-0` | `#0F0F0F` | Fondo de la aplicación. |
| `--serion-bg-1` | `#161616` | Fondo de paneles laterales e inferiores. |
| `--serion-bg-2` | `#262626` | Headers de paneles, botones y fondos de menú. |
| `--serion-accent` | `#0070FF` | Color de selección, bordes activos y botones primarios. |
| `--serion-border` | `#2B2B2B` | Separadores de paneles y bordes de assets. |
| `--serion-text-main` | `#CCCCCC` | Texto de lectura principal. |
| `--serion-text-dim` | `#888888` | Etiquetas, placeholders y texto desactivado. |

---

## 2. Estructura del Layout (The Shell)

El componente `<serion-editor-shell>` organiza el espacio de trabajo mediante un **CSS Grid dinámico**.

### 2.1 Áreas Definidas
- **Toolbar (Top):** Altura fija (48px). Control global y menús.
- **Viewport (Center):** Área elástica. Host del Canvas WebGPU.
- **Sidebar (Right):** Ancho variable (mín. 200px). Contiene Outliner y Details.
- **Content Browser (Bottom):** Altura variable. Gestión de archivos.
- **StatusBar (Footer):** Altura fija (24px). Telemetría y estado del sistema.

### 2.2 Sistema de Resizing (Splitters)
- Implementado mediante `Pointer Events` y `setPointerCapture`.
- **Overlay de Bloqueo:** Durante el arrastre, se activa un div invisible (`.resize-overlay`) de pantalla completa para evitar que el ratón pierda el foco sobre el Viewport.
- **Variables CSS:** El redimensionamiento no mueve elementos, actualiza las variables `--sidebar-width` y `--footer-height` en el `:host`.

---

## 3. Componentes y Comportamientos

### 3.1 SerionToolbar & Menus
- **MenuManager (Singleton):** Orquestador central que asegura que solo haya un menú desplegable activo.
- **Dropdown Logic:** Los menús se cierran automáticamente mediante el evento `serion-menu-close` al hacer clic fuera de ellos.
- **Hover Persistence:** Si un menú ya está abierto, el paso del puntero sobre otros ítems de la barra superior los despliega automáticamente.

### 3.2 SerionViewport (WebGPU Bridge)
- **DPI Scaling:** Calcula automáticamente el `devicePixelRatio` para ajustar `canvas.width` y `canvas.height`.
- **Responsiveness:** Utiliza un `ResizeObserver` para sincronizar el buffer de dibujo con el tamaño del contenedor CSS en tiempo real.

### 3.3 SerionSidebar (Colapsables)
- Compuesta por paneles independientes (Outliner, Details).
- **Estado de Colapso:** Cada sección tiene un botón de toggle que oculta el contenido (`.content`) y rota el icono de flecha.

### 3.4 SerionContentBrowser
- **Delegación de Eventos:** El contenedor padre gestiona los clics de selección mediante `data-index` para optimizar el uso de memoria.
- **Asset Item:** Componente reutilizable que soporta tipos: `Folder`, `Mesh`, `Texture`, `Material`, `Shader`.

---

## 4. Reglas de Ingeniería de UI (SOLID)

1. **SRP (Single Responsibility):** Un componente de UI no debe contener lógica de físicas o renderizado masivo. Solo gestiona su visualización y emite eventos.
2. **Event-Driven:** La comunicación entre componentes (ej. seleccionar un objeto y mostrarlo en Details) debe realizarse mediante el `Event Bus` o `CustomEvents` globales.
3. **Impecabilidad Visual:** Ningún elemento debe tener scrollbars visibles de estilo navegador; se deben usar estilos de scroll integrados en el tema oscuro.
4. **Performance:** Prohibido el uso de librerías de UI externas. Todo debe ser vanilla JS/TS para mantener el bundle al mínimo.
/**
 * SerionDetailsPanel - Interfaz de edición de propiedades para Actores.
 * ID: SER-10-DETAILS-PANEL | Paso 2.
 * Soporta: Transform (Position, Rotation Euler↔Quat, Scale),
 *          Material PBR (Base Color, Metallic, Roughness),
 *          Directional Light (Color, Intensity).
 */
export class SerionDetailsPanel extends HTMLElement {
  private currentActorId: number | null = null;
  private selectionHandler = (e: Event) => this.onSelectionChanged(e as CustomEvent);

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    window.addEventListener('serion:selection-changed', this.selectionHandler);
    this.render();
  }

  disconnectedCallback() {
    window.removeEventListener('serion:selection-changed', this.selectionHandler);
  }

  // ─── Math Helpers (Zero-Dependencies) ───────────────────────────────

  /**
   * Convierte ángulos Euler (grados, Z-Up: Roll, Pitch, Yaw) a Cuaternión [x, y, z, w].
   * Convención intrínseca ZYX.
   */
  private eulerToQuat(rollDeg: number, pitchDeg: number, yawDeg: number): [number, number, number, number] {
    const toRad = Math.PI / 180;
    const hr = (rollDeg * toRad) * 0.5;
    const hp = (pitchDeg * toRad) * 0.5;
    const hy = (yawDeg * toRad) * 0.5;

    const sr = Math.sin(hr), cr = Math.cos(hr);
    const sp = Math.sin(hp), cp = Math.cos(hp);
    const sy = Math.sin(hy), cy = Math.cos(hy);

    // ZYX intrinsic
    const x = sr * cp * cy - cr * sp * sy;
    const y = cr * sp * cy + sr * cp * sy;
    const z = cr * cp * sy - sr * sp * cy;
    const w = cr * cp * cy + sr * sp * sy;

    return [x, y, z, w];
  }

  /**
   * Convierte Cuaternión [x, y, z, w] a ángulos Euler (grados, Z-Up: Roll, Pitch, Yaw).
   */
  private quatToEuler(x: number, y: number, z: number, w: number): [number, number, number] {
    const toDeg = 180 / Math.PI;

    // Roll (X)
    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp) * toDeg;

    // Pitch (Y) — clampeado para evitar gimbal lock
    const sinp = 2 * (w * y - z * x);
    let pitch: number;
    if (Math.abs(sinp) >= 1) {
      pitch = (Math.PI / 2) * Math.sign(sinp) * toDeg;
    } else {
      pitch = Math.asin(sinp) * toDeg;
    }

    // Yaw (Z)
    const siny_cosp = 2 * (w * z + x * y);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp) * toDeg;

    return [roll, pitch, yaw];
  }

  /**
   * Convierte componentes float [0..1] a hex "#rrggbb".
   */
  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Convierte hex "#rrggbb" a floats [r, g, b] en rango [0..1].
   */
  private hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16) / 255,
      parseInt(h.substring(2, 4), 16) / 255,
      parseInt(h.substring(4, 6), 16) / 255
    ];
  }

  /**
   * Configura la lógica de arrastre (scrubbing) sobre una etiqueta para cambiar un input numérico usando Pointer Lock.
   */
  private setupDraggableLabel(label: HTMLElement, input: HTMLInputElement, sensitivity: number = 1): void {
    let isDragging = false;
    let accumulatedValue = 0;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      isDragging = true;
      accumulatedValue = parseFloat(input.value) || 0;
      label.requestPointerLock();
    };

    const onMouseMove = (e: MouseEvent) => {
      // En Shadow DOM, document.pointerLockElement devuelve el HOST, 
      // por lo que debemos comprobar el pointerLockElement de la shadowRoot.
      const isLocked = document.pointerLockElement === this || this.shadowRoot?.pointerLockElement === label;
      if (!isDragging || !isLocked) return;

      // movementX nos da los píxeles físicos movidos por el ratón sin importar los bordes de la pantalla
      accumulatedValue += (e.movementX * sensitivity);
      
      const step = parseFloat(input.step) || 0.01;
      let displayValue = accumulatedValue;
      if (!isNaN(step) && step > 0) {
        displayValue = Math.round(accumulatedValue / step) * step;
      }

      input.value = (step < 1) ? displayValue.toFixed(2) : Math.round(displayValue).toString();
      
      // Disparar evento input para que la lógica de mutación reaccione
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        document.exitPointerLock();
      }
    };

    label.addEventListener('mousedown', onMouseDown);
    // Estos se añaden al document para asegurar captura global durante el lock
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // ─── Event Handling ─────────────────────────────────────────────────

  private onSelectionChanged(e: CustomEvent): void {
    const selectedIds = e.detail.selectedIds as number[];
    if (selectedIds.length === 1) {
      this.currentActorId = selectedIds[0];
    } else {
      this.currentActorId = null;
    }
    this.render();
  }

  private dispatchPropertyChange(component: string, property: string, value: any): void {
    if (this.currentActorId === null) return;

    window.dispatchEvent(new CustomEvent('serion:actor-property-changed', {
      detail: {
        id: this.currentActorId,
        component,
        property,
        value
      }
    }));
  }

  // ─── Render ─────────────────────────────────────────────────────────

  private render() {
    if (!this.shadowRoot) return;

    if (this.currentActorId === null) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; padding: 20px; color: var(--serion-text-dim); font-size: 11px; font-style: italic; opacity: 0.5; }
        </style>
        <div class="empty-state">Select a single object to see details.</div>
      `;
      return;
    }

    const api = (window as any).SerionEngineAPI;
    const actorData = api ? api.getActorData(this.currentActorId) : null;

    if (!actorData) {
      this.shadowRoot.innerHTML = `<div style="padding: 20px;">Error: Engine API not ready or Actor data unavailable.</div>`;
      return;
    }

    const pos = actorData.transform.position;
    const rot = actorData.transform.rotation; // [x, y, z, w] quaternion
    const sca = actorData.transform.scale;

    // Convertir quaternion a Euler para mostrar en la UI
    const [roll, pitch, yaw] = this.quatToEuler(rot[0], rot[1], rot[2], rot[3]);

    // ─── Material Data ───
    let materialHTML = '';
    if (actorData.material) {
      const bc = actorData.material.baseColor; // [r, g, b, a]
      const pbr = actorData.material.pbrParams; // [metallic, roughness, ?, ?]
      const baseColorHex = this.rgbToHex(bc[0], bc[1], bc[2]);
      const metallic = pbr[0] ?? 0;
      const roughness = pbr[1] ?? 0.5;

      materialHTML = `
        <div class="category">
          <div class="category-header">
            <span>▼</span> Material
          </div>
          <div class="category-content">
            <div class="property-row">
              <div class="property-label">Base Color</div>
              <div class="color-input-wrapper">
                <input type="color" id="mat-base-color" value="${baseColorHex}">
                <span class="color-hex-label">${baseColorHex}</span>
              </div>
            </div>
            <div class="property-row">
              <div class="property-label">Metallic</div>
              <div class="range-input-wrapper">
                <input type="range" id="mat-metallic" min="0" max="1" step="0.01" value="${metallic}">
                <span class="range-value" id="mat-metallic-val">${metallic.toFixed(2)}</span>
              </div>
            </div>
            <div class="property-row">
              <div class="property-label">Roughness</div>
              <div class="range-input-wrapper">
                <input type="range" id="mat-roughness" min="0" max="1" step="0.01" value="${roughness}">
                <span class="range-value" id="mat-roughness-val">${roughness.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // ─── Light Data ───
    let lightHTML = '';
    if (actorData.light) {
      const lc = actorData.light.color; // [r, g, b]
      const lightColorHex = this.rgbToHex(lc[0], lc[1], lc[2]);
      const intensity = actorData.light.intensity;

      lightHTML = `
        <div class="category">
          <div class="category-header">
            <span>▼</span> Directional Light
          </div>
          <div class="category-content">
            <div class="property-row">
              <div class="property-label">Color</div>
              <div class="color-input-wrapper">
                <input type="color" id="light-color" value="${lightColorHex}">
                <span class="color-hex-label">${lightColorHex}</span>
              </div>
            </div>
            <div class="property-row">
              <div class="property-label">Intensity</div>
              <div class="single-input-wrapper">
                <input type="number" step="1000" id="light-intensity" value="${intensity}">
                <span class="input-unit">lux</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--serion-text-main);
          font-family: 'Inter', sans-serif;
          user-select: none;
        }

        .category {
          border-bottom: 1px solid var(--serion-border);
        }

        .category-header {
          background: var(--serion-bg-2);
          padding: 6px 12px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--serion-text-dim);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .category-content {
          padding: 12px;
        }

        .property-row {
          display: grid;
          grid-template-columns: 80px 1fr;
          align-items: center;
          margin-bottom: 8px;
          gap: 8px;
        }

        .property-label {
          font-size: 11px;
          color: var(--serion-text-dim);
        }

        .vector-input {
          display: flex;
          gap: 4px;
        }

        .axis-group {
          flex: 1;
          display: flex;
          align-items: center;
          background: var(--serion-bg-2);
          border-radius: 2px;
          overflow: hidden;
          border: 1px solid transparent;
        }

        .axis-group:focus-within {
          border-color: var(--serion-accent);
        }

        .axis-label {
          width: 14px;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 900;
          color: #fff;
          cursor: ew-resize;
          user-select: none;
          transition: filter 0.1s;
        }

        .axis-label:hover {
          filter: brightness(1.2);
        }

        .axis-x { background: #e74c3c; }
        .axis-y { background: #2ecc71; }
        .axis-z { background: #3498db; }

        /* Rotation axis labels — subtle warm tones */
        .axis-r { background: #e67e22; }
        .axis-p { background: #9b59b6; }
        .axis-yw { background: #1abc9c; }

        input[type="number"] {
          width: 100%;
          background: transparent;
          border: none;
          color: #fff;
          font-size: 11px;
          padding: 4px;
          outline: none;
          min-width: 0;
        }

        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none; margin: 0;
        }

        /* ─── Color Input ─── */
        .color-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        input[type="color"] {
          -webkit-appearance: none;
          border: 1px solid var(--serion-border);
          border-radius: 3px;
          width: 32px;
          height: 22px;
          padding: 0;
          cursor: pointer;
          background: transparent;
        }

        input[type="color"]::-webkit-color-swatch-wrapper {
          padding: 1px;
        }

        input[type="color"]::-webkit-color-swatch {
          border: none;
          border-radius: 2px;
        }

        .color-hex-label {
          font-size: 10px;
          color: var(--serion-text-dim);
          font-family: monospace;
        }

        /* ─── Range Input ─── */
        .range-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        input[type="range"] {
          flex: 1;
          -webkit-appearance: none;
          height: 4px;
          background: var(--serion-bg-2);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--serion-accent);
          cursor: pointer;
          border: 2px solid var(--serion-bg-1);
        }

        .range-value {
          font-size: 10px;
          color: var(--serion-text-dim);
          font-family: monospace;
          min-width: 30px;
          text-align: right;
        }

        /* ─── Single Input (Intensity) ─── */
        .single-input-wrapper {
          display: flex;
          align-items: center;
          background: var(--serion-bg-2);
          border-radius: 2px;
          border: 1px solid transparent;
          overflow: hidden;
        }

        .single-input-wrapper:focus-within {
          border-color: var(--serion-accent);
        }

        .single-input-wrapper input[type="number"] {
          flex: 1;
        }

        .input-unit {
          font-size: 9px;
          color: var(--serion-text-dim);
          padding: 0 6px;
          opacity: 0.6;
        }

        .empty-state {
          font-style: italic;
          font-size: 11px;
          opacity: 0.5;
        }

        .actor-id-tag {
          font-size: 9px;
          background: var(--serion-accent);
          color: #fff;
          padding: 2px 4px;
          border-radius: 2px;
          margin-left: auto;
        }
      </style>

      <!-- ═══ TRANSFORM ═══ -->
      <div class="category">
        <div class="category-header">
          <span>▼</span> Transform
          <span class="actor-id-tag">ID: ${actorData.id}</span>
        </div>
        <div class="category-content">
          <!-- Position -->
          <div class="property-row">
            <div class="property-label">Location</div>
            <div class="vector-input">
              <div class="axis-group">
                <div class="axis-label axis-x">X</div>
                <input type="number" step="any" id="pos-x" value="${pos[0]}">
              </div>
              <div class="axis-group">
                <div class="axis-label axis-y">Y</div>
                <input type="number" step="any" id="pos-y" value="${pos[1]}">
              </div>
              <div class="axis-group">
                <div class="axis-label axis-z">Z</div>
                <input type="number" step="any" id="pos-z" value="${pos[2]}">
              </div>
            </div>
          </div>

          <!-- Rotation (Euler, degrees) -->
          <div class="property-row">
            <div class="property-label">Rotation</div>
            <div class="vector-input">
              <div class="axis-group">
                <div class="axis-label axis-r">R</div>
                <input type="number" step="0.1" id="rot-roll" value="${roll.toFixed(2)}">
              </div>
              <div class="axis-group">
                <div class="axis-label axis-p">P</div>
                <input type="number" step="0.1" id="rot-pitch" value="${pitch.toFixed(2)}">
              </div>
              <div class="axis-group">
                <div class="axis-label axis-yw">Y</div>
                <input type="number" step="0.1" id="rot-yaw" value="${yaw.toFixed(2)}">
              </div>
            </div>
          </div>

          <!-- Scale -->
          <div class="property-row">
            <div class="property-label">Scale</div>
            <div class="vector-input">
              <div class="axis-group">
                <div class="axis-label axis-x">X</div>
                <input type="number" step="any" id="sca-x" value="${sca[0]}">
              </div>
              <div class="axis-group">
                <div class="axis-label axis-y">Y</div>
                <input type="number" step="any" id="sca-y" value="${sca[1]}">
              </div>
              <div class="axis-group">
                <div class="axis-label axis-z">Z</div>
                <input type="number" step="any" id="sca-z" value="${sca[2]}">
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ MATERIAL (Conditional) ═══ -->
      ${materialHTML}

      <!-- ═══ DIRECTIONAL LIGHT (Conditional) ═══ -->
      ${lightHTML}
    `;

    this.setupInputEvents();
  }

  // ─── Input Event Wiring ─────────────────────────────────────────────

  private setupInputEvents() {
    const root = this.shadowRoot;
    if (!root) return;

    // ─── Transform: Position & Scale ───
    const vecIds = ['pos-x', 'pos-y', 'pos-z', 'sca-x', 'sca-y', 'sca-z'];
    vecIds.forEach(id => {
      const input = root.getElementById(id) as HTMLInputElement;
      if (!input) return;

      const handler = () => {
        const type = id.startsWith('pos') ? 'position' : 'scale';
        const prefix = id.startsWith('pos') ? 'pos' : 'sca';

        const x = parseFloat((root.getElementById(`${prefix}-x`) as HTMLInputElement).value) || 0;
        const y = parseFloat((root.getElementById(`${prefix}-y`) as HTMLInputElement).value) || 0;
        const z = parseFloat((root.getElementById(`${prefix}-z`) as HTMLInputElement).value) || 0;

        this.dispatchPropertyChange('transform', type, [x, y, z]);
      };

      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });

    // ─── Transform: Rotation (Euler → Quat) ───
    const rotIds = ['rot-roll', 'rot-pitch', 'rot-yaw'];
    rotIds.forEach(id => {
      const input = root.getElementById(id) as HTMLInputElement;
      if (!input) return;

      const handler = () => {
        const rollVal = parseFloat((root.getElementById('rot-roll') as HTMLInputElement).value) || 0;
        const pitchVal = parseFloat((root.getElementById('rot-pitch') as HTMLInputElement).value) || 0;
        const yawVal = parseFloat((root.getElementById('rot-yaw') as HTMLInputElement).value) || 0;

        const [qx, qy, qz, qw] = this.eulerToQuat(rollVal, pitchVal, yawVal);
        this.dispatchPropertyChange('transform', 'rotation', [qx, qy, qz, qw]);
      };

      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });

    // ─── Material: Base Color ───
    const matColorInput = root.getElementById('mat-base-color') as HTMLInputElement;
    if (matColorInput) {
      const handler = () => {
        const [r, g, b] = this.hexToRgb(matColorInput.value);
        // Actualizar label visual
        const hexLabel = matColorInput.parentElement?.querySelector('.color-hex-label');
        if (hexLabel) hexLabel.textContent = matColorInput.value;

        this.dispatchPropertyChange('material', 'baseColor', [r, g, b, 1.0]);
      };
      matColorInput.addEventListener('input', handler);
    }

    // ─── Material: Metallic & Roughness ───
    const metallicInput = root.getElementById('mat-metallic') as HTMLInputElement;
    const roughnessInput = root.getElementById('mat-roughness') as HTMLInputElement;

    if (metallicInput && roughnessInput) {
      const pbrHandler = () => {
        const metallic = parseFloat(metallicInput.value);
        const roughness = parseFloat(roughnessInput.value);

        // Actualizar labels visuales
        const metallicVal = root.getElementById('mat-metallic-val');
        const roughnessVal = root.getElementById('mat-roughness-val');
        if (metallicVal) metallicVal.textContent = metallic.toFixed(2);
        if (roughnessVal) roughnessVal.textContent = roughness.toFixed(2);

        this.dispatchPropertyChange('material', 'pbrParams', [metallic, roughness, 0.5, 0]);
      };

      metallicInput.addEventListener('input', pbrHandler);
      roughnessInput.addEventListener('input', pbrHandler);
    }

    // ─── Light: Color ───
    const lightColorInput = root.getElementById('light-color') as HTMLInputElement;
    if (lightColorInput) {
      const handler = () => {
        const [r, g, b] = this.hexToRgb(lightColorInput.value);
        const hexLabel = lightColorInput.parentElement?.querySelector('.color-hex-label');
        if (hexLabel) hexLabel.textContent = lightColorInput.value;

        this.dispatchPropertyChange('light', 'color', [r, g, b]);
      };
      lightColorInput.addEventListener('input', handler);
    }

    // ─── Light: Intensity ───
    const lightIntensityInput = root.getElementById('light-intensity') as HTMLInputElement;
    if (lightIntensityInput) {
      const handler = () => {
        const val = parseFloat(lightIntensityInput.value) || 0;
        this.dispatchPropertyChange('light', 'intensity', val);
      };
      lightIntensityInput.addEventListener('input', handler);
      lightIntensityInput.addEventListener('change', handler);
    }

    // ─── UX: Drag-to-change (Scrubbing) ───
    const scrubGroups = [
      { prefix: 'pos', sensitivity: 0.5 },
      { prefix: 'sca', sensitivity: 0.5 },
      { prefix: 'rot', sensitivity: 1.0 }
    ];

    scrubGroups.forEach(group => {
      const axes = group.prefix === 'rot' ? ['roll', 'pitch', 'yaw'] : ['x', 'y', 'z'];
      axes.forEach(axis => {
        const input = root.getElementById(`${group.prefix}-${axis}`) as HTMLInputElement;
        const label = input?.previousElementSibling as HTMLElement;
        
        if (input && label && label.classList.contains('axis-label')) {
          this.setupDraggableLabel(label, input, group.sensitivity);
        }
      });
    });
  }
}

customElements.define('serion-details-panel', SerionDetailsPanel);

/**
 * SGlobalEnvironmentData.ts - Datos Globales del Entorno (Uniform Buffer).
 * Capa 12.5: Encapsulación de memoria (Clean Code).
 * Tamaño: 288 bytes (72 floats).
 */
export class SGlobalEnvironmentData {
  public readonly buffer = new Float32Array(72);

  /**
   * Establece la matriz View-Projection de la cámara principal.
   * Offset: 0 (64 bytes / 16 floats)
   */
  public setViewProjectionMatrix(matrix: Float32Array): void {
    this.buffer.set(matrix, 0);
  }

  /**
   * Establece la matriz View-Projection de la Cascada de Sombra 0 (Cerca).
   * Offset: 16 (64 bytes / 16 floats)
   */
  public setLightViewProj0(matrix: Float32Array): void {
    this.buffer.set(matrix, 16);
  }

  /**
   * Establece la matriz View-Projection de la Cascada de Sombra 1 (Lejos).
   * Offset: 32 (64 bytes / 16 floats)
   */
  public setLightViewProj1(matrix: Float32Array): void {
    this.buffer.set(matrix, 32);
  }

  /**
   * Establece las distancias de división de las cascadas.
   * Offset: 48 (16 bytes / 4 floats)
   */
  public setCascadeSplits(near: number, far: number): void {
    this.buffer[48] = near;
    this.buffer[49] = far;
    this.buffer[50] = 0.0; // Unused
    this.buffer[51] = 0.0; // Unused
  }

  /**
   * Establece la posición de la cámara del jugador.
   * Offset: 52 (16 bytes / 4 floats)
   */
  public setCameraPosition(x: number, y: number, z: number): void {
    this.buffer[52] = x;
    this.buffer[53] = y;
    this.buffer[54] = z;
    this.buffer[55] = 1.0; // Padding
  }

  /**
   * Establece la dirección e intensidad del Sol.
   * Offset: 56 (16 bytes / 4 floats)
   */
  public setSun(dirX: number, dirY: number, dirZ: number, intensity: number): void {
    this.buffer[56] = dirX;
    this.buffer[57] = dirY;
    this.buffer[58] = dirZ;
    this.buffer[59] = intensity;
  }

  /**
   * Establece los parámetros visuales de la atmósfera.
   * Offset 60: Color sol (RGB) + Ambiente (W).
   * Offset 64: Color cielo (RGB) + Alpha (W).
   * Offset 68: Color suelo (RGB) + Alpha (W).
   */
  public setAtmosphere(sunColor: Float32Array, ambientInt: number, skyColor: Float32Array, groundColor: Float32Array): void {
    // Sun Color & Ambient
    this.buffer[60] = sunColor[0];
    this.buffer[61] = sunColor[1];
    this.buffer[62] = sunColor[2];
    this.buffer[63] = ambientInt;

    // Sky Color
    this.buffer[64] = skyColor[0];
    this.buffer[65] = skyColor[1];
    this.buffer[66] = skyColor[2];
    this.buffer[67] = 1.0;

    // Ground Color
    this.buffer[68] = groundColor[0];
    this.buffer[69] = groundColor[1];
    this.buffer[70] = groundColor[2];
    this.buffer[71] = 1.0;
  }

  /**
   * Getters primitivos para el color del cielo (Zero-GC).
   * Utilizados por el RHI para sincronizar el Clear Color.
   */
  public getSkyColorR(): number { return this.buffer[64]; }
  public getSkyColorG(): number { return this.buffer[65]; }
  public getSkyColorB(): number { return this.buffer[66]; }
}

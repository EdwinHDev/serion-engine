/**
 * SGlobalEnvironmentData.ts - Datos Globales del Entorno (Uniform Buffer).
 * Capa 13.9: Soporte para Atmósfera Física y Buffers extendidos.
 * Tamaño: 320 bytes (80 floats).
 */
export class SGlobalEnvironmentData {
  public readonly buffer = new Float32Array(80);

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
    this.buffer[50] = 0.0;
    this.buffer[51] = 0.0;
  }

  /**
   * Establece la posición de la cámara del jugador.
   * Offset: 52 (16 bytes / 4 floats)
   */
  public setCameraPosition(x: number, y: number, z: number): void {
    this.buffer[52] = x;
    this.buffer[53] = y;
    this.buffer[54] = z;
    this.buffer[55] = 1.0;
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
   * Establece los parámetros visuales para el sombreador PBR (Compatibilidad básica).
   * Offset 60: Color sol (RGB) + Ambiente (W).
   * Offset 64: Color cielo (RGB) + Alpha (W).
   * Offset 68: Color suelo (RGB) + Alpha (W).
   */
  public setAtmosphere(sunColor: Float32Array, ambientInt: number, skyColor: Float32Array, groundColor: Float32Array): void {
    this.buffer[60] = sunColor[0];
    this.buffer[61] = sunColor[1];
    this.buffer[62] = sunColor[2];
    this.buffer[63] = ambientInt;

    this.buffer[64] = skyColor[0];
    this.buffer[65] = skyColor[1];
    this.buffer[66] = skyColor[2];
    this.buffer[67] = 1.0;

    this.buffer[68] = groundColor[0];
    this.buffer[69] = groundColor[1];
    this.buffer[70] = groundColor[2];
    this.buffer[71] = 1.0;
  }

  /**
   * Inyecta los coeficientes físicos para el SkyShader (Raymarching).
   * Offset 72: Rayleigh (RGB) + Mie (W)
   * Offset 76: PlanetRadius (X), AtmosphereRadius (Y), Pad (Z), Pad (W)
   */
  public setAtmospherePhysics(rayleigh: Float32Array, mie: number, planetR: number, atmosR: number): void {
    this.buffer[72] = rayleigh[0];
    this.buffer[73] = rayleigh[1];
    this.buffer[74] = rayleigh[2];
    this.buffer[75] = mie;
    this.buffer[76] = planetR;
    this.buffer[77] = atmosR;
    this.buffer[78] = 0.0;
    this.buffer[79] = 0.0;
  }

  public getSkyColorR(): number { return this.buffer[64]; }
  public getSkyColorG(): number { return this.buffer[65]; }
  public getSkyColorB(): number { return this.buffer[66]; }
}

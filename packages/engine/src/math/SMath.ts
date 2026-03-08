/**
 * SMath.ts - Módulo Matemático de Serion Engine.
 * Implementación optimizada de matrices 4x4 (Z-Up Standard).
 * Principio: Zero GC (Todas las funciones operan sobre Float32Array existentes).
 */

export class SMat4 {
  /**
   * Crea una matriz identidad.
   */
  public static identity(out: Float32Array): void {
    out.fill(0);
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
  }

  /**
   * Genera una matriz de perspectiva optimizada para WebGPU.
   * Coordinate System: Right-Handed, Z-Up (Inverted in View), Depth [0-1]
   */
  public static perspective(out: Float32Array, fovRad: number, aspect: number, near: number, far: number): void {
    const f = 1.0 / Math.tan(fovRad * 0.5);
    const nf = 1.0 / (near - far);

    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = far * nf;
    out[11] = -1;
    out[14] = near * far * nf;
  }

  /**
   * Genera una matriz de vista LookAt adaptada a Z-Up.
   */
  public static lookAt(out: Float32Array, eye: number[], target: number[], up: number[]): void {
    const eyex = eye[0], eyey = eye[1], eyez = eye[2];
    const upx = up[0], upy = up[1], upz = up[2];
    const tarx = target[0], tary = target[1], tarz = target[2];

    let z0 = eyex - tarx;
    let z1 = eyey - tary;
    let z2 = eyez - tarz;

    let len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len; z1 *= len; z2 *= len;

    let x0 = upy * z2 - upz * z1;
    let x1 = upz * z0 - upx * z2;
    let x2 = upx * z1 - upy * z0;

    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (!len) {
      x0 = 0; x1 = 0; x2 = 0;
    } else {
      len = 1 / len;
      x0 *= len; x1 *= len; x2 *= len;
    }

    let y0 = z1 * x2 - z2 * x1;
    let y1 = z2 * x0 - z0 * x2;
    let y2 = z0 * x1 - z1 * x0;

    len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
    if (!len) {
      y0 = 0; y1 = 0; y2 = 0;
    } else {
      len = 1 / len;
      y0 *= len; y1 *= len; y2 *= len;
    }

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;
  }

  /**
   * Multiplicación de matrices out = a * b.
   */
  public static multiply(out: Float32Array, a: Float32Array, b: Float32Array): void {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }

  /**
   * Construye una matriz 4x4 a partir de posición, cuaternión de rotación y escala.
   * out = translation * rotation * scale. (Column-Major)
   */
  public static fromRotationTranslationScale(out: Float32Array, q: number[] | Float32Array, v: number[] | Float32Array, s: number[] | Float32Array, outOffset = 0, qOffset = 0, vOffset = 0, sOffset = 0): void {
    // Quaternion math
    const x = q[qOffset], y = q[qOffset + 1], z = q[qOffset + 2], w = q[qOffset + 3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    const sx = s[sOffset], sy = s[sOffset + 1], sz = s[sOffset + 2];

    out[outOffset + 0] = (1 - (yy + zz)) * sx;
    out[outOffset + 1] = (xy + wz) * sx;
    out[outOffset + 2] = (xz - wy) * sx;
    out[outOffset + 3] = 0;

    out[outOffset + 4] = (xy - wz) * sy;
    out[outOffset + 5] = (1 - (xx + zz)) * sy;
    out[outOffset + 6] = (yz + wx) * sy;
    out[outOffset + 7] = 0;

    out[outOffset + 8] = (xz + wy) * sz;
    out[outOffset + 9] = (yz - wx) * sz;
    out[outOffset + 10] = (1 - (xx + yy)) * sz;
    out[outOffset + 11] = 0;

    out[outOffset + 12] = v[vOffset];
    out[outOffset + 13] = v[vOffset + 1];
    out[outOffset + 14] = v[vOffset + 2];
    out[outOffset + 15] = 1;
  }

  /**
   * Calcula la Transpuesta Inversa de una matriz 4x4 (Matriz Normal).
   * out = transpose(inverse(a)).
   */
  public static invertTranspose4x4(out: Float32Array, a: Float32Array, outOffset = 0, aOffset = 0): boolean {
    const a00 = a[aOffset + 0], a01 = a[aOffset + 1], a02 = a[aOffset + 2], a03 = a[aOffset + 3];
    const a10 = a[aOffset + 4], a11 = a[aOffset + 5], a12 = a[aOffset + 6], a13 = a[aOffset + 7];
    const a20 = a[aOffset + 8], a21 = a[aOffset + 9], a22 = a[aOffset + 10], a23 = a[aOffset + 11];
    const a30 = a[aOffset + 12], a31 = a[aOffset + 13], a32 = a[aOffset + 14], a33 = a[aOffset + 15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) {
      this.identity(out.subarray(outOffset, outOffset + 16));
      return false;
    }
    det = 1.0 / det;

    // Inverse Transpose components
    out[outOffset + 0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[outOffset + 4] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[outOffset + 8] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[outOffset + 12] = (a22 * b04 - a21 * b05 - a23 * b03) * det;

    out[outOffset + 1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[outOffset + 5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[outOffset + 9] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[outOffset + 13] = (a20 * b05 - a22 * b02 + a23 * b01) * det;

    out[outOffset + 2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[outOffset + 6] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[outOffset + 10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[outOffset + 14] = (a21 * b02 - a20 * b04 - a23 * b00) * det;

    out[outOffset + 3] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[outOffset + 7] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[outOffset + 11] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[outOffset + 15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return true;
  }
}

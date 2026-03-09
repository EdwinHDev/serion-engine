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
   * Genera una matriz ortográfica para WebGPU (Z-Up, Depth 0 to 1).
   */
  public static ortho(out: Float32Array, left: number, right: number, bottom: number, top: number, near: number, far: number, outOffset = 0): void {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    out[outOffset + 0] = -2 * lr;
    out[outOffset + 1] = 0;
    out[outOffset + 2] = 0;
    out[outOffset + 3] = 0;

    out[outOffset + 4] = 0;
    out[outOffset + 5] = -2 * bt;
    out[outOffset + 6] = 0;
    out[outOffset + 7] = 0;

    out[outOffset + 8] = 0;
    out[outOffset + 9] = 0;
    out[outOffset + 10] = nf;
    out[outOffset + 11] = 0;

    out[outOffset + 12] = (left + right) * lr;
    out[outOffset + 13] = (top + bottom) * bt;
    out[outOffset + 14] = near * nf;
    out[outOffset + 15] = 1;
  }

  /**
   * Genera una matriz de vista LookAt adaptada a Z-Up.
   */
  public static lookAt(out: Float32Array, eye: number[] | Float32Array, target: number[] | Float32Array, up: number[] | Float32Array, outOffset = 0): void {
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

    out[outOffset + 0] = x0; out[outOffset + 1] = y0; out[outOffset + 2] = z0; out[outOffset + 3] = 0;
    out[outOffset + 4] = x1; out[outOffset + 5] = y1; out[outOffset + 6] = z1; out[outOffset + 7] = 0;
    out[outOffset + 8] = x2; out[outOffset + 9] = y2; out[outOffset + 10] = z2; out[outOffset + 11] = 0;
    out[outOffset + 12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[outOffset + 13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[outOffset + 14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[outOffset + 15] = 1;
  }

  /**
   * Multiplicación de matrices out = a * b.
   */
  public static multiply(out: Float32Array, a: Float32Array, b: Float32Array, outOffset = 0, aOffset = 0, bOffset = 0): void {
    const a00 = a[aOffset + 0], a01 = a[aOffset + 1], a02 = a[aOffset + 2], a03 = a[aOffset + 3];
    const a10 = a[aOffset + 4], a11 = a[aOffset + 5], a12 = a[aOffset + 6], a13 = a[aOffset + 7];
    const a20 = a[aOffset + 8], a21 = a[aOffset + 9], a22 = a[aOffset + 10], a23 = a[aOffset + 11];
    const a30 = a[aOffset + 12], a31 = a[aOffset + 13], a32 = a[aOffset + 14], a33 = a[aOffset + 15];

    let b0 = b[bOffset + 0], b1 = b[bOffset + 1], b2 = b[bOffset + 2], b3 = b[bOffset + 3];
    out[outOffset + 0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[outOffset + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[outOffset + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[outOffset + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[bOffset + 4]; b1 = b[bOffset + 5]; b2 = b[bOffset + 6]; b3 = b[bOffset + 7];
    out[outOffset + 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[outOffset + 5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[outOffset + 6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[outOffset + 7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[bOffset + 8]; b1 = b[bOffset + 9]; b2 = b[bOffset + 10]; b3 = b[bOffset + 11];
    out[outOffset + 8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[outOffset + 9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[outOffset + 10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[outOffset + 11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[bOffset + 12]; b1 = b[bOffset + 13]; b2 = b[bOffset + 14]; b3 = b[bOffset + 15];
    out[outOffset + 12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[outOffset + 13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[outOffset + 14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[outOffset + 15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }

  /**
   * Construye una matriz 4x4 a partir de posición, cuaternión de rotación y escala.
   * out = translation * rotation * scale. (Column-Major)
   */
  public static fromRotationTranslationScale(out: Float32Array, q: number[] | Float32Array, v: number[] | Float32Array, s: number[] | Float32Array, outOffset = 0, qOffset = 0, vOffset = 0, sOffset = 0): void {
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

  /**
   * Inversión de matriz 4x4 general.
   */
  public static invert(out: Float32Array, a: Float32Array, outOffset = 0, aOffset = 0): boolean {
    const n11 = a[aOffset + 0], n12 = a[aOffset + 1], n13 = a[aOffset + 2], n14 = a[aOffset + 3];
    const n21 = a[aOffset + 4], n22 = a[aOffset + 5], n23 = a[aOffset + 6], n24 = a[aOffset + 7];
    const n31 = a[aOffset + 8], n32 = a[aOffset + 9], n33 = a[aOffset + 10], n34 = a[aOffset + 11];
    const n41 = a[aOffset + 12], n42 = a[aOffset + 13], n43 = a[aOffset + 14], n44 = a[aOffset + 15];

    const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
    const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
    const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
    const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;

    if (det === 0) return false;

    const invDet = 1.0 / det;

    out[outOffset + 0] = t11 * invDet;
    out[outOffset + 1] = t12 * invDet;
    out[outOffset + 2] = t13 * invDet;
    out[outOffset + 3] = t14 * invDet;

    out[outOffset + 4] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * invDet;
    out[outOffset + 5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * invDet;
    out[outOffset + 6] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * invDet;
    out[outOffset + 7] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * invDet;

    out[outOffset + 8] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * invDet;
    out[outOffset + 9] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * invDet;
    out[outOffset + 10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * invDet;
    out[outOffset + 11] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * invDet;

    out[outOffset + 12] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * invDet;
    out[outOffset + 13] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * invDet;
    out[outOffset + 14] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * invDet;
    out[outOffset + 15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * invDet;

    return true;
  }

  /**
   * Transforma un vector 3D por una matriz 4x4 (asumiendo W=1).
   */
  public static transformMat4(out: Float32Array, a: Float32Array, m: Float32Array, outOffset = 0, aOffset = 0, mOffset = 0): void {
    const x = a[aOffset + 0], y = a[aOffset + 1], z = a[aOffset + 2];
    let w = m[mOffset + 3] * x + m[mOffset + 7] * y + m[mOffset + 11] * z + m[mOffset + 15];
    w = w || 1.0;
    out[outOffset + 0] = (m[mOffset + 0] * x + m[mOffset + 4] * y + m[mOffset + 8] * z + m[mOffset + 12]) / w;
    out[outOffset + 1] = (m[mOffset + 1] * x + m[mOffset + 5] * y + m[mOffset + 9] * z + m[mOffset + 13]) / w;
    out[outOffset + 2] = (m[mOffset + 2] * x + m[mOffset + 6] * y + m[mOffset + 10] * z + m[mOffset + 14]) / w;
  }
}

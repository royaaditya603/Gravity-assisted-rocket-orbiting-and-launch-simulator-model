/**
 * High-performance 3D Vector for Headless Physics Simulation
 * Uses IEEE 754 Float64 precision for state vectors.
 */

export interface IVector3D {
  x: number;
  y: number;
  z: number;
}

export class Vector3D implements IVector3D {
  constructor(
    public x: number = 0.0,
    public y: number = 0.0,
    public z: number = 0.0
  ) {}

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(v: IVector3D): this {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  clone(): Vector3D {
    return new Vector3D(this.x, this.y, this.z);
  }

  add(v: IVector3D): this {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  addScaled(v: IVector3D, scale: number): this {
    this.x += v.x * scale;
    this.y += v.y * scale;
    this.z += v.z * scale;
    return this;
  }

  sub(v: IVector3D): this {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  subtract(v: IVector3D): Vector3D {
    return new Vector3D(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  scale(s: number): this {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  dot(v: IVector3D): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  magnitudeSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  magnitude(): number {
    return Math.sqrt(this.magnitudeSq());
  }

  normalize(): this {
    const mag = this.magnitude();
    if (mag > 0.0) {
      const inv = 1.0 / mag;
      this.x *= inv;
      this.y *= inv;
      this.z *= inv;
    }
    return this;
  }

  cross(v: IVector3D): this {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  static cross(a: IVector3D, b: IVector3D, target: Vector3D = new Vector3D()): Vector3D {
    return target.set(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }

  static dot(a: IVector3D, b: IVector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static distance(a: IVector3D, b: IVector3D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  static sub(a: IVector3D, b: IVector3D, target: Vector3D = new Vector3D()): Vector3D {
    return target.set(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  static add(a: IVector3D, b: IVector3D, target: Vector3D = new Vector3D()): Vector3D {
    return target.set(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }
}

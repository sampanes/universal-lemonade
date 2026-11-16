// src/bignum.ts — Pure Self-Contained BigNum Math (Supports numbers up to 10^9,000,000,000)

export class BigNum {
  public m: number; // Mantissa in [1, 10) or 0
  public e: number; // Integer exponent

  constructor(mantissa: number = 0, exponent: number = 0) {
    this.m = mantissa;
    this.e = exponent;
    this.normalize();
  }

  static fromNumber(n: number): BigNum {
    if (!Number.isFinite(n) || n === 0) return new BigNum(0, 0);
    return new BigNum(n, 0);
  }

  private normalize(): this {
    if (this.m === 0 || Number.isNaN(this.m)) {
      this.m = 0;
      this.e = 0;
      return this;
    }
    const sign = Math.sign(this.m);
    const absM = Math.abs(this.m);
    if (absM >= 10 || absM < 1) {
      const shift = Math.floor(Math.log10(absM));
      this.m = sign * (absM / Math.pow(10, shift));
      this.e += shift;
    }
    if (Math.abs(this.m) >= 9.999999999999) {
      this.m = sign * 1;
      this.e += 1;
    }
    return this;
  }

  clone(): BigNum {
    return new BigNum(this.m, this.e);
  }

  toNumber(): number {
    if (this.m === 0) return 0;
    if (this.e > 308) return Infinity * Math.sign(this.m);
    if (this.e < -308) return 0;
    return this.m * Math.pow(10, this.e);
  }

  log10(): number {
    if (this.m <= 0) return -Infinity;
    return Math.log10(this.m) + this.e;
  }

  add(other: BigNum | number): BigNum {
    const b = typeof other === 'number' ? BigNum.fromNumber(other) : other;
    if (this.m === 0) return b.clone();
    if (b.m === 0) return this.clone();
    const diff = this.e - b.e;
    if (diff > 15) return this.clone();
    if (diff < -15) return b.clone();
    return new BigNum(this.m + b.m * Math.pow(10, -diff), this.e);
  }

  sub(other: BigNum | number): BigNum {
    const b = typeof other === 'number' ? BigNum.fromNumber(other) : other;
    return this.add(new BigNum(-b.m, b.e));
  }

  mul(other: BigNum | number): BigNum {
    const b = typeof other === 'number' ? BigNum.fromNumber(other) : other;
    if (this.m === 0 || b.m === 0) return new BigNum(0, 0);
    return new BigNum(this.m * b.m, this.e + b.e);
  }

  div(other: BigNum | number): BigNum {
    const b = typeof other === 'number' ? BigNum.fromNumber(other) : other;
    if (b.m === 0) throw new Error('Division by zero in BigNum');
    if (this.m === 0) return new BigNum(0, 0);
    return new BigNum(this.m / b.m, this.e - b.e);
  }

  pow(power: number): BigNum {
    if (this.m === 0) return new BigNum(0, 0);
    if (power === 0) return new BigNum(1, 0);
    const logVal = this.log10() * power;
    const newExp = Math.floor(logVal);
    const newMant = Math.pow(10, logVal - newExp);
    return new BigNum(newMant, newExp);
  }

  cmp(other: BigNum | number): number {
    const b = typeof other === 'number' ? BigNum.fromNumber(other) : other;
    if (this.m === 0 && b.m === 0) return 0;
    const signA = Math.sign(this.m);
    const signB = Math.sign(b.m);
    if (signA !== signB) return signA > signB ? 1 : -1;
    if (this.e !== b.e) return (this.e > b.e ? 1 : -1) * signA;
    if (Math.abs(this.m - b.m) < 1e-12) return 0;
    return this.m > b.m ? 1 : -1;
  }

  gte(other: BigNum | number): boolean { return this.cmp(other) >= 0; }
  gt(other: BigNum | number): boolean { return this.cmp(other) > 0; }
  lte(other: BigNum | number): boolean { return this.cmp(other) <= 0; }
  lt(other: BigNum | number): boolean { return this.cmp(other) < 0; }

  format(decimals: number = 2): string {
    if (this.m === 0) return '0.00';
    if (this.e < 0) return this.toNumber().toFixed(decimals);
    if (this.e < 3) return this.toNumber().toFixed(decimals);
    const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    const tier = Math.floor(this.e / 3);
    if (tier < suffixes.length) {
      const scaled = this.m * Math.pow(10, this.e % 3);
      return `${scaled.toFixed(decimals)} ${suffixes[tier]}`;
    }
    return `${this.m.toFixed(decimals)}e${this.e}`;
  }
}

import { SysBuf } from "./ebx-buf.js";

// big integers, positive or negative, encoded as big endian, two's complement
export class ScriptNum {
  num: bigint;

  constructor(num: bigint = BigInt(0)) {
    this.num = num;
  }

  static fromNumber(num: number): ScriptNum {
    const scriptNum = new ScriptNum();
    scriptNum.num = BigInt(num);
    return scriptNum;
  }

  static fromBuf(buffer: SysBuf): ScriptNum {
    const scriptNum = new ScriptNum();
    if (buffer.length === 0) {
      scriptNum.num = 0n;
      return scriptNum;
    }
    const isNegative = buffer[0] & 0x80; // Check if the sign bit is set
    if (isNegative) {
      // If the number is negative
      const invertedEbxBuf = SysBuf.alloc(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        invertedEbxBuf[i] = ~buffer[i]; // Invert all bits
      }
      const invertedBigInt = BigInt("0x" + invertedEbxBuf.toString("hex"));
      scriptNum.num = -(invertedBigInt + 1n); // Add one and negate to get the original number
    } else {
      // If the number is positive
      scriptNum.num = BigInt("0x" + buffer.toString("hex"));
    }
    return scriptNum;
  }

  toBuf(): SysBuf {
    const num = this.num;
    if (num === 0n) {
      return SysBuf.alloc(0);
    } else if (num > 0n) {
      let hex = num.toString(16);
      if (hex.length % 2 !== 0) {
        hex = "0" + hex; // Pad with zero to make length even
      }
      // If the most significant bit is set, add an extra zero byte at the start
      if (parseInt(hex[0], 16) >= 8) {
        hex = "00" + hex;
      }
      return SysBuf.from(hex, "hex");
    } else {
      const bitLength = num.toString(2).length; // Get bit length of number
      const byteLength = Math.ceil(bitLength / 8); // Calculate byte length, rounding up to nearest byte
      const twosComplement = 2n ** BigInt(8 * byteLength) + num; // Calculate two's complement
      let hex = twosComplement.toString(16);
      if (hex.length % 2 !== 0) {
        hex = "0" + hex; // Pad with zero to make length even
      }
      return SysBuf.from(hex, "hex");
    }
  }

  toStr(): string {
    return this.num.toString();
  }

  static fromStr(str: string): ScriptNum {
    const scriptNum = new ScriptNum();
    scriptNum.num = BigInt(str);
    return scriptNum;
  }

  toU32(): number {
    return Number(this.num);
  }
}

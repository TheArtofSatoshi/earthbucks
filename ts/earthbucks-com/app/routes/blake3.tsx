import type { MetaFunction } from "@remix-run/node";
import Button from "../button";
import { createHash, hash as blake3Hash } from "blake3";
import { Buffer } from "buffer";
import * as tf from "@tensorflow/tfjs";

type BufferFunction = (input: Buffer) => Buffer;

function nodeBlake3Hash(data: Buffer): Buffer {
  const hasher = createHash();
  hasher.update(data);
  return Buffer.from(hasher.digest());
}

class Matmul {
  seed: Buffer;
  blake3Hash: BufferFunction;

  constructor(seed: Buffer, blake3Hash: BufferFunction) {
    this.seed = seed;
    this.blake3Hash = blake3Hash;
  }
  async createBinaryMatrixArr(size: number): Promise<number[]> {
    let matrixData: number[] = [];
    let currentHash = this.blake3Hash(this.seed);
    let hashIter = currentHash.values();

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        let byte = hashIter.next().value;
        if (byte === undefined) {
          currentHash = Buffer.from(currentHash);
          hashIter = currentHash.values();
          byte = hashIter.next().value;
        }
        for (let bit = 7; bit >= 0; bit--) {
          let value = (byte >> bit) & 1;
          matrixData.push(value);
          if (matrixData.length >= size * size) {
            break;
          }
        }
        if (matrixData.length >= size * size) {
          break;
        }
      }
      if (matrixData.length >= size * size) {
        break;
      }
    }

    return matrixData
  }

  async createBinaryMatrix(size: number): Promise<tf.Tensor> {
    let matrixData: number[] = [];
    let currentHash = this.blake3Hash(this.seed);
    let hashIter = currentHash.values();

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        let byte = hashIter.next().value;
        if (byte === undefined) {
          currentHash = Buffer.from(currentHash);
          hashIter = currentHash.values();
          byte = hashIter.next().value;
        }
        for (let bit = 7; bit >= 0; bit--) {
          let value = (byte >> bit) & 1;
          matrixData.push(value);
          if (matrixData.length >= size * size) {
            break;
          }
        }
        if (matrixData.length >= size * size) {
          break;
        }
      }
      if (matrixData.length >= size * size) {
        break;
      }
    }

    // tensorflow doesn't support uint16, but it does support int32
    return tf.tensor2d(matrixData, [size, size], "int32");
  }

  async squareMatrix(matrix: tf.Tensor): Promise<tf.Tensor> {
    return tf.matMul(matrix, matrix);
  }

  async cubeMatrix(matrix: tf.Tensor): Promise<tf.Tensor> {
    return tf.matMul(matrix, await this.squareMatrix(matrix));
  }

  async matmul256(): Promise<Buffer> {
    let matrix = await this.createBinaryMatrix(256);
    let squared = await this.squareMatrix(matrix);
    let squaredBufU16 = squared.dataSync();
    let squaredBufU8: number[] = [];

    for (let x of squaredBufU16) {
      squaredBufU8.push(x & 0xff);
      squaredBufU8.push(x >> 8);
    }

    return this.blake3Hash(Buffer.from(squaredBufU8));
  }

  async matmul400(): Promise<Buffer> {
    let matrix = await this.createBinaryMatrix(400);
    let squared = await this.squareMatrix(matrix);
    let squaredBufU16 = squared.dataSync();
    let squaredBufU8: number[] = [];

    for (let x of squaredBufU16) {
      squaredBufU8.push(x & 0xff);
      squaredBufU8.push(x >> 8);
    }

    return this.blake3Hash(Buffer.from(squaredBufU8));
  }

  async matmul512(): Promise<Buffer> {
    let matrix = await this.createBinaryMatrix(512);
    let squared = await this.squareMatrix(matrix);
    let squaredBufU16 = squared.dataSync();
    let squaredBufU8: number[] = [];

    for (let x of squaredBufU16) {
      squaredBufU8.push(x & 0xff);
      squaredBufU8.push(x >> 8);
    }

    return this.blake3Hash(Buffer.from(squaredBufU8));
  }

  async matmul1024(): Promise<Buffer> {
    let matrix = await this.createBinaryMatrix(1024);
    let squared = await this.squareMatrix(matrix);
    let squaredBufU16 = squared.dataSync();
    let squaredBufU8: number[] = [];

    for (let x of squaredBufU16) {
      squaredBufU8.push(x & 0xff);
      squaredBufU8.push(x >> 8);
    }

    return this.blake3Hash(Buffer.from(squaredBufU8));
  }

  async matcube256(): Promise<Buffer> {
    let matrix = await this.createBinaryMatrix(256);
    let cubed = await this.cubeMatrix(matrix);
    let cubedBufU16 = cubed.dataSync();
    let cubedBufU8: number[] = [];

    for (let x of cubedBufU16) {
      cubedBufU8.push(x & 0xff);
      cubedBufU8.push(x >> 8);
    }

    return this.blake3Hash(Buffer.from(cubedBufU8));
  }

  async matcube400(): Promise<Buffer> {
    let matrix = await this.createBinaryMatrix(400);
    let cubed = await this.cubeMatrix(matrix);
    let cubedBufU16 = cubed.dataSync();
    let cubedBufU8: number[] = [];

    for (let x of cubedBufU16) {
      cubedBufU8.push(x & 0xff);
      cubedBufU8.push(x >> 8);
    }

    return this.blake3Hash(Buffer.from(cubedBufU8));
  }

  async matcube512(): Promise<Buffer> {
    let matrix = await this.createBinaryMatrix(512);
    let cubed = await this.cubeMatrix(matrix);
    let cubedBufU16 = cubed.dataSync();
    let cubedBufU8: number[] = [];

    for (let x of cubedBufU16) {
      cubedBufU8.push(x & 0xff);
      cubedBufU8.push(x >> 8);
    }

    return this.blake3Hash(Buffer.from(cubedBufU8));
  }

  async matcube1009(): Promise<Buffer> {
    // - 1009 is the smallest prime number greater than 1000. this eliminates
    //   symmetry when wrapping the pseudorandom hash.
    // - 1009 also works when stored in int32 for cubes (tensorflow default, and
    //   smallest computational unit)
    //   - maximum value == 1009^3 == 1,027,243,729
    //   - maximum int32 value     == 2,147,483,647
    // - finally, cubing rather than squaring means there is less data sent to
    //   the GPU per amount of computation, maximizing the computation on the
    //   GPU rather than memory bandwidth. (cubing is no worse than a power of
    //   four, because you can optimize that with a square and a square. powers
    //   greater than 3 become a game of optimizin the order of operations
    //   rather than just raw computation.)
    let matrix = await this.createBinaryMatrix(1009);
    let cubed = await this.cubeMatrix(matrix);
    let cubedBufU16 = cubed.dataSync();
    let cubedBufU8: number[] = [];

    for (let x of cubedBufU16) {
      cubedBufU8.push(x & 0xff);
      cubedBufU8.push(x >> 8);
    }

    return this.blake3Hash(Buffer.from(cubedBufU8));
  }

  async matcube1289(): Promise<Buffer> {
    // 1289 is the smallest prime number whose cube fits in int32
    // 1289 ^ 3 = 2141700569
    // maxint32 = 2147483647
    let matrix = await this.createBinaryMatrix(1289);
    let cubed = await this.cubeMatrix(matrix);
    let cubedBufU16 = cubed.dataSync();
    let cubedBufU8: number[] = [];

    for (let x of cubedBufU16) {
      cubedBufU8.push(x & 0xff);
      cubedBufU8.push(x >> 8);
    }

    return this.blake3Hash(Buffer.from(cubedBufU8));
  }
}

export const meta: MetaFunction = () => {
  return [
    { title: "EarthBucks" },
    { name: "description", content: "Welcome to EarthBucks!" },
  ];
};

export default function Landing() {
  if (typeof document === "undefined") {
    // running in a server environment
    // const res = blake3Hash(Buffer.from("test"));
    // const buf = Buffer.from(res);
    // console.log(buf.toString("hex"));
  } else {
    // running in a browser environment
    import("blake3/browser").then(async ({ createHash, hash: blake3Hash }) => {
      function delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
      await delay(1000);
      let browserBlake3Hash = (data: Buffer) => {
        const hasher = createHash();
        hasher.update(data);
        return Buffer.from(hasher.digest());
      };
      console.log('begin')
      // matcube1009
      {
        let seed = Buffer.from("seed");
        let matmul = new Matmul(seed, browserBlake3Hash);
        console.time("create 1009 matrix arr");
        let matrixn = await matmul.createBinaryMatrixArr(1009);
        console.timeEnd("create 1009 matrix arr");
        console.time("create 1009 matrix");
        let matrix = await matmul.createBinaryMatrix(1009);
        console.timeEnd("create 1009 matrix");
        console.time("matcube1009");
        let res = await matmul.matcube1009();
        console.timeEnd("matcube1009");
        // console.log(res.toString("hex"));
      }
      // matcube1289
      {
        let seed = Buffer.from("seed");
        let matmul = new Matmul(seed, browserBlake3Hash);
        console.time("create 1289 matrix arr");
        let matrixn = await matmul.createBinaryMatrixArr(1289);
        console.timeEnd("create 1289 matrix arr");
        console.time("create 1289 matrix");
        let matrix = await matmul.createBinaryMatrix(1289);
        console.timeEnd("create 1289 matrix");
        console.time("matcube1289");
        let res = await matmul.matcube1289();
        console.timeEnd("matcube1289");
        // console.log(res.toString("hex"));
      }
      console.log('end')

    });
  }
  return (
    <div className="">
      <div className="mb-4 mt-4 flex">
        <div className="mx-auto">
          <div className="inline-block align-middle">
            <img
              src="/earthbucks-coin.png"
              alt=""
              className="mx-auto mb-4 block h-[200px] w-[200px] rounded-full bg-[#6d3206] shadow-lg shadow-[#6d3206]"
            />
            <div className="hidden dark:block">
              <img
                src="/earthbucks-text-white.png"
                alt="EarthBucks"
                className="mx-auto block h-[50px]"
              />
            </div>
            <div className="block dark:hidden">
              <img
                src="/earthbucks-text-black.png"
                alt="EarthBucks"
                className="mx-auto block h-[50px]"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mb-4 mt-4 text-center text-black dark:text-white">
        42 trillion EBX. No pre-mine. GPUs. Big blocks. Script.
        <br />
        <br />
        Take the math test to register or log in.
      </div>
      <div className="mb-4 mt-4 h-[80px]">
        <div className="mx-auto w-[320px]">
          <Button initialText="Compute" />
        </div>
      </div>
    </div>
  );
}

import { BufReader } from "@webbuf/rw";
import { BufWriter } from "@webbuf/rw";
import { Hash } from "./hash.js";
import type { WebBuf } from "@webbuf/webbuf";
import { FixedBuf } from "@webbuf/fixedbuf";
import { U8, U16BE, U32BE, U64BE, U256BE } from "@webbuf/numbers";
import { WORK_SER_ALGO_NUM, WORK_SER_ALGO_NAME } from "./work-ser-algo.js";
import { WORK_PAR_ALGO_NUM, WORK_PAR_ALGO_NAME } from "./work-par-algo.js";
import { Tx } from "./tx.js";
import { Domain } from "./domain.js";
import { ScriptChunk } from "./script-chunk.js";
import { Err, Ok, Result } from "@ryanxcharles/result";

interface HeaderInterface {
  version: U8;
  prevBlockId: FixedBuf<32>;
  rootMerkleTreeId: FixedBuf<32>;
  nTransactions: U64BE;
  timestamp: U64BE;
  blockNum: U32BE;
  target: U256BE;
  nonce: U256BE;
  workSerAlgo: U16BE;
  workSerHash: FixedBuf<32>;
  workParAlgo: U16BE;
  workParHash: FixedBuf<32>;
}

export class Header implements HeaderInterface {
  version: U8;
  prevBlockId: FixedBuf<32>;
  rootMerkleTreeId: FixedBuf<32>;
  nTransactions: U64BE;
  timestamp: U64BE; // milliseconds
  blockNum: U32BE;
  target: U256BE;
  nonce: U256BE;
  workSerAlgo: U16BE;
  workSerHash: FixedBuf<32>;
  workParAlgo: U16BE;
  workParHash: FixedBuf<32>;

  // 600_000 milliseconds = 600 seconds = 10 minutes
  static readonly BLOCK_INTERVAL_MS = new U64BE(600_000);
  static readonly N_BLOCKS_180D = (180 * 24 * 60) / 10;
  static readonly N_BLOCKS_90D = (90 * 24 * 60) / 10;
  static readonly MIN_DIFFICULTY = new U64BE(2_000);
  static readonly GENESIS_DIFFICULTY = new U64BE(2_000);
  static readonly SIZE = 1 + 32 + 32 + 8 + 8 + 4 + 32 + 32 + 2 + 32 + 2 + 32;
  static readonly MAX_TARGET_BYTES = FixedBuf.alloc(32, 0xff);
  static readonly MAX_TARGET_U256 = U256BE.fromBEBuf(Header.MAX_TARGET_BYTES);
  static readonly GENESIS_TARGET = Header.targetFromDifficulty(
    Header.GENESIS_DIFFICULTY,
  );

  constructor({
    version = new U8(0),
    prevBlockId = FixedBuf.alloc(32),
    rootMerkleTreeId = FixedBuf.alloc(32),
    nTransactions = new U64BE(0),
    timestamp = new U64BE(0),
    blockNum = new U32BE(0),
    target = new U256BE(0),
    nonce = new U256BE(0),
    workSerAlgo = new U16BE(0),
    workSerHash = FixedBuf.alloc(32),
    workParAlgo = new U16BE(0),
    workParHash = FixedBuf.alloc(32),
  }: Partial<HeaderInterface> = {}) {
    this.version = version;
    this.prevBlockId = prevBlockId;
    this.rootMerkleTreeId = rootMerkleTreeId;
    this.nTransactions = nTransactions;
    this.timestamp = timestamp;
    this.blockNum = blockNum;
    this.target = target;
    this.nonce = nonce;
    this.workSerAlgo = workSerAlgo;
    this.workSerHash = workSerHash;
    this.workParAlgo = workParAlgo;
    this.workParHash = workParHash;
  }

  toBuf(): WebBuf {
    return this.toBufWriter(new BufWriter()).toBuf();
  }

  static fromBuf(buf: WebBuf): Header {
    return Header.fromBufReader(new BufReader(buf));
  }

  static fromBufReader(br: BufReader): Header {
    const version = br.readU8();
    const prevBlockId = br.readFixed(32);
    const merkleRoot = br.readFixed(32);
    const nTransactions = br.readU64BE();
    const timestamp = br.readU64BE();
    const blockNum = br.readU32BE();
    const target = br.readU256BE();
    const nonce = br.readU256BE();
    const workSerAlgo = br.readU16BE();
    const workSerHash = br.readFixed(32);
    const workParAlgo = br.readU16BE();
    const workParHash = br.readFixed(32);
    return new Header({
      version,
      prevBlockId,
      rootMerkleTreeId: merkleRoot,
      nTransactions,
      timestamp,
      blockNum,
      target,
      nonce,
      workSerAlgo,
      workSerHash,
      workParAlgo,
      workParHash,
    });
  }

  toBufWriter(bw: BufWriter): BufWriter {
    bw.writeU8(this.version);
    bw.write(this.prevBlockId.buf);
    bw.write(this.rootMerkleTreeId.buf);
    bw.writeU64BE(this.nTransactions);
    bw.writeU64BE(this.timestamp);
    bw.writeU32BE(this.blockNum);
    bw.writeU256BE(this.target);
    bw.writeU256BE(this.nonce);
    bw.writeU16BE(this.workSerAlgo);
    bw.write(this.workSerHash.buf);
    bw.writeU16BE(this.workParAlgo);
    bw.write(this.workParHash.buf);
    return bw;
  }

  toHex(): string {
    return this.toBuf().toString("hex");
  }

  static fromHex(str: string): Header {
    return Header.fromBuf(FixedBuf.fromHex(Header.SIZE, str).buf);
  }

  toString(): string {
    return this.toHex();
  }

  static fromString(str: string): Header {
    return Header.fromHex(str);
  }

  isTargetValid(prevHeader: Header, prevPrevHeader: Header | null): boolean {
    let newTarget: U256BE;
    try {
      const timestamp = this.timestamp;
      newTarget = Header.newTargetFromPrevHeaders(
        prevHeader,
        prevPrevHeader,
        timestamp,
      );
    } catch (e) {
      return false;
    }
    return this.target.bn === newTarget.bn;
  }

  isIdValid(): boolean {
    const id = this.id();
    const idNum = U256BE.fromBEBuf(id);
    return idNum.bn < this.target.bn;
  }

  isVersionValid(): boolean {
    return this.version.n === 0;
  }

  isTimestampValidAt(timestamp: U64BE): boolean {
    return this.timestamp.n <= timestamp.n;
  }

  isTimestampValidNow(): boolean {
    return this.isTimestampValidAt(Header.getNewTimestamp());
  }

  isWorkSerAlgoValid(): boolean {
    return (
      this.workSerAlgo.n === WORK_SER_ALGO_NUM.null ||
      this.workSerAlgo.n === WORK_SER_ALGO_NUM.blake3_3
    );
  }

  isWorkParAlgoValid(): boolean {
    return (
      this.workParAlgo.n === WORK_PAR_ALGO_NUM.algo1627 ||
      this.workParAlgo.n === WORK_PAR_ALGO_NUM.pow5
    );
  }

  setWorkSer(
    workSerAlgoStr: "blake3_3" | "null",
    workSerHash: FixedBuf<32>,
  ): Header {
    const workSerAlgo = new U16BE(WORK_SER_ALGO_NUM[workSerAlgoStr]);
    return new Header({
      ...this,
      workSerAlgo,
      workSerHash,
    });
  }

  setWorkPar(
    workParAlgoStr: "algo1627" | "pow5",
    workParHash: FixedBuf<32>,
  ): Header {
    const workParAlgo = new U16BE(WORK_PAR_ALGO_NUM[workParAlgoStr]);
    return new Header({
      ...this,
      workParAlgo,
      workParHash,
    });
  }

  /** set both work par and work ser to null byte arrays */
  setBlankWorkSerAndWorkPar(): Header {
    return new Header({
      ...this,
      workSerHash: FixedBuf.alloc(32),
      workParHash: FixedBuf.alloc(32),
    });
  }

  setTimestamp(timestamp: U64BE): Header {
    return new Header({
      ...this,
      timestamp,
    });
  }

  setTimestampAndTargetTo(
    prevHeader: Header,
    prevPrevHeader: Header | null,
    timestamp: U64BE,
  ): Header {
    const newTarget = Header.newTargetFromPrevHeaders(
      prevHeader,
      prevPrevHeader,
      timestamp,
    );
    return new Header({
      ...this,
      timestamp,
      target: newTarget,
    });
  }

  setTimestampAndTargetToNow(
    prevHeader: Header,
    prevPrevHeader: Header | null,
  ): Header {
    const timestamp = Header.getNewTimestamp();
    return this.setTimestampAndTargetTo(prevHeader, prevPrevHeader, timestamp);
  }

  setNonce(nonce: U256BE): Header {
    return new Header({
      ...this,
      nonce,
    });
  }

  setRandomNonce(): Header {
    return new Header({
      ...this,
      nonce: U256BE.fromBEBuf(FixedBuf.fromRandom(32)),
    });
  }

  setFirst4BytesofNonce(smallNonce: U32BE): Header {
    const nonce = this.nonce.toBEBuf().clone();
    const bytes = smallNonce.toBEBuf().buf;
    nonce.buf.set(bytes, 0);
    return new Header({
      ...this,
      nonce: U256BE.fromBEBuf(nonce),
    });
  }

  resIsValidInChain(
    prevHeader: Header | null,
    prevPrevHeader: Header | null,
    actualNTransactions: U64BE,
  ): Result<true> {
    if (this.nTransactions.n === 0) {
      return Err("nTransactions is 0");
    }
    if (this.nTransactions.n !== actualNTransactions.n) {
      return Err("nTransactions does not match actual number of transactions");
    }
    if (!this.isIdValid()) {
      return Err("id is not valid");
    }
    if (!this.isVersionValid()) {
      return Err("version is not valid");
    }
    if (this.blockNum.bn === 0n) {
      if (this.isGenesis()) {
        return Ok(true);
      }
      return Err("genesis is not valid");
    }
    if (!prevHeader) {
      return Err("prevHeader is null");
    }
    if (this.blockNum.n !== prevHeader.blockNum.n + 1) {
      return Err("blockNum is not valid");
    }
    if (!this.prevBlockId.buf.equals(prevHeader.id().buf)) {
      return Err("prevBlockId is not valid");
    }
    if (this.timestamp.n <= prevHeader.timestamp.n) {
      return Err("timestamp is not valid");
    }
    if (!this.isTargetValid(prevHeader, prevPrevHeader)) {
      return Err("target is not valid");
    }
    if (!this.isWorkSerAlgoValid()) {
      return Err("workSerAlgo is not valid");
    }
    if (!this.isWorkParAlgoValid()) {
      return Err("workParAlgo is not valid");
    }
    return Ok(true);
  }

  resIsValidAt(
    prevHeader: Header | null,
    prevPrevHeader: Header | null,
    actualNTransactions: U64BE,
    timestamp: U64BE,
  ): Result<true> {
    // this validates everything about the header except PoW
    // PoW must be validated using a separate library
    if (!this.isTimestampValidAt(timestamp)) {
      return Err("timestamp is not valid");
    }
    return this.resIsValidInChain(
      prevHeader,
      prevPrevHeader,
      actualNTransactions,
    );
  }

  resIsValidNow(
    prevHeader: Header | null,
    prevPrevHeader: Header | null,
    actualNTransactions: U64BE,
  ): Result<true> {
    return this.resIsValidAt(
      prevHeader,
      prevPrevHeader,
      actualNTransactions,
      Header.getNewTimestamp(),
    );
  }

  isGenesis(): boolean {
    return (
      this.idNum().bn < Header.GENESIS_TARGET.bn &&
      this.target.bn === Header.GENESIS_TARGET.bn &&
      this.blockNum.bn === 0n &&
      this.prevBlockId.buf.every((byte) => byte === 0) &&
      this.workSerAlgo.n === WORK_SER_ALGO_NUM.blake3_3 &&
      this.workParAlgo.n === WORK_PAR_ALGO_NUM.algo1627
    );
  }

  static fromGenesis(
    merkleRoot: FixedBuf<32>,
    initialTarget: U256BE = Header.GENESIS_TARGET,
  ): Header {
    const timestamp = new U64BE(Math.floor(Date.now())); // milliseconds
    const nonce = U256BE.fromBEBuf(FixedBuf.fromRandom(32));
    return new Header({
      version: new U8(0),
      prevBlockId: FixedBuf.alloc(32),
      rootMerkleTreeId: merkleRoot,
      nTransactions: new U64BE(1), // genesis block has 1 transaction
      timestamp,
      blockNum: new U32BE(0n),
      target: initialTarget,
      nonce,

      // this is for testing. the actual genesis was blake3_3 work ser
      workSerAlgo: new U16BE(WORK_SER_ALGO_NUM.null),
      workSerHash: FixedBuf.alloc(32),

      // this is for testing. the actual genesis was algo1627 work par
      workParAlgo: new U16BE(WORK_PAR_ALGO_NUM.pow5),
      workParHash: FixedBuf.alloc(32),
    });
  }

  isEmpty(): boolean {
    return this.rootMerkleTreeId.buf.every((byte) => byte === 0);
  }

  hash(): FixedBuf<32> {
    return Hash.blake3Hash(this.toBuf());
  }

  id(): FixedBuf<32> {
    return Hash.doubleBlake3Hash(this.toBuf());
  }

  idNum(): U256BE {
    return U256BE.fromBEBuf(this.id());
  }

  static getNewTimestamp(): U64BE {
    return new U64BE(Math.floor(Date.now()));
  }

  static fromChain(
    prevHeader: Header,
    prevPrevHeader: Header | null,
    merkleRoot: FixedBuf<32>,
    nTransactions: U64BE,
    newTimestamp: U64BE,
  ): Header {
    const target = Header.newTargetFromPrevHeaders(
      prevHeader,
      prevPrevHeader,
      newTimestamp,
    );
    const prevBlockId = prevHeader.id();
    const blockNum = prevHeader.blockNum.add(new U32BE(1));
    const timestamp = newTimestamp;
    const nonce = new U256BE(0);
    const workSerAlgo = new U16BE(WORK_SER_ALGO_NUM.null);
    const workSerHash = FixedBuf.alloc(32);
    const workParAlgo = new U16BE(WORK_PAR_ALGO_NUM.pow5);
    const workParHash = FixedBuf.alloc(32);
    return new Header({
      version: new U8(0),
      prevBlockId,
      rootMerkleTreeId: merkleRoot,
      nTransactions,
      timestamp,
      blockNum,
      target,
      nonce,
      workSerAlgo,
      workSerHash,
      workParAlgo,
      workParHash,
    });
  }

  static newTargetFromPrevHeaders(
    prevHeader: Header,
    prevPrevHeader: Header | null,
    newTimestamp: U64BE = Header.getNewTimestamp(),
  ): U256BE {
    const newDifficulty = Header.newDifficultyFromPrevHeaders(
      prevHeader,
      prevPrevHeader,
      newTimestamp,
    );
    return Header.targetFromDifficulty(newDifficulty);
  }

  static newDifficultyFromPrevHeaders(
    prevHeader: Header,
    prevPrevHeader: Header | null,
    newTimestamp: U64BE = Header.getNewTimestamp(),
  ): U64BE {
    if (!prevPrevHeader) {
      return prevHeader.difficulty();
    }
    const prevTimeDiff = prevHeader.timestamp.n - prevPrevHeader.timestamp.n;
    const prevDifficulty = prevHeader.difficulty().n;
    const idealTimeDiff = Header.BLOCK_INTERVAL_MS.n;

    // First, we want to adjust the difficulty based on the time difference
    // between the previous block and the block before that. This is to ensure
    // that the difficulty adjusts correctly if the time difference between
    // blocks is greater or less than the ideal time difference of 10 minutes.
    let newDifficulty = (prevDifficulty * idealTimeDiff) / prevTimeDiff;

    // Next, we want to incentivize miners to mine at the ideal time interval of
    // 10 minutes per block. We can do this by adjusting the difficulty based on
    // how close the time difference is to the ideal time difference. We can use
    // an exponential decay function to adjust the difficulty based on the time
    // difference ratio. It is more difficult to mine a block if the time
    // difference is less than the ideal time difference, and less difficult if
    // the time difference is greater than the ideal time difference.

    // Exponential decay function parameters
    const m = 10; // Maximum adjustment factor
    const k = Math.log(m); // Steepness of the curve

    // Calculate the time difference ratio
    const timeDiffRatio =
      (newTimestamp.n - prevHeader.timestamp.n) / idealTimeDiff;

    // Calculate the adjustment factor using the logistic function
    const adjustmentFactor = Math.exp(-k * (timeDiffRatio - 1));

    // Apply the adjustment factor to the difficulty
    newDifficulty = newDifficulty * adjustmentFactor;
    newDifficulty = Math.max(newDifficulty, Header.MIN_DIFFICULTY.n);

    return new U64BE(Math.floor(newDifficulty));
  }

  static mintTxAmount(blockNum: U32BE): U64BE {
    // shift every 210,000 blocks ("halving")
    const shiftBy = blockNum.bn / 210_000n;
    // BTC: 100_000_000 satoshis = 1 bitcoin
    // 100 bitcoins per block for the first 210,000 blocks
    // 100 million satoshis per block for the first 210,000 blocks
    // EBX: 100_000_000_000 adams = 1 earthbuck
    // 100 earthbucks per block for the first 210,000 blocks
    // 100 billion adams per block for the first 210,000 blocks
    return new U64BE((100n * 100_000_000_000n) >> shiftBy);
  }

  static difficultyFromTarget(target: U256BE): U64BE {
    const maxTargetBuf = Header.MAX_TARGET_BYTES;
    const maxTarget = Header.MAX_TARGET_U256;
    return new U64BE(maxTarget.div(target).bn);
  }

  static targetFromDifficulty(difficulty: U64BE): U256BE {
    const maxTargetBuf = Header.MAX_TARGET_BYTES;
    const maxTarget = Header.MAX_TARGET_U256;
    return maxTarget.div(new U256BE(difficulty.bn));
  }

  difficulty(): U64BE {
    return Header.difficultyFromTarget(this.target);
  }

  workSerAlgoStr(): string {
    const str = WORK_SER_ALGO_NAME[this.workSerAlgo.n];
    if (!str) {
      throw new Error("unknown workSerAlgo");
    }
    return str;
  }

  workParAlgoStr(): string {
    const str = WORK_PAR_ALGO_NAME[this.workParAlgo.n];
    if (!str) {
      throw new Error("unknown workParAlgo");
    }
    return str;
  }

  addTx(merkleRoot: FixedBuf<32>, timestamp: U64BE | null = null): Header {
    const nTransactions = new U64BE(this.nTransactions.bn + 1n);
    return new Header({
      ...this,
      nTransactions,
      rootMerkleTreeId: merkleRoot,
      timestamp: timestamp || this.timestamp,
    });
  }

  toWorkingHeader(): Header {
    const workingHeader = new Header({
      ...this,
      workSerHash: FixedBuf.alloc(32),
      workParHash: FixedBuf.alloc(32),
    });
    return workingHeader;
  }

  resHasValidMintTx(mintTx: Tx): Result<true> {
    // 1. mint tx is the last tx
    if (!mintTx.isMintTx()) {
      return Err("not a mint tx");
    }
    // 2. lockNum equals block number
    if (mintTx.lockAbs.bn !== this.blockNum.bn) {
      return Err("lockNum does not match block number");
    }
    // 3. version is 1
    if (mintTx.version.n !== 0) {
      return Err("version is not 0");
    }
    // 4. all outputs are pkh
    for (const txOutput of mintTx.outputs) {
      if (!txOutput.script.isStandardOutput()) {
        return Err("output is not standard");
      }
    }
    // 5. output amount is correct
    let totalOutputValue = new U64BE(0);
    for (const output of mintTx.outputs) {
      totalOutputValue = totalOutputValue.add(output.value);
    }
    const expectedMintAmount = Header.mintTxAmount(this.blockNum);
    if (totalOutputValue.bn !== expectedMintAmount.bn) {
      return Err("output amount does not match expected mint amount");
    }
    // 6. mint tx script is valid (push only)
    const mintInput = mintTx.inputs[0];
    if (!mintInput) {
      return Err("no inputs");
    }
    const mintScript = mintInput.script;
    if (!mintScript.isPushOnly()) {
      return Err("script is not push only");
    }
    // 7. must have at least two script chunks
    const scriptChunks = mintScript.chunks;
    if (scriptChunks.length < 2) {
      return Err("not enough script chunks");
    }
    // 8. domain name, top of the stack, is valid
    const domainChunk = scriptChunks[scriptChunks.length - 1] as ScriptChunk;
    const domainBuf = domainChunk.buf;
    if (!domainBuf) {
      return Err("no domain buf");
    }
    const domainStr = domainBuf.toUtf8();
    if (!Domain.isValidDomain(domainStr)) {
      return Err("domain is not valid");
    }
    // 9. block message, ID, second from top of stack, is valid FixedBuf<32>
    if (scriptChunks.length < 2) {
      return Err("no block message script chunk");
    }
    const idChunk = scriptChunks[scriptChunks.length - 2] as ScriptChunk;
    const idBuf = idChunk.buf;
    if (!idBuf) {
      return Err("no block message id buf");
    }
    if (idBuf.length !== 32) {
      return Err("block message id buf length is not 32");
    }
    // note that we do not verify whether domain is actually responsive and
    // delivers this block. that would require pinging the domain name,
    // which is done elsewhere.
    return Ok(true);
  }

  clone(): Header {
    return new Header({
      version: new U8(this.version.n),
      prevBlockId: this.prevBlockId.clone(),
      rootMerkleTreeId: this.rootMerkleTreeId.clone(),
      nTransactions: new U64BE(this.nTransactions.bn),
      timestamp: new U64BE(this.timestamp.bn),
      blockNum: new U32BE(this.blockNum.bn),
      target: new U256BE(this.target.bn),
      nonce: new U256BE(this.nonce.bn),
      workSerAlgo: new U16BE(this.workSerAlgo.n),
      workSerHash: this.workSerHash.clone(),
      workParAlgo: new U16BE(this.workParAlgo.n),
      workParHash: this.workParHash.clone(),
    });
  }
}

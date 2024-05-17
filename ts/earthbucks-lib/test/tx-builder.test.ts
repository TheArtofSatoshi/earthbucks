import { describe, expect, test, beforeEach, it } from "@jest/globals";
import TxBuilder from "../src/tx-builder";
import TxOutMap from "../src/tx-out-map";
import TxOut from "../src/tx-out";
import Script from "../src/script";
import KeyPair from "../src/key-pair";
import Pkh from "../src/pkh";
import PkhKeyMap from "../src/pkh-key-map";
import { Buffer } from "buffer";

describe("TxBuilder", () => {
  let txBuilder: TxBuilder;
  let txOutMap: TxOutMap;
  let pkhKeyMap: PkhKeyMap;

  beforeEach(() => {
    txOutMap = new TxOutMap();
    pkhKeyMap = new PkhKeyMap();
    // generate 5 keys, 5 outputs, and add them to the txOutMap
    for (let i = 0; i < 5; i++) {
      const key = KeyPair.fromRandom();
      const pkh = Pkh.fromPubKeyBuf(Buffer.from(key.pubKey.toIsoBuf()));
      pkhKeyMap.add(key, pkh.buf);
      const script = Script.fromPkhOutput(pkh.buf);
      const output = new TxOut(BigInt(100), script);
      txOutMap.add(output, Buffer.from("00".repeat(32), "hex"), i);
    }

    const changeScript = Script.fromIsoStr("").unwrap();
    txBuilder = new TxBuilder(txOutMap, changeScript, 0n, 0n);
  });

  test("should build a valid tx when input is enough to cover the output", () => {
    const key = KeyPair.fromRandom();
    const pkh = Pkh.fromPubKeyBuf(Buffer.from(key.pubKey.toIsoBuf()));
    const script = Script.fromPkhOutput(pkh.buf);
    const output = new TxOut(BigInt(50), script);
    txBuilder.addOutput(BigInt(50), Script.fromIsoStr("").unwrap());

    const tx = txBuilder.build();

    expect(tx.inputs.length).toBe(1);
    expect(tx.outputs.length).toBe(2);
    expect(tx.outputs[0].value).toBe(BigInt(50));
  });

  test("should build an invalid tx when input is insufficient to cover the output", () => {
    txBuilder.addOutput(BigInt(10000), Script.fromIsoStr("").unwrap());

    const tx = txBuilder.build();

    expect(tx.inputs.length).toBe(5);
    expect(tx.outputs.length).toBe(1);
    expect(txBuilder.inputAmount).toBe(BigInt(500));
    expect(tx.outputs[0].value).toBe(BigInt(10000));
  });
});

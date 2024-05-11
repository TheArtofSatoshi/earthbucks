import Tx from "./tx";
import PkhKeyMap from "./pkh-key-map";
import TxOutMap from "./tx-out-map";
import TxSignature from "./tx-signature";
import { Buffer } from "buffer";

export default class TxSigner {
  public tx: Tx;
  public pkhKeyMap: PkhKeyMap;
  public txOutMap: TxOutMap;

  constructor(tx: Tx, txOutMap: TxOutMap, pkhKeyMap: PkhKeyMap) {
    this.tx = tx;
    this.txOutMap = txOutMap;
    this.pkhKeyMap = pkhKeyMap;
  }

  sign(nIn: number): boolean {
    const txInput = this.tx.inputs[nIn];
    const txOutHash = txInput.inputTxId;
    const outputIndex = txInput.inputTxNOut;
    const txOut = this.txOutMap.get(txOutHash, outputIndex);
    if (!txOut) {
      return false;
    }
    if (!txOut.script.isPkhOutput()) {
      return false;
    }
    const pkh = txOut.script.chunks[2].buf as Buffer;
    const inputScript = txInput.script;
    if (!inputScript.isPkhInput()) {
      return false;
    }
    const key = this.pkhKeyMap.get(pkh);
    if (!key) {
      return false;
    }
    const pubKey = key.pubKey.toIsoBuf();
    if (pubKey.length !== 33) {
      return false;
    }
    inputScript.chunks[1].buf = Buffer.from(pubKey);
    const outputScriptBuf = txOut.script.toIsoBuf();
    const outputAmount = txOut.value;
    const sig = this.tx.signNoCache(
      nIn,
      key.privKey.toIsoBuf(),
      outputScriptBuf,
      outputAmount,
      TxSignature.SIGHASH_ALL,
    );
    const sigBuf = sig.toIsoBuf();
    if (sigBuf.length !== 65) {
      return false;
    }
    inputScript.chunks[0].buf = Buffer.from(sigBuf);
    txInput.script = inputScript;
    return true;
  }

  signAll(): boolean {
    for (let i = 0; i < this.tx.inputs.length; i++) {
      if (!this.sign(i)) {
        return false;
      }
    }
    return true;
  }
}

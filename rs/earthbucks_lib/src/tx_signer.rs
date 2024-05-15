use crate::pkh_key_map::PkhKeyMap;
use crate::pub_key::PubKey;
use crate::tx::Tx;
use crate::tx_out_map::TxOutMap;
use crate::tx_signature::TxSignature;

pub struct TxSigner {
    pub tx: Tx,
    pub pkh_key_map: PkhKeyMap,
    pub tx_out_map: TxOutMap,
}

impl TxSigner {
    pub fn new(tx: Tx, tx_out_map: &TxOutMap, pkh_key_map: &PkhKeyMap) -> Self {
        Self {
            tx,
            tx_out_map: tx_out_map.clone(),
            pkh_key_map: pkh_key_map.clone(),
        }
    }

    pub fn sign(&mut self, n_in: usize) -> bool {
        let mut tx_clone = self.tx.clone();
        let tx_input = &mut tx_clone.inputs[n_in];
        let tx_out_hash = &tx_input.input_tx_id;
        let output_index = tx_input.input_tx_out_num;
        let tx_out = match self.tx_out_map.get(tx_out_hash, output_index) {
            Some(tx_out) => tx_out,
            None => return false,
        };
        if !tx_out.script.is_pkh_output() {
            return false;
        }
        let pkh = match &tx_out.script.chunks[2].buffer {
            Some(pkh) => pkh,
            None => return false,
        };
        let input_script = &mut tx_input.script;
        if !input_script.is_pkh_input() {
            return false;
        }
        let key = match self.pkh_key_map.get(pkh) {
            Some(key) => key,
            None => return false,
        };
        let pub_key = &key.pub_key.buf.to_vec();
        if pub_key.len() != PubKey::SIZE {
            return false;
        }
        input_script.chunks[1].buffer = Some(pub_key.clone());
        let output_script_buf = tx_out.script.to_iso_buf();
        let output_amount = tx_out.value;
        let private_key_array = key.priv_key.buf;
        let sig = self.tx.sign_no_cache(
            n_in,
            private_key_array,
            output_script_buf.to_vec(),
            output_amount,
            TxSignature::SIGHASH_ALL,
        );
        let sig_buf = sig.to_iso_buf();
        if sig_buf.len() != TxSignature::SIZE {
            return false;
        }
        input_script.chunks[0].buffer = Some(sig_buf);
        tx_input.script = input_script.clone();
        self.tx = tx_clone;
        true
    }

    pub fn sign_all(&mut self) -> bool {
        for i in 0..self.tx.inputs.len() {
            if !self.sign(i) {
                return false;
            }
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::key_pair::KeyPair;
    use crate::pkh::Pkh;
    use crate::pkh_key_map::PkhKeyMap;
    use crate::script::Script;
    use crate::script_interpreter::ScriptInterpreter;
    use crate::tx::HashCache;
    use crate::tx_builder::TxBuilder;
    use crate::tx_out::TxOut;

    #[test]
    fn should_sign_a_tx() {
        let mut tx_out_map = TxOutMap::new();
        let mut pkh_key_map = PkhKeyMap::new();

        // generate 5 keys, 5 outputs, and add them to the txOutMap
        for i in 0..5 {
            let key = KeyPair::from_random();
            let pkh = Pkh::from_pub_key_buffer(key.pub_key.buf.to_vec());
            pkh_key_map.add(key.clone(), &pkh.buf.clone());
            let script = Script::from_pkh_output(&pkh.buf.clone());
            let output = TxOut::new(100, script);
            tx_out_map.add(vec![0; 32].as_slice(), i, output);
        }

        let mut tx_builder = TxBuilder::new(&tx_out_map, Script::from_empty(), 0);
        let tx_out = TxOut::new(50, Script::from_empty());
        tx_builder.add_output(tx_out);

        let tx = tx_builder.build();

        assert_eq!(tx.inputs.len(), 1);
        assert_eq!(tx.outputs.len(), 2);
        assert_eq!(tx.outputs[0].value, 50);

        let mut tx_signer = TxSigner::new(tx.clone(), &tx_out_map, &pkh_key_map);
        let signed = tx_signer.sign(0);
        let signed_tx = tx_signer.tx;
        assert!(signed);

        let tx_input = &signed_tx.inputs[0];
        let tx_output = tx_out_map
            .get(&tx_input.input_tx_id.clone(), tx_input.input_tx_out_num)
            .unwrap();
        let exec_script = tx_output.script.clone();
        let sig_buf = tx_input.script.chunks[0].buffer.clone().unwrap();
        assert_eq!(sig_buf.len(), TxSignature::SIZE);
        let pub_key_buf = tx_input.script.chunks[1].buffer.clone().unwrap();
        assert_eq!(pub_key_buf.len(), PubKey::SIZE);

        let stack = vec![sig_buf, pub_key_buf];

        let mut hash_cache = HashCache::new();
        let mut script_interpreter = ScriptInterpreter::from_output_script_tx(
            exec_script,
            signed_tx,
            0,
            stack,
            100,
            &mut hash_cache,
        );

        let result = script_interpreter.eval_script();
        assert!(result);
    }

    #[test]
    fn should_sign_two_inputs() {
        let mut tx_out_map = TxOutMap::new();
        let mut pkh_key_map = PkhKeyMap::new();

        // generate 5 keys, 5 outputs, and add them to the txOutMap
        for i in 0..5 {
            let key = KeyPair::from_random();
            let pkh = Pkh::from_pub_key_buffer(key.pub_key.buf.to_vec());
            pkh_key_map.add(key.clone(), &pkh.buf.clone());
            let script = Script::from_pkh_output(&pkh.buf.clone());
            let output = TxOut::new(100, script);
            tx_out_map.add(vec![0; 32].as_slice(), i, output);
        }

        let mut tx_builder = TxBuilder::new(&tx_out_map, Script::from_empty(), 0);
        let tx_out = TxOut::new(100, Script::from_empty());
        tx_builder.add_output(tx_out.clone());
        tx_builder.add_output(tx_out.clone());

        let tx = tx_builder.build();

        assert_eq!(tx.inputs.len(), 2);
        assert_eq!(tx.outputs.len(), 2);
        assert_eq!(tx.outputs[0].value, 100);
        assert_eq!(tx.outputs[1].value, 100);

        let mut tx_signer = TxSigner::new(tx.clone(), &tx_out_map, &pkh_key_map);
        let signed1 = tx_signer.sign(0);
        let signed2 = tx_signer.sign(1);
        let signed_tx = tx_signer.tx;
        assert!(signed1);
        assert!(signed2);

        let tx_input_1 = &signed_tx.inputs[0];
        let tx_output_1 = tx_out_map
            .get(&tx_input_1.input_tx_id.clone(), tx_input_1.input_tx_out_num)
            .unwrap();
        let exec_script_1 = tx_output_1.script.clone();
        let sig_buf_1 = tx_input_1.script.chunks[0].buffer.clone().unwrap();
        assert_eq!(sig_buf_1.len(), TxSignature::SIZE);
        let pub_key_buf_1 = tx_input_1.script.chunks[1].buffer.clone().unwrap();
        assert_eq!(pub_key_buf_1.len(), PubKey::SIZE);

        let stack_1 = vec![sig_buf_1, pub_key_buf_1];

        let mut hash_cache = HashCache::new();
        let mut script_interpreter_1 = ScriptInterpreter::from_output_script_tx(
            exec_script_1,
            signed_tx.clone(),
            0,
            stack_1,
            100,
            &mut hash_cache,
        );

        let result_1 = script_interpreter_1.eval_script();
        assert!(result_1);

        let tx_input_2 = &signed_tx.inputs[1];
        let tx_output_2 = tx_out_map
            .get(&tx_input_2.input_tx_id.clone(), tx_input_2.input_tx_out_num)
            .unwrap();
        let exec_script_2 = tx_output_2.script.clone();
        let sig_buf_2 = tx_input_2.script.chunks[0].buffer.clone().unwrap();
        assert_eq!(sig_buf_2.len(), TxSignature::SIZE);
        let pub_key_buf_2 = tx_input_2.script.chunks[1].buffer.clone().unwrap();
        assert_eq!(pub_key_buf_2.len(), PubKey::SIZE);

        let stack_2 = vec![sig_buf_2, pub_key_buf_2];
        let mut hash_cache = HashCache::new();

        let mut script_interpreter_2 = ScriptInterpreter::from_output_script_tx(
            exec_script_2,
            signed_tx.clone(),
            1,
            stack_2,
            100,
            &mut hash_cache,
        );

        let result_2 = script_interpreter_2.eval_script();
        assert!(result_2);
    }
}

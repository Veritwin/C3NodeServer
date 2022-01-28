/**
 * Created by claudio on 2022-01-01
 */
const bitcoinLib = require('bitcoinjs-lib');

const outputType = {
  P2WPKH: 'witnesspubkeyhash',
  P2WSH: 'witnessscripthash',
  P2PKH: 'pubkeyhash',
  P2SH: 'scripthash',
  P2MS: 'multisig',
  P2PK: 'pubkey',
  NULLDATA: 'nulldata',
  NONSTANDARD: 'nonstandard',
};

function classify(outputScript) {
  function isPayment(script, payment) {
    try {
      payment({output: script});
      return true;
    }
    catch (err) {
      return false;
    }
  }

  function isMultiSigScript(script) {
    const chunks = bitcoinLib.script.decompile(script);
    const OPS = bitcoinLib.script.OPS;
    let m;
    let n;

    return typeof (m = chunks[0] - OPS.OP_RESERVED) === 'number'
      && typeof (n = chunks[chunks.length - 2] - OPS.OP_RESERVED) === 'number'
      && chunks[chunks.length - 1] === OPS.OP_CHECKMULTISIG
      && m > 0 && n <= 16 && m <= n && n === chunks.length - 3
      && chunks.slice(1, -2).every(pk =>
            (pk.length === 33 && (pk[0] === 0x02 || pk[0] === 0x03))
            || (pk.length === 65 && pk[0] === 0x04)
      );
  }

  const payments = bitcoinLib.payments;

  if (isPayment(outputScript, payments.p2wpkh)) return outputType.P2WPKH;
  if (isPayment(outputScript, payments.p2wsh)) return outputType.P2WSH;
  if (isPayment(outputScript, payments.p2pkh)) return outputType.P2PKH;
  if (isPayment(outputScript, payments.p2sh)) return outputType.P2SH;

  // Note: we cannot use 'payments' to validate multisig outputs because it will not accept fabricated public keys,
  //    which are used by the Colored Coins protocol
  if (isMultiSigScript(outputScript)) return outputType.P2MS;

  if (isPayment(outputScript, payments.p2pk)) return outputType.P2PK;
  if (isPayment(outputScript, payments.embed)) return outputType.NULLDATA;

  return outputType.NONSTANDARD;
}

module.exports = {
  outputType,
  classify
};
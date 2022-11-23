// TODO: isolate blockchain parsing code and place it in a separate process started as a subprocess of the (main) server process. Then all parse control should be done via that subprocess
const ccProtocol = 0x4343; // Original Colored Coins protocol
const c3Protocol = 0x4333; // Catenis Colored Coins protocol
var async = require('async')
var CCTransaction = require('catenis-colored-coins/cc-transaction')
var getAssetsOutputs = require('catenis-colored-coins/cc-get-assets-outputs')
var bitcoinjs = require('bitcoinjs-lib')
var bufferReverse = require('buffer-reverse')
var _ = require('lodash')
var toposort = require('toposort')
var redisClient = require('redis')
var bitcoinRpc = require('bitcoin-async')
const ClassifyTxOut = require('./ClassifyTxOut');
const ipfsHttpClient = require('ipfs-http-client').create;
const { CID } = require('ipfs-http-client');
const toBuffer = require('it-to-buffer');
const assetIdEncoder = require('catenis-colored-coins/cc-assetid-encoder');
var events = require('events')
var path = require('path-extra')
var BigNumber = require('bignumber.js');

var mainnetFirstColoredBlock = 364548
var testnetFirstColoredBlock = 462320
var regtestFirstColoredBlock = 1;

var blockStates = {
  NOT_EXISTS: 0,
  GOOD: 1,
  FORKED: 2
}

var label = 'cc-full-node'

var ParseControl = require(path.join(__dirname, '/../src/ParseControl.js'))
var parseControl


module.exports = function (args) {
  parseControl = new ParseControl(!!args.parser.parseControlLoggingOn)

  args = args || {}
  var network = args.network || 'testnet'
  var bitcoinNetwork = (network === 'mainnet') ? bitcoinjs.networks.bitcoin : (network === 'regtest' ? bitcoinjs.networks.regtest : bitcoinjs.networks.testnet)
  var redisOptions = {
    host: args.redisHost || 'localhost',
    port: args.redisPort || '6379',
    prefix: 'c3nodeserv:' + network + ':'
  }
  var redis = redisClient.createClient(redisOptions)

  var bitcoinOptions = {
    host: args.bitcoinHost || 'localhost',
    port: args.bitcoinPort || '18332',
    user: args.bitcoinUser || 'rpcuser',
    pass: args.bitcoinPass || 'rpcpass',
    path: args.bitcoinPath || '/',
    timeout: args.bitcoinTimeout || 30000
  }
  var bitcoin = new bitcoinRpc.Client(bitcoinOptions)

  const ipfsClientOptions = {
    host: args.ipfsHost || 'localhost',
    port: args.ipfsPort || 9095,
    protocol: args.ipfsProtocol || 'http'
  };
  const ipfs = ipfsHttpClient(ipfsClientOptions);

  var emitter = new events.EventEmitter()

  var info = {
    bitcoindbusy: true
  }

  var waitForBitcoind = function (cb) {
    if (!info.bitcoindbusy) return cb()
    return setTimeout(function() {
      console.log('Waiting for bitcoind...')
      bitcoin.cmd('getblockchaininfo', [], function (err) {
        if (err) {
          info.error = {}
          if (err.code) {
            info.error.code = err.code
          }
          if (err.message) {
            info.error.message = err.message
          }
          if (!err.code && !err.message) {
            info.error = err
          }
          return waitForBitcoind(cb)
        }
        delete info.error
        info.bitcoindbusy = false
        cb()
      })
    }, 5000)
  }

  var getNextBlockHeight = function (cb) {
    redis.hget('blocks', 'lastBlockHeight', function (err, lastBlockHeight) {
      if (err) return cb(err)
      lastBlockHeight = parseInt(lastBlockHeight || ((network === 'mainnet' ? mainnetFirstColoredBlock : (network === 'regtest' ? regtestFirstColoredBlock : testnetFirstColoredBlock)) - 1))
      cb(null, lastBlockHeight + 1)
    })
  }

  var getNextBlock = function (height, cb) {
    bitcoin.cmd('getblockhash', [height], function (err, hash) {
      if (err) {
        if (err.code && err.code === -8) {
          return cb(null, null)
        }
        return cb(err)
      }
      bitcoin.cmd('getblock', [hash, false], function (err, rawBlock) {
        if (err) return cb(err)
        var block = bitcoinjs.Block.fromHex(rawBlock)
        block.height = height
        block.hash = hash
        block.previousblockhash = bufferReverse(block.prevHash).toString('hex')

        var transactions = [];
        block.mapTransaction = {};

        async.eachSeries(block.transactions, (transaction, cb2) => {
          // Call 'decodeRawTransaction' asynchronously (with a callback) to include colored coins data
          decodeRawTransaction(transaction, (err, decTransact) => {
            if (err) {
              console.error(new Date().toISOString(), '-', 'Error decoding raw transaction:', transaction, err);
            }
            else {
              transactions.push(decTransact);
              block.mapTransaction[decTransact.txid] = decTransact;
            }

            cb2();
          });
        }, err => {
          if (err) {
            return cb(err);
          }

          block.transactions = transactions;
          cb(null, block);
        });
      })
    })
  }

  var checkNextBlock = function (block, cb) {
    if (!block) return cb(null, blockStates.NOT_EXISTS, block)
    redis.hget('blocks', block.height - 1, function (err, hash) {
      if (!hash || hash === block.previousblockhash) return cb(null, blockStates.GOOD, block)
      cb(null, blockStates.FORKED, block)
    })
  }

  var revertBlock = function (blockHeight, cb) {
    console.log('forking block', blockHeight)
    updateLastBlock(blockHeight - 1, cb)
  }

  var conditionalParseNextBlock = function (state, block, cb) {
    if (state === blockStates.NOT_EXISTS) {
      return mempoolParse(cb)
    }
    // console.log('block', block.hash, block.height, 'txs:', block.transactions.length, 'state', state)
    if (state === blockStates.GOOD) {
      return parseNewBlock(block, cb)
    }
    if (state === blockStates.FORKED) {
      return revertBlock(block.height - 1, cb)
    }
    cb('Unknown block state')
  }

  const protocolToHex = function (value) {
    return Buffer.from(new Uint8Array([value >> 8, value]).buffer).toString('hex')
  };

  const checkProtocol = function (hex) {
    const hexProtocol = hex.toString('hex').substring(0, 4).toLowerCase();
    return (hexProtocol === protocolToHex(ccProtocol) || hexProtocol === protocolToHex(c3Protocol));
  };

  var getColoredData = function (transaction, cb) {
    var coloredData = null
    transaction.vout.some(function (vout) {
      if (!vout.scriptPubKey || !vout.scriptPubKey.type === 'nulldata') return null;
      var hex = vout.scriptPubKey.asm.substring('OP_RETURN '.length)
      if (checkProtocol(hex)) {
        try {
          coloredData = CCTransaction.fromHex(hex).toJson()
        } catch (e) {
          console.log('Invalid CC transaction.', e)
        }
      }
      return coloredData
    })

    if (coloredData && coloredData.protocol === c3Protocol && (coloredData.cid || coloredData.multiSig.length > 0)) {
      try {
        const cid = assembleCid(coloredData, transaction);

        // Retrieve metadata from IPFS
        toBuffer(ipfs.cat(CID.decode(cid)))
        .then(metadata => {
          metadata = Buffer.from(metadata);
          // Add metadata to colored coins data
          try {
            coloredData.metadata = JSON.parse(metadata.toString());
          }
          catch (err) {
            return cb(new Error('Metadata is not a valid JSON'));
          }

          cb(null, coloredData);
        })
        .catch(err => {
          cb(err);
        });
      }
      catch (err) {
        process.nextTick(cb, err);
      }
    }
    else {
      process.nextTick(cb, null, coloredData);
    }
  }

  /**
   * Extract the IPFS CID of the metadata from the colored coins data encoded in a transaction
   * @param {Object} ccData The colored coins data
   * @param {Object} transaction The bitcoin transaction that contains the colored coins data
   * @return {Buffer} The extracted IPFS CID
   */
  function assembleCid(ccData, transaction) {
    let cid = ccData.cid ? Buffer.from(ccData.cid, 'hex') : Buffer.alloc(0);

    if (ccData.multiSig.length > 0) {
      // Find multisig output
      const msOutput = transaction.vout.find(out => out.scriptPubKey && out.scriptPubKey.type === 'multisig');

      if (!msOutput) {
        throw new Error('Transaction missing multisig output to recover CID');
      }

      // Parse multisig output and get public keys
      const publicKeys = bitcoinjs.payments.p2ms({
        output: Buffer.from(msOutput.scriptPubKey.hex, 'hex'),
        network: bitcoinNetwork
      }, {validate: false}).pubkeys;

      // Get remainder of CID from multisig outputs
      let cidLeftLength;

      ccData.multiSig.forEach((multiSigInfo, idx) => {
        const publicKey = publicKeys[multiSigInfo.index];

        if (!publicKey) {
          throw new Error('Not enough keys in multisig output to recover CID');
        }

        let keyData = publicKey.slice(1);

        if (idx === 0) {
          // Get length of part of CID stored in multisig output
          cidLeftLength = keyData[keyData.length - 1];
          keyData = keyData.slice(0, keyData.length - 1);
        }

        const cidPart = keyData.slice(-cidLeftLength);
        cidLeftLength -= cidPart.length;

        cid = Buffer.concat([cid, cidPart], cid.length + cidPart.length);
      });
    }

    return cid;
  }

  var getPreviousOutputs = function(transaction, cb) {
    var prevTxs = []

    transaction.vin.forEach(function(vin) {
      prevTxs.push(vin)
    })

    var prevOutsBatch = prevTxs.map(function(vin) { return { 'method': 'getrawtransaction', 'params': [vin.txid] } })
    bitcoin.cmd(prevOutsBatch, function (rawTransaction, cb) {
      var prevTx = decodeRawTransaction(bitcoinjs.Transaction.fromHex(rawTransaction))
      var txid = prevTx.id
      prevTxs.forEach(function(vin) {
        vin.previousOutput = prevTx.vout[vin.vout]
        if(vin.previousOutput && vin.previousOutput.scriptPubKey && vin.previousOutput.scriptPubKey.addresses) {
          vin.previousOutput.addresses = vin.previousOutput.scriptPubKey.addresses
        }
      })
      cb()
    }, function(err) {
      if (err) return cb(err)
      transaction.fee = transaction.vin.reduce(function(sum, vin) {
        if (vin.previousOutput) {
          return sum + vin.previousOutput.value
        }
        return sum
      }, 0) - transaction.vout.reduce(function(sum, vout) { return sum + vout.value }, 0)
      transaction.totalsent = transaction.vin.reduce(function(sum, vin) {
        if (vin.previousOutput) {
          return sum + vin.previousOutput.value
        }
        return sum
      }, 0)
      cb(null, transaction)
    })
  }

  var parseTransaction = function (transaction, utxosChanges, blockHeight, cb) {
    async.each(transaction.vin, function (input, cb) {
      var previousOutput = input.txid + ':' + input.vout
      if (utxosChanges.unused[previousOutput]) {
        input.assets = JSON.parse(utxosChanges.unused[previousOutput])
        return process.nextTick(cb)
      }
      redis.hget('utxos', previousOutput, function (err, assets) {
        if (err) return cb(err)
        input.assets = assets && JSON.parse(assets) || []
        if (input.assets.length) {
          utxosChanges.used[previousOutput] = assets
        }
        cb()
      })
    }, function (err) {
      if (err) return cb(err)
      var outputsAssets = getAssetsOutputs(transaction, bitcoinNetwork)
      outputsAssets.forEach(function (assets, outputIndex) {
        if (assets && assets.length) {
          utxosChanges.unused[transaction.txid + ':' + outputIndex] = JSON.stringify(assets)
        }
      })

      const metadata = getCCMetadata(transaction);

      if (metadata) {
        // Save asset/non-fungible tokens metadata
        if (!utxosChanges.metadata) {
          utxosChanges.metadata = metadata;
        }
        else {
          if (metadata.asset) {
            if (!utxosChanges.metadata.asset) {
              utxosChanges.metadata.asset = metadata.asset;
            }
            else {
              Object.keys(metadata.asset).forEach(assetId => {
                utxosChanges.metadata.asset[assetId] = metadata.asset[assetId];
              });
            }
          }

          if (metadata.nonFungibleToken) {
            if (!utxosChanges.metadata.nonFungibleToken) {
              utxosChanges.metadata.nonFungibleToken = metadata.nonFungibleToken;
            }
            else {
              Object.keys(metadata.nonFungibleToken).forEach(tokenId => {
                utxosChanges.metadata.nonFungibleToken[tokenId] = metadata.nonFungibleToken[tokenId];
              });
            }
          }
        }
      }

      emitter.emit('newcctransaction', transaction)
      emitter.emit('newtransaction', transaction)
      cb()
    })
  }

  /**
   * Colored Coins metadata structure
   * @typedef {Object} CCMetadata
   * @property {Object.<string, Object>} [asset] Dictionary of metadata by asset IDs
   * @property {Object.<string, Object>} [nonFungibleToken] Dictionary of metadata by non-fungible token IDs
   */

  /**
   * Retrieve the asset and/or non-fungible token metadata contained in a colored coins transaction
   * @param {Object} transaction The colored coins transaction (containing the already decoded colored coins data)
   * @return {(CCMetadata|undefined)} The retrieved metadata or undefined if no metadata found
   */
  function getCCMetadata(transaction) {
    let ccData;
    let metadata;

    if (transaction.ccdata && (ccData = transaction.ccdata[0]) && (ccData.type === 'issuance'
          || ccData.type === 'transfer') && (metadata = ccData.metadata)) {
      const ccMetadata = {};

      if (ccData.type === 'issuance' && metadata.metadata) {
        // Asset metadata. Get asset ID
        const assetId = assetIdEncoder(transaction, bitcoinNetwork);
        ccMetadata.asset = {};
        ccMetadata.asset[assetId] = metadata.metadata;
      }

      if (ccData.protocol === c3Protocol && metadata.nfTokenMetadata) {
        // Non-fungible token metadata
        const nfTokenMetadata = metadata.nfTokenMetadata;
        const nfTokenCCMetadata = {};

        if (ccData.type === 'issuance' && ccData.aggregationPolicy === 'nonFungible'
              && Array.isArray(nfTokenMetadata.newTokens)) {
          // Metadata for new non-fungible tokens. Get token IDs
          const tokenIds = assetIdEncoder(transaction, bitcoinNetwork, true);

          nfTokenMetadata.newTokens.forEach((tokenMetadata, idx) => {
            const tokenId = tokenIds[idx];

            if (tokenId) {
              nfTokenCCMetadata[tokenId] = tokenMetadata;
            }
          });
        }

        if (typeof nfTokenMetadata.update === 'object' && nfTokenMetadata.update !== null) {
          Object.keys(nfTokenMetadata.update).forEach(tokenId => {
            nfTokenCCMetadata[tokenId] = nfTokenMetadata.update[tokenId];
          });
        }

        if (Object.keys(nfTokenCCMetadata).length > 0) {
          ccMetadata.nonFungibleToken = nfTokenCCMetadata;
        }
      }

      if (Object.keys(ccMetadata).length > 0) {
        return ccMetadata;
      }
    }
  }

  var setTxos = function (utxos, cb) {
    async.each(Object.keys(utxos), function (utxo, cb) {
      var assets = utxos[utxo]
      redis.hmset('utxos', utxo, assets, cb)
    }, cb)
  }

  /**
   * Record metadata associated with assets to local Redis database
   * @param {Object.<string, Object>} metadata A dictionary of metadata by asset IDs
   * @param {Function} cb A callback function
   */
  function setAssetMetadata(metadata, cb) {
    async.each(Object.keys(metadata), (id, cb) => {
      redis.hset('asset-metadata', id, JSON.stringify(metadata[id]), cb);
    }, cb);
  }

  /**
   * Record metadata associated with non-fungible tokens to local Redis database
   * @param {Object.<string, Object>} metadata A dictionary of metadata by non-fungible token IDs
   * @param {Function} cb A callback function
   */
  function setNFTokenMetadata(metadata, cb) {
    async.each(Object.keys(metadata), (id, cb) => {
      redis.hset('nftoken-metadata', id, JSON.stringify(metadata[id]), cb);
    }, cb);
  }

  var updateLastBlock = function (blockHeight, blockHash, timestamp, cb) {
    if (typeof blockHash === 'function') {
      return redis.hmset('blocks', 'lastBlockHeight', blockHeight, blockHash)
    }
    redis.hmset('blocks', blockHeight, blockHash, 'lastBlockHeight', blockHeight, 'lastTimestamp', timestamp, function (err) {
      cb(err)
    })
  }

  var updateUtxosChanges = function (block, utxosChanges, cb) {
    async.waterfall([
      function (cb) {
        var assetIdAddresses = {};
        const tokenIdAddresses = {};
        const tokenIdIssuance = {};
        var assetIdIssuanceInfo = {};
        var txidTxouts = {};
        var addressTxouts = {};
        var hasTxout = false;

        Object.keys(utxosChanges.unused).forEach(function (txout) {
          hasTxout = true;

          // Get addresses associated with transaction output
          var parts = txout.split(':');
          var txid = parts[0];
          var addresses = block.mapTransaction[txid].vout[parts[1]].scriptPubKey.addresses;

          // Get assets information
          var assetInfos = JSON.parse(utxosChanges.unused[txout]);
          var assetIdAssetInfo = {};

          assetInfos.forEach(function (assetInfo) {
            assetIdAssetInfo[assetInfo.assetId] = assetInfo;

            if (assetInfo.tokenId) {
              // Record issuance info (asset ID, and issuing tx ID) of non-fungible token
              if (!(assetInfo.tokenId in tokenIdIssuance)) {
                tokenIdIssuance[assetInfo.tokenId] = {
                  assetId: assetInfo.assetId,
                  txid: assetInfo.issueTxid
                };
              }

              // Identify addresses associated with non-fungible tokens
              if (!(assetInfo.tokenId in tokenIdAddresses)) {
                tokenIdAddresses[assetInfo.tokenId] = addresses;
              }
              else {
                tokenIdAddresses[assetInfo.tokenId] = mergeArrays(tokenIdAddresses[assetInfo.tokenId], addresses);
              }
            }
          });

          Object.keys(assetIdAssetInfo).forEach(function (assetId) {
            // Identify addresses associated with assets
            if (!(assetId in assetIdAddresses)) {
              assetIdAddresses[assetId] = addresses;
            }
            else {
              assetIdAddresses[assetId] = mergeArrays(assetIdAddresses[assetId], addresses);
            }

            // Identify issuing transactions associated with assets
            var assetInfo = assetIdAssetInfo[assetId];

            if (!(assetInfo.assetId in assetIdIssuanceInfo)) {
              assetIdIssuanceInfo[assetInfo.assetId] = {};
            }

            assetIdIssuanceInfo[assetInfo.assetId][assetInfo.issueTxid] = {
              divisibility: assetInfo.divisibility,
              lockStatus: assetInfo.lockStatus,
              aggregationPolicy: assetInfo.aggregationPolicy
            };
          });

          // Identify tx outputs associated with transactions
          if (!(txid in txidTxouts)) {
            txidTxouts[txid] = [txout];
          }
          else {
            txidTxouts[txid].push(txout);
          }

          // Identify tx outputs associated with addresses
          addresses.forEach(function(address) {
            if (!(address in addressTxouts)) {
              addressTxouts[address] = [txout];
            }
            else if (addressTxouts[address].indexOf(txout) === -1) {
              addressTxouts[address].push(txout);
            }
          });
        });

        if (hasTxout) {
          async.waterfall([
            function (cb) {
              // Populate asset-addresses hash of local Redis database
              setAssetAddresses(assetIdAddresses, cb);
            },
            function (cb) {
              if (Object.keys(tokenIdAddresses).length === 0) {
                return process.nextTick(cb);
              }

              // Populate nftoken-addresses hash of local Redis database
              setNFTokenAddresses(tokenIdAddresses, cb);
            },
            function (cb) {
              if (Object.keys(tokenIdIssuance).length === 0) {
                return process.nextTick(cb);
              }

              // Populate nftoken-issuance hash of local Redis database
              setNFTokenIssuance(tokenIdIssuance, cb);
            },
            function (cb) {
              // Populate asset-issuance hash of local Redis database
              setAssetIssuance(assetIdIssuanceInfo, cb);
            },
            function (cb) {
              // Populate transaction-utxos hash of local Redis database
              setTransactionUtxos(txidTxouts, cb);
            },
            function (cb) {
              // Populate address-utxos hash of local Redis database
              setAddressUtxos(addressTxouts, cb);
            }
          ], cb);
        }
        else {
          cb(null);
        }
      },
      function (cb) {
        setTxos(utxosChanges.unused, cb)
      },
      function (cb) {
        if (!utxosChanges.metadata) {
          return process.nextTick(cb);
        }

        async.waterfall([
          function (cb) {
            if (!utxosChanges.metadata.asset) {
              return process.nextTick(cb);
            }

            // Populate asset-metadata hash of local Redis database
            setAssetMetadata(utxosChanges.metadata.asset, cb);
          },
          function (cb) {
            if (!utxosChanges.metadata.nonFungibleToken) {
              return process.nextTick(cb);
            }

            // Populate nftoken-metadata hash of local Redis database
            setNFTokenMetadata(utxosChanges.metadata.nonFungibleToken, cb);
          }
        ], cb);
      },
      function (cb) {
        updateLastBlock(block.height, block.hash, block.timestamp, cb)
      }
    ], cb)
  }

  function setAssetAddresses(assetIdAddresses, cb) {
    async.each(Object.keys(assetIdAddresses), function (assetId, cb) {
      redis.hget('asset-addresses', assetId, function (err, addresses) {
        if (err) return cb(err);

        if (addresses) {
          var currentAddresses = JSON.parse(addresses);
          var updatedAddresses = mergeArrays(currentAddresses, assetIdAddresses[assetId]);

          if (updatedAddresses.length > currentAddresses.length) {
            redis.hset('asset-addresses', assetId, JSON.stringify(updatedAddresses), cb);
          }
          else {
            cb(null);
          }
        }
        else {
          redis.hset('asset-addresses', assetId, JSON.stringify(assetIdAddresses[assetId]), cb);
        }
      });
    }, cb);
  }

  /**
   * Record bitcoin addresses associated with non-fungible tokens onto local Redis database
   * @param {Object.<string, string[]>} tokenIdAddresses A dictionary of bitcoin addresses by non-fungible token ID
   * @param {Function} cb A callback function
   */
  function setNFTokenAddresses(tokenIdAddresses, cb) {
    async.each(Object.keys(tokenIdAddresses), function (tokenId, cb) {
      redis.hget('nftoken-addresses', tokenId, function (err, addresses) {
        if (err) return cb(err);

        if (addresses) {
          const currentAddresses = JSON.parse(addresses);
          const updatedAddresses = mergeArrays(currentAddresses, tokenIdAddresses[tokenId]);

          if (updatedAddresses.length > currentAddresses.length) {
            redis.hset('nftoken-addresses', tokenId, JSON.stringify(updatedAddresses), cb);
          }
          else {
            cb(null);
          }
        }
        else {
          redis.hset('nftoken-addresses', tokenId, JSON.stringify(tokenIdAddresses[tokenId]), cb);
        }
      });
    }, cb);
  }

  /**
   * Record issuance info of non-fungible token
   * @param {Object.<string, Object>} tokenIdIssuance A dictionary of issuance info (asset ID and issuing tx ID) by
   *                                                   non-fungible token ID
   * @param {Function} cb A callback function
   */
  function setNFTokenIssuance(tokenIdIssuance, cb) {
    async.each(Object.keys(tokenIdIssuance), function (tokenId, cb) {
      redis.hexists('nftoken-issuance', tokenId, (err, exists) => {
        if (err) {
          return cb(err);
        }

        if (!exists) {
          redis.hset('nftoken-issuance', tokenId, JSON.stringify(tokenIdIssuance[tokenId]), cb);
        }
        else {
          cb(null);
        }
      })
    }, cb);
  }

  function setAssetIssuance(assetIdIssuanceInfo, cb) {
    async.each(Object.keys(assetIdIssuanceInfo), function (assetId, cb) {
      redis.hget('asset-issuance', assetId, function (err, issuance) {
        if (err) return cb(err);

        var currentIssuance = issuance ? JSON.parse(issuance) : {};

        Object.keys(assetIdIssuanceInfo[assetId]).forEach(function (txid) {
          currentIssuance[txid] = assetIdIssuanceInfo[assetId][txid];
        });

        redis.hset('asset-issuance', assetId, JSON.stringify(currentIssuance), cb);
      });
    }, cb);
  }

  function setTransactionUtxos(txidTxouts, cb) {
    async.each(Object.keys(txidTxouts), function (txid, cb) {
      // Simply replace all UTXOs associated with bitcoin transaction
      redis.hset('transaction-utxos', txid, JSON.stringify(txidTxouts[txid]), cb);
    }, cb);
  }

  function setAddressUtxos(addressTxouts, cb) {
    async.each(Object.keys(addressTxouts), function (address, cb) {
      redis.hget('address-utxos', address, function (err, utxos) {
        if (err) return cb(err);

        if (utxos) {
          var currentUtxos = JSON.parse(utxos);
          var updatedUtxos = mergeArrays(currentUtxos, addressTxouts[address]);

          if (updatedUtxos.length > currentUtxos.length) {
            redis.hset('address-utxos', address, JSON.stringify(updatedUtxos), cb);
          }
          else {
            cb(null);
          }
        }
        else {
          redis.hset('address-utxos', address, JSON.stringify(addressTxouts[address]), cb);
        }
      });
    }, cb);
  }

  function mergeArrays(ar1, ar2) {
    var resultAr = ar1.concat([]);

    ar2.forEach(function (element) {
      if (resultAr.indexOf(element) === -1) {
        resultAr.push(element);
      }
    });

    return resultAr;
  }

  var updateParsedMempoolTxids = function (txids, cb) {
    if (txids.length > 0) {
      redis.sadd('mempool', txids, cb);
    }
    else {
      cb();
    }
  }

  var updateMempoolTransactionUtxosChanges = function (transaction, utxosChanges, cb) {
    async.waterfall([
      function (cb) {
        var assetIdAddresses = {};
        const tokenIdAddresses = {};
        const tokenIdIssuance = {};
        var assetIdIssuanceInfo = {};
        var txidTxouts = {};
        var addressTxouts = {};
        var hasTxout = false;

        Object.keys(utxosChanges.unused).forEach(function (txout) {
          hasTxout = true;

          // Get addresses associated with transaction output
          var addresses = transaction.vout[txout.split(':')[1]].scriptPubKey.addresses;

          // Get assets information
          var assetInfos = JSON.parse(utxosChanges.unused[txout]);
          var assetIdAssetInfo = {};

          assetInfos.forEach(function (assetInfo) {
            assetIdAssetInfo[assetInfo.assetId] = assetInfo;

            if (assetInfo.tokenId) {
              // Record issuance info (asset ID, and issuing tx ID) of non-fungible token
              if (!(assetInfo.tokenId in tokenIdIssuance)) {
                tokenIdIssuance[assetInfo.tokenId] = {
                  assetId: assetInfo.assetId,
                  txid: assetInfo.issueTxid
                };
              }

              // Identify addresses associated with non-fungible tokens
              if (!(assetInfo.tokenId in tokenIdAddresses)) {
                tokenIdAddresses[assetInfo.tokenId] = addresses;
              }
              else {
                tokenIdAddresses[assetInfo.tokenId] = mergeArrays(tokenIdAddresses[assetInfo.tokenId], addresses);
              }
            }
          });

          Object.keys(assetIdAssetInfo).forEach(function (assetId) {
            // Identify addresses associated with assets
            if (!(assetId in assetIdAddresses)) {
              assetIdAddresses[assetId] = addresses;
            }
            else {
              assetIdAddresses[assetId] = mergeArrays(assetIdAddresses[assetId], addresses);
            }

            // Identify issuing transactions associated with assets
            var assetInfo = assetIdAssetInfo[assetId];

            if (!(assetInfo.assetId in assetIdIssuanceInfo)) {
              assetIdIssuanceInfo[assetInfo.assetId] = {};
            }

            assetIdIssuanceInfo[assetInfo.assetId][assetInfo.issueTxid] = {
              divisibility: assetInfo.divisibility,
              lockStatus: assetInfo.lockStatus,
              aggregationPolicy: assetInfo.aggregationPolicy
            };
          });

          // Identify tx outputs associated with transactions
          if (!(transaction.txid in txidTxouts)) {
            txidTxouts[transaction.txid] = [txout];
          }
          else {
            txidTxouts[transaction.txid].push(txout);
          }

          // Identify tx outputs associated with addresses
          addresses.forEach(function(address) {
            if (!(address in addressTxouts)) {
              addressTxouts[address] = [txout];
            }
            else if (addressTxouts[address].indexOf(txout) === -1) {
              addressTxouts[address].push(txout);
            }
          });
        });

        if (hasTxout) {
          async.waterfall([
            function (cb) {
              // Populate asset-addresses hash of local Redis database
              setAssetAddresses(assetIdAddresses, cb);
            },
            function (cb) {
              if (Object.keys(tokenIdAddresses).length === 0) {
                return process.nextTick(cb);
              }

              // Populate nftoken-addresses hash of local Redis database
              setNFTokenAddresses(tokenIdAddresses, cb);
            },
            function (cb) {
              if (Object.keys(tokenIdIssuance).length === 0) {
                return process.nextTick(cb);
              }

              // Populate nftoken-issuance hash of local Redis database
              setNFTokenIssuance(tokenIdIssuance, cb);
            },
            function (cb) {
              // Populate asset-issuance hash of local Redis database
              setAssetIssuance(assetIdIssuanceInfo, cb);
            },
            function (cb) {
              // Populate transaction-utxos hash of local Redis database
              setTransactionUtxos(txidTxouts, cb);
            },
            function (cb) {
              // Populate address-utxos hash of local Redis database
              setAddressUtxos(addressTxouts, cb);
            }
          ], cb);
        }
        else {
          cb(null);
        }
      },
      function (cb) {
        setTxos(utxosChanges.unused, cb)
      },
      function (cb) {
        if (!utxosChanges.metadata) {
          return process.nextTick(cb);
        }

        async.waterfall([
          function (cb) {
            if (!utxosChanges.metadata.asset) {
              return process.nextTick(cb);
            }

            // Populate asset-metadata hash of local Redis database
            setAssetMetadata(utxosChanges.metadata.asset, cb);
          },
          function (cb) {
            if (!utxosChanges.metadata.nonFungibleToken) {
              return process.nextTick(cb);
            }

            // Populate nftoken-metadata hash of local Redis database
            setNFTokenMetadata(utxosChanges.metadata.nonFungibleToken, cb);
          }
        ], cb);
      },
      function (cb) {
        updateParsedMempoolTxids([transaction.txid], cb)
      }
    ], cb)
  }

  var decodeRawTransaction = function (tx, cb) {
    var r = {}
    r['txid'] = tx.getId()
    r['version'] = tx.version
    r['locktime'] = tx.locktime
    r['hex'] = tx.toHex()
    r['vin'] = []
    r['vout'] = []

    tx.ins.forEach(function (txin) {
        var txid = txin.hash.reverse().toString('hex')
        var n = txin.index
        var seq = txin.sequence
        var hex = txin.script.toString('hex')
        if (n == 4294967295) {
          r['vin'].push({'txid': txid, 'vout': n, 'coinbase' : hex, 'sequence' : seq})
        } else {
          var asm = bitcoinjs.script.toASM(txin.script)
          var input = {'txid': txid, 'vout': n, 'scriptSig' : {'asm': asm, 'hex': hex}}
          if (txin.witness.length > 0) {
            input.txinwitness = txin.witness.map(item => item.toString('hex'))
          }
          input.sequence = seq
          r['vin'].push(input)
        }
    })

    tx.outs.forEach(function (txout, i) {
        var value = txout.value
        var hex = txout.script.toString('hex')
        try {
          var asm = bitcoinjs.script.toASM(txout.script)
          var type = ClassifyTxOut.classify(txout.script)
        } catch (e) {
          // Invalid script
          asm = '[error]';
          type = ClassifyTxOut.outputType.NONSTANDARD;
        }
        var addresses = []
        if (~['witnesspubkeyhash', 'witnessscripthash', 'pubkeyhash', 'scripthash'].indexOf(type)) {
          addresses.push(bitcoinjs.address.fromOutputScript(txout.script, bitcoinNetwork))
        }
        var answer = {'value' : value, 'n': i, 'scriptPubKey': {'asm': asm, 'hex': hex, 'addresses': addresses, 'type': type}}

        r['vout'].push(answer)
    })

    if (typeof cb === 'function') {
      getColoredData(r, (err, ccdata) => {
        if (err) {
          return cb(err);
        }

        if (ccdata) {
          r['ccdata'] = [ccdata];
          r['colored'] = true;
        }

        cb(null, r);
      });
    }
    else {
      return r;
    }
  }

  var parseNewBlock = function (block, cb) {
    info.cctimestamp = block.timestamp
    info.ccheight = block.height
    var utxosChanges = {
      used: {},
      unused: {},
      txids: []
    }
    async.eachSeries(block.transactions, function (transaction, cb) {
      utxosChanges.txids.push(transaction.txid)
      if (!transaction.colored) {
        emitter.emit('newtransaction', transaction)
        return process.nextTick(cb)
      }
      parseTransaction(transaction, utxosChanges, block.height, cb)
    }, function (err) {
      if (err) return cb(err)
      updateUtxosChanges(block, utxosChanges, function (err) {
        if (err) return cb(err)
        block.transactions = block.transactions.map(transaction => transaction.txid)
        emitter.emit('newblock', block)
        cb()
      })
    })
  }

  var getMempoolTxids = function (cb) {
    bitcoin.cmd('getrawmempool', [], cb)
  }

  var getNewMempoolTxids = function (mempoolTxids, cb) {
    const newMempoolTxids = [];

    async.each(mempoolTxids, function (mempoolTxid, cb) {
      redis.sismember('mempool', mempoolTxid, function (err, exists) {
        if (err) return cb(err);

        if (!exists) {
          newMempoolTxids.push(mempoolTxid);
        }

        cb();
      });
    }, function (err) {
      if (err) return cb(err);

      cb(null, newMempoolTxids);
    });
  }

  var getNewMempoolTransaction = function (newMempoolTxids, cb) {
    if (newMempoolTxids.length > 0) {
      var commandsArr = newMempoolTxids.map(function (txid) {
        return {method: 'getrawtransaction', params: [txid, 0]}
      })
      var newMempoolTransactions = []
      bitcoin.cmd(commandsArr, function (rawTransaction, cb) {
          // Call 'decodeRawTransaction' asynchronously (with a callback) to include colored coins data
          decodeRawTransaction(bitcoinjs.Transaction.fromHex(rawTransaction), (err, newMempoolTransaction) => {
            if (err) {
              return cb(err);
            }

            newMempoolTransactions.push(newMempoolTransaction);
            cb();
          });
        },
        function (err) {
          cb(err, newMempoolTransactions)
        })
    }
    else {
      cb(null, []);
    }
  }

  var orderByDependencies = function (transactions) {
    var txids = {}
    transactions.forEach(function (transaction) {
      txids[transaction.txid] = transaction
    })
    var edges = []
    transactions.forEach(function (transaction) {
      transaction.vin.forEach(function (input) {
        if (txids[input.txid]) {
          edges.push([input.txid, transaction.txid])
        }
      })
    })
    var sortedTxids = toposort.array(Object.keys(txids), edges)
    return sortedTxids.map(function (txid) { return txids[txid] } )
  }

  var parseNewMempoolTransactions = function (newMempoolTransactions, cb) {
    if (newMempoolTransactions.length > 0) {
      newMempoolTransactions = orderByDependencies(newMempoolTransactions)
      var processedTxids = []
      async.eachSeries(newMempoolTransactions, function (newMempoolTransaction, cb) {
        var utxosChanges = {
          used: {},
          unused: {}
        }
        if (!newMempoolTransaction.colored) {
          processedTxids.push(newMempoolTransaction.txid)
          emitter.emit('newtransaction', newMempoolTransaction)
          return process.nextTick(cb)
        }
        parseTransaction(newMempoolTransaction, utxosChanges, -1, function (err) {
          if (err) return cb(err)
          updateMempoolTransactionUtxosChanges(newMempoolTransaction, utxosChanges, function (err) {
            if (err) return cb(err);

            processedTxids.push(newMempoolTransaction.txid);
            cb();
          })
        })
      }, function (err) {
        if (err) return cb(err)
        // Note: changed to update all processed txs and not only non-colored txs
        updateParsedMempoolTxids(processedTxids, cb)
      })
    }
    else {
      cb();
    }
  }

  var updateInfo = function (cb) {
    if (info.ccheight && info.cctimestamp) {
      return process.nextTick(cb)
    }
    redis.hmget('blocks', 'lastBlockHeight', 'lastTimestamp', function (err, arr) {
      if (err) return cb(err)
      if (!arr || arr.length < 2) return process.nextTick(cb)
      info.ccheight = parseInt(arr[0])
      info.cctimestamp = arr[1]
      cb()
    })
  }

  var mempoolParse = function (cb) {
    // console.log('parsing mempool')
    async.waterfall([
      updateInfo,
      getMempoolTxids,
      getNewMempoolTxids,
      getNewMempoolTransaction,
      parseNewMempoolTransactions
    ], cb)
  }

  var finishParsing = function (err)  {
    if (err) console.error(new Date().toISOString(), '-', err)
    parseControl.doParse(parseProcedure, finishParsing);
  }

  var importAddresses = function (args, cb) {
    var addresses = args.addresses
    var reindex = args.reindex === 'true' || args.reindex === true
    var newAddresses
    var importedAddresses
    var ended = false

    var endFunc = function () {
      if (!ended) {
        ended = true
        return cb(null, {
          addresses: addresses,
          reindex: reindex,
        })
      }
    }
    async.waterfall([
      function (cb) {
        redis.hget('addresses', 'imported', cb)
      },
      function (_importedAddresses, cb) {
        importedAddresses = _importedAddresses || '[]'
        importedAddresses = JSON.parse(importedAddresses)
        newAddresses = _.difference(addresses, importedAddresses)
        if (reindex && newAddresses.length < 2 || !newAddresses.length) return process.nextTick(cb)
        var commandsArr = newAddresses.splice(0, newAddresses.length - (reindex ? 1 : 0)).map(function (address) {
          return {
            method: 'importaddress',
            params: [address, label, false]
          }
        })
        bitcoin.cmd(commandsArr, function (ans, cb) { return process.nextTick(cb)}, cb)
      },
      function (cb) {
        reindex = false
        if (!newAddresses.length) return process.nextTick(cb)
        reindex = true
        info.bitcoindbusy = true
        bitcoin.cmd('importaddress', [newAddresses[0], label, true], function (err) {
          waitForBitcoind(cb)
        })
        endFunc()
      },
      function (cb) {
        newAddresses = _.difference(addresses, importedAddresses)
        if (!newAddresses.length) return process.nextTick(cb)
        importedAddresses = importedAddresses.concat(newAddresses)
        redis.hmset('addresses', 'imported', JSON.stringify(importedAddresses), function (err) {
          cb(err)
        })
      }
    ], function (err) {
      if (err) return cb(err)
      endFunc()
    })
  }

  var parse = function (addresses, progressCallback) {
    if (typeof addresses === 'function') {
      progressCallback = addresses
      addresses = null
    }
    setInterval(function () {
      emitter.emit('info', info)
      if (progressCallback) {
        progressCallback(info)
      }
    }, 5000);
    if (!addresses || !Array.isArray(addresses)) return parseControl.doParse(parseProcedure, finishParsing);
    importAddresses({addresses: addresses, reindex: true}, function () {parseControl.doParse(parseProcedure, finishParsing)})
  }

  var infoPopulate = function (cb) {
    getBitcoindInfo(function (err, newInfo) {
      if (err) return cb(err)
      info = newInfo
      cb()
    })
  }

  var parseProcedure = function (cb) {
    async.waterfall([
      waitForBitcoind,
      infoPopulate,
      getNextBlockHeight,
      getNextBlock,
      checkNextBlock,
      conditionalParseNextBlock
    ], cb)
  }

  var parseNow = function (args, cb) {
    if (typeof args === 'function') {
      cb = args
      args = null
    }

    parseControl.doParse(parseProcedure);
    cb(null, true)
  }

  var getAddressesUtxos = function (args, cb) {
    var addresses = args.addresses
    var numOfConfirmations = args.numOfConfirmations || 0

    if (args.waitForParsing) {
      parseControl.doProcess(getAddressesUtxos_innerProcess)
    }
    else {
      getAddressesUtxos_innerProcess()
    }

    function getAddressesUtxos_innerProcess() {
      bitcoin.cmd('getblockcount', [], function (err, count) {
        if (err) return cb(err)
        bitcoin.cmd('listunspent', [numOfConfirmations, 99999999, addresses], function (err, utxos) {
          if (err) return cb(err)
          async.each(utxos, function (utxo, cb) {
            redis.hget('utxos', utxo.txid + ':' + utxo.vout, function (err, assets) {
              if (err) return cb(err)
              utxo.assets = assets && JSON.parse(assets) || []
              if (utxo.confirmations) {
                utxo.blockheight = count - utxo.confirmations + 1
              } else {
                utxo.blockheight = -1
              }
              cb()
            })
          }, function (err) {
            if (err) return cb(err)
            cb(null, utxos)
          })
        })
      })
    }
  }

  var getUtxos = function (args, cb) {
    var reqUtxos = args.utxos
    var numOfConfirmations = args.numOfConfirmations || 0

    if (args.waitForParsing) {
      parseControl.doProcess(getUtxos_innerProcess)
    }
    else {
      getUtxos_innerProcess()
    }

    function getUtxos_innerProcess() {
      bitcoin.cmd('getblockcount', [], function (err, count) {
        if (err) return cb(err)
        bitcoin.cmd('listunspent', [numOfConfirmations, 99999999], function (err, utxos) {
          if (err) return cb(err)
          utxos = utxos.filter(utxo => reqUtxos.findIndex(reqUtxo => reqUtxo.txid === utxo.txid && reqUtxo.index === utxo.vout) !== -1)
          async.each(utxos, function (utxo, cb) {
            redis.hget('utxos', utxo.txid + ':' + utxo.vout, function (err, assets) {
              if (err) return cb(err)
              utxo.assets = assets && JSON.parse(assets) || []
              if (utxo.confirmations) {
                utxo.blockheight = count - utxo.confirmations + 1
              } else {
                utxo.blockheight = -1
              }
              cb()
            })
          }, function (err) {
            if (err) return cb(err)
            cb(null, utxos)
          })
        })
      })
    }
  }

  var getTxouts = function (args, cb) {
    var txouts = _.cloneDeep(args.txouts)

    if (args.waitForParsing) {
      parseControl.doProcess(getTxouts_innerProcess)
    }
    else {
      getTxouts_innerProcess()
    }

    function getTxouts_innerProcess() {
      async.each(txouts, function (txout, cb) {
        redis.hget('utxos', txout.txid + ':' + txout.vout, function (err, assets) {
          if (err) return cb(err)
          txout.assets = assets && JSON.parse(assets) || []
          cb()
        })
      }, function (err) {
        if (err) return cb(err)
        cb(null, txouts)
      })
    }
  }

  var transmit = function (args, cb) {
    var txHex = args.txHex
    bitcoin.cmd('sendrawtransaction', [txHex], function(err, res) {
      if (err) {
        return cb(err)
      }

      // Call 'decodeRawTransaction' asynchronously (with a callback) to include colored coins data
      decodeRawTransaction(bitcoinjs.Transaction.fromHex(txHex), (err, transaction) => {
        if (err) {
          return cb(err);
        }

        var txsToParse = [transaction]
        var txsToCheck = [transaction]

        async.whilst(
          function() { return txsToCheck.length > 0 },
          function(callback) {
            var txids = txsToCheck.map(function(tx) { return tx.vin.map(function(vin) { return vin.txid}) })
            txids = [].concat.apply([], txids)
            txids = [...new Set(txids)]
            txsToCheck = []
            getNewMempoolTxids(txids, function(err, txids) {
              if (err) return callback(err)
              if (txids.length == 0) return callback()
              var batch = txids.map(function(txid) { return { 'method': 'getrawtransaction', 'params': [txid] } })
              bitcoin.cmd(
                batch,
                function (rawTransaction, cb2) {
                  // Call 'decodeRawTransaction' asynchronously (with a callback) to include colored coins data
                  decodeRawTransaction(bitcoinjs.Transaction.fromHex(rawTransaction), (err, tx) => {
                    if (err) {
                      return cb2(err);
                    }

                    txsToCheck.push(tx)
                    txsToParse.unshift(tx)
                    cb2();
                  })
                },
                function(err) {
                  if (err) return callback(err)
                  return callback()
                }
              )
            })
          },
          function (err) {
            if (err) return cb(null, '{ "txid": "' +  res + '" }')
            parseNewMempoolTransactions(txsToParse, function(err) {
              if (err) return cb(null, '{ "txid": "' +  res + '" }')
              return cb(null, '{ "txid": "' +  res + '" }')
            })
          }
        )
      });
    })
  }

  var addColoredInputs = function (transaction, cb) {
    async.each(transaction.vin, function (input, cb) {
      redis.hget('utxos', input.txid + ':' + input.vout, function (err, assets) {
        if (err) return cb(err)
        assets = assets && JSON.parse(assets) || []
        input.assets = assets
        cb()
      })
    }, function (err) {
      if (err) return cb(err)
      cb(null, transaction)
    })
  }

  var addColoredOutputs = function (transaction, cb) {
    async.each(transaction.vout, function (output, cb) {
      redis.hget('utxos', transaction.txid + ':' + output.n, function (err, assets) {
        if (err) return cb(err)
        assets = assets && JSON.parse(assets) || []
        output.assets = assets
        cb()
      })
    }, function (err) {
      if (err) return cb(err)
      cb(null, transaction)
    })
  }

  var addColoredIOs = function (transaction, cb) {
    async.waterfall([
      function (cb) {
        addColoredInputs(transaction, cb)
      },
      function (transaction, cb) {
        addColoredOutputs(transaction, cb)
      }
    ], cb)
  }

  var getAddressesTransactions = function (args, cb) {
    var addresses = args.addresses

    if (args.waitForParsing) {
      parseControl.doProcess(getAddressesTransactions_innerProcess)
    }
    else {
      getAddressesTransactions_innerProcess()
    }

    function getAddressesTransactions_innerProcess() {
      var next = true
      var txs = {}
      var txids = []
      var skip = 0
      var count = 10
      var transactions = {}

      async.whilst(function () {
        return next
      }, function (cb) {
        bitcoin.cmd('listtransactions', [label, count, skip, true], function (err, transactions) {
          if (err) return cb(err)
          skip += count
          transactions.forEach(function (transaction) {
            if (~addresses.indexOf(transaction.address) && !~txids.indexOf(transaction.txid)) {
              txs[transaction.txid] = transaction
              txids.push(transaction.txid)
            }
          })
          if (transactions.length < count) {
            next = false
          }
          cb()
        })
      }, function (err) {
        if (err) return cb(err)
        var batch = txids.map(function (txid) {
          return {'method': 'getrawtransaction', 'params': [txid]}
        })
        bitcoin.cmd('getblockcount', [], function (err, count) {
          if (err) return cb(err)
          bitcoin.cmd(batch, function (rawTransaction, cb) {
            var transaction = decodeRawTransaction(bitcoinjs.Transaction.fromHex(rawTransaction))
            var tx = txs[transaction.txid]
            addColoredIOs(transaction, function (err) {
              transaction.confirmations = tx.confirmations
              if (transaction.confirmations) {
                transaction.blockheight = count - transaction.confirmations + 1
                transaction.blocktime = tx.blocktime * 1000
              } else {
                transaction.blockheight = -1
                transaction.blocktime = tx.timereceived * 1000
              }
              transactions[transaction.txid] = transaction
              cb()
            })
          }, function (err) {
            if (err) return cb(err)

            var prevOutputIndex = {}

            Object.values(transactions).forEach(function (tx) {
              tx.vin.forEach(function (vin) {
                prevOutputIndex[vin.txid] = prevOutputIndex[vin.txid] || []
                prevOutputIndex[vin.txid].push(vin)
              })
            })

            var prevOutsBatch = Object.keys(prevOutputIndex).map(function (txid) {
              return {'method': 'getrawtransaction', 'params': [txid]}
            })
            bitcoin.cmd(prevOutsBatch, function (rawTransaction, cb) {
              var transaction = decodeRawTransaction(bitcoinjs.Transaction.fromHex(rawTransaction))
              var txid = transaction.id
              prevOutputIndex[transaction.txid].forEach(function (vin) {
                vin.previousOutput = transaction.vout[vin.vout]
                if (vin.previousOutput.scriptPubKey && vin.previousOutput.scriptPubKey.addresses) {
                  vin.previousOutput.addresses = vin.previousOutput.scriptPubKey.addresses
                }
              })
              cb()
            }, function (err) {
              if (err) return cb(err)

              Object.values(transactions).forEach(function (tx) {
                tx.fee = tx.vin.reduce(function (sum, vin) {
                  return sum + vin.previousOutput.value
                }, 0) - tx.vout.reduce(function (sum, vout) {
                  return sum + vout.value
                }, 0)
                tx.totalsent = tx.vin.reduce(function (sum, vin) {
                  return sum + vin.previousOutput.value
                }, 0)
              })
              cb(null, Object.values(transactions))
            })
          })
        })
      })
    }
  }

  var getBitcoindInfo = function (cb) {
    var btcInfo
    async.waterfall([
      function (cb) {
        bitcoin.cmd('getblockchaininfo', [], cb)
      },
      function (_btcInfo, cb) {
        if (typeof _btcInfo === 'function') {
          cb = _btcInfo
          _btcInfo = null
        }
        if (!_btcInfo) return cb('No reply from getblockchaininfo')
        btcInfo = _btcInfo
        bitcoin.cmd('getblockhash', [btcInfo.blocks], cb)
      },
      function (lastBlockHash, cb) {
        bitcoin.cmd('getblock', [lastBlockHash], cb)
      }
    ],
    function (err, lastBlockInfo) {
      if (err) return cb(err)
      btcInfo.timestamp = lastBlockInfo.time
      btcInfo.cctimestamp = info.cctimestamp
      btcInfo.ccheight = info.ccheight
      cb(null, btcInfo)
    })
  }

  var getInfo = function (args, cb) {
    if (typeof args === 'function') {
      cb = args
      args = null
    }
    cb(null, info)
  }

  // Return: { - A dictionary where the keys are blockchain addresses
  //   <address>: {
  //     totalBalance: [Number], - Total balance amount
  //     unconfirmedBalance: [Number] - Unconfirmed balance amount
  //   }
  // }
  const getAssetHolders = function (args, cb) {
    const assetId = args.assetId;
    const numOfConfirmations = args.numOfConfirmations || 0;

    if (args.waitForParsing) {
      parseControl.doProcess(getAssetHolders_innerProcess)
    }
    else {
      getAssetHolders_innerProcess()
    }

    function getAssetHolders_innerProcess() {
      // Get addresses associated with asset
      redis.hget('asset-addresses', assetId, function (err, strAddresses) {
        if (err) return cb(err);

        if (strAddresses) {
          const addresses = JSON.parse(strAddresses);

          // Retrieve UTXOs associated with asset addresses
          bitcoin.cmd('listunspent', [numOfConfirmations, 99999999, addresses], function (err, utxos) {
            if (err) return cb(err);

            const addressBalance = {};

            async.each(utxos, function (utxo, cb) {
              // Get assets associated with UTXO
              redis.hget('utxos', utxo.txid + ':' + utxo.vout, function (err, strAssets) {
                if (err) return cb(err);

                const assets = strAssets && JSON.parse(strAssets) || [];

                assets.forEach((asset) => {
                  if (asset.assetId === assetId) {
                    // Accumulate balance amount of given asset per the address associated with the UTXO
                    const bnAssetAmount = new BigNumber(asset.amount).dividedBy(Math.pow(10, asset.divisibility));
                    let balance;

                    if (!(utxo.address in addressBalance)) {
                      balance = addressBalance[utxo.address] = {
                        totalBalance: new BigNumber(0),
                        unconfirmedBalance: new BigNumber(0)
                      };
                    }
                    else {
                      balance = addressBalance[utxo.address];
                    }

                    balance.totalBalance = balance.totalBalance.plus(bnAssetAmount);

                    if (utxo.confirmations === 0) {
                      balance.unconfirmedBalance = balance.unconfirmedBalance.plus(bnAssetAmount);
                    }
                  }
                });

                cb(null);
              })
            }, function (err) {
              if (err) return cb(err);

              // Convert accumulated asset balance amounts to number
              Object.keys(addressBalance).forEach((address) => {
                let balance = addressBalance[address];

                balance.totalBalance = balance.totalBalance.toNumber();
                balance.unconfirmedBalance = balance.unconfirmedBalance.toNumber();
              });

              cb(null, addressBalance);
            });
          });
        }
        else {
          // Asset not found. Do not return anything
          cb(null);
        }
      });
    }
  };

  // Return: {
  //   total: [Number], - Total balance amount
  //   unconfirmed: [Number] - Unconfirmed balance amount
  // }
  const getAssetBalance = function (args, cb) {
    const assetId = args.assetId;
    const filterAddresses = args.addresses;
    const numOfConfirmations = args.numOfConfirmations || 0;

    if (args.waitForParsing) {
      parseControl.doProcess(getAssetBalance_innerProcess)
    }
    else {
      getAssetBalance_innerProcess()
    }

    function getAssetBalance_innerProcess() {
      // Get addresses associated with asset
      redis.hget('asset-addresses', assetId, function (err, strAddresses) {
        if (err) return cb(err);

        if (strAddresses) {
          let addresses = JSON.parse(strAddresses);

          if (filterAddresses) {
            // Only take into account the addresses passed in the call
            addresses = addresses.filter((address) => filterAddresses.indexOf(address) !== -1);
          }

          if (addresses.length > 0) {
            // Retrieve UTXOs associated with asset addresses
            bitcoin.cmd('listunspent', [numOfConfirmations, 99999999, addresses], function (err, utxos) {
              if (err) return cb(err);

              let totalBalance = new BigNumber(0);
              let unconfirmedBalance = new BigNumber(0);

              async.each(utxos, function (utxo, cb) {
                // Get assets associated with UTXO
                redis.hget('utxos', utxo.txid + ':' + utxo.vout, function (err, strAssets) {
                  if (err) return cb(err);

                  const assets = strAssets && JSON.parse(strAssets) || [];

                  assets.forEach((asset) => {
                    if (asset.assetId === assetId) {
                      // Accumulate balance amount
                      const bnAssetAmount = new BigNumber(asset.amount).dividedBy(Math.pow(10, asset.divisibility));

                      totalBalance = totalBalance.plus(bnAssetAmount);

                      if (utxo.confirmations === 0) {
                        unconfirmedBalance = unconfirmedBalance.plus(bnAssetAmount);
                      }
                    }
                  });

                  cb(null);
                })
              }, function (err) {
                if (err) return cb(err);

                // Return balance amounts
                cb(null, {
                  total: totalBalance.toNumber(),
                  unconfirmed: unconfirmedBalance.toNumber()
                });
              });
            });
          }
          else {
            // Empty list of addresses. Return zero balance
            cb(null, {
              total: 0,
              unconfirmed: 0
            });
          }
        }
        else {
          // Asset not found. Do not return anything
          cb(null);
        }
      });
    }
  };

  // Return: { - A dictionary where the keys are the asset IDs
  //   <assetId>: {
  //     totalBalance: [Number], - Total balance amount
  //     unconfirmedBalance: [Number] - Unconfirmed balance amount
  //   }
  // }
  const getMultiAssetBalance = function (args, cb) {
    const assetIds = args.assetIds;
    const filterAddresses = args.addresses;
    const numOfConfirmations = args.numOfConfirmations || 0;

    if (args.waitForParsing) {
      parseControl.doProcess(getMultiAssetBalance_innerProcess)
    }
    else {
      getMultiAssetBalance_innerProcess()
    }

    function getMultiAssetBalance_innerProcess() {
      if (assetIds.length > 0) {
        const assetBalance = {};

        async.each(assetIds, function (assetId, cb) {
          // Get addresses associated with asset
          redis.hget('asset-addresses', assetId, function (err, strAddresses) {
            if (err) return cb(err);

            if (strAddresses) {
              let addresses = JSON.parse(strAddresses);

              if (filterAddresses) {
                // Only take into account the addresses passed in the call
                addresses = addresses.filter((address) => filterAddresses.indexOf(address) !== -1);
              }

              if (addresses.length > 0) {
                // Retrieve UTXOs associated with asset addresses
                bitcoin.cmd('listunspent', [numOfConfirmations, 99999999, addresses], function (err, utxos) {
                  if (err) return cb(err);

                  let totalBalance = new BigNumber(0);
                  let unconfirmedBalance = new BigNumber(0);

                  async.each(utxos, function (utxo, cb) {
                    // Get assets associated with UTXO
                    redis.hget('utxos', utxo.txid + ':' + utxo.vout, function (err, strAssets) {
                      if (err) return cb(err);

                      const assets = strAssets && JSON.parse(strAssets) || [];

                      assets.forEach((asset) => {
                        if (asset.assetId === assetId) {
                          // Accumulate balance amount
                          const bnAssetAmount = new BigNumber(asset.amount).dividedBy(Math.pow(10, asset.divisibility));

                          totalBalance = totalBalance.plus(bnAssetAmount);

                          if (utxo.confirmations === 0) {
                            unconfirmedBalance = unconfirmedBalance.plus(bnAssetAmount);
                          }
                        }
                      });

                      cb(null);
                    })
                  }, function (err) {
                    if (err) return cb(err);

                    // Save asset balance to be returned
                    assetBalance[assetId] = {
                      total: totalBalance.toNumber(),
                      unconfirmed: unconfirmedBalance.toNumber()
                    };

                    cb(null);
                  });
                });
              }
              else {
                // Empty list of addresses. Save asset balance as zero to be returned
                assetBalance[assetId] = {
                  total: 0,
                  unconfirmed: 0
                };

                cb(null);
              }
            }
            else {
              // Asset not found. Do not do anything
              cb(null);
            }
          });
        }, function (err) {
          if (err) return cb(err);

          cb(null, assetBalance);
        });
      }
      else {
        // An empty list of asset IDs has been passed. Do not return anything
        cb(null);
      }
    }
  };

  /**
   * Data structure containing information about the issuance of an asset
   * @typedef {Object} AssetIssuanceInfo
   * @property {number} amount The asset amount issued
   * @property {number} divisibility The number of decimal places used to represent the smallest amount of the asset
   * @property {boolean} lockStatus Indicates whether no more units of this asset can be issued (locked asset)
   * @property {string} aggregationPolicy The aggregation policy of the asset. One of: 'aggregatable', 'hybrid',
   *                                       'dispersed' or 'nonFungible'
   * @property {string[]} [tokenIds] The list of issued non-fungible token IDs. Only present for 'nonFungible'
   *                                  aggregation policy
   */

  /**
   * Callback for handling the result of retrieving issuing information about an asset
   * @callback getAssetIssuanceCallback
   * @param {*} [error] An error message, or null if the function successfully returned
   * @param {Object.<string, AssetIssuanceInfo>} [txidIssuanceInfo] A dictionary of asset issuance info by bitcoin
   *                                                                 transaction ID
   */

  /**
   * API method used to retrieve issuing information about an asset
   * @param {Object} args
   * @param {string} args.assetId The asset ID
   * @param {boolean} [args.waitForParsing] Indicates whether it should wait for the blockchain parsing to complete
   *                                         before starting its internal processing
   * @param {getAssetIssuanceCallback} cb The callback for handling the result
   */
  function getAssetIssuance(args, cb) {
    const assetId = args.assetId;

    if (args.waitForParsing) {
      parseControl.doProcess(getAssetIssuance_innerProcess)
    }
    else {
      getAssetIssuance_innerProcess()
    }

    function getAssetIssuance_innerProcess() {
      // Get transactions used to issue asset
      redis.hget('asset-issuance', assetId, (err, strIssuance) => {
        if (err) {
          return cb(err);
        }

        if (!strIssuance) {
          // Return indicating that no issuance information found for the specified asset ID
          return cb();
        }

        let issuance;

        try {
          issuance = JSON.parse(strIssuance);
        }
        catch (err) {
          return cb(err);
        }

        const retIssuance = {};

        async.eachSeries(Object.keys(issuance), function (txid, cb) {
          // Prepare issuance info for this transaction
          const txIssuance = issuance[txid];
          const issuanceInfo = {
            amount: new BigNumber(0),
            divisibility: txIssuance.divisibility,
            lockStatus: txIssuance.lockStatus,
            aggregationPolicy: txIssuance.aggregationPolicy
          };
          const issuedTokenIds = new Set();

          // Compute issued asset amount
          redis.hget('transaction-utxos', txid, (err, strUtxos) => {
            if (err) {
              return cb(err);
            }

            let utxos;

            try {
              utxos = JSON.parse(strUtxos);
            }
            catch (err) {
              return cb(err);
            }

            async.each(utxos, function (utxo, cb) {
              redis.hget('utxos', utxo, function (err, strAssets) {
                if (err) {
                  return cb(err);
                }

                let assets;

                try {
                  assets = JSON.parse(strAssets);
                }
                catch (err) {
                  return cb(err);
                }

                for (const asset of assets) {
                  if (asset.assetId === assetId && asset.issueTxid === txid) {
                    // Accumulate issued asset amount
                    const bnAssetAmount = new BigNumber(asset.amount).dividedBy(Math.pow(10, asset.divisibility));

                    issuanceInfo.amount = issuanceInfo.amount.plus(bnAssetAmount);

                    if (asset.tokenId) {
                      if (issuedTokenIds.has(asset.tokenId)) {
                        // Inconsistency: non-fungible token should not be listed more than once by UTXOs.
                        //  Return error
                        return cb(new Error(`Non-fungible token (tokenId: ${asset.tokenId}) should not be listed more than once by UTXOs`));
                      }

                      // Record issued non-fungible token ID
                      issuedTokenIds.add(asset.tokenId);
                    }
                  }
                }

                cb();
              });
            }, function (err) {
              if (err) {
                return cb(err);
              }

              // Convert accumulated asset amount to number and save issuance info
              //  for this transaction
              issuanceInfo.amount = issuanceInfo.amount.toNumber();

              if (issuedTokenIds.size > 0) {
                // Add issued non-fungible token IDs to asset issuance info
                issuanceInfo.tokenIds = Array.from(issuedTokenIds)
              }

              retIssuance[txid] = issuanceInfo;

              cb();
            });
          });
        }, function (err) {
          if (err) {
            return cb(err);
          }

          cb(null, retIssuance);
        });
      });
    }
  }

  // Return: {
  //   address: [String] - The blockchain address used to issued amount of this asset
  // }
  const getAssetIssuingAddress = function (args, cb) {
    const assetId = args.assetId;

    if (args.waitForParsing) {
      parseControl.doProcess(getAssetIssuingAddress_innerProcess)
    }
    else {
      getAssetIssuingAddress_innerProcess()
    }

    function getAssetIssuingAddress_innerProcess() {
      // Get transactions used to issue asset
      redis.hget('asset-issuance', assetId, function (err, strIssuance) {
        if (err) return cb(err);

        const issuance = JSON.parse(strIssuance);

        if (issuance) {
          // Get ID of first issuing transaction
          const issuingTxid = Object.keys(issuance)[0];

          // Retrieve transaction info
          bitcoin.cmd('getrawtransaction', [issuingTxid, true], function (err, issuingTx) {
            if (err) return cb(err);

            // Retrieve tx output associated with first input of transaction
            bitcoin.cmd('getrawtransaction', [issuingTx.vin[0].txid, true], function (err, tx) {
              if (err) return cb(err);

              // Return address associated with tx output
              cb(null, {
                address: tx.vout[issuingTx.vin[0].vout].scriptPubKey.address
              });
            })
          })
        }
        else {
          // Asset not found. Do not return anything
          cb(null);
        }
      });
    }
  };

  // Return: { - A dictionary where the keys are the asset IDs
  //   <assetId>: {
  //     totalBalance: [Number], - Total balance amount
  //     unconfirmedBalance: [Number] - Unconfirmed balance amount
  //   }
  // }
  const getOwningAssets = function (args, cb) {
    const addresses = args.addresses ;
    const numOfConfirmations = args.numOfConfirmations || 0;

    if (args.waitForParsing) {
      parseControl.doProcess(getOwningAssets_innerProcess)
    }
    else {
      getOwningAssets_innerProcess()
    }

    function getOwningAssets_innerProcess() {
      if (addresses.length > 0) {
        // Retrieve UTXOs associated with given addresses
        bitcoin.cmd('listunspent', [numOfConfirmations, 99999999, addresses], function (err, utxos) {
          if (err) return cb(err);

          const assetBalance = {};

          async.each(utxos, function (utxo, cb) {
            // Get assets associated with UTXO
            redis.hget('utxos', utxo.txid + ':' + utxo.vout, function (err, strAssets) {
              if (err) return cb(err);

              const assets = strAssets && JSON.parse(strAssets) || [];

              assets.forEach((asset) => {
                // Accumulate asset balance amount per asset associated with the UTXO
                const bnAssetAmount = new BigNumber(asset.amount).dividedBy(Math.pow(10, asset.divisibility));
                let balance;

                if (!(asset.assetId in assetBalance)) {
                  balance = assetBalance[asset.assetId] = {
                    totalBalance: new BigNumber(0),
                    unconfirmedBalance: new BigNumber(0)
                  };
                }
                else {
                  balance = assetBalance[asset.assetId];
                }

                balance.totalBalance = balance.totalBalance.plus(bnAssetAmount);

                if (utxo.confirmations === 0) {
                  balance.unconfirmedBalance = balance.unconfirmedBalance.plus(bnAssetAmount);
                }
              });

              cb(null);
            })
          }, function (err) {
            if (err) return cb(err);

            // Convert accumulated asset balance amounts to number
            Object.keys(assetBalance).forEach((asset) => {
              let balance = assetBalance[asset];

              balance.totalBalance = balance.totalBalance.toNumber();
              balance.unconfirmedBalance = balance.unconfirmedBalance.toNumber();
            });

            cb(null, assetBalance);
          });
        });
      }
      else {
        // An empty list of addresses has been passed. Do not return anything
        cb(null);
      }
    }
  };

  /**
   * Callback for handling the result of retrieving an entity's (either an asset or a non-fungible token) metadata
   * @callback getMetadataCallback
   * @param {*} [error] An error message, or null if the function successfully returned
   * @param {Object} [metadata] The retrieved metadata
   */

  /**
   * API method used to retrieve the metadata associated with an asset
   * @param {Object} args
   * @param {string} args.assetId The asset ID
   * @param {boolean} [args.waitForParsing] Indicates whether it should wait for the blockchain parsing to complete
   *                                         before starting its internal processing
   * @param {getMetadataCallback} cb The callback for handling the result
   */
  function getAssetMetadata(args, cb) {
    if (args.waitForParsing) {
      parseControl.doProcess(getAssetMetadata_innerProcess);
    }
    else {
      getAssetMetadata_innerProcess();
    }

    function getAssetMetadata_innerProcess() {
      redis.hget('asset-metadata', args.assetId, (err, metadata) => {
        if (err) {
          return cb(err);
        }

        if (!metadata) {
          // Return indicating that no metadata was found
          return cb();
        }

        let parsedMetadata;

        try {
          parsedMetadata = JSON.parse(metadata);
        }
        catch (err) {
          return cb(err);
        }

        cb(null, parsedMetadata);
      });
    }
  }

  /**
   * API method used to retrieve the metadata associated with a non-fungible token
   * @param {Object} args
   * @param {string} args.tokenId The non-fungible token ID
   * @param {boolean} [args.waitForParsing] Indicates whether it should wait for the blockchain parsing to complete
   *                                        before starting its internal processing
   * @param {getMetadataCallback} cb The callback for handling the result
   */
  function getNFTokenMetadata(args, cb) {
    if (args.waitForParsing) {
      parseControl.doProcess(getNFTokenMetadata_innerProcess);
    }
    else {
      getNFTokenMetadata_innerProcess();
    }

    function getNFTokenMetadata_innerProcess() {
      redis.hget('nftoken-metadata', args.tokenId, (err, metadata) => {
        if (err) {
          return cb(err);
        }

        if (!metadata) {
          // Return indicating that no metadata was found
          return cb();
        }

        let parsedMetadata;

        try {
          parsedMetadata = JSON.parse(metadata);
        }
        catch (err) {
          return cb(err);
        }

        cb(null, parsedMetadata);
      });
    }
  }

  /**
   * Non-fungible token issuance info
   * @typedef {Object} NFTokenIssuance
   * @property {string} assetId The Colored Coins asset ID of the asset to which the non-fungible token pertains
   * @property {string} txid The ID of the transaction that issued the non-fungible token
   */

  /**
   * Callback for handling the result of getting the issuance info of a non-fungible token
   * @callback getNFTokenIssuanceCallback
   * @param {*} [error] An error message, or null if the function successfully returned
   * @param {NFTokenIssuance} [issuance] The returned non-fungible token issuance info
   */

  /**
   * API method used to retrieve the issuance information of a non-fungible token
   * @param {Object} args
   * @param {string} args.tokenId The non-fungible token ID
   * @param {boolean} [args.waitForParsing] Indicates whether it should wait for the blockchain parsing to complete
   *                                         before starting its internal processing
   * @param {getNFTokenIssuanceCallback} cb The callback for handling the result
   */
  function getNFTokenIssuance(args, cb) {
    if (args.waitForParsing) {
      parseControl.doProcess(getNFTokenIssuance_innerProcess);
    }
    else {
      getNFTokenIssuance_innerProcess();
    }

    function getNFTokenIssuance_innerProcess() {
      redis.hget('nftoken-issuance', args.tokenId, (err, strIssuance) => {
        if (err) {
          return cb(err);
        }

        if (!strIssuance) {
          // Return indicating that no issuance info was found for the given non-fungible token ID
          return cb();
        }

        let issuance;

        try {
          issuance = JSON.parse(strIssuance);
        }
        catch (err) {
          return cb(err);
        }

        cb(null, issuance);
      });
    }
  }

  /**
   * Data structure containing information about the possession of a non-fungible token
   * @typedef {Object} NFTokenHolding
   * @property {(string|undefined)} address The bitcoin address that holds the non-fungible token. Can be set to
   *                                         undefined to indicate that the non-fungible token is not currently held
   *                                         by any address (e.g. a burnt non-fungible token)
   * @property {boolean} unconfirmed Indicates whether the possession is still unconfirmed (paying bitcoin tx is not
   *                                  yet confirmed).
   */

  /**
   * Callback for handling the result of getting a non-fungible token holding information
   * @callback getNFTokenHoldingInfoCallback
   * @param {*} [error] An error message, or null if the function successfully returned
   * @param {NFTokenHolding} [holdingInfo] The info about the non-fungible token possession
   */

  /**
   * Get non-fungible token holding information
   * @param {string} tokenId The non-fungible token ID
   * @param {number} numOfConfirmations Minimum required confirmations that a (non-fungible token paying) bitcoin tx
   *                                     needs to have to be included in the processing
   * @param {string[]} [filterAddresses] A list of bitcoin addresses used to restrict the search for an UTXO that
   *                                      currently holds the non-fungible token
   * @param {getNFTokenHoldingInfoCallback} cb The callback for handling the result
   * @private
   */
  function _getNFTokenHoldingInfo(tokenId, numOfConfirmations, filterAddresses,  cb) {
    if (typeof filterAddresses === 'function') {
      cb = filterAddresses;
      filterAddresses = undefined;
    }

    // Get addresses associated with non-fungible token
    redis.hget('nftoken-addresses', tokenId, (err, strAddresses) => {
      if (err) {
        return cb(err);
      }

      if (!strAddresses) {
        // Return indicating that no possession info was found for the given non-fungible token ID
        return cb();
      }

      let addresses;

      try {
        addresses = JSON.parse(strAddresses);
      }
      catch (err) {
        return cb(err);
      }

      if (filterAddresses) {
        // Only take into account the specified addresses
        addresses = addresses.filter((address) => filterAddresses.indexOf(address) !== -1);
      }

      if (addresses.length > 0) {
        // Retrieve UTXOs associated with non-fungible token addresses
        bitcoin.cmd('listunspent', [numOfConfirmations, 99999999, addresses], (err, utxos) => {
          if (err) {
            return cb(err);
          }

          let tokenHoldingInfo;

          async.each(utxos, function (utxo, cb) {
            // Identify UTXO that contains non-fungible token
            redis.hget('utxos', utxo.txid + ':' + utxo.vout, function (err, strAssets) {
              if (err) {
                return cb(err);
              }

              if (tokenHoldingInfo || !strAssets) {
                // UTXO containing non-fungible token already identified, or
                //  no assets assigned to this UTXO. Nothing to do
                return cb();
              }

              let assets;

              try {
                assets = JSON.parse(strAssets);
              }
              catch (err) {
                return cb(err);
              }

              for (const asset of assets) {
                if (asset.tokenId === tokenId) {
                  // Save non-fungible token holding info, and stop iteration
                  tokenHoldingInfo = {
                    address: utxo.address,
                    unconfirmed: utxo.confirmations === 0
                  };

                  break;
                }
              }

              cb();
            });
          }, function (err) {
            if (err) {
              return cb(err);
            }

            if (!tokenHoldingInfo) {
              // No UTXO currently contains that non-fungible token. So set holding info accordingly
              tokenHoldingInfo = {
                address: undefined,
                unconfirmed: false
              }
            }

            cb(null, tokenHoldingInfo);
          });
        });
      }
      else {
        // Empty list of addresses. Return indicating that no address currently holds that non-fungible token
        cb(null, {
          address: undefined,
          unconfirmed: false
        });
      }
    });
  }

  /**
   * Callback for handling the result of getting the bitcoin address that currently holds a non-fungible token
   * @callback getNFTokenOwnerCallback
   * @param {*} [error] An error message, or null if the function successfully returned
   * @param {(NFTokenHolding|boolean)} [holdingInfo] The info about the non-fungible token possession, or the boolean
   *                                                  value false indicating that the specified addresses do not hold
   *                                                  the non-fungible token
   */

  /**
   * API method used to get the bitcoin address that currently holds a non-fungible token
   * @param {Object} args
   * @param {string} args.tokenId The non-fungible token ID
   * @param {number} [args.numOfConfirmations=0] Minimum required confirmations that a (non-fungible token paying)
   *                                              bitcoin tx needs to have to be included in the processing
   * @param {string[]} [args.addresses] A list of bitcoin addresses specifying the addresses that are expected to hold
   *                                     the non-fungible token. If the non-fungible token is not currently held by
   *                                     any of these addresses, a false value is returned instead
   * @param {boolean} [args.waitForParsing] Indicates whether it should wait for the blockchain parsing to complete
   *                                         before starting its internal processing
   * @param {getNFTokenOwnerCallback} cb The callback for handling the result
   */
  function getNFTokenOwner(args, cb) {
    const numOfConfirmations = args.numOfConfirmations || 0;
    const filterAddresses = args.addresses;

    if (args.waitForParsing) {
      parseControl.doProcess(getNFTokenOwner_innerProcess);
    }
    else {
      getNFTokenOwner_innerProcess();
    }

    function getNFTokenOwner_innerProcess() {
      _getNFTokenHoldingInfo(args.tokenId, numOfConfirmations, filterAddresses, (err, holdingInfo) => {
        if (err) {
          cb(err);
        }
        else {
          cb(
            null,
            filterAddresses && holdingInfo && !holdingInfo.address
              ? false
              : holdingInfo
          );
        }
      });
    }
  }

  /**
   * Callback for handling the result of retrieving a list of all non-fungible tokens currently issued for a
   *  non-fungible asset
   * @callback getIssuedNFTokensCallback
   * @param {*} [error] An error message, or null if the function successfully returned
   * @param {string[]} [tokenIds] List of issued non-fungible tokens. Will be an empty list if the specified asset ID
   *                               does not correspond to a non-fungible asset
   */

  /**
   * Retrieve a list of all non-fungible tokens currently issued for a non-fungible asset
   * @param assetId The asset ID
   * @param {getIssuedNFTokensCallback} cb The callback for handling the result
   * @private
   */
  function _getIssuedNFTokens(assetId, cb) {
    // Get transactions used to issue asset
    redis.hget('asset-issuance', assetId, (err, strIssuance) => {
      if (err) {
        return cb(err);
      }

      if (!strIssuance) {
        // Return indicating that no issued non-fungible token was found for the given asset ID
        return cb();
      }

      let issuance;

      try {
        issuance = JSON.parse(strIssuance);
      } catch (err) {
        return cb(err);
      }

      const issuedTokenIds = new Set();

      async.eachSeries(Object.keys(issuance), function (txid, cb) {
        const txIssuance = issuance[txid];

        if (txIssuance.aggregationPolicy !== 'nonFungible') {
          // Not a non-fungible asset. Nothing to do
          return cb();
        }

        // Get issued non-fungible tokens
        redis.hget('transaction-utxos', txid, (err, strUtxos) => {
          if (err) {
            return cb(err);
          }

          let utxos;

          try {
            utxos = JSON.parse(strUtxos);
          }
          catch (err) {
            return cb(err);
          }

          async.each(utxos, function (utxo, cb) {
            redis.hget('utxos', utxo, (err, strAssets) => {
              if (err) {
                return bc(err);
              }

              let assets;

              try {
                assets = JSON.parse(strAssets);
              }
              catch (err) {
                return cb(err);
              }

              for (const asset of assets) {
                if (asset.assetId === assetId && asset.issueTxid === txid && asset.tokenId) {
                  if (issuedTokenIds.has(asset.tokenId)) {
                    // Inconsistency: non-fungible token should not be listed more than once by UTXOs.
                    //  Return error
                    return cb(new Error(`Non-fungible token (tokenId: ${asset.tokenId}) should not be listed more than once by UTXOs`));
                  }

                  // Record issued non-fungible token ID
                  issuedTokenIds.add(asset.tokenId);
                }
              }

              cb();
            });
          }, cb);
        });
      }, err => {
        if (err) {
          return cb(err);
        }

        // Return issued non-fungible token IDs
        cb(null, Array.from(issuedTokenIds));
      });
    });
  }

  /**
   * Callback for handling the result of retrieving the bitcoin addresses that currently hold each of the non-fungible
   *  tokens pertaining to a non-fungible asset
   * @callback getAllNFTokensOwnerCallback
   * @param {*} [error] An error message, or null if the function successfully returned
   * @param {Object.<string, NFTokenHolding>} [tokenIdHoldingInfo] A dictionary of info about non-fungible token
   *                                                                possession by token ID
   */

  /**
   * API method used to retrieve the bitcoin addresses that currently hold each of the non-fungible tokens pertaining
   *  to a non-fungible asset
   * @param {Object} args
   * @param {string} args.assetId The asset ID
   * @param {number} [args.numOfConfirmations=0] Minimum required confirmations that a (non-fungible token paying)
   *                                              bitcoin tx needs to have to be included in the processing
   * @param {string[]} [args.addresses] A list of bitcoin addresses used to restrict the non-fungible tokens to be
   *                                     included in the processing. Only the non-fungible tokens currently held by any
   *                                     of these addresses should be returned
   * @param {boolean} [args.waitForParsing] Indicates whether it should wait for the blockchain parsing to complete
   *                                         before starting its internal processing
   * @param {getAllNFTokensOwnerCallback} cb The callback for handling the result
   */
  function getAllNFTokensOwner(args, cb) {
    const numOfConfirmations = args.numOfConfirmations || 0;
    const filterAddresses = args.addresses;

    if (args.waitForParsing) {
      parseControl.doProcess(getAllNFTokensOwner_innerProcess);
    }
    else {
      getAllNFTokensOwner_innerProcess();
    }

    function getAllNFTokensOwner_innerProcess() {
      _getIssuedNFTokens(args.assetId, (err, tokenIds) => {
        if (err) {
          return cb(err);
        }

        if (!tokenIds || tokenIds.length === 0) {
          // Return indicating that no issued non-fungible token was found for the given asset ID
          return cb();
        }

        const tokenIdHoldingInfo = {};

        async.eachSeries(tokenIds, function(tokenId, cb) {
          _getNFTokenHoldingInfo(tokenId, numOfConfirmations, filterAddresses, (err, holdingInfo) => {
            if (err) {
              return cb(err);
            }

            if (!filterAddresses || (holdingInfo && holdingInfo.address)) {
              // Record non-fungible token holding info
              tokenIdHoldingInfo[tokenId] = holdingInfo;
            }

            cb();
          });
        }, err => {
          if (err) {
            return cb(err);
          }

          cb(null, tokenIdHoldingInfo);
        });
      });
    }
  }

  /**
   * Data structured containing information about an owned non-fungible token
   * @typedef {Object} OwnedNFToken
   * @property {string} tokenId The non-fungible token ID
   * @property {boolean} unconfirmed Indicates whether the possession is still unconfirmed (paying bitcoin tx is not
   *                                  yet confirmed).
   */

  /**
   * Callback for handling the result of retrieving the non-fungible tokens currently held by a set of bitcoin addresses
   * @callback getOwnedNFTokensCallback
   * @param {*} [error] An error message, or null if the function successfully returned
   * @param {Object.<string, OwnedNFToken[]>} [asseIdOwnedInfos] A dictionary of info about owned non-fungible tokens by
   *                                                              asset ID
   */

  /**
   * API method used to retrieve the non-fungible tokens currently held by a set of bitcoin addresses
   * @param {Object} args
   * @param {string[]} args.addresses The list of bitcoin addresses
   * @param {string} [args.assetId] The optional asset ID to filter the result. If set, only non-fungible tokens that
   *                                 pertain to that (non-fungible) asset are returned
   * @param {number} [args.numOfConfirmations=0] Minimum required confirmations that a (non-fungible token paying)
   *                                              bitcoin tx needs to have to be included in the processing
   * @param {boolean} [args.waitForParsing] Indicates whether it should wait for the blockchain parsing to complete
   *                                         before starting its internal processing
   * @param {getOwnedNFTokensCallback} cb The callback for handling the result
   */
  function getOwnedNFTokens(args, cb) {
    const addresses = args.addresses;
    const assetId = args.assetId;
    const numOfConfirmations = args.numOfConfirmations || 0;

    if (args.waitForParsing) {
      parseControl.doProcess(getOwnedNFTokens_innerProcess);
    }
    else {
      getOwnedNFTokens_innerProcess();
    }

    function getOwnedNFTokens_innerProcess() {
      if (!Array.isArray(addresses) || addresses.length === 0) {
        // Return indicating that bitcoin addresses could not be processed
        return cb();
      }

      // Retrieve UTXOs associated with given addresses
      bitcoin.cmd('listunspent', [numOfConfirmations, 99999999, addresses], function (err, utxos) {
        if (err) {
          return cb(err);
        }

        const assetIdOwnedInfos = {};
        const tokenIds = new Set();

        async.each(utxos, function (utxo, cb) {
          // Get assets associated with UTXO
          redis.hget('utxos', utxo.txid + ':' + utxo.vout, function (err, strAssets) {
            if (err) {
              return cb(err);
            }

            if (!strAssets) {
              // No assets assigned to UTXO. Nothing to do
              return cb();
            }

            let assets;

            try {
              assets = JSON.parse(strAssets);
            }
            catch (err) {
              return cb(err);
            }

            for (const asset of assets) {
              if ((!assetId || asset.assetId === assetId) && asset.tokenId) {
                if (tokenIds.has(asset.tokenId)) {
                  // Inconsistency: non-fungible token should not be listed more than once by UTXOs.
                  //  Return error
                  return cb(new Error(`Non-fungible token (tokenId: ${asset.tokenId}) should not be listed more than once by UTXOs`));
                }

                tokenIds.add(asset.tokenId);

                // Record non-fungible token owned info
                if (!(asset.assetId in assetIdOwnedInfos)) {
                  assetIdOwnedInfos[asset.assetId] = [];
                }

                assetIdOwnedInfos[asset.assetId].push({
                  tokenId: asset.tokenId,
                  unconfirmed: utxo.confirmations === 0
                });
              }
            }

            cb();
          });
        }, function (err) {
          if (err) {
            return cb(err);
          }

          cb(null, assetIdOwnedInfos);
        });
      });
    }
  }

  var injectColoredUtxos = function (method, params, ans, cb) {
    // TODO
    cb(null, ans)
  }

  var proxyBitcoinD = function (method, params, cb) {
    bitcoin.cmd(method, params, function (err, ans) {
      if (err) return cb(err)
      injectColoredUtxos(method, params, ans, cb)
    })
  }

  let toExport = {
    parse: parse,
    importAddresses: importAddresses,
    parseNow: parseNow,
    getAddressesUtxos: getAddressesUtxos,
    getUtxos: getUtxos,
    getTxouts: getTxouts,
    getAddressesTransactions: getAddressesTransactions,
    transmit: transmit,
    getInfo: getInfo,
    getAssetHolders: getAssetHolders,
    getAssetBalance: getAssetBalance,
    getMultiAssetBalance: getMultiAssetBalance,
    getAssetIssuance: getAssetIssuance,
    getAssetIssuingAddress: getAssetIssuingAddress,
    getOwningAssets: getOwningAssets,
    proxyBitcoinD: proxyBitcoinD,
    getAssetMetadata,
    getNFTokenMetadata,
    getNFTokenIssuance,
    getNFTokenOwner,
    getAllNFTokensOwner,
    getOwnedNFTokens,
    emitter: emitter
  };

  if (isMochaRunning()) {
    // Export additional variables/functions for testing
    toExport = {
      ...toExport,
      redis,
      bitcoin,
      network: bitcoinNetwork,
      decodeRawTransaction,
      parseTransaction,
      updateUtxosChanges,
      updateMempoolTransactionUtxosChanges,
      getColoredData,
      getCCMetadata,
      _getIssuedNFTokens
    };
  }

  return toExport;
}

function isMochaRunning() {
  return typeof global.it === 'function';
}

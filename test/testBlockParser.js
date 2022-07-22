/**
 * Created by claudio on 2021-12-30
 */
const util = require('util');
const assert = require('assert');
const bitcoinLib = require('bitcoinjs-lib');
const ccIssuanceEncoder = require('catenis-colored-coins/cc-issuance-encoder');
const async = require('async');
const blockParser = require('../src/block_parser');

const pubKeyLength = 33;

const parser = blockParser({
  parser:{
    parseControlLoggingOn:false
  },
  redisHost: 'catenis-local-1',
  network:'regtest',
  bitcoinHost: 'catenis-local-1',
  bitcoinPort: '18443',
  bitcoinUser: 'LocalRegtestNYRioBlockchainWizards',
  bitcoinPass: '52EBq4isiHq0xIM1DIs8lNrODPziLJCpQBOUj1tJdSI=',
  ipfsHost:'catenis-local-1'
});

function encodeMultiSigOutput (m, pubKeys) {
  if (typeof m !== 'number' || !Array.isArray(pubKeys)) {
    throw new TypeError('Method called with invalid parameters');
  }

  const n = pubKeys.length;

  if (n < m) {
    throw new TypeError('Not enough pubKeys provided');
  }

  return bitcoinLib.script.compile([].concat(
      bitcoinLib.script.OPS.OP_RESERVED + m,
      pubKeys,
      bitcoinLib.script.OPS.OP_RESERVED + n,
      bitcoinLib.script.OPS.OP_CHECKMULTISIG
  ));
}

function pubKeysFromLeftover(leftover) {
  const pubKeys = [];

  leftover.forEach((buf, idx) => {
    let lengthByte;

    if (idx === 0) {
      // Extract 'length' byte
      lengthByte = buf.slice(0, 1);
      buf = buf.slice(1);
    }
    else {
      lengthByte = Buffer.from('');
    }

    pubKeys.push(Buffer.concat([Buffer.from('03', 'hex'), Buffer.alloc(pubKeyLength - (buf.length + lengthByte.length + 1), 0), buf, lengthByte], pubKeyLength));
  });

  if (pubKeys.length > 0) {
    pubKeys.unshift(
      Buffer.concat([Buffer.from('03', 'hex'), Buffer.alloc(pubKeyLength - 1, 0xff)], pubKeyLength)
    );
  }

  return pubKeys;
}

describe('Get Colored Coins data', function () {
  const cid = Buffer.from('1220848d11b214b2d2f2c9c55495460e2a6c7a6568bdca9d74f16813c017e06cb6dd', 'hex');
  const data = {
    amount: 31,
    divisibility: 2,
    protocol: 0x4333,
    version: 0x02,
    lockStatus: true,
    aggregationPolicy: 'aggregatable',
    payments: []
  };
  const metadata = {
    metadata: {
      assetName: 'Test_asset_#389489455',
      issuer: 'Catenis',
      description: 'General purpose Catenis smart asset',
      urls: [
        {
          name: 'icon',
          url: 'https://catenis.io/logo/Catenis_large.png',
          mimeType: 'image/png',
          dataHash: '0a5e3d326c0dfd1f87cebdd63fa214faebb9a3d48234a8c7352186985f838261'
        }
      ],
      userData: {
        meta: [
          {
            key: 'ctnAssetId',
            value: 'a3oqSwBBqrrTevh3bFEj',
            type: 'String'
          }
        ]
      },
      verifications: {
        signed: {
          message: 'Catenis generated asset on Thu Dec 16 2021 11:12:45 GMT-0300 (Brasilia Standard Time)',
          signed_message: '-----BEGIN CMS-----\n' +
              'MIIDxwYJKoZIhvcNAQcCoIIDuDCCA7QCAQExDTALBglghkgBZQMEAgEwZAYJKoZI\n' +
              'hvcNAQcBoFcEVUNhdGVuaXMgZ2VuZXJhdGVkIGFzc2V0IG9uIFRodSBEZWMgMTYg\n' +
              'MjAyMSAxMToxMjo0NSBHTVQtMDMwMCAoQnJhc2lsaWEgU3RhbmRhcmQgVGltZSkx\n' +
              'ggM4MIIDNAIBATCBozCBlTELMAkGA1UEBhMCVVMxETAPBgNVBAgMCE5ldyBZb3Jr\n' +
              'MREwDwYDVQQHDAhOZXcgWW9yazENMAsGA1UECgwEQkNvVDEQMA4GA1UECwwHQ2F0\n' +
              'ZW5pczEQMA4GA1UEAwwHQ2F0ZW5pczEtMCsGCSqGSIb3DQEJARYeY2xhdWRpb0Bi\n' +
              'bG9ja2NoYWlub2Z0aGluZ3MuY29tAgkAj/KG589D+f4wCwYJYIZIAWUDBAIBoGkw\n' +
              'GAYJKoZIhvcNAQkDMQsGCSqGSIb3DQEHATAcBgkqhkiG9w0BCQUxDxcNMjExMjE2\n' +
              'MTQxMjQ1WjAvBgkqhkiG9w0BCQQxIgQgSKCJhxvWaCBVA3NuQ0PwibpDDH6MEAm9\n' +
              'aQVFtxOWg24wDQYJKoZIhvcNAQEBBQAEggIAkoHBgmWU5SdxByue/o2O3evcgULT\n' +
              'qtlo9YDuQa1enstzs54HOYkTkdCOCXcCcQEwmt+AXsL7EeAW8bhE4MxlW5kPkMLB\n' +
              'ZaDnG1t07ee1KV4sRqxOj+40rLmchR/niMn+isQLk9nCs6ihJ4hZqglBHUFVMyw9\n' +
              'l0Xf9jLNRqWJMx/uvAgb2hZlDL7u741SpqrhA0m/8Zb4bmkKc3+IPQxj5252fCdt\n' +
              '6GMBWPNqlOudEam4uE6pgxWfoW6ZCmuTW22U2eBhUJe9vOb7rr0ySDjEVOgazdWD\n' +
              'HgnG5V2Xg0RDtkQuoIAzGFq4pzmKx+6n5Ib3UrKUGhbLy/XygqbMEPjRsZSnMsi2\n' +
              'zQrl9x2cUoaLSLpFEDpDi2PkAdBLRBiqvPoXaWPvaZEowgqsIc3ILWKjaaDhuRjc\n' +
              'NN4oY6yqlt2WtvC72dyrwShj+bil02yFn97D9wGMEcghC5UyhjruZjvkUPKRiN+K\n' +
              'orz9LRExvapJH0ehnlSxKzyJFqQielhcGGDnEFW5J3YRUWkd87AKStGQJOANv0Eu\n' +
              'q5AsFiRi/dVFf50vFElhSSpCN2xBwSkMZoKoIJ4h8P7x/JhnT8W9M26rYf12oHPq\n' +
              'HGEgOM9f1ryN3WgQagVUvs6Z7EQr+NpmUp9FzyhfYOCXskAwhVrAt1eLCleUP47s\n' +
              'aPOOO37PudrIjXM=\n' +
              '-----END CMS-----\n',
          cert: '-----BEGIN CERTIFICATE-----\n' +
              'MIIF/zCCA+egAwIBAgIJAI/yhufPQ/n+MA0GCSqGSIb3DQEBCwUAMIGVMQswCQYD\n' +
              'VQQGEwJVUzERMA8GA1UECAwITmV3IFlvcmsxETAPBgNVBAcMCE5ldyBZb3JrMQ0w\n' +
              'CwYDVQQKDARCQ29UMRAwDgYDVQQLDAdDYXRlbmlzMRAwDgYDVQQDDAdDYXRlbmlz\n' +
              'MS0wKwYJKoZIhvcNAQkBFh5jbGF1ZGlvQGJsb2NrY2hhaW5vZnRoaW5ncy5jb20w\n' +
              'HhcNMTcwOTI5MTQ1NzQ5WhcNMTgwOTI5MTQ1NzQ5WjCBlTELMAkGA1UEBhMCVVMx\n' +
              'ETAPBgNVBAgMCE5ldyBZb3JrMREwDwYDVQQHDAhOZXcgWW9yazENMAsGA1UECgwE\n' +
              'QkNvVDEQMA4GA1UECwwHQ2F0ZW5pczEQMA4GA1UEAwwHQ2F0ZW5pczEtMCsGCSqG\n' +
              'SIb3DQEJARYeY2xhdWRpb0BibG9ja2NoYWlub2Z0aGluZ3MuY29tMIICIjANBgkq\n' +
              'hkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAsARqZRD6XftbEPxplIkaiWVQ70QzRRx6\n' +
              'DKQNRQPxZYvrX8mO7aZtoMZfWeavC7Z/EqF1+kZXt3+dwJ5a/SyHwATAYBytuY9h\n' +
              'mK0AL8851GrisVbbsqjnNAIR07NeZYr89679udics99Zt1XfI1Z1IvceuUB22pXB\n' +
              '0ON+Yrxbac+s0VmJ75VdGOdYGbzTMmkUC8jCUKTsdQ/CBJ9Zfeu9kbEUS6EdJ7Di\n' +
              'GIkmAt9MxbzJLO4I3Fs4SGu6d53OxPKaskRrM1BezTTwJLgfezNlQRNzt4KgAXz+\n' +
              '8OFkfnIV3UakZ0d7rOylEJLRT/A13BvDIzDSbOOTyaK2vSPXCchaFJMlDvF/C7lG\n' +
              'tQl6hri6HzFy5gSPxXbRyGOdFxldBTPeqwVKeqs50EBsu9d7tKdOWpJjxk4gZkS2\n' +
              'qaVb1nACnIiJsKVWq1rWl2zpnPmlKO/Fy2+lg2X99iNojlkWEhL3IoyKa/5GlFJ0\n' +
              '9yKhShDxWeDwbg/RTNVwtb5iNXxG/wvi4k5RTLfUIAM63YhW/KU6n+nIT/Xb3yTq\n' +
              'Wuf6uTTlcXBzmCtmujXcg2CnFo2a1rHp3y01YV2VzH3Xfa8tgyFg016LCB413haF\n' +
              '9LWzJY7Meg4nWCDRzKEXZdeMWLkhiEhX0Jr+4/QSl3/e8ibBK4Azf6ofAQJ/Sc3O\n' +
              'yOSx9Q8ZO60CAwEAAaNQME4wHQYDVR0OBBYEFEZpLW2vuI+AlCFdJgUUFbpQt04s\n' +
              'MB8GA1UdIwQYMBaAFEZpLW2vuI+AlCFdJgUUFbpQt04sMAwGA1UdEwQFMAMBAf8w\n' +
              'DQYJKoZIhvcNAQELBQADggIBAGcvJHY7+Q8yiIaOFlrklV1QDL8ZXj6amPoGq/R3\n' +
              'NfaFb13JRLuHGrFdSGycQIkXtlk0gPTydxuMtOLFKCD64UAJ1Oc/YsMR7DWC5ZPg\n' +
              'WeTkEfz/aeGmvydSYNlyM6L29O+Wh6rskaTZhzcHVj+3OLkdRyrKfVPgpFKffADu\n' +
              '1zXYUCjH4VTEfw4uoyIfPYZpO1jX8GoLgeEP1bHQVObhqiznjNqM9BrZjq0qYK4o\n' +
              '+eYsILPOZ+xhAa2rlitkZg9mrWDVgxr4Q5hGHc6cGjeg64xy9JYdzclvtvTe9Lcr\n' +
              'wbzu1AMsAJCRuAt6enEAnqRY9P89l0zR/8k03PCg/sXkqvbN/Ho+OExuWUSzmXiL\n' +
              '8UpWhd+FKxHCUUdMpi0HvoIzVeYOIdjJUR1zAXwfeZf5HCGVjLiRixhdrFLlYo6z\n' +
              '4opMV5kh4afmctEiKbAGJjn3gQ+zvhAx9dBATQ8DKETvtdchyICsJUEqzJUVh4Xf\n' +
              '4ozwViuR1Lte3QADLKRO64t2wyZM+nLAFvtBTz2qYOk5brIrxQlXinKl4JnglB+s\n' +
              'BpmWPNWRMZvki1WwdnJ7LGq1v6bY8iLKKxXoIoH5FIcZMMJXW71vBd0Xa3Jl8l3P\n' +
              'QeRegjIP2eZ465ECOHvCM8WxpiVRcLeOwMgMUaHXLWXr/Pj94a4wsKABcWnd5EQD\n' +
              '5Pu0\n' +
              '-----END CERTIFICATE-----\n'
        }
      }
    }
  };

  it('Issuance with whole CID in null data output', function (done) {
    this.timeout(0);

    data.amount = 32;  // Change amount to occupy 2 bytes so that number of remaining bytes in null data is odd
    data.cid = cid;

    // Reset payments adding as many as possible to keep metadata (1-byte length + CID) in null data output
    data.payments = [];
    for (let i = 0; i < 19; i++) {
      data.payments.push({skip: false, range: false, percent: false, output: 1, amount: 1});
    }

    const code = ccIssuanceEncoder.encode(data, 80);
    const tx = new bitcoinLib.Transaction();

    const nullData = bitcoinLib.payments.embed({
      data: [code.codeBuffer],
      network: parser.network
    });

    tx.addOutput(nullData.output, 0);

    const pubKeys = pubKeysFromLeftover(code.leftover);

    if (pubKeys.length > 0) {
      tx.addOutput(encodeMultiSigOutput(pubKeys.length - 1, pubKeys), 600);
    }

    const transaction = parser.decodeRawTransaction(tx);

    parser.getColoredData(transaction, (err, ccData) => {
      if (err) {
        done(err);
      }
      else {
        try {
          assert.deepEqual(ccData, {
            protocol: data.protocol,
            version: data.version,
            type: 'issuance',
            amount: data.amount,
            lockStatus: data.lockStatus,
            divisibility: data.divisibility,
            aggregationPolicy: data.aggregationPolicy,
            payments: data.payments.map(p => ({
              input: 0,
              range: p.range,
              percent: p.percent,
              output: p.output,
              amount: p.amount
            })),
            cid: data.cid.toString('hex'),
            multiSig: [],
            metadata
          });
        }
        catch (err) {
          return done(err);
        }

        done();
      }
    });
  });

  it('Issuance with beginning of the CID in null data output and remainder in a single key of a multisig output', function (done) {
    this.timeout(0);

    data.amount = 31;  // Change amount back to occupy a single byte

    // Add one more payment
    for (let i = 0 ; i < 1 ; i++) {
      data.payments.push({skip: false, range: false, percent: false, output: 1, amount: 1});
    }

    const code = ccIssuanceEncoder.encode(data, 80);
    const tx = new bitcoinLib.Transaction();

    const nullData = bitcoinLib.payments.embed({
      data: [code.codeBuffer],
      network: parser.network
    });

    tx.addOutput(nullData.output, 0);

    const pubKeys = pubKeysFromLeftover(code.leftover);

    if (pubKeys.length > 0) {
      tx.addOutput(encodeMultiSigOutput(pubKeys.length - 1, pubKeys), 600);
    }

    const transaction = parser.decodeRawTransaction(tx);

    parser.getColoredData(transaction, (err, ccData) => {
      if (err) {
        done(err);
      }
      else {
        try {
          assert.deepEqual(ccData, {
            protocol: data.protocol,
            version: data.version,
            type: 'issuance',
            amount: data.amount,
            lockStatus: data.lockStatus,
            divisibility: data.divisibility,
            aggregationPolicy: data.aggregationPolicy,
            payments: data.payments.map(p => ({
              input: 0,
              range: p.range,
              percent: p.percent,
              output: p.output,
              amount: p.amount
            })),
            cid: data.cid.slice(0, -1).toString('hex'),
            multiSig: [
              {index: 1, hashType: 'cid'}
            ],
            metadata
          });
        }
        catch (err) {
          return done(err);
        }

        done();
      }
    });
  });

  it('Issuance with beginning of the CID in null data output and remainder in two keys of a multisig output', function (done) {
    this.timeout(0);

    // Reset payments
    data.payments = [];
    for (let i = 0 ; i < 36 ; i++) {
      data.payments.push({skip: false, range: false, percent: false, output: 1, amount: 1});
    }

    const code = ccIssuanceEncoder.encode(data, 80);
    const tx = new bitcoinLib.Transaction();

    const nullData = bitcoinLib.payments.embed({
      data: [code.codeBuffer],
      network: parser.network
    });

    tx.addOutput(nullData.output, 0);

    const pubKeys = pubKeysFromLeftover(code.leftover);

    if (pubKeys.length > 0) {
      tx.addOutput(encodeMultiSigOutput(pubKeys.length - 1, pubKeys), 600);
    }

    const transaction = parser.decodeRawTransaction(tx);

    parser.getColoredData(transaction, (err, ccData) => {
      if (err) {
        done(err);
      }
      else {
        try {
          assert.deepEqual(ccData, {
            protocol: data.protocol,
            version: data.version,
            type: 'issuance',
            amount: data.amount,
            lockStatus: data.lockStatus,
            divisibility: data.divisibility,
            aggregationPolicy: data.aggregationPolicy,
            payments: data.payments.map(p => ({
              input: 0,
              range: p.range,
              percent: p.percent,
              output: p.output,
              amount: p.amount
            })),
            cid: data.cid.slice(0, 1).toString('hex'),
            multiSig: [
              {index: 1, hashType: 'cid'},
              {index: 2, hashType: 'cid'}
            ],
            metadata
          });
        }
        catch (err) {
          return done(err);
        }

        done();
      }
    });
  });

  it('Issuance with the whole CID in two keys of a multisig output', function (done) {
    this.timeout(0);

    // Add one more payment
    for (let i = 0 ; i < 1 ; i++) {
      data.payments.push({skip: false, range: false, percent: false, output: 1, amount: 1});
    }

    const code = ccIssuanceEncoder.encode(data, 80);
    const tx = new bitcoinLib.Transaction();

    const nullData = bitcoinLib.payments.embed({
      data: [code.codeBuffer],
      network: parser.network
    });

    tx.addOutput(nullData.output, 0);

    const pubKeys = pubKeysFromLeftover(code.leftover);

    if (pubKeys.length > 0) {
      tx.addOutput(encodeMultiSigOutput(pubKeys.length - 1, pubKeys), 600);
    }

    const transaction = parser.decodeRawTransaction(tx);

    parser.getColoredData(transaction, (err, ccData) => {
      if (err) {
        done(err);
      }
      else {
        try {
          assert.deepEqual(ccData, {
            protocol: data.protocol,
            version: data.version,
            type: 'issuance',
            amount: data.amount,
            lockStatus: data.lockStatus,
            divisibility: data.divisibility,
            aggregationPolicy: data.aggregationPolicy,
            payments: data.payments.map(p => ({
              input: 0,
              range: p.range,
              percent: p.percent,
              output: p.output,
              amount: p.amount
            })),
            multiSig: [
              {index: 1, hashType: 'cid'},
              {index: 2, hashType: 'cid'}
            ],
            metadata
          });
        }
        catch (err) {
          return done(err);
        }

        done();
      }
    });
  });

  it('decodeRawTransaction should not include Colored Coins data if called without a callback', function () {
    this.timeout(0);

    // Add a single payment
    data.payments = [
      {skip: false, range: false, percent: false, output: 1, amount: 1}
    ];

    const code = ccIssuanceEncoder.encode(data, 80);
    const tx = new bitcoinLib.Transaction();

    const nullData = bitcoinLib.payments.embed({
      data: [code.codeBuffer],
      network: parser.network
    });

    tx.addOutput(nullData.output, 0);

    const pubKeys = pubKeysFromLeftover(code.leftover);

    if (pubKeys.length > 0) {
      tx.addOutput(encodeMultiSigOutput(pubKeys.length - 1, pubKeys), 600);
    }

    const transaction = parser.decodeRawTransaction(tx);

    assert.equal(transaction.colored, undefined);
    assert.equal(transaction.ccdata, undefined);
  });

  it('decodeRawTransaction should include Colored Coins data if called with a callback', function (done) {
    this.timeout(0);

    const code = ccIssuanceEncoder.encode(data, 80);
    const tx = new bitcoinLib.Transaction();

    const nullData = bitcoinLib.payments.embed({
      data: [code.codeBuffer],
      network: parser.network
    });

    tx.addOutput(nullData.output, 0);

    const pubKeys = pubKeysFromLeftover(code.leftover);

    if (pubKeys.length > 0) {
      tx.addOutput(encodeMultiSigOutput(pubKeys.length - 1, pubKeys), 600);
    }

    parser.decodeRawTransaction(tx, (err, transaction) => {
      if (err) {
        done(err);
      }
      else {
        try {
          assert.equal(transaction.colored, true);
          assert.deepEqual(transaction.ccdata, [{
            protocol: data.protocol,
            version: data.version,
            type: 'issuance',
            amount: data.amount,
            lockStatus: data.lockStatus,
            divisibility: data.divisibility,
            aggregationPolicy: data.aggregationPolicy,
            payments: data.payments.map(p => ({
              input: 0,
              range: p.range,
              percent: p.percent,
              output: p.output,
              amount: p.amount
            })),
            cid: data.cid.toString('hex'),
            multiSig: [],
            metadata
          }]);
        }
        catch (err) {
          return done(err);
        }

        done();
      }
    });
  });
});

describe('Get colored Coins metadata', function () {
  const testCCData = [
    // Issuance, regular asset
    {
      protocol: 0x4333,
      version: 0x02,
      type: 'issuance',
      amount: 1,
      lockStatus: true,
      divisibility: 0,
      aggregationPolicy: 'aggregatable'
    },
    // Issuance, non-fungible asset (3 non-fungible tokens)
    {
      protocol: 0x4333,
      version: 0x02,
      type: 'issuance',
      amount: 3,
      lockStatus: true,
      divisibility: 0,
      aggregationPolicy: 'nonFungible'
    },
    // Transfer asset
    {
      protocol: 0x4333,
      version: 0x02,
      type: 'transfer',
      amount: 1,
      lockStatus: true,
      divisibility: 0,
      aggregationPolicy: 'aggregatable'
    }
  ];
  const testMetadata = {
    metadata: {
      assetName: 'Test_asset_#1',
      issuer: 'Catenis',
      description: 'General purpose Catenis smart asset',
      urls: [
        {
          name: 'icon',
          url: 'https://catenis.io/logo/Catenis_large.png',
          mimeType: 'image/png',
          dataHash: '0a5e3d326c0dfd1f87cebdd63fa214faebb9a3d48234a8c7352186985f838261'
        }
      ],
      userData: {
        meta: [
          {
            key: 'ctnAssetId',
            value: 'a3oqSwBBqrrTevh3bFEj',
            type: 'String'
          }
        ]
      },
      verifications: {
      }
    }
  };
  const testNFTokenMetadata = [
    // For 3 new non-fungible tokens
    {
      newTokens: [
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_1',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #1',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu',
              type: 'URL'
            }
          ]
        },
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_2',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #2',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR',
              type: 'URL'
            }
          ]
        },
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_3',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #3',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmNrgEMcUygbKzZeZgYFosdd27VE9KnWbyUD73bKZJ3bGi',
              type: 'URL'
            }
          ]
        }
      ]
    },
    // For 2 existing non-fungible tokens
    {
      update: {
        Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: {
          meta: [
            {
              key: 'name',
              value: 'NFT_1',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #1 (updated)',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
              type: 'URL'
            }
          ]
        },
        Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: {
          meta: [
            {
              key: 'name',
              value: 'NFT_3',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #3 (updated)',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmNksJqvwHzNtAtYZVqFZFfdCVciY4ojTU2oFZQSFG9U7B',
              type: 'URL'
            }
          ]
        }
      }
    }
  ];
  const testTransaction = {
    vin: [{
      txid: '0f45f38a8bcd8331877267e0f3f5f8a4b3c716165e40db4eee34d52759ad954f',
      vout: 2
    }]
  };
  const testAssetIds = [
    // Regular asset
    'La8kMVUzB9RT2GGKpkpuWJgp1oTPVhehJuZZMD',
    // Non-fungible asset
    'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v'
  ]
  const testNFTokenIds = [
    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji',
    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is'
  ];

  it('Issue regular asset tx with metadata', function () {
    const tx = {
      ...testTransaction,
      ccdata: [
        {
          ...testCCData[0],
          metadata: testMetadata
        }
      ]
    };

    const metadata = parser.getCCMetadata(tx);
    const assetMetadata = {};
    assetMetadata[testAssetIds[0]] = testMetadata.metadata;
    assert.deepEqual(metadata, {
      asset: assetMetadata
    });
  });

  it('Issue non-fungible asset tx with asset & non-fungible tokens metadata', function () {
    const tx = {
      ...testTransaction,
      ccdata: [
        {
          ...testCCData[1],
          metadata: {
            ...testMetadata,
            nfTokenMetadata: testNFTokenMetadata[0]
          }
        }
      ]
    };

    const metadata = parser.getCCMetadata(tx);
    const assetMetadata = {};
    assetMetadata[testAssetIds[1]] = testMetadata.metadata;
    const nfTokenMetadata = {};
    nfTokenMetadata[testNFTokenIds[0]] = testNFTokenMetadata[0].newTokens[0];
    nfTokenMetadata[testNFTokenIds[1]] = testNFTokenMetadata[0].newTokens[1];
    nfTokenMetadata[testNFTokenIds[2]] = testNFTokenMetadata[0].newTokens[2];
    assert.deepEqual(metadata, {
      asset: assetMetadata,
      nonFungibleToken: nfTokenMetadata
    });
  });

  it('Issue non-fungible asset tx with asset & non-fungible tokens metadata (with update)', function () {
    const tx = {
      ...testTransaction,
      ccdata: [
        {
          ...testCCData[1],
          metadata: {
            ...testMetadata,
            nfTokenMetadata: {
              ...testNFTokenMetadata[0],
              ...testNFTokenMetadata[1]
            }
          }
        }
      ]
    };

    const metadata = parser.getCCMetadata(tx);
    const assetMetadata = {};
    assetMetadata[testAssetIds[1]] = testMetadata.metadata;
    const nfTokenMetadata = {};
    nfTokenMetadata[testNFTokenIds[0]] = testNFTokenMetadata[1].update[testNFTokenIds[0]];
    nfTokenMetadata[testNFTokenIds[1]] = testNFTokenMetadata[0].newTokens[1];
    nfTokenMetadata[testNFTokenIds[2]] = testNFTokenMetadata[1].update[testNFTokenIds[2]];
    assert.deepEqual(metadata, {
      asset: assetMetadata,
      nonFungibleToken: nfTokenMetadata
    });
  });

  it('Transfer asset tx with no metadata', function () {
    const tx = {
      ...testTransaction,
      ccdata: [
        testCCData[2]
      ]
    };

    const metadata = parser.getCCMetadata(tx);
    assert.deepEqual(metadata, undefined);
  });

  it('Transfer asset tx with non-fungible tokens metadata update', function () {
    const tx = {
      ...testTransaction,
      ccdata: [
        {
          ...testCCData[1],
          metadata: {
            nfTokenMetadata: {
              ...testNFTokenMetadata[1]
            }
          }
        }
      ]
    };

    const metadata = parser.getCCMetadata(tx);
    const nfTokenMetadata = {};
    nfTokenMetadata[testNFTokenIds[0]] = testNFTokenMetadata[1].update[testNFTokenIds[0]];
    nfTokenMetadata[testNFTokenIds[2]] = testNFTokenMetadata[1].update[testNFTokenIds[2]];
    assert.deepEqual(metadata, {
      nonFungibleToken: nfTokenMetadata
    });
  });
});

describe('Parse & store Colored Coins tx with non-fungible tokens', function() {
  const testMetadata = [
    {
      metadata: {
        assetName: 'Test_asset_#1',
        issuer: 'Catenis',
        description: 'General purpose Catenis smart asset #1',
        urls: [
          {
            name: 'icon',
            url: 'https://catenis.io/logo/Catenis_large.png',
            mimeType: 'image/png',
            dataHash: '0a5e3d326c0dfd1f87cebdd63fa214faebb9a3d48234a8c7352186985f838261'
          }
        ],
        userData: {
          meta: [
            {
              key: 'ctnAssetId',
              value: 'a3oqSwBBqrrTevh3bFEj',
              type: 'String'
            }
          ]
        },
        verifications: {}
      }
    },
    {
      metadata: {
        assetName: 'Test_asset_#2',
        issuer: 'Catenis',
        description: 'General purpose Catenis smart asset #2',
        urls: [
          {
            name: 'icon',
            url: 'https://catenis.io/logo/Catenis_large.png',
            mimeType: 'image/png',
            dataHash: '0a5e3d326c0dfd1f87cebdd63fa214faebb9a3d48234a8c7352186985f838261'
          }
        ],
        userData: {
          meta: [
            {
              key: 'ctnAssetId',
              value: 'aQjlzShmrnEZeeYBZihc',
              type: 'String'
            }
          ]
        },
        verifications: {}
      }
    }
  ];
  const testNFTokenMetadata = [
    // For 3 new non-fungible tokens
    {
      newTokens: [
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_1',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #1',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu',
              type: 'URL'
            }
          ]
        },
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_2',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #2',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR',
              type: 'URL'
            }
          ]
        },
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_3',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #3',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmNrgEMcUygbKzZeZgYFosdd27VE9KnWbyUD73bKZJ3bGi',
              type: 'URL'
            }
          ]
        }
      ]
    },
    // For 2 existing non-fungible tokens
    {
      update: {
        Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: {
          meta: [
            {
              key: 'name',
              value: 'NFT_1',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #1 (updated)',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
              type: 'URL'
            }
          ]
        },
        Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: {
          meta: [
            {
              key: 'name',
              value: 'NFT_2',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #2 (updated)',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR',
              type: 'URL'
            }
          ]
        }
      }
    },
    // For 1 new non-fungible tokens
    {
      newTokens: [
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_4',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #4',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmUPNgbkB2esFHLZdS5rhD8wxFaCBU8JeBrBePWqMfSWub',
              type: 'URL'
            }
          ]
        }
      ]
    },
    // For 1 new non-fungible tokens
    {
      newTokens: [
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_5',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #5',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmQ2UaYLHwSjU4VvHyD4SfCUyo7AvrufdNrX1kmsbtbn3w',
              type: 'URL'
            }
          ]
        }
      ]
    }
  ];
  const testTransactions = [
    // Issue locked non-fungible asset (with 3 non-fungible tokens)
    {
      txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff',
      vin: [{
        txid: '0f45f38a8bcd8331877267e0f3f5f8a4b3c716165e40db4eee34d52759ad954f',
        vout: 2
      }],
      vout: [
        {},
        {
          scriptPubKey: {addresses: ['bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu']}
        },
        {
          scriptPubKey: {addresses: ['bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr']}
        }
      ],
      ccdata: [
        {
          protocol: 0x4333,
          version: 0x02,
          type: 'issuance',
          amount: 3,
          lockStatus: true,
          divisibility: 0,
          aggregationPolicy: 'nonFungible',
          payments: [
            {
              input: 0, output:1, amount: 2
            },
            {
              input: 0, output:2, amount: 1
            }
          ],
          metadata: {
            ...testMetadata[0],
            nfTokenMetadata: testNFTokenMetadata[0]
          }
        }
      ]
    },
    // Issue unlocked non-fungible asset (with a single non-fungible token)
    {
      txid: '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd',
      vin: [{
        txid: '4c390c068554e3c15e4bc93c5def81ff1f36abe77f16a01c8f63c2eeddd3bcfd',
        vout: 1,
        address: 'bcrt1qkyq535qt8ksnhmvj4326mry7wmdsaewnclgljc'
      }],
      vout: [
        {},
        {
          scriptPubKey: {addresses: ['bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj']}
        }
      ],
      ccdata: [
        {
          protocol: 0x4333,
          version: 0x02,
          type: 'issuance',
          amount: 1,
          lockStatus: false,
          divisibility: 0,
          aggregationPolicy: 'nonFungible',
          payments: [
            {
              input: 0, output:1, amount: 1
            }
          ],
          metadata: {
            ...testMetadata[1],
            nfTokenMetadata: testNFTokenMetadata[2]
          }
        }
      ]
    },
    // Transfer 2 non-fungible tokens of locked asset
    {
      txid: '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa',
      vin: [{
        txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff',
        vout: 1
      }],
      vout: [
        {},
        {
          scriptPubKey: {addresses: ['bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn']}
        },
        {
          scriptPubKey: {addresses: ['bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t']}
        }
      ],
      ccdata: [
        {
          protocol: 0x4333,
          version: 0x02,
          type: 'transfer',
          amount: 2,
          payments: [
            {
              input: 0, output:1, amount: 1
            },
            {
              input: 0, output:2, amount: 1
            }
          ],
          metadata: {
            nfTokenMetadata: testNFTokenMetadata[1]
          }
        }
      ]
    },
    // Issue one more non-fungible token of unlocked asset
    {
      txid: 'eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb',
      vin: [{
        txid: '9e358d137e52bfe84b74ec0ad9303238b2b71dfafcdad282bce288ecf80326fb',
        vout: 6,
        address: 'bcrt1qkyq535qt8ksnhmvj4326mry7wmdsaewnclgljc'
      }],
      vout: [
        {},
        {
          scriptPubKey: {addresses: ['bcrt1q4hpeyu3ypl69msvasqj50qle9n5pveah9mm5hg']}
        }
      ],
      ccdata: [
        {
          protocol: 0x4333,
          version: 0x02,
          type: 'issuance',
          amount: 1,
          lockStatus: false,
          divisibility: 0,
          aggregationPolicy: 'nonFungible',
          payments: [
            {
              input: 0, output: 1, amount: 1
            }
          ],
          metadata: {
            nfTokenMetadata: testNFTokenMetadata[3]
          }
        }
      ]
    }
  ];
  const testAssetIds = [
    // Locked non-fungible asset
    'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
    // Unlocked non-fungible asset
    'Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe'
  ]
  const testNFTokenIds = [
    // Non-fungible tokens of locked asset
    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji',
    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is',
    // Non-fungible tokens of unlocked asset (1st issuance)
    'Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF',
    // Non-fungible tokens of unlocked asset (2nd issuance)
    'Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu'
  ];
  const utxosChanges = {
    used: {},
    unused: {},
    txids: []
  };
  const block = {
    height: 1,
    hash: '56df06036111a3984c8410112202ae5ebe161db72c0bcf21fdf3c7b5c10ba278',
    timestamp: 1641320814,
    mapTransaction: {}
  };
  const txProcResults = [
    // Results after processing tx #1
    {
      utxosChanges: {
        used: {},
        unused: {
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji"},{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M"}]',
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is"}]'
        },
        txids: [],
        metadata: {
          asset: {
            LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: testMetadata[0].metadata
          },
          nonFungibleToken: {
            Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: testNFTokenMetadata[0].newTokens[0],
            Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: testNFTokenMetadata[0].newTokens[1],
            Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: testNFTokenMetadata[0].newTokens[2]
          }
        }
      },
      database: {
        'utxos': {
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji"},{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M"}]',
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is"}]'
        },
        'transaction-utxos': {
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff': '["841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1","841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2"]'
        },
        'address-utxos': {
          bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu: '["841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1"]',
          bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr: '["841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2"]'
        },
        'asset-issuance': {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: '{"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff":{"divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible"}}'
        },
        'asset-addresses': {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: '["bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu","bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr"]'
        },
        'asset-metadata': {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: JSON.stringify(testMetadata[0].metadata)
        },
        'nftoken-issuance': {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: JSON.stringify({
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff'
          }),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: JSON.stringify({
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff'
          }),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: JSON.stringify({
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff'
          })
        },
        'nftoken-addresses': {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: '["bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu"]',
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: '["bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu"]',
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: '["bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr"]'
        },
        'nftoken-metadata': {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: JSON.stringify(testNFTokenMetadata[0].newTokens[0]),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: JSON.stringify(testNFTokenMetadata[0].newTokens[1]),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: JSON.stringify(testNFTokenMetadata[0].newTokens[2])
        }
      }
    },
    // Results after processing tx #2
    {
      utxosChanges: {
        used: {},
        unused: {
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji"},{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M"}]',
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is"}]',
          '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd:1': '[{"assetId":"Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe","amount":1,"issueTxid":"813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd","divisibility":0,"lockStatus":false,"aggregationPolicy":"nonFungible","tokenId":"Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF"}]'
        },
        txids: [],
        metadata: {
          asset: {
            LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: testMetadata[0].metadata,
            Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: testMetadata[1].metadata
          },
          nonFungibleToken: {
            Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: testNFTokenMetadata[0].newTokens[0],
            Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: testNFTokenMetadata[0].newTokens[1],
            Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: testNFTokenMetadata[0].newTokens[2],
            Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: testNFTokenMetadata[2].newTokens[0]
          }
        }
      },
      database: {
        'utxos': {
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji"},{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M"}]',
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is"}]',
          '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd:1': '[{"assetId":"Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe","amount":1,"issueTxid":"813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd","divisibility":0,"lockStatus":false,"aggregationPolicy":"nonFungible","tokenId":"Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF"}]'
        },
        'transaction-utxos': {
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff': '["841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1","841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2"]',
          '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd': '["813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd:1"]'
        },
        'address-utxos': {
          bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu: '["841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1"]',
          bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr: '["841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2"]',
          bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj: '["813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd:1"]'
        },
        'asset-issuance': {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: '{"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff":{"divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible"}}',
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: '{"813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd":{"divisibility":0,"lockStatus":false,"aggregationPolicy":"nonFungible"}}'
        },
        'asset-addresses': {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: '["bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu","bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr"]',
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: '["bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj"]'
        },
        'asset-metadata': {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: JSON.stringify(testMetadata[0].metadata),
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: JSON.stringify(testMetadata[1].metadata)
        },
        'nftoken-issuance': {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: JSON.stringify({
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff'
          }),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: JSON.stringify({
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff'
          }),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: JSON.stringify({
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff'
          }),
          Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: JSON.stringify({
            assetId: 'Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe',
            txid: '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd'
          })
        },
        'nftoken-addresses': {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: '["bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu"]',
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: '["bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu"]',
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: '["bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr"]',
          Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: '["bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj"]'
        },
        'nftoken-metadata': {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: JSON.stringify(testNFTokenMetadata[0].newTokens[0]),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: JSON.stringify(testNFTokenMetadata[0].newTokens[1]),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: JSON.stringify(testNFTokenMetadata[0].newTokens[2]),
          Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: JSON.stringify(testNFTokenMetadata[2].newTokens[0])
        }
      }
    },
    // Results after processing tx #3
    {
      utxosChanges: {
        used: {},
        unused: {
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji"},{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M"}]',
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is"}]',
          '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd:1': '[{"assetId":"Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe","amount":1,"issueTxid":"813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd","divisibility":0,"lockStatus":false,"aggregationPolicy":"nonFungible","tokenId":"Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF"}]',
          '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:1': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji"}]',
          '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:2': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M"}]'
        },
        txids: [],
        metadata: {
          asset: {
            LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: testMetadata[0].metadata,
            Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: testMetadata[1].metadata
          },
          nonFungibleToken: {
            Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: testNFTokenMetadata[1].update['Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji'],
            Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: testNFTokenMetadata[1].update['Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M'],
            Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: testNFTokenMetadata[0].newTokens[2],
            Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: testNFTokenMetadata[2].newTokens[0]
          }
        }
      },
      database: {
        'utxos': {
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji"},{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M"}]',
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is"}]',
          '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd:1': '[{"assetId":"Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe","amount":1,"issueTxid":"813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd","divisibility":0,"lockStatus":false,"aggregationPolicy":"nonFungible","tokenId":"Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF"}]',
          '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:1': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji"}]',
          '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:2': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M"}]'
        },
        'transaction-utxos': {
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff': '["841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1","841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2"]',
          '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd': '["813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd:1"]',
          '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa': '["3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:1","3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:2"]'
        },
        'address-utxos': {
          bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu: '["841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1"]',
          bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr: '["841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2"]',
          bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj: '["813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd:1"]',
          bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn: '["3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:1"]',
          bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t: '["3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:2"]'
        },
        'asset-issuance': {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: '{"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff":{"divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible"}}',
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: '{"813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd":{"divisibility":0,"lockStatus":false,"aggregationPolicy":"nonFungible"}}'
        },
        'asset-addresses': {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: '["bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu","bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr","bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn","bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t"]',
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: '["bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj"]'
        },
        'asset-metadata': {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: JSON.stringify(testMetadata[0].metadata),
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: JSON.stringify(testMetadata[1].metadata)
        },
        'nftoken-issuance': {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: JSON.stringify({
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff'
          }),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: JSON.stringify({
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff'
          }),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: JSON.stringify({
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff'
          }),
          Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: JSON.stringify({
            assetId: 'Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe',
            txid: '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd'
          })
        },
        'nftoken-addresses': {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: '["bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu","bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn"]',
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: '["bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu","bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t"]',
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: '["bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr"]',
          Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: '["bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj"]'
        },
        'nftoken-metadata': {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: JSON.stringify(testNFTokenMetadata[1].update['Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji']),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: JSON.stringify(testNFTokenMetadata[1].update['Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M']),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: JSON.stringify(testNFTokenMetadata[0].newTokens[2]),
          Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: JSON.stringify(testNFTokenMetadata[2].newTokens[0])
        }
      }
    },
    // Results after processing tx #4 (the last one)
    {
      utxosChanges: {
        used: {},
        unused: {
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji"},{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M"}]',
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is"}]',
          '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd:1': '[{"assetId":"Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe","amount":1,"issueTxid":"813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd","divisibility":0,"lockStatus":false,"aggregationPolicy":"nonFungible","tokenId":"Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF"}]',
          '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:1': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji"}]',
          '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:2': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M"}]',
          'eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb:1': '[{"assetId":"Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe","amount":1,"issueTxid":"eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb","divisibility":0,"lockStatus":false,"aggregationPolicy":"nonFungible","tokenId":"Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu"}]'
        },
        txids: [],
        metadata: {
          asset: {
            LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: testMetadata[0].metadata,
            Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: testMetadata[1].metadata
          },
          nonFungibleToken: {
            Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: testNFTokenMetadata[1].update['Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji'],
            Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: testNFTokenMetadata[1].update['Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M'],
            Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: testNFTokenMetadata[0].newTokens[2],
            Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: testNFTokenMetadata[2].newTokens[0],
            Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu: testNFTokenMetadata[3].newTokens[0]
          }
        }
      },
      database: {
        'utxos': {
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji"},{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M"}]',
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is"}]',
          '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd:1': '[{"assetId":"Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe","amount":1,"issueTxid":"813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd","divisibility":0,"lockStatus":false,"aggregationPolicy":"nonFungible","tokenId":"Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF"}]',
          '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:1': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji"}]',
          '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:2': '[{"assetId":"LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v","amount":1,"issueTxid":"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff","divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible","tokenId":"Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M"}]',
          'eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb:1': '[{"assetId":"Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe","amount":1,"issueTxid":"eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb","divisibility":0,"lockStatus":false,"aggregationPolicy":"nonFungible","tokenId":"Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu"}]'
        },
        'transaction-utxos': {
          '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff': '["841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1","841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2"]',
          '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd': '["813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd:1"]',
          '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa': '["3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:1","3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:2"]',
          'eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb': '["eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb:1"]',
        },
        'address-utxos': {
          bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu: '["841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:1"]',
          bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr: '["841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff:2"]',
          bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj: '["813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd:1"]',
          bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn: '["3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:1"]',
          bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t: '["3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa:2"]',
          bcrt1q4hpeyu3ypl69msvasqj50qle9n5pveah9mm5hg: '["eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb:1"]'
        },
        'asset-issuance': {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: '{"841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff":{"divisibility":0,"lockStatus":true,"aggregationPolicy":"nonFungible"}}',
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: '{"813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd":{"divisibility":0,"lockStatus":false,"aggregationPolicy":"nonFungible"},"eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb":{"divisibility":0,"lockStatus":false,"aggregationPolicy":"nonFungible"}}'
        },
        'asset-addresses': {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: '["bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu","bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr","bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn","bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t"]',
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: '["bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj","bcrt1q4hpeyu3ypl69msvasqj50qle9n5pveah9mm5hg"]'
        },
        'asset-metadata': {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: JSON.stringify(testMetadata[0].metadata),
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: JSON.stringify(testMetadata[1].metadata)
        },
        'nftoken-issuance': {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: JSON.stringify({
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff'
          }),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: JSON.stringify({
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff'
          }),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: JSON.stringify({
            assetId: 'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
            txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff'
          }),
          Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: JSON.stringify({
            assetId: 'Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe',
            txid: '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd'
          }),
          Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu: JSON.stringify({
            assetId: 'Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe',
            txid: 'eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb'
          })
        },
        'nftoken-addresses': {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: '["bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu","bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn"]',
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: '["bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu","bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t"]',
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: '["bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr"]',
          Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: '["bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj"]',
          Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu: '["bcrt1q4hpeyu3ypl69msvasqj50qle9n5pveah9mm5hg"]'
        },
        'nftoken-metadata': {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: JSON.stringify(testNFTokenMetadata[1].update['Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji']),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: JSON.stringify(testNFTokenMetadata[1].update['Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M']),
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: JSON.stringify(testNFTokenMetadata[0].newTokens[2]),
          Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: JSON.stringify(testNFTokenMetadata[2].newTokens[0]),
          Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu: JSON.stringify(testNFTokenMetadata[3].newTokens[0])
        }
      }
    }
  ];

  function updateGlobalUtxosChanges(txUtxosChanges) {
    // Note: we not care updating the other properties since they are not touched by the test procedures

    // Update unused property
    Object.keys(txUtxosChanges.unused).forEach(txout => {
      utxosChanges.unused[txout] = txUtxosChanges.unused[txout];
    });

    // Update metadata property
    if (txUtxosChanges.metadata) {
      // Save asset/non-fungible tokens metadata
      if (!utxosChanges.metadata) {
        utxosChanges.metadata = txUtxosChanges.metadata;
      }
      else {
        if (txUtxosChanges.metadata.asset) {
          if (!utxosChanges.metadata.asset) {
            utxosChanges.metadata.asset = txUtxosChanges.metadata.asset;
          }
          else {
            Object.keys(txUtxosChanges.metadata.asset).forEach(assetId => {
              utxosChanges.metadata.asset[assetId] = txUtxosChanges.metadata.asset[assetId];
            });
          }
        }

        if (txUtxosChanges.metadata.nonFungibleToken) {
          if (!utxosChanges.metadata.nonFungibleToken) {
            utxosChanges.metadata.nonFungibleToken = txUtxosChanges.metadata.nonFungibleToken;
          }
          else {
            Object.keys(txUtxosChanges.metadata.nonFungibleToken).forEach(tokenId => {
              utxosChanges.metadata.nonFungibleToken[tokenId] = txUtxosChanges.metadata.nonFungibleToken[tokenId];
            });
          }
        }
      }
    }
  }

  before('Set up testing environment', function (done) {
    // Initialize transaction map
    testTransactions.forEach(tx => {
      block.mapTransaction[tx.txid] = tx;
    });

    parser.redis.options.prefix = 'c3nodeserv:testDB:';
    parser.redis.select(9, done);
  });

  beforeEach('Do Cleanup for testing', function (done) {
    // Clear test database
    parser.redis.flushdb(done);
  });

  it('Parse transactions and save result iteratively (for each parsed tx)', function (done) {
    async.eachOfSeries(testTransactions, function (tx, idx, cb) {
      const txUtxosChanges = {
        used: {},
        unused: {},
        txids: []
      };

      // Parse transaction
      parser.parseTransaction(tx, txUtxosChanges, 1, err => {
        if (err) {
          cb(err);
        }
        else {
          updateGlobalUtxosChanges(txUtxosChanges);
          const txProcResult = txProcResults[idx];

          try {
            assert.deepEqual(utxosChanges, txProcResult.utxosChanges);
          }
          catch (err) {
            return cb(err);
          }

          // Save result of parsed transaction
          parser.updateMempoolTransactionUtxosChanges(tx, txUtxosChanges, err => {
            if (err) {
              cb(err);
            }
            else {
              async.eachOfSeries(txProcResult.database, function (dbKeyData, dbKey, cb) {
                parser.redis.hgetall(dbKey, (err, result) => {
                  if (err) {
                    cb(err);
                  }
                  else {
                    try {
                      assert.deepEqual(result, dbKeyData, `Redis key: ${dbKey}`);
                    }
                    catch (err) {
                      return cb(err);
                    }

                    cb();
                  }
                });
              }, cb);
            }
          });
        }
      });
    }, err => {
      if (err) {
        done(err);
      }
      else {
        try {
          assert.deepEqual(utxosChanges, txProcResults[txProcResults.length - 1].utxosChanges);
        }
        catch (err) {
          return done(err);
        }

        done();
      }
    });
  });

  it('Save complete parsed data (simulating block parsing)', function (done) {
    parser.updateUtxosChanges(block, utxosChanges, err => {
      if (err) {
        done(err);
      }
      else {
        const txProcResult = txProcResults[txProcResults.length - 1];

        async.eachOfSeries(txProcResult.database, function (dbKeyData, dbKey, cb) {
          parser.redis.hgetall(dbKey, (err, result) => {
            if (err) {
              cb(err);
            }
            else {
              try {
                assert.deepEqual(result, dbKeyData, `Redis key: ${dbKey}`);
              }
              catch (err) {
                return cb(err);
              }

              cb();
            }
          });
        }, done);
      }
    });
  });
});

describe('New and updated API methods for non-fungible assets/tokens', function () {
  const testMetadata = [
    {
      metadata: {
        assetName: 'Test_asset_#1',
        issuer: 'Catenis',
        description: 'General purpose Catenis smart asset #1',
        urls: [
          {
            name: 'icon',
            url: 'https://catenis.io/logo/Catenis_large.png',
            mimeType: 'image/png',
            dataHash: '0a5e3d326c0dfd1f87cebdd63fa214faebb9a3d48234a8c7352186985f838261'
          }
        ],
        userData: {
          meta: [
            {
              key: 'ctnAssetId',
              value: 'a3oqSwBBqrrTevh3bFEj',
              type: 'String'
            }
          ]
        },
        verifications: {}
      }
    },
    {
      metadata: {
        assetName: 'Test_asset_#2',
        issuer: 'Catenis',
        description: 'General purpose Catenis smart asset #2',
        urls: [
          {
            name: 'icon',
            url: 'https://catenis.io/logo/Catenis_large.png',
            mimeType: 'image/png',
            dataHash: '0a5e3d326c0dfd1f87cebdd63fa214faebb9a3d48234a8c7352186985f838261'
          }
        ],
        userData: {
          meta: [
            {
              key: 'ctnAssetId',
              value: 'aQjlzShmrnEZeeYBZihc',
              type: 'String'
            }
          ]
        },
        verifications: {}
      }
    },
    {
      metadata: {
        assetName: 'Test_asset_#3',
        issuer: 'Catenis',
        description: 'General purpose Catenis smart asset #3',
        urls: [
          {
            name: 'icon',
            url: 'https://catenis.io/logo/Catenis_large.png',
            mimeType: 'image/png',
            dataHash: '0a5e3d326c0dfd1f87cebdd63fa214faebb9a3d48234a8c7352186985f838261'
          }
        ],
        userData: {
          meta: [
            {
              key: 'ctnAssetId',
              value: 'aH2AkrrL55GcThhPNa3J',
              type: 'String'
            }
          ]
        },
        verifications: {}
      }
    }
  ];
  const testNFTokenMetadata = [
    // For 3 new non-fungible tokens
    {
      newTokens: [
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_1',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #1',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu',
              type: 'URL'
            }
          ]
        },
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_2',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #2',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR',
              type: 'URL'
            }
          ]
        },
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_3',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #3',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmNrgEMcUygbKzZeZgYFosdd27VE9KnWbyUD73bKZJ3bGi',
              type: 'URL'
            }
          ]
        }
      ]
    },
    // For 2 existing non-fungible tokens
    {
      update: {
        Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: {
          meta: [
            {
              key: 'name',
              value: 'NFT_1',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #1 (updated)',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
              type: 'URL'
            }
          ]
        },
        Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: {
          meta: [
            {
              key: 'name',
              value: 'NFT_2',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #2 (updated)',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR',
              type: 'URL'
            }
          ]
        }
      }
    },
    // For 1 new non-fungible tokens
    {
      newTokens: [
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_4',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #4',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmUPNgbkB2esFHLZdS5rhD8wxFaCBU8JeBrBePWqMfSWub',
              type: 'URL'
            }
          ]
        }
      ]
    },
    // For 1 new non-fungible tokens
    {
      newTokens: [
        {
          meta: [
            {
              key: 'name',
              value: 'NFT_5',
              type: 'String'
            },
            {
              key: 'description',
              value: 'Test non-fungible token #5',
              type: 'String'
            },
            {
              key: 'image',
              value: 'https://ipfs.io/ipfs/QmQ2UaYLHwSjU4VvHyD4SfCUyo7AvrufdNrX1kmsbtbn3w',
              type: 'URL'
            }
          ]
        }
      ]
    }
  ];
  const testTransactions = [
    // Issue locked non-fungible asset (with 3 non-fungible tokens)
    {
      txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff',
      vin: [{
        txid: '0f45f38a8bcd8331877267e0f3f5f8a4b3c716165e40db4eee34d52759ad954f',
        vout: 2
      }],
      vout: [
        {},
        {
          scriptPubKey: {addresses: ['bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu']}
        },
        {
          scriptPubKey: {addresses: ['bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr']}
        }
      ],
      ccdata: [
        {
          protocol: 0x4333,
          version: 0x02,
          type: 'issuance',
          amount: 3,
          lockStatus: true,
          divisibility: 0,
          aggregationPolicy: 'nonFungible',
          payments: [
            {
              input: 0, output:1, amount: 2
            },
            {
              input: 0, output:2, amount: 1
            }
          ],
          metadata: {
            ...testMetadata[0],
            nfTokenMetadata: testNFTokenMetadata[0]
          }
        }
      ]
    },
    // Issue unlocked non-fungible asset (with a single non-fungible token)
    {
      txid: '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd',
      vin: [{
        txid: '4c390c068554e3c15e4bc93c5def81ff1f36abe77f16a01c8f63c2eeddd3bcfd',
        vout: 1,
        address: 'bcrt1qkyq535qt8ksnhmvj4326mry7wmdsaewnclgljc'
      }],
      vout: [
        {},
        {
          scriptPubKey: {addresses: ['bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj']}
        }
      ],
      ccdata: [
        {
          protocol: 0x4333,
          version: 0x02,
          type: 'issuance',
          amount: 1,
          lockStatus: false,
          divisibility: 0,
          aggregationPolicy: 'nonFungible',
          payments: [
            {
              input: 0, output:1, amount: 1
            }
          ],
          metadata: {
            ...testMetadata[1],
            nfTokenMetadata: testNFTokenMetadata[2]
          }
        }
      ]
    },
    // Transfer 2 non-fungible tokens of locked asset
    {
      txid: '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa',
      vin: [{
        txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff',
        vout: 1
      }],
      vout: [
        {},
        {
          scriptPubKey: {addresses: ['bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn']}
        },
        {
          scriptPubKey: {addresses: ['bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t']}
        }
      ],
      ccdata: [
        {
          protocol: 0x4333,
          version: 0x02,
          type: 'transfer',
          amount: 2,
          payments: [
            {
              input: 0, output:1, amount: 1
            },
            {
              input: 0, output:2, amount: 1
            }
          ],
          metadata: {
            nfTokenMetadata: testNFTokenMetadata[1]
          }
        }
      ]
    },
    // Issue one more non-fungible token of unlocked asset
    {
      txid: 'eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb',
      vin: [{
        txid: '9e358d137e52bfe84b74ec0ad9303238b2b71dfafcdad282bce288ecf80326fb',
        vout: 6,
        address: 'bcrt1qkyq535qt8ksnhmvj4326mry7wmdsaewnclgljc'
      }],
      vout: [
        {},
        {
          scriptPubKey: {addresses: ['bcrt1q4hpeyu3ypl69msvasqj50qle9n5pveah9mm5hg']}
        }
      ],
      ccdata: [
        {
          protocol: 0x4333,
          version: 0x02,
          type: 'issuance',
          amount: 1,
          lockStatus: false,
          divisibility: 0,
          aggregationPolicy: 'nonFungible',
          payments: [
            {
              input: 0, output: 1, amount: 1
            }
          ],
          metadata: {
            nfTokenMetadata: testNFTokenMetadata[3]
          }
        }
      ]
    },
    // Issue locked (fungible) asset
    {
      txid: 'c557e29684c1341be73cd87b9b2dba605f99068748217aba2843517bae12e5df',
      vin: [{
        txid: '54c936a1bf355851629dd8aa1830645070bfade203f3aec98373f450632c16dc',
        vout: 1
      }],
      vout: [
        {},
        {
          scriptPubKey: {addresses: ['bcrt1ql540dkdwc43f95f758cqjfjfa9e4vkjfsy5gvr']}
        }
      ],
      ccdata: [
        {
          protocol: 0x4333,
          version: 0x02,
          type: 'issuance',
          amount: 7000,
          lockStatus: true,
          divisibility: 2,
          aggregationPolicy: 'aggregatable',
          payments: [
            {
              input: 0, output:1, amount: 70
            }
          ],
          metadata: {
            ...testMetadata[2]
          }
        }
      ]
    }
  ];
  const testAssetIds = [
    // Locked non-fungible asset
    'LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v',
    // Unlocked non-fungible asset
    'Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe',
    // Locked (fungible) asset
    'La5JVocZRMtf2Krcp28M8ccVaFpxGBYHi3dgFe'
  ]
  const testNFTokenIds = [
    // Non-fungible tokens of locked asset
    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji',
    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
    'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is',
    // Non-fungible tokens of unlocked asset (1st issuance)
    'Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF',
    // Non-fungible tokens of unlocked asset (2nd issuance)
    'Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu'
  ];
  const utxosChanges = {
    used: {},
    unused: {},
    txids: []
  };
  const block = {
    height: 1,
    hash: '56df06036111a3984c8410112202ae5ebe161db72c0bcf21fdf3c7b5c10ba278',
    timestamp: 1641320814,
    mapTransaction: {}
  };
  const testUnspentTxOuts = [
    {
      txid: '841f14f80b3f9f0b0d9f353c7ec2d517121ed948542bd0a0f1c080c29141eaff',
      vout: 2,
      address: 'bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr',
      confirmations: 1
    },
    {
      txid: '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd',
      vout: 1,
      address: 'bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj',
      confirmations: 1
    },
    {
      txid: '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa',
      vout: 1,
      address: 'bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn',
      confirmations: 0
    },
    {
      txid: '3aa64ea4beaa2e692bb1fa046eaaa2bd947ac03416da0d5ea6f92fc4919df8fa',
      vout: 2,
      address: 'bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t',
      confirmations: 0
    },
    {
      txid: 'eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb',
      vout: 1,
      address: 'bcrt1q4hpeyu3ypl69msvasqj50qle9n5pveah9mm5hg',
      confirmations: 0
    },
    {
      txid: 'c557e29684c1341be73cd87b9b2dba605f99068748217aba2843517bae12e5df',
      vout: 1,
      address: 'bcrt1ql540dkdwc43f95f758cqjfjfa9e4vkjfsy5gvr',
      confirmations: 0
    }
  ];

  function hackBitcoinClient(client) {
    const origCmd = client.cmd;

    client.cmd = function (...args) {
      if (args[0] === 'listunspent') {
        // Bitcoin Core's 'listunspent' command.
        //  Intercept it, and return our own list of unspent tx outputs
        const params = args[1];
        const cb = args[2];

        let minconf;
        let addresses;
        const numParams = params.length;

        if (numParams > 0) {
          if (Number.isInteger(params[0])) {
            minconf = params[0];
          }

          if (numParams > 2 && Array.isArray(params[2])) {
            addresses = params[2];
          }
        }

        const unspentTxOuts = testUnspentTxOuts.filter(utxo => {
          return (!minconf || utxo.confirmations >= minconf)
            && (!addresses || addresses.includes(utxo.address));
        });

        cb(null, unspentTxOuts);
      }
      else {
        // Any other Bitcoin Core's command. Just pass it to the original command function
        origCmd.call(client, ...args);
      }
    };
  }

  function testBitcoinClientHack(cb) {
    async.waterfall([
      function (cb) {
        // Should return the fabricated unspent tx outputs
        parser.bitcoin.cmd('listunspent', [],(err, result) => {
          if (err) {
            cb(err);
          }
          else {
            try {
              assert.deepEqual(result, testUnspentTxOuts, 'Failure validating Bitcoin client hack');
            }
            catch (err) {
              return cb(err);
            }

            cb();
          }
        });
      },
      function (cb) {
        // Should return only a portion (confirmed) of the fabricated unspent tx outputs
        parser.bitcoin.cmd('listunspent', [1],(err, result) => {
          if (err) {
            cb(err);
          }
          else {
            try {
              assert.deepEqual(result, testUnspentTxOuts.filter(utxo => utxo.confirmations > 0), 'Failure validating Bitcoin client hack');
            }
            catch (err) {
              return cb(err);
            }

            cb();
          }
        });
      },
      function (cb) {
        // Should return only a portion (with given addresses) of the fabricated unspent tx outputs
        const addresses = [
            'bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t',
            'bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr'
        ];
        parser.bitcoin.cmd('listunspent', [0, 9999999, addresses],(err, result) => {
          if (err) {
            cb(err);
          }
          else {
            try {
              assert.deepEqual(result, testUnspentTxOuts.filter(utxo => addresses.includes(utxo.address)), 'Failure validating Bitcoin client hack');
            }
            catch (err) {
              return cb(err);
            }

            cb();
          }
        });
      },
      function (cb) {
        // Should execute other Bitcoin Core commands normally
        parser.bitcoin.cmd('getnetworkinfo', [],(err, result) => {
          if (err) {
            cb(err);
          }
          else {
            try {
              assert.notDeepEqual(result, undefined, 'Failure validating Bitcoin client hack');
            }
            catch (err) {
              return cb(err);
            }

            cb();
          }
        });
      }
    ], cb);
  }

  before('Set up testing environment', function (done) {
    // Initialize transaction map
    testTransactions.forEach(tx => {
      block.mapTransaction[tx.txid] = tx;
    });

    hackBitcoinClient(parser.bitcoin);

    async.waterfall([
      testBitcoinClientHack,
      function (cb) {
        // Process test transactions
        async.eachSeries(testTransactions, function (tx, cb) {
          // Parse transaction
          parser.parseTransaction(tx, utxosChanges, 1, cb);
        }, err => {
          if (err) {
            cb(err);
          }
          else {
            // Save parsed data
            parser.updateUtxosChanges(block, utxosChanges, cb);
          }
        });
      }
    ], done);
  });

  describe('Exercise getAssetIssuance API method', function () {
    it('should return standard info for regular (fungible) asset', function (done) {
      parser.getAssetIssuance({assetId: testAssetIds[2]}, (err, result) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.equal(Object.keys(result).length, 1);

            Object.values(result).forEach(assetIssuance => {
              assert.deepEqual(assetIssuance.tokenIds, undefined);
            });
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return list of non-fungible tokens for non-fungible (locked) asset', function (done) {
      parser.getAssetIssuance({assetId: testAssetIds[0]}, (err, result) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.equal(Object.keys(result).length, 1);

            Object.values(result).forEach(assetIssuance => {
              assert.deepEqual(assetIssuance.tokenIds, testNFTokenIds.slice(0, 3));
            });
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return list of non-fungible tokens for non-fungible (unlocked) asset', function (done) {
      parser.getAssetIssuance({assetId: testAssetIds[1]}, (err, result) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.equal(Object.keys(result).length, 2);

            Object.keys(result).forEach(txid => {
              const assetIssuance = result[txid];

              if (txid === '813f5b53220ff81bfecb1d818b33e76b0abd5ad7ebdc57bbbec9e5df6d104afd') {
                assert.deepEqual(assetIssuance.tokenIds, testNFTokenIds.slice(3, 4));
              }
              else if (txid === 'eb11a3345c9cb2a95b360ecd391792255bc301902ad6a1d3b4220ee23a526ffb') {
                assert.deepEqual(assetIssuance.tokenIds, testNFTokenIds.slice(4, 5));
              }
              else {
                throw new Error(`Unexpected transaction ID: ${txid}`);
              }
            });
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });
  });

  describe('Exercise getAssetMetadata API method', function () {
    it('should return nothing (undefined) if an invalid asset ID is passed', function (done) {
      parser.getAssetMetadata({assetId: 'bla'}, (err, result) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(result, undefined);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return the correct metadata for assets', function (done) {
      const expectedResult = [
        testMetadata[0].metadata,
        testMetadata[1].metadata,
        testMetadata[2].metadata
      ];

      async.reduce(testAssetIds, [], function(compoundResult, assetId, cb) {
        parser.getAssetMetadata({assetId}, (err, result) => {
          if (err) {
            cb(err);
          } else {
            compoundResult.push(result);

            cb(null, compoundResult);
          }
        });
      }, (err, finalResult) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(finalResult, expectedResult);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });
  });

  describe('Exercise getNFTokenMetadata API method', function () {
    it('should return nothing (undefined) if an invalid non-fungible token ID is passed', function (done) {
      parser.getNFTokenMetadata({tokenId: 'bla'}, (err, result) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(result, undefined);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return the correct metadata for non-fungible tokens', function (done) {
      const expectedResult = [
        testNFTokenMetadata[1].update[testNFTokenIds[0]],
        testNFTokenMetadata[1].update[testNFTokenIds[1]],
        testNFTokenMetadata[0].newTokens[2],
        testNFTokenMetadata[2].newTokens[0],
        testNFTokenMetadata[3].newTokens[0]
      ];

      async.reduce(testNFTokenIds, [], function(compoundResult, tokenId, cb) {
        parser.getNFTokenMetadata({tokenId}, (err, result) => {
          if (err) {
            cb(err);
          } else {
            compoundResult.push(result);

            cb(null, compoundResult);
          }
        });
      }, (err, finalResult) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(finalResult, expectedResult);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });
  });

  describe('Exercise getNFTokenIssuance API method', function () {
    it('should return nothing (undefined) if an invalid non-fungible token ID is passed', function (done) {
      parser.getNFTokenIssuance({tokenId: 'bla'}, (err, result) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(result, undefined);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return the correct issuance info for non-fungible tokens', function (done) {
      const expectedResult = [
        {
          assetId: testAssetIds[0],
          txid: testTransactions[0].txid
        },
        {
          assetId: testAssetIds[0],
          txid: testTransactions[0].txid
        },
        {
          assetId: testAssetIds[0],
          txid: testTransactions[0].txid
        },
        {
          assetId: testAssetIds[1],
          txid: testTransactions[1].txid
        },
        {
          assetId: testAssetIds[1],
          txid: testTransactions[3].txid
        }
      ];

      async.reduce(testNFTokenIds, [], function(compoundResult, tokenId, cb) {
        parser.getNFTokenIssuance({tokenId}, (err, result) => {
          if (err) {
            cb(err);
          } else {
            compoundResult.push(result);

            cb(null, compoundResult);
          }
        });
      }, (err, finalResult) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(finalResult, expectedResult);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });
  });

  describe('Exercise getNFTokenOwner API method', function () {
    it('should return nothing (undefined) if an invalid non-fungible token ID is passed', function (done) {
      parser.getNFTokenOwner({tokenId: 'bla'}, (err, result) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(result, undefined);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return the correct token holding info for non-fungible tokens', function (done) {
      const expectedResult = [
        {
          address: 'bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn',
          unconfirmed: true
        },
        {
          address: 'bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t',
          unconfirmed: true
        },
        {
          address: 'bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr',
          unconfirmed: false
        },
        {
          address: 'bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj',
          unconfirmed: false
        },
        {
          address: 'bcrt1q4hpeyu3ypl69msvasqj50qle9n5pveah9mm5hg',
          unconfirmed: true
        }
      ];

      async.reduce(testNFTokenIds, [], function(compoundResult, tokenId, cb) {
        parser.getNFTokenOwner({tokenId}, (err, result) => {
          if (err) {
            cb(err);
          } else {
            compoundResult.push(result);

            cb(null, compoundResult);
          }
        });
      }, (err, finalResult) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(finalResult, expectedResult);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return the correct token holding info for non-fungible tokens (with numOfConfirmations = 1)', function (done) {
      const expectedResult = [
        {
          address: undefined,
          unconfirmed: false
        },
        {
          address: undefined,
          unconfirmed: false
        },
        {
          address: 'bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr',
          unconfirmed: false
        },
        {
          address: 'bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj',
          unconfirmed: false
        },
        {
          address: undefined,
          unconfirmed: false
        }
      ];

      async.reduce(testNFTokenIds, [], function(compoundResult, tokenId, cb) {
        parser.getNFTokenOwner({tokenId, numOfConfirmations: 1}, (err, result) => {
          if (err) {
            cb(err);
          } else {
            compoundResult.push(result);

            cb(null, compoundResult);
          }
        });
      }, (err, finalResult) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(finalResult, expectedResult);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });
  });

  describe('Exercise getAllNFTokensOwner API method', function () {
    it('validate internal function used to return issued tokens for a non-fungible asset', function (done) {
      const expectedResult = [
        [
          'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji',
          'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
          'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is'
        ],
        [
          'Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF',
          'Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu'
        ]
      ];

      async.reduce(testAssetIds.slice(0, -1), [], function(compoundResult, assetId, cb) {
        parser._getIssuedNFTokens(assetId, (err, result) => {
          if (err) {
            cb(err);
          } else {
            compoundResult.push(result);

            cb(null, compoundResult);
          }
        });
      }, (err, finalResult) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(finalResult, expectedResult);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return nothing (undefined) if an invalid non-fungible asset ID is passed', function (done) {
      parser.getAllNFTokensOwner({assetId: 'bla'}, (err, result) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(result, undefined);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return the correct token holding info for non-fungible assets', function (done) {
      const expectedResult = [
        {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: {
            address: 'bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn',
            unconfirmed: true
          },
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: {
            address: 'bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t',
            unconfirmed: true
          },
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: {
            address: 'bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr',
            unconfirmed: false
          }
        },
        {
          Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: {
            address: 'bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj',
            unconfirmed: false
          },
          Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu: {
            address: 'bcrt1q4hpeyu3ypl69msvasqj50qle9n5pveah9mm5hg',
            unconfirmed: true
          }
        }
      ];

      async.reduce(testAssetIds.slice(0, -1), [], function(compoundResult, assetId, cb) {
        parser.getAllNFTokensOwner({assetId}, (err, result) => {
          if (err) {
            cb(err);
          } else {
            compoundResult.push(result);

            cb(null, compoundResult);
          }
        });
      }, (err, finalResult) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(finalResult, expectedResult);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return the correct token holding info for non-fungible assets (with numOfConfirmations = 1)', function (done) {
      const expectedResult = [
        {
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji: {
            address: undefined,
            unconfirmed: false
          },
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M: {
            address: undefined,
            unconfirmed: false
          },
          Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is: {
            address: 'bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr',
            unconfirmed: false
          }
        },
        {
          Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF: {
            address: 'bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj',
            unconfirmed: false
          },
          Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu: {
            address: undefined,
            unconfirmed: false
          }
        }
      ];

      async.reduce(testAssetIds.slice(0, -1), [], function(compoundResult, assetId, cb) {
        parser.getAllNFTokensOwner({assetId, numOfConfirmations: 1}, (err, result) => {
          if (err) {
            cb(err);
          } else {
            compoundResult.push(result);

            cb(null, compoundResult);
          }
        });
      }, (err, finalResult) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(finalResult, expectedResult);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });
  });

  describe('Exercise getOwnedNFTokens API method', function () {
    const addressSets = [
      // All addresses
      [
        'bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn',
        'bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t',
        'bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr',
        'bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj',
        'bcrt1q4hpeyu3ypl69msvasqj50qle9n5pveah9mm5hg',
        'bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu',
        'bcrt1ql540dkdwc43f95f758cqjfjfa9e4vkjfsy5gvr'
      ],
      // Only addresses that currently hold non-fungible tokens
      [
        'bcrt1qxjcfudh4apavr6xfp43ws6t57362eaxd90ncjn',
        'bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t',
        'bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr',
        'bcrt1qh8xjlya8nnxhr2qyl7u6qkz2dg4tqq2v2k8clj',
        'bcrt1q4hpeyu3ypl69msvasqj50qle9n5pveah9mm5hg'
      ],
      // Only addresses that do not currently hold any non-fungible tokens
      [
        'bcrt1qa48jdr7u553yve2ndlmuahjl0swnakswekpslu',
        'bcrt1ql540dkdwc43f95f758cqjfjfa9e4vkjfsy5gvr'
      ],
      // Assorted addresses
      [
        'bcrt1qwxpph6llpcxvgcyrmmhp2ge6lmral9zt3csn7t',
        'bcrt1q95l07d76258lra3ndlc4zm6pqaxceyldsn9hdr',
        'bcrt1q4hpeyu3ypl69msvasqj50qle9n5pveah9mm5hg',
        'bcrt1ql540dkdwc43f95f758cqjfjfa9e4vkjfsy5gvr'
      ]
    ];

    it('should return the correct non-fungible tokens held by a set of bitcoin addresses', function (done) {
      const expectedResult = [
        {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: [
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is',
              unconfirmed: false
            },
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji',
              unconfirmed: true
            },
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
              unconfirmed: true
            }
          ],
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: [
            {
              tokenId: 'Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF',
              unconfirmed: false
            },
            {
              tokenId: 'Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu',
              unconfirmed: true
            }
          ]
        },
        {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: [
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is',
              unconfirmed: false
            },
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji',
              unconfirmed: true
            },
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
              unconfirmed: true
            }
          ],
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: [
            {
              tokenId: 'Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF',
              unconfirmed: false
            },
            {
              tokenId: 'Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu',
              unconfirmed: true
            }
          ]
        },
        {},
        {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: [
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is',
              unconfirmed: false
            },
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
              unconfirmed: true
            }
          ],
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: [
            {
              tokenId: 'Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu',
              unconfirmed: true
            }
          ]
        }
      ];

      async.reduce(addressSets, [], function(compoundResult, addresses, cb) {
        parser.getOwnedNFTokens({addresses}, (err, result) => {
          if (err) {
            cb(err);
          } else {
            compoundResult.push(result);

            cb(null, compoundResult);
          }
        });
      }, (err, finalResult) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(finalResult, expectedResult);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return the correct non-fungible tokens pertaining to locked asset held by a set of bitcoin addresses', function (done) {
      const expectedResult = [
        {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: [
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is',
              unconfirmed: false
            },
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji',
              unconfirmed: true
            },
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
              unconfirmed: true
            }
          ]
        },
        {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: [
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is',
              unconfirmed: false
            },
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1K4DLji',
              unconfirmed: true
            },
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
              unconfirmed: true
            }
          ]
        },
        {},
        {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: [
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is',
              unconfirmed: false
            },
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1Tuiw2M',
              unconfirmed: true
            }
          ]
        }
      ];

      async.reduce(addressSets, [], function(compoundResult, addresses, cb) {
        parser.getOwnedNFTokens({addresses, assetId: testAssetIds[0]}, (err, result) => {
          if (err) {
            cb(err);
          } else {
            compoundResult.push(result);

            cb(null, compoundResult);
          }
        });
      }, (err, finalResult) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(finalResult, expectedResult);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return the correct non-fungible tokens pertaining to unlocked asset held by a set of bitcoin addresses', function (done) {
      const expectedResult = [
        {
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: [
            {
              tokenId: 'Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF',
              unconfirmed: false
            },
            {
              tokenId: 'Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu',
              unconfirmed: true
            }
          ]
        },
        {
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: [
            {
              tokenId: 'Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF',
              unconfirmed: false
            },
            {
              tokenId: 'Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu',
              unconfirmed: true
            }
          ]
        },
        {},
        {
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: [
            {
              tokenId: 'Tk73UQeUYAHFinfNiNFL8VxvH3CVWksHUCzDnu',
              unconfirmed: true
            }
          ]
        }
      ];

      async.reduce(addressSets, [], function(compoundResult, addresses, cb) {
        parser.getOwnedNFTokens({addresses, assetId: testAssetIds[1]}, (err, result) => {
          if (err) {
            cb(err);
          } else {
            compoundResult.push(result);

            cb(null, compoundResult);
          }
        });
      }, (err, finalResult) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(finalResult, expectedResult);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });

    it('should return the correct non-fungible tokens held by a set of bitcoin addresses (with numOfConfirmations = 1)', function (done) {
      const expectedResult = [
        {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: [
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is',
              unconfirmed: false
            }
          ],
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: [
            {
              tokenId: 'Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF',
              unconfirmed: false
            }
          ]
        },
        {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: [
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is',
              unconfirmed: false
            }
          ],
          Un9SCo6v9JUa23TBcKwbW8Sr4Ytcvt2XS4NXwe: [
            {
              tokenId: 'Tk5xp9oaUMw1uZsy7nz6UjZLM2j9La77r4xNnF',
              unconfirmed: false
            }
          ]
        },
        {},
        {
          LnAR9VJaHTtHQPeMaPTVWvKo6nLmBGoZH5z92v: [
            {
              tokenId: 'Tk97fk8Rg27toQW68faxhnDuYeFEoLC1bFs2is',
              unconfirmed: false
            }
          ]
        }
      ];

      async.reduce(addressSets, [], function(compoundResult, addresses, cb) {
        parser.getOwnedNFTokens({addresses, numOfConfirmations: 1}, (err, result) => {
          if (err) {
            cb(err);
          } else {
            compoundResult.push(result);

            cb(null, compoundResult);
          }
        });
      }, (err, finalResult) => {
        if (err) {
          done(err);
        }
        else {
          try {
            assert.deepEqual(finalResult, expectedResult);
          }
          catch (err) {
            return done(err);
          }

          done();
        }
      });
    });
  });
});

describe('Cleanup', function () {
  it('Force exit', function (done) {
    done();
    setTimeout(() => {
      process.exit();
    }, 500);
  })
})
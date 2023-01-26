# Changelog

## [0.1.16] - 2023-01-26

### Changes
- No source code changes; updates only to license, copyright and source code repository information.

## [0.1.15] - 2022-11-23

### Fixes
- Change handling of error while decoding raw transactions to avoid reprocessing the same transaction block over and
 over.

## [0.1.14] - 2022-11-16

### Changes
- Enhancements to the API methods getNFTokenOwner and getAllNFTokensOwner: new optional argument 'addresses' used to
 restrict the processing.

## [0.1.13] - 2022-07-22

### Changes
- Replace the Redis DB key 'nftoken-asset' with the new DB key 'nftoken-issuance'.
- Record the ID of the transaction that issued the non-fungible token (in addition to the asset ID).
- Replace the API method getNFTokenAsset with the new API method getNFTokenIssuance.

## [0.1.12] - 2022-06-16

### Fixes
- Change the data type returned by the `getNFTokenAsset` API method so that a JSON is returned.

## [0.1.11] - 2022-05-30

### Changes
- Enhancements to handle non-fungible assets/tokens.
- Updated dependency module `catenis-colored-coins` to its latest version (0.4.1).

## [0.1.10] - 2021-05-29

### Changes
- Improvement to deployment process.

### Fixes
- Patch `bitcoin-async` module to correctly process errors returned from batch RPC call to Bitcoin Core.
- Upgrade dependency modules to mitigate security vulnerabilities.

## [0.1.9] - 2020-08-20

### Fixes
- Update catenis-colored-coins dependency module to fix bug while parsing transaction with pay to witness script hash
 (P2WSH) input.

## [0.1.8] - 2020-04-18

### Fixes
- Avoid crash when parsing a transaction with an invalid Pubkey Script.

## [0.1.7] - 2020-03-27

### Changes
- Updated dependency module `catenis-colored-coins` to its latest version (0.3.1).
- Pass bitcoin network when `calling cc-get-assets-outputs` method of `catenis-colored-coins module`.
- Changed definition of field `txinwitness` of transaction inputs from a list of Buffer objects to a list of hex-encoded
 string data

## [0.1.6] - 2020-02-17

### Changes
- Updated dependency module `bitcoinjs-lib` to its latest version (5.1.7).
- Updated dependency module `catenis-colored-coins` to its latest version (0.3.0).
- Made adjustments to add support for segregated witness (segwit) bitcoin transactions.

## [0.1.5] - 2019-04-09

### Changes
- Changed default setting to disable parse control logging.

## [0.1.4] - 2018-09-11

### Changes
- Made adjustments to work with `regtest` bitcoin blockchain on development environment.
- Reduced amount of data output during regular use.
- Added timestamp to info data and parsing error outputs.

## [0.1.3] - 2018-08-15

### Changes
- Made adjustments to support version 0.16.0 of Bitcoin Core.

## [0.1.2] - 2018-08-14

### Changes
- Made enhancements to parse control mechanism.

### Fixes
- Fixed JavaScript heap out of memory error.

## [0.1.1] - 2018-05-29

### Changes
- Updated dependency module `catenis-colored-coins` to its latest version (0.2.0).

## [0.1.0] - 2018-05-29

### Changes
- Made modifications to implement new Catenis Colored Coins protocol.
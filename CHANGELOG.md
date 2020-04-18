# Changelog

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
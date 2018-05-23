# Notice of reuse

This project contains source code that has been originally created by a third party. Please notice that the code may
have been changed to serve the specific needs of the project.

The baseline of the project's source code has been spawn from commit `7e48ad8` of this public git [repository](https://github.com/Colored-Coins/Full-Node.git)
where the original third-party source code is maintained.

The following is the integral contents of the third-party source code's original README file.

# ColoredCoins Full-Node

[![npm version](https://badge.fury.io/js/coloredcoins-full-node.svg)](http://badge.fury.io/js/coloredcoins-full-node)
[![Slack channel](http://slack.coloredcoins.org/badge.svg)](http://slack.coloredcoins.org)

* This module, coupled with [bitcoin-core](https://bitcoin.org) reference client, will add the colored layer to bitcoin transactions and their inputs \ outputs.
* It will expose the same api as the reference client with an addition of `assets` array on each transaction input \ output.
* It will enable a user to setup an easy to deploy colored coins full node with relatively short parsing time with low disk \ memory space.
* It will replace the heavy [Colored Coins Block Explorer](https://github.com/Colored-Coins/Colored-Coins-Block-Explorer) for most use-cases.

### Dependencies:
* [bitcoin-core](https://bitcoin.org).
* [redis](https://redis.io).

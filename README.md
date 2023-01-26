# Catenis Colored Coins Node Server

This is the implementation of the Catenis Colored Coins node server application, which is based on the [Colored Coins
Full-Node](https://github.com/Colored-Coins/Full-Node) application from [coloredcoins.org](http://coloredcoins.org).

# Deployment

## System requirements

The following is required to properly install and run the Catenis Colored Coins node server:

- Node.js (see recommended version in `.nvmrc` file)
- A Redis database
- Bitcoin Core node server (bitcoind)

## Deploying the application

To prepare the application for deployment, issue the command:

```shell
npm run predeploy
```

A tarball named `c3-node-server-<version>.tgz` is written to the `dist` subdirectory.

Copy the tarball to the target host and extract its contents, renaming the top-level directory of the extracted contents
from `package` to `C3NodeSvr`.

```shell
tar -xzf c3-node-server-<version>.tgz && mv package C3NodeSvr
```

Then change to the top-level directory of the extracted contents (i.e., `cd C3NodeSvr`), and issue the following commands:

```shell
nvm use
npm i
```

## Configuration settings

After installation, make sure that the following parameters in the properties.conf— or server_props.conf or
parser_props.conf as appropriate— configuration file are properly configured:

- ***redisHost*** - Host name/IP address assigned to Redis database
- ***redisPort*** - IP port assigned to Redis database (Redis default: 6379)
- ***bitcoinHost*** - Host name/IP address assigned to Bitcoin Core's JSON-RPC connections
- ***bitcoinPort*** - IP port assigned to Bitcoin Core's JSON-RPC connections
- ***bitcoinUser*** - Username for establishing Bitcoin Core's JSON-RPC connections
- ***bitcoinPass*** - Password for establishing Bitcoin Core's JSON-RPC connections
- ***server.host*** - Host name/IP address where Catenis Colored Coins node server should listen to connections
- ***server.httpPort*** - IP port where Catenis Colored Coins node server should listen to connections
- ***server.userName*** - Username for establishing connection with Catenis Colored Coins node server
- ***server.password*** - Password for establishing connection with Catenis Colored Coins node server

# License

This software is released under the [MIT License](LICENSE). Feel free to fork, and modify!

Copyright © 2018-2023, Blockchain of Things Inc.
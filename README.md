# Catenis Colored Coins Node Server

This is the implementation of the Catenis Colored Coins node server application, which is based on the [Colored Coins
Full-Node](https://github.com/Colored-Coins/Full-Node) application from [coloredcoins.org](http://coloredcoins.org).

# Deployment

## System requirements

The following is required to properly install and run the Colored Coins node server:

- Node.js version 8.x
- A Redis database
- Bitcoin Core node server (bitcoind)

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

This project is for Blockchain of Things' internal use only.

Copyright © 2018, Blockchain of Things Inc.
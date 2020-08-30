# p2p-mappig
p2p port forwarding/mapping across NAT/firewalls, Access your server anywhere.
## Features
```
- p2p port forwarding/mapping, no data relay server is needed.
- NAT traversal without router configuration.
- service installed, will be started automatically after reboot.
- support multiple clients and multiple connections for each tunnel.
- windows/linux server port forwarding/mapping tested.
- using webrtc to establish data tunnel, scp rate can reach upto 350Mbps for the tunnel.
```
## Installation
```
1. install node
2. git clone https://github.com/yuanzhanghu/p2p-port-mapping.git
3. cd p2p-port-mapping
4. npm install
```
## Usage(verified on linux)
Assume that we want to do ssh from computer B to computer A across firewalls, we can do port mapping like:
#### on computer A, mapping port out to serverKey:
**node p2p-mapping.js --add --mapping-out --port 22**
added mapping: port 22 ====> serverKey:qMdtjthkW
**sudo `which node` p2p-mapping.js --start-service**

#### on computer B, mapping serverKey in to port:
**node p2p-mapping.js --add --mapping-in --server-key qMdtjthkW --port 2222**
**sudo `which node` p2p-mapping.js --start-service**

#### now we can do this on B:
**ssh user@localhost -p 2222**
above command will ssh to A actually.

#### to stop the service: 
**sudo `which node` p2p-mapping.js --stop-service**

#### to list the status of service: 
**node p2p-mapping.js --list**

#### more helps:
**node p2p-mapping.js --help**

## Contact
QQ交流群: 872893118
email: huyuanzhang@gmail.com

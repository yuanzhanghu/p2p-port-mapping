# p2p-port-mappig
p2p port forwarding/mapping across NAT/firewalls, Access your server anywhere.
<br />
<a href="https://github.com/yuanzhanghu/p2p-port-mapping/blob/master/README_Chinese.md"><strong>中文说明</strong></a>
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
## Usage(verified on linux and windows)
```
Assume that we want to do ssh from computer B to computer A across firewalls, we can do port mapping like:
1. on computer A, mapping port out to serverKey:
(linux and windows) node p2p-mapping.js --add --mapping-out --port 22
added mapping: port 22 ====> serverKey:qMdtjthkW
(linux) sudo `which node` p2p-mapping.js --start-service
(windows) node p2p-mapping.js --start-service

2. on computer B, mapping serverKey in to port:
(linux and windows) node p2p-mapping.js --add --mapping-in -n sshTunnel --server-key qMdtjthkW --port 2222
(linux) sudo `which node` p2p-mapping.js --start-service
(windows) node p2p-mapping.js --start-service

3. now we can do this on B:
'ssh user@localhost -p 2222"
above command will ssh to A actually.

4. to stop the service: 
(linux) sudo `which node` p2p-mapping.js --stop-service
(windows) node p2p-mapping.js --stop-service

5. to delete mapping out port: 
(linux and windows) node p2p-mapping.js --delete --mapping-out --port 22

6. to delete mapping in port: 
(linux and windows) node p2p-mapping.js --delete --mapping-in --port 2222

7. to list the status of service: 
node p2p-mapping.js --list

8. more helps
node p2p-mapping.js --help

```
## Example (accessing windows remote desktop across firewalls)
```
Assume that we want to do remote desktop control from B to A(windows)
1. on computer A(windows):
node p2p-mapping.js --add --mapping-out --port 3389
  added mapping: port 3389 ====> serverKey:iweos23kW
node p2p-mapping.js --start-service

2. on computer B:
(linux and windows) node p2p-mapping.js --add --mapping-in -n winRDP --server-key iweos23kW --port 4001
(linux) sudo `which node` p2p-mapping.js --start-service
(windows) node p2p-mapping.js --start-service

3. now we can access A's desktop from B by accessing localhost:4001
```
## Contact
QQ交流群: 872893118
<br />
email: huyuanzhang@gmail.com

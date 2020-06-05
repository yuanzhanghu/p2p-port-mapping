# p2p-mappig
p2p port forwarding/mapping across NAT, Access your server anywhere.
## features
```
- p2p port forwarding/mapping, no data relay server is needed.
- NAT traversal without router configuration.
- support multiple clients and multiple connections for each tunnel.
- windows/linux server port forwarding/mapping tested.
- using webrtc to establish data tunnel, scp rate can reach upto 350Mbps for the tunnel.
```
## installation
```
1. install node
2. git clone https://github.com/yuanzhanghu/p2p-port-mapping.git
3. cd p2p-port-mapping
4. npm install
```
## usage
```
Assume that we want to do tcp port forwarding from computer A, port 22 to computer B, port 2222
1. on computer A, do:
user@hostA:~/workspace/p2p-port-mapping$ node p2p-mapping-server.js 22
2020-06-04 08:51:22 info: server_registered, local port:22 ====> serverKey:6YQHup35b
// here we got serverKey from above command, which will be used on computer B

2. on computer B, do:
user@hostB:~/workspace/p2p-port-mapping$ node p2p-mapping-client.js 6YQHup35b 2222
2020-06-04 08:56:22 info: client registered
2020-06-04 08:56:23 info: tunnel established. serverKey:6YQHup35b ====> local port:2222

3. now we can do this on B:
'ssh user@localhost -p 2222"
above command will ssh to A actually.
```
## contact
QQ交流群: 872893118
email: huyuanzhang@gmail.com

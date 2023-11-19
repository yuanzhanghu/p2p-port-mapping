

# p2p-port-mappig
p2p内网穿透, 端口转发/端口映射. 跨NAT和防火墙，从任何地方访问你的服务器. 

<br />

## 功能
- 点对点端口转发/映射，不需要数据中继服务器。
- 点对点TLS加密的端口转发/映射，避免数据安全问题。
- 不需要管理员/root权限。
- 无需路由器配置即可进行NAT穿透。
- 支持多个客户端以及每个隧道的多个连接。
- 使用node-datachannel建立数据隧道，scp速率可以达到隧道的最高400Mbps。

## 安装
1. 安装nodejs
2. git clone https://github.com/yuanzhanghu/p2p-port-mapping.git
3. cd p2p-port-mapping
4. npm install, 或者cnpm install

## 示例1: 远程SSH（在Linux上验证）
假设我们想要从B计算机通过防火墙远程访问A计算机的ssh，我们可以进行端口映射如下：
1. 在A计算机上（想要共享端口的计算机），将端口映射到serverKey：
 node main_server.js --port 22
获取打印日志：
 2023-11-08 17:12:40 mappingServer info: server_registered, local port:22 ====> serverKey:8HT5RZSYT
请记下serverKey。
2. 在B计算机上，将serverKey映射到本地端口：
// 在B计算机上使用步骤1中显示的serverKey
  node main_client.js --port 9002 --key <serverKey-displayed-in-step1>
获取打印日志：
2023-11-08 17:17:50 mappingClient info: tunnel established. serverKey:8HT5RZSYT ====> local port:8082
3. 现在我们可以在B上执行以下命令：
ssh user@localhost -p 9002 上述命令实际上将ssh连接到A计算机。

## 示例2: 远程桌面 (已在linux和windows上验证)

1.假设我们想要从 B 计算机远程访问 A 计算机，并且需要穿越防火墙。 在 A 计算机上（想要共享桌面的那台），启用远程桌面共享，并将端口映射到 serverKey：
```
 node main_server.js --port 3389
得到日志：
 2023-11-16 17:37:10 mappingServer info: server_registered, local port:3389 ====> serverKey:KJASD2DW2
```
记下 serverKey，将在步骤 2 中使用。 <br>
2.在 B 计算机上，执行以下操作：<br>
```
 node main_client.js --key KJASD2DW2 --port 9389 
得到日志：
2023-11-16 17:37:41 startClient info: tunnel established. serverKey:KJASD2DW2 ====> local port:9389
```
3.然后在 B 计算机上：我们可以远程桌面访问 localhost:9389, 实际上是访问 A 计算机。<br>

## WebRTC需要的Signal Server
当前的信号服务器运行在ai1to1.com, 使用socket.io. 你也可以运行自己的信号服务器， 源码在signal_server/, 运行:
```
python3 api_server.py
```

## WebRTC需要的STUN / TURN Server
当前使用的是:
```
[
  'stun:stun.l.google.com:19302',
  'turn:free:free@freeturn.net:3478',
]
```
你可以换成自己的STUN/TURN server，请自行修改startClient.js和startServer.js

## 联系方式
电子邮件: huyuanzhang@gmail.com
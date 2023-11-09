

# p2p-port-mappig
p2p内网穿透, 端口转发/端口映射. 跨NAT和防火墙，从任何地方访问你的服务器. 

<br />

## 功能
- 点对点端口转发/映射，不需要数据中继服务器。
- 无需路由器配置即可进行NAT穿透。
- 支持多个客户端以及每个隧道的多个连接。
- 使用node-datachannel建立数据隧道，scp速率可以达到隧道的最高350Mbps。

## 安装
1. 安装nodejs
2. git clone https://github.com/yuanzhanghu/p2p-port-mapping.git
3. cd p2p-port-mapping
4. npm install

## 示例1（在Linux上验证）
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

## 联系方式
电子邮件: huyuanzhang@gmail.com
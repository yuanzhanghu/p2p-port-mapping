

# p2p-port-mappig
p2p内网穿透, 端口转发/端口映射. 跨NAT和防火墙，从任何地方访问你的服务器. 

<br />

## 目录

- [特点](#特点)
- [安装步骤](#安装步骤)
- [配置方法](#配置方法)
- [其他命令](#其他命令)
- [作者](#作者)

### 特点
1. p2p 端口转发/端口映射， 不需要数据中继服务器
2. 使用webrtc建立隧道, scp 拷贝速率可以达到350Mbps
3. NAT内网穿透，不需要配置路由器
4. 自动安装服务，重启机器自动重连
5. 每个隧道支持多个客户端和多个链接
6. 在windows/linux上测试通过

### 安装步骤
1. 安装node
2. git clone https://github.com/yuanzhanghu/p2p-port-mapping.git
3. cd p2p-port-mapping
4. npm install

### 配置方法
假设我们需要从电脑B访问电脑A的windows远程桌面 (跨多个防火墙和NAT)
```sh
1. 在电脑A上(windows)上生成serverKey:
node p2p-mapping.js --add --mapping-out --port 3389
  added mapping: port 3389 ====> serverKey:iweos23kW //上面的命令会生成一个serverKey,记住这个serverKey，需要在电脑B上使用
node p2p-mapping.js --start-service

2. 在电脑B上, 使用刚刚生成的serverKey:
(linux或者windows) node p2p-mapping.js --add --mapping-in -n winRDP --server-key iweos23kW --port 4001
(linux) sudo `which node` p2p-mapping.js --start-service
(windows) node p2p-mapping.js --start-service

3. 现在在B上看看隧道是否已经建立:
(linux或者windows)node p2p-mapping.js -l
mapping port out list:
mapping port in list:
 name:winRDP, serverKey:iweos23kW ====> port:4001, registered:true, connected:true

4. connected:true表示隧道已经建立, 现在在B上打开远程桌面客户端(windows 上是mstsc.exe, linux 上是Remmina)， 访问localhost:4001即可访问A的远程桌面
```

### 其他命令
```
1. 停止服务:
(linux) sudo `which node` p2p-mapping.js --stop-service
(windows) node p2p-mapping.js --stop-service

2. 删除从本地端口到serverKey的映射:
(linux and windows) node p2p-mapping.js --delete --mapping-out --port 22

3. 删除从serverKey到本地端口的映射:
(linux and windows) node p2p-mapping.js --delete --mapping-in --port 2222

4. 列出当前映射状态:
node p2p-mapping.js --list

5. 显示命令帮助:
node p2p-mapping.js --help

```

### 作者
QQ交流群: 872893118
<br />
email: huyuanzhang@gmail.com
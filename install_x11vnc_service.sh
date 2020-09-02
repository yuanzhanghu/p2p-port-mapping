#/bin/bash

echo apt install x11vnc -y
apt install x11vnc -y
echo cp ./x11vnc.service /etc/systemd/system/
# ExecStart=/usr/bin/x11vnc -forever -localhost -nevershared -display :0 -env FD_XDM=1 -auth guess
authToken=`ps ax|grep -e 'Xorg.*\ -auth' |grep tty|awk 'FNR == 1'|sed -n 's/.*-auth \(.*\) .*/\1/p'|awk '{print $1}'`
sed "s|-auth.*|-auth ${authToken}|g" x11vnc.service> newUnit
systemctl stop x11vnc
systemctl disable x11vnc
cp newUnit /etc/systemd/system/x11vnc.service
echo systemctl enable x11vnc
systemctl enable x11vnc
echo systemctl start x11vnc
systemctl start x11vnc

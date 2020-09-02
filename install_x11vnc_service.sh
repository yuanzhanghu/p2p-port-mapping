#/bin/bash

echo apt install x11vnc -y
apt install x11vnc -y
echo cp ./x11vnc.service /etc/systemd/system/
cp ./x11vnc.service /etc/systemd/system/
echo systemctl enable x11vnc
systemctl enable x11vnc
echo systemctl start x11vnc
systemctl start x11vnc


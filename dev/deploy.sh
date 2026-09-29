cd /opt/kgivler_com/dev/src
go build -o /tmp/devsite .
sudo install -m 0755 /tmp/devsite /usr/local/bin/devsite
sudo systemctl restart devsite

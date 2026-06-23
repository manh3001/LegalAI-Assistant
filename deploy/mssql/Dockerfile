# SQL Server 2022 for Railway with a persistent volume.
#
# The stock image runs as the non-root "mssql" user (UID 10001), but Railway
# mounts the volume at /var/opt/mssql owned by root. That makes the data dir
# unwritable, so SQL Server fails to initialize and drops every connection
# (ECONNRESET / prelogin failure). We run as root and fix ownership on boot.
FROM mcr.microsoft.com/mssql/server:2022-latest

USER root

# On each start: recreate the data/log/secrets subdirs that the empty Railway
# volume hides, make the volume writable, then launch SQL Server as root.
ENTRYPOINT ["/bin/bash", "-c", "mkdir -p /var/opt/mssql/data /var/opt/mssql/log /var/opt/mssql/secrets && chown -R root:root /var/opt/mssql && chmod -R 0775 /var/opt/mssql; exec /opt/mssql/bin/sqlservr"]

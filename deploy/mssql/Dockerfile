# SQL Server 2022 for Railway with a persistent volume.
#
# The stock image runs as the non-root "mssql" user (UID 10001), but Railway
# mounts the volume at /var/opt/mssql owned by root. That makes the data dir
# unwritable, so SQL Server fails to initialize and drops every connection
# (ECONNRESET / prelogin failure). We run as root and fix ownership on boot.
FROM mcr.microsoft.com/mssql/server:2022-latest

USER root

# On each start: ensure the mounted volume is writable, then launch SQL Server
# as root so it can always access /var/opt/mssql.
ENTRYPOINT ["/bin/bash", "-c", "chown -R root:root /var/opt/mssql 2>/dev/null || true; exec /opt/mssql/bin/sqlservr"]

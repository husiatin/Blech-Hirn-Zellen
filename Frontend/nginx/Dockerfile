FROM nginx:latest
#COPY nginx.conf /etc/nginx/nginx.conf

FROM nginx:latest

# 🚨 NEU: Kopiert IHRE Datei 'nginx.conf' und überschreibt die standardmäßige Konfiguration 'default.conf' im Container.
COPY nginx.conf /etc/nginx/conf.d/default.conf 

COPY static /etc/nginx/html
# App Assets

Coloca aquí las imágenes para generar el icono y la splash screen de la app.

## Archivos requeridos:

1. **icon.png**
   - Tamaño: 1024x1024 px
   - Formato: PNG (sin transparencia para mejores resultados en Android)
   - Uso: Icono de la aplicación.

2. **splash.png**
   - Tamaño: 2732x2732 px (o similar de alta resolución)
   - Formato: PNG
   - Uso: Pantalla de carga al iniciar la app.

## Para generar los recursos:

Una vez que hayas copiado los archivos a esta carpeta, ejecuta:

```bash
npm install @capacitor/assets --save-dev
npx capacitor-assets generate --android
```

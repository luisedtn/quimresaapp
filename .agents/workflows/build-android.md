---
description: Compilación y ejecución de la aplicación Android
---

# Compilación y Ejecución en Android

Este workflow describe los pasos necesarios para compilar y ejecutar la aplicación Quimresa Color en dispositivos Android, y cómo habilitar la funcionalidad del Colorímetro Bluetooth.

## Requisitos Previos

1. **Android Studio**: Debe estar instalado (https://developer.android.com/studio).
2. **SDK de Android**: Asegúrate de tener descargado un SDK reciente (ej. API 33 o superior).
3. **Dispositivo Físico o Emulador**: Para probar Bluetooth, es **obligatorio usar un dispositivo Android físico**, ya que los emuladores rara vez soportan BLE (Bluetooth Low Energy) o pass-through de Bluetooth. Opcionalmente, para probar solo la interfaz gráfica, puedes usar el emulador.

## Pasos para Compilar

### 1. Construir la Web App y Sincronizar Capacitor

Ejecuta el script dedicado que construye el frontend con Vite, sincroniza los archivos con la plataforma Android y abre Android Studio:

```bash
npm run build:android
```

Este comando equivale a:
1. `npm run build` (vite build -> compila el código en `/dist`)
2. `npx cap sync android` (copia el `/dist` y los plugins a la plataforma Android)
3. `npx cap open android` (abre el proyecto en Android Studio)

### 2. Ejecutar desde Android Studio

1. Espera a que Android Studio indexe el proyecto y construya con Gradle (puede tomar unos minutos la primera vez).
2. Conecta tu celular Android por cable USB y asegúrate de tener activada la **Depuración por USB** en las opciones de desarrollador.
3. Arriba a la derecha, al lado del botón de "Play" (Run), asegúrate de que tu dispositivo esté seleccionado.
4. Presiona el botón **Run** (Play verde) o usa el atajo `Shift + F10`.

## Notas Importantes sobre Bluetooth (BLE)

* **Dispositivo Físico Requerido**: El escáner Nix requiere Bluetooth Low Energy (BLE) activo.
* **Permisos**: Al iniciar la aplicación en el dispositivo físico, la primera vez que se intente conectar al Nix, **Android solicitará permisos de "Ubicación" (en Android < 12) o "Dispositivos Cercanos" (Android 12+)**. El usuario DEBE conceder este permiso o el escaneo BLE fallará irremediablemente.
* **Troubleshooting BLE**: Si la app en Android no encuentra el dispositivo Nix, intenta:
  1. Verificar que el Bluetooth está realmente encendido.
  2. Verificar en Configuración > Aplicaciones > Quimresa Color > Permisos que "Dispositivos Cercanos" o "Ubicación" estén permitidos.
  3. Comprobar que el Nix Sensor no esté conectado directamente al teléfono a través del menú de Bluetooth genérico (debe emparejarse "dentro" de la app).

## Comandos Útiles

// turbo
* Sincronizar cambios web rápidos sin abrir IDE:
```powershell
npm run build
npm run cap:sync
```

## Logs y Depuración

Para ver logs del puente BLE y la plataforma nativa, puedes usar el **Logcat** en la parte inferior de Android Studio. Filtra la salida usando las etiquetas `Capacitor`, `BleClient`, o `Console`.

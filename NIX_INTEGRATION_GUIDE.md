# Guía de Integración Nix Sensor SDK (Android Nativo)

Esta guía documenta la implementación del puente nativo para los sensores de color Nix (Mini, Pro, Spectro) en la aplicación Quimresa App.

## Problema Original
La **Web Bluetooth API** (usada en navegadores) permite encontrar el dispositivo Nix, pero no puede leer sus valores de color. Esto se debe a que Nix utiliza un protocolo de comunicación cerrado que requiere:
1. Activación de una licencia de SDK.
2. Comandos de medición "firmados".
3. Algoritmos de decodificación de bytes a L*a*b* específicos de la marca.

## Solución Implementada
Se ha migrado la lógica de Android de una conexión de Bluetooth genérica a una **integración profunda con el SDK Nix Universal v4.2.1**.

### 1. Componentes del Puente (Bridge)
- **`NixSensorPlugin.java`**: Ubicado en `android/app/src/main/java/com/quimresa/colorapp/`. Este plugin de Capacitor envuelve las funciones nativas de la SDK de Nix y las expone a JavaScript.
- **`MainActivity.java`**: Se modificó para registrar el plugin `NixSensorPlugin` al iniciar la app.
- **`build.gradle` (App)**: Se añadió la dependencia `implementation 'com.nixsensor:universalsdk:4.2.1'`.
- **`AndroidManifest.xml`**: Se añadieron permisos de `BLUETOOTH_SCAN` y `BLUETOOTH_CONNECT` para Android 12+.

### 2. Capa de Aplicación (TypeScript)
- **`NixBluetoothService.ts`**: Servicio dual que detecta la plataforma.
  - En **Web**: Sigue usando Web Bluetooth (útil para pruebas de UI o dispositivos abiertos).
  - En **Android**: Llama al plugin nativo `NixSensor`, obteniendo datos procesados directamente por la SDK oficial.
- **`useNixDevice.ts`**: Hook de React que maneja el estado (conectando, escaneando, batería).

## Instrucciones de Compilación

Para probar las lecturas de color en un dispositivo físico:

1. **Construir el proyecto**:
   ```bash
   npm run build:android
   ```
   *Esto compilará el código web, sincronizará Capacitor y abrirá Android Studio.*

2. **Ejecutar en Celular**:
   - Conecta tu celular Android por USB.
   - Activa la "Depuración por USB" en las opciones de desarrollador.
   - En Android Studio, presiona el botón **Run** (Play verde).

## Configuración de Licencia

El SDK de Nix puede requerir una licencia para funcionar fuera de modo demo. Para configurarla:

1. Abre el archivo: `android/app/src/main/java/com/quimresa/colorapp/NixSensorPlugin.java`.
2. Busca el método `load()`.
3. Reemplaza los valores en:
   ```java
   LicenseManager.INSTANCE.activate(
       getContext(),
       "TU_OPTIONS_AQUÍ",
       "TU_SIGNATURE_AQUÍ"
   );
   ```

## Notas Técnicas
- **Estándar de Color**: Las mediciones se devuelven en **CIE L*a*b* D50/2°**, que es el estándar para la industria de pinturas y recubrimientos.
- **Delta E**: El sistema calcula automáticamente la diferencia de color (**ΔE 2000**) entre la medición actual y la anterior para control de calidad.

---
*Documentación generada para Quimresa App - 2026*

# Sistema de Garage Inteligente - Aplicación Web

Una interfaz web moderna e intuitiva para controlar tu Arduino garage mediante comunicación por puerto serial.

##  Características

 **Conexión en tiempo real** - Web Serial API para comunicación directa con Arduino  
 **Panel de control intuitivo** - Interfaz moderna con animaciones suaves  
 **Monitoreo de sensores** - Visualización en tiempo real de entrada/salida  
 **Historial de eventos** - Registro completo de todas las acciones  
 **Indicadores visuales** - LEDs virtuales y barras de estado  
 **Diseño responsive** - Funciona en desktop, tablet y móvil  
 **Tema oscuro** - Interfaz moderna y cómoda

##  Requisitos

- **Navegador moderno** con soporte Web Serial API:
  - Google Chrome 89+
  - Microsoft Edge 89+
  - Opera 75+
- **Arduino** con código compatible (ver sección de actualización)
- **Puerto Serial COM9** (o el que uses en tu sistema)

##  Instalación

1. **Descarga los archivos**:
   - `index.html` - Estructura HTML
   - `styles.css` - Estilos y diseño
   - `serial.js` - Gestión de comunicación serial
   - `app.js` - Lógica principal

2. **Abre la aplicación**:

   ```bash
   # Opción 1: Abre directamente en el navegador
   # (necesitas un servidor local para seguridad)

   # Opción 2: Usa Python (si lo tienes instalado)
   python -m http.server 8000
   # Luego abre http://localhost:8000 en tu navegador
   ```

3. **Conexión**:
   - Haz clic en "Conectar Arduino"
   - Selecciona tu puerto COM (COM9)
   - ¡Listo!

##  Actualización del Código Arduino

Para que la aplicación web funcione correctamente, tu Arduino necesita enviar datos estructurados.

Reemplaza tu código actual con esta versión mejorada:

```cpp
#include <Servo.h>

// Configuración de pines
const int trigEntrada = 2;
const int echoEntrada = 3;
const int trigSalida = 4;
const int echoSalida = 5;
const int pinServo = 9;
const int pinLed = 11;
const int pinLed2 = 12;

// Variables de control
Servo puerta;
int capacidad = 6;
int distanciaUmbral = 10;
unsigned long lastEntradaCheck = 0;
unsigned long lastSalidaCheck = 0;

void setup() {
  Serial.begin(9600);
  pinMode(trigEntrada, OUTPUT);
  pinMode(echoEntrada, INPUT);
  pinMode(trigSalida, OUTPUT);
  pinMode(echoSalida, INPUT);
  pinMode(pinLed, OUTPUT);
  pinMode(pinLed2, OUTPUT);

  puerta.attach(pinServo);
  puerta.write(180);

  delay(1000);
  Serial.println("Sistema Garage Inteligente Iniciado");
}

void loop() {
  long dEntrada = obtenerDistancia(trigEntrada, echoEntrada);
  long dSalida = obtenerDistancia(trigSalida, echoSalida);

  // Envía datos de sensores cada 500ms
  if (millis() - lastEntradaCheck > 500) {
    if (dEntrada > 0) {
      Serial.print("dEntrada: ");
      Serial.println(dEntrada);
    }
    lastEntradaCheck = millis();
  }

  if (millis() - lastSalidaCheck > 500) {
    if (dSalida > 0) {
      Serial.print("dSalida: ");
      Serial.println(dSalida);
    }
    lastSalidaCheck = millis();
  }

  // Lógica de Entrada
  if (dEntrada > 0 && dEntrada < distanciaUmbral) {
    if (capacidad > 0) {
      Serial.println("Auto detectado en entrada");
      abrirPuerta();
      capacidad--;
      Serial.print("Espacios disponibles: ");
      Serial.println(capacidad);
    } else {
      Serial.println("Garage LLENO - No se puede entrar");
    }
    delay(2000);
  }

  // Lógica de Salida
  if (dSalida > 0 && dSalida < distanciaUmbral) {
    Serial.println("Auto saliendo del garage");
    digitalWrite(pinLed, HIGH);
    capacidad++;
    if(capacidad > 6) capacidad = 6;
    Serial.print("Espacios disponibles: ");
    Serial.println(capacidad);
    delay(2000);
    digitalWrite(pinLed, LOW);
  }

  // Procesa comandos desde la web
  procesarComandos();

  delay(100);
}

void abrirPuerta() {
  digitalWrite(pinLed2, HIGH);
  puerta.write(90);
  delay(3000);
  puerta.write(180);
  digitalWrite(pinLed2, LOW);
}

void cerrarPuerta() {
  puerta.write(180);
  delay(500);
}

long obtenerDistancia(int trig, int echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);

  long duracion = pulseIn(echo, HIGH, 30000);
  long distancia = duracion * 0.034 / 2;
  return distancia;
}

void procesarComandos() {
  if (Serial.available()) {
    String comando = Serial.readStringUntil('\n');
    comando.trim();

    if (comando == "OPEN_DOOR") {
      Serial.println("Abriendo puerta...");
      abrirPuerta();
    }
    else if (comando == "CLOSE_DOOR") {
      Serial.println("Cerrando puerta...");
      cerrarPuerta();
    }
    else if (comando == "STATUS") {
      Serial.print("Espacios disponibles: ");
      Serial.println(capacidad);
    }
  }
}
```

##  Uso de la Interfaz

### Conexión

- **Conectar Arduino**: Abre el selector de puerto y elige COM9
- **Desconectar**: Cierra la conexión serial

### Panel de Estado

- **Espacios Disponibles**: Muestra la cantidad de espacios libres (0-6)
- **Puerta**: Indica si está ABIERTA o CERRADA
- **Sistema**: Muestra el estado general (OK/ERROR)

### Controles

- **Abrir Puerta**: Abre la puerta manualmente
- **Cerrar Puerta**: Cierra la puerta manualmente

### Datos de Sensores

- **Entrada**: Distancia detectada por sensor de entrada
- **Salida**: Distancia detectada por sensor de salida

### Historial

- Registra todos los eventos del sistema
- Muestra timestamps precisos
- Colores por tipo de evento (info, éxito, advertencia, error)

##  Personalización

### Cambiar capacidad máxima

En `app.js`, busca:

```javascript
const percentage = (spaces / 6) * 100; // Cambia 6 por tu capacidad
```

### Cambiar distancia umbral

En el Arduino:

```cpp
int distanciaUmbral = 10; // Cambia 10 cm por tu valor
```

### Cambiar colores

En `styles.css`, modifica las variables CSS:

```css
:root {
  --primary: #0066cc;
  --success: #10b981;
  --danger: #ef4444;
  /* etc... */
}
```

##  Solución de Problemas

### "Web Serial API no soportada"

- Usa Chrome, Edge u Opera (versiones recientes)
- Firefox aún no lo soporta

### "No se detecta el puerto"

- Verifica que el Arduino esté conectado
- Instala drivers CH340 si usas clone de Arduino
- Intenta resetear el Arduino

### No se reciben datos

- Verifica que el baudrate sea 9600
- Comprueba que el Arduino tenga el código actualizado
- Abre el Serial Monitor de Arduino IDE para debugging

### La puerta no responde

- Verifica que el servo esté conectado al pin 9
- Prueba manualmente con Arduino IDE
- Comprueba la alimentación del servo


## Notas Importantes

- La conexión Web Serial solo funciona en navegadores modernos
- Por seguridad, solo funciona en HTTPS (excepto localhost)
- Los permisos de hardware se solicitan en cada conexión
- Los datos no se almacenan permanentemente (solo en memoria)

## Técnica

**Frontend Stack:**

- Vanilla JavaScript (sin dependencias)
- CSS3 Grid y Flexbox
- Web Serial API
- HTML5 Semántico

**Comunicación:**

- Serial 9600 baud
- Líneas terminadas en \n
- Formato simple y legible



**Disfruta controlando tu garage desde la web** 🚗✨

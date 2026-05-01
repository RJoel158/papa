#include <Servo.h>

// ========== CONFIGURACIÓN DE PINES ==========
const int trigEntrada = 2;
const int echoEntrada = 3;
const int trigSalida = 4;
const int echoSalida = 5;
const int pinServo = 9;
const int pinLed = 11;        // LED rojo (salida)
const int pinLed2 = 12;       // LED verde (entrada)

// ========== VARIABLES DE CONTROL ==========
Servo puerta;
int capacidad = 6;            // Capacidad máxima del garage
int distanciaUmbral = 10;     // Distancia en cm para detectar auto
unsigned long lastEntradaCheck = 0;
unsigned long lastSalidaCheck = 0;
const unsigned long SENSOR_INTERVAL = 500;  // Enviar datos cada 500ms

// ========== SETUP ==========
void setup() {
  Serial.begin(9600);
  
  // Configura sensores ultrasónicos
  pinMode(trigEntrada, OUTPUT);
  pinMode(echoEntrada, INPUT);
  pinMode(trigSalida, OUTPUT);
  pinMode(echoSalida, INPUT);
  
  // Configura LEDs
  pinMode(pinLed, OUTPUT);
  pinMode(pinLed2, OUTPUT);
  digitalWrite(pinLed, LOW);
  digitalWrite(pinLed2, LOW);
  
  // Configura servo (puerta)
  puerta.attach(pinServo);
  puerta.write(180);  // Puerta cerrada
  
  // Espera a que Arduino se inicialice
  delay(1000);
  
  // Envía estado inicial
  Serial.print("Espacios: ");
  Serial.println(capacidad);
}

// ========== LOOP PRINCIPAL ==========
void loop() {
  // Lee sensores
  long dEntrada = obtenerDistancia(trigEntrada, echoEntrada);
  long dSalida = obtenerDistancia(trigSalida, echoSalida);

  // Envía datos de sensores periódicamente
  enviarDatosSensores(dEntrada, dSalida);

  // Lógica de ENTRADA (auto queriendo entrar)
  procesarEntrada(dEntrada);

  // Lógica de SALIDA (auto queriendo salir)
  procesarSalida(dSalida);

  // Procesa comandos desde la aplicación web
  procesarComandos();

  delay(100);  // Pequeña pausa para estabilidad
}

// ========== FUNCIONES DE SENSORES ==========

/**
 * Calcula la distancia en cm usando sensor ultrasónico
 */
long obtenerDistancia(int trig, int echo) {
  // Envía pulso
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  
  // Lee duración del pulso
  long duracion = pulseIn(echo, HIGH, 30000);  // Timeout de 30ms
  
  // Calcula distancia: distancia = (duracion * velocidad) / 2
  // Velocidad del sonido = 0.034 cm/microsegundo
  long distancia = duracion * 0.034 / 2;
  
  return distancia;
}

/**
 * Envía datos de sensores a la aplicación web
 */
void enviarDatosSensores(long dEntrada, long dSalida) {
  // Datos de sensores eliminados para consola limpia
}

// ========== FUNCIONES DE LÓGICA ==========

/**
 * Procesa detección en entrada
 */
void procesarEntrada(long distancia) {
  static unsigned long ultimaDeteccionEntrada = 0;
  const unsigned long DEBOUNCE_ENTRADA = 1500;  // Ignora lecturas en 1.5s

  if (distancia > 0 && distancia < distanciaUmbral) {
    // Evita múltiples detecciones
    if (millis() - ultimaDeteccionEntrada > DEBOUNCE_ENTRADA) {
      if (capacidad > 0) {
        abrirPuerta();
        capacidad--;
        Serial.print("Espacios: ");
        Serial.println(capacidad);
      } else {
        Serial.println("LLENO");
      }
      ultimaDeteccionEntrada = millis();
    }
  }
}

/**
 * Procesa detección en salida
 */
void procesarSalida(long distancia) {
  static unsigned long ultimaDeteccionSalida = 0;
  const unsigned long DEBOUNCE_SALIDA = 2000;

  if (distancia > 0 && distancia < distanciaUmbral) {
    if (millis() - ultimaDeteccionSalida > DEBOUNCE_SALIDA) {
      Serial.println("Auto saliendo del garage");
      digitalWrite(pinLed, HIGH);
      capacidad++;
      if (capacidad > 6) capacidad = 6;
      Serial.print("Espacios: ");
      Serial.println(capacidad);
      delay(2000);
      digitalWrite(pinLed, LOW);
      ultimaDeteccionSalida = millis();
    }
  }
}

// ========== FUNCIONES DE CONTROL ==========

/**
 * Abre la puerta (servo a 90°)
 */
void abrirPuerta() {
  digitalWrite(pinLed2, HIGH);
  puerta.write(90);
  delay(3000);
  puerta.write(180);
  digitalWrite(pinLed2, LOW);
}

/**
 * Cierra la puerta (servo a 180°)
 */
void cerrarPuerta() {
  puerta.write(180);
  digitalWrite(pinLed2, LOW);
}

// ========== FUNCIONES DE COMUNICACIÓN SERIAL ==========

/**
 * Procesa comandos recibidos desde la aplicación web
 * Formatos soportados:
 * - OPEN_DOOR : Abre la puerta
 * - CLOSE_DOOR : Cierra la puerta
 * - STATUS : Envía estado actual
 * - RESET : Reinicia el conteo
 */
void procesarComandos() {
  if (Serial.available()) {
    String comando = Serial.readStringUntil('\n');
    comando.trim();
    comando.toUpperCase();
    
    if (comando == "OPEN_DOOR") {
      abrirPuerta();
    }
    else if (comando == "CLOSE_DOOR") {
      cerrarPuerta();
    }
    else if (comando == "STATUS") {
      enviarEstado();
    }
    else if (comando == "RESET") {
      capacidad = 6;
      enviarEstado();
    }
  }
}

/**
 * Envía el estado actual del sistema
 */
void enviarEstado() {
  Serial.print("Espacios: ");
  Serial.println(capacidad);
}

// ========== FIN DEL CÓDIGO ==========

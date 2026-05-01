/**
 * SerialManager - Gestiona la conexión Serial con Arduino
 * Usa Web Serial API para comunicación bidireccional
 */
class SerialManager {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.readingPromise = null;
        this.listeners = [];
    }

    /**
     * Solicita acceso al puerto serial
     */
    async connect() {
        try {
            // Solicita seleccionar puerto (permitirá elegir COM9)
            this.port = await navigator.serial.requestPort({
                filters: [
                    { usbVendorId: 0x2341 }, // Arduino
                    { usbVendorId: 0x1a86 }, // CH340 (Arduino clones)
                    { usbVendorId: 0x1a86 }, // Other common Arduino chips
                ]
            });

            // Abre el puerto con la configuración estándar de Arduino
            await this.port.open({ 
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none'
            });

            this.isConnected = true;

            // Obtiene información del puerto
            const info = this.port.getInfo();
            const portName = this.getPortName();

            this.emit('connected', { port: portName, info });

            // Inicia lectura de datos
            this.startReading();

            return { success: true, port: portName };
        } catch (error) {
            if (error.name === 'NotFoundError') {
                this.emit('error', 'No se seleccionó ningún puerto');
            } else if (error.name === 'InvalidStateError') {
                this.emit('error', 'El puerto ya está en uso');
            } else if (error.name === 'NetworkError') {
                this.emit('error', 'Error de conexión con el puerto');
            } else {
                this.emit('error', `Error al conectar: ${error.message}`);
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtiene el nombre del puerto
     */
    getPortName() {
        if (!this.port) return 'Desconocido';
        
        const info = this.port.getInfo();
        const { usbVendorId, usbProductId } = info;

        // Intenta obtener el nombre del puerto
        try {
            // En Windows, el puerto aparece como COM9, etc.
            // En Linux/Mac, como /dev/ttyUSB0, etc.
            return `${usbVendorId}:${usbProductId}`;
        } catch {
            return 'Puerto Serial';
        }
    }

    /**
     * Inicia la lectura continua de datos desde el Arduino
     */
    async startReading() {
        if (!this.port || !this.port.readable) return;

        this.reader = this.port.readable.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (this.isConnected && this.port.readable) {
                const { value, done } = await this.reader.read();

                if (done) break;

                if (value) {
                    const text = decoder.decode(value, { stream: true });
                    buffer += text;

                    // Procesa líneas completas (terminadas en \n)
                    const lines = buffer.split('\n');
                    
                    // Mantiene la última línea incompleta en el buffer
                    buffer = lines.pop() || '';

                    // Emite cada línea completa
                    lines.forEach(line => {
                        const trimmed = line.trim();
                        if (trimmed) {
                            this.emit('data', trimmed);
                            this.parseData(trimmed);
                        }
                    });
                }
            }
        } catch (error) {
            if (error.name !== 'NetworkError') {
                console.error('Error de lectura:', error);
                this.emit('error', `Error de lectura: ${error.message}`);
            }
        } finally {
            this.reader?.releaseLock();
        }
    }

    /**
     * Envía datos al Arduino
     */
    async send(data) {
        if (!this.isConnected || !this.port || !this.port.writable) {
            this.emit('error', 'Puerto no conectado');
            return false;
        }

        try {
            const writer = this.port.writable.getWriter();
            const encoder = new TextEncoder();
            const command = typeof data === 'string' ? data : JSON.stringify(data);
            
            await writer.write(encoder.encode(command + '\n'));
            writer.releaseLock();
            
            return true;
        } catch (error) {
            this.emit('error', `Error al enviar: ${error.message}`);
            return false;
        }
    }

    /**
     * Envía comando simple al Arduino
     */
    async sendCommand(cmd) {
        return await this.send(cmd);
    }

    /**
     * Parsea datos recibidos del Arduino
     * Busca patrones específicos en los mensajes
     */
    parseData(line) {
        const data = {
            raw: line,
            timestamp: new Date().toISOString()
        };

        // Detecta distancia de entrada
        if (line.includes('dEntrada:')) {
            const match = line.match(/dEntrada:\s*(\d+)/);
            if (match) {
                data.type = 'sensor_entrada';
                data.value = parseInt(match[1]);
            }
        }
        // Detecta distancia de salida
        else if (line.includes('dSalida:')) {
            const match = line.match(/dSalida:\s*(\d+)/);
            if (match) {
                data.type = 'sensor_salida';
                data.value = parseInt(match[1]);
            }
        }
        // Detecta espacios disponibles
        else if (line.includes('Espacios')) {
            const match = line.match(/(\d+)/);
            if (match) {
                data.type = 'spaces';
                data.value = parseInt(match[1]);
            }
        }
        // Detecta estado de puerta
        else if (line.includes('puerta') || line.includes('Abriendo') || line.includes('Cerrando')) {
            data.type = 'door_event';
        }
        // Detecta auto detectado
        else if (line.includes('Auto detectado')) {
            data.type = 'car_detected_entry';
        }
        // Detecta auto saliendo
        else if (line.includes('saliendo')) {
            data.type = 'car_detected_exit';
        }
        // Detecta garage lleno
        else if (line.includes('Lleno')) {
            data.type = 'garage_full';
        }
        // Inicialización del sistema
        else if (line.includes('Iniciado')) {
            data.type = 'system_init';
        }

        if (data.type) {
            this.emit('parsed', data);
        }
    }

    /**
     * Desconecta del puerto serial
     */
    async disconnect() {
        this.isConnected = false;

        if (this.reader) {
            try {
                await this.reader.cancel();
                this.reader.releaseLock();
            } catch (e) {
                console.error('Error al cancelar lectura:', e);
            }
        }

        if (this.port) {
            try {
                await this.port.close();
            } catch (e) {
                console.error('Error al cerrar puerto:', e);
            }
        }

        this.emit('disconnected');
    }

    /**
     * Registra listener para eventos
     */
    on(event, callback) {
        this.listeners.push({ event, callback });
    }

    /**
     * Emite eventos a listeners registrados
     */
    emit(event, data) {
        this.listeners
            .filter(l => l.event === event)
            .forEach(l => l.callback(data));
    }

    /**
     * Verifica si la Web Serial API está disponible
     */
    static isSupported() {
        return 'serial' in navigator;
    }
}

// Exporta para uso global
window.SerialManager = SerialManager;

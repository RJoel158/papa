/**
 * GarageApp - Controlador principal de la aplicación
 */
class GarageApp {
    constructor() {
        this.serial = new SerialManager();
        this.state = {
            spaces: '--',
            doorOpen: false,
            systemOk: true,
            sensorEntrada: 0,
            sensorSalida: 0,
            events: []
        };

        this.init();
    }

    init() {
        // Verifica compatibilidad
        if (!SerialManager.isSupported()) {
            this.showError('Web Serial API no soportada en tu navegador. Usa Chrome, Edge o similar.');
            return;
        }

        this.setupEventListeners();
        this.setupSerialListeners();
        this.logEvent('Sistema iniciado', 'info');
    }

    /**
     * Configura listeners de eventos de UI
     */
    setupEventListeners() {
        // Botones de conexión
        document.getElementById('connectBtn').addEventListener('click', () => this.connect());
        document.getElementById('disconnectBtn').addEventListener('click', () => this.disconnect());

        // Botones de control
        document.getElementById('openDoorBtn').addEventListener('click', () => this.openDoor());
        document.getElementById('closeDoorBtn').addEventListener('click', () => this.closeDoor());

        // Botón limpiar eventos
        document.getElementById('clearEventsBtn').addEventListener('click', () => this.clearEvents());
    }

    /**
     * Configura listeners para eventos del SerialManager
     */
    setupSerialListeners() {
        this.serial.on('connected', (data) => this.onConnected(data));
        this.serial.on('disconnected', () => this.onDisconnected());
        this.serial.on('error', (error) => this.onSerialError(error));
        this.serial.on('data', (data) => this.onSerialData(data));
        this.serial.on('parsed', (data) => this.onParsedData(data));
    }

    /**
     * Conecta al puerto serial
     */
    async connect() {
        const btn = document.getElementById('connectBtn');
        btn.disabled = true;
        btn.textContent = 'Conectando...';

        const result = await this.serial.connect();

        if (result.success) {
            this.updateUI('connected');
            this.logEvent(`Conectado a ${result.port}`, 'success');
        } else {
            btn.disabled = false;
            btn.textContent = 'Conectar Arduino';
        }
    }

    /**
     * Desconecta del puerto serial
     */
    async disconnect() {
        await this.serial.disconnect();
    }

    /**
     * Callback cuando se conecta
     */
    onConnected(data) {
        this.updateUI('connected');
        document.getElementById('portInfo').textContent = `Conectado a: ${data.port}`;
        this.logEvent(`Conectado a puerto serial`, 'success');
        
        // Solicita estado inicial
        setTimeout(() => {
            this.serial.sendCommand('STATUS');
        }, 500);
    }

    /**
     * Callback cuando se desconecta
     */
    onDisconnected() {
        this.updateUI('disconnected');
        document.getElementById('portInfo').textContent = '';
        this.logEvent('Desconectado del puerto serial', 'warning');
    }

    /**
     * Callback para errores de serial
     */
    onSerialError(error) {
        this.logEvent(error, 'error');
        this.updateUI('disconnected');
    }

    /**
     * Callback para datos sin procesar
     */
    onSerialData(data) {
        // Para debugging, puedes descomentar:
        // console.log('Raw data:', data);
    }

    /**
     * Callback para datos parseados
     */
    onParsedData(data) {
        console.log('Parsed data:', data);

        switch (data.type) {
            case 'sensor_entrada':
                this.updateSensorEntrada(data.value);
                break;
            case 'sensor_salida':
                this.updateSensorSalida(data.value);
                break;
            case 'spaces':
                this.updateSpaces(data.value);
                this.logEvent(`Espacios disponibles: ${data.value}`, 'info');
                break;
            case 'car_detected_entry':
                this.logEvent('Auto detectado en entrada', 'info');
                this.flashUI('entry');
                break;
            case 'car_detected_exit':
                this.logEvent('Auto saliendo del garage', 'info');
                this.flashUI('exit');
                break;
            case 'garage_full':
                this.logEvent('Garage LLENO', 'warning');
                this.state.systemOk = false;
                break;
            case 'door_event':
                // Actualiza estado de puerta
                if (data.raw.includes('Abriendo') || data.raw.includes('Abre')) {
                    this.updateDoorStatus(true);
                } else if (data.raw.includes('Cierra') || data.raw.includes('Cerrando')) {
                    this.updateDoorStatus(false);
                }
                break;
            case 'system_init':
                this.logEvent('Arduino inicializado correctamente', 'success');
                break;
        }
    }

    /**
     * Abre la puerta
     */
    async openDoor() {
        if (!this.serial.isConnected) {
            this.logEvent('No conectado al Arduino', 'error');
            return;
        }

        const success = await this.serial.sendCommand('OPEN_DOOR');
        if (success) {
            this.logEvent('Comando: Abrir puerta', 'info');
            this.updateDoorStatus(true);
        }
    }

    /**
     * Cierra la puerta
     */
    async closeDoor() {
        if (!this.serial.isConnected) {
            this.logEvent('No conectado al Arduino', 'error');
            return;
        }

        const success = await this.serial.sendCommand('CLOSE_DOOR');
        if (success) {
            this.logEvent('Comando: Cerrar puerta', 'info');
            this.updateDoorStatus(false);
        }
    }

    /**
     * Actualiza UI según estado de conexión
     */
    updateUI(status) {
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const controlBtns = [
            document.getElementById('openDoorBtn'),
            document.getElementById('closeDoorBtn')
        ];

        if (status === 'connected') {
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            statusIndicator.classList.add('connected');
            statusText.textContent = 'Conectado';
            controlBtns.forEach(btn => btn.disabled = false);
            connectBtn.textContent = 'Conectar Arduino';
        } else {
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            statusIndicator.classList.remove('connected');
            statusText.textContent = 'Desconectado';
            controlBtns.forEach(btn => btn.disabled = true);
        }
    }

    /**
     * Actualiza espacios disponibles
     */
    updateSpaces(spaces) {
        this.state.spaces = spaces;
        document.getElementById('spacesValue').textContent = spaces;

        // Calcula porcentaje para la barra (6 es la capacidad máxima)
        const percentage = (spaces / 6) * 100;
        document.getElementById('capacityFill').style.width = percentage + '%';
        document.getElementById('capacityText').textContent = `${spaces} de 6 espacios`;

        // Cambia color si está lleno
        const fill = document.getElementById('capacityFill');
        if (spaces === 0) {
            fill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
        } else if (spaces <= 2) {
            fill.style.background = 'linear-gradient(90deg, #f59e0b, #f97316)';
        } else {
            fill.style.background = 'linear-gradient(90deg, #0066cc, #00a8ff)';
        }
    }

    /**
     * Actualiza estado de la puerta
     */
    updateDoorStatus(isOpen) {
        this.state.doorOpen = isOpen;
        const status = document.getElementById('doorStatus');
        const indicator = document.getElementById('doorIndicator');

        if (isOpen) {
            status.textContent = 'ABIERTA';
            status.classList.add('open');
            indicator.classList.add('open');
        } else {
            status.textContent = 'CERRADA';
            status.classList.remove('open');
            indicator.classList.remove('open');
        }
    }

    /**
     * Actualiza sensor entrada
     */
    updateSensorEntrada(distance) {
        this.state.sensorEntrada = distance;
        document.getElementById('sensorEntrada').textContent = distance + ' cm';

        const indicator = document.getElementById('indicatorEntrada');
        if (distance > 0 && distance < 10) {
            indicator.classList.add('detected');
        } else {
            indicator.classList.remove('detected');
        }
    }

    /**
     * Actualiza sensor salida
     */
    updateSensorSalida(distance) {
        this.state.sensorSalida = distance;
        document.getElementById('sensorSalida').textContent = distance + ' cm';

        const indicator = document.getElementById('indicatorSalida');
        if (distance > 0 && distance < 10) {
            indicator.classList.add('detected');
        } else {
            indicator.classList.remove('detected');
        }
    }

    /**
     * Añade un evento al historial
     */
    logEvent(message, type = 'info') {
        const event = {
            message,
            type,
            timestamp: new Date()
        };

        this.state.events.unshift(event);

        // Mantiene los últimos 50 eventos
        if (this.state.events.length > 50) {
            this.state.events.pop();
        }

        this.renderEvent(event);
    }

    /**
     * Renderiza un evento en la UI
     */
    renderEvent(event) {
        const eventsList = document.getElementById('eventsList');
        const placeholder = eventsList.querySelector('.event-placeholder');

        if (placeholder) {
            placeholder.remove();
        }

        const time = event.timestamp.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const eventEl = document.createElement('div');
        eventEl.className = `event-item ${event.type}`;
        eventEl.innerHTML = `
            <div class="event-time">${time}</div>
            <div class="event-message">${this.escapeHtml(event.message)}</div>
        `;

        eventsList.insertBefore(eventEl, eventsList.firstChild);

        // Añade animación
        eventEl.style.animation = 'none';
        setTimeout(() => {
            eventEl.style.animation = 'slideIn 0.3s ease';
        }, 10);
    }

    /**
     * Limpia el historial de eventos
     */
    clearEvents() {
        this.state.events = [];
        const eventsList = document.getElementById('eventsList');
        eventsList.innerHTML = '<div class="event-placeholder">Esperando eventos...</div>';
        this.logEvent('Historial limpiado', 'info');
    }

    /**
     * Efecto visual de detección
     */
    flashUI(type) {
        const element = type === 'entry' 
            ? document.getElementById('indicatorEntrada')
            : document.getElementById('indicatorSalida');

        element.style.animation = 'none';
        setTimeout(() => {
            element.style.animation = 'pulse 0.5s ease-out';
        }, 10);
    }

    /**
     * Escapa caracteres HTML para evitar XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Muestra error
     */
    showError(message) {
        alert(message);
    }
}

// Inicializa la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new GarageApp();
});

// Aplicación principal
let currentPage = null;
let isSubmittingIngreso = false;
const printingIngresos = new Set();
let adminActiveTab = 'usuarios';

function getCurrentUserSafe() {
    try {
        if (typeof currentUser !== 'undefined' && currentUser) {
            return currentUser;
        }
    } catch (error) {
    }

    try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return null;
        return JSON.parse(storedUser);
    } catch (error) {
        return null;
    }
}

function setCurrentUserSafe(user) {
    try {
        if (typeof currentUser !== 'undefined') {
            currentUser = user;
        }
    } catch (error) {
    }
}

window.addEventListener('error', function(event) {
    const mainContent = document.getElementById('mainContent');
    if (mainContent && !mainContent.innerHTML.trim()) {
        mainContent.innerHTML = `<div class="alert alert-danger">Error de aplicación: ${event.message}</div>`;
    }
});

window.addEventListener('unhandledrejection', function(event) {
    const mainContent = document.getElementById('mainContent');
    if (mainContent && !mainContent.innerHTML.trim()) {
        mainContent.innerHTML = `<div class="alert alert-danger">Error asíncrono: ${event.reason?.message || event.reason || 'desconocido'}</div>`;
    }
});

function initApp() {
    console.log('initApp() called');

    const user = getCurrentUserSafe();
    if (user) {
        setCurrentUserSafe(user);
    }
    
    // Configurar event listener global para el formulario de configuración
    // Usa delegación de eventos para que funcione con contenido dinámico
    document.addEventListener('submit', function(e) {
        if (e.target && e.target.id === 'configForm') {
            e.preventDefault();
            submitConfig(e);
        }
    }, true);
    
    if (user && user.rol) {
        console.log('User logged in, building menu and loading dashboard');
        buildMenu();
        
        // Mostrar botón de usuarios si es admin
        if (user.rol === 'admin') {
            const adminBtn = document.getElementById('adminUsersBtn');
            if (adminBtn) {
                adminBtn.style.display = 'block';
            }
        }
        
        loadPage('dashboard');
    } else {
        console.log('No user found, redirecting to login');
        window.location.href = '/';
    }
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function buildMenu() {
    const menu = document.getElementById('menuNav');
    if (!menu) return;
    const user = getCurrentUserSafe();
    if (!user || !user.rol) {
        menu.innerHTML = '';
        return;
    }
    
    const menuItems = {
        'admin': [
            { icon: 'fa-chart-line', label: 'Dashboard', page: 'dashboard' },
            { icon: 'fa-file-import', label: 'Nuevo Ingreso', page: 'ingreso' },
            { icon: 'fa-list', label: 'Registros', page: 'registros' },
            { icon: 'fa-cogs', label: 'Técnico', page: 'tecnico' },
            { icon: 'fa-wrench', label: 'Administración', page: 'admin' }
        ],
        'empleado': [
            { icon: 'fa-file-import', label: 'Nuevo Ingreso', page: 'ingreso' },
            { icon: 'fa-list', label: 'Mis Ingresos', page: 'registros' }
        ],
        'tecnico': [
            { icon: 'fa-file-import', label: 'Nuevo Ingreso', page: 'ingreso' },
            { icon: 'fa-cogs', label: 'Panel Técnico', page: 'tecnico' },
            { icon: 'fa-list', label: 'Registros', page: 'registros' }
        ]
    };
    
    const items = menuItems[user.rol] || [];
    
    menu.innerHTML = items.map(item => `
        <li class="nav-item mb-2">
            <a class="nav-link" href="#" onclick="loadPage('${item.page}'); return false;">
                <i class="fas ${item.icon} me-2"></i>
                ${item.label}
            </a>
        </li>
    `).join('');
}

async function loadPage(page) {
    const user = getCurrentUserSafe();

    if (page === 'admin') {
        const activeAdminTab = document.querySelector('#mainContent .nav-tabs .nav-link.active');
        if (activeAdminTab) {
            const href = activeAdminTab.getAttribute('href');
            if (href && href.startsWith('#')) {
                adminActiveTab = href.substring(1);
            }
        }
    }

    currentPage = page;
    const mainContent = document.getElementById('mainContent');
    
    if (!mainContent) {
        console.error('mainContent element not found');
        return;
    }
    
    mainContent.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></div>';
    
    let content = '';
    
    try {
        console.log(`Loading page: ${page}`);
        
        switch (page) {
            case 'dashboard':
                content = await loadDashboard();
                break;
            case 'ingreso':
                content = await loadIngresoForm();
                break;
            case 'registros':
                console.log('Calling loadRegistros...');
                content = await loadRegistros();
                console.log('loadRegistros returned, content length:', content.length);
                break;
            case 'tecnico':
                if (!user || (user.rol !== 'tecnico' && user.rol !== 'admin')) {
                    content = '<div class="alert alert-danger">Acceso denegado</div>';
                } else {
                    content = await loadTecnicoPanel();
                }
                break;
            case 'admin':
                if (!user || user.rol !== 'admin') {
                    content = '<div class="alert alert-danger">Acceso denegado</div>';
                } else {
                    content = await loadAdminPanel();
                }
                break;
            default:
                content = '<div class="alert alert-info">Página no encontrada</div>';
        }
    } catch (error) {
        console.error('Error loading page:', page, error);
        content = `<div class="alert alert-danger">Error al cargar la página: ${error.message}<br><pre>${error.stack}</pre></div>`;
    }
    
    console.log(`Setting mainContent for page: ${page}`);
    mainContent.innerHTML = content;
    
    // Agregar listeners después de cargar el contenido
    try {
        if (page === 'dashboard') {
            // Inicializar el dashboard con gráficos
            setTimeout(async () => {
                try {
                    const response = await apiCall('/ingresos?limit=1000');
                    if (response && response.data) {
                        window.allIngresos = response.data;
                        const monthlyData = calculateMonthlyBalance(response.data);
                        crearGraficoBalance(monthlyData);
                        actualizarMetricas(response.data);
                    }
                } catch (error) {
                    console.error('Error initializing dashboard:', error);
                }
            }, 100);
        } else if (page === 'ingreso') {
            // Inicializar wizard con delay para asegurar que el DOM está listo
            setTimeout(() => {
                try {
                    console.log('Inicializando wizard...');
                    currentWizardStep = 1;
                    const paso1 = document.getElementById('paso1');
                    if (!paso1) {
                        console.error('paso1 elemento no encontrado en DOM');
                        return;
                    }
                    updateWizardDisplay();
                    console.log('wizard inicializado');
                    
                    // Agregar listener al campo de búsqueda de clientes
                    const buscarClienteInput = document.getElementById('buscar_cliente');
                    if (buscarClienteInput) {
                        buscarClienteInput.addEventListener('keyup', buscarClientes);
                        buscarClienteInput.addEventListener('input', buscarClientes);
                    }
                    
                    // Agregar listener al checkbox de clave
                    const tieneClaveCheckbox = document.getElementById('tiene_clave');
                    if (tieneClaveCheckbox) {
                        tieneClaveCheckbox.addEventListener('change', function() {
                            const div = document.getElementById('claveDiv');
                            if (div) {
                                div.style.display = this.checked ? 'block' : 'none';
                            }
                        });
                    }
                } catch (error) {
                    console.error('Error en wizard initialization:', error);
                }
            }, 100);
            
            const form = document.getElementById('ingresoForm');
            if (form) {
                form.addEventListener('submit', submitIngreso);
            }
            
            // Agregar listener al cambio de marca
            const marcaSelect = document.getElementById('marca_id');
            if (marcaSelect) {
                marcaSelect.addEventListener('change', loadModelosByMarca);
            }
        } else if (page === 'admin') {
            const adminTabs = document.querySelectorAll('#mainContent .nav-tabs .nav-link[data-bs-toggle="tab"]');
            adminTabs.forEach((tab) => {
                tab.addEventListener('shown.bs.tab', (event) => {
                    const href = event.target.getAttribute('href');
                    if (href && href.startsWith('#')) {
                        adminActiveTab = href.substring(1);
                    }
                });
            });
        }
    } catch (error) {
        console.error('Error adding event listeners:', error);
    }
}

async function loadDashboard() {
    // Obtener todos los ingresos
    const response = await apiCall('/ingresos?limit=1000');
    
    if (!response.data) {
        return '<div class="alert alert-danger">Error al cargar datos</div>';
    }

    // Calcular balance por mes
    const monthlyData = calculateMonthlyBalance(response.data);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const values = months.map((_, i) => monthlyData[i] || 0);

    return `
        <h2 class="mb-4">Dashboard - Balance Mensual</h2>
        
        <div class="card mb-4">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">Filtro por Fechas</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-3">
                        <label class="form-label">Desde:</label>
                        <input type="date" class="form-control" id="fechaDesde">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Hasta:</label>
                        <input type="date" class="form-control" id="fechaHasta">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">Estado:</label>
                        <select class="form-control" id="estadoFiltro">
                            <option value="">Todos</option>
                            <option value="reparado">Reparado</option>
                            <option value="entregado">Entregado</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="en_reparacion">En Reparación</option>
                        </select>
                    </div>
                    <div class="col-md-3 d-flex align-items-end">
                        <button class="btn btn-primary w-100" onclick="filtrarDashboard()">
                            <i class="fas fa-filter me-2"></i> Filtrar
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="card mb-4">
            <div class="card-header">
                <h5 class="mb-0">Balance Mensual</h5>
            </div>
            <div class="card-body">
                <canvas id="chartBalanceMensual" style="max-height: 300px;"></canvas>
            </div>
        </div>

        <div class="row mb-4" id="metricsRow">
            <div class="col-md-3">
                <div class="card bg-info text-white">
                    <div class="card-body">
                        <h5 class="card-title">Total Servicios</h5>
                        <p class="card-text display-4" id="metricTotal">0</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-success text-white">
                    <div class="card-body">
                        <h5 class="card-title">Entregados y Pagados</h5>
                        <p class="card-text display-4" id="metricReparados">0</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-primary text-white">
                    <div class="card-body">
                        <h5 class="card-title">Entregados</h5>
                        <p class="card-text display-4" id="metricEntregados">0</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-warning text-dark">
                    <div class="card-body">
                        <h5 class="card-title">Total Ingresos</h5>
                        <p class="card-text display-4" id="metricIngresos">$ 0</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h5 class="mb-0">Ingresos Recientes</h5>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Número</th>
                                <th>Cliente</th>
                                <th>Marca</th>
                                <th>Estado</th>
                                <th>Valor</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.slice(0, 10).map(ingreso => `
                                <tr>
                                    <td><strong>${ingreso.numero_ingreso}</strong></td>
                                    <td>${ingreso.cliente_nombre} ${ingreso.cliente_apellido}</td>
                                    <td>${ingreso.marca || 'N/A'}</td>
                                    <td>
                                        <span class="badge bg-${getStatusColor(ingreso.estado_ingreso)}">
                                            ${ingreso.estado_ingreso}
                                        </span>
                                    </td>
                                    <td>$ ${(ingreso.valor_total || 0).toLocaleString()}</td>
                                    <td>${new Date(ingreso.fecha_ingreso).toLocaleDateString()}</td>
                                    <td>
                                        <button class="btn btn-sm btn-info" 
                                                onclick="verDetalles(${ingreso.id})">
                                            Ver
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function calculateMonthlyBalance(ingresos) {
    const monthlyData = new Array(12).fill(0);
    
    ingresos.forEach(ingreso => {
        // Solo contar ingresos entregados y pagados
        if (ingreso.estado_ingreso === 'entregado' && ingreso.estado_pago === 'pagado' && ingreso.valor_total) {
            const fecha = new Date(ingreso.fecha_ingreso);
            const mes = fecha.getMonth();
            monthlyData[mes] += ingreso.valor_total;
        }
    });
    
    return monthlyData;
}

function crearGraficoBalance(values) {
    const ctx = document.getElementById('chartBalanceMensual');
    if (!ctx) {
        console.warn('chartBalanceMensual element not found');
        return;
    }
    
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js library not loaded');
        return;
    }
    
    try {
        // Destruir gráfico anterior si existe
        if (window.chartInstance) {
            window.chartInstance.destroy();
        }

        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        window.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'Balance Mensual ($)',
                    data: values,
                    backgroundColor: 'rgba(75, 192, 192, 0.7)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                    borderRadius: 5,
                    hoverBackgroundColor: 'rgba(75, 192, 192, 0.9)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                return 'Total: $' + value.toLocaleString('es-CO', { maximumFractionDigits: 0 });
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString('es-CO', { maximumFractionDigits: 0 });
                            }
                        }
                    }
                }
            }
        });
        ctx.style.maxHeight = '300px';
    } catch (error) {
        console.error('Error creating chart:', error);
    }
}

function actualizarMetricas(ingresos) {
    // Verificar que los elementos existan
    const metricTotal = document.getElementById('metricTotal');
    const metricReparados = document.getElementById('metricReparados');
    const metricEntregados = document.getElementById('metricEntregados');
    const metricIngresos = document.getElementById('metricIngresos');
    
    if (!metricTotal || !metricReparados || !metricEntregados || !metricIngresos) {
        console.warn('Metric elements not found');
        return;
    }
    
    const fechaDesde = document.getElementById('fechaDesde')?.value;
    const fechaHasta = document.getElementById('fechaHasta')?.value;
    const estadoFiltro = document.getElementById('estadoFiltro')?.value;

    let filtrados = ingresos;

    if (fechaDesde) {
        const desde = new Date(fechaDesde);
        filtrados = filtrados.filter(i => new Date(i.fecha_ingreso) >= desde);
    }

    if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        filtrados = filtrados.filter(i => new Date(i.fecha_ingreso) <= hasta);
    }

    if (estadoFiltro && estadoFiltro !== 'todos') {
        filtrados = filtrados.filter(i => i.estado_ingreso === estadoFiltro);
    }

    const reparados = filtrados.filter(i => i.estado_ingreso === 'entregado' && i.estado_pago === 'pagado').length;
    const entregados = filtrados.filter(i => i.estado_ingreso === 'entregado').length;
    const totalIngresos = filtrados
        .filter(i => i.estado_ingreso === 'entregado' && i.estado_pago === 'pagado')
        .reduce((sum, i) => sum + (i.valor_total || 0), 0);

    metricTotal.textContent = filtrados.length;
    metricReparados.textContent = reparados;
    metricEntregados.textContent = entregados;
    metricIngresos.textContent = '$ ' + totalIngresos.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

function filtrarDashboard() {
    const fechaDesde = document.getElementById('fechaDesde')?.value;
    const fechaHasta = document.getElementById('fechaHasta')?.value;
    const estadoFiltro = document.getElementById('estadoFiltro')?.value;

    // Recalcular balance mensual con filtros
    let filtrados = window.allIngresos;

    if (fechaDesde) {
        const desde = new Date(fechaDesde);
        filtrados = filtrados.filter(i => new Date(i.fecha_ingreso) >= desde);
    }

    if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        filtrados = filtrados.filter(i => new Date(i.fecha_ingreso) <= hasta);
    }

    if (estadoFiltro) {
        filtrados = filtrados.filter(i => i.estado_ingreso === estadoFiltro);
    }

    const monthlyData = calculateMonthlyBalance(filtrados);
    const values = monthlyData;
    
    crearGraficoBalance(values);
    actualizarMetricas(filtrados);
}

async function loadIngresoForm() {
    console.log('loadIngresoForm() iniciado');
    const marcas = await apiCall('/marcas');
    console.log('Marcas response:', marcas);
    const fallas = await apiCall('/fallas');
    console.log('Fallas response:', fallas);
    
    if (!marcas || !fallas) {
        console.error('Error: marcas or fallas is null/undefined', {marcas, fallas});
        return '<div class="alert alert-danger">Error al cargar datos. Marcas: ' + (marcas ? 'OK' : 'FALLO') + ', Fallas: ' + (fallas ? 'OK' : 'FALLO') + '</div>';
    }
    
    console.log('Datos cargados correctamente, generando HTML');
    
    return `
        <h2 class="mb-4">Nuevo Ingreso Técnico</h2>
        
        <div class="ingreso-wizard">
            <!-- PASO 1: DATOS DEL CLIENTE -->
            <div id="paso1" class="wizard-step active">
                <div class="wizard-header">
                    <span class="badge bg-primary">Paso 1</span>
                    <h4 class="mb-0">Información del Cliente</h4>
                </div>
                
                <div class="wizard-content">
                    <!-- Buscador -->
                    <div class="mb-4 search-section">
                        <label class="form-label fw-bold">Buscar Cliente Existente</label>
                        <input type="text" class="form-control form-control-lg" id="buscar_cliente" placeholder="Buscar por nombre, cédula o teléfono...">
                        <div id="resultadosBusqueda" class="list-group mt-2" style="display: none; max-height: 300px; overflow-y: auto;"></div>
                        <small class="text-muted d-block mt-2">O ingrese los datos manualmente</small>
                    </div>
                    
                    <!-- Formulario Cliente -->
                    <div class="row">
                        <div class="col-12 col-md-6">
                            <div class="mb-3">
                                <label class="form-label">Nombre del Cliente *</label>
                                <input type="text" class="form-control form-control-lg" id="cliente_nombre" required>
                            </div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="mb-3">
                                <label class="form-label">Apellido *</label>
                                <input type="text" class="form-control form-control-lg" id="cliente_apellido" required>
                            </div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="mb-3">
                                <label class="form-label">Cédula *</label>
                                <input type="text" class="form-control form-control-lg" id="cliente_cedula" required>
                            </div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="mb-3">
                                <label class="form-label">Teléfono</label>
                                <input type="tel" class="form-control form-control-lg" id="cliente_telefono">
                            </div>
                        </div>
                        <div class="col-12">
                            <div class="mb-4">
                                <label class="form-label">Dirección</label>
                                <input type="text" class="form-control form-control-lg" id="cliente_direccion">
                            </div>
                        </div>
                    </div>
                    
                    <button type="button" class="btn btn-primary btn-lg w-100" onclick="nextWizardStep()">
                        <i class="fas fa-arrow-right me-2"></i> Siguiente: Datos del Equipo
                    </button>
                </div>
            </div>
            
            <!-- PASO 2: DATOS DEL EQUIPO -->
            <div id="paso2" class="wizard-step" style="display: none;">
                <div class="wizard-header">
                    <span class="badge bg-primary">Paso 2</span>
                    <h4 class="mb-0">Datos del Equipo</h4>
                </div>
                
                <div class="wizard-content">
                    <div class="row">
                        <div class="col-12 col-md-6">
                            <div class="mb-3">
                                <label class="form-label">Marca *</label>
                                <select class="form-control form-control-lg" id="marca_id" required onchange="loadModelosByMarca()">
                                    <option value="">Seleccione una marca</option>
                                    ${Array.isArray(marcas) ? marcas.map(m => 
                                        `<option value="${m.id}">${m.nombre}</option>`
                                    ).join('') : ''}
                                </select>
                            </div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="mb-3">
                                <label class="form-label">Modelo *</label>
                                <select class="form-control form-control-lg" id="modelo_id" required>
                                    <option value="">Seleccione marca primero</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-12">
                            <label class="form-label">Color</label>
                            <div class="color-palette mb-4">
                                <button type="button" class="color-btn" style="background: #000000;" id="color_Negro" onclick="selectColor(this, 'Negro')" title="Negro"></button>
                                <button type="button" class="color-btn" style="background: #FFFFFF; border: 2px solid #ccc;" id="color_Blanco" onclick="selectColor(this, 'Blanco')" title="Blanco"></button>
                                <button type="button" class="color-btn" style="background: #C0C0C0;" id="color_Plateado" onclick="selectColor(this, 'Plateado')" title="Plateado"></button>
                                <button type="button" class="color-btn" style="background: #FFD700;" id="color_Dorado" onclick="selectColor(this, 'Dorado')" title="Dorado"></button>
                                <button type="button" class="color-btn" style="background: #FF0000;" id="color_Rojo" onclick="selectColor(this, 'Rojo')" title="Rojo"></button>
                                <button type="button" class="color-btn" style="background: #0000FF;" id="color_Azul" onclick="selectColor(this, 'Azul')" title="Azul"></button>
                                <button type="button" class="color-btn" style="background: #008000;" id="color_Verde" onclick="selectColor(this, 'Verde')" title="Verde"></button>
                                <button type="button" class="color-btn" style="background: #800080;" id="color_Púrpura" onclick="selectColor(this, 'Púrpura')" title="Púrpura"></button>
                                <button type="button" class="color-btn" style="background: #FFC0CB;" id="color_Rosa" onclick="selectColor(this, 'Rosa')" title="Rosa"></button>
                                <button type="button" class="color-btn" style="background: #FFA500;" id="color_Naranja" onclick="selectColor(this, 'Naranja')" title="Naranja"></button>
                                <button type="button" class="color-btn" style="background: #808080;" id="color_Gris" onclick="selectColor(this, 'Gris')" title="Gris"></button>
                            </div>
                            <input type="hidden" id="color">
                        </div>
                    </div>
                    
                    <div class="wizard-nav mt-4">
                        <button type="button" class="btn btn-secondary btn-lg me-2" onclick="prevWizardStep()">
                            <i class="fas fa-arrow-left me-2"></i> Anterior
                        </button>
                        <button type="button" class="btn btn-primary btn-lg flex-grow-1" onclick="nextWizardStep()">
                            <i class="fas fa-arrow-right me-2"></i> Siguiente: Estado del Equipo
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- PASO 3: ESTADO Y FALLAS -->
            <div id="paso3" class="wizard-step" style="display: none;">
                <div class="wizard-header">
                    <span class="badge bg-primary">Paso 3</span>
                    <h4 class="mb-0">Estado y Fallas del Equipo</h4>
                </div>
                
                <div class="wizard-content">
                    <h5 class="mb-3">Estado Físico</h5>
                    <div class="row mb-3">
                        <div class="col-12 col-md-6 form-check mb-2">
                            <input class="form-check-input" type="checkbox" id="estado_display">
                            <label class="form-check-label" for="estado_display">
                                Display Malo
                            </label>
                        </div>
                        <div class="col-12 col-md-6 form-check mb-2">
                            <input class="form-check-input" type="checkbox" id="estado_tactil">
                            <label class="form-check-label" for="estado_tactil">
                                Táctil Malo
                            </label>
                        </div>
                        <div class="col-12 col-md-6 form-check mb-2">
                            <input class="form-check-input" type="checkbox" id="estado_botones">
                            <label class="form-check-label" for="estado_botones">
                                Botones Dañados
                            </label>
                        </div>
                        <div class="col-12 col-md-6 form-check mb-2">
                            <input class="form-check-input" type="checkbox" id="estado_apagado">
                            <label class="form-check-label" for="estado_apagado">
                                Apagado / No Enciende
                            </label>
                        </div>
                        <div class="col-12 col-md-6 form-check mb-2">
                            <input class="form-check-input" type="checkbox" id="tiene_clave" onchange="toggleClave()">
                            <label class="form-check-label" for="tiene_clave">
                                Tiene Clave
                            </label>
                        </div>
                    </div>
                    
                    <div class="mb-4" id="claveDiv" style="display: none;">
                        <label class="form-label">Clave del Equipo</label>
                        <input type="password" class="form-control form-control-lg" id="clave" placeholder="Ingrese la clave">
                    </div>
                    
                    <h5 class="mb-3">Fallas Reportadas</h5>
                    <div class="row mb-3" id="fallasCheckbox">
                        ${Array.isArray(fallas) ? fallas.map(f => 
                            `<div class="col-12 col-md-6 form-check mb-2">
                                <input class="form-check-input falla-checkbox" type="checkbox" value="${f.id}" id="falla_${f.id}">
                                <label class="form-check-label" for="falla_${f.id}">
                                    ${f.nombre}
                                </label>
                            </div>`
                        ).join('') : ''}
                    </div>
                    
                    <div class="wizard-nav">
                        <button type="button" class="btn btn-secondary btn-lg me-2" onclick="prevWizardStep()">
                            <i class="fas fa-arrow-left me-2"></i> Anterior
                        </button>
                        <button type="button" class="btn btn-primary btn-lg flex-grow-1" onclick="nextWizardStep()">
                            <i class="fas fa-arrow-right me-2"></i> Siguiente: Resumen
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- PASO 4: RESUMEN -->
            <div id="paso4" class="wizard-step" style="display: none;">
                <div class="wizard-header">
                    <span class="badge bg-primary">Paso 4</span>
                    <h4 class="mb-0">Descripción y Resumen</h4>
                </div>
                
                <div class="wizard-content">
                    <div class="mb-4">
                        <label class="form-label">Falla General *</label>
                        <textarea class="form-control form-control-lg" id="falla_general" rows="3" placeholder="Descripción de la falla reportada" required></textarea>
                    </div>
                    
                    <div class="mb-4">
                        <label class="form-label">Valor de Reparación</label>
                        <div class="input-group input-group-lg">
                            <span class="input-group-text">$</span>
                            <input type="number" class="form-control" id="valor_reparacion" placeholder="0" min="0" step="1000">
                        </div>
                        <small class="text-muted">Dejar vacío para asignar después</small>
                    </div>
                    
                    <div class="mb-4">
                        <label class="form-label">Notas Adicionales</label>
                        <textarea class="form-control form-control-lg" id="notas_adicionales" rows="2" placeholder="Notas internas o adicionales"></textarea>
                    </div>
                    
                    <form id="ingresoForm" onsubmit="submitIngreso(event); return false;">
                        <div class="wizard-nav">
                            <button type="button" class="btn btn-secondary btn-lg me-2" onclick="prevWizardStep()">
                                <i class="fas fa-arrow-left me-2"></i> Anterior
                            </button>
                            <button type="submit" class="btn btn-success btn-lg flex-grow-1">
                                <i class="fas fa-check me-2"></i> Crear Ingreso
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}

async function buscarClientes() {
    const buscarInput = document.getElementById('buscar_cliente');
    const resultados = document.getElementById('resultadosBusqueda');
    
    // Verificar que los elementos existan
    if (!buscarInput || !resultados) {
        console.log('Elementos de búsqueda no encontrados');
        return;
    }
    
    const query = buscarInput.value.trim();
    
    if (query.length < 2) {
        resultados.style.display = 'none';
        return;
    }
    
    try {
        console.log('Buscando clientes con query:', query);
        const response = await apiCall(`/clientes/buscar?q=${encodeURIComponent(query)}`);
        
        console.log('Respuesta de búsqueda:', response);
        
        if (!response.data || response.data.length === 0) {
            resultados.innerHTML = '<div class="list-group-item text-muted">No se encontraron clientes</div>';
            resultados.style.display = 'block';
            return;
        }
        
        // Filtrar duplicados por cédula
        const clientesUnicos = new Map();
        response.data.forEach(cliente => {
            const key = cliente.cedula;
            if (!clientesUnicos.has(key)) {
                clientesUnicos.set(key, cliente);
            }
        });
        
        const clientesFiltrados = Array.from(clientesUnicos.values());
        
        resultados.innerHTML = clientesFiltrados.map(cliente => `
            <button type="button" class="list-group-item list-group-item-action" 
                    onclick="seleccionarCliente('${cliente.nombre}', '${cliente.apellido}', '${cliente.cedula}', '${cliente.telefono || ''}', '${cliente.direccion || ''}')">
                <div class="d-flex w-100 justify-content-between">
                    <strong>${cliente.nombre} ${cliente.apellido}</strong>
                </div>
                <small>Cédula: ${cliente.cedula} | Tel: ${cliente.telefono || 'N/A'}</small>
            </button>
        `).join('');
        resultados.style.display = 'block';
    } catch (error) {
        console.error('Error buscando clientes:', error);
        resultados.innerHTML = '<div class="list-group-item text-danger">Error en la búsqueda</div>';
        resultados.style.display = 'block';
    }
}

function seleccionarCliente(nombre, apellido, cedula, telefono, direccion) {
    document.getElementById('cliente_nombre').value = nombre;
    document.getElementById('cliente_apellido').value = apellido;
    document.getElementById('cliente_cedula').value = cedula;
    document.getElementById('cliente_telefono').value = telefono;
    document.getElementById('cliente_direccion').value = direccion;
    
    // Limpiar búsqueda
    document.getElementById('buscar_cliente').value = '';
    document.getElementById('resultadosBusqueda').style.display = 'none';
}

async function loadModelosByMarca() {
    const marcaId = document.getElementById('marca_id').value;
    console.log('DEBUG loadModelosByMarca: marcaId=', marcaId);
    
    if (!marcaId) {
        console.log('DEBUG: marcaId está vacío, retornando');
        return;
    }
    
    const modelos = await apiCall(`/marcas/${marcaId}/modelos`);
    console.log('DEBUG: modelos recibidos:', modelos);
    
    const select = document.getElementById('modelo_id');
    
    if (!Array.isArray(modelos) || modelos.length === 0) {
        console.log('DEBUG: No hay modelos o respuesta inválida');
        select.innerHTML = '<option value="">No hay modelos disponibles</option>';
        return;
    }
    
    const html = '<option value="">Seleccione un modelo</option>' +
        modelos.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
    
    console.log('DEBUG: Estableciendo HTML del select:', html);
    select.innerHTML = html;
}

async function submitIngreso(e) {
    e.preventDefault();
    if (isSubmittingIngreso) {
        return;
    }
    isSubmittingIngreso = true;
    
    const fallasSeleccionadas = Array.from(document.querySelectorAll('.falla-checkbox:checked'))
        .map(cb => parseInt(cb.value));
    
    // Obtener valores del formulario
    const marcaValue = document.getElementById('marca_id').value;
    const modeloValue = document.getElementById('modelo_id').value;
    
    const datos = {
        marca_id: parseInt(marcaValue),
        modelo_id: parseInt(modeloValue),
        cliente_nombre: document.getElementById('cliente_nombre').value.toUpperCase(),
        cliente_apellido: document.getElementById('cliente_apellido').value.toUpperCase(),
        cliente_cedula: document.getElementById('cliente_cedula').value.toUpperCase(),
        cliente_telefono: document.getElementById('cliente_telefono').value.toUpperCase(),
        cliente_direccion: document.getElementById('cliente_direccion').value.toUpperCase(),
        color: document.getElementById('color').value.toUpperCase(),
        falla_general: document.getElementById('falla_general').value.toUpperCase(),
        notas_adicionales: document.getElementById('notas_adicionales').value.toUpperCase(),
        estado_display: document.getElementById('estado_display').checked,
        estado_tactil: document.getElementById('estado_tactil').checked,
        estado_botones: document.getElementById('estado_botones').checked,
        estado_apagado: document.getElementById('estado_apagado').checked,
        tiene_clave: document.getElementById('tiene_clave').checked,
        clave: document.getElementById('clave').value,
        valor_reparacion: document.getElementById('valor_reparacion').value ? parseInt(document.getElementById('valor_reparacion').value) : null,
        fallas_iniciales: fallasSeleccionadas
    };
    
    // Validar campos requeridos
    if (!datos.marca_id || !datos.modelo_id || !datos.cliente_nombre || 
        !datos.cliente_apellido || !datos.cliente_cedula) {
        showAlert('Por favor complete todos los campos requeridos (Marca, Modelo, Nombre, Apellido, Cédula)', 'danger');
        isSubmittingIngreso = false;
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiCall('/ingresos', {
            method: 'POST',
            body: JSON.stringify(datos)
        });
        
        showLoading(false);
        
        if (!response) {
            showAlert('Error de conexión con el servidor', 'danger');
            return;
        }
        
        if (response.error) {
            showAlert('Error: ' + response.error, 'danger');
            return;
        }
        
        if (response.numero_ingreso || response.id) {
            const numeroIngreso = response.numero_ingreso || response.id;
            showAlert(`¡Ingreso creado exitosamente! Número: ${numeroIngreso}`, 'success');
            document.getElementById('ingresoForm').reset();

            if (response.id) {
                await printTicket(response.id);
            }
            
            // Esperar a que desaparezca la alerta y luego ir a registros
            setTimeout(() => {
                loadPage('registros');
            }, 1500);
        } else {
            showAlert('Error: Respuesta inesperada del servidor', 'danger');
        }
    } catch (error) {
        console.error('Error en submitIngreso:', error);
        showLoading(false);
        showAlert('Error al crear ingreso: ' + error.message, 'danger');
    } finally {
        isSubmittingIngreso = false;
    }
}

async function loadRegistros() {
    const user = getCurrentUserSafe();
    const page = 1;
    const response = await apiCall(`/ingresos?page=${page}&limit=20`);
    
    if (!response) {
        return '<div class="alert alert-danger">Error: No se pudo conectar con el servidor</div>';
    }
    
    if (response.error) {
        return `<div class="alert alert-danger">Error: ${response.error}</div>`;
    }
    
    if (!response.data || !Array.isArray(response.data)) {
        return '<div class="alert alert-danger">Error: No hay datos de ingresos. Respuesta: ' + JSON.stringify(response) + '</div>';
    }
    
    if (response.data.length === 0) {
        return `
            <h2 class="mb-4">Registros de Ingresos</h2>
            <div class="alert alert-info">
                No hay registros de ingresos aún. <a href="#" onclick="loadPage('ingreso')">Crear uno ahora</a>
            </div>
        `;
    }
    
    return `
        <h2 class="mb-4">Registros de Ingresos</h2>
        
        <div class="card mb-4">
            <div class="card-body">
                <div class="row mb-3">
                    <div class="col-md-6 mb-2">
                        <input type="text" class="form-control" id="searchInput" 
                               placeholder="Buscar por cliente, cédula, ingreso...">
                    </div>
                    <div class="col-md-3 mb-2">
                        <select class="form-control" id="estadoFilter">
                            <option value="">Todos los estados</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="en_reparacion">En Reparación</option>
                            <option value="reparado">Reparado</option>
                            <option value="entregado">Entregado</option>
                        </select>
                    </div>
                    <div class="col-md-3 mb-2">
                        <button class="btn btn-primary w-100" onclick="filtrarRegistros()">
                            <i class="fas fa-filter"></i> Filtrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead class="table-primary">
                        <tr>
                            <th>Ingreso</th>
                            <th>Cliente</th>
                            <th>Teléfono</th>
                            <th>Dirección</th>
                            <th>Fecha</th>
                            <th>Marca</th>
                            <th>Estado</th>
                            <th>Valor</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${response.data.map((ingreso, idx) => {
                            try {
                                return `
                            <tr>
                                <td><strong>${ingreso.numero_ingreso || 'N/A'}</strong></td>
                                <td>${ingreso.cliente_nombre || ''} ${ingreso.cliente_apellido || ''}</td>
                                <td>${ingreso.cliente_telefono || 'N/A'}</td>
                                <td>${ingreso.cliente_direccion || 'N/A'}</td>
                                <td>${ingreso.fecha_ingreso ? new Date(ingreso.fecha_ingreso).toLocaleDateString() : 'N/A'}</td>
                                <td>${ingreso.marca || 'N/A'}</td>
                                <td>
                                    <span class="badge bg-${getStatusColor(ingreso.estado_ingreso)}">
                                        ${ingreso.estado_ingreso || 'pendiente'}
                                    </span>
                                </td>
                                <td>$${ingreso.valor_total ? parseFloat(ingreso.valor_total).toLocaleString('es-CO') : '0'}</td>
                                <td>
                                    <button class="btn btn-sm btn-info" 
                                            onclick="verDetalles(${ingreso.id})">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    ${user && user.rol === 'admin' ? `
                                        <button class="btn btn-sm btn-danger" 
                                                onclick="deleteIngreso(${ingreso.id})">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    ` : ''}
                                </td>
                            </tr>
                        `;
                            } catch (e) {
                                console.error('Error renderizando ingreso ' + idx + ':', e, ingreso);
                                return `<tr><td colspan="7"><span class="text-danger">Error renderizando ingreso ${idx}: ${e.message}</span></td></tr>`;
                            }
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="card-footer">
                <small>Total: ${response.total} ingresos | Página ${response.page} de ${response.pages}</small>
            </div>
        </div>
        
        <script>
            function filtrarRegistros() {
                const search = document.getElementById('searchInput').value;
                const estado = document.getElementById('estadoFilter').value;
                // TODO: Implementar filtrado
            }
        </script>
    `;
}

async function loadTecnicoPanel() {
    const response = await apiCall('/ingresos');
    
    if (!response || !response.data) {
        return '<div class="alert alert-danger">Error al cargar panel técnico</div>';
    }
    
    const ingresos = response.data;
    
    return `
        <h2 class="mb-4">Panel Técnico - Gestión de Reparaciones</h2>
        <div class="alert alert-light border mb-3 py-2">
            <small><strong>Flujo:</strong> Pendiente → En Reparación → Reparado/No Reparable → Entregado</small>
        </div>
        
        <ul class="nav nav-tabs mb-4" role="tablist">
            <li class="nav-item">
                <a class="nav-link active" data-bs-toggle="tab" href="#pendientes">
                    <i class="fas fa-clock me-2"></i> Pendientes
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="tab" href="#en-reparacion">
                    <i class="fas fa-tools me-2"></i> En Reparación
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="tab" href="#reparados">
                    <i class="fas fa-check me-2"></i> Reparados
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="tab" href="#no-reparables">
                    <i class="fas fa-ban me-2"></i> No Reparables
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="tab" href="#entregados">
                    <i class="fas fa-box me-2"></i> Entregados
                </a>
            </li>
        </ul>
        
        <div class="tab-content">
            <div id="pendientes" class="tab-pane fade show active">
                ${renderIngresosPorEstado(ingresos, 'pendiente')}
            </div>
            <div id="en-reparacion" class="tab-pane fade">
                ${renderIngresosPorEstado(ingresos, 'en_reparacion')}
            </div>
            <div id="reparados" class="tab-pane fade">
                ${renderIngresosPorEstado(ingresos, 'reparado')}
            </div>
            <div id="no-reparables" class="tab-pane fade">
                ${renderIngresosPorEstado(ingresos, 'no_reparable')}
            </div>
            <div id="entregados" class="tab-pane fade">
                ${renderIngresosEntregadosEnLista(ingresos)}
            </div>
        </div>
    `;
}

function renderIngresosPorEstado(ingresos, estado) {
    const filtrados = ingresos.filter(i => i.estado_ingreso === estado);
    
    return `
        <div class="row">
            ${filtrados.length > 0 ? filtrados.map(ingreso => `
                <div class="col-12 mb-4">
                    <div class="card">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0">${ingreso.numero_ingreso}</h5>
                        </div>
                        <div class="card-body">
                            <p><strong>Cliente:</strong> ${ingreso.cliente_nombre} ${ingreso.cliente_apellido}</p>
                            <p><strong>Identificación:</strong> ${ingreso.cliente_cedula || 'N/A'}</p>
                            <p><strong>Teléfono:</strong> ${ingreso.cliente_telefono || 'N/A'}</p>
                            <p><strong>Clave de Ingreso:</strong> <span class="badge bg-secondary">${ingreso.numero_ingreso || 'S/N'}</span></p>
                            <p><strong>Equipo:</strong> ${ingreso.marca} ${ingreso.modelo}</p>
                            <p><strong>Color:</strong> ${ingreso.color || 'N/A'}</p>
                            <p><strong>Reparación:</strong> ${ingreso.falla_general || 'N/A'}</p>
                            <p><strong>Estado:</strong> <span class="badge bg-info">${ingreso.estado_ingreso}</span></p>
                            <p><strong>Fecha y Hora de Ingreso:</strong> ${(() => { const d = new Date(ingreso.fecha_ingreso); const hh = String(d.getHours()).padStart(2, '0'); const mm = String(d.getMinutes()).padStart(2, '0'); return d.toLocaleDateString('es-ES') + ' ' + hh + ':' + mm; })()}</p>
                            ${ingreso.notas ? `<p><strong>Notas:</strong> ${ingreso.notas}</p>` : ''}
                            <div class="mt-3">
                                <label class="form-label mb-2">Acciones disponibles:</label>
                                <div class="d-flex flex-wrap gap-2">
                                    ${getTecnicoEstadoActionButtons(ingreso.id, ingreso.estado_ingreso)}
                                </div>
                            </div>
                            <button class="btn btn-sm btn-info w-100 mt-2" onclick="verDetallesTecnico(${ingreso.id})">
                                Ver Detalles Completos
                            </button>
                        </div>
                    </div>
                </div>
            `).join('') : '<div class="col-12"><div class="alert alert-info">No hay ingresos en este estado</div></div>'}
        </div>
    `;
}

function getTecnicoEstadoActionButtons(ingresoId, estadoActual) {
    const transiciones = {
        pendiente: ['en_reparacion', 'no_reparable'],
        en_reparacion: ['reparado', 'no_reparable', 'pendiente'],
        reparado: ['entregado', 'en_reparacion'],
        no_reparable: ['entregado', 'en_reparacion']
    };

    const labels = {
        pendiente: 'Pendiente',
        en_reparacion: 'En Reparación',
        reparado: 'Reparado',
        no_reparable: 'No Reparable',
        entregado: 'Entregado'
    };

    const styles = {
        pendiente: 'btn-outline-secondary',
        en_reparacion: 'btn-outline-primary',
        reparado: 'btn-outline-success',
        no_reparable: 'btn-outline-dark',
        entregado: 'btn-success'
    };

    const opciones = transiciones[estadoActual] || [];
    if (opciones.length === 0) {
        return '<span class="text-muted small">Sin acciones disponibles</span>';
    }

    return opciones
        .map((estado) => `
            <button type="button" class="btn btn-sm ${styles[estado] || 'btn-outline-secondary'}" onclick="cambiarEstadoIngreso(${ingresoId}, '${estado}')">
                ${labels[estado] || estado}
            </button>
        `)
        .join('');
}

function renderIngresosEntregadosEnLista(ingresos) {
    const entregados = ingresos.filter(i => i.estado_ingreso === 'entregado');
    
    const html = `
        <div class="card">
            <div class="card-header">
                <h5 class="mb-3">Ingresos Entregados</h5>
                <input type="text" class="form-control" id="buscarEntregados" placeholder="Buscar por nombre, teléfono, cédula o número de ingreso...">
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-sm table-hover mb-0" id="tablaEntregados">
                        <thead class="table-light">
                            <tr>
                                <th width="70">ID</th>
                                <th>Nombre</th>
                                <th width="110">Cédula</th>
                                <th width="110">Teléfono</th>
                                <th>Celular Reparado</th>
                                <th>Reparación</th>
                                <th width="90">Fecha</th>
                                <th width="80">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="listEntregados">
                            ${entregados.length > 0 ? entregados.map(ing => `
                                <tr class="fila-entregado" data-filter="${(ing.cliente_nombre + ' ' + ing.cliente_apellido + ' ' + ing.cliente_cedula + ' ' + ing.cliente_telefono + ' ' + ing.numero_ingreso).toLowerCase()}">
                                    <td><strong>${ing.numero_ingreso || 'S/N'}</strong></td>
                                    <td>${ing.cliente_nombre} ${ing.cliente_apellido}</td>
                                    <td><small>${ing.cliente_cedula || 'N/A'}</small></td>
                                    <td><small>${ing.cliente_telefono || 'N/A'}</small></td>
                                    <td><small>${ing.marca} ${ing.modelo} - ${ing.color || 'N/A'}</small></td>
                                    <td><small>${ing.falla_general || 'N/A'}</small></td>
                                    <td><small>${new Date(ing.fecha_ingreso).toLocaleDateString('es-ES')}</small></td>
                                    <td>
                                        <button class="btn btn-sm btn-info" onclick="verDetallesTecnico(${ing.id})" title="Ver todos los detalles">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="8" class="text-center text-muted py-4">No hay ingresos entregados</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    // Usar setTimeout para ejecutar el script después de que el HTML sea renderizado
    setTimeout(() => {
        const buscarEntregadosInput = document.getElementById('buscarEntregados');
        if (buscarEntregadosInput) {
            buscarEntregadosInput.addEventListener('keyup', function() {
                const filtro = this.value.toLowerCase();
                const filas = document.querySelectorAll('.fila-entregado');
                let visibles = 0;
                filas.forEach(fila => {
                    const texto = fila.getAttribute('data-filter');
                    const mostrar = texto.includes(filtro);
                    fila.style.display = mostrar ? '' : 'none';
                    if (mostrar) visibles++;
                });
                // Si no hay resultados, mostrar mensaje
                if (visibles === 0 && filtro.length > 0) {
                    const tbody = document.getElementById('listEntregados');
                    if (!document.getElementById('sinResultados')) {
                        const tr = document.createElement('tr');
                        tr.id = 'sinResultados';
                        tr.innerHTML = '<td colspan="8" class="text-center text-muted py-4">No se encontraron resultados</td>';
                        tbody.innerHTML = '';
                        tbody.appendChild(tr);
                    }
                } else if (document.getElementById('sinResultados')) {
                    document.getElementById('sinResultados').remove();
                }
            });
        }
    }, 100);
    
    return html;
}

async function cambiarEstadoIngreso(ingresoId, nuevoEstado) {
    if (!nuevoEstado) return;
    
    // Si el estado es "entregado", mostrar modal de confirmación con valor
    if (nuevoEstado === 'entregado') {
        // Obtener detalles del ingreso para mostrar el valor actual
        const ingreso = await apiCall(`/ingresos/${ingresoId}`);
        if (!ingreso) {
            showAlert('Error al obtener detalles del ingreso', 'danger');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'modalEstadoEntrega';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Confirmar Entrega</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Ingreso:</strong> ${ingreso.numero_ingreso}</p>
                        <p><strong>Cliente:</strong> ${ingreso.cliente_nombre} ${ingreso.cliente_apellido}</p>
                        <p><strong>Valor actual de reparación:</strong> $ ${ingreso.valor_total?.toLocaleString() || '0'}</p>
                        
                        <div class="mb-3">
                            <label class="form-label">¿Este es el valor final de reparación?</label>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="confirmarValor" id="valorCorrecto" value="si" checked>
                                <label class="form-check-label" for="valorCorrecto">
                                    Sí, el valor es correcto
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="confirmarValor" id="valorIncorrecto" value="no">
                                <label class="form-check-label" for="valorIncorrecto">
                                    No, necesito ajustar el valor
                                </label>
                            </div>
                        </div>

                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" id="pagoRecibido" checked>
                            <label class="form-check-label" for="pagoRecibido">
                                Marcar como pagado al entregar
                            </label>
                        </div>
                        
                        <div id="ajusteValor" style="display: none;">
                            <label class="form-label">Nuevo valor de reparación:</label>
                            <input type="number" class="form-control" id="nuevoValor" min="0" step="1000" placeholder="Ingrese el valor final">
                            <label class="form-label mt-2">Motivo del ajuste:</label>
                            <textarea class="form-control" id="motivoAjuste" rows="2" placeholder="Describe por qué cambió el valor"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-success" onclick="procesarEntrega(${ingresoId})">
                            <i class="fas fa-check me-2"></i> Confirmar Entrega
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Configurar event listeners para el modal
        const radios = modal.querySelectorAll('input[name="confirmarValor"]');
        const ajusteDiv = modal.querySelector('#ajusteValor');
        const nuevoValorInput = modal.querySelector('#nuevoValor');
        
        radios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.value === 'no') {
                    ajusteDiv.style.display = 'block';
                    nuevoValorInput.focus();
                } else {
                    ajusteDiv.style.display = 'none';
                }
            });
        });
        
        const bs_modal = new bootstrap.Modal(modal);
        bs_modal.show();
        
        // Limpiar el modal después de cerrar
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
        
        return;
    }
    
    // Para otros estados, actualizar directamente
    const data = { estado_ingreso: nuevoEstado };
    const response = await apiCall(`/ingresos/${ingresoId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    
    if (response && response.success) {
        showAlert('Estado actualizado correctamente', 'success');
        loadPage('tecnico'); // Recargar el panel
    } else {
        showAlert('Error al actualizar el estado', 'danger');
    }
}

async function procesarEntrega(ingresoId) {
    try {
        // Verificar si se debe ajustar el valor
        const confirmarValor = document.querySelector('input[name="confirmarValor"]:checked')?.value;
        const pagoRecibido = document.getElementById('pagoRecibido')?.checked;
        let nuevoValor = null;
        let motivoAjuste = '';
        
        if (confirmarValor === 'no') {
            nuevoValor = parseFloat(document.getElementById('nuevoValor').value);
            if (isNaN(nuevoValor) || nuevoValor < 0) {
                showAlert('Por favor ingrese un valor válido', 'warning');
                return;
            }

            motivoAjuste = (document.getElementById('motivoAjuste')?.value || '').trim();
            if (!motivoAjuste) {
                showAlert('Debes ingresar el motivo del ajuste', 'warning');
                return;
            }
        }
        
        // Si hay un nuevo valor, actualizarlo primero
        if (nuevoValor !== null) {
            const dataValor = { valor_total: nuevoValor };
            const responseValor = await apiCall(`/ingresos/${ingresoId}`, {
                method: 'PUT',
                body: JSON.stringify(dataValor)
            });
            
            if (!responseValor || !responseValor.success) {
                showAlert('Error al actualizar el valor: ' + (responseValor?.error || 'desconocido'), 'danger');
                return;
            }

            await apiCall(`/ingresos/${ingresoId}/notas`, {
                method: 'POST',
                body: JSON.stringify({
                    contenido: `AJUSTE DE VALOR FINAL: ${motivoAjuste}. Nuevo valor: $${nuevoValor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`,
                    tipo: 'administrativa'
                })
            });
        }
        
        // Marcar como entregado
        const data = {
            estado_ingreso: 'entregado',
            estado_pago: pagoRecibido ? 'pagado' : 'pendiente'
        };
        const response = await apiCall(`/ingresos/${ingresoId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        
        if (response && response.success) {
            // Cerrar el modal dinámico
            const modal = document.getElementById('modalEstadoEntrega');
            if (modal) {
                const modalInstance = bootstrap.Modal.getInstance(modal);
                if (modalInstance) {
                    modalInstance.hide();
                }
                // Remover el modal del DOM
                setTimeout(() => {
                    modal.remove();
                    // Remover backdrop
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) backdrop.remove();
                    document.body.classList.remove('modal-open');
                }, 500);
            }
            
            showAlert('Ingreso marcado como entregado correctamente', 'success');
            loadPage('tecnico'); // Recargar el panel
        } else {
            showAlert('Error al marcar como entregado: ' + (response?.error || 'desconocido'), 'danger');
        }
    } catch (error) {
        console.error('Error en procesarEntrega:', error);
        showAlert('Error de conexión: ' + error.message, 'danger');
    }
}

async function loadAdminPanel() {
    return `
        <h2 class="mb-4">Panel de Administración</h2>
        
        <ul class="nav nav-tabs mb-4" role="tablist">
            <li class="nav-item">
                <a class="nav-link ${adminActiveTab === 'usuarios' ? 'active' : ''}" data-bs-toggle="tab" href="#usuarios">
                    <i class="fas fa-users me-2"></i> Usuarios
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link ${adminActiveTab === 'clientes' ? 'active' : ''}" data-bs-toggle="tab" href="#clientes">
                    <i class="fas fa-address-book me-2"></i> Base de Clientes
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link ${adminActiveTab === 'marcas' ? 'active' : ''}" data-bs-toggle="tab" href="#marcas">
                    <i class="fas fa-mobile-alt me-2"></i> Marcas y Modelos
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link ${adminActiveTab === 'fallas' ? 'active' : ''}" data-bs-toggle="tab" href="#fallas">
                    <i class="fas fa-tools me-2"></i> Fallas
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link ${adminActiveTab === 'config' ? 'active' : ''}" data-bs-toggle="tab" href="#config">
                    <i class="fas fa-cog me-2"></i> Configuración
                </a>
            </li>
        </ul>
        
        <div class="tab-content">
            <div id="usuarios" class="tab-pane fade ${adminActiveTab === 'usuarios' ? 'show active' : ''}">
                ${await loadAdminUsuarios()}
            </div>
            <div id="clientes" class="tab-pane fade ${adminActiveTab === 'clientes' ? 'show active' : ''}">
                ${await loadAdminClientes()}
            </div>
            <div id="marcas" class="tab-pane fade ${adminActiveTab === 'marcas' ? 'show active' : ''}">
                ${await loadAdminMarcas()}
            </div>
            <div id="fallas" class="tab-pane fade ${adminActiveTab === 'fallas' ? 'show active' : ''}">
                ${await loadAdminFallas()}
            </div>
            <div id="config" class="tab-pane fade ${adminActiveTab === 'config' ? 'show active' : ''}">
                ${await loadAdminConfig()}
            </div>
        </div>
    `;
}

async function loadAdminUsuarios() {
    const usuarios = await apiCall('/admin/usuarios');
    
    return `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Gestión de Usuarios</h5>
                <button class="btn btn-success btn-sm" onclick="toggleUserForm()">
                    <i class="fas fa-plus me-2"></i> Nuevo Usuario
                </button>
            </div>
            <div class="card-body">
                <!-- Formulario Inline (oculto por defecto) -->
                <div id="userFormContainer" class="border p-3 mb-3 bg-light" style="display: none;">
                    <h6 class="mb-3">Agregar Nuevo Usuario</h6>
                    <form id="newUserForm" onsubmit="submitNewUser(event); return false;">
                        <div class="row">
                            <div class="col-md-6 mb-2">
                                <label class="form-label">Usuario *</label>
                                <input type="text" class="form-control form-control-sm" id="newUserUsuario" required>
                            </div>
                            <div class="col-md-6 mb-2">
                                <label class="form-label">Nombre Completo *</label>
                                <input type="text" class="form-control form-control-sm" id="newUserNombre" required>
                            </div>
                            <div class="col-md-6 mb-2">
                                <label class="form-label">Contraseña *</label>
                                <input type="password" class="form-control form-control-sm" id="newUserPassword" required minlength="6">
                            </div>
                            <div class="col-md-6 mb-2">
                                <label class="form-label">Rol *</label>
                                <select class="form-select form-select-sm" id="newUserRol" required>
                                    <option value="">Seleccione...</option>
                                    <option value="admin">Administrador</option>
                                    <option value="empleado">Empleado</option>
                                    <option value="tecnico">Técnico</option>
                                </select>
                            </div>
                        </div>
                        <div class="mt-3">
                            <button type="submit" class="btn btn-primary btn-sm">
                                <i class="fas fa-save me-1"></i> Guardar
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm ms-2" onclick="toggleUserForm()">
                                <i class="fas fa-times me-1"></i> Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-hover mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Usuario</th>
                            <th>Nombre</th>
                            <th>Rol</th>
                            <th width="200">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.isArray(usuarios) ? usuarios.map(u => `
                            <tr>
                                <td>${u.usuario}</td>
                                <td>${u.nombre}</td>
                                <td><span class="badge bg-info">${u.rol}</span></td>
                                <td>
                                    <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id}, '${u.usuario}')">
                                        <i class="fas fa-trash"></i> Eliminar
                                    </button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" class="text-center">No hay usuarios</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function loadAdminClientes() {
    const ingresos = await apiCall('/ingresos');
    
    // Extraer clientes únicos
    const clientesMap = new Map();
    if (ingresos && ingresos.data) {
        ingresos.data.forEach(ingreso => {
            const key = ingreso.cliente_cedula;
            if (!clientesMap.has(key)) {
                clientesMap.set(key, {
                    nombre: ingreso.cliente_nombre,
                    apellido: ingreso.cliente_apellido,
                    cedula: ingreso.cliente_cedula,
                    telefono: ingreso.cliente_telefono || 'N/A',
                    direccion: ingreso.cliente_direccion || 'N/A',
                    ingresos: 1
                });
            } else {
                const cliente = clientesMap.get(key);
                cliente.ingresos++;
            }
        });
    }
    
    const clientes = Array.from(clientesMap.values());
    
    return `
        <div class="card">
            <div class="card-header">
                <h5 class="mb-0">Base de Datos de Clientes</h5>
            </div>
            <div class="card-body">
                <div class="row mb-3">
                    <div class="col-md-8">
                        <input type="text" class="form-control" id="buscarCliente" placeholder="Buscar por nombre, cédula o teléfono...">
                    </div>
                </div>
                
                <div class="table-responsive">
                    <table class="table table-sm table-hover" id="tablaclienta">
                        <thead class="table-light">
                            <tr>
                                <th>Nombre</th>
                                <th>Cédula</th>
                                <th>Teléfono</th>
                                <th>Dirección</th>
                                <th>Ingresos</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="clientesList">
                            ${clientes.length > 0 ? clientes.map(cliente => `
                                <tr class="cliente-row" data-filter="${(cliente.nombre + ' ' + cliente.apellido + ' ' + cliente.cedula + ' ' + cliente.telefono).toLowerCase()}">
                                    <td><strong>${cliente.nombre} ${cliente.apellido}</strong></td>
                                    <td>${cliente.cedula}</td>
                                    <td>${cliente.telefono}</td>
                                    <td>${cliente.direccion}</td>
                                    <td><span class="badge bg-info">${cliente.ingresos}</span></td>
                                    <td>
                                        <button class="btn btn-sm btn-warning" onclick="editarCliente('${cliente.cedula}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn btn-sm btn-info" onclick="verClienteIngresos('${cliente.cedula}')">
                                            <i class="fas fa-history"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="6" class="text-center">No hay clientes registrados</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <script>
            // Buscador de clientes
            const buscarInput = document.getElementById('buscarCliente');
            if (buscarInput) {
                buscarInput.addEventListener('keyup', function() {
                    const filtro = this.value.toLowerCase();
                    const filas = document.querySelectorAll('.cliente-row');
                    filas.forEach(fila => {
                        const texto = fila.getAttribute('data-filter');
                        fila.style.display = texto.includes(filtro) ? '' : 'none';
                    });
                });
            }
        </script>
    `;
}

async function loadAdminMarcas() {
    const marcas = await apiCall('/marcas');
    
    return `
        <div class="row">
            <div class="col-lg-6">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">Gestión de Marcas</h5>
                        <button class="btn btn-success btn-sm" onclick="toggleMarcaForm()">
                            <i class="fas fa-plus me-2"></i> Nueva Marca
                        </button>
                    </div>
                    <div class="card-body">
                        <!-- Formulario Inline (oculto por defecto) -->
                        <div id="marcaFormContainer" class="border p-3 mb-3 bg-light" style="display: none;">
                            <h6 class="mb-3">Agregar Nueva Marca</h6>
                            <form id="newMarcaForm" onsubmit="submitNewMarca(event); return false;">
                                <div class="row">
                                    <div class="col-md-12 mb-2">
                                        <label class="form-label">Nombre de la Marca *</label>
                                        <input type="text" class="form-control form-control-sm" id="newMarcaNombre" 
                                               placeholder="Ej: Samsung, Apple, Motorola" required>
                                        <small class="text-muted">Ingrese el nombre de la marca del fabricante</small>
                                    </div>
                                </div>
                                <div class="mt-3">
                                    <button type="submit" class="btn btn-primary btn-sm">
                                        <i class="fas fa-save me-1"></i> Guardar
                                    </button>
                                    <button type="button" class="btn btn-secondary btn-sm ms-2" onclick="toggleMarcaForm()">
                                        <i class="fas fa-times me-1"></i> Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th>Nombre</th>
                                    <th width="200">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.isArray(marcas) ? marcas.map(m => `
                                    <tr>
                                        <td>${m.nombre}</td>
                                        <td>
                                            <button class="btn btn-sm btn-info me-1" onclick="showModelosForMarca(${m.id}, '${m.nombre}')">
                                                <i class="fas fa-list"></i> Ver Modelos
                                            </button>
                                            <button class="btn btn-sm btn-danger" onclick="deleteMarca(${m.id}, '${m.nombre}')">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="2" class="text-center">No hay marcas</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-6">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">Gestión de Modelos</h5>
                        <button class="btn btn-success btn-sm" onclick="toggleModeloForm()">
                            <i class="fas fa-plus me-2"></i> Nuevo Modelo
                        </button>
                    </div>
                    <div class="card-body">
                        <div id="modeloFormContainer" class="border p-3 mb-3 bg-light" style="display: none;">
                            <h6 class="mb-3">Agregar Nuevo Modelo</h6>
                            <form id="newModeloForm" onsubmit="submitNewModelo(event); return false;">
                                <div class="row">
                                    <div class="col-md-12 mb-2">
                                        <label class="form-label">Marca *</label>
                                        <select class="form-select form-select-sm" id="newModeloMarca" required>
                                            <option value="">Seleccione una marca</option>
                                            ${Array.isArray(marcas) ? marcas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('') : ''}
                                        </select>
                                    </div>
                                    <div class="col-md-12 mb-2">
                                        <label class="form-label">Nombre del Modelo *</label>
                                        <input type="text" class="form-control form-control-sm" id="newModeloNombre" 
                                               placeholder="Ej: Galaxy S21, iPhone 13" required>
                                    </div>
                                </div>
                                <div class="mt-3">
                                    <button type="submit" class="btn btn-primary btn-sm">
                                        <i class="fas fa-save me-1"></i> Guardar
                                    </button>
                                    <button type="button" class="btn btn-secondary btn-sm ms-2" onclick="toggleModeloForm()">
                                        <i class="fas fa-times me-1"></i> Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                        <div id="modelosListContainer">
                            <p class="text-muted text-center">Selecciona una marca para ver sus modelos</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadAdminFallas() {
    const fallas = await apiCall('/fallas');
    
    return `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Catálogo de Fallas</h5>
                <button class="btn btn-success btn-sm" onclick="toggleFallaForm()">
                    <i class="fas fa-plus me-2"></i> Nueva Falla
                </button>
            </div>
            <div class="card-body">
                <!-- Formulario Inline (oculto por defecto) -->
                <div id="fallaFormContainer" class="border p-3 mb-3 bg-light" style="display: none;">
                    <h6 class="mb-3">Agregar Nueva Falla</h6>
                    <form id="newFallaForm" onsubmit="submitNewFalla(event); return false;">
                        <div class="row">
                            <div class="col-md-6 mb-2">
                                <label class="form-label">Nombre de la Falla *</label>
                                <input type="text" class="form-control form-control-sm" id="newFallaNombre" 
                                       placeholder="Ej: Pantalla rota, Batería" required>
                            </div>
                            <div class="col-md-6 mb-2">
                                <label class="form-label">Precio Sugerido *</label>
                                <input type="number" class="form-control form-control-sm" id="newFallaPrecio" 
                                       placeholder="0" min="0" step="100" required>
                            </div>
                            <div class="col-md-12 mb-2">
                                <label class="form-label">Descripción</label>
                                <textarea class="form-control form-control-sm" id="newFallaDescripcion" 
                                          rows="2" placeholder="Descripción opcional"></textarea>
                            </div>
                        </div>
                        <div class="mt-3">
                            <button type="submit" class="btn btn-primary btn-sm">
                                <i class="fas fa-save me-1"></i> Guardar
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm ms-2" onclick="toggleFallaForm()">
                                <i class="fas fa-times me-1"></i> Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-hover mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th>Precio</th>
                            <th width="150">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.isArray(fallas) ? fallas.map(f => `
                            <tr>
                                <td>${f.nombre}</td>
                                <td>${f.descripcion || 'N/A'}</td>
                                <td>$${f.precio_sugerido || 0}</td>
                                <td>
                                    <button class="btn btn-sm btn-danger" onclick="deleteFalla(${f.id}, '${f.nombre}')">
                                        <i class="fas fa-trash"></i> Eliminar
                                    </button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" class="text-center">No hay fallas</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function loadAdminConfig() {
    const config = await apiCall('/admin/configuracion');
    
    return `
        <div class="card p-4">
            <h5 class="mb-3">Configuración del Negocio</h5>
            
            <form id="configForm">
                <div class="mb-3">
                    <label class="form-label">Nombre del Negocio</label>
                    <input type="text" class="form-control" id="nombre_negocio" 
                           value="${config.nombre_negocio?.valor || 'CELUPRO'}">
                </div>
                
                <div class="mb-3">
                    <label class="form-label">Teléfono</label>
                    <input type="tel" class="form-control" id="telefono_negocio"
                           value="${config.telefono_negocio?.valor || ''}">
                </div>

                <div class="mb-3">
                    <label class="form-label">Dirección</label>
                    <input type="text" class="form-control" id="direccion_negocio"
                           value="${config.direccion_negocio?.valor || ''}">
                </div>
                
                <div class="mb-3">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" id="email_negocio"
                           value="${config.email_negocio?.valor || ''}">
                </div>
                
                <div class="mb-3">
                    <label class="form-label">Logo del Negocio (PNG o JPG, máx 5MB)</label>
                    <input type="file" class="form-control" id="logo_file" accept="image/png,image/jpeg,image/jpg">
                    ${config.logo_url?.valor ? `<div class="mt-2"><small class="text-muted">Logo actual:</small><br><img src="${config.logo_url.valor}" alt="Logo actual" style="max-height: 80px; max-width: 220px; border: 1px solid #ddd; padding: 4px; border-radius: 4px; margin-top: 5px;"></div>` : '<small class="text-muted d-block mt-1">No hay logo cargado aún</small>'}
                </div>
                
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save me-2"></i> Guardar Configuración
                </button>
            </form>
        </div>
    `;
}

async function submitConfig(e) {
    e.preventDefault();
    
    const logoFileInput = document.getElementById('logo_file');
    const hasLogoFile = logoFileInput && logoFileInput.files && logoFileInput.files.length > 0;
    
    // Si hay archivo de logo, subirlo primero
    if (hasLogoFile) {
        const file = logoFileInput.files[0];
        console.log('=== DEBUG LOGO UPLOAD ===');
        console.log('File:', file);
        console.log('File name:', file.name);
        console.log('File size:', file.size);
        console.log('File type:', file.type);
        console.log('Token:', token ? 'Token presente' : 'Token AUSENTE');
        console.log('API_BASE:', API_BASE);
        
        // Validar tipo de archivo
        if (!file.name.match(/\.(jpg|jpeg|png)$/i)) {
            showAlert('Por favor selecciona un archivo PNG o JPG', 'warning');
            return;
        }
        
        // Validar tamaño (máximo 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showAlert('El archivo es muy grande. Máximo 5MB', 'warning');
            return;
        }
        
        showAlert('Subiendo logo...', 'info');
        
        const formData = new FormData();
        formData.append('logo', file);
        console.log('FormData creado, archivo añadido con clave "logo"');
        
        try {
            const url = `${API_BASE}/admin/config/logo`;
            console.log('URL completa:', url);
            console.log('Enviando petición...');
            
            const logoResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            console.log('Respuesta recibida. Status:', logoResponse.status);
            console.log('Response OK:', logoResponse.ok);
            
            if (!logoResponse.ok) {
                const errorData = await logoResponse.json();
                console.log('Error data:', errorData);
                showAlert(`Error al subir logo: ${errorData.error}`, 'danger');
                return;
            }
            
            const successData = await logoResponse.json();
            console.log('Success data:', successData);
            showAlert('Logo subido exitosamente', 'success');
        } catch (error) {
            console.error('Excepción al subir logo:', error);
            showAlert(`Error de red al subir logo: ${error.message}`, 'danger');
            return;
        }
    }
    
    // Guardar configuración del negocio
    try {
        const response = await apiCall('/admin/configuracion', {
            method: 'PUT',
            body: JSON.stringify({
                nombre_negocio: document.getElementById('nombre_negocio').value,
                telefono_negocio: document.getElementById('telefono_negocio').value,
                direccion_negocio: document.getElementById('direccion_negocio').value,
                email_negocio: document.getElementById('email_negocio').value
            })
        });
        
        if (response.success) {
            showAlert('Configuración guardada exitosamente', 'success');
            // Recargar el panel de administración para mostrar los valores actualizados
            setTimeout(() => {
                loadPage('admin');
            }, 800);
        } else {
            showAlert(response.error || 'Error al guardar configuración', 'danger');
        }
    } catch (error) {
        showAlert(`Error al guardar: ${error.message}`, 'danger');
    }
}

async function verDetalles(ingresoId) {
    const response = await apiCall(`/ingresos/${ingresoId}`);
    
    if (!response) {
        showAlert('Error al cargar detalles', 'danger');
        return;
    }
    
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <h2 class="mb-4">Detalles del Ingreso: ${response.numero_ingreso}</h2>
        
        <div class="row">
            <div class="col-md-6">
                <div class="card mb-3">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Datos del Cliente</h5>
                    </div>
                    <div class="card-body">
                        <p><strong>Nombre:</strong> ${response.cliente_nombre} ${response.cliente_apellido}</p>
                        <p><strong>Cédula:</strong> ${response.cliente_cedula}</p>
                        <p><strong>Teléfono:</strong> ${response.cliente_telefono || 'N/A'}</p>
                        <p><strong>Dirección:</strong> ${response.cliente_direccion || 'N/A'}</p>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="card mb-3">
                    <div class="card-header bg-info text-white">
                        <h5 class="mb-0">Datos del Equipo</h5>
                    </div>
                    <div class="card-body">
                        <p><strong>Marca:</strong> ${response.marca}</p>
                        <p><strong>Modelo:</strong> ${response.modelo}</p>
                        <p><strong>Color:</strong> ${response.color || 'N/A'}</p>
                        <p><strong>Estado:</strong> <span class="badge bg-${getStatusColor(response.estado_ingreso)}">${response.estado_ingreso}</span></p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card mb-3">
            <div class="card-header bg-warning">
                <h5 class="mb-0">Fallas Diagnosticadas</h5>
            </div>
            <div class="card-body">
                ${response.fallas && response.fallas.length > 0 ? `
                    <table class="table table-sm mb-0">
                        <thead>
                            <tr>
                                <th>Falla</th>
                                <th>Valor</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.fallas.map(f => `
                                <tr>
                                    <td>${f.nombre}</td>
                                    <td>$${f.valor_reparacion || 0}</td>
                                    <td><span class="badge bg-info">${f.estado_falla}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p class="text-muted">Sin fallas registradas</p>'}
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-12">
                <button class="btn btn-primary" onclick="loadPage('registros')">
                    <i class="fas fa-arrow-left me-2"></i> Volver
                </button>
                <button class="btn btn-success" onclick="printTicket(${ingresoId})">
                    <i class="fas fa-print me-2"></i> Imprimir Ticket
                </button>
            </div>
        </div>
    `;
}

async function verDetallesTecnico(ingresoId) {
    const response = await apiCall(`/ingresos/${ingresoId}`);
    
    if (!response) {
        showAlert('Error al cargar detalles', 'danger');
        return;
    }
    
    const mainContent = document.getElementById('mainContent');
    
    // Obtener la información de reparación si está entregado
    let reparacionInfo = '';
    if (response.estado_ingreso === 'entregado') {
        // Determinar si fue reparado o no basándose en las fallas
        let estadoReparacion = 'Reparado'; // por defecto
        
        // Si hay fallas y alguna está en no_reparable, significa que no fue completamente reparado
        if (response.fallas && response.fallas.length > 0) {
            const tieneFallaNoReparable = response.fallas.some(f => f.estado_falla === 'no_reparable');
            if (tieneFallaNoReparable) {
                estadoReparacion = 'No tuvo reparación';
            }
        }
        
        // Obtener fecha de entrega (si existe) o usar fecha de ingreso
        const fechaEntrega = response.fecha_entrega 
            ? new Date(response.fecha_entrega).toLocaleString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : new Date(response.fecha_ingreso).toLocaleString('es-ES');
        
        reparacionInfo = `
            <div class="alert alert-success mb-4" style="border-left: 5px solid #28a745;">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h5 class="mb-2"><i class="fas fa-check-circle me-2" style="color: #28a745;"></i>Ingreso Entregado</h5>
                        <p class="mb-1"><strong>Resultado de Reparación:</strong> <span style="font-size: 1.1em; color: #28a745;">${estadoReparacion}</span></p>
                        <p class="mb-0"><strong>Fecha y Hora de Entrega:</strong> ${fechaEntrega}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    mainContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 class="mb-0">Detalles del Ingreso: <strong>${response.numero_ingreso}</strong></h2>
            <button class="btn btn-secondary" onclick="loadPage('tecnico')">
                <i class="fas fa-arrow-left me-2"></i>Volver
            </button>
        </div>
        
        ${reparacionInfo}
        
        <div class="card mb-4">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">Información General</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Cliente:</strong> ${response.cliente_nombre} ${response.cliente_apellido}</p>
                        <p><strong>Cédula:</strong> ${response.cliente_cedula || 'N/A'}</p>
                        <p><strong>Teléfono:</strong> ${response.cliente_telefono || 'N/A'}</p>
                        <p><strong>Dirección:</strong> ${response.cliente_direccion || 'N/A'}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Equipo:</strong> ${response.marca} ${response.modelo}</p>
                        <p><strong>Color:</strong> ${response.color || 'N/A'}</p>
                        <p><strong>Falla General:</strong> ${response.falla_general || 'N/A'}</p>
                        <p><strong>Estado:</strong> <span class="badge bg-warning" style="font-size: 0.9em;">${response.estado_ingreso}</span></p>
                    </div>
                </div>
                <hr>
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Fecha de Ingreso:</strong> ${new Date(response.fecha_ingreso).toLocaleString('es-ES')}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Valor Total:</strong> <span style="font-size: 1.2em; color: #28a745;"><strong>$${response.valor_total || 0}</strong></span></p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-8">
                <div class="card mb-4">
                    <div class="card-header bg-success text-white">
                        <h5 class="mb-0">Fallas y Reparaciones</h5>
                    </div>
                    <div class="card-body">
                        ${response.fallas && response.fallas.length > 0 ? `
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Falla</th>
                                            <th>Valor</th>
                                            <th>Estado</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${response.fallas.map(f => `
                                            <tr>
                                                <td>${f.nombre}</td>
                                                <td>
                                                    <input type="number" class="form-control form-control-sm" 
                                                           value="${f.valor_reparacion}" 
                                                           onchange="updateValor(${f.id}, this.value)">
                                                </td>
                                                <td>
                                                    <select class="form-select form-select-sm" 
                                                            onchange="updateEstado(${f.id}, this.value)">
                                                        <option value="pendiente" ${f.estado_falla === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                                                        <option value="reparada" ${f.estado_falla === 'reparada' ? 'selected' : ''}>Reparada</option>
                                                        <option value="no_reparable" ${f.estado_falla === 'no_reparable' ? 'selected' : ''}>No Reparable</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <button class="btn btn-sm btn-danger" 
                                                            onclick="removeFalla(${f.id})">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : '<p class="text-muted">Sin fallas registradas</p>'}
                        
                        <button class="btn btn-sm btn-primary" onclick="addNewFalla(${ingresoId})">
                            <i class="fas fa-plus me-2"></i> Agregar Falla
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card">
                    <div class="card-header bg-info text-white">
                        <h5 class="mb-0">Acciones</h5>
                    </div>
                    <div class="card-body">
                        <div class="d-grid gap-2">
                            ${response.estado_ingreso !== 'entregado' ? `
                                <select class="form-select mb-2" id="estadoSelect" value="${response.estado_ingreso}">
                                    <option value="pendiente" ${response.estado_ingreso === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                                    <option value="en_reparacion" ${response.estado_ingreso === 'en_reparacion' ? 'selected' : ''}>En Reparación</option>
                                    <option value="reparado" ${response.estado_ingreso === 'reparado' ? 'selected' : ''}>Reparado</option>
                                    <option value="no_reparable" ${response.estado_ingreso === 'no_reparable' ? 'selected' : ''}>No Reparable</option>
                                    <option value="entregado" ${response.estado_ingreso === 'entregado' ? 'selected' : ''}>Entregado</option>
                                </select>
                                <button class="btn btn-warning" onclick="updateIngresoEstado(${ingresoId})">
                                    <i class="fas fa-edit me-2"></i>Actualizar Estado
                                </button>
                            ` : `
                                <div class="alert alert-success mb-2">
                                    <i class="fas fa-check me-2"></i>
                                    <strong>Ingreso Entregado</strong>
                                </div>
                            `}
                            <button class="btn btn-success" onclick="printTicket(${ingresoId})">
                                <i class="fas fa-print me-2"></i> Imprimir Ticket
                            </button>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getStatusColor(estado) {
    const colors = {
        'pendiente': 'warning',
        'en_reparacion': 'info',
        'reparado': 'success',
        'entregado': 'primary',
        'cancelado': 'danger'
    };
    return colors[estado] || 'secondary';
}

function showConfirmModal(message, options = {}) {
    const {
        title = 'Confirmar acción',
        confirmText = 'Eliminar',
        cancelText = 'Cancelar',
        confirmClass = 'btn-danger'
    } = options;

    return new Promise((resolve) => {
        const modalId = `confirmModal_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = modalId;
        modal.tabIndex = -1;
        modal.setAttribute('aria-hidden', 'true');

        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-0">${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${cancelText}</button>
                        <button type="button" class="btn ${confirmClass}" id="${modalId}_confirm">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        let confirmed = false;

        modal.querySelector(`#${modalId}_confirm`).addEventListener('click', () => {
            confirmed = true;
            bsModal.hide();
        });

        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
            resolve(confirmed);
        }, { once: true });

        bsModal.show();
    });
}

async function printTicket(ingresoId) {
    if (printingIngresos.has(ingresoId)) {
        return;
    }
    printingIngresos.add(ingresoId);

    try {
        showAlert('Generando ticket de impresión...', 'info');
        
        const response = await apiCall(`/ingresos/${ingresoId}/ticket`);
        
        if (response.error) {
            showAlert('Error: ' + response.error, 'danger');
            return;
        }
        
        if (!response.ticket_data) {
            showAlert('No se pudo generar el ticket', 'danger');
            return;
        }
        
        simulatePrint(response);
        
    } catch (error) {
        console.error('Error en printTicket:', error);
        showAlert('Error al generar ticket: ' + error.message, 'danger');
    } finally {
        printingIngresos.delete(ingresoId);
    }
}

// Función auxiliar para imprimir ticket en iframe oculto (sin popup)
function simulatePrint(ticketData) {
    const ingreso = ticketData.ingreso || {};
    const negocio = ticketData.negocio || {};
    const nombreNegocio = negocio.nombre_negocio || 'CELUPRO';
    const telefonoNegocio = negocio.telefono_negocio || '';
    const direccionNegocio = negocio.direccion_negocio || negocio.email_negocio || '';
    // Convertir URL relativa del logo a absoluta para que funcione en iframe
    const logoUrl = negocio.logo_url ? `${window.location.origin}${negocio.logo_url}` : '';
    const valorTotal = Number(ingreso.valor_total || 0);
    const fallas = Array.isArray(ingreso.fallas) ? ingreso.fallas : [];
    const fallasTexto = fallas.length
        ? fallas.map(f => `• ${f.nombre || 'Falla'}${f.valor_reparacion ? ` ($ ${Number(f.valor_reparacion).toLocaleString('es-CO')})` : ''}`).join('<br>')
        : (ingreso.falla_general || 'Sin detalle');

    const html = `
        <html>
        <head>
            <title>Ticket de Impresión - ${ticketData.numero_ingreso}</title>
            <style>
                body {
                    font-family: monospace;
                    margin: 0;
                    padding: 10px;
                    width: 58mm;
                    max-width: 250px;
                    font-size: 12px;
                }
                .ticket {
                    border: 1px dashed #ccc;
                    padding: 10px;
                    text-align: left;
                }
                .header {
                    text-align: center;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .logo {
                    text-align: center;
                    margin-bottom: 6px;
                }
                .logo img {
                    max-width: 160px;
                    max-height: 70px;
                }
                .numero {
                    font-size: 18px;
                    font-weight: bold;
                    margin: 10px 0;
                    text-align: center;
                }
                .line {
                    border-top: 1px dashed #000;
                    margin: 8px 0;
                }
                .section-title {
                    font-weight: bold;
                    margin-top: 6px;
                    margin-bottom: 4px;
                }
                .center {
                    text-align: center;
                }
                .small {
                    font-size: 10px;
                }
            </style>
        </head>
        <body>
            <div class="ticket">
                ${logoUrl ? `<div class="logo"><img id="ticket-logo" src="${logoUrl}" alt="Logo"></div>` : ''}
                <div class="header">${nombreNegocio}</div>
                ${telefonoNegocio ? `<div class="center small">Tel: ${telefonoNegocio}</div>` : ''}
                ${direccionNegocio ? `<div class="center small">${direccionNegocio}</div>` : ''}
                <div class="numero">Ingreso #${ticketData.numero_ingreso}</div>

                <div class="section-title">CLIENTE</div>
                <div><strong>${ingreso.cliente_nombre || ''} ${ingreso.cliente_apellido || ''}</strong></div>
                <div>Tel: ${ingreso.cliente_telefono || 'N/A'}</div>
                <div>Dir: ${ingreso.cliente_direccion || 'N/A'}</div>

                <div class="section-title">EQUIPO</div>
                <div>${ingreso.marca || ''} ${ingreso.modelo || ''}</div>
                <div>Color: ${ingreso.color || 'N/A'}</div>
                <div>Valor reparación: $ ${valorTotal.toLocaleString('es-CO')}</div>

                <div class="line"></div>
                <div class="center small"><strong>Después de 60 días no se responde</strong></div>
                <div class="center small"><strong>por equipos abandonados.</strong></div>
                <div class="line"></div>

                <div class="section-title">COPIA TÉCNICO</div>
                <div>${ingreso.cliente_nombre || ''} ${ingreso.cliente_apellido || ''}</div>
                <div>Tel: ${ingreso.cliente_telefono || 'N/A'}</div>
                <div>Equipo: ${ingreso.marca || ''} ${ingreso.modelo || ''}</div>
                <div>Valor: $ ${valorTotal.toLocaleString('es-CO')}</div>
                <div class="section-title">Detalles:</div>
                <div class="small">${fallasTexto}</div>

                <div class="line"></div>
                <div class="small">Impresión: ${new Date().toLocaleString('es-CO')}</div>
                <div class="small">Firma técnico: __________________</div>
            </div>
        </body>
        </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const cleanup = () => {
        setTimeout(() => {
            if (iframe && iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        }, 1000);
    };

    const doPrint = () => {
        const printWindow = iframe.contentWindow;
        if (!printWindow) {
            cleanup();
            showAlert('No se pudo abrir el diálogo de impresión', 'danger');
            return;
        }

        try {
            printWindow.focus();
            printWindow.print();
        } finally {
            cleanup();
        }
    };

    iframe.onload = () => {
        const doc = iframe.contentDocument;
        if (!doc) {
            doPrint();
            return;
        }

        const logo = doc.getElementById('ticket-logo');
        let printed = false;
        const printOnce = () => {
            if (printed) return;
            printed = true;
            setTimeout(doPrint, 100);
        };

        if (logo) {
            if (logo.complete) {
                printOnce();
            } else {
                logo.addEventListener('load', printOnce, { once: true });
                logo.addEventListener('error', printOnce, { once: true });
                setTimeout(printOnce, 2500);
            }
        } else {
            printOnce();
        }
    };

    iframe.srcdoc = html;
}

// Función para eliminar ingreso (solo admin)
async function deleteIngreso(ingresoId) {
    if (!await showConfirmModal('¿Estás seguro de que deseas eliminar este ingreso? Esta acción no se puede deshacer.')) {
        return;
    }
    
    const response = await apiCall(`/ingresos/${ingresoId}`, {
        method: 'DELETE'
    });
    
    if (response.success) {
        showAlert('Ingreso eliminado correctamente', 'success');
        loadPage('registros');
    } else {
        showAlert(response.error || 'Error al eliminar ingreso', 'danger');
    }
}

// Función para agregar nueva marca
async function showNewMarcaModal() {
    const nombre = prompt('Ingresa el nombre de la marca (ej: Samsung, Apple, Motorola):');
    
    if (!nombre || nombre.trim() === '') {
        return;
    }
    
    try {
        const response = await apiCall('/marcas', {
            method: 'POST',
            body: JSON.stringify({ nombre: nombre.trim() })
        });
        
        console.log('Respuesta de marca:', response);
        
        if (response && response.id) {
            showAlert(`Marca "${nombre}" agregada correctamente`, 'success');
            loadPage('admin');
        } else if (response && response.error) {
            showAlert(response.error, 'danger');
        } else {
            showAlert('Error desconocido al agregar marca', 'danger');
        }
    } catch (error) {
        console.error('Error en showNewMarcaModal:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

// Función para editar marca (ver/agregar modelos)
async function editMarca(marcaId) {
    try {
        const marcas = await apiCall('/marcas');
        const marca = marcas.find(m => m.id === marcaId);
        
        if (!marca) {
            showAlert('Marca no encontrada', 'danger');
            return;
        }
        
        const modelos = await apiCall(`/marcas/${marcaId}/modelos`);
        
        let modelosHtml = '';
        if (Array.isArray(modelos)) {
            modelosHtml = modelos.map(m => `
                <div class="d-flex justify-content-between align-items-center p-2 border-bottom">
                    <span>${m.nombre}</span>
                    <button class="btn btn-sm btn-danger" onclick="deleteModelo(${m.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }
        
        const nuevoModelo = prompt(`Ingresa el nombre del nuevo modelo para ${marca.nombre}:\n(ej: A20, A30, A21S):`);
        
        if (nuevoModelo && nuevoModelo.trim() !== '') {
            const response = await apiCall('/modelos', {
                method: 'POST',
                body: JSON.stringify({
                    marca_id: marcaId,
                    nombre: nuevoModelo.trim()
                })
            });
            
            console.log('Respuesta de modelo:', response);
            
            if (response && response.id) {
                showAlert(`Modelo "${nuevoModelo}" agregado a ${marca.nombre}`, 'success');
                loadPage('admin');
            } else if (response && response.error) {
                showAlert(response.error, 'danger');
            } else {
                showAlert('Error desconocido al agregar modelo', 'danger');
            }
        }
    } catch (error) {
        console.error('Error en editMarca:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

// Función para editar nombre de marca
async function editMarcaName(marcaId) {
    const marcas = await apiCall('/marcas');
    const marca = marcas.find(m => m.id === marcaId);
    
    if (!marca) {
        showAlert('Marca no encontrada', 'danger');
        return;
    }
    
    const nuevoNombre = prompt(`Nuevo nombre para la marca "${marca.nombre}":`, marca.nombre);
    
    if (nuevoNombre && nuevoNombre.trim() !== '' && nuevoNombre !== marca.nombre) {
        const response = await apiCall(`/marcas/${marcaId}`, {
            method: 'PUT',
            body: JSON.stringify({ nombre: nuevoNombre.trim() })
        });
        
        if (response.success) {
            showAlert('Marca actualizada correctamente', 'success');
            loadPage('admin');
        } else {
            showAlert(response.error || 'Error al actualizar marca', 'danger');
        }
    }
}

// Función para eliminar marca
async function deleteMarca(marcaId) {
    if (!await showConfirmModal('¿Estás seguro de que deseas eliminar esta marca?')) {
        return;
    }
    
    const response = await apiCall(`/marcas/${marcaId}`, {
        method: 'DELETE'
    });
    
    if (response.success) {
        showAlert('Marca eliminada correctamente', 'success');
        loadPage('admin');
    } else {
        showAlert(response.error || 'Error al eliminar marca', 'danger');
    }
}

// Función para eliminar modelo
async function deleteModelo(modeloId) {
    if (!await showConfirmModal('¿Estás seguro de que deseas eliminar este modelo?')) {
        return;
    }
    
    const response = await apiCall(`/modelos/${modeloId}`, {
        method: 'DELETE'
    });
    
    if (response.success) {
        showAlert('Modelo eliminado correctamente', 'success');
        loadPage('admin');
    } else {
        showAlert(response.error || 'Error al eliminar modelo', 'danger');
    }
}
// Función para crear nueva falla
async function showNewFallaModal() {
    const nombre = prompt('Ingresa el nombre de la falla (ej: Pantalla rota, Batería muerta):');
    
    if (!nombre || nombre.trim() === '') {
        return;
    }
    
    const descripcion = prompt('Descripción de la falla (opcional):', '');
    const precio = prompt('Precio sugerido (opcional, ej: 50000):', '0');
    
    try {
        const response = await apiCall('/fallas', {
            method: 'POST',
            body: JSON.stringify({
                nombre: nombre.trim(),
                descripcion: descripcion.trim(),
                precio_sugerido: parseInt(precio) || 0
            })
        });
        
        if (response && response.id) {
            showAlert(`Falla "${nombre}" agregada correctamente`, 'success');
            loadPage('admin');
        } else if (response && response.error) {
            showAlert(response.error, 'danger');
        } else {
            showAlert('Error desconocido al agregar falla', 'danger');
        }
    } catch (error) {
        console.error('Error en showNewFallaModal:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

// Función para editar falla existente
async function editFalla(fallaId) {
    try {
        const fallas = await apiCall('/fallas');
        const falla = fallas.find(f => f.id === fallaId);
        
        if (!falla) {
            showAlert('Falla no encontrada', 'danger');
            return;
        }
        
        const nuevoNombre = prompt(`Nuevo nombre para la falla "${falla.nombre}":`, falla.nombre);
        
        if (nuevoNombre && nuevoNombre.trim() !== '' && nuevoNombre !== falla.nombre) {
            const nuevaDescripcion = prompt('Nueva descripción:', falla.descripcion || '');
            const nuevoPrecio = prompt('Nuevo precio sugerido:', falla.precio_sugerido || '0');
            
            const response = await apiCall(`/fallas/${fallaId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    nombre: nuevoNombre.trim(),
                    descripcion: nuevaDescripcion.trim(),
                    precio_sugerido: parseInt(nuevoPrecio) || 0
                })
            });
            
            if (response.success) {
                showAlert('Falla actualizada correctamente', 'success');
                loadPage('admin');
            } else {
                showAlert(response.error || 'Error al actualizar falla', 'danger');
            }
        }
    } catch (error) {
        console.error('Error en editFalla:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

// Función para eliminar falla
async function deleteFalla(fallaId) {
    if (!await showConfirmModal('¿Estás seguro de que deseas eliminar esta falla? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        const response = await apiCall(`/fallas/${fallaId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showAlert('Falla eliminada correctamente', 'success');
            loadPage('admin');
        } else {
            showAlert(response.error || 'Error al eliminar falla', 'danger');
        }
    } catch (error) {
        console.error('Error en deleteFalla:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

// Función para agregar falla existente a un ingreso
async function addNewFalla(ingresoId) {
    try {
        // Obtener todas las fallas disponibles
        const fallas = await apiCall('/fallas');
        
        if (!fallas || fallas.length === 0) {
            showAlert('No hay fallas disponibles. Crea una nueva primero.', 'warning');
            return;
        }
        
        // Obtener fallas ya agregadas a este ingreso
        const ingresoFallas = await apiCall(`/ingresos/${ingresoId}/fallas`);
        const fallaIds = ingresoFallas.map(f => f.id);
        
        // Filtrar fallas no agregadas
        const fallasDisponibles = fallas.filter(f => !fallaIds.includes(f.id));
        
        if (fallasDisponibles.length === 0) {
            showAlert('Todas las fallas disponibles ya están agregadas', 'warning');
            return;
        }
        
        // Crear lista para seleccionar
        const options = fallasDisponibles.map((f, i) => `${i + 1}. ${f.nombre} ($${f.precio_sugerido || 0})`).join('\n');
        const selection = prompt('Selecciona la falla a agregar:\n\n' + options + '\n\nIngresa el número:', '1');
        
        if (!selection) return;
        
        const index = parseInt(selection) - 1;
        if (index < 0 || index >= fallasDisponibles.length) {
            showAlert('Selección inválida', 'danger');
            return;
        }
        
        const fallaSeleccionada = fallasDisponibles[index];
        const valor = prompt(`Valor de reparación para "${fallaSeleccionada.nombre}":`, fallaSeleccionada.precio_sugerido || '0');
        
        if (!valor) return;
        
        const response = await apiCall(`/ingresos/${ingresoId}/fallas`, {
            method: 'POST',
            body: JSON.stringify({
                falla_id: fallaSeleccionada.id,
                valor_reparacion: parseInt(valor) || 0
            })
        });
        
        if (response.success || response.id) {
            showAlert(`Falla "${fallaSeleccionada.nombre}" agregada correctamente`, 'success');
            loadPage('registros');
        } else {
            showAlert(response.error || 'Error al agregar falla', 'danger');
        }
    } catch (error) {
        console.error('Error en addNewFalla:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

// Función para actualizar valor de reparación de una falla
async function updateValor(ingresoFallaId, nuevoValor) {
    try {
        const valor = parseFloat(nuevoValor);
        if (isNaN(valor) || valor < 0) {
            showAlert('Ingresa un valor válido', 'warning');
            return;
        }
        
        const response = await apiCall(`/ingreso-fallas/${ingresoFallaId}/valor`, {
            method: 'PUT',
            body: JSON.stringify({
                valor_reparacion: valor
            })
        });
        
        if (response.success) {
            showAlert('Valor actualizado correctamente', 'success');
        } else {
            showAlert(response.error || 'Error al actualizar valor', 'danger');
        }
    } catch (error) {
        console.error('Error en updateValor:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

// Función para actualizar estado (ya existe pero mejoramos)
async function updateEstado(ingresoFallaId, nuevoEstado) {
    try {
        const response = await apiCall(`/ingreso-fallas/${ingresoFallaId}/estado`, {
            method: 'PUT',
            body: JSON.stringify({
                estado_falla: nuevoEstado
            })
        });
        
        if (response.success) {
            showAlert(`Estado de falla actualizado a "${nuevoEstado}"`, 'success');
            // Recargar la página actual para mostrar cambios
            if (window.location.hash.includes('tecnico')) {
                loadTecnicoPanel();
            }
        } else {
            showAlert('Error al actualizar estado: ' + (response.error || 'desconocido'), 'danger');
        }
    } catch (error) {
        console.error('Error en updateEstado:', error);
        showAlert('Error de conexión: ' + error.message, 'danger');
    }
}

// Función para remover falla de un ingreso
async function removeFalla(ingresoId, fallaId) {
    if (!await showConfirmModal('¿Estás seguro de que deseas remover esta falla del ingreso?', {
        title: 'Confirmar remoción',
        confirmText: 'Remover'
    })) {
        return;
    }
    
    try {
        const response = await apiCall(`/ingresos/${ingresoId}/fallas/${fallaId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showAlert('Falla removida correctamente', 'success');
            loadPage('registros');
        } else {
            showAlert(response.error || 'Error al remover falla', 'danger');
        }
    } catch (error) {
        console.error('Error en removeFalla:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}
async function updateIngresoEstado(ingresoId) {
    const estadoSelect = document.getElementById('estadoSelect');
    const nuevoEstado = estadoSelect.value;
    
    if (!nuevoEstado) {
        showAlert('Por favor selecciona un estado', 'warning');
        return;
    }
    
    const response = await apiCall(`/ingresos/${ingresoId}`, {
        method: 'PUT',
        body: JSON.stringify({ estado_ingreso: nuevoEstado })
    });
    
    if (response && response.success) {
        showAlert('Estado actualizado correctamente', 'success');
        // Recarga los detalles técnicos
        verDetallesTecnico(ingresoId);
    } else {
        showAlert(response?.error || 'Error al actualizar el estado', 'danger');
    }
}

// Función para agregar nuevo usuario
// ===== FUNCIONES DE USUARIOS =====
function toggleUserForm() {
    const form = document.getElementById('userFormContainer');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        document.getElementById('newUserForm').reset();
    } else {
        form.style.display = 'none';
    }
}

async function submitNewUser(event) {
    event.preventDefault();
    
    const usuario = document.getElementById('newUserUsuario').value.trim();
    const nombre = document.getElementById('newUserNombre').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const rol = document.getElementById('newUserRol').value;
    
    if (!usuario || !nombre || !password || !rol) {
        showAlert('Todos los campos son obligatorios', 'danger');
        return;
    }
    
    try {
        const response = await apiCall('/admin/usuarios', {
            method: 'POST',
            body: JSON.stringify({
                usuario,
                nombre,
                rol,
                contraseña: password
            })
        });
        
        if (response && response.id) {
            showAlert(`Usuario "${usuario}" creado correctamente`, 'success');
            toggleUserForm();
            loadPage('admin');
        } else if (response && response.error) {
            showAlert(response.error, 'danger');
        } else {
            showAlert('Error al crear usuario', 'danger');
        }
    } catch (error) {
        console.error('Error al crear usuario:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

async function deleteUser(id, nombre) {
    if (!await showConfirmModal(`¿Eliminar el usuario "${nombre}"?`)) return;
    
    try {
        const response = await apiCall(`/admin/usuarios/${id}`, {
            method: 'DELETE'
        });
        
        if (response && response.success) {
            showAlert(`Usuario "${nombre}" eliminado`, 'success');
            loadPage('admin');
        } else {
            showAlert(response?.error || 'Error al eliminar usuario', 'danger');
        }
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        showAlert('Error al conectar con el servidor', 'danger');
    }
}

// ===== FUNCIONES DE MARCAS =====
function toggleMarcaForm() {
    const form = document.getElementById('marcaFormContainer');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        document.getElementById('newMarcaForm').reset();
    } else {
        form.style.display = 'none';
    }
}

async function submitNewMarca(event) {
    event.preventDefault();
    
    const nombre = document.getElementById('newMarcaNombre').value.trim();
    
    if (!nombre) {
        showAlert('El nombre de la marca es obligatorio', 'danger');
        return;
    }
    
    try {
        const response = await apiCall('/marcas', {
            method: 'POST',
            body: JSON.stringify({ nombre })
        });
        
        if (response && response.id) {
            showAlert(`Marca "${nombre}" agregada correctamente`, 'success');
            toggleMarcaForm();
            loadPage('admin');
        } else if (response && response.error) {
            showAlert(response.error, 'danger');
        } else {
            showAlert('Error al agregar marca', 'danger');
        }
    } catch (error) {
        console.error('Error al agregar marca:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

async function deleteMarca(id, nombre) {
    if (!await showConfirmModal(`¿Eliminar la marca "${nombre}"?`)) return;
    
    try {
        const response = await apiCall(`/marcas/${id}`, {
            method: 'DELETE'
        });
        
        if (response && response.success) {
            showAlert(`Marca "${nombre}" eliminada`, 'success');
            loadPage('admin');
        } else {
            showAlert(response?.error || 'Error al eliminar marca', 'danger');
        }
    } catch (error) {
        console.error('Error al eliminar marca:', error);
        showAlert('Error al conectar con el servidor', 'danger');
    }
}

// ===== FUNCIONES DE MODELOS =====
function toggleModeloForm() {
    const form = document.getElementById('modeloFormContainer');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        document.getElementById('newModeloForm').reset();
    } else {
        form.style.display = 'none';
    }
}

async function showModelosForMarca(marcaId, marcaNombre) {
    const modelos = await apiCall(`/marcas/${marcaId}/modelos`);
    const container = document.getElementById('modelosListContainer');
    
    let html = `<h6 class="mb-3">Modelos de ${marcaNombre}</h6>`;
    
    if (Array.isArray(modelos) && modelos.length > 0) {
        html += `<table class="table table-sm">
                    <tbody>
                        ${modelos.map(m => `
                            <tr>
                                <td>${m.nombre}</td>
                                <td width="80">
                                    <button class="btn btn-sm btn-danger" onclick="deleteModelo(${m.id}, '${m.nombre}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
    } else {
        html += `<p class="text-muted">No hay modelos para esta marca</p>`;
    }
    
    container.innerHTML = html;
}

async function submitNewModelo(event) {
    event.preventDefault();
    
    const marcaId = parseInt(document.getElementById('newModeloMarca').value);
    const nombre = document.getElementById('newModeloNombre').value.trim();
    
    if (!marcaId || !nombre) {
        showAlert('Todos los campos son obligatorios', 'danger');
        return;
    }
    
    try {
        const response = await apiCall('/modelos', {
            method: 'POST',
            body: JSON.stringify({ marca_id: marcaId, nombre })
        });
        
        if (response && response.id) {
            showAlert(`Modelo "${nombre}" agregado correctamente`, 'success');
            toggleModeloForm();
            loadPage('admin');
        } else if (response && response.error) {
            showAlert(response.error, 'danger');
        } else {
            showAlert('Error al agregar modelo', 'danger');
        }
    } catch (error) {
        console.error('Error al agregar modelo:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

async function deleteModelo(id, nombre) {
    if (!await showConfirmModal(`¿Eliminar el modelo "${nombre}"?`)) return;
    
    try {
        const response = await apiCall(`/modelos/${id}`, {
            method: 'DELETE'
        });
        
        if (response && response.success) {
            showAlert(`Modelo "${nombre}" eliminado`, 'success');
            loadPage('admin');
        } else {
            showAlert(response?.error || 'Error al eliminar modelo', 'danger');
        }
    } catch (error) {
        console.error('Error al eliminar modelo:', error);
        showAlert('Error al conectar con el servidor', 'danger');
    }
}

// ===== FUNCIONES DE FALLAS =====
function toggleFallaForm() {
    const form = document.getElementById('fallaFormContainer');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        document.getElementById('newFallaForm').reset();
    } else {
        form.style.display = 'none';
    }
}

async function submitNewFalla(event) {
    event.preventDefault();
    
    const nombre = document.getElementById('newFallaNombre').value.trim();
    const precio = parseFloat(document.getElementById('newFallaPrecio').value);
    const descripcion = document.getElementById('newFallaDescripcion').value.trim();
    
    if (!nombre || isNaN(precio)) {
        showAlert('Nombre y precio son obligatorios', 'danger');
        return;
    }
    
    try {
        const response = await apiCall('/fallas', {
            method: 'POST',
            body: JSON.stringify({
                nombre,
                precio_sugerido: precio,
                descripcion
            })
        });
        
        if (response && response.id) {
            showAlert(`Falla "${nombre}" agregada correctamente`, 'success');
            toggleFallaForm();
            loadPage('admin');
        } else if (response && response.error) {
            showAlert(response.error, 'danger');
        } else {
            showAlert('Error al agregar falla', 'danger');
        }
    } catch (error) {
        console.error('Error al agregar falla:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

async function deleteFalla(id, nombre) {
    if (!await showConfirmModal(`¿Eliminar la falla "${nombre}"?`)) return;
    
    try {
        const response = await apiCall(`/fallas/${id}`, {
            method: 'DELETE'
        });
        
        if (response && response.success) {
            showAlert(`Falla "${nombre}" eliminada`, 'success');
            loadPage('admin');
        } else {
            showAlert(response?.error || 'Error al eliminar falla', 'danger');
        }
    } catch (error) {
        console.error('Error al eliminar falla:', error);
        showAlert('Error al conectar con el servidor', 'danger');
    }
}

// ===== FUNCIONES DE CLIENTES =====
async function editarCliente(cedula) {
    try {
        // Obtener datos del cliente
        const ingresos = await apiCall('/ingresos');
        const cliente = ingresos.data.find(i => i.cliente_cedula === cedula);
        
        if (!cliente) {
            showAlert('Cliente no encontrado', 'danger');
            return;
        }
        
        // Crear modal para editar
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'editClienteModal';
        modal.setAttribute('data-bs-backdrop', 'static');
        modal.tabIndex = -1;
        
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Editar Cliente</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="editClienteForm" onsubmit="submitEditarCliente(event, '${cedula}'); return false;">
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Nombre *</label>
                                    <input type="text" class="form-control" id="editClienteNombre" 
                                           value="${cliente.cliente_nombre}" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Apellido *</label>
                                    <input type="text" class="form-control" id="editClienteApellido" 
                                           value="${cliente.cliente_apellido}" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Cédula *</label>
                                    <input type="text" class="form-control" id="editClienteCedula" 
                                           value="${cedula}" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Teléfono *</label>
                                    <input type="tel" class="form-control" id="editClienteTelefono" 
                                           value="${cliente.cliente_telefono || ''}" required>
                                </div>
                                <div class="col-md-12 mb-3">
                                    <label class="form-label">Dirección</label>
                                    <input type="text" class="form-control" id="editClienteDireccion" 
                                           value="${cliente.cliente_direccion || ''}">
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', function() {
            modal.remove();
        });
    } catch (error) {
        console.error('Error al cargar cliente:', error);
        showAlert('Error al cargar datos del cliente', 'danger');
    }
}

async function submitEditarCliente(event, cedula) {
    event.preventDefault();
    
    const nombre = document.getElementById('editClienteNombre').value.trim();
    const apellido = document.getElementById('editClienteApellido').value.trim();
    const cedulaNueva = document.getElementById('editClienteCedula').value.trim();
    const telefono = document.getElementById('editClienteTelefono').value.trim();
    const direccion = document.getElementById('editClienteDireccion').value.trim();
    
    if (!nombre || !apellido || !cedulaNueva || !telefono) {
        showAlert('Nombre, apellido, cédula y teléfono son obligatorios', 'danger');
        return;
    }
    
    try {
        // Obtener todos los ingresos del cliente
        const ingresos = await apiCall('/ingresos');
        const clienteIngresos = ingresos.data.filter(i => i.cliente_cedula === cedula);
        
        // Actualizar cada ingreso con los nuevos datos
        for (const ingreso of clienteIngresos) {
            await apiCall(`/ingresos/${ingreso.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    cliente_nombre: nombre,
                    cliente_apellido: apellido,
                    cliente_cedula: cedulaNueva,
                    cliente_telefono: telefono,
                    cliente_direccion: direccion
                })
            });
        }
        
        showAlert('Cliente actualizado correctamente', 'success');
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editClienteModal'));
        modal.hide();
        
        // Recargar
        loadPage('admin');
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        showAlert('Error al actualizar cliente: ' + error.message, 'danger');
    }
}

async function verClienteIngresos(cedula) {
    try {
        // Obtener ingresos del cliente
        const ingresos = await apiCall('/ingresos');
        const clienteIngresos = ingresos.data.filter(i => i.cliente_cedula === cedula);
        
        if (clienteIngresos.length === 0) {
            showAlert('No hay ingresos para este cliente', 'info');
            return;
        }
        
        // Crear modal para ver ingresos
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'verIngresosModal';
        modal.tabIndex = -1;
        
        const clienteNombre = clienteIngresos[0].cliente_nombre + ' ' + clienteIngresos[0].cliente_apellido;
        
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Ingresos de ${clienteNombre}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="table-responsive">
                            <table class="table table-sm table-hover">
                                <thead class="table-light">
                                    <tr>
                                        <th>ID</th>
                                        <th>Dispositivo</th>
                                        <th>Estado</th>
                                        <th>Fecha Ingreso</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${clienteIngresos.map(ing => `
                                        <tr>
                                            <td>#${ing.id}</td>
                                            <td>${ing.marca_nombre} ${ing.modelo_nombre}</td>
                                            <td><span class="badge bg-info">${ing.estado_ingreso}</span></td>
                                            <td>${new Date(ing.fecha_ingreso).toLocaleDateString('es-ES')}</td>
                                            <td>
                                                <button class="btn btn-sm btn-primary" onclick="verDetalleIngreso(${ing.id})">
                                                    <i class="fas fa-eye"></i> Ver
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', function() {
            modal.remove();
        });
    } catch (error) {
        console.error('Error al cargar ingresos:', error);
        showAlert('Error al cargar ingresos del cliente', 'danger');
    }
}

async function verDetalleIngreso(ingresoId) {
    // Cerrar el modal anterior
    const modal = bootstrap.Modal.getInstance(document.getElementById('verIngresosModal'));
    modal.hide();
    
    // Cargar detalles técnicos del ingreso
    verDetallesTecnico(ingresoId);
}

// Función para editar usuario
async function editUser(userId) {
    showAlert('Función en desarrollo', 'info');
}

// Función para eliminar usuario
async function deleteUser(userId) {
    if (!await showConfirmModal('¿Estás seguro de que deseas eliminar este usuario?')) {
        return;
    }
    
    try {
        const response = await apiCall(`/admin/usuarios/${userId}`, {
            method: 'DELETE'
        });
        
        console.log('Respuesta de eliminar usuario:', response);
        
        if (response && response.success) {
            showAlert('Usuario eliminado correctamente', 'success');
            loadPage('admin');
        } else if (response && response.error) {
            showAlert(response.error, 'danger');
        } else {
            showAlert('Error desconocido al eliminar usuario', 'danger');
        }
    } catch (error) {
        console.error('Error en deleteUser:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

// ===== MODAL DE GESTIÓN DE USUARIOS =====

async function openAdminUsersModal() {
    const modal = new bootstrap.Modal(document.getElementById('adminUsersModal'));
    
    try {
        const usuarios = await apiCall('/admin/usuarios');
        
        const html = `
            <div>
                <h6 class="mb-3">Crear Nuevo Usuario</h6>
                <form id="quickUserForm" onsubmit="submitQuickNewUser(event); return false;">
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <label class="form-label small">Usuario *</label>
                            <input type="text" class="form-control form-control-sm" id="quickUserUsuario" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small">Nombre *</label>
                            <input type="text" class="form-control form-control-sm" id="quickUserNombre" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small">Contraseña *</label>
                            <input type="password" class="form-control form-control-sm" id="quickUserPassword" required minlength="6">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small">Rol *</label>
                            <select class="form-select form-select-sm" id="quickUserRol" required>
                                <option value="">Seleccione...</option>
                                <option value="admin">Administrador</option>
                                <option value="empleado">Empleado</option>
                                <option value="tecnico">Técnico</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-sm btn-primary">
                        <i class="fas fa-save me-1"></i> Crear Usuario
                    </button>
                </form>
                
                <hr class="my-3">
                <h6 class="mb-3">Usuarios Existentes</h6>
                <div class="table-responsive">
                    <table class="table table-sm table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>Usuario</th>
                                <th>Nombre</th>
                                <th>Rol</th>
                                <th width="100">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Array.isArray(usuarios) ? usuarios.map(u => `
                                <tr>
                                    <td>${u.usuario}</td>
                                    <td>${u.nombre}</td>
                                    <td><span class="badge bg-info">${u.rol}</span></td>
                                    <td>
                                        <button class="btn btn-sm btn-danger" onclick="deleteUserFromModal(${u.id}, '${u.usuario}')">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" class="text-center">No hay usuarios</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.getElementById('adminUsersContent').innerHTML = html;
        modal.show();
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('adminUsersContent').innerHTML = `<div class="alert alert-danger">Error al cargar usuarios: ${error.message}</div>`;
    }
}

async function submitQuickNewUser(event) {
    event.preventDefault();
    
    const usuario = document.getElementById('quickUserUsuario').value.trim();
    const nombre = document.getElementById('quickUserNombre').value.trim();
    const password = document.getElementById('quickUserPassword').value;
    const rol = document.getElementById('quickUserRol').value;
    
    if (!usuario || !nombre || !password || !rol) {
        showAlert('Todos los campos son obligatorios', 'danger');
        return;
    }
    
    try {
        const response = await apiCall('/admin/usuarios', {
            method: 'POST',
            body: JSON.stringify({
                usuario,
                nombre,
                rol,
                contraseña: password
            })
        });
        
        if (response && response.id) {
            showAlert(`Usuario "${usuario}" creado correctamente`, 'success');
            openAdminUsersModal();
        } else if (response && response.error) {
            showAlert(response.error, 'danger');
        } else {
            showAlert('Error al crear usuario', 'danger');
        }
    } catch (error) {
        console.error('Error al crear usuario:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

// ===== WIZARD FUNCTIONS =====
let currentWizardStep = 1;

function nextWizardStep() {
    if (currentWizardStep === 1) {
        // Validar paso 1: Datos del cliente
        const nombre = document.getElementById('cliente_nombre')?.value.trim();
        const apellido = document.getElementById('cliente_apellido')?.value.trim();
        const cedula = document.getElementById('cliente_cedula')?.value.trim();
        
        if (!nombre || !apellido || !cedula) {
            showAlert('Por favor complete los datos requeridos del cliente (Nombre, Apellido, Cédula)', 'warning');
            return;
        }
        currentWizardStep = 2;
    } else if (currentWizardStep === 2) {
        // Validar paso 2: Datos del equipo
        const marca = document.getElementById('marca_id')?.value;
        const modelo = document.getElementById('modelo_id')?.value;
        
        if (!marca || !modelo) {
            showAlert('Por favor seleccione Marca y Modelo', 'warning');
            return;
        }
        currentWizardStep = 3;
    } else if (currentWizardStep === 3) {
        currentWizardStep = 4;
    }
    
    updateWizardDisplay();
}

function prevWizardStep() {
    if (currentWizardStep > 1) {
        currentWizardStep--;
        updateWizardDisplay();
    }
}

function updateWizardDisplay() {
    try {
        // Ocultar todos los pasos
        const paso1 = document.getElementById('paso1');
        const paso2 = document.getElementById('paso2');
        const paso3 = document.getElementById('paso3');
        const paso4 = document.getElementById('paso4');
        
        if (!paso1 || !paso2 || !paso3 || !paso4) {
            console.error('Paso elements not found:', {paso1, paso2, paso3, paso4});
            return;
        }
        
        paso1.style.display = 'none';
        paso2.style.display = 'none';
        paso3.style.display = 'none';
        paso4.style.display = 'none';
        
        // Mostrar el paso actual
        document.getElementById(`paso${currentWizardStep}`).style.display = 'block';
        
        // Scroll hacia arriba
        const wizard = document.querySelector('.ingreso-wizard');
        if (wizard) {
            wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (error) {
        console.error('Error in updateWizardDisplay:', error);
    }
}

function selectColor(btn, colorName) {
    // Remover selección anterior
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
    
    // Agregar selección al botón clickeado
    btn.classList.add('selected');
    
    // Guardar valor en el input hidden
    document.getElementById('color').value = colorName;
}

// Aplicación principal
let currentPage = null;
let isSubmittingIngreso = false;
const printingIngresos = new Set();
let adminActiveTab = 'usuarios';
let clientesBusquedaActual = [];
let clienteBusquedaIndiceActivo = -1;

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

function getDefaultPageForRole(rol) {
    const roleDefaults = {
        admin: 'dashboard',
        empleado: 'ingreso',
        tecnico: 'tecnico'
    };

    return roleDefaults[rol] || 'ingreso';
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
        const startPage = getDefaultPageForRole(user.rol);
        console.log(`User logged in, building menu and loading page: ${startPage}`);
        buildMenu();
        loadNavbarBrand();
        
        loadPage(startPage);
    } else {
        console.log('No user found, redirecting to login');
        window.location.href = '/';
    }
}

async function loadNavbarBrand() {
    const brandEl = document.getElementById('navbarBrand');
    if (!brandEl) return;

    let brandImgEl = document.getElementById('navbarBrandImg');
    if (!brandImgEl) {
        brandEl.innerHTML = '';
        brandImgEl = document.createElement('img');
        brandImgEl.id = 'navbarBrandImg';
        brandImgEl.className = 'navbar-logo-img';
        brandImgEl.alt = 'Logo';
        brandEl.appendChild(brandImgEl);
    }

    const buildLogoCandidates = (url) => {
        const base = url || '/static/logos/logo.png';
        const timestamp = `v=${Date.now()}`;
        const addTs = (u) => `${u}${u.includes('?') ? '&' : '?'}${timestamp}`;
        const candidates = [addTs(base)];

        if (base.startsWith('/')) {
            candidates.push(addTs(`${window.location.origin}${base}`));
        }

        if (!base.includes('/static/logos/logo_navbar.png')) {
            candidates.push(addTs('/static/logos/logo_navbar.png'));
            candidates.push(addTs(`${window.location.origin}/static/logos/logo_navbar.png`));
        }

        if (!base.includes('/static/logos/logo.png')) {
            candidates.push(addTs('/static/logos/logo.png'));
            candidates.push(addTs(`${window.location.origin}/static/logos/logo.png`));
        }

        return [...new Set(candidates)];
    };

    const setBrandLogo = (url, alt = 'Logo') => {
        const candidates = buildLogoCandidates(url);
        let index = 0;

        brandImgEl.alt = alt;
        brandImgEl.onerror = () => {
            index += 1;
            if (index < candidates.length) {
                brandImgEl.src = candidates[index];
            }
        };

        brandImgEl.src = candidates[index];
    };

    // Mostrar logo navbar por defecto
    setBrandLogo('/static/logos/logo.png', 'Logo');

    try {
        // Primero intentar con configuración admin (estable y ya existente)
        const adminConfig = await apiCall('/admin/configuracion');
        if (adminConfig && !adminConfig.error) {
            const logoUrl = adminConfig.logo_navbar_url?.valor || adminConfig.logo_url?.valor;
            const nombreNegocio = (adminConfig.nombre_negocio?.valor || 'Logo').trim() || 'Logo';
            if (logoUrl) {
                setBrandLogo(logoUrl, nombreNegocio);
                return;
            }
        }

        // Fallback: endpoint público si existe
        const branding = await apiCall('/configuracion/publica');
        if (branding && !branding.error && (branding.logo_navbar_url || branding.logo_url)) {
            const nombreNegocio = (branding.nombre_negocio || 'Logo').trim() || 'Logo';
            setBrandLogo(branding.logo_navbar_url || branding.logo_url, nombreNegocio);
        }
    } catch (error) {
        console.error('Error cargando logo del navbar:', error);
    }
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function buildMenu() {
    const menus = [
        document.getElementById('menuNav'),
        document.getElementById('menuNavMobile')
    ].filter(Boolean);
    if (!menus.length) return;
    const user = getCurrentUserSafe();
    if (!user || !user.rol) {
        menus.forEach((menu) => {
            menu.innerHTML = '';
        });
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

    const menuHtml = items.map(item => `
        <li class="nav-item mb-2">
            <a class="nav-link" data-page="${item.page}" href="#" onclick="loadPage('${item.page}'); closeMobileSidebar(); return false;">
                <span class="menu-icon-wrap">
                    <i class="fas ${item.icon}"></i>
                </span>
                <span class="menu-label">${item.label}</span>
            </a>
        </li>
    `).join('');

    menus.forEach((menu) => {
        menu.innerHTML = menuHtml;
    });

    updateMenuActiveState(currentPage || items[0]?.page);
}

function updateMenuActiveState(page) {
    const links = document.querySelectorAll('#menuNav .nav-link[data-page], #menuNavMobile .nav-link[data-page]');
    links.forEach(link => {
        const isActive = link.getAttribute('data-page') === page;
        link.classList.toggle('active', isActive);
        link.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
}

function closeMobileSidebar() {
    const sidebarEl = document.getElementById('mobileSidebar');
    if (!sidebarEl || typeof bootstrap === 'undefined') return;

    const sidebarInstance = bootstrap.Offcanvas.getInstance(sidebarEl);
    if (sidebarInstance) {
        sidebarInstance.hide();
    }
}

async function loadPage(page) {
    const user = getCurrentUserSafe();
    const previousPage = currentPage;

    if (page === 'admin' && previousPage !== 'admin') {
        adminActiveTab = 'usuarios';
    }

    currentPage = page;
    updateMenuActiveState(page);
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
                if (!user || user.rol !== 'admin') {
                    content = '<div class="alert alert-danger">Acceso denegado</div>';
                } else {
                    content = await loadDashboard();
                }
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
                        buscarClienteInput.addEventListener('keydown', manejarNavegacionBusquedaClientes);
                        buscarClienteInput.addEventListener('keyup', buscarClientes);
                        buscarClienteInput.addEventListener('input', buscarClientes);
                    }
                    
                    const tieneClaveSelect = document.getElementById('tiene_clave');
                    if (tieneClaveSelect) {
                        tieneClaveSelect.addEventListener('change', toggleClave);
                    }

                    const tipoClaveSelect = document.getElementById('tipo_clave');
                    if (tipoClaveSelect) {
                        tipoClaveSelect.addEventListener('change', applyClaveInputRules);
                    }

                    const claveInput = document.getElementById('clave');
                    if (claveInput) {
                        claveInput.addEventListener('input', handleClaveInputChange);
                    }

                    const bandejaSimSelect = document.getElementById('bandeja_sim_select');
                    if (bandejaSimSelect) {
                        bandejaSimSelect.addEventListener('change', toggleBandejaSimColor);
                        toggleBandejaSimColor();
                    }

                    setupIngresoFieldRestrictions();

                    const valorInput = document.getElementById('valor_reparacion');
                    if (valorInput) {
                        valorInput.addEventListener('input', () => {
                            const numericValue = parseMonetaryValue(valorInput.value);
                            valorInput.value = numericValue > 0 ? formatNumberCO(numericValue) : '';
                        });
                    }

                    document.querySelectorAll('.falla-checkbox').forEach(cb => {
                        cb.addEventListener('change', () => {
                            syncValorReparacionFromFallas();
                            updateFallasSelectedCount();
                        });
                    });

                    const fallasSearchInput = document.getElementById('fallasSearch');
                    if (fallasSearchInput) {
                        fallasSearchInput.addEventListener('focus', openFallasDropdown);
                        fallasSearchInput.addEventListener('input', () => {
                            openFallasDropdown();
                            filterFallasList();
                        });
                    }

                    const fallasToggleBtn = document.getElementById('fallasDropdownToggle');
                    if (fallasToggleBtn) {
                        fallasToggleBtn.addEventListener('click', (event) => {
                            event.preventDefault();
                            toggleFallasDropdown();
                        });
                    }

                    if (window._fallasOutsideClickHandler) {
                        document.removeEventListener('click', window._fallasOutsideClickHandler);
                    }

                    window._fallasOutsideClickHandler = (event) => {
                        const selector = document.getElementById('fallasSelector');
                        if (!selector) return;
                        if (!selector.contains(event.target)) {
                            closeFallasDropdown();
                        }
                    };
                    document.addEventListener('click', window._fallasOutsideClickHandler);

                    toggleClave();
                    applyClaveInputRules();
                    toggleBandejaSimColor();
                    syncValorReparacionFromFallas();
                    updateFallasSelectedCount();
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

            const equipoNoListaCheckbox = document.getElementById('equipo_no_lista');
            if (equipoNoListaCheckbox) {
                equipoNoListaCheckbox.addEventListener('change', toggleEquipoNoLista);
                toggleEquipoNoLista();
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
        } else if (page === 'registros') {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('keyup', (event) => {
                    if (event.key === 'Enter') {
                        filtrarRegistros(1);
                    }
                });
            }

            const estadoFilter = document.getElementById('estadoFilter');
            if (estadoFilter) {
                estadoFilter.addEventListener('change', () => filtrarRegistros(1));
            }
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
        <div class="dashboard-shell">
        <h2 class="mb-4 dashboard-title">Dashboard - Balance Mensual</h2>
        
        <div class="card mb-4 dashboard-card">
            <div class="card-header dashboard-card-header text-white">
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
                        <button class="btn btn-dashboard-filter w-100" onclick="filtrarDashboard()">
                            <i class="fas fa-filter me-2"></i> Filtrar
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="card mb-4 dashboard-card">
            <div class="card-header dashboard-card-header text-white">
                <h5 class="mb-0">Balance Mensual</h5>
            </div>
            <div class="card-body">
                <canvas id="chartBalanceMensual" style="max-height: 300px;"></canvas>
            </div>
        </div>

        <div class="row mb-4" id="metricsRow">
            <div class="col-md-3">
                <div class="card bg-info text-white dashboard-metric-card">
                    <div class="card-body">
                        <h5 class="card-title">Total Servicios</h5>
                        <p class="card-text display-4" id="metricTotal">0</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-success text-white dashboard-metric-card">
                    <div class="card-body">
                        <h5 class="card-title">Entregados y Pagados</h5>
                        <p class="card-text display-4" id="metricReparados">0</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-primary text-white dashboard-metric-card">
                    <div class="card-body">
                        <h5 class="card-title">Entregados</h5>
                        <p class="card-text display-4" id="metricEntregados">0</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-warning text-dark dashboard-metric-card">
                    <div class="card-body">
                        <h5 class="card-title">Total Ingresos</h5>
                        <p class="card-text display-4" id="metricIngresos">$ 0</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card dashboard-card">
            <div class="card-header dashboard-card-header text-white">
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
        const monthColors = [
            'rgba(255, 99, 132, 0.72)',
            'rgba(54, 162, 235, 0.72)',
            'rgba(255, 206, 86, 0.72)',
            'rgba(75, 192, 192, 0.72)',
            'rgba(153, 102, 255, 0.72)',
            'rgba(255, 159, 64, 0.72)',
            'rgba(46, 204, 113, 0.72)',
            'rgba(231, 76, 60, 0.72)',
            'rgba(52, 152, 219, 0.72)',
            'rgba(241, 196, 15, 0.72)',
            'rgba(155, 89, 182, 0.72)',
            'rgba(26, 188, 156, 0.72)'
        ];
        const monthBorderColors = [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(46, 204, 113, 1)',
            'rgba(231, 76, 60, 1)',
            'rgba(52, 152, 219, 1)',
            'rgba(241, 196, 15, 1)',
            'rgba(155, 89, 182, 1)',
            'rgba(26, 188, 156, 1)'
        ];
        const monthHoverColors = monthColors.map(color => color.replace('0.72', '0.92'));
        
        window.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'Balance Mensual ($)',
                    data: values,
                    backgroundColor: monthColors,
                    borderColor: monthBorderColors,
                    borderWidth: 2,
                    borderRadius: 5,
                    hoverBackgroundColor: monthHoverColors
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
    const tecnicos = await apiCall('/tecnicos');
    console.log('Técnicos response:', tecnicos);
    const configPublica = await apiCall('/configuracion/publica');
    const tecnicoDefaultId = parseInt(configPublica?.tecnico_default_id || '', 10) || null;
    
    if (!marcas || !fallas || !tecnicos) {
        console.error('Error: marcas or fallas is null/undefined', {marcas, fallas});
        return '<div class="alert alert-danger">Error al cargar datos. Marcas: ' + (marcas ? 'OK' : 'FALLO') + ', Fallas: ' + (fallas ? 'OK' : 'FALLO') + ', Técnicos: ' + (tecnicos ? 'OK' : 'FALLO') + '</div>';
    }
    
    console.log('Datos cargados correctamente, generando HTML');
    
    return `
        <div class="ingreso-page">
            <h2 class="mb-4 ingreso-title">Nuevo Ingreso Técnico</h2>
            
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
                                <input type="text" class="form-control form-control-lg" id="cliente_cedula" inputmode="numeric" pattern="[0-9]*" required>
                            </div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="mb-3">
                                <label class="form-label">Teléfono</label>
                                <input type="tel" class="form-control form-control-lg" id="cliente_telefono" inputmode="numeric" pattern="[0-9]*">
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
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" id="equipo_no_lista">
                                <label class="form-check-label" for="equipo_no_lista">
                                    No está en lista (admin completará marca y modelo)
                                </label>
                                <small class="text-muted d-block">El empleado no puede proponer marca/modelo para evitar errores.</small>
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
                        <div class="col-12 col-md-6">
                            <div class="mb-3">
                                <label class="form-label">IMEI *</label>
                                <input type="text" class="form-control form-control-lg" id="imei" inputmode="numeric" pattern="[0-9]{15}" maxlength="15" placeholder="15 dígitos" required>
                            </div>
                        </div>
                        <div class="col-12 col-md-6">
                            <div class="mb-3">
                                <label class="form-label">Técnico que repara *</label>
                                <select class="form-control form-control-lg" id="tecnico_id" required>
                                    <option value="">Seleccione un técnico</option>
                                    ${Array.isArray(tecnicos) ? tecnicos.map(t => {
                                        const cedula = t.cedula ? ` · CC ${t.cedula}` : '';
                                        const telefono = t.telefono ? ` · ${t.telefono}` : '';
                                        const selected = tecnicoDefaultId === Number(t.id) ? 'selected' : '';
                                        return `<option value="${t.id}" ${selected}>${t.nombre}${cedula}${telefono}</option>`;
                                    }).join('') : ''}
                                </select>
                            </div>
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
            
            <!-- PASO 3: ESTADO DEL EQUIPO -->
            <div id="paso3" class="wizard-step" style="display: none;">
                <div class="wizard-header">
                    <span class="badge bg-primary">Paso 3</span>
                    <h4 class="mb-0">Estado del Equipo</h4>
                </div>
                
                <div class="wizard-content">
                    <h5 class="mb-3">Estado del Equipo</h5>
                    <div class="row mb-3">
                        <div class="col-12 col-md-6 col-lg-4 mb-3">
                            <label class="form-label">Apagado</label>
                            <select class="form-control form-control-lg" id="estado_apagado_select">
                                <option value="NO" selected>NO</option>
                                <option value="SI">SI</option>
                            </select>
                        </div>
                        <div class="col-12 col-md-6 col-lg-4 mb-3">
                            <label class="form-label">Garantía</label>
                            <select class="form-control form-control-lg" id="garantia_select">
                                <option value="NO" selected>NO</option>
                                <option value="SI">SI</option>
                            </select>
                        </div>
                        <div class="col-12 col-md-6 col-lg-4 mb-3">
                            <label class="form-label">Estuche</label>
                            <select class="form-control form-control-lg" id="estuche_select">
                                <option value="NO" selected>NO</option>
                                <option value="SI">SI</option>
                            </select>
                        </div>
                        <div class="col-12 col-md-6 col-lg-4 mb-3">
                            <label class="form-label">Bandeja SIM (¿tiene?)</label>
                            <select class="form-control form-control-lg" id="bandeja_sim_select">
                                <option value="NO" selected>NO</option>
                                <option value="SI">SI</option>
                            </select>
                        </div>
                        <div class="col-12 col-md-6 col-lg-4 mb-3" id="colorBandejaDiv" style="display: none;">
                            <label class="form-label">Color de Bandeja SIM</label>
                            <select class="form-control form-control-lg" id="color_bandeja_sim">
                                <option value="" selected>Seleccione color</option>
                                <option value="NEGRO">NEGRO</option>
                                <option value="BLANCO">BLANCO</option>
                                <option value="PLATEADO">PLATEADO</option>
                                <option value="DORADO">DORADO</option>
                                <option value="ROJO">ROJO</option>
                                <option value="AZUL">AZUL</option>
                                <option value="VERDE">VERDE</option>
                                <option value="MORADO">MORADO</option>
                                <option value="ROSADO">ROSADO</option>
                                <option value="NARANJA">NARANJA</option>
                                <option value="GRIS">GRIS</option>
                            </select>
                        </div>
                        <div class="col-12 col-md-6 col-lg-4 mb-3">
                            <label class="form-label">Visor o glass partido</label>
                            <select class="form-control form-control-lg" id="visor_partido_select">
                                <option value="NO" selected>NO</option>
                                <option value="SI">SI</option>
                            </select>
                        </div>
                        <div class="col-12 col-md-6 col-lg-4 mb-3">
                            <label class="form-label">Estado de botones</label>
                            <select class="form-control form-control-lg" id="estado_botones_detalle">
                                <option value="BUENOS COMPLETOS" selected>BUENOS COMPLETOS</option>
                                <option value="REGULARES">REGULARES</option>
                                <option value="NO TIENE">NO TIENE</option>
                            </select>
                        </div>
                        <div class="col-12 col-md-6 col-lg-4 mb-3">
                            <label class="form-label">Tiene clave</label>
                            <select class="form-control form-control-lg" id="tiene_clave" onchange="toggleClave()">
                                <option value="NO" selected>NO</option>
                                <option value="SI">SI</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="mb-4" id="claveDiv" style="display: none;">
                        <div class="row">
                            <div class="col-12 col-md-4 mb-3">
                                <label class="form-label">Tipo de clave</label>
                                <select class="form-control form-control-lg" id="tipo_clave">
                                    <option value="NUMERICA">NUMÉRICA</option>
                                    <option value="ALFANUMERICA">ALFANUMÉRICA</option>
                                </select>
                            </div>
                            <div class="col-12 col-md-8 mb-3">
                                <label class="form-label">Clave del equipo</label>
                                <input type="text" class="form-control form-control-lg" id="clave" placeholder="Ingrese la clave">
                            </div>
                        </div>
                    </div>
                    
                    <div class="wizard-nav">
                        <button type="button" class="btn btn-secondary btn-lg me-2" onclick="prevWizardStep()">
                            <i class="fas fa-arrow-left me-2"></i> Anterior
                        </button>
                        <button type="button" class="btn btn-primary btn-lg flex-grow-1" onclick="nextWizardStep()">
                            <i class="fas fa-arrow-right me-2"></i> Siguiente: Fallas reportadas
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- PASO 4: FALLAS REPORTADAS -->
            <div id="paso4" class="wizard-step" style="display: none;">
                <div class="wizard-header">
                    <span class="badge bg-primary">Paso 4</span>
                    <h4 class="mb-0">Fallas Reportadas</h4>
                </div>
                
                <div class="wizard-content">
                    <div class="fallas-selector mb-3" id="fallasSelector">
                        <div class="fallas-toolbar">
                            <input type="text" class="form-control" id="fallasSearch" placeholder="Buscar falla...">
                            <button type="button" class="btn btn-outline-primary btn-sm" id="fallasDropdownToggle" aria-label="Mostrar fallas">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <span class="fallas-count" id="fallasSelectedCount">0 seleccionadas</span>
                            <span class="fallas-total" id="fallasSelectedTotal">$ 0</span>
                        </div>
                        <div class="fallas-dropdown" id="fallasDropdown">
                            <div class="fallas-list" id="fallasCheckbox">
                                ${Array.isArray(fallas) ? fallas.map((f) => 
                                    `<label class="falla-item" data-name="${(f.nombre || '').toLowerCase()}" for="falla_${f.id}">
                                        <input class="form-check-input falla-checkbox" type="checkbox" value="${f.id}" data-precio="${Number(f.precio_sugerido || 0)}" id="falla_${f.id}">
                                        <span class="falla-label-text">${f.nombre}</span>
                                        <span class="falla-price">${Number(f.precio_sugerido || 0) > 0 ? `$ ${Number(f.precio_sugerido).toLocaleString('es-CO')}` : '$ 0'}</span>
                                    </label>`
                                ).join('') : ''}
                            </div>
                        </div>
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

            <!-- PASO 5: RESUMEN -->
            <div id="paso5" class="wizard-step" style="display: none;">
                <div class="wizard-header">
                    <span class="badge bg-primary">Paso 5</span>
                    <h4 class="mb-0">Descripción y Resumen</h4>
                </div>
                
                <div class="wizard-content">
                    <div class="mb-4">
                        <label class="form-label">Detalle del Ingreso *</label>
                        <textarea class="form-control form-control-lg" id="falla_general" rows="3" placeholder="Ej: PANTALLA ROTA PERO CELULAR SUENA" required></textarea>
                    </div>
                    
                    <div class="mb-4">
                        <label class="form-label">Valor de Reparación</label>
                        <div class="input-group input-group-lg">
                            <span class="input-group-text">$</span>
                            <input type="text" class="form-control" id="valor_reparacion" placeholder="0" inputmode="numeric" autocomplete="off">
                        </div>
                        <small class="text-muted">Dejar vacío para asignar después</small>
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

async function buscarClientes(event) {
    const buscarInput = document.getElementById('buscar_cliente');
    const resultados = document.getElementById('resultadosBusqueda');

    if (event?.type === 'keyup') {
        const navigationKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'];
        if (navigationKeys.includes(event.key)) {
            return;
        }
    }
    
    // Verificar que los elementos existan
    if (!buscarInput || !resultados) {
        console.log('Elementos de búsqueda no encontrados');
        return;
    }
    
    const query = buscarInput.value.trim();
    
    if (query.length < 2) {
        clientesBusquedaActual = [];
        clienteBusquedaIndiceActivo = -1;
        resultados.style.display = 'none';
        return;
    }
    
    try {
        console.log('Buscando clientes con query:', query);
        const response = await apiCall(`/clientes/buscar?q=${encodeURIComponent(query)}`);
        
        console.log('Respuesta de búsqueda:', response);
        
        if (!response.data || response.data.length === 0) {
            clientesBusquedaActual = [];
            clienteBusquedaIndiceActivo = -1;
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
        clientesBusquedaActual = clientesFiltrados;
        clienteBusquedaIndiceActivo = -1;
        
        resultados.innerHTML = clientesFiltrados.map((cliente, index) => `
            <button type="button" class="list-group-item list-group-item-action" 
                    data-cliente-index="${index}"
                    onclick="seleccionarClienteDesdeBusqueda(${index})">
                <div class="d-flex w-100 justify-content-between">
                    <strong>${cliente.nombre} ${cliente.apellido}</strong>
                </div>
                <small>Cédula: ${cliente.cedula} | Tel: ${cliente.telefono || 'Sin dato'}</small>
            </button>
        `).join('');
        resultados.style.display = 'block';
        actualizarOpcionClienteActiva();
    } catch (error) {
        console.error('Error buscando clientes:', error);
        clientesBusquedaActual = [];
        clienteBusquedaIndiceActivo = -1;
        resultados.innerHTML = '<div class="list-group-item text-danger">Error en la búsqueda</div>';
        resultados.style.display = 'block';
    }
}

function manejarNavegacionBusquedaClientes(event) {
    const resultados = document.getElementById('resultadosBusqueda');
    if (!resultados || resultados.style.display === 'none') {
        return;
    }

    if (!clientesBusquedaActual.length) {
        return;
    }

    const lastIndex = clientesBusquedaActual.length - 1;

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        clienteBusquedaIndiceActivo = clienteBusquedaIndiceActivo >= lastIndex
            ? 0
            : clienteBusquedaIndiceActivo + 1;
        actualizarOpcionClienteActiva();
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        clienteBusquedaIndiceActivo = clienteBusquedaIndiceActivo <= 0
            ? lastIndex
            : clienteBusquedaIndiceActivo - 1;
        actualizarOpcionClienteActiva();
        return;
    }

    if (event.key === 'Enter' && clienteBusquedaIndiceActivo >= 0) {
        event.preventDefault();
        seleccionarClienteDesdeBusqueda(clienteBusquedaIndiceActivo);
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        resultados.style.display = 'none';
        clienteBusquedaIndiceActivo = -1;
    }
}

function actualizarOpcionClienteActiva() {
    const items = document.querySelectorAll('#resultadosBusqueda .list-group-item-action');
    items.forEach((item, index) => {
        item.classList.toggle('active', index === clienteBusquedaIndiceActivo);
    });

    if (clienteBusquedaIndiceActivo < 0) {
        return;
    }

    const activeItem = document.querySelector(`#resultadosBusqueda .list-group-item-action[data-cliente-index="${clienteBusquedaIndiceActivo}"]`);
    if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
    }
}

function seleccionarClienteDesdeBusqueda(index) {
    const cliente = clientesBusquedaActual[index];
    if (!cliente) {
        return;
    }

    seleccionarCliente(
        cliente.nombre,
        cliente.apellido,
        cliente.cedula,
        cliente.telefono || '',
        cliente.direccion || ''
    );
}

function seleccionarCliente(nombre, apellido, cedula, telefono, direccion) {
    document.getElementById('cliente_nombre').value = sanitizeOnlyLetters(nombre || '');
    document.getElementById('cliente_apellido').value = sanitizeOnlyLetters(apellido || '');
    const cedulaInput = document.getElementById('cliente_cedula');
    cedulaInput.value = sanitizeOnlyDigits(cedula || '');
    cedulaInput.dataset.selectedFromSearch = 'true';
    cedulaInput.dataset.selectedCedulaNorm = normalizeCedula(cedula);
    document.getElementById('cliente_telefono').value = sanitizeOnlyDigits(telefono || '');
    document.getElementById('cliente_direccion').value = direccion;
    
    // Limpiar búsqueda
    document.getElementById('buscar_cliente').value = '';
    document.getElementById('resultadosBusqueda').style.display = 'none';
    clientesBusquedaActual = [];
    clienteBusquedaIndiceActivo = -1;
}

function toggleEquipoNoLista() {
    const noListaCheckbox = document.getElementById('equipo_no_lista');
    const marcaSelect = document.getElementById('marca_id');
    const modeloSelect = document.getElementById('modelo_id');

    if (!noListaCheckbox || !marcaSelect || !modeloSelect) {
        return;
    }

    if (noListaCheckbox.checked) {
        marcaSelect.value = '';
        modeloSelect.innerHTML = '<option value="">Pendiente de catalogación por admin</option>';
        modeloSelect.value = '';

        marcaSelect.required = false;
        modeloSelect.required = false;
        marcaSelect.disabled = true;
        modeloSelect.disabled = true;
        return;
    }

    marcaSelect.disabled = false;
    modeloSelect.disabled = false;
    marcaSelect.required = true;
    modeloSelect.required = true;
    modeloSelect.innerHTML = '<option value="">Seleccione marca primero</option>';
}

async function loadModelosByMarca() {
    const noListaCheckbox = document.getElementById('equipo_no_lista');
    if (noListaCheckbox?.checked) {
        return;
    }

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
    const equipoNoLista = document.getElementById('equipo_no_lista')?.checked === true;
    const cedulaInput = document.getElementById('cliente_cedula');
    const cedulaNormalizada = normalizeCedula(cedulaInput?.value || '');
    const selectedFromSearch = cedulaInput?.dataset?.selectedFromSearch === 'true';
    const selectedCedulaNorm = cedulaInput?.dataset?.selectedCedulaNorm || '';
    const isSelectedExistingClient = selectedFromSearch && selectedCedulaNorm === cedulaNormalizada;
    
    const datos = {
        marca_id: equipoNoLista ? null : parseInt(marcaValue),
        modelo_id: equipoNoLista ? null : parseInt(modeloValue),
        equipo_no_lista: equipoNoLista,
        tecnico_id: parseInt(document.getElementById('tecnico_id').value),
        cliente_nombre: sanitizeOnlyLetters(document.getElementById('cliente_nombre').value).toUpperCase(),
        cliente_apellido: sanitizeOnlyLetters(document.getElementById('cliente_apellido').value).toUpperCase(),
        cliente_cedula: sanitizeOnlyDigits(document.getElementById('cliente_cedula').value),
        cliente_telefono: sanitizeOnlyDigits(document.getElementById('cliente_telefono').value),
        cliente_direccion: document.getElementById('cliente_direccion').value.toUpperCase(),
        color: document.getElementById('color').value.toUpperCase(),
        imei: sanitizeOnlyDigits(document.getElementById('imei').value, 15),
        falla_general: document.getElementById('falla_general').value.toUpperCase(),
        estado_display: document.getElementById('visor_partido_select').value === 'SI',
        estado_tactil: false,
        estado_botones: document.getElementById('estado_botones_detalle').value !== 'BUENOS COMPLETOS',
        estado_apagado: document.getElementById('estado_apagado_select').value === 'SI',
        tiene_clave: document.getElementById('tiene_clave').value === 'SI',
        tipo_clave: document.getElementById('tipo_clave')?.value || '',
        clave: document.getElementById('clave').value,
        garantia: document.getElementById('garantia_select').value === 'SI',
        estuche: document.getElementById('estuche_select').value === 'SI',
        bandeja_sim: document.getElementById('bandeja_sim_select').value === 'SI',
        color_bandeja_sim: document.getElementById('bandeja_sim_select').value === 'SI'
            ? ((document.getElementById('color_bandeja_sim').value || '').toUpperCase())
            : '',
        visor_partido: document.getElementById('visor_partido_select').value === 'SI',
        estado_botones_detalle: document.getElementById('estado_botones_detalle').value,
        valor_reparacion: parseMonetaryValue(document.getElementById('valor_reparacion').value),
        fallas_iniciales: fallasSeleccionadas,
        cliente_existente_seleccionado: isSelectedExistingClient
    };

    if (datos.valor_reparacion === 0) {
        const totalSugerido = Array.from(document.querySelectorAll('.falla-checkbox:checked'))
            .reduce((sum, cb) => sum + Number(cb.dataset.precio || 0), 0);
        datos.valor_reparacion = totalSugerido > 0 ? Math.round(totalSugerido) : 0;
    }

    clearWizardStepAlert(1);
    clearWizardStepAlert(2);
    clearWizardStepAlert(3);
    clearWizardStepAlert(4);
    clearWizardStepAlert(5);
    
    // Validar campos requeridos
    if (!datos.cliente_nombre || !datos.cliente_apellido || !datos.cliente_cedula) {
        currentWizardStep = 1;
        updateWizardDisplay();
        showWizardStepAlert(1, 'Por favor complete los datos requeridos del cliente (Nombre, Apellido, Cédula)', 'danger');
        isSubmittingIngreso = false;
        return;
    }

    if (!isOnlyLetters(datos.cliente_nombre) || !isOnlyLetters(datos.cliente_apellido)) {
        currentWizardStep = 1;
        updateWizardDisplay();
        showWizardStepAlert(1, 'Nombre y apellido solo deben contener texto', 'danger');
        isSubmittingIngreso = false;
        return;
    }

    if (!/^\d+$/.test(datos.cliente_cedula)) {
        currentWizardStep = 1;
        updateWizardDisplay();
        showWizardStepAlert(1, 'La cédula solo debe contener números', 'danger');
        isSubmittingIngreso = false;
        return;
    }

    if (datos.cliente_telefono && !/^\d+$/.test(datos.cliente_telefono)) {
        currentWizardStep = 1;
        updateWizardDisplay();
        showWizardStepAlert(1, 'El teléfono solo debe contener números', 'danger');
        isSubmittingIngreso = false;
        return;
    }

    if ((!datos.equipo_no_lista && (!datos.marca_id || !datos.modelo_id)) || !datos.tecnico_id) {
        currentWizardStep = 2;
        updateWizardDisplay();
        showWizardStepAlert(2, 'Por favor seleccione Técnico y, si aplica, Marca y Modelo', 'danger');
        isSubmittingIngreso = false;
        return;
    }

    if (!datos.imei || !/^\d{15}$/.test(datos.imei)) {
        currentWizardStep = 2;
        updateWizardDisplay();
        showWizardStepAlert(2, 'El IMEI es obligatorio y debe tener exactamente 15 dígitos', 'danger');
        isSubmittingIngreso = false;
        return;
    }

    if (!datos.fallas_iniciales.length) {
        currentWizardStep = 4;
        updateWizardDisplay();
        showWizardStepAlert(4, 'Debe seleccionar al menos una falla', 'danger');
        isSubmittingIngreso = false;
        return;
    }

    if (datos.bandeja_sim && !datos.color_bandeja_sim) {
        currentWizardStep = 3;
        updateWizardDisplay();
        showWizardStepAlert(3, 'Seleccione el color de la bandeja SIM', 'danger');
        isSubmittingIngreso = false;
        return;
    }

    if (!datos.falla_general) {
        currentWizardStep = 5;
        updateWizardDisplay();
        showWizardStepAlert(5, 'Por favor complete el Detalle del Ingreso', 'danger');
        isSubmittingIngreso = false;
        return;
    }

    if (datos.tiene_clave && (datos.tipo_clave || '').toUpperCase() === 'NUMERICA' && datos.clave && !/^\d+$/.test(datos.clave)) {
        currentWizardStep = 3;
        updateWizardDisplay();
        showWizardStepAlert(3, 'Si el tipo de clave es NUMÉRICA, solo se permiten números', 'danger');
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
            showWizardStepAlert(5, 'Error de conexión con el servidor', 'danger');
            return;
        }
        
        if (response.error) {
            if (response.duplicate && response.ingreso_existente?.numero_ingreso) {
                const mismatchHint = response.coincide_nombre_apellido === false
                    ? ' (ojo: nombre/apellido no coinciden con el registro existente)'
                    : '';
                showWizardStepAlert(
                    5,
                    `Cliente ya existe por cédula. Último ingreso: N° ${response.ingreso_existente.numero_ingreso}${mismatchHint}.`,
                    'warning'
                );
                return;
            }
            let missing = Array.isArray(response.missing_fields) && response.missing_fields.length
                ? response.missing_fields
                : [];

            if (!missing.length && String(response.error || '').toLowerCase().includes('campos requeridos incompletos')) {
                const localMissing = [];
                if (!String(datos.cliente_nombre || '').trim()) localMissing.push('cliente_nombre');
                if (!String(datos.cliente_apellido || '').trim()) localMissing.push('cliente_apellido');
                if (!String(datos.cliente_cedula || '').trim()) localMissing.push('cliente_cedula');
                if (!Number.isInteger(datos.tecnico_id) || datos.tecnico_id <= 0) localMissing.push('tecnico_id');
                if (!datos.equipo_no_lista) {
                    if (!Number.isInteger(datos.marca_id) || datos.marca_id <= 0) localMissing.push('marca_id');
                    if (!Number.isInteger(datos.modelo_id) || datos.modelo_id <= 0) localMissing.push('modelo_id');
                }
                missing = localMissing;
            }

            const missingSuffix = missing.length ? ` (${missing.join(', ')})` : '';
            showWizardStepAlert(5, 'Error: ' + response.error + missingSuffix, 'danger');
            return;
        }
        
        if (response.numero_ingreso || response.id) {
            const numeroIngreso = response.numero_ingreso || response.id;
            const catalogoMsg = datos.equipo_no_lista ? ' (equipo pendiente de catalogación por admin)' : '';
            showWizardStepAlert(5, `¡Ingreso creado exitosamente! Número: ${numeroIngreso}${catalogoMsg}`, 'success');
            document.getElementById('ingresoForm').reset();
            toggleEquipoNoLista();
            toggleBandejaSimColor();

            if (response.id) {
                await printTicket(response.id);
            }
            
            // Esperar a que desaparezca la alerta y luego ir a registros
            setTimeout(() => {
                loadPage('registros');
            }, 1500);
        } else {
            showWizardStepAlert(5, 'Error: Respuesta inesperada del servidor', 'danger');
        }
    } catch (error) {
        console.error('Error en submitIngreso:', error);
        showLoading(false);
        showWizardStepAlert(5, 'Error al crear ingreso: ' + error.message, 'danger');
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
                            <th>Fecha/Hora</th>
                            <th>Marca</th>
                            <th>Técnico</th>
                            <th>Estado</th>
                            <th>Valor</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="registrosTableBody">
                        ${response.data.map((ingreso, idx) => {
                            try {
                                return `
                            <tr>
                                <td><strong>${ingreso.numero_ingreso || 'Sin dato'}</strong></td>
                                <td>${ingreso.cliente_nombre || ''} ${ingreso.cliente_apellido || ''}</td>
                                <td>${ingreso.cliente_telefono || 'Sin dato'}</td>
                                <td>${ingreso.cliente_direccion || 'Sin dato'}</td>
                                <td>${ingreso.fecha_ingreso ? new Date(ingreso.fecha_ingreso).toLocaleString('es-ES') : 'Sin dato'}</td>
                                <td>${ingreso.marca || 'Sin dato'}</td>
                                <td>
                                    ${ingreso.tecnico || 'Sin asignar'}
                                    ${(ingreso.tecnico_cedula || ingreso.tecnico_telefono) ? `<br><small class="text-muted">${ingreso.tecnico_cedula ? `CC ${ingreso.tecnico_cedula}` : ''}${(ingreso.tecnico_cedula && ingreso.tecnico_telefono) ? ' · ' : ''}${ingreso.tecnico_telefono || ''}</small>` : ''}
                                </td>
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
                                return `<tr><td colspan="10"><span class="text-danger">Error renderizando ingreso ${idx}: ${e.message}</span></td></tr>`;
                            }
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="card-footer">
                <small id="registrosSummary">Total: ${response.total} ingresos | Página ${response.page} de ${response.pages}</small>
            </div>
        </div>
    `;
}

async function filtrarRegistros(page = 1) {
    const search = (document.getElementById('searchInput')?.value || '').trim();
    const estado = (document.getElementById('estadoFilter')?.value || '').trim();
    const user = getCurrentUserSafe();

    const params = new URLSearchParams({
        page: String(page),
        limit: '20'
    });

    if (search) params.set('cliente', search);
    if (estado) params.set('estado', estado);

    const response = await apiCall(`/ingresos?${params.toString()}`);

    if (!response || response.error) {
        showAlert(response?.error || 'Error al filtrar registros', 'danger');
        return;
    }

    const tbody = document.getElementById('registrosTableBody');
    const summary = document.getElementById('registrosSummary');

    if (!tbody || !summary) {
        loadPage('registros');
        return;
    }

    const data = Array.isArray(response.data) ? response.data : [];

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-4">No se encontraron ingresos con esos filtros</td></tr>';
    } else {
        tbody.innerHTML = data.map((ingreso) => `
            <tr>
                <td><strong>${ingreso.numero_ingreso || 'Sin dato'}</strong></td>
                <td>${ingreso.cliente_nombre || ''} ${ingreso.cliente_apellido || ''}</td>
                <td>${ingreso.cliente_telefono || 'Sin dato'}</td>
                <td>${ingreso.cliente_direccion || 'Sin dato'}</td>
                <td>${ingreso.fecha_ingreso ? new Date(ingreso.fecha_ingreso).toLocaleString('es-ES') : 'Sin dato'}</td>
                <td>${ingreso.marca || 'Sin dato'}</td>
                <td>
                    ${ingreso.tecnico || 'Sin asignar'}
                    ${(ingreso.tecnico_cedula || ingreso.tecnico_telefono) ? `<br><small class="text-muted">${ingreso.tecnico_cedula ? `CC ${ingreso.tecnico_cedula}` : ''}${(ingreso.tecnico_cedula && ingreso.tecnico_telefono) ? ' · ' : ''}${ingreso.tecnico_telefono || ''}</small>` : ''}
                </td>
                <td>
                    <span class="badge bg-${getStatusColor(ingreso.estado_ingreso)}">
                        ${ingreso.estado_ingreso || 'pendiente'}
                    </span>
                </td>
                <td>$${ingreso.valor_total ? parseFloat(ingreso.valor_total).toLocaleString('es-CO') : '0'}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="verDetalles(${ingreso.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${user && user.rol === 'admin' ? `
                        <button class="btn btn-sm btn-danger" onclick="deleteIngreso(${ingreso.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    summary.textContent = `Total: ${response.total || data.length} ingresos | Página ${response.page || page} de ${response.pages || 1}`;
}

async function loadTecnicoPanel() {
    const response = await apiCall('/ingresos');
    const garantiasResponse = await apiCall('/garantias');
    
    if (!response || !response.data) {
        return '<div class="alert alert-danger">Error al cargar panel técnico</div>';
    }
    
    const ingresos = response.data;
    let garantias = Array.isArray(garantiasResponse) ? garantiasResponse : [];

    if (garantias.length === 0) {
        garantias = await buildGarantiasFallbackFromIngresos(ingresos);
    }

    const garantiaEstadoPorIngreso = new Map();
    garantias.forEach((garantia) => {
        const ingresoId = garantia?.ingreso_id;
        if (ingresoId === null || ingresoId === undefined) return;

        const fecha = new Date(garantia.fecha_creacion || 0).getTime();
        const estado = getGarantiaEstadoFromContenido(garantia.contenido || '');
        const existente = garantiaEstadoPorIngreso.get(ingresoId);

        if (!existente || fecha > existente.fecha) {
            garantiaEstadoPorIngreso.set(ingresoId, { fecha, estado });
        }
    });

    const garantiaCasosCount = Array.from(garantiaEstadoPorIngreso.values())
        .filter((item) => item.estado !== 'resuelta')
        .length;

    const hasGarantias = garantiaCasosCount > 0;
    const counts = {
        pendiente: ingresos.filter(i => i.estado_ingreso === 'pendiente').length,
        en_reparacion: ingresos.filter(i => i.estado_ingreso === 'en_reparacion').length,
        reparado: ingresos.filter(i => i.estado_ingreso === 'reparado').length,
        no_reparable: ingresos.filter(i => i.estado_ingreso === 'no_reparable').length,
        entregado: ingresos.filter(i => i.estado_ingreso === 'entregado').length
    };
    
    return `
        <h2 class="mb-4">Panel Técnico - Gestión de Reparaciones</h2>

        <div class="row g-2 mb-3">
            <div class="col-6 col-md-2"><div class="card p-2 text-center"><small class="text-muted">Pendientes</small><div class="fw-bold">${counts.pendiente}</div></div></div>
            <div class="col-6 col-md-2"><div class="card p-2 text-center"><small class="text-muted">En reparación</small><div class="fw-bold">${counts.en_reparacion}</div></div></div>
            <div class="col-6 col-md-2"><div class="card p-2 text-center"><small class="text-muted">Reparados</small><div class="fw-bold">${counts.reparado}</div></div></div>
            <div class="col-6 col-md-2"><div class="card p-2 text-center"><small class="text-muted">No reparables</small><div class="fw-bold">${counts.no_reparable}</div></div></div>
            <div class="col-6 col-md-2"><div class="card p-2 text-center"><small class="text-muted">Entregados</small><div class="fw-bold">${counts.entregado}</div></div></div>
        </div>
        
        <ul class="nav nav-tabs mb-4" role="tablist">
            <li class="nav-item">
                <a class="nav-link ${hasGarantias ? '' : 'active'}" data-bs-toggle="tab" href="#pendientes">
                    <i class="fas fa-clock me-2"></i> Pendientes (${counts.pendiente})
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="tab" href="#en-reparacion">
                    <i class="fas fa-tools me-2"></i> En Reparación (${counts.en_reparacion})
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="tab" href="#reparados">
                    <i class="fas fa-check me-2"></i> Reparados (${counts.reparado})
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="tab" href="#no-reparables">
                    <i class="fas fa-ban me-2"></i> No Reparables (${counts.no_reparable})
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="tab" href="#entregados">
                    <i class="fas fa-box me-2"></i> Entregados (${counts.entregado})
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link ${hasGarantias ? 'active' : ''}" data-bs-toggle="tab" href="#garantias">
                    <i class="fas fa-shield-alt me-2"></i> Garantías (${garantiaCasosCount})
                </a>
            </li>
        </ul>
        
        <div class="tab-content">
            <div id="pendientes" class="tab-pane fade ${hasGarantias ? '' : 'show active'}">
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
            <div id="garantias" class="tab-pane fade ${hasGarantias ? 'show active' : ''}">
                ${renderGarantiasTab(garantias)}
            </div>
        </div>
    `;
}

async function buildGarantiasFallbackFromIngresos(ingresos) {
    try {
        const detalles = await Promise.all(
            (Array.isArray(ingresos) ? ingresos : []).map((ing) => apiCall(`/ingresos/${ing.id}`))
        );

        const registros = [];
        detalles.forEach((det) => {
            if (!det || !Array.isArray(det.notas)) return;

            const notasGarantia = det.notas.filter((nota) => /\[GARANTIA\]|GARANT[ÍI]A/i.test(nota?.contenido || ''));
            notasGarantia.forEach((nota) => {
                registros.push({
                    id: nota.id,
                    ingreso_id: det.id,
                    contenido: nota.contenido,
                    fecha_creacion: nota.fecha_creacion,
                    usuario: nota.usuario,
                    numero_ingreso: det.numero_ingreso,
                    estado_ingreso: det.estado_ingreso,
                    cliente_nombre: det.cliente_nombre,
                    cliente_apellido: det.cliente_apellido,
                    cliente_cedula: det.cliente_cedula,
                    cliente_telefono: det.cliente_telefono,
                    marca: det.marca,
                    modelo: det.modelo,
                    color: det.color
                });
            });
        });

        registros.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
        return registros;
    } catch (error) {
        console.error('Error construyendo fallback de garantías:', error);
        return [];
    }
}

function renderGarantiasTab(garantias) {
    const rows = Array.isArray(garantias) ? garantias : [];
    const grouped = new Map();

    rows.forEach((row) => {
        const key = row.ingreso_id;
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key).push(row);
    });

    const casos = Array.from(grouped.values()).map((movimientos) => {
        const latest = movimientos[0];
        const apertura = movimientos.find((m) => /\[GARANTIA\]\[ABIERTA\]|\[GARANTIA\]\s*POST-ENTREGA|GARANT[ÍI]A\s*POST-ENTREGA/i.test(m.contenido || '')) || movimientos[movimientos.length - 1];

        return {
            latest,
            apertura,
            estadoGarantia: getGarantiaEstadoFromContenido(latest.contenido || ''),
            comentarioApertura: limpiarTextoGarantia(apertura.contenido || ''),
            ultimoMovimiento: limpiarTextoGarantia(latest.contenido || '')
        };
    });

    const activasCount = casos.filter((caso) => caso.estadoGarantia !== 'resuelta').length;
    const resueltasCount = casos.length - activasCount;

    const html = `
        <div class="card">
            <div class="card-header">
                <h5 class="mb-3">Trazabilidad de Garantías</h5>
                <div class="d-flex flex-wrap gap-2 mb-2">
                    <span class="badge bg-warning text-dark">Activas: ${activasCount}</span>
                    <span class="badge bg-success">Resueltas (histórico): ${resueltasCount}</span>
                </div>
                <input type="text" class="form-control" id="buscarGarantias" placeholder="Buscar por ingreso, cliente, cédula, equipo o comentario...">
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-sm table-hover mb-0" id="tablaGarantias">
                        <thead class="table-light">
                            <tr>
                                <th>Ingreso</th>
                                <th>Cliente</th>
                                <th>Equipo</th>
                                <th>Motivo garantía</th>
                                <th>Último movimiento</th>
                                <th>Estado garantía</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="listGarantias">
                            ${casos.length > 0 ? casos.map((caso) => {
                                const g = caso.latest;
                                const cliente = `${g.cliente_nombre || ''} ${g.cliente_apellido || ''}`.trim();
                                const equipo = `${g.marca || ''} ${g.modelo || ''}${g.color ? ` · ${g.color}` : ''}`.trim();
                                const filtro = `${g.numero_ingreso || ''} ${cliente} ${g.cliente_cedula || ''} ${equipo} ${caso.comentarioApertura} ${caso.ultimoMovimiento}`.toLowerCase();
                                const badgeClass = {
                                    abierta: 'bg-warning text-dark',
                                    en_gestion: 'bg-primary',
                                    resuelta: 'bg-success'
                                }[caso.estadoGarantia] || 'bg-secondary';
                                const estadoLabel = {
                                    abierta: 'Pendiente',
                                    en_gestion: 'En gestión',
                                    resuelta: 'Resuelta'
                                }[caso.estadoGarantia] || 'Sin estado';

                                return `
                                    <tr class="fila-garantia" data-filter="${filtro}">
                                        <td><strong>#${g.numero_ingreso || 'S/N'}</strong></td>
                                        <td>
                                            ${cliente || 'N/A'}
                                            <br><small class="text-muted">CC: ${g.cliente_cedula || 'N/A'} · ${g.cliente_telefono || 'N/A'}</small>
                                        </td>
                                        <td><small>${equipo || 'N/A'}</small></td>
                                        <td><small>${caso.comentarioApertura || 'Sin comentario'}</small></td>
                                        <td><small>${caso.ultimoMovimiento || 'Sin movimiento'}</small><br><small class="text-muted">${g.usuario || 'N/A'} · ${new Date(g.fecha_creacion).toLocaleString('es-ES')}</small></td>
                                        <td><span class="badge ${badgeClass}">${estadoLabel}</span></td>
                                        <td>
                                            ${caso.estadoGarantia !== 'resuelta' ? `
                                                <button class="btn btn-sm btn-outline-success" onclick="abrirModalResolverGarantia(${g.ingreso_id})" title="Marcar resuelta">
                                                    Resolver
                                                </button>
                                            ` : ''}
                                            <button class="btn btn-sm btn-info" onclick="verDetalleGarantia(${g.ingreso_id})" title="Ver detalle de garantía">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('') : '<tr><td colspan="7" class="text-center text-muted py-4">No hay garantías registradas</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const buscarGarantiasInput = document.getElementById('buscarGarantias');
        if (!buscarGarantiasInput) return;

        buscarGarantiasInput.addEventListener('keyup', function() {
            const filtro = this.value.toLowerCase();
            const filas = document.querySelectorAll('.fila-garantia');
            filas.forEach((fila) => {
                const texto = fila.getAttribute('data-filter') || '';
                fila.style.display = texto.includes(filtro) ? '' : 'none';
            });
        });
    }, 100);

    return html;
}

function limpiarTextoGarantia(texto) {
    return String(texto || '')
    .replace(/^\[GARANTIA\]\[ABIERTA\]:\s*/i, '')
        .replace(/^\[GARANTIA\]\[ABIERTA\]\s*POST-ENTREGA:\s*/i, '')
        .replace(/^\[GARANTIA\]\[GESTION\]:\s*/i, '')
        .replace(/^\[GARANTIA\]\[RESUELTA\]:\s*/i, '')
        .replace(/^\[GARANTIA\]\s*POST-ENTREGA:\s*/i, '')
        .replace(/^GARANT[ÍI]A\s*POST-ENTREGA:\s*/i, '')
        .trim();
}

function getGarantiaEstadoFromContenido(contenido) {
    const text = String(contenido || '').toUpperCase();
    if (text.includes('[GARANTIA][RESUELTA]')) return 'resuelta';
    if (text.includes('[GARANTIA][GESTION]')) return 'en_gestion';
    return 'abierta';
}

async function actualizarEstadoGarantia(ingresoId, nuevoEstadoGarantia) {
    const comentario = (window.__garantiaComentarioPendiente || '').trim();
    if (!comentario) {
        showAlert('Debes ingresar un comentario para la trazabilidad', 'warning');
        return;
    }

    const prefijo = {
        abierta: '[GARANTIA][ABIERTA] REAPERTURA',
        en_gestion: '[GARANTIA][GESTION]',
        resuelta: '[GARANTIA][RESUELTA]'
    }[nuevoEstadoGarantia] || '[GARANTIA][GESTION]';

    const usuarioActual = getCurrentUserSafe();
    const nombreTecnico = (usuarioActual?.nombre || usuarioActual?.usuario || 'N/A').toString().trim();
    const fechaMovimiento = new Date().toLocaleString('es-ES');
    const detalleCierre = nuevoEstadoGarantia === 'resuelta'
        ? ` | Resuelto el ${fechaMovimiento} por ${nombreTecnico}`
        : '';

    const response = await apiCall(`/ingresos/${ingresoId}/notas`, {
        method: 'POST',
        body: JSON.stringify({
            contenido: `${prefijo}: ${comentario.trim()}${detalleCierre}`,
            tipo: 'tecnica'
        })
    });

    if (response && (response.id || response.success)) {
        window.__garantiaComentarioPendiente = '';
        showAlert('Garantía actualizada correctamente', 'success');
        const detalleIngresoId = Number(document.getElementById('garantiaDetalleIngresoId')?.value || 0);
        if (detalleIngresoId && detalleIngresoId === ingresoId) {
            verDetalleGarantia(ingresoId);
        } else {
            loadPage('tecnico');
        }
    } else {
        showAlert(response?.error || 'No se pudo actualizar la garantía', 'danger');
    }
}

function abrirModalResolverGarantia(ingresoId) {
    return abrirModalEstadoGarantia(ingresoId, 'resuelta');
}

function abrirModalEstadoGarantia(ingresoId, nuevoEstadoGarantia = 'resuelta') {
    const esResuelta = nuevoEstadoGarantia === 'resuelta';
    const modalId = `modalResolverGarantia_${ingresoId}_${Date.now()}`;
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = modalId;
    modal.setAttribute('tabindex', '-1');

    modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${esResuelta ? 'Marcar garantía como resuelta' : 'Marcar garantía como pendiente'}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>
                <div class="modal-body">
                    <label class="form-label">${esResuelta ? 'Detalle de solución' : 'Motivo para dejarla pendiente'} (obligatorio)</label>
                    <textarea class="form-control" id="${modalId}_comentario" rows="4" placeholder="${esResuelta ? 'Ej: Se reemplazó el componente y se realizaron pruebas funcionales.' : 'Ej: El cliente reporta que la falla persiste, se reabre caso.'}"></textarea>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn ${esResuelta ? 'btn-success' : 'btn-warning'}" id="${modalId}_confirmar">${esResuelta ? 'Resolver' : 'Marcar pendiente'}</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);

    modal.querySelector(`#${modalId}_confirmar`).addEventListener('click', async () => {
        const comentario = (modal.querySelector(`#${modalId}_comentario`)?.value || '').trim();
        if (!comentario) {
            showAlert(esResuelta ? 'Debes escribir el detalle de solución' : 'Debes indicar el motivo para dejarla pendiente', 'warning');
            return;
        }

        window.__garantiaComentarioPendiente = comentario;
        await actualizarEstadoGarantia(ingresoId, esResuelta ? 'resuelta' : 'abierta');
        bsModal.hide();
    });

    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    }, { once: true });

    bsModal.show();
}

async function verDetalleGarantia(ingresoId) {
    const ingreso = await apiCall(`/ingresos/${ingresoId}`);
    if (!ingreso || ingreso.error) {
        showAlert('No se pudo cargar el detalle de garantía', 'danger');
        return;
    }

    let garantias = await apiCall('/garantias');
    if (!Array.isArray(garantias) || garantias.length === 0) {
        garantias = await buildGarantiasFallbackFromIngresos([{ id: ingresoId }]);
    }

    const movimientos = (Array.isArray(garantias) ? garantias : [])
        .filter((item) => Number(item.ingreso_id) === Number(ingresoId))
        .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));

    const apertura = movimientos.find((mov) => /\[GARANTIA\]\[ABIERTA\]|GARANT[ÍI]A\s*POST-ENTREGA/i.test(mov.contenido || '')) || movimientos[movimientos.length - 1];
    const estadoActual = movimientos.length > 0 ? getGarantiaEstadoFromContenido(movimientos[0].contenido || '') : 'abierta';
    const estadoLabel = {
        abierta: 'Pendiente',
        en_gestion: 'En gestión',
        resuelta: 'Resuelta'
    }[estadoActual] || 'Pendiente';
    const estadoClass = {
        abierta: 'bg-warning text-dark',
        en_gestion: 'bg-primary',
        resuelta: 'bg-success'
    }[estadoActual] || 'bg-secondary';

    const cliente = `${ingreso.cliente_nombre || ''} ${ingreso.cliente_apellido || ''}`.trim();
    const equipo = `${ingreso.marca || ''} ${ingreso.modelo || ''}${ingreso.color ? ` · ${ingreso.color}` : ''}`.trim();

    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <input type="hidden" id="garantiaDetalleIngresoId" value="${ingresoId}">
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="mb-0">Detalle de Garantía · Ingreso #${ingreso.numero_ingreso || ingresoId}</h2>
            <button class="btn btn-secondary" onclick="loadPage('tecnico')"><i class="fas fa-arrow-left me-2"></i>Volver</button>
        </div>

        <div class="row g-3 mb-3">
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header bg-primary text-white"><strong>Cliente</strong></div>
                    <div class="card-body">
                        <p class="mb-1"><strong>Nombre:</strong> ${cliente || 'N/A'}</p>
                        <p class="mb-1"><strong>Cédula:</strong> ${ingreso.cliente_cedula || 'N/A'}</p>
                        <p class="mb-1"><strong>Teléfono:</strong> ${ingreso.cliente_telefono || 'N/A'}</p>
                        <p class="mb-0"><strong>Dirección:</strong> ${ingreso.cliente_direccion || 'N/A'}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header bg-info text-white"><strong>Equipo y Garantía</strong></div>
                    <div class="card-body">
                        <p class="mb-1"><strong>Equipo:</strong> ${equipo || 'N/A'}</p>
                        <p class="mb-1"><strong>IMEI:</strong> ${ingreso.imei || 'N/A'}</p>
                        <p class="mb-1"><strong>Estado garantía:</strong> <span class="badge ${estadoClass}">${estadoLabel}</span></p>
                        <p class="mb-0"><strong>Motivo de ingreso a garantía:</strong> ${apertura ? limpiarTextoGarantia(apertura.contenido || '') : 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="card mb-3">
            <div class="card-header bg-light"><strong>Historial de garantía</strong></div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-sm table-hover mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Fecha</th>
                                <th>Estado</th>
                                <th>Detalle</th>
                                <th>Usuario</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${movimientos.length > 0 ? movimientos.map((mov) => {
                                const estado = getGarantiaEstadoFromContenido(mov.contenido || '');
                                const label = { abierta: 'Pendiente', en_gestion: 'En gestión', resuelta: 'Resuelta' }[estado] || 'Pendiente';
                                const badge = { abierta: 'bg-warning text-dark', en_gestion: 'bg-primary', resuelta: 'bg-success' }[estado] || 'bg-secondary';
                                return `
                                    <tr>
                                        <td><small>${new Date(mov.fecha_creacion).toLocaleString('es-ES')}</small></td>
                                        <td><span class="badge ${badge}">${label}</span></td>
                                        <td><small>${limpiarTextoGarantia(mov.contenido || '') || 'Sin detalle'}</small></td>
                                        <td><small>${mov.usuario || 'N/A'}</small></td>
                                    </tr>
                                `;
                            }).join('') : '<tr><td colspan="4" class="text-center text-muted py-3">Sin historial de garantía</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="d-flex gap-2">
            <button class="btn btn-warning" onclick="abrirModalEstadoGarantia(${ingresoId}, 'abierta')" ${estadoActual === 'abierta' ? 'disabled' : ''}>
                <i class="fas fa-rotate-left me-2"></i>Marcar pendiente
            </button>
            <button class="btn btn-success" onclick="abrirModalEstadoGarantia(${ingresoId}, 'resuelta')" ${estadoActual === 'resuelta' ? 'disabled' : ''}>
                <i class="fas fa-check me-2"></i>Marcar resuelta
            </button>
            <button class="btn btn-outline-secondary" onclick="loadPage('tecnico')">Volver al panel técnico</button>
        </div>
    `;
}

function renderIngresosPorEstado(ingresos, estado) {
    const filtrados = ingresos.filter(i => i.estado_ingreso === estado);
    const estadoTitulos = {
        pendiente: 'Pendientes por iniciar',
        en_reparacion: 'Equipos en reparación',
        reparado: 'Listos para entrega',
        no_reparable: 'Casos no reparables'
    };
    const tituloSeccion = estadoTitulos[estado] || 'Ingresos';
    
    return `
        <div class="alert alert-light border mb-3 py-2">
            <small><strong>${tituloSeccion}:</strong> usa “Mover a …” para avanzar cada caso en el flujo.</small>
        </div>
        <div class="card">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-sm table-hover mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Ingreso</th>
                                <th>Cliente</th>
                                <th>Equipo</th>
                                <th>Estado</th>
                                <th>Fecha</th>
                                <th width="420">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtrados.length > 0 ? filtrados.map(ingreso => `
                                <tr>
                                    <td><strong>#${ingreso.numero_ingreso || 'S/N'}</strong></td>
                                    <td>
                                        ${ingreso.cliente_nombre || ''} ${ingreso.cliente_apellido || ''}
                                        <br><small class="text-muted">CC: ${ingreso.cliente_cedula || 'N/A'} · ${ingreso.cliente_telefono || 'N/A'}</small>
                                    </td>
                                    <td>${ingreso.marca || ''} ${ingreso.modelo || ''}${ingreso.color ? ` · ${ingreso.color}` : ''}</td>
                                    <td><span class="badge bg-info">${ingreso.estado_ingreso || 'pendiente'}</span></td>
                                    <td><small>${(() => { const d = new Date(ingreso.fecha_ingreso); const hh = String(d.getHours()).padStart(2, '0'); const mm = String(d.getMinutes()).padStart(2, '0'); return d.toLocaleDateString('es-ES') + ' ' + hh + ':' + mm; })()}</small></td>
                                    <td>
                                        <div class="d-flex flex-wrap gap-1 align-items-center">
                                            ${getTecnicoEstadoActionButtons(ingreso.id, ingreso.estado_ingreso)}
                                            <button class="btn btn-sm btn-info" onclick="verDetallesTecnico(${ingreso.id})">
                                                Ver detalle
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="6" class="text-center text-muted py-4">No hay ingresos en este estado</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
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
                Mover a ${labels[estado] || estado}
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
                                <th width="70">Ingreso</th>
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
                                    <td><small>${new Date(ing.fecha_entrega || ing.fecha_ingreso).toLocaleDateString('es-ES')}</small></td>
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
    const response = await setIngresoEstado(ingresoId, nuevoEstado);
    
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
                <a class="nav-link ${adminActiveTab === 'tecnicos' ? 'active' : ''}" data-bs-toggle="tab" href="#tecnicos">
                    <i class="fas fa-user-cog me-2"></i> Técnicos
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
            <li class="nav-item">
                <a class="nav-link ${adminActiveTab === 'respaldo' ? 'active' : ''}" data-bs-toggle="tab" href="#respaldo">
                    <i class="fas fa-database me-2"></i> Respaldo
                </a>
            </li>
        </ul>
        
        <div class="tab-content">
            <div id="usuarios" class="tab-pane fade ${adminActiveTab === 'usuarios' ? 'show active' : ''}">
                ${await loadAdminUsuarios()}
            </div>
            <div id="tecnicos" class="tab-pane fade ${adminActiveTab === 'tecnicos' ? 'show active' : ''}">
                ${await loadAdminTecnicos()}
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
            <div id="respaldo" class="tab-pane fade ${adminActiveTab === 'respaldo' ? 'show active' : ''}">
                ${await loadAdminRespaldo()}
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
                                <label class="form-label">Cédula</label>
                                <input type="text" class="form-control form-control-sm" id="newUserCedula" placeholder="Opcional">
                            </div>
                            <div class="col-md-6 mb-2">
                                <label class="form-label">Teléfono</label>
                                <input type="tel" class="form-control form-control-sm" id="newUserTelefono" placeholder="Opcional">
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
                            <th>Cédula</th>
                            <th>Teléfono</th>
                            <th>Rol</th>
                            <th width="200">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.isArray(usuarios) ? usuarios.map(u => `
                            <tr>
                                <td>${u.usuario}</td>
                                <td>${u.nombre}</td>
                                <td>${u.cedula || '-'}</td>
                                <td>${u.telefono || '-'}</td>
                                <td><span class="badge bg-info">${u.rol}</span></td>
                                <td>
                                    <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id}, '${u.usuario}')">
                                        <i class="fas fa-trash"></i> Eliminar
                                    </button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="6" class="text-center">No hay usuarios</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function loadAdminTecnicos() {
    const usuarios = await apiCall('/admin/usuarios');
    const tecnicos = Array.isArray(usuarios) ? usuarios.filter(u => u.rol === 'tecnico') : [];

    return `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Gestión de Técnicos</h5>
                <button class="btn btn-success btn-sm" onclick="toggleTecnicoForm()">
                    <i class="fas fa-plus me-2"></i> Nuevo Técnico
                </button>
            </div>
            <div class="card-body">
                <div id="tecnicoFormContainer" class="border p-3 mb-3 bg-light" style="display: none;">
                    <h6 class="mb-3">Agregar Técnico</h6>
                    <form id="newTecnicoForm" onsubmit="submitNewTecnico(event); return false;">
                        <div class="row">
                            <div class="col-md-6 mb-2">
                                <label class="form-label">Usuario *</label>
                                <input type="text" class="form-control form-control-sm" id="newTecnicoUsuario" required>
                            </div>
                            <div class="col-md-6 mb-2">
                                <label class="form-label">Nombre Completo *</label>
                                <input type="text" class="form-control form-control-sm" id="newTecnicoNombre" required>
                            </div>
                            <div class="col-md-6 mb-2">
                                <label class="form-label">Cédula</label>
                                <input type="text" class="form-control form-control-sm" id="newTecnicoCedula" placeholder="Opcional">
                            </div>
                            <div class="col-md-6 mb-2">
                                <label class="form-label">Teléfono</label>
                                <input type="tel" class="form-control form-control-sm" id="newTecnicoTelefono" placeholder="Opcional">
                            </div>
                            <div class="col-md-6 mb-2">
                                <label class="form-label">Contraseña *</label>
                                <input type="password" class="form-control form-control-sm" id="newTecnicoPassword" required minlength="6">
                            </div>
                        </div>
                        <div class="mt-3">
                            <button type="submit" class="btn btn-primary btn-sm">
                                <i class="fas fa-save me-1"></i> Guardar Técnico
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm ms-2" onclick="toggleTecnicoForm()">
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
                            <th>Cédula</th>
                            <th>Teléfono</th>
                            <th width="180">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tecnicos.length > 0 ? tecnicos.map(t => `
                            <tr>
                                <td>${t.usuario}</td>
                                <td>${t.nombre}</td>
                                <td>${t.cedula || '-'}</td>
                                <td>${t.telefono || '-'}</td>
                                <td>
                                    <button class="btn btn-sm btn-danger" onclick="deleteTecnico(${t.id}, '${t.nombre.replace(/'/g, "\\'")}')">
                                        <i class="fas fa-trash"></i> Eliminar
                                    </button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" class="text-center">No hay técnicos registrados</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function loadAdminClientes() {
    const ingresos = await apiCall('/ingresos?limit=1000');
    
    // Extraer clientes únicos
    const clientesMap = new Map();
    if (ingresos && ingresos.data) {
        ingresos.data.forEach(ingreso => {
            const key = normalizeCedula(ingreso.cliente_cedula);
            if (!key) return;
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
                                    <th width="60">#</th>
                                    <th>Nombre</th>
                                    <th width="280">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.isArray(marcas) ? marcas.map((m, index) => `
                                    <tr>
                                        <td><small class="text-muted">${index + 1}</small></td>
                                        <td>${m.nombre}</td>
                                        <td>
                                            <button class="btn btn-sm btn-outline-secondary me-1" onclick="moveMarca(${m.id}, 'up')" title="Subir marca">
                                                <i class="fas fa-arrow-up"></i>
                                            </button>
                                            <button class="btn btn-sm btn-outline-secondary me-1" onclick="moveMarca(${m.id}, 'down')" title="Bajar marca">
                                                <i class="fas fa-arrow-down"></i>
                                            </button>
                                            <button class="btn btn-sm btn-info me-1" onclick="showModelosForMarca(${m.id}, '${m.nombre}')">
                                                <i class="fas fa-list"></i> Ver Modelos
                                            </button>
                                            <button class="btn btn-sm btn-danger" onclick="deleteMarca(${m.id}, '${m.nombre}')">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="3" class="text-center">No hay marcas</td></tr>'}
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
                            <th width="60">#</th>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th>Precio</th>
                            <th width="230">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.isArray(fallas) ? fallas.map((f, index) => `
                            <tr>
                                <td><small class="text-muted">${index + 1}</small></td>
                                <td>${f.nombre}</td>
                                <td>${f.descripcion || 'N/A'}</td>
                                <td>$${f.precio_sugerido || 0}</td>
                                <td>
                                    <button class="btn btn-sm btn-outline-secondary me-1" onclick="moveFalla(${f.id}, 'up')" title="Subir falla">
                                        <i class="fas fa-arrow-up"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary me-1" onclick="moveFalla(${f.id}, 'down')" title="Bajar falla">
                                        <i class="fas fa-arrow-down"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteFalla(${f.id}, '${f.nombre}')">
                                        <i class="fas fa-trash"></i> Eliminar
                                    </button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" class="text-center">No hay fallas</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function loadAdminRespaldo() {
    const config = await apiCall('/admin/configuracion');
    const backupsResponse = await apiCall('/admin/backups/list');
    const backupInterval = parseInt(config?.backup_interval_hours?.valor || '24', 10) || 24;
    const backups = Array.isArray(backupsResponse?.data) ? backupsResponse.data : [];

    return `
        <div class="row g-3">
            <div class="col-lg-6">
                <div class="card p-4 h-100">
                    <h5 class="mb-3">Copias de Seguridad</h5>
                    <div class="mb-3">
                        <label class="form-label">Frecuencia sugerida</label>
                        <select id="backup_interval_hours" class="form-select">
                            <option value="6" ${backupInterval === 6 ? 'selected' : ''}>Cada 6 horas</option>
                            <option value="12" ${backupInterval === 12 ? 'selected' : ''}>Cada 12 horas</option>
                            <option value="24" ${backupInterval === 24 ? 'selected' : ''}>Cada 24 horas</option>
                            <option value="48" ${backupInterval === 48 ? 'selected' : ''}>Cada 48 horas</option>
                            <option value="168" ${backupInterval === 168 ? 'selected' : ''}>Cada 7 días</option>
                        </select>
                        <small class="text-muted">Este valor se guarda como política recomendada para tu operación.</small>
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-primary" onclick="saveBackupSettings()">
                            <i class="fas fa-save me-2"></i>Guardar frecuencia
                        </button>
                        <button class="btn btn-success" onclick="createBackupNow()">
                            <i class="fas fa-hdd me-2"></i>Generar copia ahora
                        </button>
                    </div>
                </div>
            </div>

            <div class="col-lg-6">
                <div class="card p-4 h-100">
                    <h5 class="mb-3">CSV de Clientes</h5>
                    <div class="mb-3">
                        <button class="btn btn-outline-primary" onclick="exportClientesCsv()">
                            <i class="fas fa-file-export me-2"></i>Exportar clientes a CSV
                        </button>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Importar CSV de clientes</label>
                        <input type="file" id="clientesCsvFile" class="form-control" accept=".csv,text/csv">
                        <small class="text-muted">Cabeceras: cliente_cedula, cliente_nombre, cliente_apellido, cliente_telefono, cliente_direccion</small>
                    </div>
                    <div>
                        <button class="btn btn-outline-success" onclick="importClientesCsv()">
                            <i class="fas fa-file-import me-2"></i>Importar CSV
                        </button>
                    </div>
                </div>
            </div>

            <div class="col-12">
                <div class="card p-4">
                    <h5 class="mb-3">Historial de Copias</h5>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th>Archivo</th>
                                    <th>Tamaño</th>
                                    <th>Fecha</th>
                                    <th width="180">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${backups.length ? backups.map((item) => `
                                    <tr>
                                        <td>${item.filename}</td>
                                        <td>${formatBytes(item.size_bytes)}</td>
                                        <td>${item.updated_at ? new Date(item.updated_at).toLocaleString('es-CO') : 'N/A'}</td>
                                        <td>
                                            <button class="btn btn-sm btn-secondary" onclick="downloadBackupFile('${String(item.filename).replace(/'/g, "\\'")}')">
                                                <i class="fas fa-download me-1"></i>Descargar
                                            </button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4" class="text-center text-muted">Aún no hay copias generadas</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!value) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;
    let size = value;
    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index += 1;
    }
    return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

async function saveBackupSettings() {
    const value = document.getElementById('backup_interval_hours')?.value || '24';
    const response = await apiCall('/admin/configuracion', {
        method: 'PUT',
        body: JSON.stringify({
            backup_interval_hours: value
        })
    });

    if (response?.success) {
        showAlert('Frecuencia de respaldo guardada', 'success');
    } else {
        showAlert(response?.error || 'No se pudo guardar la frecuencia', 'danger');
    }
}

async function createBackupNow() {
    const response = await apiCall('/admin/backups/create', {
        method: 'POST'
    });

    if (response?.success) {
        showAlert(`Copia creada: ${response.filename}`, 'success');
        adminActiveTab = 'respaldo';
        loadPage('admin');
    } else {
        showAlert(response?.error || 'No se pudo generar la copia', 'danger');
    }
}

async function downloadBackupFile(filename) {
    if (!filename) return;

    try {
        const response = await fetch(`${API_BASE}/admin/backups/download/${encodeURIComponent(filename)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            let errorText = `Error ${response.status}`;
            try {
                const errorJson = await response.json();
                errorText = errorJson.error || errorText;
            } catch (_) {
            }
            showAlert(errorText, 'danger');
            return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        showAlert(`Error descargando backup: ${error.message}`, 'danger');
    }
}

async function exportClientesCsv() {
    try {
        const response = await fetch(`${API_BASE}/admin/csv/clientes/export`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            let errorText = `Error ${response.status}`;
            try {
                const errorJson = await response.json();
                errorText = errorJson.error || errorText;
            } catch (_) {
            }
            showAlert(errorText, 'danger');
            return;
        }

        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^";]+)"?/i);
        const filename = match ? match[1] : `clientes_${Date.now()}.csv`;

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        showAlert('CSV exportado correctamente', 'success');
    } catch (error) {
        showAlert(`Error exportando CSV: ${error.message}`, 'danger');
    }
}

async function importClientesCsv() {
    const input = document.getElementById('clientesCsvFile');
    const file = input?.files?.[0];

    if (!file) {
        showAlert('Selecciona un archivo CSV para importar', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE}/admin/csv/clientes/import`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            showAlert(payload?.error || `Error ${response.status} al importar CSV`, 'danger');
            return;
        }

        showAlert(
            `Importación completada. Actualizados: ${payload.updated_rows || 0}, sin coincidencia: ${payload.no_match_rows || 0}, omitidos: ${payload.skipped_rows || 0}`,
            'success'
        );
    } catch (error) {
        showAlert(`Error importando CSV: ${error.message}`, 'danger');
    }
}

async function loadAdminConfig() {
    const config = await apiCall('/admin/configuracion');
    const tecnicos = await apiCall('/tecnicos');
    const logoNavbarActual = config.logo_navbar_url?.valor || config.logo_url?.valor;
    const logoTicketActual = config.logo_ticket_url?.valor || config.logo_url?.valor;
    const tecnicoDefaultId = parseInt(config.tecnico_default_id?.valor || '', 10) || null;
    const paperWidth = parseInt(config.ancho_papel_mm?.valor || '58', 10) || 58;
    const paperHeight = parseInt(config.largo_papel_mm?.valor || '300', 10) || 300;
    const paperMargin = parseInt(config.margen_papel_mm?.valor || '0', 10) || 0;
    const ticketEncabezado = config.ticket_encabezado?.valor || '';
    const ticketComentarios = config.ticket_comentarios?.valor || '';
    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    
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
                    <label class="form-label">Técnico por defecto para nuevos ingresos</label>
                    <select class="form-control" id="tecnico_default_id">
                        <option value="">Sin técnico por defecto</option>
                        ${Array.isArray(tecnicos) ? tecnicos.map(t => {
                            const cedula = t.cedula ? ` · CC ${t.cedula}` : '';
                            const telefono = t.telefono ? ` · ${t.telefono}` : '';
                            const selected = tecnicoDefaultId === Number(t.id) ? 'selected' : '';
                            return `<option value="${t.id}" ${selected}>${t.nombre}${cedula}${telefono}</option>`;
                        }).join('') : ''}
                    </select>
                    <small class="text-muted">Se selecciona automáticamente en el campo “Técnico que repara” del panel de ingreso.</small>
                </div>
                
                <div class="mb-3">
                    <label class="form-label">Logo para Barra (Navbar) (PNG o JPG, máx 5MB)</label>
                    <input type="file" class="form-control" id="logo_navbar_file" accept="image/png,image/jpeg,image/jpg">
                    ${logoNavbarActual ? `<div class="mt-2"><small class="text-muted">Logo navbar actual:</small><br><img src="${logoNavbarActual}" alt="Logo navbar actual" style="max-height: 80px; max-width: 260px; border: 1px solid #ddd; padding: 4px; border-radius: 4px; margin-top: 5px;"></div>` : '<small class="text-muted d-block mt-1">No hay logo de barra cargado aún</small>'}
                </div>

                <div class="mb-3">
                    <label class="form-label">Logo para Ticket (impresión) (PNG o JPG, máx 5MB)</label>
                    <input type="file" class="form-control" id="logo_ticket_file" accept="image/png,image/jpeg,image/jpg">
                    ${logoTicketActual ? `<div class="mt-2"><small class="text-muted">Logo ticket actual:</small><br><img src="${logoTicketActual}" alt="Logo ticket actual" style="max-height: 80px; max-width: 260px; border: 1px solid #ddd; padding: 4px; border-radius: 4px; margin-top: 5px;"></div>` : '<small class="text-muted d-block mt-1">No hay logo de ticket cargado aún</small>'}
                </div>

                <hr>
                <h6 class="mb-3">Configuración de Papel (Ticket)</h6>
                <div class="row">
                    <div class="col-md-4 mb-3">
                        <label class="form-label">Ancho (mm)</label>
                        <input type="number" class="form-control" id="ancho_papel_mm" min="48" max="80" step="1" value="${paperWidth}">
                    </div>
                    <div class="col-md-4 mb-3">
                        <label class="form-label">Largo (mm)</label>
                        <input type="number" class="form-control" id="largo_papel_mm" min="120" max="1000" step="10" value="${paperHeight}">
                    </div>
                    <div class="col-md-4 mb-3">
                        <label class="form-label">Márgenes (mm)</label>
                        <input type="number" class="form-control" id="margen_papel_mm" min="0" max="5" step="1" value="${paperMargin}">
                    </div>
                </div>

                <hr>
                <h6 class="mb-3">Contenido del Ticket</h6>
                <div class="mb-3">
                    <label class="form-label">Encabezado adicional (una línea por renglón)</label>
                    <textarea class="form-control" id="ticket_encabezado" rows="3" placeholder="Ej: SERVICIO TÉCNICO ESPECIALIZADO&#10;LUN A SAB 8AM - 7PM">${escapeHtml(ticketEncabezado)}</textarea>
                </div>
                <div class="mb-3">
                    <label class="form-label">Comentarios del ticket (una línea por renglón)</label>
                    <textarea class="form-control" id="ticket_comentarios" rows="5" placeholder="Términos y condiciones del ticket">${escapeHtml(ticketComentarios)}</textarea>
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

    const logoNavbarInput = document.getElementById('logo_navbar_file');
    const logoTicketInput = document.getElementById('logo_ticket_file');

    const uploadLogo = async (file, targetLabel) => {
        if (!file.name.match(/\.(jpg|jpeg|png)$/i)) {
            showAlert(`Logo de ${targetLabel}: selecciona un archivo PNG o JPG`, 'warning');
            return false;
        }

        if (file.size > 5 * 1024 * 1024) {
            showAlert(`Logo de ${targetLabel}: el archivo es muy grande (máx 5MB)`, 'warning');
            return false;
        }

        const formData = new FormData();
        formData.append('logo', file);

        try {
            const logoResponse = await fetch(`${API_BASE}/admin/config/logo/${targetLabel}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const contentType = logoResponse.headers.get('content-type') || '';
            const rawBody = await logoResponse.text();

            let parsedBody = null;
            if (contentType.includes('application/json') || rawBody.trim().startsWith('{')) {
                try {
                    parsedBody = JSON.parse(rawBody);
                } catch (_) {
                    parsedBody = null;
                }
            }

            if (!logoResponse.ok) {
                const backendError = parsedBody?.error;
                const looksLikeHtml = rawBody.trim().startsWith('<');

                if (logoResponse.status === 404 || logoResponse.status === 405) {
                    showAlert(`Error al subir logo de ${targetLabel}: el backend no reconoce esta ruta. Reinicia backend para aplicar los cambios de logos independientes.`, 'danger');
                    return false;
                }

                if (backendError) {
                    showAlert(`Error al subir logo de ${targetLabel}: ${backendError}`, 'danger');
                    return false;
                }

                if (looksLikeHtml) {
                    showAlert(`Error al subir logo de ${targetLabel}: el backend devolvió HTML en vez de JSON (status ${logoResponse.status}).`, 'danger');
                    return false;
                }

                showAlert(`Error al subir logo de ${targetLabel}: status ${logoResponse.status}`, 'danger');
                return false;
            }

            return true;
        } catch (error) {
            showAlert(`Error de red al subir logo de ${targetLabel}: ${error.message}`, 'danger');
            return false;
        }
    };

    const hasNavbarLogo = logoNavbarInput && logoNavbarInput.files && logoNavbarInput.files.length > 0;
    const hasTicketLogo = logoTicketInput && logoTicketInput.files && logoTicketInput.files.length > 0;

    if (hasNavbarLogo || hasTicketLogo) {
        showAlert('Subiendo logos...', 'info');

        if (hasNavbarLogo) {
            const okNavbar = await uploadLogo(logoNavbarInput.files[0], 'navbar');
            if (!okNavbar) return;
        }

        if (hasTicketLogo) {
            const okTicket = await uploadLogo(logoTicketInput.files[0], 'ticket');
            if (!okTicket) return;
        }

        loadNavbarBrand();
    }
    
    // Guardar configuración del negocio
    try {
        const response = await apiCall('/admin/configuracion', {
            method: 'PUT',
            body: JSON.stringify({
                nombre_negocio: document.getElementById('nombre_negocio').value,
                telefono_negocio: document.getElementById('telefono_negocio').value,
                direccion_negocio: document.getElementById('direccion_negocio').value,
                email_negocio: document.getElementById('email_negocio').value,
                tecnico_default_id: document.getElementById('tecnico_default_id')?.value || '',
                ancho_papel_mm: document.getElementById('ancho_papel_mm')?.value || '58',
                largo_papel_mm: document.getElementById('largo_papel_mm')?.value || '300',
                margen_papel_mm: document.getElementById('margen_papel_mm')?.value || '0',
                ticket_encabezado: document.getElementById('ticket_encabezado')?.value || '',
                ticket_comentarios: document.getElementById('ticket_comentarios')?.value || ''
            })
        });
        
        if (response.success) {
            showAlert('Configuración guardada exitosamente', 'success');
            loadNavbarBrand();
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
    
    const clean = (value, fallback = 'Sin dato') => {
        if (value === null || value === undefined) return fallback;
        const text = String(value).trim();
        return text ? text : fallback;
    };
    const yesNo = (value) => value ? 'SI' : 'NO';
    const claveTexto = response.tiene_clave
        ? `${clean(response.tipo_clave, '') ? `${clean(response.tipo_clave, '')}: ` : ''}${clean(response.clave, 'Sin dato')}`
        : 'NO APLICA';
    const fechaIngreso = response.fecha_ingreso
        ? new Date(response.fecha_ingreso).toLocaleString('es-ES')
        : 'Sin dato';
    const fechaEntrega = response.fecha_entrega
        ? new Date(response.fecha_entrega).toLocaleString('es-ES')
        : 'Sin dato';
    const currentUser = getCurrentUserSafe();
    const isAdmin = currentUser?.rol === 'admin';
    const catalogacionPendiente = Boolean(response.equipo_no_lista);
    const equipoMarcaTexto = catalogacionPendiente ? 'PENDIENTE POR ADMIN' : clean(response.marca);
    const equipoModeloTexto = catalogacionPendiente ? 'PENDIENTE POR ADMIN' : clean(response.modelo);

    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="mb-0">Detalles del Ingreso: <strong>${response.numero_ingreso}</strong></h2>
            <button class="btn btn-secondary" onclick="loadPage('registros')">
                <i class="fas fa-arrow-left me-2"></i>Volver
            </button>
        </div>

        <div class="row">
            <div class="col-lg-6">
                <div class="card mb-3">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Datos del Cliente</h5>
                    </div>
                    <div class="card-body">
                        <p><strong>Nombre:</strong> ${clean(response.cliente_nombre)} ${clean(response.cliente_apellido)}</p>
                        <p><strong>Cédula:</strong> ${clean(response.cliente_cedula)}</p>
                        <p><strong>Teléfono:</strong> ${clean(response.cliente_telefono)}</p>
                        <p><strong>Dirección:</strong> ${clean(response.cliente_direccion)}</p>
                    </div>
                </div>
            </div>

            <div class="col-lg-6">
                <div class="card mb-3">
                    <div class="card-header bg-info text-white">
                        <h5 class="mb-0">Datos del Equipo</h5>
                    </div>
                    <div class="card-body">
                        <p><strong>Marca:</strong> ${equipoMarcaTexto}</p>
                        <p><strong>Modelo:</strong> ${equipoModeloTexto}</p>
                        ${catalogacionPendiente ? '<p><span class="badge bg-warning text-dark">Pendiente de catalogación por admin</span></p>' : ''}
                        <p><strong>Color:</strong> ${clean(response.color)}</p>
                        <p><strong>IMEI:</strong> ${clean(response.imei)}</p>
                        <p><strong>Clave:</strong> ${claveTexto}</p>
                        <p><strong>Estado:</strong> <span class="badge bg-${getStatusColor(response.estado_ingreso)}">${clean(response.estado_ingreso)}</span></p>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-lg-6">
                <div class="card mb-3">
                    <div class="card-header bg-secondary text-white">
                        <h5 class="mb-0">Condición del Ingreso</h5>
                    </div>
                    <div class="card-body">
                        <p><strong>Apagado:</strong> ${yesNo(response.estado_apagado)}</p>
                        <p><strong>Garantía:</strong> ${yesNo(response.garantia)}</p>
                        <p><strong>Estuche:</strong> ${yesNo(response.estuche)}</p>
                        <p><strong>Bandeja SIM:</strong> ${yesNo(response.bandeja_sim)}${response.bandeja_sim ? ` (${clean(response.color_bandeja_sim, '')})` : ''}</p>
                        <p><strong>Visor/Glass partido:</strong> ${yesNo(response.visor_partido)}</p>
                        <p><strong>Botones:</strong> ${clean(response.estado_botones_detalle)}</p>
                    </div>
                </div>
            </div>

            <div class="col-lg-6">
                <div class="card mb-3">
                    <div class="card-header bg-dark text-white">
                        <h5 class="mb-0">Estado y Fechas</h5>
                    </div>
                    <div class="card-body">
                        <p><strong>Fecha de ingreso:</strong> ${fechaIngreso}</p>
                        <p><strong>Fecha de entrega:</strong> ${response.fecha_entrega ? fechaEntrega : 'Se registra automáticamente al marcar como ENTREGADO'}</p>
                        <p><strong>Estado del pago:</strong> ${clean(response.estado_pago)}</p>
                        <p><strong>Valor total:</strong> <strong>$${Number(response.valor_total || 0).toLocaleString('es-CO')}</strong></p>
                        <p><strong>Empleado:</strong> ${clean(response.empleado)}</p>
                        <p><strong>Técnico asignado:</strong> ${clean(response.tecnico)}</p>
                        <p><strong>Datos técnico:</strong> ${response.tecnico_cedula || response.tecnico_telefono ? `${response.tecnico_cedula ? `CC ${clean(response.tecnico_cedula, '')}` : ''}${response.tecnico_cedula && response.tecnico_telefono ? ' · ' : ''}${response.tecnico_telefono ? clean(response.tecnico_telefono, '') : ''}` : 'Opcional (se registra desde Panel de Técnicos)'}</p>
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
                                    <td>${clean(f.nombre)}</td>
                                    <td>$${Number(f.valor_reparacion || 0).toLocaleString('es-CO')}</td>
                                    <td><span class="badge bg-info">${clean(f.estado_falla)}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p class="text-muted">Sin fallas registradas</p>'}
            </div>
        </div>

        <div class="card mb-4">
            <div class="card-header bg-light">
                <h5 class="mb-0">Detalle y Notas</h5>
            </div>
            <div class="card-body">
                <p><strong>Detalle del ingreso:</strong> ${clean(response.falla_general)}</p>
                <p class="mb-0"><strong>Notas adicionales:</strong> ${clean(response.notas_adicionales)}</p>
            </div>
        </div>

        <div class="d-flex gap-2">
            <button class="btn btn-primary" onclick="loadPage('registros')">
                <i class="fas fa-arrow-left me-2"></i> Volver
            </button>
            ${isAdmin && catalogacionPendiente ? `
                <button class="btn btn-warning" onclick="completarCatalogacionIngreso(${ingresoId})">
                    <i class="fas fa-tags me-2"></i> Completar marca/modelo
                </button>
            ` : ''}
            <button class="btn btn-success" onclick="printTicket(${ingresoId})">
                <i class="fas fa-print me-2"></i> Imprimir Ticket
            </button>
        </div>
    `;
}

async function completarCatalogacionIngreso(ingresoId) {
    const currentUser = getCurrentUserSafe();
    if (currentUser?.rol !== 'admin') {
        showAlert('Solo admin puede completar marca/modelo', 'danger');
        return;
    }

    try {
        const [ingreso, marcas] = await Promise.all([
            apiCall(`/ingresos/${ingresoId}`),
            apiCall('/marcas')
        ]);

        if (!ingreso || ingreso.error) {
            showAlert(ingreso?.error || 'No se pudo cargar el ingreso', 'danger');
            return;
        }

        if (!Array.isArray(marcas) || marcas.length === 0) {
            showAlert('No hay marcas disponibles para catalogar', 'danger');
            return;
        }

        const modalId = `catalogacionModal_${Date.now()}`;
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = modalId;
        modal.tabIndex = -1;
        modal.setAttribute('aria-hidden', 'true');

        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Completar marca/modelo · Ingreso ${ingreso.numero_ingreso}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Marca</label>
                            <select class="form-select" id="${modalId}_marca">
                                <option value="">Seleccione una marca</option>
                                ${marcas.map((m) => `<option value="${m.id}">${m.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="mb-1">
                            <label class="form-label">Modelo</label>
                            <select class="form-select" id="${modalId}_modelo">
                                <option value="">Seleccione marca primero</option>
                            </select>
                        </div>
                        <small class="text-muted">Solo admin puede realizar esta actualización.</small>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="${modalId}_save">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        const marcaSelect = modal.querySelector(`#${modalId}_marca`);
        const modeloSelect = modal.querySelector(`#${modalId}_modelo`);
        const saveButton = modal.querySelector(`#${modalId}_save`);

        marcaSelect.addEventListener('change', async () => {
            const marcaId = parseInt(marcaSelect.value, 10);
            if (!marcaId) {
                modeloSelect.innerHTML = '<option value="">Seleccione marca primero</option>';
                return;
            }

            const modelos = await apiCall(`/marcas/${marcaId}/modelos`);
            if (!Array.isArray(modelos) || modelos.length === 0) {
                modeloSelect.innerHTML = '<option value="">No hay modelos para esta marca</option>';
                return;
            }

            modeloSelect.innerHTML = '<option value="">Seleccione un modelo</option>' +
                modelos.map((modelo) => `<option value="${modelo.id}">${modelo.nombre}</option>`).join('');
        });

        saveButton.addEventListener('click', async () => {
            const marcaId = parseInt(marcaSelect.value, 10);
            const modeloId = parseInt(modeloSelect.value, 10);

            if (!marcaId || !modeloId) {
                showAlert('Seleccione marca y modelo', 'danger');
                return;
            }

            const response = await apiCall(`/ingresos/${ingresoId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    marca_id: marcaId,
                    modelo_id: modeloId,
                    equipo_no_lista: false
                })
            });

            if (response?.success) {
                bsModal.hide();
                showAlert('Marca y modelo actualizados correctamente', 'success');
                verDetalles(ingresoId);
                return;
            }

            showAlert(response?.error || 'No se pudo guardar la catalogación', 'danger');
        });

        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        }, { once: true });

        bsModal.show();
    } catch (error) {
        showAlert(`Error al completar catalogación: ${error.message}`, 'danger');
    }
}

async function verDetallesTecnico(ingresoId) {
    const response = await apiCall(`/ingresos/${ingresoId}`);
    
    if (!response) {
        showAlert('Error al cargar detalles', 'danger');
        return;
    }

    const ingresoBloqueado = response.estado_ingreso === 'entregado';
    
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

    const garantiaMovimientos = Array.isArray(response.notas)
        ? response.notas.filter((nota) => /\[GARANTIA\]|GARANT[ÍI]A/i.test(nota?.contenido || ''))
        : [];

    const garantiaHistorialHtml = garantiaMovimientos.length > 0
        ? `
            <div class="card mb-4">
                <div class="card-header bg-warning">
                    <h5 class="mb-0">Historial de Garantía</h5>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-sm table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Usuario</th>
                                    <th>Estado</th>
                                    <th>Detalle</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${garantiaMovimientos.map((mov) => {
                                    const estado = getGarantiaEstadoFromContenido(mov.contenido || '');
                                    const estadoLabel = {
                                        abierta: 'Pendiente',
                                        en_gestion: 'En gestión',
                                        resuelta: 'Resuelta'
                                    }[estado] || 'Pendiente';
                                    const estadoClass = {
                                        abierta: 'bg-warning text-dark',
                                        en_gestion: 'bg-primary',
                                        resuelta: 'bg-success'
                                    }[estado] || 'bg-secondary';

                                    return `
                                        <tr>
                                            <td><small>${mov.fecha_creacion ? new Date(mov.fecha_creacion).toLocaleString('es-ES') : 'N/A'}</small></td>
                                            <td><small>${mov.usuario || 'N/A'}</small></td>
                                            <td><span class="badge ${estadoClass}">${estadoLabel}</span></td>
                                            <td><small>${limpiarTextoGarantia(mov.contenido || '') || 'Sin detalle'}</small></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `
        : '';
    
    mainContent.innerHTML = `
        <input type="hidden" id="detalleIngresoId" value="${ingresoId}">
        <input type="hidden" id="detalleEstadoActual" value="${response.estado_ingreso}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 class="mb-0">Detalles del Ingreso: <strong>${response.numero_ingreso}</strong></h2>
            <button class="btn btn-secondary" onclick="loadPage('tecnico')">
                <i class="fas fa-arrow-left me-2"></i>Volver
            </button>
        </div>
        
        ${reparacionInfo}
        ${garantiaHistorialHtml}
        
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
                        ${ingresoBloqueado ? `
                            <div class="alert alert-warning">
                                Este ingreso está <strong>entregado</strong> y no permite modificaciones para proteger la trazabilidad. Solo puedes usar <strong>Ingresar por Garantía</strong>.
                            </div>
                        ` : ''}
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
                                                           ${ingresoBloqueado ? 'disabled' : ''}
                                                           onchange="updateValor(${f.id}, this.value)">
                                                </td>
                                                <td>
                                                        <select class="form-select form-select-sm" 
                                                            ${ingresoBloqueado ? 'disabled' : ''}
                                                            onchange="onDetalleFallaEstadoChange(${ingresoId}, ${f.id}, this.value)">
                                                        <option value="pendiente" ${f.estado_falla === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                                                        <option value="reparada" ${f.estado_falla === 'reparada' ? 'selected' : ''}>Reparada</option>
                                                        <option value="no_reparable" ${f.estado_falla === 'no_reparable' ? 'selected' : ''}>No Reparable</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <button class="btn btn-sm btn-danger" 
                                                            ${ingresoBloqueado ? 'disabled' : ''}
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
                        
                        <button class="btn btn-sm btn-primary" ${ingresoBloqueado ? 'disabled' : ''} onclick="addNewFalla(${ingresoId})">
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
                            <select class="form-select mb-2" ${ingresoBloqueado ? 'disabled' : ''} id="estadoSelect_${ingresoId}" onchange="onDetalleIngresoEstadoChange(${ingresoId}, this.value)">
                                <option value="pendiente" ${response.estado_ingreso === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                                <option value="en_reparacion" ${response.estado_ingreso === 'en_reparacion' ? 'selected' : ''}>En Reparación</option>
                                <option value="reparado" ${response.estado_ingreso === 'reparado' ? 'selected' : ''}>Reparado</option>
                                <option value="no_reparable" ${response.estado_ingreso === 'no_reparable' ? 'selected' : ''}>No Reparable</option>
                                <option value="entregado" ${response.estado_ingreso === 'entregado' ? 'selected' : ''}>Entregado</option>
                            </select>
                            <small class="text-muted">${ingresoBloqueado ? 'Estado bloqueado por trazabilidad. Usa garantía para reingresar.' : 'Cambia el estado desde la lista para aplicar inmediatamente.'}</small>
                            ${response.estado_ingreso === 'entregado' ? `
                                <div class="border rounded p-2 bg-light">
                                    <label class="form-label mb-1"><strong>Garantía</strong></label>
                                    <textarea class="form-control form-control-sm mb-2" id="garantiaComentario_${ingresoId}" rows="3" placeholder="Motivo de garantía (obligatorio)"></textarea>
                                    <button class="btn btn-warning btn-sm w-100" onclick="procesarGarantiaEntregado(${ingresoId})">
                                        <i class="fas fa-shield-alt me-2"></i>Ingresar por Garantía
                                    </button>
                                </div>
                            ` : ''}
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
    const logoTicketPath = negocio.logo_ticket_url || negocio.logo_url || '';
    const withCacheBuster = (url) => `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
    const logoUrl = logoTicketPath
        ? withCacheBuster(logoTicketPath.startsWith('http') ? logoTicketPath : `${window.location.origin}${logoTicketPath}`)
        : '';
    const clean = (value) => {
        if (value === null || value === undefined) return '';
        const text = String(value).trim();
        return text === 'N/A' ? '' : text;
    };
    const cleanFallaName = (value) => clean(value).replace(/\s*\(\$\s*[\d\.,]+\)\s*$/g, '').trim();
    const yesNo = (value) => value ? 'SI' : 'NO';
    const fechaSistema = clean(ingreso.fecha_ingreso)
        ? new Date(ingreso.fecha_ingreso).toLocaleString('es-CO')
        : new Date().toLocaleString('es-CO');
    const clienteNombre = `${clean(ingreso.cliente_nombre)} ${clean(ingreso.cliente_apellido)}`.trim();
    const equipoTexto = `${clean(ingreso.marca)} ${clean(ingreso.modelo)}`.trim();
    const estadoBotonesDetalle = clean(ingreso.estado_botones_detalle) || (ingreso.estado_botones ? 'REGULARES' : 'BUENOS COMPLETOS');
    const tipoClave = clean(ingreso.tipo_clave);
    const claveTexto = ingreso.tiene_clave ? `${tipoClave ? `${tipoClave}: ` : ''}${clean(ingreso.clave)}` : 'NO APLICA';
    const bandejaSimTexto = yesNo(ingreso.bandeja_sim);
    const colorBandejaSimTexto = ingreso.bandeja_sim ? clean(ingreso.color_bandeja_sim) : '';
    const valorTotal = Number(ingreso.valor_total || 0);
    const fallas = Array.isArray(ingreso.fallas) ? ingreso.fallas : [];
    const fallasTexto = fallas.length
        ? fallas.map(f => `• ${cleanFallaName(f.nombre) || 'Falla'}`).join('<br>')
        : clean(ingreso.falla_general);
    const parseMm = (value, fallback) => {
        const num = Number(value);
        return Number.isFinite(num) ? Math.round(num) : fallback;
    };
    const paperWidthMm = Math.min(80, Math.max(48, parseMm(ticketData.paper_width_mm, 58)));
    const paperHeightMm = Math.min(1000, Math.max(120, parseMm(ticketData.paper_height_mm, 300)));
    const pageMarginMm = Math.min(5, Math.max(0, parseMm(ticketData.paper_margin_mm, 0)));
    const pageContentWidthMm = Math.max(20, paperWidthMm - (pageMarginMm * 2));
    const paperMaxWidthPx = Math.round((pageContentWidthMm / 25.4) * 96);
    const baseFontSizePx = paperWidthMm >= 76 ? 14 : 13;
    const smallFontSizePx = Math.max(11, baseFontSizePx - 1);
    const headerFontSizePx = baseFontSizePx + 4;
    const numeroFontSizePx = baseFontSizePx + 8;
    const lineHeight = 1.28;
    const defaultComentarios = [
        'PANTALLAS NO TIENEN GARANTIA YA QUE ES UN CRISTAL Y DEPENDE DEL CUIDADOS DEL CLIENTE.',
        'LA CONTRASEÑA SE SOLICITA PARA HACER REVISION DE SU TELEFONO Y ASI GARANTIZAR QUE SU FUNCIONAMIENTO QUEDÓ EN OPTIMAS CONDICIONES.',
        'PASADOS 60 DIAS NO SE RESPONDE POR EQUIPOS ABANDONADOS.'
    ];
    const splitLines = (value) => String(value || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    const ticketEncabezadoLines = splitLines(negocio.ticket_encabezado);
    const ticketComentariosLines = splitLines(negocio.ticket_comentarios);
    const comentariosFinales = ticketComentariosLines.length ? ticketComentariosLines : defaultComentarios;
    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const html = `
        <html>
        <head>
            <title>Ticket de Impresión - ${ticketData.numero_ingreso}</title>
            <style>
                @page {
                    size: ${paperWidthMm}mm ${paperHeightMm}mm;
                    margin: ${pageMarginMm}mm;
                }

                html {
                    width: ${pageContentWidthMm}mm;
                    min-height: ${paperHeightMm}mm;
                    margin: 0;
                    padding: 0;
                }

                body {
                    font-family: monospace;
                    margin: 0;
                    padding: 0;
                    width: ${pageContentWidthMm}mm;
                    min-height: ${paperHeightMm}mm;
                    max-width: ${paperMaxWidthPx}px;
                    font-size: ${baseFontSizePx}px;
                    line-height: ${lineHeight};
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .ticket {
                    border: 0;
                    padding: 12px 10px;
                    text-align: left;
                }
                .header {
                    text-align: center;
                    font-weight: bold;
                    font-size: ${headerFontSizePx}px;
                    margin-bottom: 10px;
                }
                .logo {
                    text-align: center;
                    margin-bottom: 8px;
                }
                .logo img {
                    max-width: ${Math.max(150, paperMaxWidthPx - 30)}px;
                    max-height: ${paperWidthMm >= 76 ? 90 : 80}px;
                }
                .numero {
                    font-size: ${numeroFontSizePx}px;
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
                    font-size: ${smallFontSizePx}px;
                }
                    

                @media print {
                    html,
                    body {
                        width: ${paperWidthMm}mm !important;
                        min-height: ${paperHeightMm}mm !important;
                        max-width: ${paperWidthMm}mm !important;
                        margin: ${pageMarginMm}mm !important;
                        padding: 0 !important;
                    }

                    .ticket {
                        border: 0 !important;
                        margin: 0 !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="ticket">
                ${logoUrl ? `<div class="logo"><img id="ticket-logo" src="${logoUrl}" alt="Logo"></div>` : ''}
                <div class="header">${nombreNegocio}</div>
                ${telefonoNegocio ? `<div class="center small">Tel: ${telefonoNegocio}</div>` : ''}
                ${direccionNegocio ? `<div class="center small">${direccionNegocio}</div>` : ''}
                ${ticketEncabezadoLines.length ? `<div class="center small">${ticketEncabezadoLines.map((line) => escapeHtml(line)).join('<br>')}</div>` : ''}
                <div class="numero">Ingreso #${ticketData.numero_ingreso}</div>

                <div class="section-title">CLIENTE</div>
                <div><strong>${clienteNombre}</strong></div>
                <div>Cédula: ${clean(ingreso.cliente_cedula)}</div>
                <div>Tel: ${clean(ingreso.cliente_telefono)}</div>
                <div>Dir: ${clean(ingreso.cliente_direccion)}</div>
                <div>Fecha/Hora: ${fechaSistema}</div>

                <div class="section-title">EQUIPO</div>
                <div>${equipoTexto}</div>
                <div>Color: ${clean(ingreso.color)}</div>
                <div>IMEI: ${clean(ingreso.imei)}</div>
                <div>Clave: ${claveTexto}</div>
                <div>Garantía: ${yesNo(ingreso.garantia)}</div>
                <div>Apagado: ${yesNo(ingreso.estado_apagado)}</div>
                <div>Estuche: ${yesNo(ingreso.estuche)}</div>
                <div>Bandeja SIM: ${bandejaSimTexto}${colorBandejaSimTexto ? ` (${colorBandejaSimTexto})` : ''}</div>
                <div>Visor/Glass partido: ${yesNo(ingreso.visor_partido || ingreso.estado_display)}</div>
                <div>Botones: ${estadoBotonesDetalle}</div>
                <div><strong>Detalle:</strong> ${clean(ingreso.falla_general)}</div>
                <div>Valor reparación: $ ${valorTotal.toLocaleString('es-CO')}</div>
                <div class="section-title">Fallas seleccionadas</div>
                <div class="small">${fallasTexto}</div>
                <div class="section-title">Comentarios</div>
                ${comentariosFinales.map((line) => `<div class="small"><strong>${escapeHtml(line)}</strong></div>`).join('')}

                <div class="line"></div>
                <div class="line"></div>

                <div class="section-title">COPIA TÉCNICO</div>
                <div><strong>${clienteNombre}</strong></div>
                <div>Cédula: ${clean(ingreso.cliente_cedula)}</div>
                <div>Tel: ${clean(ingreso.cliente_telefono)}</div>
                <div>Dir: ${clean(ingreso.cliente_direccion)}</div>
                <div>Fecha/Hora: ${fechaSistema}</div>
                <div>Equipo: ${equipoTexto}</div>
                <div>Color: ${clean(ingreso.color)}</div>
                <div>IMEI: ${clean(ingreso.imei)}</div>
                <div>Clave: ${claveTexto}</div>
                <div>Garantía: ${yesNo(ingreso.garantia)}</div>
                <div>Apagado: ${yesNo(ingreso.estado_apagado)}</div>
                <div>Estuche: ${yesNo(ingreso.estuche)}</div>
                <div>Bandeja SIM: ${bandejaSimTexto}${colorBandejaSimTexto ? ` (${colorBandejaSimTexto})` : ''}</div>
                <div>Visor/Glass partido: ${yesNo(ingreso.visor_partido || ingreso.estado_display)}</div>
                <div>Botones: ${estadoBotonesDetalle}</div>
                <div>Valor: $ ${valorTotal.toLocaleString('es-CO')}</div>
                <div class="section-title">Detalle:</div>
                <div class="small">${clean(ingreso.falla_general)}</div>
                <div class="section-title">Fallas seleccionadas:</div>
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
    iframe.style.width = `${paperWidthMm}mm`;
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
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
        const ingreso = await apiCall(`/ingresos/${ingresoId}`);
        const ingresoFallas = Array.isArray(ingreso?.fallas) ? ingreso.fallas : [];
        const fallaIds = ingresoFallas.map(f => f.falla_id);
        
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
            await syncIngresoEstadoFromFallas(ingresoId);
            verDetallesTecnico(ingresoId);
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
            return true;
        } else {
            showAlert('Error al actualizar estado: ' + (response.error || 'desconocido'), 'danger');
            return false;
        }
    } catch (error) {
        console.error('Error en updateEstado:', error);
        showAlert('Error de conexión: ' + error.message, 'danger');
        return false;
    }
}

// Función para remover falla de un ingreso
async function removeFalla(ingresoFallaId) {
    if (!await showConfirmModal('¿Estás seguro de que deseas remover esta falla del ingreso?', {
        title: 'Confirmar remoción',
        confirmText: 'Remover'
    })) {
        return;
    }
    
    try {
        const response = await apiCall(`/ingreso-fallas/${ingresoFallaId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showAlert('Falla removida correctamente', 'success');
            const ingresoId = Number(document.getElementById('detalleIngresoId')?.value);
            if (ingresoId) {
                verDetallesTecnico(ingresoId);
            }
        } else {
            showAlert(response.error || 'Error al remover falla', 'danger');
        }
    } catch (error) {
        console.error('Error en removeFalla:', error);
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}
async function updateIngresoEstado(ingresoId) {
    const estadoSelect = document.getElementById(`estadoSelect_${ingresoId}`) || document.getElementById('estadoSelect');
    if (!estadoSelect) {
        showAlert('No se encontró selector de estado', 'warning');
        return;
    }
    const nuevoEstado = estadoSelect.value;
    await onDetalleIngresoEstadoChange(ingresoId, nuevoEstado);
}

async function onDetalleIngresoEstadoChange(ingresoId, nuevoEstado) {
    if (!nuevoEstado) {
        showAlert('Por favor selecciona un estado', 'warning');
        return;
    }

    const estadoActual = document.getElementById('detalleEstadoActual')?.value;
    if (estadoActual && estadoActual === nuevoEstado) {
        return;
    }

    if (nuevoEstado === 'entregado') {
        await cambiarEstadoIngreso(ingresoId, nuevoEstado);
        return;
    }

    const response = await setIngresoEstado(ingresoId, nuevoEstado);

    if (response && response.success) {
        showAlert('Estado actualizado correctamente', 'success');
        verDetallesTecnico(ingresoId);
    } else {
        showAlert(response?.error || 'Error al actualizar el estado', 'danger');
    }
}

async function onDetalleFallaEstadoChange(ingresoId, ingresoFallaId, nuevoEstado) {
    const actualizado = await updateEstado(ingresoFallaId, nuevoEstado);
    if (!actualizado) {
        return;
    }

    if (ingresoId) {
        await syncIngresoEstadoFromFallas(ingresoId);
        verDetallesTecnico(ingresoId);
    }
}

async function syncIngresoEstadoFromFallas(ingresoId) {
    try {
        const ingreso = await apiCall(`/ingresos/${ingresoId}`);
        const fallas = Array.isArray(ingreso?.fallas) ? ingreso.fallas : [];
        const notas = Array.isArray(ingreso?.notas) ? ingreso.notas : [];

        const ultimasNotasGarantia = notas.filter((nota) => /\[GARANTIA\]/i.test(nota.contenido || ''));
        const ultimaNotaGarantia = ultimasNotasGarantia.length > 0 ? ultimasNotasGarantia[0] : null;
        const garantiaAbierta = !!ultimaNotaGarantia && !/\[GARANTIA\]\[RESUELTA\]/i.test(ultimaNotaGarantia.contenido || '');

        if (garantiaAbierta) {
            return;
        }

        if (fallas.length === 0) {
            return;
        }

        let estadoObjetivo = 'en_reparacion';
        if (fallas.some(f => f.estado_falla === 'pendiente')) {
            estadoObjetivo = 'en_reparacion';
        } else if (fallas.some(f => f.estado_falla === 'reparada')) {
            estadoObjetivo = 'reparado';
        } else {
            estadoObjetivo = 'no_reparable';
        }

        if (ingreso.estado_ingreso !== estadoObjetivo) {
            await setIngresoEstado(ingresoId, estadoObjetivo);
        }
    } catch (error) {
        console.error('Error sincronizando estado por fallas:', error);
    }
}

async function setIngresoEstado(ingresoId, nuevoEstado) {
    const response = await apiCall(`/ingresos/${ingresoId}`, {
        method: 'PUT',
        body: JSON.stringify({ estado_ingreso: nuevoEstado })
    });

    if (response && response.success) {
        return response;
    }

    const fallbackResponse = await apiCall(`/ingresos/${ingresoId}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ estado: nuevoEstado })
    });

    if (fallbackResponse && fallbackResponse.success) {
        return fallbackResponse;
    }

    return response || fallbackResponse;
}

async function procesarGarantiaEntregado(ingresoId) {
    const comentarioEl = document.getElementById(`garantiaComentario_${ingresoId}`);
    const comentario = (comentarioEl?.value || '').trim();

    if (!comentario) {
        showAlert('Debes escribir el motivo de garantía', 'warning');
        return;
    }

    if (!await showConfirmModal('¿Deseas registrar este caso en la pestaña de garantías?', {
        title: 'Confirmar garantía',
        confirmText: 'Sí, registrar',
        confirmClass: 'btn-warning'
    })) {
        return;
    }

    try {
        const response = await apiCall(`/ingresos/${ingresoId}/garantia`, {
            method: 'POST',
            body: JSON.stringify({
                comentario
            })
        });

        if (!response || response.error || !response.success) {
            showAlert(response?.error || 'No se pudo reingresar por garantía', 'danger');
            return;
        }

        showAlert('Ingreso reabierto por garantía correctamente', 'success');
        verDetallesTecnico(ingresoId);
    } catch (error) {
        console.error('Error en procesarGarantiaEntregado:', error);
        showAlert('Error de conexión al procesar garantía', 'danger');
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
    const cedula = document.getElementById('newUserCedula').value.trim();
    const telefono = document.getElementById('newUserTelefono').value.trim();
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
                contraseña: password,
                cedula,
                telefono
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

function toggleTecnicoForm() {
    const form = document.getElementById('tecnicoFormContainer');
    if (!form) return;
    if (form.style.display === 'none') {
        form.style.display = 'block';
        document.getElementById('newTecnicoForm')?.reset();
    } else {
        form.style.display = 'none';
    }
}

async function submitNewTecnico(event) {
    event.preventDefault();

    const usuario = document.getElementById('newTecnicoUsuario').value.trim();
    const nombre = document.getElementById('newTecnicoNombre').value.trim();
    const cedula = document.getElementById('newTecnicoCedula').value.trim();
    const telefono = document.getElementById('newTecnicoTelefono').value.trim();
    const password = document.getElementById('newTecnicoPassword').value;

    if (!usuario || !nombre || !password) {
        showAlert('Usuario, nombre y contraseña son obligatorios', 'danger');
        return;
    }

    try {
        const response = await apiCall('/admin/usuarios', {
            method: 'POST',
            body: JSON.stringify({
                usuario,
                nombre,
                rol: 'tecnico',
                contraseña: password,
                cedula,
                telefono
            })
        });

        if (response && response.id) {
            showAlert(`Técnico "${nombre}" creado correctamente`, 'success');
            adminActiveTab = 'tecnicos';
            loadPage('admin');
        } else {
            showAlert(response?.error || 'Error al crear técnico', 'danger');
        }
    } catch (error) {
        showAlert('Error al conectar con el servidor: ' + error.message, 'danger');
    }
}

async function deleteTecnico(id, nombre) {
    if (!await showConfirmModal(`¿Eliminar el técnico "${nombre}"?`)) return;

    try {
        const response = await apiCall(`/admin/usuarios/${id}`, {
            method: 'DELETE'
        });

        if (response && response.success) {
            showAlert(`Técnico "${nombre}" eliminado`, 'success');
            adminActiveTab = 'tecnicos';
            loadPage('admin');
        } else {
            showAlert(response?.error || 'Error al eliminar técnico', 'danger');
        }
    } catch (error) {
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
                    <thead class="table-light">
                        <tr>
                            <th width="60">#</th>
                            <th>Modelo</th>
                            <th width="130">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${modelos.map((m, index) => `
                            <tr>
                                <td><small class="text-muted">${index + 1}</small></td>
                                <td>${m.nombre}</td>
                                <td width="130">
                                    <button class="btn btn-sm btn-outline-secondary me-1" onclick="moveModelo(${m.id}, ${marcaId}, '${marcaNombre.replace(/'/g, "\\'")}', 'up')" title="Subir modelo">
                                        <i class="fas fa-arrow-up"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary me-1" onclick="moveModelo(${m.id}, ${marcaId}, '${marcaNombre.replace(/'/g, "\\'")}', 'down')" title="Bajar modelo">
                                        <i class="fas fa-arrow-down"></i>
                                    </button>
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

async function moveMarca(id, direction) {
    try {
        const response = await apiCall(`/marcas/${id}/orden`, {
            method: 'PUT',
            body: JSON.stringify({ direction })
        });

        if (response && response.success) {
            showAlert('Orden de marca actualizado', 'success');
            adminActiveTab = 'marcas';
            loadPage('admin');
        } else {
            showAlert(response?.error || 'No se pudo reorganizar la marca', 'danger');
        }
    } catch (error) {
        showAlert('Error al reorganizar marca: ' + error.message, 'danger');
    }
}

async function moveModelo(id, marcaId, marcaNombre, direction) {
    try {
        const response = await apiCall(`/modelos/${id}/orden`, {
            method: 'PUT',
            body: JSON.stringify({ direction })
        });

        if (response && response.success) {
            showAlert('Orden de modelo actualizado', 'success');
            await showModelosForMarca(marcaId, marcaNombre);
        } else {
            showAlert(response?.error || 'No se pudo reorganizar el modelo', 'danger');
        }
    } catch (error) {
        showAlert('Error al reorganizar modelo: ' + error.message, 'danger');
    }
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

async function moveFalla(id, direction) {
    try {
        const response = await apiCall(`/fallas/${id}/orden`, {
            method: 'PUT',
            body: JSON.stringify({ direction })
        });

        if (response && response.success) {
            showAlert('Orden de falla actualizado', 'success');
            adminActiveTab = 'fallas';
            loadPage('admin');
        } else {
            showAlert(response?.error || 'No se pudo reorganizar la falla', 'danger');
        }
    } catch (error) {
        showAlert('Error al reorganizar falla: ' + error.message, 'danger');
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
        const ingresos = await apiCall('/ingresos?limit=1000');
        const cedulaNorm = normalizeCedula(cedula);
        const cliente = ingresos.data.find(i => normalizeCedula(i.cliente_cedula) === cedulaNorm);
        
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
        const response = await apiCall(`/clientes/${encodeURIComponent(cedula)}/actualizar`, {
            method: 'PUT',
            body: JSON.stringify({
                cliente_nombre: nombre,
                cliente_apellido: apellido,
                cliente_cedula: cedulaNueva,
                cliente_telefono: telefono,
                cliente_direccion: direccion
            })
        });

        if (!response?.success) {
            showAlert(response?.error || 'No se pudo actualizar el cliente', 'danger');
            return;
        }
        
        showAlert(`Cliente actualizado correctamente (${response.updated || 0} ingresos)`, 'success');
        
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
        const ingresos = await apiCall('/ingresos?limit=1000');
        const cedulaNorm = normalizeCedula(cedula);
        const clienteIngresos = ingresos.data.filter(i => normalizeCedula(i.cliente_cedula) === cedulaNorm);
        
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

function showWizardStepAlert(step, message, type = 'warning') {
    const paso = document.getElementById(`paso${step}`);
    if (!paso) {
        showAlert(message, type);
        return;
    }

    const wizardContent = paso.querySelector('.wizard-content');
    if (!wizardContent) {
        showAlert(message, type);
        return;
    }

    let alertDiv = wizardContent.querySelector('.wizard-inline-alert');
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show wizard-inline-alert mb-4`;
        alertDiv.setAttribute('role', 'alert');
        wizardContent.prepend(alertDiv);
    }

    alertDiv.className = `alert alert-${type} alert-dismissible fade show wizard-inline-alert mb-4`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
}

function clearWizardStepAlert(step) {
    const paso = document.getElementById(`paso${step}`);
    if (!paso) return;

    const alertDiv = paso.querySelector('.wizard-inline-alert');
    if (alertDiv) {
        alertDiv.remove();
    }
}

function normalizeCedula(cedula) {
    return String(cedula || '').toUpperCase().replace(/[.\-\s]/g, '');
}

function sanitizeOnlyLetters(value) {
    return String(value || '')
        .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trimStart();
}

function isOnlyLetters(value) {
    const text = String(value || '').trim();
    return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/.test(text);
}

function sanitizeOnlyDigits(value, maxLength = null) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!maxLength || maxLength <= 0) {
        return digits;
    }
    return digits.slice(0, maxLength);
}

function setupIngresoFieldRestrictions() {
    const nombreInput = document.getElementById('cliente_nombre');
    if (nombreInput) {
        nombreInput.addEventListener('input', () => {
            nombreInput.value = sanitizeOnlyLetters(nombreInput.value);
        });
    }

    const apellidoInput = document.getElementById('cliente_apellido');
    if (apellidoInput) {
        apellidoInput.addEventListener('input', () => {
            apellidoInput.value = sanitizeOnlyLetters(apellidoInput.value);
        });
    }

    const cedulaInput = document.getElementById('cliente_cedula');
    if (cedulaInput) {
        cedulaInput.addEventListener('input', () => {
            cedulaInput.value = sanitizeOnlyDigits(cedulaInput.value);
        });
    }

    const telefonoInput = document.getElementById('cliente_telefono');
    if (telefonoInput) {
        telefonoInput.addEventListener('input', () => {
            telefonoInput.value = sanitizeOnlyDigits(telefonoInput.value);
        });
    }

    const imeiInput = document.getElementById('imei');
    if (imeiInput) {
        imeiInput.addEventListener('input', () => {
            imeiInput.value = sanitizeOnlyDigits(imeiInput.value, 15);
        });
    }
}

async function nextWizardStep() {
    if (currentWizardStep === 1) {
        // Validar paso 1: Datos del cliente
        const nombre = document.getElementById('cliente_nombre')?.value.trim();
        const apellido = document.getElementById('cliente_apellido')?.value.trim();
        const cedula = sanitizeOnlyDigits(document.getElementById('cliente_cedula')?.value.trim());
        const telefono = sanitizeOnlyDigits(document.getElementById('cliente_telefono')?.value.trim());
        
        if (!nombre || !apellido || !cedula) {
            showWizardStepAlert(1, 'Por favor complete los datos requeridos del cliente (Nombre, Apellido, Cédula)', 'warning');
            return;
        }

        if (!isOnlyLetters(nombre) || !isOnlyLetters(apellido)) {
            showWizardStepAlert(1, 'Nombre y apellido solo deben contener texto', 'warning');
            return;
        }

        if (!/^\d+$/.test(cedula)) {
            showWizardStepAlert(1, 'La cédula solo debe contener números', 'warning');
            return;
        }

        if (telefono && !/^\d+$/.test(telefono)) {
            showWizardStepAlert(1, 'El teléfono solo debe contener números', 'warning');
            return;
        }

        try {
            const cedulaNormalizada = normalizeCedula(cedula);
            const cedulaInput = document.getElementById('cliente_cedula');
            const selectedFromSearch = cedulaInput?.dataset?.selectedFromSearch === 'true';
            const selectedCedulaNorm = cedulaInput?.dataset?.selectedCedulaNorm || '';
            const isSelectedExistingClient = selectedFromSearch && selectedCedulaNorm === cedulaNormalizada;
            const response = await apiCall(`/clientes/buscar?q=${encodeURIComponent(cedula)}`);

            const clientes = Array.isArray(response?.data) ? response.data : [];
            const duplicado = clientes.find((cliente) => normalizeCedula(cliente.cedula) === cedulaNormalizada);

            if (duplicado && !isSelectedExistingClient) {
                const nombreDigitado = `${nombre} ${apellido}`.trim().toUpperCase();
                const nombreExistente = `${duplicado.nombre || ''} ${duplicado.apellido || ''}`.trim().toUpperCase();
                const mismatchHint = nombreExistente && nombreExistente !== nombreDigitado
                    ? ` Ojo: registrado como "${nombreExistente}".`
                    : '';

                showWizardStepAlert(1, `Esta cédula ya existe en el sistema. Selecciona el cliente desde "Buscar Cliente Existente" o cambia la cédula.${mismatchHint}`, 'warning');
                return;
            }
        } catch (error) {
            console.error('Error validando cédula duplicada en paso 1:', error);
        }

        clearWizardStepAlert(1);
        currentWizardStep = 2;
    } else if (currentWizardStep === 2) {
        // Validar paso 2: Datos del equipo
        const marca = document.getElementById('marca_id')?.value;
        const modelo = document.getElementById('modelo_id')?.value;
        const equipoNoLista = document.getElementById('equipo_no_lista')?.checked === true;
        const imei = document.getElementById('imei')?.value.trim();
        const tecnicoId = document.getElementById('tecnico_id')?.value;
        
        const faltaCatalogo = !equipoNoLista && (!marca || !modelo);
        const imeiInvalido = !/^\d{15}$/.test(imei || '');

        if (faltaCatalogo || imeiInvalido || !tecnicoId) {
            const mensaje = equipoNoLista
                ? 'Complete IMEI (15 dígitos) y técnico asignado'
                : 'Complete Marca, Modelo, IMEI (15 dígitos) y técnico asignado';
            showWizardStepAlert(2, mensaje, 'warning');
            return;
        }
        clearWizardStepAlert(2);
        currentWizardStep = 3;
    } else if (currentWizardStep === 3) {
        clearWizardStepAlert(3);
        currentWizardStep = 4;
    } else if (currentWizardStep === 4) {
        const fallasSeleccionadas = document.querySelectorAll('.falla-checkbox:checked').length;
        if (!fallasSeleccionadas) {
            showWizardStepAlert(4, 'Debe seleccionar al menos una falla', 'warning');
            return;
        }
        clearWizardStepAlert(4);
        currentWizardStep = 5;
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
        const paso5 = document.getElementById('paso5');
        
        if (!paso1 || !paso2 || !paso3 || !paso4 || !paso5) {
            console.error('Paso elements not found:', {paso1, paso2, paso3, paso4, paso5});
            return;
        }
        
        paso1.style.display = 'none';
        paso2.style.display = 'none';
        paso3.style.display = 'none';
        paso4.style.display = 'none';
        paso5.style.display = 'none';
        
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

function toggleClave() {
    const tieneClaveSelect = document.getElementById('tiene_clave');
    const claveDiv = document.getElementById('claveDiv');
    if (!tieneClaveSelect || !claveDiv) return;
    claveDiv.style.display = tieneClaveSelect.value === 'SI' ? 'block' : 'none';

    if (tieneClaveSelect.value !== 'SI') {
        const claveInput = document.getElementById('clave');
        if (claveInput) {
            claveInput.value = '';
        }
    }

    applyClaveInputRules();
}

function applyClaveInputRules() {
    const tieneClaveSelect = document.getElementById('tiene_clave');
    const tipoClaveSelect = document.getElementById('tipo_clave');
    const claveInput = document.getElementById('clave');

    if (!tieneClaveSelect || !tipoClaveSelect || !claveInput) {
        return;
    }

    const esNumerica = tieneClaveSelect.value === 'SI' && tipoClaveSelect.value === 'NUMERICA';

    if (esNumerica) {
        claveInput.value = String(claveInput.value || '').replace(/\D/g, '');
        claveInput.setAttribute('inputmode', 'numeric');
        claveInput.setAttribute('pattern', '[0-9]*');
        claveInput.setAttribute('placeholder', 'Ingrese solo números');
        return;
    }

    claveInput.removeAttribute('pattern');
    claveInput.setAttribute('inputmode', 'text');
    claveInput.setAttribute('placeholder', 'Ingrese la clave');
}

function handleClaveInputChange(event) {
    const tipoClaveSelect = document.getElementById('tipo_clave');
    const tieneClaveSelect = document.getElementById('tiene_clave');
    if (!tipoClaveSelect || !tieneClaveSelect) {
        return;
    }

    if (tieneClaveSelect.value === 'SI' && tipoClaveSelect.value === 'NUMERICA') {
        event.target.value = String(event.target.value || '').replace(/\D/g, '');
    }
}

function toggleBandejaSimColor() {
    const bandejaSelect = document.getElementById('bandeja_sim_select');
    const colorDiv = document.getElementById('colorBandejaDiv');
    const colorSelect = document.getElementById('color_bandeja_sim');
    if (!bandejaSelect || !colorDiv) return;

    const mostrarColor = bandejaSelect.value === 'SI';
    colorDiv.style.display = mostrarColor ? 'block' : 'none';

    if (!mostrarColor && colorSelect) {
        colorSelect.value = '';
    }
}

function syncValorReparacionFromFallas() {
    const valorInput = document.getElementById('valor_reparacion');
    if (!valorInput) return;

    const totalSugerido = Array.from(document.querySelectorAll('.falla-checkbox:checked'))
        .reduce((sum, cb) => sum + Number(cb.dataset.precio || 0), 0);

    valorInput.value = totalSugerido > 0 ? formatNumberCO(Math.round(totalSugerido)) : '';
}

function parseMonetaryValue(value) {
    const digitsOnly = String(value || '').replace(/\D/g, '');
    return digitsOnly ? parseInt(digitsOnly, 10) : 0;
}

function formatNumberCO(value) {
    return Number(value || 0).toLocaleString('es-CO');
}

function updateFallasSelectedCount() {
    const countEl = document.getElementById('fallasSelectedCount');
    const totalEl = document.getElementById('fallasSelectedTotal');
    if (!countEl || !totalEl) return;

    const selected = Array.from(document.querySelectorAll('.falla-checkbox:checked'));
    const selectedCount = selected.length;
    const totalSugerido = selected.reduce((sum, cb) => sum + Number(cb.dataset.precio || 0), 0);
    const texto = selectedCount === 1 ? '1 seleccionada' : `${selectedCount} seleccionadas`;
    countEl.textContent = texto;
    totalEl.textContent = `$ ${Number(totalSugerido || 0).toLocaleString('es-CO')}`;
}

function filterFallasList() {
    const searchInput = document.getElementById('fallasSearch');
    const query = (searchInput?.value || '').trim().toLowerCase();
    const items = document.querySelectorAll('#fallasCheckbox .falla-item');

    items.forEach(item => {
        const name = item.getAttribute('data-name') || '';
        item.style.display = name.includes(query) ? '' : 'none';
    });
}

function openFallasDropdown() {
    const dropdown = document.getElementById('fallasDropdown');
    const toggle = document.getElementById('fallasDropdownToggle');
    if (!dropdown) return;
    dropdown.classList.add('show');
    if (toggle) {
        toggle.classList.add('active');
        toggle.innerHTML = '<i class="fas fa-chevron-up"></i>';
    }
}

function closeFallasDropdown() {
    const dropdown = document.getElementById('fallasDropdown');
    const toggle = document.getElementById('fallasDropdownToggle');
    if (!dropdown) return;
    dropdown.classList.remove('show');
    if (toggle) {
        toggle.classList.remove('active');
        toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
    }
}

function toggleFallasDropdown() {
    const dropdown = document.getElementById('fallasDropdown');
    if (!dropdown) return;

    if (dropdown.classList.contains('show')) {
        closeFallasDropdown();
    } else {
        openFallasDropdown();
    }
}

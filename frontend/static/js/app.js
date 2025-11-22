// Aplicación principal
let currentPage = null;

function initApp() {
    console.log('initApp() called');
    console.log('currentUser:', currentUser);
    
    if (currentUser) {
        console.log('User logged in, building menu and loading dashboard');
        buildMenu();
        loadPage('dashboard');
    } else {
        console.log('No user found');
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
            { icon: 'fa-cogs', label: 'Panel Técnico', page: 'tecnico' },
            { icon: 'fa-list', label: 'Registros', page: 'registros' }
        ]
    };
    
    const items = menuItems[currentUser.rol] || [];
    
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
                // Luego de renderizar, agregamos los event listeners
                setTimeout(() => {
                    const buscarInput = document.getElementById('buscar_cliente');
                    if (buscarInput) {
                        buscarInput.addEventListener('keyup', buscarClientes);
                        buscarInput.addEventListener('input', buscarClientes);
                    }
                }, 100);
                break;
            case 'registros':
                console.log('Calling loadRegistros...');
                content = await loadRegistros();
                console.log('loadRegistros returned, content length:', content.length);
                break;
            case 'tecnico':
                if (currentUser.rol !== 'tecnico' && currentUser.rol !== 'admin') {
                    content = '<div class="alert alert-danger">Acceso denegado</div>';
                } else {
                    content = await loadTecnicoPanel();
                }
                break;
            case 'admin':
                if (currentUser.rol !== 'admin') {
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
        if (page === 'ingreso') {
            const form = document.getElementById('ingresoForm');
            if (form) {
                form.addEventListener('submit', submitIngreso);
            }
            
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
            
            // Agregar listener al cambio de marca
            const marcaSelect = document.getElementById('marca_id');
            if (marcaSelect) {
                marcaSelect.addEventListener('change', loadModelosByMarca);
            }
        }
    } catch (error) {
        console.error('Error adding event listeners:', error);
    }
}

async function loadDashboard() {
    // Obtener estadísticas básicas
    const response = await apiCall('/ingresos?limit=5');
    
    if (!response.data) {
        return '<div class="alert alert-danger">Error al cargar datos</div>';
    }
    
    return `
        <h2 class="mb-4">Dashboard</h2>
        
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card bg-primary text-white">
                    <div class="card-body">
                        <h5 class="card-title">Total de Ingresos</h5>
                        <p class="card-text display-4">${response.total}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-warning text-dark">
                    <div class="card-body">
                        <h5 class="card-title">Pendientes</h5>
                        <p class="card-text display-4">${response.data.filter(i => i.estado_ingreso === 'pendiente').length}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-success text-white">
                    <div class="card-body">
                        <h5 class="card-title">Reparados</h5>
                        <p class="card-text display-4">${response.data.filter(i => i.estado_ingreso === 'reparado').length}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-info text-white">
                    <div class="card-body">
                        <h5 class="card-title">Entregas Hoy</h5>
                        <p class="card-text display-4">0</p>
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
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(ingreso => `
                                <tr>
                                    <td><strong>${ingreso.numero_ingreso}</strong></td>
                                    <td>${ingreso.cliente_nombre} ${ingreso.cliente_apellido}</td>
                                    <td>${ingreso.marca || 'N/A'}</td>
                                    <td>
                                        <span class="badge bg-${getStatusColor(ingreso.estado_ingreso)}">
                                            ${ingreso.estado_ingreso}
                                        </span>
                                    </td>
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

async function loadIngresoForm() {
    const marcas = await apiCall('/marcas');
    const fallas = await apiCall('/fallas');
    
    if (!marcas || !fallas) {
        return '<div class="alert alert-danger">Error al cargar datos</div>';
    }
    
    return `
        <h2 class="mb-4">Nuevo Ingreso Técnico</h2>
        
        <div class="card p-4 mb-4 bg-light">
            <h5 class="mb-3">Buscar Cliente Existente</h5>
            <div class="mb-3">
                <input type="text" class="form-control" id="buscar_cliente" placeholder="Buscar por nombre, cédula o teléfono...">
                <div id="resultadosBusqueda" class="list-group mt-2" style="display: none; max-height: 300px; overflow-y: auto;"></div>
            </div>
            <small class="text-muted">O ingrese los datos manualmente a continuación</small>
        </div>
        
        <form id="ingresoForm" class="card p-4">
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Nombre del Cliente *</label>
                    <input type="text" class="form-control" id="cliente_nombre" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Apellido *</label>
                    <input type="text" class="form-control" id="cliente_apellido" required>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Cédula *</label>
                    <input type="text" class="form-control" id="cliente_cedula" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Teléfono</label>
                    <input type="tel" class="form-control" id="cliente_telefono">
                </div>
            </div>
            
            <div class="mb-3">
                <label class="form-label">Dirección</label>
                <input type="text" class="form-control" id="cliente_direccion">
            </div>
            
            <hr class="my-4">
            
            <h5 class="mb-3">Datos del Celular</h5>
            
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Marca *</label>
                    <select class="form-control" id="marca_id" required onchange="loadModelosByMarca()">
                        <option value="">Seleccione una marca</option>
                        ${Array.isArray(marcas) ? marcas.map(m => 
                            `<option value="${m.id}">${m.nombre}</option>`
                        ).join('') : ''}
                    </select>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Modelo *</label>
                    <select class="form-control" id="modelo_id" required>
                        <option value="">Seleccione marca primero</option>
                    </select>
                </div>
            </div>
            
            <div class="mb-3">
                <label class="form-label">Color</label>
                <select class="form-control" id="color">
                    <option value="">Seleccione un color</option>
                    <option value="Negro">Negro</option>
                    <option value="Blanco">Blanco</option>
                    <option value="Plateado">Plateado</option>
                    <option value="Dorado">Dorado</option>
                    <option value="Rojo">Rojo</option>
                    <option value="Azul">Azul</option>
                    <option value="Verde">Verde</option>
                    <option value="Púrpura">Púrpura</option>
                    <option value="Rosa">Rosa</option>
                    <option value="Naranja">Naranja</option>
                    <option value="Gris">Gris</option>
                    <option value="Otro">Otro</option>
                </select>
            </div>
            
            <hr class="my-4">
            
            <h5 class="mb-3">Estado del Equipo</h5>
            
            <div class="row">
                <div class="col-md-6 mb-3">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="estado_display">
                        <label class="form-check-label" for="estado_display">
                            Display Malo
                        </label>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="estado_tactil">
                        <label class="form-check-label" for="estado_tactil">
                            Táctil Malo
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-6 mb-3">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="estado_botones">
                        <label class="form-check-label" for="estado_botones">
                            Botones Dañados
                        </label>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="estado_apagado">
                        <label class="form-check-label" for="estado_apagado">
                            Apagado / No Enciende
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="row mb-3">
                <div class="col-md-6">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="tiene_clave" 
                               onchange="toggleClave()">
                        <label class="form-check-label" for="tiene_clave">
                            Tiene Clave
                        </label>
                    </div>
                </div>
                <div class="col-md-6" id="claveDiv" style="display: none;">
                    <input type="password" class="form-control" id="clave" placeholder="Ingrese la clave">
                </div>
            </div>
            
            <hr class="my-4">
            
            <h5 class="mb-3">Fallas Iniciales</h5>
            
            <div class="mb-3" id="fallasCheckbox">
                ${Array.isArray(fallas) ? fallas.map(f => 
                    `<div class="form-check">
                        <input class="form-check-input falla-checkbox" type="checkbox" 
                               value="${f.id}" id="falla_${f.id}">
                        <label class="form-check-label" for="falla_${f.id}">
                            ${f.nombre}
                        </label>
                    </div>`
                ).join('') : ''}
            </div>
            
            <hr class="my-4">
            
            <h5 class="mb-3">Falla General y Notas</h5>
            
            <div class="mb-3">
                <label class="form-label">Falla General *</label>
                <textarea class="form-control" id="falla_general" rows="3" 
                          placeholder="Descripción de la falla reportada" required></textarea>
            </div>
            
            <div class="mb-3">
                <label class="form-label">Notas Adicionales</label>
                <textarea class="form-control" id="notas_adicionales" rows="2" 
                          placeholder="Notas internas o adicionales"></textarea>
            </div>
            
            <button type="submit" class="btn btn-primary btn-lg w-100">
                <i class="fas fa-save me-2"></i> Crear Ingreso
            </button>
        </form>
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
        
        resultados.innerHTML = response.data.map(cliente => `
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
    console.log('DEBUG: submitIngreso iniciado');
    
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
        fallas_iniciales: fallasSeleccionadas
    };
    
    // Validar campos requeridos
    if (!datos.marca_id || !datos.modelo_id || !datos.cliente_nombre || 
        !datos.cliente_apellido || !datos.cliente_cedula) {
        showAlert('Por favor complete todos los campos requeridos (Marca, Modelo, Nombre, Apellido, Cédula)', 'danger');
        return;
    }
    
    console.log('DEBUG: Validación pasada, mostrando loading...');
    showLoading(true);
    
    try {
        console.log('DEBUG: Enviando ingreso al servidor...');
        const response = await apiCall('/ingresos', {
            method: 'POST',
            body: JSON.stringify(datos)
        });
        
        console.log('DEBUG: Respuesta recibida, ocultando loading...', response);
        showLoading(false);
        console.log('DEBUG: Loading ocultado');
        
        if (!response) {
            console.log('DEBUG: Response es null/undefined');
            showAlert('Error de conexión con el servidor', 'danger');
            return;
        }
        
        if (response.error) {
            console.log('DEBUG: Response tiene error:', response.error);
            showAlert('Error: ' + response.error, 'danger');
            return;
        }
        
        if (response.numero_ingreso || response.id) {
            const numeroIngreso = response.numero_ingreso || response.id;
            console.log('DEBUG: Ingreso creado, número:', numeroIngreso);
            showAlert(`¡Ingreso creado exitosamente! Número: ${numeroIngreso}`, 'success');
            document.getElementById('ingresoForm').reset();
            
            // Esperar a que desaparezca la alerta y luego ir a registros
            console.log('DEBUG: Esperando 1.5 segundos antes de cargar registros...');
            setTimeout(() => {
                console.log('DEBUG: Llamando a loadPage(registros)...');
                loadPage('registros');
            }, 1500);
        } else {
            console.log('DEBUG: Respuesta sin número de ingreso:', response);
            showAlert('Error: Respuesta inesperada del servidor', 'danger');
        }
    } catch (error) {
        console.error('DEBUG: Error en submitIngreso:', error);
        showLoading(false);
        showAlert('Error al crear ingreso: ' + error.message, 'danger');
    }
}

async function loadRegistros() {
    const page = 1;
    const response = await apiCall(`/ingresos?page=${page}&limit=20`);
    
    console.log('DEBUG: Respuesta loadRegistros:', response);
    
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
                                    ${currentUser && currentUser.rol === 'admin' ? `
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
            <div id="entregados" class="tab-pane fade">
                ${renderIngresosPorEstado(ingresos, 'entregado')}
            </div>
        </div>
    `;
}

function renderIngresosPorEstado(ingresos, estado) {
    const filtrados = ingresos.filter(i => i.estado_ingreso === estado);
    
    return `
        <div class="row">
            ${filtrados.length > 0 ? filtrados.map(ingreso => `
                <div class="col-md-6 mb-4">
                    <div class="card">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0">${ingreso.numero_ingreso}</h5>
                        </div>
                        <div class="card-body">
                            <p><strong>Cliente:</strong> ${ingreso.cliente_nombre} ${ingreso.cliente_apellido}</p>
                            <p><strong>Teléfono:</strong> ${ingreso.cliente_telefono || 'N/A'}</p>
                            <p><strong>Equipo:</strong> ${ingreso.marca} ${ingreso.modelo}</p>
                            <p><strong>Color:</strong> ${ingreso.color || 'N/A'}</p>
                            <p><strong>Falla:</strong> ${ingreso.falla_general || 'N/A'}</p>
                            <p><strong>Fecha Ingreso:</strong> ${new Date(ingreso.fecha_ingreso).toLocaleDateString()}</p>
                            <div class="mt-3">
                                <label class="form-label">Cambiar Estado:</label>
                                <select class="form-select form-select-sm" onchange="cambiarEstadoIngreso(${ingreso.id}, this.value)">
                                    <option value="${ingreso.estado_ingreso}" selected>-- Seleccione --</option>
                                    <option value="pendiente">Pendiente</option>
                                    <option value="en_reparacion">En Reparación</option>
                                    <option value="reparado">Reparado</option>
                                    <option value="entregado">Entregado</option>
                                    <option value="cancelado">Cancelado</option>
                                </select>
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

async function cambiarEstadoIngreso(ingresoId, nuevoEstado) {
    if (!nuevoEstado || nuevoEstado === '-- Seleccione --') return;
    
    const data = { estado_ingreso: nuevoEstado };
    const response = await apiCall(`/ingresos/${ingresoId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    
    if (response && response.success) {
        alert('Estado actualizado correctamente');
        loadPage('tecnico'); // Recargar el panel
    } else {
        alert('Error al actualizar el estado');
    }
}

async function loadAdminPanel() {
    return `
        <h2 class="mb-4">Panel de Administración</h2>
        
        <ul class="nav nav-tabs mb-4" role="tablist">
            <li class="nav-item">
                <a class="nav-link active" data-bs-toggle="tab" href="#usuarios">
                    <i class="fas fa-users me-2"></i> Usuarios
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="tab" href="#clientes">
                    <i class="fas fa-address-book me-2"></i> Base de Clientes
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="tab" href="#marcas">
                    <i class="fas fa-mobile-alt me-2"></i> Marcas y Modelos
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="tab" href="#fallas">
                    <i class="fas fa-tools me-2"></i> Fallas
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" data-bs-toggle="tab" href="#config">
                    <i class="fas fa-cog me-2"></i> Configuración
                </a>
            </li>
        </ul>
        
        <div class="tab-content">
            <div id="usuarios" class="tab-pane fade show active">
                ${await loadAdminUsuarios()}
            </div>
            <div id="clientes" class="tab-pane fade">
                ${await loadAdminClientes()}
            </div>
            <div id="marcas" class="tab-pane fade">
                ${await loadAdminMarcas()}
            </div>
            <div id="fallas" class="tab-pane fade">
                ${await loadAdminFallas()}
            </div>
            <div id="config" class="tab-pane fade">
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
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" id="email_negocio"
                           value="${config.email_negocio?.valor || ''}">
                </div>
                
                <div class="mb-3">
                    <label class="form-label">Logo (PNG o JPG)</label>
                    <input type="file" class="form-control" id="logo_file" accept=".png,.jpg,.jpeg">
                    ${config.logo_url?.valor ? `<small>Logo actual: ${config.logo_url.valor}</small>` : ''}
                </div>
                
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save me-2"></i> Guardar Configuración
                </button>
            </form>
        </div>
        
        <script>
            document.getElementById('configForm').addEventListener('submit', submitConfig);
        </script>
    `;
}

async function submitConfig(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('nombre_negocio', document.getElementById('nombre_negocio').value);
    formData.append('telefono_negocio', document.getElementById('telefono_negocio').value);
    formData.append('email_negocio', document.getElementById('email_negocio').value);
    
    if (document.getElementById('logo_file').files.length > 0) {
        formData.append('logo', document.getElementById('logo_file').files[0]);
        
        const logoResponse = await fetch(`${API_BASE}/admin/config/logo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!logoResponse.ok) {
            showAlert('Error al subir logo', 'danger');
            return;
        }
    }
    
    const response = await apiCall('/admin/configuracion', {
        method: 'PUT',
        body: JSON.stringify({
            nombre_negocio: document.getElementById('nombre_negocio').value,
            telefono_negocio: document.getElementById('telefono_negocio').value,
            email_negocio: document.getElementById('email_negocio').value
        })
    });
    
    if (response.success) {
        showAlert('Configuración guardada exitosamente', 'success');
    } else {
        showAlert(response.error || 'Error al guardar configuración', 'danger');
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
    mainContent.innerHTML = `
        <h2 class="mb-4">Detalles del Ingreso: ${response.numero_ingreso}</h2>
        
        <div class="card mb-4">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">Información General</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Cliente:</strong> ${response.cliente_nombre} ${response.cliente_apellido}</p>
                        <p><strong>Equipo:</strong> ${response.marca} ${response.modelo}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Estado:</strong> <span class="badge bg-warning">${response.estado_ingreso}</span></p>
                        <p><strong>Valor Total:</strong> <strong>$${response.valor_total || 0}</strong></p>
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
                            <select class="form-select mb-2" id="estadoSelect" value="${response.estado_ingreso}">
                                <option value="pendiente" ${response.estado_ingreso === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                                <option value="en_reparacion" ${response.estado_ingreso === 'en_reparacion' ? 'selected' : ''}>En Reparación</option>
                                <option value="reparado" ${response.estado_ingreso === 'reparado' ? 'selected' : ''}>Reparado</option>
                                <option value="entregado" ${response.estado_ingreso === 'entregado' ? 'selected' : ''}>Entregado</option>
                            </select>
                            <button class="btn btn-warning" onclick="updateIngresoEstado(${ingresoId})">
                                Actualizar Estado
                            </button>
                            <button class="btn btn-success" onclick="printTicket(${ingresoId})">
                                <i class="fas fa-print me-2"></i> Imprimir Ticket
                            </button>
                            <button class="btn btn-secondary" onclick="loadPage('tecnico')">
                                Volver
                            </button>
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

async function printTicket(ingresoId) {
    showAlert('Función de impresión en desarrollo', 'info');
}

// Función para eliminar ingreso (solo admin)
async function deleteIngreso(ingresoId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este ingreso? Esta acción no se puede deshacer.')) {
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
    if (!confirm('¿Estás seguro de que deseas eliminar esta marca?')) {
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
    if (!confirm('¿Estás seguro de que deseas eliminar este modelo?')) {
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
function showNewFallaModal() { showAlert('Función en desarrollo', 'info'); }
function editFalla(id) { showAlert('Función en desarrollo', 'info'); }
function deleteFalla(id) { showAlert('Función en desarrollo', 'info'); }
function addNewFalla(id) { showAlert('Función en desarrollo', 'info'); }
function updateValor(id, valor) { showAlert('Función en desarrollo', 'info'); }
function updateEstado(id, estado) { showAlert('Función en desarrollo', 'info'); }
function removeFalla(id) { showAlert('Función en desarrollo', 'info'); }
function updateIngresoEstado(id) { showAlert('Función en desarrollo', 'info'); }

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
    if (!confirm(`¿Eliminar el usuario "${nombre}"?`)) return;
    
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
    if (!confirm(`¿Eliminar la marca "${nombre}"?`)) return;
    
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
    if (!confirm(`¿Eliminar el modelo "${nombre}"?`)) return;
    
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
    if (!confirm(`¿Eliminar la falla "${nombre}"?`)) return;
    
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

// Función para editar usuario
async function editUser(userId) {
    showAlert('Función en desarrollo', 'info');
}

// Función para eliminar usuario
async function deleteUser(userId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
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

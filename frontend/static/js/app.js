// Aplicación principal
let currentPage = null;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    
    if (currentUser) {
        buildMenu();
        loadPage('dashboard');
    }
});

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
    
    if (!mainContent) return;
    
    mainContent.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></div>';
    
    let content = '';
    
    try {
        switch (page) {
            case 'dashboard':
                content = await loadDashboard();
                break;
            case 'ingreso':
                content = await loadIngresoForm();
                break;
            case 'registros':
                content = await loadRegistros();
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
        content = `<div class="alert alert-danger">Error al cargar la página: ${error.message}</div>`;
    }
    
    mainContent.innerHTML = content;
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
                <input type="text" class="form-control" id="color">
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
        
        <script>
            document.getElementById('ingresoForm').addEventListener('submit', submitIngreso);
            
            function toggleClave() {
                const div = document.getElementById('claveDiv');
                div.style.display = document.getElementById('tiene_clave').checked ? 'block' : 'none';
            }
        </script>
    `;
}

async function loadModelosByMarca() {
    const marcaId = document.getElementById('marca_id').value;
    if (!marcaId) return;
    
    const modelos = await apiCall(`/marcas/${marcaId}/modelos`);
    const select = document.getElementById('modelo_id');
    
    select.innerHTML = '<option value="">Seleccione un modelo</option>' +
        (Array.isArray(modelos) ? modelos.map(m => 
            `<option value="${m.id}">${m.nombre}</option>`
        ).join('') : '');
}

async function submitIngreso(e) {
    e.preventDefault();
    
    const fallasSeleccionadas = Array.from(document.querySelectorAll('.falla-checkbox:checked'))
        .map(cb => parseInt(cb.value));
    
    const datos = {
        marca_id: parseInt(document.getElementById('marca_id').value),
        modelo_id: parseInt(document.getElementById('modelo_id').value),
        cliente_nombre: document.getElementById('cliente_nombre').value,
        cliente_apellido: document.getElementById('cliente_apellido').value,
        cliente_cedula: document.getElementById('cliente_cedula').value,
        cliente_telefono: document.getElementById('cliente_telefono').value,
        cliente_direccion: document.getElementById('cliente_direccion').value,
        color: document.getElementById('color').value,
        falla_general: document.getElementById('falla_general').value,
        notas_adicionales: document.getElementById('notas_adicionales').value,
        estado_display: document.getElementById('estado_display').checked,
        estado_tactil: document.getElementById('estado_tactil').checked,
        estado_botones: document.getElementById('estado_botones').checked,
        estado_apagado: document.getElementById('estado_apagado').checked,
        tiene_clave: document.getElementById('tiene_clave').checked,
        clave: document.getElementById('clave').value,
        fallas_iniciales: fallasSeleccionadas
    };
    
    showLoading(true);
    
    const response = await apiCall('/ingresos', {
        method: 'POST',
        body: JSON.stringify(datos)
    });
    
    showLoading(false);
    
    if (response.numero_ingreso) {
        showAlert(`¡Ingreso creado exitosamente! Número: ${response.numero_ingreso}`, 'success');
        document.getElementById('ingresoForm').reset();
        setTimeout(() => loadPage('registros'), 2000);
    } else {
        showAlert(response.error || 'Error al crear ingreso', 'danger');
    }
}

async function loadRegistros() {
    const page = 1;
    const response = await apiCall(`/ingresos?page=${page}&limit=20`);
    
    if (!response.data) {
        return '<div class="alert alert-danger">Error al cargar registros</div>';
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
                            <th>Fecha</th>
                            <th>Marca</th>
                            <th>Estado</th>
                            <th>Valor</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${response.data.map(ingreso => `
                            <tr>
                                <td><strong>${ingreso.numero_ingreso}</strong></td>
                                <td>${ingreso.cliente_nombre} ${ingreso.cliente_apellido}</td>
                                <td>${new Date(ingreso.fecha_ingreso).toLocaleDateString()}</td>
                                <td>${ingreso.marca || 'N/A'}</td>
                                <td>
                                    <span class="badge bg-${getStatusColor(ingreso.estado_ingreso)}">
                                        ${ingreso.estado_ingreso}
                                    </span>
                                </td>
                                <td>$${ingreso.valor_total ? ingreso.valor_total.toLocaleString() : '0'}</td>
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
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="card-footer">
                <small>Total: ${response.total} ingresos</small>
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
    const response = await apiCall('/ingresos/pendientes');
    
    if (!Array.isArray(response)) {
        return '<div class="alert alert-danger">Error al cargar panel técnico</div>';
    }
    
    return `
        <h2 class="mb-4">Panel Técnico</h2>
        
        <div class="row mb-4">
            <div class="col-md-12">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> Tienes 
                    <strong>${response.length}</strong> ingresos pendientes
                </div>
            </div>
        </div>
        
        <div class="row">
            ${response.map(ingreso => `
                <div class="col-md-6 mb-4">
                    <div class="card">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0">${ingreso.numero_ingreso}</h5>
                        </div>
                        <div class="card-body">
                            <p><strong>Cliente:</strong> ${ingreso.cliente_nombre} ${ingreso.cliente_apellido}</p>
                            <p><strong>Equipo:</strong> ${ingreso.marca} ${ingreso.modelo}</p>
                            <p><strong>Fecha:</strong> ${new Date(ingreso.fecha_ingreso).toLocaleDateString()}</p>
                            <button class="btn btn-primary w-100" onclick="verDetallesTecnico(${ingreso.id})">
                                Ver Detalles
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
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
                <a class="nav-link" data-bs-toggle="tab" href="#marcas">
                    <i class="fas fa-mobile-alt me-2"></i> Marcas
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

async function loadAdminMarcas() {
    const marcas = await apiCall('/marcas');
    
    return `
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
                            <div class="col-md-8 mb-2">
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
                                    <button class="btn btn-sm btn-danger" onclick="deleteMarca(${m.id}, '${m.nombre}')">
                                        <i class="fas fa-trash"></i> Eliminar
                                    </button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="2" class="text-center">No hay marcas</td></tr>'}
                    </tbody>
                </table>
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

// Configuración global
const API_BASE = '/api';
let currentUser = null;
let token = null;

// ===== MANEJO DE AUTENTICACIÓN =====
function initAuth() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Verificar si ya hay sesión
    checkSession();
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}

function handleLogin(e) {
    e.preventDefault();
    
    const usuario = document.getElementById('usuario').value;
    const contraseña = document.getElementById('contraseña').value;
    const errorAlert = document.getElementById('errorAlert');
    
    fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ usuario, contraseña })
    })
    .then(response => response.json())
    .then(data => {
        if (data.access_token) {
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirigir según rol
            redirectByRole(data.user.rol);
        } else {
            errorAlert.textContent = data.error || 'Error al iniciar sesión';
            errorAlert.classList.remove('d-none');
        }
    })
    .catch(error => {
        errorAlert.textContent = 'Error de conexión: ' + error.message;
        errorAlert.classList.remove('d-none');
    });
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.href = '/';
}

function checkSession() {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!storedToken || !storedUser) {
        if (location.pathname !== '/') {
            location.href = '/';
        }
        return;
    }
    
    token = storedToken;
    currentUser = JSON.parse(storedUser);
    
    // Mostrar información del usuario
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
        userDisplay.textContent = `${currentUser.nombre} (${currentUser.rol})`;
    }
}

function redirectByRole(rol) {
    const routes = {
        'admin': '/dashboard',
        'empleado': '/ingreso',
        'tecnico': '/tecnico'
    };
    
    location.href = routes[rol] || '/dashboard';
}

// ===== FUNCIONES UTILITARIAS =====
async function apiCall(endpoint, options = {}) {
    // Asegurar que tenemos el token actualizado
    const currentToken = localStorage.getItem('token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {})
    };
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers }
    });
    
    if (response.status === 401) {
        handleLogout();
        return;
    }
    
    return await response.json();
}

function showLoading(show = true) {
    const loadingModal = document.getElementById('loadingModal');
    if (!loadingModal) {
        console.warn('Loading modal no encontrado');
        return;
    }
    
    try {
        // Cerrar cualquier modal existente primero
        const existingModal = bootstrap.Modal.getInstance(loadingModal);
        if (existingModal) {
            existingModal.dispose();
        }
        
        if (show) {
            // Mostrar el modal
            loadingModal.classList.add('show');
            loadingModal.style.display = 'block';
            loadingModal.style.zIndex = '10000';
            
            // Crear backdrop
            let backdrop = document.querySelector('.modal-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop fade show';
                backdrop.style.zIndex = '9999';
                document.body.appendChild(backdrop);
            }
            document.body.classList.add('modal-open');
        } else {
            // Cerrar el modal
            loadingModal.classList.remove('show');
            loadingModal.style.display = 'none';
            
            // Remover backdrop
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.body.classList.remove('modal-open');
        }
    } catch (error) {
        console.error('Error en showLoading:', error);
        // Fallback simple
        const loadingModal = document.getElementById('loadingModal');
        if (loadingModal) {
            loadingModal.style.display = show ? 'block' : 'none';
        }
    }
}

function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.querySelector('main').prepend(alertDiv);
    
    setTimeout(() => alertDiv.remove(), 5000);
}

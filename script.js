// ====== ПОДКЛЮЧЕНИЕ К SUPABASE ======
const SUPABASE_URL = 'https://egomebwghpjudrbnfpbe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnb21lYndnaHBqdWRyYm5mcGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MjEzMjYsImV4cCI6MjA5ODM5NzMyNn0.mPWK_8C8A5JZQzt48Oh0hMkxW5JeZYHiiHZRSbm3uNg';

// ====== УПРАВЛЕНИЕ ЗАПИСЯМИ (SUPABASE) ======

async function loadBookingsFromSupabase() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/bookings?select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!response.ok) throw new Error('Ошибка загрузки');
        return await response.json();
    } catch (error) {
        console.error('Ошибка загрузки записей:', error);
        return [];
    }
}

async function saveBookingToSupabase(booking) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(booking)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('ОТВЕТ СЕРВЕРА:', errorText);
            throw new Error('Ошибка сохранения');
        }
        return await response.json();
    } catch (error) {
        console.error('ОШИБКА СОХРАНЕНИЯ ЗАПИСИ:', error);
        return null;
    }
}

async function deleteBookingFromSupabase(id) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!response.ok) throw new Error('Ошибка удаления');
        return true;
    } catch (error) {
        console.error('Ошибка удаления записи:', error);
        return false;
    }
}

async function updateStatusInSupabase(id, newStatus) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) throw new Error('Ошибка обновления');
        return true;
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        return false;
    }
}

// ====== ФУНКЦИИ ДЛЯ РАБОТЫ С ЗАПИСЯМИ ======

async function addBooking(name, phone, workshop, date, time) {
    const batteryVoltage = document.getElementById('batteryVoltageHidden')?.value || '';
    const batteryCapacity = document.getElementById('batteryCapacityHidden')?.value || '';
    const batteryType = document.getElementById('batteryTypeHidden')?.value || '';
    const batteryBMS = document.getElementById('batteryBMSHidden')?.value || '';
    const batteryPrice = document.getElementById('batteryPriceHidden')?.value || '';
    
    const batteryDataStr = localStorage.getItem('batteryOrder');
    let batteryData = null;
    if (batteryDataStr) {
        try {
            batteryData = JSON.parse(batteryDataStr);
            localStorage.removeItem('batteryOrder');
        } catch (e) {}
    }
    
    const newBooking = {
        id: Date.now(),
        name,
        phone,
        workshop,
        date,
        time,
        created_at: new Date().toISOString(),
        batteryvoltage: batteryData?.voltage || batteryVoltage || '',
        batterycapacity: batteryData?.capacity || batteryCapacity || '',
        batterytype: batteryData?.type || batteryType || '',
        batterybms: batteryData?.bms || batteryBMS || '',
        batteryprice: batteryData?.price || batteryPrice || '',
        status: 'new'
    };
    
    const result = await saveBookingToSupabase(newBooking);
    if (result) {
        localStorage.removeItem('ebikeBookings');
    }
    return result || newBooking;
}

async function getBookings() {
    return await loadBookingsFromSupabase();
}

async function deleteBooking(id) {
    return await deleteBookingFromSupabase(id);
}

async function updateBookingStatus(id, newStatus) {
    return await updateStatusInSupabase(id, newStatus);
}

// ====== КЛИЕНТСКАЯ ЧАСТЬ (ЗАПИСЬ) ======

document.addEventListener('DOMContentLoaded', function() {
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        bookingForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const name = document.getElementById('clientName').value.trim();
            const phone = document.getElementById('clientPhone').value.trim();
            const workshop = document.getElementById('clientWorkshop').value;
            const date = document.getElementById('clientDate').value;
            const time = document.getElementById('clientTime').value;

            if (!name || !phone || !workshop || !date || !time) {
                document.getElementById('bookingMessage').textContent = '⚠️ Заполните все поля!';
                document.getElementById('bookingMessage').style.color = '#dc3545';
                return;
            }

            const bookings = await getBookings();
            const isBusy = bookings.some(b => b.workshop === workshop && b.date === date && b.time === time);

            if (isBusy) {
                document.getElementById('bookingMessage').textContent = '❌ Это время уже занято! Выберите другое.';
                document.getElementById('bookingMessage').style.color = '#dc3545';
                return;
            }

            await addBooking(name, phone, workshop, date, time);

            document.getElementById('bookingMessage').textContent = '✅ Вы успешно записаны! Ждём вас.';
            document.getElementById('bookingMessage').style.color = '#0077be';
            this.reset();
        });
    }
});

// ====== АДМИН-ПАНЕЛЬ ======

const ADMIN_PASSWORD = 'admin123';

async function renderBookingsTable() {
    const bookings = await getBookings();
    const tbody = document.getElementById('bookingsListPage');

    function updateStats(bookings) {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);

        const statTotal = document.getElementById('statTotal');
        const statToday = document.getElementById('statToday');
        const statWeek = document.getElementById('statWeek');
        const statMonth = document.getElementById('statMonth');
        
        if (statTotal) statTotal.textContent = bookings.length;
        if (statToday) statToday.textContent = bookings.filter(b => b.date === today).length;
        if (statWeek) statWeek.textContent = bookings.filter(b => b.date >= weekAgo.toISOString().split('T')[0]).length;
        if (statMonth) statMonth.textContent = bookings.filter(b => b.date >= monthAgo.toISOString().split('T')[0]).length;
    }

    updateStats(bookings);

    if (!tbody) return;

    if (bookings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="no-bookings">📭 Нет записей</td></tr>`;
        return;
    }

    const sorted = [...bookings].sort((a, b) => {
        return new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time);
    });

    const statusOptions = [
        { value: 'new', label: '🆕 Новая' },
        { value: 'work', label: '🔧 В работе' },
        { value: 'done', label: '✅ Готово' }
    ];

    tbody.innerHTML = sorted.map(b => {
        let batteryHtml = '—';
        if (b.batteryvoltage || b.batterycapacity) {
            batteryHtml = `
                <div class="battery-info">
                    <strong>${b.batteryvoltage || '—'}</strong> / 
                    <strong>${b.batterycapacity || '—'}</strong><br>
                    <span class="battery-meta">${b.batterytype || '—'}</span><br>
                    <span class="battery-price">${b.batteryprice || '—'}</span>
                </div>
            `;
        }
        
        return `
            <tr>
                <td><strong>${b.name}</strong></td>
                <td>${b.phone}</td>
                <td>${b.workshop}</td>
                <td>${b.date}</td>
                <td>${b.time}</td>
                <td>${batteryHtml}</td>
                <td>
                    <select class="status-select" data-id="${b.id}">
                        ${statusOptions.map(s => `
                            <option value="${s.value}" ${b.status === s.value ? 'selected' : ''}>
                                ${s.label}
                            </option>
                        `).join('')}
                    </select>
                </td>
                <td><button class="delete-btn" data-id="${b.id}">✕ Удалить</button></td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async function() {
            const id = Number(this.dataset.id);
            const newStatus = this.value;
            await updateBookingStatus(id, newStatus);
            renderBookingsTable();
            showToast('Статус обновлён');
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            if (confirm('Удалить запись?')) {
                const id = Number(this.dataset.id);
                await deleteBooking(id);
                renderBookingsTable();
                showToast('Запись удалена');
            }
        });
    });
}

// ====== АВТОРИЗАЦИЯ ======

document.addEventListener('DOMContentLoaded', function() {
    const loginPage = document.getElementById('loginPage');
    const adminPanel = document.getElementById('adminPanelPage');

    const loginBtn = document.getElementById('adminLoginPageBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            const password = document.getElementById('adminPasswordPage')?.value;
            const errorEl = document.getElementById('adminErrorPage');

            if (password === ADMIN_PASSWORD) {
                if (loginPage) loginPage.style.display = 'none';
                if (adminPanel) adminPanel.classList.add('active');
                renderBookingsTable();
                if (errorEl) errorEl.textContent = '';
            } else {
                if (errorEl) errorEl.textContent = '❌ Неверный пароль! Попробуйте снова.';
            }
        });
    }

    const passwordInput = document.getElementById('adminPasswordPage');
    if (passwordInput) {
        passwordInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                document.getElementById('adminLoginPageBtn')?.click();
            }
        });
    }

    const logoutBtn = document.getElementById('adminLogoutPageBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (loginPage) loginPage.style.display = 'flex';
            if (adminPanel) adminPanel.classList.remove('active');
            const passInput = document.getElementById('adminPasswordPage');
            if (passInput) passInput.value = '';
            const errorEl = document.getElementById('adminErrorPage');
            if (errorEl) errorEl.textContent = '';
        });
    }
});

// ====== УВЕДОМЛЕНИЕ (TOAST) ======
function showToast(message) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `✅ ${message}`;
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        background: '#0077be',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '600',
        boxShadow: '0 4px 20px rgba(0,119,190,0.3)',
        zIndex: '9999',
        opacity: '0',
        transform: 'translateY(20px)',
        transition: 'all 0.4s ease'
    });
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 50);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}

// ====== ОГРАНИЧЕНИЕ ВРЕМЕНИ (12:00 – 21:00) ======
document.addEventListener('DOMContentLoaded', function() {
    const timeInput = document.getElementById('clientTime');
    if (timeInput) {
        timeInput.setAttribute('min', '12:00');
        timeInput.setAttribute('max', '21:00');

        timeInput.addEventListener('input', function() {
            const value = this.value;
            if (value) {
                const hours = parseInt(value.split(':')[0]);
                const minutes = parseInt(value.split(':')[1]);
                if (hours < 12 || hours > 21 || (hours === 21 && minutes > 0)) {
                    this.setCustomValidity('⏰ Рабочее время: с 12:00 до 21:00');
                    this.reportValidity();
                    this.value = '';
                } else {
                    this.setCustomValidity('');
                }
            }
        });

        timeInput.addEventListener('blur', function() {
            const value = this.value;
            if (value) {
                const hours = parseInt(value.split(':')[0]);
                if (hours < 12 || hours > 21 || (hours === 21 && parseInt(value.split(':')[1]) > 0)) {
                    this.setCustomValidity('⏰ Рабочее время: с 12:00 до 21:00');
                    this.reportValidity();
                    this.value = '';
                }
            }
        });
    }
});

// ====== ТРОЙНОЙ КЛИК ПО ЛОГОТИПУ ======
let logoClickCount = 0;
let logoTimer = null;

document.addEventListener('DOMContentLoaded', function() {
    const logo = document.getElementById('mainLogo');
    if (logo) {
        logo.addEventListener('click', function(e) {
            const isIndexPage = window.location.pathname.endsWith('index.html') || 
                                window.location.pathname === '/' || 
                                window.location.pathname === '';
            
            if (!isIndexPage) {
                e.preventDefault();
                window.location.href = 'index.html';
                return;
            }

            e.preventDefault();
            logoClickCount++;

            if (logoClickCount === 1) {
                logoTimer = setTimeout(() => {
                    window.location.href = 'index.html';
                    logoClickCount = 0;
                }, 500);
            } else if (logoClickCount >= 3) {
                clearTimeout(logoTimer);
                logoClickCount = 0;
                window.location.href = 'admin.html';
            }
        });
    }
});

// ====== КОНСТРУКТОР СБОРКИ АКБ ======

document.addEventListener('DOMContentLoaded', function() {
    const orderBtn = document.getElementById('orderBatteryBtn');
    if (orderBtn) {
        orderBtn.addEventListener('click', function(e) {
            e.preventDefault();

            const voltage = document.getElementById('batteryVoltage')?.value || '';
            const capacity = document.getElementById('batteryCapacity')?.value || '';
            const type = document.getElementById('batteryType')?.value || '';
            const bms = document.getElementById('batteryBMS')?.value || '';
            const price = document.getElementById('batteryPrice')?.textContent || '';

            const batteryData = {
                voltage: voltage + 'V',
                capacity: capacity + ' Ah',
                type: type === 'liion' ? 'Li-ion' : 'LiFePO4',
                bms: bms === 'none' ? 'Без BMS' : (bms === 'huayang' ? 'Бюджет (Хуаянг)' : 'Премиум (ANT/Jikong)'),
                price: price + ' ₽'
            };
            localStorage.setItem('batteryOrder', JSON.stringify(batteryData));
            window.location.href = 'index.html#booking';
        });
    }

    // Заполняем скрытые поля на главной странице
    const batteryDataStr = localStorage.getItem('batteryOrder');
    if (batteryDataStr && window.location.pathname.includes('index.html')) {
        try {
            const batteryData = JSON.parse(batteryDataStr);
            const hiddenFields = {
                'batteryVoltageHidden': batteryData.voltage || '',
                'batteryCapacityHidden': batteryData.capacity || '',
                'batteryTypeHidden': batteryData.type || '',
                'batteryBMSHidden': batteryData.bms || '',
                'batteryPriceHidden': batteryData.price || ''
            };

            for (const [id, value] of Object.entries(hiddenFields)) {
                const field = document.getElementById(id);
                if (field) field.value = value;
            }

            const messageEl = document.getElementById('bookingMessage');
            if (messageEl) {
                messageEl.innerHTML = `
                    🔋 <strong>Заказ сборки АКБ:</strong><br>
                    ${batteryData.voltage} / ${batteryData.capacity} / ${batteryData.type}<br>
                    BMS: ${batteryData.bms} | Цена: ${batteryData.price}
                `;
                messageEl.style.color = '#0077be';
                messageEl.style.background = '#e8f0fe';
                messageEl.style.padding = '12px 18px';
                messageEl.style.borderRadius = '12px';
                messageEl.style.border = '1px solid #d0dce8';
                messageEl.style.marginBottom = '15px';
                messageEl.style.fontSize = '14px';
            }
        } catch (e) {
            console.log('Ошибка чтения данных АКБ:', e);
        }
    }
});

// ====== РАСЧЁТ ЦЕНЫ АКБ ======

document.addEventListener('DOMContentLoaded', function() {
    const voltageSelect = document.getElementById('batteryVoltage');
    const capacitySelect = document.getElementById('batteryCapacity');
    const typeSelect = document.getElementById('batteryType');
    const bmsSelect = document.getElementById('batteryBMS');
    const priceSpan = document.getElementById('batteryPrice');

    // Проверяем, что все элементы найдены
    if (!voltageSelect || !capacitySelect || !typeSelect || !bmsSelect || !priceSpan) {
        console.log('❌ Элементы конструктора АКБ не найдены');
        return;
    }

    console.log('✅ Конструктор АКБ найден');

    // Цены за 1 Ah
    const PRICES = {
        liion: { 12: 500, 24: 700, 36: 1000, 48: 1100, 60: 1250, 72: 1500 },
        lifepo4: { 12: 500, 24: 700, 36: 1000, 48: 1100, 60: 1250, 72: 1500 }
    };

    // Цены BMS
    const BMS_PRICES = {
        none: 0,
        huayang: 2000,
        premium: 5000
    };

    function calculatePrice() {
        const voltage = parseInt(voltageSelect.value);
        const capacity = parseInt(capacitySelect.value);
        const type = typeSelect.value;
        const bms = bmsSelect.value;

        // Цена за 1 Ah (для 12V есть специальные условия)
        let pricePerAh = PRICES[type]?.[voltage] || 500;
        if (voltage === 12 && capacity <= 20) pricePerAh = 500;
        if (voltage === 12 && capacity > 20 && capacity <= 100) pricePerAh = 250;

        const basePrice = capacity * pricePerAh;
        const bmsPrice = BMS_PRICES[bms] || 0;
        const total = basePrice + bmsPrice;

        priceSpan.textContent = total.toLocaleString('ru-RU');
        console.log(`💰 Расчёт: ${voltage}V, ${capacity}Ah, ${type}, BMS: ${bms} = ${total} ₽`);
    }

    // Подписываемся на изменения
    voltageSelect.addEventListener('change', calculatePrice);
    capacitySelect.addEventListener('change', calculatePrice);
    typeSelect.addEventListener('change', calculatePrice);
    bmsSelect.addEventListener('change', calculatePrice);

    // Первый расчёт
    setTimeout(calculatePrice, 300);
});

// ====== ПЛАВНАЯ АНИМАЦИЯ ПРИ СКРОЛЛЕ ======

function revealOnScroll() {
    const reveals = document.querySelectorAll('.reveal');
    
    reveals.forEach((el) => {
        const windowHeight = window.innerHeight;
        const elementTop = el.getBoundingClientRect().top;
        const revealPoint = 120;
        
        if (elementTop < windowHeight - revealPoint) {
            el.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.address-card, .price-card, .battery-card, .batteries-page .battery-card').forEach((el, index) => {
        el.classList.add('reveal');
        if (index % 2 === 0) {
            el.classList.add('reveal-delay-1');
        } else {
            el.classList.add('reveal-delay-2');
        }
    });
    
    revealOnScroll();
    window.addEventListener('scroll', revealOnScroll);
});

// ====== ПЕРЕКЛЮЧАТЕЛЬ ТЕМЫ ======

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const icon = document.querySelector('.theme-toggle');
    if (icon) {
        icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        const icon = document.querySelector('.theme-toggle');
        if (icon) {
            icon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const nav = document.querySelector('nav');
    if (nav && !document.querySelector('.theme-toggle')) {
        const btn = document.createElement('button');
        btn.className = 'theme-toggle';
        btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
        btn.addEventListener('click', toggleTheme);
        nav.appendChild(btn);
    }
});

// ====== КНОПКА "НАВЕРХ" ======

document.addEventListener('DOMContentLoaded', function() {
    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'scroll-top';
    scrollBtn.innerHTML = '↑';
    document.body.appendChild(scrollBtn);
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 400) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    });
    
    scrollBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});
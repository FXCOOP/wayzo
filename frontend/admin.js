// ====== WAYZO ADMIN DASHBOARD ======

(function() {
    'use strict';

    // DOM Elements
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // Admin State
    let currentSection = 'dashboard';
    let charts = {};

    // Initialize Admin Dashboard
    document.addEventListener('DOMContentLoaded', () => {
        initializeAdminDashboard();
        setupNavigation();
        setupCharts();
        loadMockData();
        setupEventListeners();
    });

    // Initialize Admin Dashboard
    const initializeAdminDashboard = () => {
        console.log('Initializing Wayzo Admin Dashboard...');
        
        // Set active section
        showSection('dashboard');
        
        // Initialize metrics
        updateMetrics();
        
        // Load recent activity
        loadRecentActivity();
    };

    // Setup Navigation
    const setupNavigation = () => {
        const navLinks = $$('.nav-link');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetSection = link.getAttribute('href').substring(1);
                showSection(targetSection);
                
                // Update active nav item
                $$('.nav-item').forEach(item => item.classList.remove('active'));
                link.closest('.nav-item').classList.add('active');
            });
        });
    };

    // Show Section
    const showSection = (sectionId) => {
        // Hide all sections
        $$('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show target section
        const targetSection = $(`#${sectionId}`);
        if (targetSection) {
            targetSection.classList.add('active');
            currentSection = sectionId;
            
            // Load section-specific data
            loadSectionData(sectionId);
        }
    };

    // Load Section Data
    const loadSectionData = (sectionId) => {
        switch(sectionId) {
            case 'users':
                loadUsersData();
                break;
            case 'analytics':
                loadAnalyticsData();
                break;
            case 'logs':
                loadSystemLogs();
                break;
            case 'settings':
                loadSettings();
                break;
        }
    };

    // Setup Charts
    const setupCharts = () => {
        // User Growth Chart
        const userGrowthCtx = $('#userGrowthChart');
        if (userGrowthCtx) {
            charts.userGrowth = new Chart(userGrowthCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'New Users',
                        data: [120, 190, 300, 500, 200, 300],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: '#e2e8f0'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }

        // Revenue Chart
        const revenueCtx = $('#revenueChart');
        if (revenueCtx) {
            charts.revenue = new Chart(revenueCtx, {
                type: 'bar',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Revenue',
                        data: [12000, 19000, 30000, 50000, 20000, 30000],
                        backgroundColor: '#10b981',
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: '#e2e8f0'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }
    };

    // Load Mock Data
    const loadMockData = () => {
        // Mock metrics data
        const mockMetrics = {
            totalUsers: 15420,
            totalTrips: 8920,
            totalRevenue: 125000,
            conversionRate: 3.2
        };

        // Update metrics display
        Object.keys(mockMetrics).forEach(key => {
            const element = $(`#${key}`);
            if (element) {
                element.textContent = key === 'totalRevenue' ? `$${mockMetrics[key].toLocaleString()}` : mockMetrics[key].toLocaleString();
            }
        });
    };

    // Load Recent Activity
    const loadRecentActivity = () => {
        const activityContainer = $('#recentActivity');
        if (!activityContainer) return;

        const mockActivities = [
            {
                type: 'user',
                message: 'New user registered: john.doe@email.com',
                time: '2 minutes ago',
                icon: 'fas fa-user-plus'
            },
            {
                type: 'trip',
                message: 'Trip plan created: Paris Adventure (5 days)',
                time: '5 minutes ago',
                icon: 'fas fa-map-marked-alt'
            },
            {
                type: 'payment',
                message: 'Payment received: $19.99 from user@example.com',
                time: '12 minutes ago',
                icon: 'fas fa-credit-card'
            },
            {
                type: 'system',
                message: 'System backup completed successfully',
                time: '1 hour ago',
                icon: 'fas fa-database'
            }
        ];

        const activitiesHTML = mockActivities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <p class="activity-message">${activity.message}</p>
                    <span class="activity-time">${activity.time}</span>
                </div>
            </div>
        `).join('');

        activityContainer.innerHTML = activitiesHTML;
    };

    // Load Users Data
    const loadUsersData = () => {
        const usersTableBody = $('#usersTableBody');
        if (!usersTableBody) return;

        const mockUsers = [
            {
                name: 'John Doe',
                email: 'john.doe@email.com',
                status: 'active',
                role: 'user',
                joined: '2024-01-15'
            },
            {
                name: 'Jane Smith',
                email: 'jane.smith@email.com',
                status: 'active',
                role: 'premium',
                joined: '2024-01-10'
            },
            {
                name: 'Bob Johnson',
                email: 'bob.johnson@email.com',
                status: 'inactive',
                role: 'user',
                joined: '2024-01-05'
            }
        ];

        const usersHTML = mockUsers.map(user => `
            <tr>
                <td>
                    <div class="user-info">
                        <img src="/assets/default-avatar.svg" alt="${user.name}" class="user-avatar-small">
                        <span>${user.name}</span>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <span class="status-badge status-${user.status}">${user.status}</span>
                </td>
                <td>
                    <span class="role-badge role-${user.role}">${user.role}</span>
                </td>
                <td>${user.joined}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-secondary">Edit</button>
                        <button class="btn btn-sm btn-danger">Suspend</button>
                    </div>
                </td>
            </tr>
        `).join('');

        usersTableBody.innerHTML = usersHTML;
    };

    // Load Analytics Data
    const loadAnalyticsData = () => {
        // Geographic Distribution Chart
        const geoCtx = $('#geoChart');
        if (geoCtx && !charts.geo) {
            charts.geo = new Chart(geoCtx, {
                type: 'doughnut',
                data: {
                    labels: ['United States', 'United Kingdom', 'Germany', 'France', 'Canada'],
                    datasets: [{
                        data: [45, 20, 15, 12, 8],
                        backgroundColor: [
                            '#3b82f6',
                            '#10b981',
                            '#f59e0b',
                            '#ef4444',
                            '#8b5cf6'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }

        // Popular Destinations Chart
        const destinationsCtx = $('#destinationsChart');
        if (destinationsCtx && !charts.destinations) {
            charts.destinations = new Chart(destinationsCtx, {
                type: 'bar',
                data: {
                    labels: ['Paris', 'Tokyo', 'New York', 'London', 'Rome'],
                    datasets: [{
                        label: 'Trip Plans',
                        data: [120, 98, 85, 76, 65],
                        backgroundColor: '#10b981'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
    };

    // Load System Logs
    const loadSystemLogs = () => {
        const logsTableBody = $('#logsTableBody');
        if (!logsTableBody) return;

        const mockLogs = [
            {
                timestamp: '2024-01-27 14:30:25',
                level: 'info',
                source: 'UserService',
                message: 'User authentication successful',
                details: 'User ID: 12345, IP: 192.168.1.100'
            },
            {
                timestamp: '2024-01-27 14:28:15',
                level: 'warning',
                source: 'PaymentService',
                message: 'Payment processing delayed',
                details: 'Transaction ID: TXN-789, Reason: Network timeout'
            },
            {
                timestamp: '2024-01-27 14:25:42',
                level: 'error',
                source: 'EmailService',
                message: 'Failed to send welcome email',
                details: 'User ID: 12345, Error: SMTP connection failed'
            }
        ];

        const logsHTML = mockLogs.map(log => `
            <tr class="log-row log-${log.level}">
                <td>${log.timestamp}</td>
                <td>
                    <span class="log-level log-level-${log.level}">${log.level}</span>
                </td>
                <td>${log.source}</td>
                <td>${log.message}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="showLogDetails('${log.details}')">
                        View Details
                    </button>
                </td>
            </tr>
        `).join('');

        logsTableBody.innerHTML = logsHTML;
    };

    // Load Settings
    const loadSettings = () => {
        // Settings are already populated in HTML
        console.log('Settings loaded');
    };

    // Setup Event Listeners
    const setupEventListeners = () => {
        // Logout button
        const logoutBtn = $('#logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to logout?')) {
                    window.location.href = '/index.backend.html';
                }
            });
        }

        // User search
        const userSearch = $('#userSearch');
        if (userSearch) {
            userSearch.addEventListener('input', (e) => {
                filterUsers(e.target.value);
            });
        }

        // User filters
        const userStatusFilter = $('#userStatusFilter');
        const userRoleFilter = $('#userRoleFilter');
        
        if (userStatusFilter) {
            userStatusFilter.addEventListener('change', () => {
                applyUserFilters();
            });
        }
        
        if (userRoleFilter) {
            userRoleFilter.addEventListener('change', () => {
                applyUserFilters();
            });
        }

        // Export users
        const exportUsersBtn = $('#exportUsers');
        if (exportUsersBtn) {
            exportUsersBtn.addEventListener('click', () => {
                exportUsersData();
            });
        }

        // Refresh logs
        const refreshLogsBtn = $('#refreshLogs');
        if (refreshLogsBtn) {
            refreshLogsBtn.addEventListener('click', () => {
                loadSystemLogs();
            });
        }

        // Chart period selectors
        const userGrowthPeriod = $('#userGrowthPeriod');
        const revenuePeriod = $('#revenuePeriod');
        
        if (userGrowthPeriod) {
            userGrowthPeriod.addEventListener('change', () => {
                updateUserGrowthChart(userGrowthPeriod.value);
            });
        }
        
        if (revenuePeriod) {
            revenuePeriod.addEventListener('change', () => {
                updateRevenueChart(revenuePeriod.value);
            });
        }
    };

    // Filter Users
    const filterUsers = (searchTerm) => {
        const rows = $$('#usersTableBody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const matches = text.includes(searchTerm.toLowerCase());
            row.style.display = matches ? '' : 'none';
        });
    };

    // Apply User Filters
    const applyUserFilters = () => {
        const statusFilter = $('#userStatusFilter').value;
        const roleFilter = $('#userRoleFilter').value;
        
        const rows = $$('#usersTableBody tr');
        
        rows.forEach(row => {
            const status = row.querySelector('.status-badge').textContent;
            const role = row.querySelector('.role-badge').textContent;
            
            const statusMatch = !statusFilter || status === statusFilter;
            const roleMatch = !roleFilter || role === roleFilter;
            
            row.style.display = (statusMatch && roleMatch) ? '' : 'none';
        });
    };

    // Export Users Data
    const exportUsersData = () => {
        // Mock export functionality
        const csvContent = 'Name,Email,Status,Role,Joined\n' +
            'John Doe,john.doe@email.com,active,user,2024-01-15\n' +
            'Jane Smith,jane.smith@email.com,active,premium,2024-01-10\n' +
            'Bob Johnson,bob.johnson@email.com,inactive,user,2024-01-05';
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'wayzo-users.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        
        alert('Users data exported successfully!');
    };

    // Update User Growth Chart
    const updateUserGrowthChart = (period) => {
        if (charts.userGrowth) {
            // Mock data based on period
            const data = period === '7' ? [20, 25, 30, 35, 40, 45, 50] :
                        period === '90' ? [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] :
                        [120, 190, 300, 500, 200, 300];
            
            charts.userGrowth.data.datasets[0].data = data;
            charts.userGrowth.update();
        }
    };

    // Update Revenue Chart
    const updateRevenueChart = (period) => {
        if (charts.revenue) {
            // Mock data based on period
            const data = period === '7' ? [2000, 2500, 3000, 3500, 4000, 4500, 5000] :
                        period === '90' ? [10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000] :
                        [12000, 19000, 30000, 50000, 20000, 30000];
            
            charts.revenue.data.datasets[0].data = data;
            charts.revenue.update();
        }
    };

    // Update Metrics
    const updateMetrics = () => {
        // Metrics are updated in loadMockData()
        console.log('Metrics updated');
    };

    // Global Functions
    window.generateReport = (type) => {
        const reportTypes = {
            'bi': 'Business Intelligence Report',
            'users': 'User Analytics Report',
            'trips': 'Trip Planning Report',
            'financial': 'Financial Report'
        };
        
        alert(`Generating ${reportTypes[type]}...\nThis would typically generate a PDF or Excel file with comprehensive data.`);
    };

    window.showLogDetails = (details) => {
        alert(`Log Details:\n\n${details}`);
    };

    // Export functions for external use
    window.WayzoAdmin = {
        showSection,
        loadSectionData,
        updateMetrics,
        generateReport
    };

})();
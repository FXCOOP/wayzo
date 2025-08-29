// Wayzo Enterprise Admin - Professional BI Dashboard JavaScript

(function() {
  'use strict';

  // Global variables
  let currentSection = 'dashboard';
  let dashboardData = {};
  let charts = {};
  let realTimeUpdates = null;

  // Initialize admin dashboard
  function initAdmin() {
    setupNavigation();
    loadDashboardData();
    initializeCharts();
    setupRealTimeUpdates();
    setupEventListeners();
    loadMockData();
  }

  // Setup navigation
  function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetSection = link.getAttribute('href').substring(1);
        switchSection(targetSection);
      });
    });
  }

  // Switch between sections
  function switchSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
      section.classList.remove('active');
    });

    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // Show target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Add active class to nav link
    const activeLink = document.querySelector(`[href="#${sectionName}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }

    currentSection = sectionName;
    
    // Load section-specific data
    switch(sectionName) {
      case 'dashboard':
        loadDashboardData();
        break;
      case 'analytics':
        loadAnalyticsData();
        break;
      case 'users':
        loadUsersData();
        break;
      case 'trips':
        loadTripsData();
        break;
      case 'revenue':
        loadRevenueData();
        break;
      case 'marketing':
        loadMarketingData();
        break;
      case 'integrations':
        loadIntegrationsData();
        break;
      case 'reports':
        loadReportsData();
        break;
      case 'tasks':
        loadTasksData();
        break;
      case 'logs':
        loadLogsData();
        break;
      case 'settings':
        loadSettingsData();
        break;
    }
  }

  // Load dashboard data
  function loadDashboardData() {
    // Simulate API call
    setTimeout(() => {
      updateKPIs();
      updateMainChart();
      updateGeoChart();
      updateActivityFeed();
    }, 500);
  }

  // Update KPIs
  function updateKPIs() {
    const kpiData = {
      totalUsers: '12,847',
      totalTrips: '8,923',
      totalRevenue: '$156,432',
      conversionRate: '3.2%'
    };

    Object.keys(kpiData).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        element.textContent = kpiData[key];
      }
    });
  }

  // Initialize charts
  function initializeCharts() {
    initializeMainChart();
    initializeGeoChart();
    initializeAnalyticsCharts();
  }

  // Initialize main chart
  function initializeMainChart() {
    const chartContainer = document.getElementById('mainChart');
    if (!chartContainer) return;

    const options = {
      series: [{
        name: 'Revenue',
        data: [31000, 40000, 28000, 51000, 42000, 82000, 56000, 81000, 56000, 55000, 40000, 30000]
      }, {
        name: 'Users',
        data: [11000, 32000, 45000, 32000, 34000, 32000, 34000, 56000, 76000, 55000, 67000, 83000]
      }],
      chart: {
        height: 350,
        type: 'area',
        toolbar: {
          show: false
        },
        zoom: {
          enabled: false
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: 'smooth',
        width: 2
      },
      colors: ['#1e40af', '#10b981'],
      fill: {
        type: 'gradient',
        gradient: {
          opacityFrom: 0.6,
          opacityTo: 0.1,
        }
      },
      xaxis: {
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      },
      yaxis: {
        labels: {
          formatter: function (value) {
            return '$' + value.toLocaleString();
          }
        }
      },
      tooltip: {
        x: {
          format: 'MMM'
        },
        y: {
          formatter: function (value) {
            return '$' + value.toLocaleString();
          }
        }
      }
    };

    charts.mainChart = new ApexCharts(chartContainer, options);
    charts.mainChart.render();
  }

  // Initialize geographic chart
  function initializeGeoChart() {
    const chartContainer = document.getElementById('geoChart');
    if (!chartContainer) return;

    const options = {
      series: [44, 55, 13, 43, 22],
      chart: {
        width: 380,
        type: 'pie',
      },
      labels: ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany'],
      responsive: [{
        breakpoint: 480,
        options: {
          chart: {
            width: 200
          },
          legend: {
            position: 'bottom'
          }
        }
      }],
      colors: ['#1e40af', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']
    };

    charts.geoChart = new ApexCharts(chartContainer, options);
    charts.geoChart.render();
  }

  // Initialize analytics charts
  function initializeAnalyticsCharts() {
    // User Behavior Chart
    const userBehaviorContainer = document.getElementById('userBehaviorChart');
    if (userBehaviorContainer) {
      const options = {
        series: [{
          name: 'Page Views',
          data: [400, 430, 448, 470, 540, 580, 690, 1100, 1200, 1380]
        }],
        chart: {
          type: 'bar',
          height: 250,
          toolbar: { show: false }
        },
        colors: ['#1e40af'],
        plotOptions: {
          bar: {
            borderRadius: 4,
            horizontal: true,
          }
        },
        dataLabels: {
          enabled: false
        },
        xaxis: {
          categories: ['Home', 'Search', 'Results', 'Details', 'Booking', 'Payment', 'Confirmation', 'Profile', 'History', 'Support'],
        }
      };
      charts.userBehavior = new ApexCharts(userBehaviorContainer, options);
      charts.userBehavior.render();
    }

    // Funnel Chart
    const funnelContainer = document.getElementById('funnelChart');
    if (funnelContainer) {
      const options = {
        series: [{
          name: 'Users',
          data: [100, 85, 72, 58, 42, 28, 15]
        }],
        chart: {
          type: 'bar',
          height: 250,
          toolbar: { show: false }
        },
        colors: ['#1e40af'],
        plotOptions: {
          bar: {
            borderRadius: 0,
            horizontal: true,
            distributed: true,
            barHeight: '80%',
          }
        },
        dataLabels: {
          enabled: true,
          textAnchor: 'start',
          style: {
            colors: ['#fff']
          },
          formatter: function (val, opt) {
            return opt.w.globals.labels[opt.dataPointIndex] + ': ' + val
          },
          offsetX: 0
        },
        xaxis: {
          categories: ['Visit Site', 'Search Destinations', 'View Results', 'Generate Plan', 'Preview Plan', 'Purchase Full Plan', 'Complete Trip'],
        },
        yaxis: {
          labels: {
            show: false
          }
        },
        legend: {
          show: false
        }
      };
      charts.funnel = new ApexCharts(funnelContainer, options);
      charts.funnel.render();
    }

    // Seasonal Trends Chart
    const seasonalContainer = document.getElementById('seasonalChart');
    if (seasonalContainer) {
      const options = {
        series: [{
          name: 'Bookings',
          data: [31, 40, 28, 51, 42, 109, 100]
        }, {
          name: 'Revenue',
          data: [11, 32, 45, 32, 34, 52, 41]
        }],
        chart: {
          height: 250,
          type: 'area',
          toolbar: { show: false }
        },
        dataLabels: {
          enabled: false
        },
        stroke: {
          curve: 'smooth'
        },
        colors: ['#1e40af', '#10b981'],
        xaxis: {
          type: 'datetime',
          categories: ['2018-09-19T00:00:00.000Z', '2018-09-19T01:30:00.000Z', '2018-09-19T02:30:00.000Z', '2018-09-19T03:30:00.000Z', '2018-09-19T04:30:00.000Z', '2018-09-19T05:30:00.000Z', '2018-09-19T06:30:00.000Z']
        },
        tooltip: {
          x: {
            format: 'dd/MM/yy HH:mm'
          },
        },
      };
      charts.seasonal = new ApexCharts(seasonalContainer, options);
      charts.seasonal.render();
    }

    // Destination Revenue Chart
    const destinationContainer = document.getElementById('destinationRevenueChart');
    if (destinationContainer) {
      const options = {
        series: [{
          name: 'Revenue',
          data: [400, 430, 448, 470, 540, 580, 690, 1100, 1200, 1380]
        }],
        chart: {
          type: 'bar',
          height: 250,
          toolbar: { show: false }
        },
        colors: ['#1e40af'],
        plotOptions: {
          bar: {
            borderRadius: 4,
            horizontal: true,
          }
        },
        dataLabels: {
          enabled: false
        },
        xaxis: {
          categories: ['Paris', 'Tokyo', 'New York', 'London', 'Rome', 'Barcelona', 'Amsterdam', 'Bangkok', 'Sydney', 'Dubai'],
        }
      };
      charts.destinationRevenue = new ApexCharts(destinationContainer, options);
      charts.destinationRevenue.render();
    }
  }

  // Update main chart
  function updateMainChart() {
    if (charts.mainChart) {
      // Update chart data based on selected metric
      const chartBtns = document.querySelectorAll('.chart-btn');
      chartBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          chartBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          const chartType = btn.dataset.chart;
          updateChartData(chartType);
        });
      });
    }
  }

  // Update chart data
  function updateChartData(chartType) {
    if (!charts.mainChart) return;

    let newData = [];
    let newCategories = [];
    let newColors = [];

    switch(chartType) {
      case 'revenue':
        newData = [{
          name: 'Revenue',
          data: [31000, 40000, 28000, 51000, 42000, 82000, 56000, 81000, 56000, 55000, 40000, 30000]
        }];
        newColors = ['#1e40af'];
        break;
      case 'users':
        newData = [{
          name: 'Users',
          data: [11000, 32000, 45000, 32000, 34000, 32000, 34000, 56000, 76000, 55000, 67000, 83000]
        }];
        newColors = ['#10b981'];
        break;
      case 'trips':
        newData = [{
          name: 'Trips',
          data: [2100, 3200, 4500, 3200, 3400, 3200, 3400, 5600, 7600, 5500, 6700, 8300]
        }];
        newColors = ['#f59e0b'];
        break;
    }

    charts.mainChart.updateOptions({
      series: newData,
      colors: newColors
    });
  }

  // Update geographic chart
  function updateGeoChart() {
    // Chart updates can be added here
  }

  // Update activity feed
  function updateActivityFeed() {
    const activityFeed = document.getElementById('activityFeed');
    if (!activityFeed) return;

    const activities = [
      {
        type: 'user',
        message: 'New user registered: john.doe@email.com',
        time: '2 minutes ago',
        icon: 'fas fa-user-plus'
      },
      {
        type: 'trip',
        message: 'Trip plan generated for Paris, France',
        time: '5 minutes ago',
        icon: 'fas fa-map-marked-alt'
      },
      {
        type: 'revenue',
        message: 'Payment received: $19.00 for full trip plan',
        time: '8 minutes ago',
        icon: 'fas fa-dollar-sign'
      },
      {
        type: 'system',
        message: 'System backup completed successfully',
        time: '15 minutes ago',
        icon: 'fas fa-shield-alt'
      }
    ];

    activityFeed.innerHTML = activities.map(activity => `
      <div class="activity-item ${activity.type}">
        <div class="activity-icon">
          <i class="${activity.icon}"></i>
        </div>
        <div class="activity-content">
          <div class="activity-message">${activity.message}</div>
          <div class="activity-time">${activity.time}</div>
        </div>
      </div>
    `).join('');
  }

  // Setup real-time updates
  function setupRealTimeUpdates() {
    // Simulate real-time data updates
    realTimeUpdates = setInterval(() => {
      updateActivityFeed();
      updateRandomKPI();
    }, 30000); // Update every 30 seconds
  }

  // Update random KPI
  function updateRandomKPI() {
    const kpis = ['totalUsers', 'totalTrips', 'totalRevenue', 'conversionRate'];
    const randomKPI = kpis[Math.floor(Math.random() * kpis.length)];
    
    // Simulate small changes
    const element = document.getElementById(randomKPI);
    if (element) {
      element.classList.add('updating');
      setTimeout(() => {
        element.classList.remove('updating');
      }, 1000);
    }
  }

  // Load mock data for different sections
  function loadMockData() {
    // This would normally come from API calls
    dashboardData = {
      users: {
        total: 12847,
        active: 10234,
        premium: 2341,
        newThisMonth: 1234
      },
      trips: {
        total: 8923,
        completed: 7234,
        inProgress: 1234,
        cancelled: 455
      },
      revenue: {
        total: 156432,
        thisMonth: 23456,
        lastMonth: 19876,
        growth: 15.2
      }
    };
  }

  // Load section-specific data
  function loadAnalyticsData() {
    // Analytics data loading logic
    console.log('Loading analytics data...');
  }

  function loadUsersData() {
    const userTableBody = document.getElementById('userTableBody');
    if (!userTableBody) return;

    const mockUsers = [
      {
        name: 'John Doe',
        email: 'john.doe@email.com',
        status: 'Active',
        trips: 12,
        revenue: '$156',
        lastActive: '2 hours ago'
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@email.com',
        status: 'Premium',
        trips: 8,
        revenue: '$89',
        lastActive: '1 day ago'
      },
      {
        name: 'Mike Johnson',
        email: 'mike.j@email.com',
        status: 'Active',
        trips: 5,
        revenue: '$67',
        lastActive: '3 days ago'
      }
    ];

    userTableBody.innerHTML = mockUsers.map(user => `
      <tr>
        <td>
          <div class="user-info">
            <img src="/frontend/assets/default-avatar.svg" alt="${user.name}" class="user-avatar-small">
            <span>${user.name}</span>
          </div>
        </td>
        <td>${user.email}</td>
        <td><span class="status-badge status-${user.status.toLowerCase()}">${user.status}</span></td>
        <td>${user.trips}</td>
        <td>${user.revenue}</td>
        <td>${user.lastActive}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-primary">Edit</button>
            <button class="btn btn-sm btn-ghost">View</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function loadTripsData() {
    // Trip analytics data loading
    console.log('Loading trips data...');
  }

  function loadRevenueData() {
    // Revenue data loading
    console.log('Loading revenue data...');
  }

  function loadMarketingData() {
    // Marketing data loading
    console.log('Loading marketing data...');
  }

  function loadIntegrationsData() {
    // Integrations data loading
    console.log('Loading integrations data...');
  }

  function loadReportsData() {
    // Reports data loading
    console.log('Loading reports data...');
  }

  function loadTasksData() {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    const mockTasks = [
      {
        title: 'Optimize conversion funnel',
        assignee: 'Marketing Team',
        priority: 'High',
        dueDate: '2025-09-15',
        status: 'In Progress'
      },
      {
        title: 'Implement new payment gateway',
        assignee: 'Development Team',
        priority: 'Medium',
        dueDate: '2025-09-20',
        status: 'Pending'
      },
      {
        title: 'Update user onboarding flow',
        assignee: 'UX Team',
        priority: 'High',
        dueDate: '2025-09-10',
        status: 'Completed'
      }
    ];

    taskList.innerHTML = mockTasks.map(task => `
      <div class="task-item">
        <div class="task-header">
          <h4>${task.title}</h4>
          <span class="task-priority ${task.priority.toLowerCase()}">${task.priority}</span>
        </div>
        <div class="task-details">
          <span><i class="fas fa-user"></i> ${task.assignee}</span>
          <span><i class="fas fa-calendar"></i> ${task.dueDate}</span>
          <span class="task-status ${task.status.toLowerCase()}">${task.status}</span>
        </div>
      </div>
    `).join('');
  }

  function loadLogsData() {
    const logTableBody = document.getElementById('logTableBody');
    if (!logTableBody) return;

    const mockLogs = [
      {
        timestamp: '2025-08-29 14:30:22',
        level: 'INFO',
        message: 'User authentication successful',
        user: 'john.doe@email.com',
        actions: 'View Details'
      },
      {
        timestamp: '2025-08-29 14:28:15',
        level: 'WARNING',
        message: 'API rate limit approaching',
        user: 'System',
        actions: 'Monitor'
      },
      {
        timestamp: '2025-08-29 14:25:43',
        level: 'ERROR',
        message: 'Payment gateway timeout',
        user: 'payment.service',
        actions: 'Investigate'
      }
    ];

    logTableBody.innerHTML = mockLogs.map(log => `
      <tr class="log-row log-${log.level.toLowerCase()}">
        <td>${log.timestamp}</td>
        <td><span class="log-level log-level-${log.level.toLowerCase()}">${log.level}</span></td>
        <td>${log.message}</td>
        <td>${log.user}</td>
        <td>${log.actions}</td>
      </tr>
    `).join('');
  }

  function loadSettingsData() {
    // Settings data loading
    console.log('Loading settings data...');
  }

  // Setup event listeners
  function setupEventListeners() {
    // Time range selector
    const timeRange = document.getElementById('timeRange');
    if (timeRange) {
      timeRange.addEventListener('change', (e) => {
        loadDashboardData();
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
          window.location.href = '/';
        }
      });
    }

    // Chart controls
    setupChartControls();
  }

  // Setup chart controls
  function setupChartControls() {
    // Chart button controls
    const chartBtns = document.querySelectorAll('.chart-btn');
    chartBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        chartBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const chartType = btn.dataset.chart;
        updateChartData(chartType);
      });
    });
  }

  // Global functions for HTML onclick handlers
  window.refreshDashboard = function() {
    loadDashboardData();
  };

  window.generateReport = function(type) {
    console.log(`Generating ${type} report...`);
    // This would normally trigger report generation
    alert(`${type.charAt(0).toUpperCase() + type.slice(1)} report generation started. You will receive an email when ready.`);
  };

  window.addTask = function() {
    const taskName = prompt('Enter task name:');
    if (taskName) {
      const taskList = document.getElementById('taskList');
      if (taskList) {
        const newTask = document.createElement('div');
        newTask.className = 'task-item';
        newTask.innerHTML = `
          <div class="task-header">
            <h4>${taskName}</h4>
            <span class="task-priority medium">Medium</span>
          </div>
          <div class="task-details">
            <span><i class="fas fa-user"></i> Unassigned</span>
            <span><i class="fas fa-calendar"></i> ${new Date().toISOString().split('T')[0]}</span>
            <span class="task-status pending">Pending</span>
          </div>
        `;
        taskList.appendChild(newTask);
      }
    }
  };

  window.exportLogs = function() {
    console.log('Exporting logs...');
    alert('Log export started. You will receive an email when ready.');
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
  } else {
    initAdmin();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (realTimeUpdates) {
      clearInterval(realTimeUpdates);
    }
  });

})();
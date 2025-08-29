// Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard
    loadDashboardData();
    loadUserInfo();
    setupEventListeners();
    
    // Check URL to open specific tab
    const urlPath = window.location.pathname;
    if (urlPath.includes('/plans')) {
        openTab('plans');
    } else if (urlPath.includes('/referrals')) {
        openTab('referrals');
    } else if (urlPath.includes('/billing')) {
        openTab('billing');
    } else {
        openTab('overview');
    }
});

// Function to open specific tab
function openTab(tabName) {
    // Hide all tabs
    const allTabs = document.querySelectorAll('.cabinet-tab');
    allTabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Update navigation
    const allNavItems = document.querySelectorAll('.sidebar-item');
    allNavItems.forEach(item => item.classList.remove('active'));
    
    const selectedNav = document.querySelector(`[onclick="switchCabinetTab('${tabName}')"]`);
    if (selectedNav) {
        selectedNav.classList.add('active');
    }
}

// Load dashboard data from backend
async function loadDashboardData() {
    try {
        // Load analytics data
        const analyticsResponse = await fetch('/api/analytics');
        if (analyticsResponse.ok) {
            const analyticsData = await analyticsResponse.json();
            updateDashboardStats(analyticsData);
        }

        // Load user plans
        await loadUserPlans();
        
        // Load referral data
        await loadReferralData();
        
        // Load billing data
        await loadBillingData();
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

// Update dashboard statistics
function updateDashboardStats(data) {
    // Update stats cards
    const totalPlansEl = document.getElementById('totalPlans');
    const totalSavedEl = document.getElementById('totalSaved');
    const totalReferralsEl = document.getElementById('totalReferrals');
    const activePlansEl = document.getElementById('activePlans');
    
    if (totalPlansEl) totalPlansEl.textContent = data.totalPlans || 0;
    if (totalSavedEl) totalSavedEl.textContent = `$${data.totalSaved || 0}`;
    if (totalReferralsEl) totalReferralsEl.textContent = data.totalReferrals || 0;
    if (activePlansEl) activePlansEl.textContent = data.activePlans || 0;
}

// Load user plans
async function loadUserPlans() {
    try {
        // For now, we'll use mock data since we need to implement user-specific plan loading
        const mockPlans = [
            {
                id: '1',
                destination: 'Paris, France',
                duration: '5 days',
                style: 'Mid-range',
                budget: '$2,500',
                status: 'paid',
                created: '2025-08-25'
            },
            {
                id: '2',
                destination: 'Tokyo, Japan',
                duration: '7 days',
                style: 'Luxury',
                budget: '$4,000',
                status: 'paid',
                created: '2025-08-20'
            },
            {
                id: '3',
                destination: 'Bali, Indonesia',
                duration: '10 days',
                style: 'Budget',
                budget: '$1,800',
                status: 'pending',
                created: '2025-08-15'
            }
        ];
        
        displayUserPlans(mockPlans);
        
    } catch (error) {
        console.error('Failed to load user plans:', error);
    }
}

// Display user plans in the grid
function displayUserPlans(plans) {
    const plansGrid = document.getElementById('plansGrid');
    if (!plansGrid) return;
    
    plansGrid.innerHTML = plans.map(plan => `
        <div class="plan-item">
            <div class="plan-info">
                <h4>${plan.destination}</h4>
                <p>${plan.duration} • ${plan.style} • ${plan.budget}</p>
                <p class="plan-date">Created: ${new Date(plan.created).toLocaleDateString()}</p>
            </div>
            <div class="plan-status ${plan.status}">${plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}</div>
        </div>
    `).join('');
}

// Load referral data
async function loadReferralData() {
    try {
        // Mock referral data - replace with real API call
        const referralData = {
            totalReferrals: 8,
            totalEarnings: 40,
            referralCode: 'WAYZOFN4V0A'
        };
        
        updateReferralStats(referralData);
        
    } catch (error) {
        console.error('Failed to load referral data:', error);
    }
}

// Update referral statistics
function updateReferralStats(data) {
    const referralCountEl = document.getElementById('referralCount');
    const referralEarningsEl = document.getElementById('referralEarnings');
    const referralCodeEl = document.getElementById('referralCode');
    
    if (referralCountEl) referralCountEl.textContent = data.totalReferrals;
    if (referralEarningsEl) referralEarningsEl.textContent = `$${data.totalEarnings}`;
    if (referralCodeEl) referralCodeEl.value = data.referralCode;
}

// Load billing data
async function loadBillingData() {
    try {
        // Mock billing data - replace with real API call
        const billingData = {
            totalSpent: 57,
            reportsPurchased: 3,
            purchaseHistory: [
                {
                    date: '2025-08-25',
                    description: 'Paris Trip Report',
                    amount: 19,
                    status: 'completed'
                },
                {
                    date: '2025-08-20',
                    description: 'Tokyo Trip Report',
                    amount: 19,
                    status: 'completed'
                },
                {
                    date: '2025-08-15',
                    description: 'Bali Trip Report',
                    amount: 19,
                    status: 'completed'
                }
            ]
        };
        
        updateBillingStats(billingData);
        displayPurchaseHistory(billingData.purchaseHistory);
        
    } catch (error) {
        console.error('Failed to load billing data:', error);
    }
}

// Update billing statistics
function updateBillingStats(data) {
    const totalSpentEl = document.getElementById('totalSpent');
    const reportsPurchasedEl = document.getElementById('reportsPurchased');
    
    if (totalSpentEl) totalSpentEl.textContent = `$${data.totalSpent}`;
    if (reportsPurchasedEl) reportsPurchasedEl.textContent = data.reportsPurchased;
}

// Display purchase history
function displayPurchaseHistory(history) {
    const purchaseHistoryEl = document.getElementById('purchaseHistory');
    if (!purchaseHistoryEl) return;
    
    purchaseHistoryEl.innerHTML = history.map(purchase => `
        <div class="purchase-item">
            <div class="purchase-info">
                <h4>${purchase.description}</h4>
                <p>${new Date(purchase.date).toLocaleDateString()}</p>
            </div>
            <div class="purchase-amount">$${purchase.amount}</div>
            <div class="purchase-status ${purchase.status}">${purchase.status}</div>
        </div>
    `).join('');
}

// Load user information
function loadUserInfo() {
    // Get user info from localStorage
    const userData = JSON.parse(localStorage.getItem('wayzo_user') || '{}');
    const isAuthenticated = localStorage.getItem('wayzo_authenticated') === 'true';
    
    if (!isAuthenticated) {
        // Redirect to main page if not authenticated
        window.location.href = '/';
        return;
    }
    
    // Update user info display
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    const userAvatarEl = document.getElementById('userAvatar');
    
    if (userNameEl) userNameEl.textContent = userData.name || 'User Name';
    if (userEmailEl) userEmailEl.textContent = userData.email || 'user@example.com';
    if (userAvatarEl && userData.avatar) userAvatarEl.src = userData.avatar;
}

// Setup event listeners
function setupEventListeners() {
    // Copy referral code
    const copyBtn = document.querySelector('[onclick="copyReferralCode()"]');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyReferralCode);
    }
}

// Copy referral code to clipboard
function copyReferralCode() {
    const referralCodeEl = document.getElementById('referralCode');
    if (referralCodeEl) {
        navigator.clipboard.writeText(referralCodeEl.value).then(() => {
            showNotification('Referral code copied to clipboard!', 'success');
        }).catch(() => {
            showNotification('Failed to copy referral code', 'error');
        });
    }
}

// Show referral modal
function showReferralModal() {
    const modal = document.getElementById('referralModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

// Hide referral modal
function hideReferralModal() {
    const modal = document.getElementById('referralModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Share referral
function shareReferral(platform) {
    const referralCode = document.getElementById('referralCode')?.value || 'WAYZOFN4V0A';
    const shareText = `Check out Wayzo - AI-powered trip planning! Use my referral code ${referralCode} for $5 off your next plan! 🚀✈️`;
    const shareUrl = window.location.origin;
    
    let shareLink = '';
    
    switch (platform) {
        case 'facebook':
            shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
            break;
        case 'twitter':
            shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
            break;
        case 'whatsapp':
            shareLink = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
            break;
        case 'email':
            shareLink = `mailto:?subject=Check out Wayzo!&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`;
            break;
    }
    
    if (shareLink) {
        window.open(shareLink, '_blank');
        hideReferralModal();
        showNotification('Shared successfully!', 'success');
    }
}

// Create new plan
function createNewPlan() {
    // Open main page in new tab to create a new plan
    window.open('/', '_blank');
}

// Sign out
function signOut() {
    // Clear authentication
    localStorage.removeItem('wayzo_authenticated');
    localStorage.removeItem('wayzo_user');
    
    // Redirect to main page
    window.location.href = '/';
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    // Add notification styles if not present
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                color: #333;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 1rem;
                max-width: 400px;
                animation: slideIn 0.3s ease;
            }
            
            .notification-success {
                border-left: 4px solid #10b981;
            }
            
            .notification-error {
                border-left: 4px solid #ef4444;
            }
            
            .notification-info {
                border-left: 4px solid #3b82f6;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 1.2rem;
                cursor: pointer;
                color: #666;
                margin-left: auto;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}
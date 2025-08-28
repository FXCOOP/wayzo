// Wayzo - AI-Powered Trip Planning App
class WayzoApp {
    constructor() {
        this.currentUser = null;
        this.userPlans = [];
        this.referralCredits = 0;
        this.isAuthenticated = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.setupGoogleAuth();
        this.setupPayPal();
        this.setupCookieBanner();
        this.loadUserData();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('startPlanningBtn')?.addEventListener('click', () => {
            document.getElementById('planningForm').scrollIntoView({ behavior: 'smooth' });
        });

        document.getElementById('demoBtn')?.addEventListener('click', () => {
            this.showDemo();
        });

        // Form interactions
        document.getElementById('generatePreviewBtn')?.addEventListener('click', () => {
            this.generatePreview();
        });

        document.getElementById('generateFullPlanBtn')?.addEventListener('click', () => {
            this.generateFullPlan();
        });

        document.getElementById('savePreviewBtn')?.addEventListener('click', () => {
            this.savePreview();
        });

        // Date flexibility toggle
        document.querySelectorAll('input[name="dateFlexibility"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleDateSelection(e.target.value);
            });
        });

        // Traveler count changes
        document.getElementById('adults')?.addEventListener('change', (e) => {
            this.updateChildrenAges();
        });

        document.getElementById('children')?.addEventListener('change', (e) => {
            this.updateChildrenAges();
        });

        // Style selection
        document.querySelectorAll('input[name="style"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateStyleSelection(e.target.value);
            });
        });

        // Dietary needs
        document.querySelectorAll('input[name="dietary"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.updateDietarySelection(e.target);
            });
        });

        // File upload
        document.getElementById('fileUpload')?.addEventListener('change', (e) => {
            this.handleFileUpload(e);
        });

        // User authentication
        document.getElementById('loginBtn')?.addEventListener('click', () => {
            this.toggleUserMenu();
        });

        document.getElementById('signOutBtn')?.addEventListener('click', () => {
            this.signOut();
        });

        // Dashboard navigation
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchDashboardTab(e.currentTarget.dataset.tab);
            });
        });

        // Referral system
        document.getElementById('copyReferralBtn')?.addEventListener('click', () => {
            this.copyReferralLink();
        });

        document.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.shareReferral(e.currentTarget.classList[1]);
            });
        });

        // Profile form
        document.getElementById('profileForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });

        // Create new plan
        document.getElementById('createNewPlanBtn')?.addEventListener('click', () => {
            this.createNewPlan();
        });

        // Cookie banner
        document.getElementById('acceptAllCookies')?.addEventListener('click', () => {
            this.acceptCookies();
        });

        document.getElementById('rejectNonEssential')?.addEventListener('click', () => {
            this.rejectNonEssentialCookies();
        });
    }

    setupGoogleAuth() {
        // Google OAuth initialization
        if (typeof google !== 'undefined') {
            google.accounts.id.initialize({
                client_id: 'YOUR_GOOGLE_CLIENT_ID', // Replace with actual client ID
                callback: this.handleGoogleSignIn.bind(this),
                auto_select: false,
                cancel_on_tap_outside: true,
            });

            // Add Google sign-in button to login button
            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) {
                google.accounts.id.renderButton(loginBtn, {
                    theme: 'outline',
                    size: 'large',
                    text: 'signin_with',
                    shape: 'rectangular',
                });
            }
        }
    }

    setupPayPal() {
        // PayPal integration
        if (typeof paypal !== 'undefined') {
            paypal.Buttons({
                createOrder: (data, actions) => {
                    return actions.order.create({
                        purchase_units: [{
                            amount: {
                                value: '19.00'
                            },
                            description: 'Wayzo AI Travel Plan'
                        }]
                    });
                },
                onApprove: (data, actions) => {
                    return actions.order.capture().then((details) => {
                        this.handlePaymentSuccess(details);
                    });
                },
                onError: (err) => {
                    console.error('PayPal error:', err);
                    this.showNotification('Payment failed. Please try again.', 'error');
                }
            }).render('#paypal-button-container');
        }
    }

    setupCookieBanner() {
        const cookieBanner = document.getElementById('cookieBanner');
        if (cookieBanner && !localStorage.getItem('cookieConsent')) {
            cookieBanner.classList.remove('hidden');
        }
    }

    checkAuthStatus() {
        const token = localStorage.getItem('wayzo_token');
        if (token) {
            this.isAuthenticated = true;
            this.currentUser = JSON.parse(localStorage.getItem('wayzo_user') || '{}');
            this.updateUIForAuthenticatedUser();
        }
    }

    async handleGoogleSignIn(response) {
        try {
            // In a real app, you'd send this to your backend
            const payload = this.decodeJwtResponse(response.credential);
            
            this.currentUser = {
                id: payload.sub,
                name: payload.name,
                email: payload.email,
                picture: payload.picture
            };

            this.isAuthenticated = true;
            localStorage.setItem('wayzo_token', response.credential);
            localStorage.setItem('wayzo_user', JSON.stringify(this.currentUser));

            this.updateUIForAuthenticatedUser();
            this.showNotification(`Welcome back, ${this.currentUser.name}!`, 'success');
        } catch (error) {
            console.error('Google sign-in error:', error);
            this.showNotification('Sign-in failed. Please try again.', 'error');
        }
    }

    decodeJwtResponse(token) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    }

    updateUIForAuthenticatedUser() {
        const loginBtn = document.getElementById('loginBtn');
        const userMenu = document.getElementById('userMenu');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');

        if (loginBtn) {
            loginBtn.innerHTML = `
                <img src="${this.currentUser.picture || '/assets/default-avatar.svg'}" alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">
                ${this.currentUser.name}
            `;
            loginBtn.onclick = () => this.toggleUserMenu();
        }

        if (userAvatar) userAvatar.src = this.currentUser.picture || '/assets/default-avatar.svg';
        if (userName) userName.textContent = this.currentUser.name;
        if (userEmail) userEmail.textContent = this.currentUser.email;

        // Update dashboard
        this.updateDashboard();
    }

    toggleUserMenu() {
        const userMenu = document.getElementById('userMenu');
        if (userMenu) {
            userMenu.classList.toggle('hidden');
        }
    }

    signOut() {
        this.currentUser = null;
        this.isAuthenticated = false;
        localStorage.removeItem('wayzo_token');
        localStorage.removeItem('wayzo_user');

        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.innerHTML = `
                <i class="fas fa-user"></i>
                Sign In
            `;
            loginBtn.onclick = () => this.showLoginOptions();
        }

        document.getElementById('userMenu')?.classList.add('hidden');
        this.showNotification('Signed out successfully', 'success');
    }

    showLoginOptions() {
        // Show login modal or redirect to login page
        this.showNotification('Please sign in to continue', 'info');
    }

    toggleDateSelection(mode) {
        const exactDates = document.getElementById('exactDates');
        const flexibleDates = document.getElementById('flexibleDates');

        if (mode === 'exact') {
            exactDates.classList.remove('hidden');
            flexibleDates.classList.add('hidden');
        } else {
            exactDates.classList.add('hidden');
            flexibleDates.classList.remove('hidden');
        }
    }

    updateChildrenAges() {
        const childrenCount = parseInt(document.getElementById('children').value) || 0;
        const agesContainer = document.getElementById('childrenAges');
        const agesGrid = document.getElementById('agesGrid');

        if (childrenCount > 0) {
            agesContainer.classList.remove('hidden');
            agesGrid.innerHTML = '';

            for (let i = 0; i < childrenCount; i++) {
                const ageInput = document.createElement('input');
                ageInput.type = 'number';
                ageInput.min = '0';
                ageInput.max = '17';
                ageInput.placeholder = 'Age';
                ageInput.className = 'form-input';
                ageInput.name = `childAge${i}`;
                agesGrid.appendChild(ageInput);
            }
        } else {
            agesContainer.classList.add('hidden');
        }
    }

    updateStyleSelection(style) {
        // Update UI based on style selection
        document.querySelectorAll('.style-chip').forEach(chip => {
            chip.style.borderColor = 'var(--gray-200)';
            chip.style.background = 'transparent';
            chip.style.color = 'var(--gray-700)';
        });

        const selectedChip = document.querySelector(`input[name="style"][value="${style}"] + .style-chip`);
        if (selectedChip) {
            selectedChip.style.borderColor = 'var(--primary-color)';
            selectedChip.style.background = 'var(--primary-color)';
            selectedChip.style.color = 'var(--white)';
        }
    }

    updateDietarySelection(checkbox) {
        if (checkbox.value === 'no-restrictions') {
            // Uncheck other options when "no restrictions" is selected
            document.querySelectorAll('input[name="dietary"]:not([value="no-restrictions"])').forEach(cb => {
                cb.checked = false;
            });
        } else {
            // Uncheck "no restrictions" when other options are selected
            const noRestrictions = document.querySelector('input[name="dietary"][value="no-restrictions"]');
            if (noRestrictions) noRestrictions.checked = false;
        }
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        const fileLabel = document.querySelector('.file-label span');
        
        if (file) {
            fileLabel.textContent = file.name;
            this.showNotification(`File "${file.name}" uploaded successfully`, 'success');
        }
    }

    async generatePreview() {
        if (!this.validateForm()) return;

        this.showLoading('Generating preview...');
        
        try {
            const formData = this.getFormData();
            const preview = await this.callAIAPI(formData, 'preview');
            
            this.showPreview(preview);
            this.showNotification('Preview generated successfully!', 'success');
        } catch (error) {
            console.error('Preview generation error:', error);
            this.showNotification('Failed to generate preview. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async generateFullPlan() {
        if (!this.isAuthenticated) {
            this.showNotification('Please sign in to generate a full plan', 'info');
            return;
        }

        if (!this.validateForm()) return;

        this.showLoading('Generating full plan...');
        
        try {
            const formData = this.getFormData();
            const fullPlan = await this.callAIAPI(formData, 'full');
            
            this.showPaywall();
            this.showNotification('Full plan generated! Complete payment to access.', 'success');
        } catch (error) {
            console.error('Full plan generation error:', error);
            this.showNotification('Failed to generate full plan. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async savePreview() {
        if (!this.isAuthenticated) {
            this.showNotification('Please sign in to save plans', 'info');
            return;
        }

        try {
            const formData = this.getFormData();
            const preview = await this.callAIAPI(formData, 'preview');
            
            // Save to user's plans
            const plan = {
                id: Date.now().toString(),
                type: 'preview',
                data: formData,
                preview: preview,
                createdAt: new Date().toISOString(),
                status: 'saved'
            };

            this.userPlans.push(plan);
            this.saveUserData();
            this.updateDashboard();
            
            this.showNotification('Preview saved successfully!', 'success');
        } catch (error) {
            console.error('Save preview error:', error);
            this.showNotification('Failed to save preview. Please try again.', 'error');
        }
    }

    validateForm() {
        const requiredFields = ['destination', 'budget'];
        let isValid = true;

        requiredFields.forEach(field => {
            const element = document.getElementById(field);
            if (!element.value.trim()) {
                element.style.borderColor = 'var(--error-color)';
                isValid = false;
            } else {
                element.style.borderColor = 'var(--gray-200)';
            }
        });

        if (!isValid) {
            this.showNotification('Please fill in all required fields', 'error');
        }

        return isValid;
    }

    getFormData() {
        const form = document.getElementById('tripForm');
        const formData = new FormData(form);
        const data = {};

        // Get all form values
        for (let [key, value] of formData.entries()) {
            if (key === 'dietary') {
                if (!data[key]) data[key] = [];
                data[key].push(value);
            } else {
                data[key] = value;
            }
        }

        // Get selected style
        const selectedStyle = document.querySelector('input[name="style"]:checked');
        if (selectedStyle) data.style = selectedStyle.value;

        // Get date flexibility
        const dateFlexibility = document.querySelector('input[name="dateFlexibility"]:checked');
        if (dateFlexibility) data.dateFlexibility = dateFlexibility.value;

        return data;
    }

    async callAIAPI(data, type) {
        // Simulate API call - replace with actual backend integration
        return new Promise((resolve) => {
            setTimeout(() => {
                if (type === 'preview') {
                    resolve(this.generateMockPreview(data));
                } else {
                    resolve(this.generateMockFullPlan(data));
                }
            }, 2000);
        });
    }

    generateMockPreview(data) {
        return {
            destination: data.destination,
            duration: data.tripDuration || '5 days',
            style: data.style || 'mid-range',
            travelers: `${data.adults || 2} adults, ${data.children || 0} children`,
            budget: `${data.currency || 'USD'} ${data.budget || '2000'}`,
            highlights: [
                'Explore iconic landmarks and hidden gems',
                'Experience local cuisine and culture',
                'Visit must-see attractions and museums',
                'Enjoy scenic views and photo opportunities',
                'Discover authentic local experiences'
            ]
        };
    }

    generateMockFullPlan(data) {
        return {
            ...this.generateMockPreview(data),
            detailedItinerary: [
                {
                    day: 1,
                    title: 'Arrival & Orientation',
                    activities: ['Airport transfer', 'Hotel check-in', 'Welcome dinner', 'Evening stroll']
                },
                {
                    day: 2,
                    title: 'City Highlights',
                    activities: ['Breakfast at hotel', 'Guided city tour', 'Lunch at local restaurant', 'Museum visit', 'Evening entertainment']
                }
            ],
            accommodations: [
                {
                    name: 'Premium Hotel',
                    rating: 4.5,
                    price: 'USD 150/night',
                    amenities: ['Free WiFi', 'Breakfast included', 'Central location']
                }
            ],
            restaurants: [
                {
                    name: 'Local Bistro',
                    cuisine: 'Local specialties',
                    price: 'USD 25-40 per person',
                    rating: 4.3
                }
            ]
        };
    }

    showPreview(preview) {
        const previewSection = document.getElementById('previewSection');
        const previewContent = document.getElementById('previewContent');

        if (previewContent) {
            previewContent.innerHTML = `
                <div class="preview-card">
                    <div class="preview-header">
                        <h3>🎯 ${preview.destination} Trip Preview</h3>
                        <div class="preview-stats">
                            <div class="stat">
                                <span class="stat-label">Duration</span>
                                <span class="stat-value">${preview.duration}</span>
                            </div>
                            <div class="stat">
                                <span class="stat-label">Style</span>
                                <span class="stat-value">${preview.style}</span>
                            </div>
                            <div class="stat">
                                <span class="stat-label">Travelers</span>
                                <span class="stat-value">${preview.travelers}</span>
                            </div>
                            <div class="stat">
                                <span class="stat-label">Budget</span>
                                <span class="stat-value">${preview.budget}</span>
                            </div>
                        </div>
                        <p class="preview-description">
                            Ready to create your personalized ${preview.duration} ${preview.style} adventure in ${preview.destination}? 
                            Our AI will craft a detailed itinerary with hotels, activities, dining, and insider tips.
                        </p>
                        <div class="preview-features">
                            <span class="feature">🗺️ Custom routes</span>
                            <span class="feature">🏨 Hotel picks</span>
                            <span class="feature">🍽️ Restaurant guide</span>
                            <span class="feature">🎫 Activity booking</span>
                            <span class="feature">📱 Mobile-friendly</span>
                            <span class="feature">📄 PDF export</span>
                        </div>
                        <div class="preview-cta">
                            Click "Generate full plan" to create your complete itinerary!
                        </div>
                    </div>
                </div>
            `;
        }

        previewSection.classList.remove('hidden');
        previewSection.scrollIntoView({ behavior: 'smooth' });
    }

    showPaywall() {
        const paywallSection = document.getElementById('paywallSection');
        if (paywallSection) {
            paywallSection.classList.remove('hidden');
            paywallSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    async handlePaymentSuccess(details) {
        try {
            // Save the full plan to user's account
            const formData = this.getFormData();
            const fullPlan = await this.callAIAPI(formData, 'full');
            
            const plan = {
                id: Date.now().toString(),
                type: 'full',
                data: formData,
                plan: fullPlan,
                createdAt: new Date().toISOString(),
                status: 'paid',
                paymentId: details.id
            };

            this.userPlans.push(plan);
            this.saveUserData();
            this.updateDashboard();

            this.showNotification('Payment successful! Your full plan is now available.', 'success');
            
            // Hide paywall and show success message
            document.getElementById('paywallSection')?.classList.add('hidden');
            
            // Redirect to dashboard or show plan
            this.showUserDashboard();
        } catch (error) {
            console.error('Payment success handling error:', error);
            this.showNotification('Payment successful but failed to save plan. Contact support.', 'error');
        }
    }

    showUserDashboard() {
        document.getElementById('userDashboard')?.classList.remove('hidden');
        document.getElementById('planningForm')?.classList.add('hidden');
        this.updateDashboard();
    }

    updateDashboard() {
        if (!this.isAuthenticated) return;

        // Update stats
        document.getElementById('totalPlans')?.textContent = this.userPlans.length;
        document.getElementById('referralCredits')?.textContent = `$${this.referralCredits}`;
        document.getElementById('activePlans')?.textContent = this.userPlans.filter(p => p.status === 'paid').length;

        // Update referral stats
        document.getElementById('totalReferrals')?.textContent = this.currentUser.referrals || 0;
        document.getElementById('earnedCredits')?.textContent = `$${this.referralCredits}`;

        // Update referral link
        const referralLink = document.getElementById('referralLink');
        if (referralLink) {
            referralLink.value = `${window.location.origin}?ref=${this.currentUser.id}`;
        }

        // Update plans list
        this.updatePlansList();
    }

    updatePlansList() {
        const plansList = document.getElementById('plansList');
        const recentPlansList = document.getElementById('recentPlansList');

        if (this.userPlans.length === 0) {
            if (plansList) plansList.innerHTML = '<p class="no-plans">No plans yet. Start planning your next adventure!</p>';
            if (recentPlansList) recentPlansList.innerHTML = '<p class="no-plans">No plans yet. Start planning your next adventure!</p>';
            return;
        }

        const plansHTML = this.userPlans.map(plan => `
            <div class="plan-item">
                <div class="plan-header">
                    <h4>${plan.data.destination} - ${plan.type === 'full' ? 'Full Plan' : 'Preview'}</h4>
                    <span class="plan-status ${plan.status}">${plan.status}</span>
                </div>
                <div class="plan-details">
                    <p><strong>Duration:</strong> ${plan.data.tripDuration || '5'} days</p>
                    <p><strong>Style:</strong> ${plan.data.style || 'mid-range'}</p>
                    <p><strong>Budget:</strong> ${plan.data.currency || 'USD'} ${plan.data.budget}</p>
                    <p><strong>Created:</strong> ${new Date(plan.createdAt).toLocaleDateString()}</p>
                </div>
                <div class="plan-actions">
                    <button class="btn btn-secondary btn-small" onclick="app.viewPlan('${plan.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${plan.type === 'preview' ? `
                        <button class="btn btn-primary btn-small" onclick="app.upgradeToFull('${plan.id}')">
                            <i class="fas fa-arrow-up"></i> Upgrade
                        </button>
                    ` : ''}
                    <button class="btn btn-outline btn-small" onclick="app.downloadPlan('${plan.id}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        `).join('');

        if (plansList) plansList.innerHTML = plansHTML;
        if (recentPlansList) {
            const recentPlans = this.userPlans.slice(0, 3);
            recentPlansList.innerHTML = recentPlans.map(plan => `
                <div class="recent-plan-item">
                    <h5>${plan.data.destination}</h5>
                    <p>${plan.type === 'full' ? 'Full Plan' : 'Preview'} • ${plan.data.tripDuration || '5'} days</p>
                    <small>${new Date(plan.createdAt).toLocaleDateString()}</small>
                </div>
            `).join('');
        }
    }

    switchDashboardTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.dashboard-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Remove active class from all sidebar items
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });

        // Show selected tab
        const selectedTab = document.getElementById(`${tabName}Tab`);
        if (selectedTab) selectedTab.classList.add('active');

        // Add active class to clicked sidebar item
        const clickedItem = document.querySelector(`[data-tab="${tabName}"]`);
        if (clickedItem) clickedItem.classList.add('active');
    }

    copyReferralLink() {
        const referralLink = document.getElementById('referralLink');
        if (referralLink) {
            navigator.clipboard.writeText(referralLink.value).then(() => {
                this.showNotification('Referral link copied to clipboard!', 'success');
            }).catch(() => {
                this.showNotification('Failed to copy link', 'error');
            });
        }
    }

    shareReferral(platform) {
        const referralLink = document.getElementById('referralLink')?.value || '';
        const message = `Check out Wayzo - AI-powered trip planning! Use my referral link: ${referralLink}`;

        let shareUrl = '';
        switch (platform) {
            case 'share-email':
                shareUrl = `mailto:?subject=Wayzo Trip Planning&body=${encodeURIComponent(message)}`;
                break;
            case 'share-whatsapp':
                shareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                break;
            case 'share-telegram':
                shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Check out Wayzo!')}`;
                break;
        }

        if (shareUrl) {
            window.open(shareUrl, '_blank');
        }
    }

    async updateProfile() {
        const form = document.getElementById('profileForm');
        const formData = new FormData(form);
        
        try {
            // Update user profile
            this.currentUser = {
                ...this.currentUser,
                name: formData.get('name'),
                phone: formData.get('phone'),
                location: formData.get('location')
            };

            localStorage.setItem('wayzo_user', JSON.stringify(this.currentUser));
            this.updateUIForAuthenticatedUser();
            
            this.showNotification('Profile updated successfully!', 'success');
        } catch (error) {
            console.error('Profile update error:', error);
            this.showNotification('Failed to update profile', 'error');
        }
    }

    createNewPlan() {
        document.getElementById('userDashboard')?.classList.add('hidden');
        document.getElementById('planningForm')?.classList.remove('hidden');
        document.getElementById('planningForm')?.scrollIntoView({ behavior: 'smooth' });
    }

    viewPlan(planId) {
        const plan = this.userPlans.find(p => p.id === planId);
        if (!plan) return;

        // Show plan details in a modal or new section
        this.showNotification(`Viewing plan for ${plan.data.destination}`, 'info');
    }

    upgradeToFull(planId) {
        const plan = this.userPlans.find(p => p.id === planId);
        if (!plan) return;

        // Show paywall for upgrade
        this.showPaywall();
        this.showNotification('Upgrade to full plan', 'info');
    }

    downloadPlan(planId) {
        const plan = this.userPlans.find(p => p.id === planId);
        if (!plan) return;

        // Generate and download PDF
        this.showNotification('Generating PDF download...', 'info');
        
        // Simulate PDF generation
        setTimeout(() => {
            const link = document.createElement('a');
            link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(plan, null, 2));
            link.download = `wayzo-plan-${plan.data.destination}-${plan.id}.json`;
            link.click();
            this.showNotification('Plan downloaded successfully!', 'success');
        }, 2000);
    }

    showDemo() {
        // Fill form with demo data
        document.getElementById('destination').value = 'Paris, France';
        document.getElementById('budget').value = '2500';
        document.getElementById('startDate').value = '2025-06-15';
        document.getElementById('endDate').value = '2025-06-22';
        
        // Scroll to form
        document.getElementById('planningForm').scrollIntoView({ behavior: 'smooth' });
        this.showNotification('Demo data loaded! Click "Generate preview" to see it in action.', 'info');
    }

    acceptCookies() {
        localStorage.setItem('cookieConsent', 'all');
        document.getElementById('cookieBanner')?.classList.add('hidden');
        this.showNotification('Cookie preferences saved', 'success');
    }

    rejectNonEssentialCookies() {
        localStorage.setItem('cookieConsent', 'essential');
        document.getElementById('cookieBanner')?.classList.add('hidden');
        this.showNotification('Essential cookies only enabled', 'info');
    }

    showLoading(message) {
        // Create loading overlay
        const loading = document.createElement('div');
        loading.id = 'loadingOverlay';
        loading.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
        loading.className = 'loading-overlay';
        document.body.appendChild(loading);
    }

    hideLoading() {
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.remove();
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);

        // Close button functionality
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'info-circle';
        }
    }

    loadUserData() {
        const savedPlans = localStorage.getItem('wayzo_plans');
        if (savedPlans) {
            this.userPlans = JSON.parse(savedPlans);
        }

        const savedCredits = localStorage.getItem('wayzo_credits');
        if (savedCredits) {
            this.referralCredits = parseInt(savedCredits);
        }
    }

    saveUserData() {
        localStorage.setItem('wayzo_plans', JSON.stringify(this.userPlans));
        localStorage.setItem('wayzo_credits', this.referralCredits.toString());
    }

    // Utility functions
    changeNumber(fieldId, change) {
        const field = document.getElementById(fieldId);
        const currentValue = parseInt(field.value) || 0;
        const newValue = Math.max(parseInt(field.min) || 0, Math.min(parseInt(field.max) || 10, currentValue + change));
        field.value = newValue;
        
        if (fieldId === 'children') {
            this.updateChildrenAges();
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WayzoApp();
});

// Add CSS for new components
const additionalStyles = `
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }

    .loading-content {
        background: white;
        padding: 2rem;
        border-radius: 1rem;
        text-align: center;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #e5e7eb;
        border-top: 4px solid #2563eb;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        max-width: 400px;
        border-left: 4px solid #2563eb;
    }

    .notification-success { border-left-color: #10b981; }
    .notification-error { border-left-color: #ef4444; }
    .notification-warning { border-left-color: #f59e0b; }
    .notification-info { border-left-color: #2563eb; }

    .notification-content {
        padding: 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .notification-content i {
        font-size: 1.25rem;
    }

    .notification-success i { color: #10b981; }
    .notification-error i { color: #ef4444; }
    .notification-warning i { color: #f59e0b; }
    .notification-info i { color: #2563eb; }

    .notification-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #6b7280;
        margin-left: auto;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.375rem;
    }

    .notification-close:hover {
        background: #f3f4f6;
        color: #374151;
    }

    .plan-item {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.75rem;
        padding: 1.5rem;
        margin-bottom: 1rem;
    }

    .plan-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .plan-status {
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
    }

    .plan-status.saved { background: #dbeafe; color: #1e40af; }
    .plan-status.paid { background: #d1fae5; color: #065f46; }

    .plan-details p {
        margin-bottom: 0.5rem;
        color: #6b7280;
    }

    .plan-actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1rem;
    }

    .recent-plan-item {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        padding: 1rem;
        margin-bottom: 0.75rem;
    }

    .recent-plan-item h5 {
        margin-bottom: 0.5rem;
        color: #111827;
    }

    .recent-plan-item p {
        margin-bottom: 0.5rem;
        color: #6b7280;
        font-size: 0.875rem;
    }

    .recent-plan-item small {
        color: #9ca3af;
        font-size: 0.75rem;
    }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

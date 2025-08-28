// ====== WAYZO TRIP PLANNING APPLICATION ======

// Global application state
window.wayzoApp = {
  isAuthenticated: false,
  currentUser: null,
  currentLanguage: 'en',
  translations: null,
  maxDestinations: 10
};

// ====== MULTI-LANGUAGE SYSTEM ======
class LanguageManager {
  constructor() {
    this.currentLanguage = 'en';
    this.translations = window.WayzoTranslations || {};
    this.init();
  }

  init() {
    // Load saved language preference
    const savedLanguage = localStorage.getItem('wayzo_language');
    if (savedLanguage && this.translations[savedLanguage]) {
      this.setLanguage(savedLanguage);
    }
    
    // Setup language selector
    this.setupLanguageSelector();
  }

  setLanguage(langCode) {
    if (!this.translations[langCode]) {
      console.warn(`Language ${langCode} not supported, falling back to English`);
      langCode = 'en';
    }

    this.currentLanguage = langCode;
    window.wayzoApp.currentLanguage = langCode;
    localStorage.setItem('wayzo_language', langCode);
    
    // Update language selector
    const selector = document.getElementById('languageSelect');
    if (selector) {
      selector.value = langCode;
    }
    
    // Translate all elements
    this.translatePage();
  }

  translatePage() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.getText(key);
      if (translation) {
        element.textContent = translation;
      }
    });

    // Handle placeholders
    const inputs = document.querySelectorAll('[data-i18n-placeholder]');
    inputs.forEach(input => {
      const key = input.getAttribute('data-i18n-placeholder');
      const translation = this.getText(key);
      if (translation) {
        input.placeholder = translation;
      }
    });
  }

  getText(key) {
    return this.translations[this.currentLanguage]?.[key] || 
           this.translations['en']?.[key] || 
           key;
  }

  setupLanguageSelector() {
    const selector = document.getElementById('languageSelect');
    if (selector) {
      selector.addEventListener('change', (e) => {
        this.setLanguage(e.target.value);
      });
    }
  }
}

// ====== AUTHENTICATION SYSTEM ======
class AuthenticationManager {
  constructor() {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.init();
  }

  init() {
    // Check for existing session
    this.checkExistingSession();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup Google OAuth
    this.setupGoogleOAuth();
  }

  checkExistingSession() {
    const savedUser = localStorage.getItem('wayzo_user');
    const savedToken = localStorage.getItem('wayzo_token');
    
    if (savedUser && savedToken) {
      try {
        this.currentUser = JSON.parse(savedUser);
        this.isAuthenticated = true;
        this.updateUI();
        console.log('Session restored:', this.currentUser);
      } catch (e) {
        console.error('Failed to restore session:', e);
        this.clearSession();
      }
    }
  }

  setupEventListeners() {
    // Auth modal triggers
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
      authBtn.addEventListener('click', () => this.showAuthModal());
    }

    const closeAuthModal = document.getElementById('closeAuthModal');
    if (closeAuthModal) {
      closeAuthModal.addEventListener('click', () => this.hideAuthModal());
    }

    // Tab switching
    const authTabs = document.querySelectorAll('.auth-tab');
    authTabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.tab));
    });

    // Form submissions
    const signinForm = document.getElementById('signinForm');
    if (signinForm) {
      signinForm.addEventListener('submit', (e) => this.handleManualSignIn(e));
    }

    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => this.handleManualSignUp(e));
    }

    // Demo mode
    const demoBtn = document.getElementById('demoSignInBtn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => this.handleDemoMode());
    }

    // User menu
    const userMenuBtn = document.getElementById('userMenuBtn');
    if (userMenuBtn) {
      userMenuBtn.addEventListener('click', () => this.toggleUserMenu());
    }

    // Sign out
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => this.signOut());
    }

    // Admin panel
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
      adminBtn.addEventListener('click', () => this.openAdminPanel());
    }
  }

  setupGoogleOAuth() {
    // Google Sign In
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    if (googleSignInBtn) {
      googleSignInBtn.addEventListener('click', () => this.handleGoogleSignIn());
    }

    // Google Sign Up
    const googleSignUpBtn = document.getElementById('googleSignUpBtn');
    if (googleSignUpBtn) {
      googleSignUpBtn.addEventListener('click', () => this.handleGoogleSignUp());
    }
  }

  showAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  hideAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  switchAuthTab(tabName) {
    // Update active tab
    const tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }

    // Update active content
    const contents = document.querySelectorAll('.auth-tab-content');
    contents.forEach(content => content.classList.remove('active'));
    
    const activeContent = document.getElementById(`${tabName}Tab`);
    if (activeContent) {
      activeContent.classList.add('active');
    }
  }

  async handleManualSignIn(e) {
    e.preventDefault();
    
    const email = document.getElementById('signinEmail').value.trim();
    const password = document.getElementById('signinPassword').value;
    
    if (!email || !password) {
      this.showNotification('Please fill in all fields', 'error');
      return;
    }

    try {
      // Simulate API call
      const user = await this.mockSignIn(email, password);
      this.authenticateUser(user);
      this.hideAuthModal();
      this.showNotification('Welcome back!', 'success');
    } catch (error) {
      this.showNotification(error.message, 'error');
    }
  }

  async handleManualSignUp(e) {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
      this.showNotification('Please fill in all fields', 'error');
      return;
    }
    
    if (password !== confirmPassword) {
      this.showNotification('Passwords do not match', 'error');
      return;
    }
    
    if (password.length < 8) {
      this.showNotification('Password must be at least 8 characters', 'error');
      return;
    }
    
    if (!agreeTerms) {
      this.showNotification('Please agree to the terms', 'error');
      return;
    }

    try {
      // Simulate API call
      const user = await this.mockSignUp(name, email, password);
      this.authenticateUser(user);
      this.hideAuthModal();
      this.showNotification('Account created successfully!', 'success');
    } catch (error) {
      this.showNotification(error.message, 'error');
    }
  }

  async handleGoogleSignIn() {
    try {
      // Simulate Google OAuth
      const user = await this.mockGoogleSignIn();
      this.authenticateUser(user);
      this.hideAuthModal();
      this.showNotification('Welcome back!', 'success');
    } catch (error) {
      this.showNotification('Google sign-in failed. Please try again.', 'error');
    }
  }

  async handleGoogleSignUp() {
    try {
      // Simulate Google OAuth
      const user = await this.mockGoogleSignUp();
      this.authenticateUser(user);
      this.hideAuthModal();
      this.showNotification('Account created successfully!', 'success');
    } catch (error) {
      this.showNotification('Google sign-up failed. Please try again.', 'error');
    }
  }

  handleDemoMode() {
    const demoUser = {
      id: 'demo-123',
      name: 'Demo User',
      email: 'demo@wayzo.com',
      avatar: '/assets/default-avatar.svg',
      isDemo: true
    };
    
    this.authenticateUser(demoUser);
    this.hideAuthModal();
    this.showNotification('Demo mode activated!', 'success');
  }

  authenticateUser(user) {
    this.currentUser = user;
    this.isAuthenticated = true;
    window.wayzoApp.currentUser = user;
    window.wayzoApp.isAuthenticated = true;
    
    // Save to localStorage
    localStorage.setItem('wayzo_user', JSON.stringify(user));
    localStorage.setItem('wayzo_token', 'demo-token-' + Date.now());
    
    // Update UI
    this.updateUI();
    
    // Update global state
    window.wayzoApp.currentUser = user;
    window.wayzoApp.isAuthenticated = true;
  }

  signOut() {
    this.currentUser = null;
    this.isAuthenticated = false;
    window.wayzoApp.currentUser = null;
    window.wayzoApp.isAuthenticated = false;
    
    // Clear localStorage
    this.clearSession();
    
    // Update UI
    this.updateUI();
    
    // Hide user menu
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
      userMenu.classList.add('hidden');
    }
    
    this.showNotification('Signed out successfully', 'success');
  }

  clearSession() {
    localStorage.removeItem('wayzo_user');
    localStorage.removeItem('wayzo_token');
  }

  updateUI() {
    const authBtn = document.getElementById('authBtn');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenu = document.getElementById('userMenu');
    
    if (this.isAuthenticated) {
      // Hide auth button, show user menu
      if (authBtn) authBtn.classList.add('hidden');
      if (userMenuBtn) userMenuBtn.classList.remove('hidden');
      if (userMenu) userMenu.classList.remove('hidden');
      
      // Update user info
      this.updateUserInfo();
      
      // Show admin button if user is admin
      this.checkAdminStatus();
    } else {
      // Show auth button, hide user menu
      if (authBtn) authBtn.classList.remove('hidden');
      if (userMenuBtn) userMenuBtn.classList.add('hidden');
      if (userMenu) userMenu.classList.add('hidden');
    }
  }

  updateUserInfo() {
    if (!this.currentUser) return;
    
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userName) userName.textContent = this.currentUser.name;
    if (userEmail) userEmail.textContent = this.currentUser.email;
    if (userAvatar && this.currentUser.avatar) {
      userAvatar.src = this.currentUser.avatar;
    }
  }

  checkAdminStatus() {
    // Demo user is admin for testing
    const adminBtn = document.querySelector('.admin-only');
    if (adminBtn) {
      if (this.currentUser?.isDemo || this.currentUser?.role === 'admin') {
        adminBtn.style.display = 'block';
      } else {
        adminBtn.style.display = 'none';
      }
    }
  }

  toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
      userMenu.classList.toggle('hidden');
    }
  }

  openAdminPanel() {
    window.open('/admin.html', '_blank');
  }

  // Mock API calls for demo purposes
  async mockSignIn(email, password) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simple validation for demo
    if (email === 'demo@wayzo.com' && password === 'demo123') {
      return {
        id: 'user-123',
        name: 'Demo User',
        email: email,
        avatar: '/assets/default-avatar.svg'
      };
    }
    
    throw new Error('Invalid email or password');
  }

  async mockSignUp(name, email, password) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      id: 'user-' + Date.now(),
      name: name,
      email: email,
      avatar: '/assets/default-avatar.svg'
    };
  }

  async mockGoogleSignIn() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      id: 'google-user-123',
      name: 'Google User',
      email: 'google@wayzo.com',
      avatar: '/assets/default-avatar.svg'
    };
  }

  async mockGoogleSignUp() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      id: 'google-user-' + Date.now(),
      name: 'Google User',
      email: 'google@wayzo.com',
      avatar: '/assets/default-avatar.svg'
    };
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <i class="fas ${this.getNotificationIcon(type)}"></i>
      <span>${message}</span>
      <button class="notification-close">&times;</button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 5000);
    
    // Close button
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      });
    }
  }

  getNotificationIcon(type) {
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };
    return icons[type] || icons.info;
  }
}

// ====== MULTI-DESTINATION PLANNING ======
class MultiDestinationManager {
  constructor() {
    this.destinations = [];
    this.maxDestinations = 10;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.addFirstDestination();
  }

  setupEventListeners() {
    const tripTypeSelector = document.getElementById('tripType');
    if (tripTypeSelector) {
      tripTypeSelector.addEventListener('change', (e) => this.handleTripTypeChange(e));
    }

    const addDestinationBtn = document.getElementById('addDestinationBtn');
    if (addDestinationBtn) {
      addDestinationBtn.addEventListener('click', () => this.addNewDestination());
    }
  }

  handleTripTypeChange(e) {
    const isMulti = e.target.value === 'multi';
    const multiDestinationSection = document.getElementById('multiDestination');
    
    if (multiDestinationSection) {
      if (isMulti) {
        multiDestinationSection.classList.remove('hidden');
        this.addFirstDestination();
      } else {
        multiDestinationSection.classList.add('hidden');
        this.clearDestinations();
      }
    }
  }

  addFirstDestination() {
    if (this.destinations.length === 0) {
      this.addNewDestination();
    }
  }

  addNewDestination() {
    if (this.destinations.length >= this.maxDestinations) {
      this.showMaxDestinationsMessage();
      return;
    }

    const destinationId = 'dest-' + Date.now();
    const destination = {
      id: destinationId,
      placeName: '',
      country: '',
      daysToStay: 1,
      priority: 'medium',
      specialRequirements: ''
    };

    this.destinations.push(destination);
    this.renderDestination(destination);
    this.updateDestinationNumbers();
    this.setupRemoveButtons();
    
    console.log('Destination added:', destination);
  }

  renderDestination(destination) {
    const container = document.getElementById('destinationsContainer');
    if (!container) return;

    const destinationElement = document.createElement('div');
    destinationElement.className = 'destination-item';
    destinationElement.id = destination.id;
    
    destinationElement.innerHTML = `
      <div class="destination-header">
        <span class="destination-number">${this.destinations.length}</span>
        <button class="btn-icon remove-destination" data-destination-id="${destination.id}">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="destination-inputs">
        <div class="form-group">
          <label for="${destination.id}-placeName">Place Name</label>
          <input type="text" id="${destination.id}-placeName" 
                 class="form-input" placeholder="e.g., Paris, Tokyo, New York"
                 value="${destination.placeName}">
        </div>
        <div class="form-group">
          <label for="${destination.id}-country">Country</label>
          <input type="text" id="${destination.id}-country" 
                 class="form-input" placeholder="e.g., France, Japan, USA"
                 value="${destination.country}">
        </div>
        <div class="form-group">
          <label for="${destination.id}-daysToStay">Days to Stay</label>
          <input type="number" id="${destination.id}-daysToStay" 
                 class="form-input" min="1" max="30" value="${destination.daysToStay}">
        </div>
        <div class="form-group">
          <label for="${destination.id}-priority">Priority Level</label>
          <select id="${destination.id}-priority" class="form-input">
            <option value="must-see" ${destination.priority === 'must-see' ? 'selected' : ''}>Must See</option>
            <option value="high" ${destination.priority === 'high' ? 'selected' : ''}>High Priority</option>
            <option value="medium" ${destination.priority === 'medium' ? 'selected' : ''}>Medium Priority</option>
            <option value="low" ${destination.priority === 'low' ? 'selected' : ''}>Low Priority</option>
            <option value="optional" ${destination.priority === 'optional' ? 'selected' : ''}>Optional</option>
          </select>
        </div>
        <div class="form-group">
          <label for="${destination.id}-specialRequirements">Special Requirements</label>
          <textarea id="${destination.id}-specialRequirements" 
                    class="form-input" rows="2" 
                    placeholder="Any special needs, accessibility requirements, etc."
                    >${destination.specialRequirements}</textarea>
        </div>
      </div>
    `;

    container.appendChild(destinationElement);
    
    // Setup input event listeners
    this.setupDestinationInputListeners(destinationElement, destination);
  }

  setupDestinationInputListeners(element, destination) {
    const inputs = element.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const field = e.target.id.split('-')[1];
        destination[field] = e.target.value;
        console.log('Destination updated:', destination);
      });
    });
  }

  removeDestination(destinationId) {
    const index = this.destinations.findIndex(d => d.id === destinationId);
    if (index > -1) {
      this.destinations.splice(index, 1);
      
      const element = document.getElementById(destinationId);
      if (element) {
        element.remove();
      }
      
      this.updateDestinationNumbers();
      console.log('Destination removed:', destinationId);
    }
  }

  updateDestinationNumbers() {
    const numbers = document.querySelectorAll('.destination-number');
    numbers.forEach((number, index) => {
      number.textContent = index + 1;
    });
  }

  setupRemoveButtons() {
    const removeButtons = document.querySelectorAll('.remove-destination');
    removeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const destinationId = e.target.closest('.remove-destination').dataset.destinationId;
        this.removeDestination(destinationId);
      });
    });
  }

  clearDestinations() {
    this.destinations = [];
    const container = document.getElementById('destinationsContainer');
    if (container) {
      container.innerHTML = '';
    }
  }

  showMaxDestinationsMessage() {
    const authManager = window.wayzoApp.authManager;
    if (authManager) {
      authManager.showNotification('Maximum 10 destinations allowed', 'warning');
    }
  }

  getDestinations() {
    return this.destinations;
  }
}

// ====== REFERRAL SYSTEM ======
class ReferralManager {
  constructor() {
    this.userReferralCode = null;
    this.init();
  }

  init() {
    this.generateReferralCode();
    this.setupEventListeners();
  }

  generateReferralCode() {
    // Check if user already has a referral code
    let existingCode = localStorage.getItem('wayzo_referral_code');
    
    if (!existingCode) {
      // Generate new referral code
      const prefix = 'WAYZO';
      const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
      existingCode = prefix + randomChars;
      localStorage.setItem('wayzo_referral_code', existingCode);
    }
    
    this.userReferralCode = existingCode;
    this.displayReferralCode();
  }

  displayReferralCode() {
    const referralCodeElement = document.getElementById('userReferralCode');
    if (referralCodeElement) {
      referralCodeElement.textContent = this.userReferralCode;
    }
  }

  setupEventListeners() {
    const copyBtn = document.getElementById('copyReferralBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyReferralCode());
    }
  }

  copyReferralCode() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(this.userReferralCode).then(() => {
        this.showCopySuccess();
      }).catch(() => {
        this.fallbackCopy();
      });
    } else {
      this.fallbackCopy();
    }
  }

  fallbackCopy() {
    const textArea = document.createElement('textarea');
    textArea.value = this.userReferralCode;
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      this.showCopySuccess();
    } catch (err) {
      console.error('Failed to copy:', err);
    }
    
    document.body.removeChild(textArea);
  }

  showCopySuccess() {
    const copyBtn = document.getElementById('copyReferralBtn');
    if (copyBtn) {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      copyBtn.style.background = '#10b981';
      copyBtn.style.color = 'white';
      
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.background = '';
        copyBtn.style.color = '';
      }, 2000);
    }
  }
}

// ====== DIETARY AND STYLE SELECTION ======
class PreferenceManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupDietaryNeeds();
    this.setupStyleSelection();
  }

  setupDietaryNeeds() {
    const dietaryCheckboxes = document.querySelectorAll('input[name="dietary"]');
    const noRestrictionsCheckbox = document.querySelector('input[value="no-restrictions"]');
    
    if (!dietaryCheckboxes.length) return;
    
    dietaryCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        if (e.target.value === 'no-restrictions') {
          // If "No restrictions" is checked, uncheck others
          if (e.target.checked) {
            dietaryCheckboxes.forEach(cb => {
              if (cb !== e.target) cb.checked = false;
            });
          }
        } else {
          // If any other option is checked, uncheck "No restrictions"
          if (e.target.checked && noRestrictionsCheckbox) {
            noRestrictionsCheckbox.checked = false;
          }
        }
      });
    });
  }

  setupStyleSelection() {
    const styleCheckboxes = document.querySelectorAll('input[name="style"]');
    
    styleCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        console.log('Style selected:', e.target.value);
        // Add visual feedback here if needed
      });
    });
  }
}

// ====== FORM HANDLING ======
class FormManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupFormSubmission();
    this.setupDateFlexibility();
    this.setupChildrenAges();
  }

  setupFormSubmission() {
    const form = document.querySelector('form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }
  }

  setupDateFlexibility() {
    const dateFlexibilityRadios = document.querySelectorAll('input[name="dateFlexibility"]');
    const exactDates = document.getElementById('exactDates');
    const flexibleDates = document.getElementById('flexibleDates');
    
    if (!dateFlexibilityRadios.length || !exactDates || !flexibleDates) return;
    
    dateFlexibilityRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'exact') {
          exactDates.classList.remove('hidden');
          flexibleDates.classList.add('hidden');
        } else {
          exactDates.classList.add('hidden');
          flexibleDates.classList.remove('hidden');
        }
      });
    });
  }

  setupChildrenAges() {
    const childrenInput = document.getElementById('children');
    const childrenAgesField = document.getElementById('childrenAges');
    
    if (!childrenInput || !childrenAgesField) return;
    
    childrenInput.addEventListener('change', (e) => {
      const count = parseInt(e.target.value) || 0;
      if (count > 0) {
        childrenAgesField.classList.remove('hidden');
      } else {
        childrenAgesField.classList.add('hidden');
      }
    });
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!window.wayzoApp.isAuthenticated) {
      window.wayzoApp.authManager.showNotification('Please sign in to create a plan', 'warning');
      window.wayzoApp.authManager.showAuthModal();
      return;
    }
    
    const formData = this.readForm();
    console.log('Form submitted:', formData);
    
    // Show success message
    window.wayzoApp.authManager.showNotification('Trip plan submitted successfully!', 'success');
    
    // Here you would typically send the data to your backend
    // For now, we'll just log it
    return formData;
  }

  readForm() {
    const formData = {
      from: document.getElementById('from')?.value || '',
      destination: document.getElementById('destination')?.value || '',
      dateFlexibility: document.querySelector('input[name="dateFlexibility"]:checked')?.value || '',
      startDate: document.getElementById('startDate')?.value || '',
      endDate: document.getElementById('endDate')?.value || '',
      travelMonth: document.getElementById('travelMonth')?.value || '',
      tripDuration: document.getElementById('tripDuration')?.value || '',
      budget: document.getElementById('budget')?.value || '',
      adults: document.getElementById('adults')?.value || '',
      children: document.getElementById('children')?.value || '',
      childrenAges: document.getElementById('childrenAges')?.value || '',
      style: document.querySelector('input[name="style"]:checked')?.value || '',
      preferences: document.getElementById('preferences')?.value || '',
      dietary: this.getSelectedDietary(),
      professionalBrief: document.getElementById('professionalBrief')?.value || '',
      referralCode: document.getElementById('referralCode')?.value || '',
      destinations: window.wayzoApp.multiDestinationManager?.getDestinations() || []
    };
    
    return formData;
  }

  getSelectedDietary() {
    const selected = [];
    const checkboxes = document.querySelectorAll('input[name="dietary"]:checked');
    checkboxes.forEach(cb => selected.push(cb.value));
    return selected;
  }
}

// ====== INITIALIZATION ======
document.addEventListener('DOMContentLoaded', function() {
  console.log('Wayzo App Initializing...');
  
  // Initialize language manager
  window.wayzoApp.languageManager = new LanguageManager();
  
  // Initialize authentication manager
  window.wayzoApp.authManager = new AuthenticationManager();
  
  // Initialize multi-destination manager
  window.wayzoApp.multiDestinationManager = new MultiDestinationManager();
  
  // Initialize referral manager
  window.wayzoApp.referralManager = new ReferralManager();
  
  // Initialize preference manager
  window.wayzoApp.preferenceManager = new PreferenceManager();
  
  // Initialize form manager
  window.wayzoApp.formManager = new FormManager();
  
  console.log('Wayzo App Initialized Successfully!');
  console.log('App State:', window.wayzoApp);
});

// ====== GLOBAL FUNCTIONS ======
window.copyReferralCode = function() {
  if (window.wayzoApp.referralManager) {
    window.wayzoApp.referralManager.copyReferralCode();
  }
};

window.showAuthModal = function() {
  if (window.wayzoApp.authManager) {
    window.wayzoApp.authManager.showAuthModal();
  }
};

window.hideAuthModal = function() {
  if (window.wayzoApp.authManager) {
    window.wayzoApp.authManager.hideAuthModal();
  }
};

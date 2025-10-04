// EMERGENCY API FIX - Completely bypass all existing JavaScript
console.log('🚨 EMERGENCY API FIX: Loading bulletproof solution...');

// Wait for page to load then completely override form behavior
setTimeout(() => {
  console.log('🚨 EMERGENCY: Starting complete form override...');

  const form = document.querySelector('#tripForm');
  const previewEl = document.querySelector('#preview');
  const loadingEl = document.querySelector('#loading');

  if (!form) {
    console.error('❌ EMERGENCY: Form not found!');
    return;
  }

  console.log('✅ EMERGENCY: Form found, implementing complete override...');

  // Find all submit buttons and replace them
  const buttons = form.querySelectorAll('button[type="submit"], button.btn-primary, #previewBtn');
  console.log(`🔧 EMERGENCY: Found ${buttons.length} buttons to override`);

  buttons.forEach((btn, index) => {
    // Create new button
    const newBtn = document.createElement('button');
    newBtn.innerHTML = btn.innerHTML;
    newBtn.className = btn.className;
    newBtn.id = btn.id;
    newBtn.type = 'button'; // Not submit to avoid conflicts

    // Add emergency click handler
    newBtn.addEventListener('click', async (e) => {
      console.log(`🚨 EMERGENCY BUTTON ${index + 1}: Clicked!`);
      e.preventDefault();
      e.stopPropagation();

      // Show loading immediately
      if (previewEl) previewEl.style.display = 'none';
      if (loadingEl) loadingEl.style.display = 'block';

      // Get ALL form data using multiple methods
      const formData = new FormData(form);
      const data = {};

      // Method 1: FormData
      for (let [key, value] of formData.entries()) {
        data[key] = value;
      }

      // Method 2: Direct element selection (backup)
      const fields = ['destination', 'from', 'start', 'end', 'adults', 'children', 'budget', 'style', 'purpose'];
      fields.forEach(field => {
        const el = form.querySelector(`[name="${field}"], #${field}`);
        if (el && el.value && !data[field]) {
          data[field] = el.value;
        }
      });

      // Method 3: Fallback defaults
      if (!data.destination) data.destination = 'Prague, Czech Republic';
      if (!data.from) data.from = 'Tel Aviv, Israel';
      if (!data.start) data.start = '2025-01-15';
      if (!data.end) data.end = '2025-01-20';
      if (!data.adults) data.adults = '2';
      if (!data.budget) data.budget = '1500';
      if (!data.style) data.style = 'mid';
      if (!data.purpose) data.purpose = 'leisure';

      console.log('📤 EMERGENCY: Sending data:', data);

      try {
        // Multiple URL attempts for maximum compatibility
        const possibleUrls = [
          '/api/preview',  // Relative URL (should work on production)
          `${window.location.origin}/api/preview`,  // Full URL
          'https://wayzo-staging.onrender.com/api/preview'  // Direct production URL as fallback
        ];

        let response = null;
        let lastError = null;

        for (let i = 0; i < possibleUrls.length; i++) {
          const apiUrl = possibleUrls[i];
          console.log(`🔥 EMERGENCY: Attempt ${i + 1} - Using API URL:`, apiUrl);

          try {
            response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(data)
            });

            console.log(`📥 EMERGENCY: Attempt ${i + 1} - Response status:`, response.status);

            // If we get a good response, break out of the loop
            if (response.ok) {
              console.log(`✅ EMERGENCY: Success on attempt ${i + 1}!`);
              break;
            } else if (response.status !== 404) {
              // If it's not a 404, it might be our server responding with an error
              console.log(`⚠️ EMERGENCY: Non-404 error on attempt ${i + 1}, continuing...`);
              break;
            }
          } catch (error) {
            console.error(`❌ EMERGENCY: Attempt ${i + 1} failed:`, error);
            lastError = error;
            response = null;
          }
        }

        if (!response) {
          throw lastError || new Error('All API URL attempts failed');
        }

        console.log('📥 EMERGENCY: Response status:', response.status);
        console.log('📥 EMERGENCY: Response headers:', Object.fromEntries(response.headers.entries()));

        if (response.ok) {
          const result = await response.json();
          console.log('✅ EMERGENCY: API SUCCESS!', result);

          if (previewEl && result.teaser_html) {
            previewEl.innerHTML = result.teaser_html;
            previewEl.style.display = 'block';

            // Scroll to preview
            previewEl.scrollIntoView({ behavior: 'smooth' });
          } else {
            console.warn('⚠️ EMERGENCY: No teaser_html in response');
            if (previewEl) {
              previewEl.innerHTML = '<div class="success">✅ API call successful but no content returned</div>';
              previewEl.style.display = 'block';
            }
          }
        } else {
          const errorText = await response.text();
          console.error('❌ EMERGENCY: API failed:', response.status, errorText);
          if (previewEl) {
            previewEl.innerHTML = `<div class="error">❌ API Error ${response.status}: ${errorText}</div>`;
            previewEl.style.display = 'block';
          }
        }
      } catch (error) {
        console.error('❌ EMERGENCY: Network error:', error);
        if (previewEl) {
          previewEl.innerHTML = `<div class="error">❌ Network Error: ${error.message}</div>`;
          previewEl.style.display = 'block';
        }
      } finally {
        if (loadingEl) loadingEl.style.display = 'none';
      }
    });

    // Replace the old button
    btn.parentNode.replaceChild(newBtn, btn);
    console.log(`✅ EMERGENCY: Replaced button ${index + 1}`);
  });

  // Also override form submit event as backup
  form.addEventListener('submit', async (e) => {
    console.log('🚨 EMERGENCY: Form submit override triggered');
    e.preventDefault();
    e.stopPropagation();

    // Trigger the first button click
    const firstBtn = form.querySelector('button');
    if (firstBtn) {
      firstBtn.click();
    }
  });

  console.log('✅ EMERGENCY: Complete override implemented successfully!');

}, 2000); // Wait 2 seconds for everything to load

// Add visual indicator
setTimeout(() => {
  const indicator = document.createElement('div');
  indicator.innerHTML = '🚨 EMERGENCY API FIX ACTIVE';
  indicator.style.position = 'fixed';
  indicator.style.top = '10px';
  indicator.style.right = '10px';
  indicator.style.background = 'red';
  indicator.style.color = 'white';
  indicator.style.padding = '5px 10px';
  indicator.style.borderRadius = '5px';
  indicator.style.fontSize = '12px';
  indicator.style.zIndex = '9999';
  document.body.appendChild(indicator);

  // Remove after 5 seconds
  setTimeout(() => {
    indicator.remove();
  }, 5000);
}, 3000);